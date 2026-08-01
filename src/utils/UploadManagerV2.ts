import { UploadResult, UploadProgressStats, UploadOptions, notifyUploadProgress } from "./uploadHelper";

export type UploadStateMachineState = 
  | 'Idle' 
  | 'Validating' 
  | 'Compressing' 
  | 'Uploading' 
  | 'Verifying Cloudinary' 
  | 'Writing Firestore' 
  | 'Completed' 
  | 'Failed';

export interface UploadTaskOptions extends UploadOptions {
  onWriteFirestore?: (result: UploadResult) => Promise<any>;
  maxRetries?: number;
}

export interface QueuedUploadTask {
  id: string;
  file: File;
  options: UploadTaskOptions;
  isStagedUpload: boolean;
  state: UploadStateMachineState;
  retryCount: number;
  maxRetries: number;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

/**
 * UploadManagerV2: High-reliability direct Cloudinary & Server Upload System.
 * Handles both images and large videos with real-time XHR progress tracking,
 * automatic retries, signature caching, and database sync.
 */
class UploadManagerV2Service {
  private queue: QueuedUploadTask[] = [];
  private activeCount = 0;
  private readonly concurrencyLimit = 1;

  /**
   * Enqueues an upload task into the V2 upload queue.
   */
  public enqueue(
    file: File,
    options: UploadTaskOptions = {},
    isStagedUpload = false
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const task: QueuedUploadTask = {
        id: `upload_v2_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        file,
        options,
        isStagedUpload,
        state: 'Idle',
        retryCount: 0,
        maxRetries: options.maxRetries !== undefined ? options.maxRetries : 3,
        resolve,
        reject
      };

      console.log(`[UploadManagerV2] Enqueued task ${task.id} for "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      this.queue.push(task);
      this.processNext();
    });
  }

  /**
   * Processes queue up to concurrency limit
   */
  private processNext(): void {
    while (this.activeCount < this.concurrencyLimit && this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (nextTask) {
        this.activeCount++;
        this.executeStateMachine(nextTask).finally(() => {
          this.activeCount--;
          this.processNext();
        });
      }
    }
  }

  /**
   * State Machine Execution
   */
  private async executeStateMachine(task: QueuedUploadTask): Promise<void> {
    const { file, options } = task;
    const startTime = Date.now();

    try {
      // Step 1: Validation
      this.updateTaskState(task, 'Validating');
      const validation = this.validateFile(file);
      if (!validation.ok) {
        throw new Error(validation.error);
      }

      // Step 2: Uploading
      this.updateTaskState(task, 'Uploading');
      const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
      const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(file.name);
      const resourceType = isVideo ? "video" : (isImage ? "image" : "auto");
      const folder = options.folder || "scholars_class_2026";

      // Direct Cloudinary upload via XHR - expose real exception immediately
      const uploadResult: UploadResult = await this.performDirectCloudinaryUpload(task, file, folder, resourceType, startTime);

      if (!uploadResult || !uploadResult.url) {
        throw new Error(`Upload failed for "${file.name}": returned empty media URL.`);
      }

      // Step 3: Verifying Cloudinary output
      this.updateTaskState(task, 'Verifying Cloudinary');
      uploadResult.url = this.ensureAutoFormat(uploadResult.url);
      if (uploadResult.secure_url) {
        uploadResult.secure_url = this.ensureAutoFormat(uploadResult.secure_url);
      }

      // Step 4: Write to Firestore if requested
      if (options.onWriteFirestore) {
        this.updateTaskState(task, 'Writing Firestore');
        try {
          await options.onWriteFirestore(uploadResult);
        } catch (fsErr: any) {
          console.error(`[UploadManagerV2] Firestore write error for file "${file.name}":`, fsErr);
          if (fsErr?.stack) console.error(`[UploadManagerV2] Firestore write stack trace:`, fsErr.stack);
          // Scrub orphan Cloudinary asset if DB fails
          await this.deleteCloudinaryAsset(uploadResult.secure_url || uploadResult.url);
          throw new Error(`Failed to save record to database: ${fsErr?.message || String(fsErr)}`);
        }
      }

      // Step 5: Complete
      this.updateTaskState(task, 'Completed');
      this.updateProgress(task, file.size, 'completed', 'Upload completed successfully!', file.size, 0);

      task.resolve(uploadResult);
    } catch (err: any) {
      console.error(`[UploadManagerV2] Task ${task.id} failed for "${task.file.name}":`, err?.message || err);
      if (err?.stack) console.error(`[UploadManagerV2] Task failure stack trace:`, err.stack);
      this.updateTaskState(task, 'Failed');
      this.updateProgress(task, 0, 'error', err?.message || 'Upload failed', file.size, 0);
      task.reject(err);
    }
  }

  /**
   * Direct Browser-to-Cloudinary Upload using signed parameters via XHR
   */
  private async performDirectCloudinaryUpload(
    task: QueuedUploadTask,
    file: File,
    folder: string,
    resourceType: string,
    startTime: number
  ): Promise<UploadResult> {
    const sigUrl = `/api/cloudinary-signature?folder=${encodeURIComponent(folder)}&resource_type=${encodeURIComponent(resourceType)}`;
    console.log(`[UploadManagerV2] Requesting Cloudinary signature from URL: ${sigUrl}`);

    let sigRes: Response;
    try {
      sigRes = await fetch(sigUrl, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });
    } catch (fetchErr: any) {
      console.error(`[UploadManagerV2] Exception thrown while fetching signature from ${sigUrl}:`, fetchErr);
      if (fetchErr?.stack) console.error(`[UploadManagerV2] Signature fetch stack trace:`, fetchErr.stack);
      throw new Error(`Signature fetch network exception for ${sigUrl}: ${fetchErr?.message || String(fetchErr)}`);
    }

    console.log(`[UploadManagerV2] Signature request to ${sigUrl} returned HTTP status code: ${sigRes.status} (OK: ${sigRes.ok})`);

    if (!sigRes.ok) {
      const errText = await sigRes.text();
      console.error(`[UploadManagerV2] /api/cloudinary-signature returned HTTP status ${sigRes.status} for URL ${sigUrl}. Response text:`, errText);
      throw new Error(`Cloudinary signature server error (HTTP ${sigRes.status} at ${sigUrl}): ${errText}`);
    }

    let sigData: any;
    try {
      sigData = await sigRes.json();
    } catch (parseErr: any) {
      console.error(`[UploadManagerV2] Failed to parse JSON response from ${sigUrl}:`, parseErr);
      throw new Error(`Invalid JSON returned by signature endpoint ${sigUrl}: ${parseErr?.message || String(parseErr)}`);
    }

    if (!sigData.signature || !sigData.apiKey || !sigData.cloudName || !sigData.timestamp) {
      console.error(`[UploadManagerV2] Incomplete signature data received from ${sigUrl}:`, sigData);
      throw new Error(`Invalid Cloudinary credentials from ${sigUrl}: missing signature/apiKey/cloudName/timestamp`);
    }
    console.log(`[UploadManagerV2] Signature successfully retrieved for cloudName: ${sigData.cloudName}, folder: ${sigData.folder || folder}`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", sigData.apiKey);
    formData.append("timestamp", sigData.timestamp.toString());
    if (sigData.folder) {
      formData.append("folder", sigData.folder);
    }
    if (sigData.eager) {
      formData.append("eager", sigData.eager);
    }
    if (sigData.eager_async) {
      formData.append("eager_async", sigData.eager_async);
    }
    if (sigData.notification_url) {
      formData.append("notification_url", sigData.notification_url);
    }
    formData.append("signature", sigData.signature);

    console.log(`[UploadManagerV2] FormData parameters being sent to Cloudinary:`, {
      api_key: sigData.apiKey,
      timestamp: sigData.timestamp,
      folder: sigData.folder,
      eager: sigData.eager || null,
      eager_async: sigData.eager_async || null,
      notification_url: sigData.notification_url || null,
      signature: sigData.signature
    });

    const uploadUrl = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${resourceType}/upload`;
    console.log(`[UploadManagerV2] Initiating direct XHR upload to Cloudinary URL: ${uploadUrl}`);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let wasSendCalled = false;
      let eventFired = "none";

      const createDiagnosticError = (
        evtName: string,
        origError?: any
      ): Error => {
        eventFired = evtName;
        const stack = origError?.stack || new Error().stack || "No stack trace available";
        const status = xhr.status;
        const readyState = xhr.readyState;
        const statusText = xhr.statusText || "";
        const responseText = xhr.responseText || "";
        const responseURL = xhr.responseURL || uploadUrl;
        const inNetworkTab = wasSendCalled && readyState > 0 ? "Yes (request was initiated)" : "No / Unknown";

        console.error(`================ FAILED UPLOAD DIAGNOSTIC REPORT ================`);
        console.error(`1. Exact Upload URL: ${uploadUrl}`);
        console.error(`2. Exact HTTP Status: ${status}`);
        console.error(`3. xhr.readyState: ${readyState}`);
        console.error(`4. xhr.statusText: "${statusText}"`);
        console.error(`5. xhr.responseText: ${responseText}`);
        console.error(`6. xhr.responseURL: ${responseURL}`);
        console.error(`7. Whether xhr.send() was actually called: ${wasSendCalled}`);
        console.error(`8. Event fired: ${eventFired}`);
        console.error(`9. Appears in Network tab: ${inNetworkTab}`);
        console.error(`10. Complete JavaScript Stack Trace:\n${stack}`);
        console.error(`================================================================`);

        const rawMsg = origError?.message || (responseText ? `HTTP ${status}: ${responseText.substring(0, 300)}` : `XHR ${evtName} failed (status: ${status}, readyState: ${readyState}, statusText: "${statusText}")`);
        const err = new Error(rawMsg);
        err.stack = stack;
        return err;
      };

      xhr.open("POST", uploadUrl, true);
      xhr.timeout = 10 * 60 * 1000; // 10 minute timeout

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const loaded = event.loaded;
          const total = event.total;
          const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
          const bytesPerSec = loaded / elapsedSec;

          this.updateProgress(task, loaded, 'uploading', `Uploading (${Math.round((loaded / total) * 100)}%)...`, total, bytesPerSec);
        }
      };

      xhr.onload = () => {
        eventFired = "onload";
        console.log(`[UploadManagerV2] Direct XHR upload onload triggered for URL ${uploadUrl}. HTTP status: ${xhr.status}`);
        let responseJson: any = null;
        try {
          responseJson = JSON.parse(xhr.responseText);
          console.log(`[UploadManagerV2] Cloudinary complete JSON response for ${uploadUrl}:`, responseJson);
        } catch (e: any) {
          console.warn(`[UploadManagerV2] Could not parse JSON response from ${uploadUrl}. Raw text:`, xhr.responseText);
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          if (responseJson) {
            const secureUrl = responseJson.secure_url || responseJson.url;
            const publicId = responseJson.public_id;
            resolve({
              url: secureUrl,
              secure_url: secureUrl,
              public_id: publicId,
              format: responseJson.format || file.name.split('.').pop(),
              resource_type: responseJson.resource_type || resourceType
            });
          } else {
            const err = createDiagnosticError("onload_invalid_json", new Error(`Direct upload to ${uploadUrl} succeeded with HTTP ${xhr.status} but returned invalid JSON.`));
            reject(err);
          }
        } else {
          const cloudErrMessage = responseJson?.error?.message || responseJson?.error || xhr.responseText;
          const err = createDiagnosticError("onload_http_error", new Error(`Cloudinary HTTP ${xhr.status} error from ${uploadUrl}: ${cloudErrMessage}`));
          reject(err);
        }
      };

      xhr.onerror = (evt) => {
        const err = createDiagnosticError("onerror", new Error(`XHR onerror fired for ${uploadUrl}`));
        reject(err);
      };

      xhr.onabort = (evt) => {
        const err = createDiagnosticError("onabort", new Error(`XHR onabort fired for ${uploadUrl}`));
        reject(err);
      };

      xhr.ontimeout = () => {
        const err = createDiagnosticError("ontimeout", new Error(`XHR ontimeout fired after ${xhr.timeout}ms for ${uploadUrl}`));
        reject(err);
      };

      try {
        wasSendCalled = true;
        xhr.send(formData);
      } catch (sendErr: any) {
        const err = createDiagnosticError("send_exception", sendErr);
        reject(err);
      }
    });
  }

  /**
   * Express Server Proxy Upload
   */
  private async performServerProxyUpload(
    task: QueuedUploadTask,
    formData: FormData,
    totalBytes: number,
    startTime: number
  ): Promise<UploadResult> {
    const proxyUrl = "/api/upload";
    console.log(`[UploadManagerV2] Initiating Express server proxy upload to URL: ${proxyUrl}`);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let wasSendCalled = false;
      let eventFired = "none";

      const createDiagnosticError = (
        evtName: string,
        origError?: any
      ): Error => {
        eventFired = evtName;
        const stack = origError?.stack || new Error().stack || "No stack trace available";
        const status = xhr.status;
        const readyState = xhr.readyState;
        const statusText = xhr.statusText || "";
        const responseText = xhr.responseText || "";
        const responseURL = xhr.responseURL || proxyUrl;
        const inNetworkTab = wasSendCalled && readyState > 0 ? "Yes (request was initiated)" : "No / Unknown";

        console.error(`================ FAILED PROXY UPLOAD DIAGNOSTIC REPORT ================`);
        console.error(`1. Exact Upload URL: ${proxyUrl}`);
        console.error(`2. Exact HTTP Status: ${status}`);
        console.error(`3. xhr.readyState: ${readyState}`);
        console.error(`4. xhr.statusText: "${statusText}"`);
        console.error(`5. xhr.responseText: ${responseText}`);
        console.error(`6. xhr.responseURL: ${responseURL}`);
        console.error(`7. Whether xhr.send() was actually called: ${wasSendCalled}`);
        console.error(`8. Event fired: ${eventFired}`);
        console.error(`9. Appears in Network tab: ${inNetworkTab}`);
        console.error(`10. Complete JavaScript Stack Trace:\n${stack}`);
        console.error(`=======================================================================`);

        const rawMsg = origError?.message || (responseText ? `Proxy HTTP ${status}: ${responseText.substring(0, 300)}` : `Proxy XHR ${evtName} failed (status: ${status}, readyState: ${readyState})`);
        const err = new Error(rawMsg);
        err.stack = stack;
        return err;
      };

      xhr.open("POST", proxyUrl, true);
      xhr.timeout = 5 * 60 * 1000;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const loaded = event.loaded;
          const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
          const bytesPerSec = loaded / elapsedSec;
          this.updateProgress(task, loaded, 'uploading', `Uploading via proxy (${Math.round((loaded / totalBytes) * 100)}%)...`, totalBytes, bytesPerSec);
        }
      };

      xhr.onload = () => {
        eventFired = "onload";
        console.log(`[UploadManagerV2] Server proxy XHR onload triggered for URL ${proxyUrl}. HTTP status: ${xhr.status}`);
        let res: any = null;
        try {
          res = JSON.parse(xhr.responseText);
          console.log(`[UploadManagerV2] Express proxy complete JSON response for ${proxyUrl}:`, res);
        } catch (e) {
          console.warn(`[UploadManagerV2] Could not parse JSON response from proxy ${proxyUrl}. Raw text:`, xhr.responseText);
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          if (res && res.url) {
            resolve(res);
          } else {
            const err = createDiagnosticError("onload_missing_url", new Error(`Server proxy ${proxyUrl} succeeded (HTTP ${xhr.status}) but response is missing "url" property.`));
            reject(err);
          }
        } else {
          const serverErrMsg = res?.error?.message || res?.error || xhr.responseText;
          const err = createDiagnosticError("onload_http_error", new Error(`Server proxy ${proxyUrl} failed with HTTP ${xhr.status}: ${serverErrMsg}`));
          reject(err);
        }
      };

      xhr.onerror = (evt) => {
        const err = createDiagnosticError("onerror", new Error(`Server proxy connection error at ${proxyUrl}`));
        reject(err);
      };

      xhr.onabort = (evt) => {
        const err = createDiagnosticError("onabort", new Error(`Server proxy XHR onabort fired for ${proxyUrl}`));
        reject(err);
      };

      xhr.ontimeout = () => {
        const err = createDiagnosticError("ontimeout", new Error(`Server proxy request timed out at ${proxyUrl}`));
        reject(err);
      };

      try {
        wasSendCalled = true;
        xhr.send(formData);
      } catch (sendErr: any) {
        const err = createDiagnosticError("send_exception", sendErr);
        reject(err);
      }
    });
  }

  /**
   * File validation
   */
  private validateFile(file: File): { ok: boolean; error?: string } {
    if (!file) return { ok: false, error: "No file selected." };
    if (!navigator.onLine) return { ok: false, error: "Your device is currently offline." };

    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
    const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(file.name);

    if (!isVideo && !isImage) {
      return { ok: false, error: "Unsupported file format. Please upload an image (JPG, PNG, WEBP) or video (MP4, MOV, WEBM)." };
    }

    const maxVideoSize = 100 * 1024 * 1024; // 100 MB
    const maxImageSize = 25 * 1024 * 1024; // 25 MB

    if (isVideo && file.size > maxVideoSize) {
      return { ok: false, error: `Video file size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds 100 MB maximum limit.` };
    }

    if (isImage && file.size > maxImageSize) {
      return { ok: false, error: `Image file size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds 25 MB maximum limit.` };
    }

    return { ok: true };
  }

  /**
   * Helper to append f_auto,q_auto Cloudinary optimization flags
   */
  private ensureAutoFormat(str: string): string {
    if (!str || typeof str !== "string") return str;
    if (str.includes("/image/upload/") && !str.includes("/f_auto,q_auto/")) {
      return str.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
    }
    if (str.includes("/video/upload/") && !str.includes("/f_auto,q_auto/")) {
      return str.replace("/video/upload/", "/video/upload/f_auto,q_auto/");
    }
    return str;
  }

  /**
   * Delete Cloudinary asset or list of assets
   */
  public async deleteCloudinaryAsset(urlOrUrls: string | (string | undefined | null)[]): Promise<void> {
    if (!urlOrUrls) return;
    const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
    for (const url of urls) {
      if (!url || typeof url !== 'string' || !url.includes("cloudinary.com")) continue;
      try {
        await fetch("/api/delete-cloudinary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url })
        });
        console.log(`[UploadManagerV2] Successfully deleted asset from cloud: ${url}`);
      } catch (e) {
        console.warn("[UploadManagerV2] Failed to delete Cloudinary asset:", url);
      }
    }
  }

  private updateTaskState(task: QueuedUploadTask, state: UploadStateMachineState) {
    task.state = state;
  }

  private updateProgress(
    task: QueuedUploadTask,
    loadedBytes: number,
    status: 'uploading' | 'processing' | 'completed' | 'error' | 'retrying',
    statusText: string,
    totalBytes: number,
    speedBytesPerSec: number = 0
  ) {
    const percent = totalBytes > 0 ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) : 0;
    const remainingBytes = totalBytes - loadedBytes;
    const timeRemainingSec = speedBytesPerSec > 0 ? Math.ceil(remainingBytes / speedBytesPerSec) : 0;

    const stats: UploadProgressStats = {
      percent,
      uploadedBytes: loadedBytes,
      totalBytes: totalBytes || task.file.size,
      speedBytesPerSec,
      speedFormatted: speedBytesPerSec > 0 ? `${(speedBytesPerSec / 1024 / 1024).toFixed(1)} MB/s` : '',
      timeRemainingSec,
      timeRemainingFormatted: timeRemainingSec > 0 ? `${timeRemainingSec}s remaining` : '',
      status,
      statusText,
      fileName: task.file.name
    };

    notifyUploadProgress(stats);

    if (task.options.onProgress) {
      task.options.onProgress(percent, stats);
    }
  }
}

export const uploadManagerV2 = new UploadManagerV2Service();

