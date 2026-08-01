import { UploadResult, UploadProgressStats, UploadOptions, subscribeToUploadProgress } from "./uploadHelper";

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
 * Production-grade Upload Manager implementing a strict state machine,
 * automated retry with exponential backoff, concurrency queuing, health checks,
 * and orphan asset cleanup.
 */
class UploadManagerService {
  private queue: QueuedUploadTask[] = [];
  private activeCount = 0;
  private readonly concurrencyLimit = 2;
  private backgroundCleanupInterval: any = null;

  constructor() {
    this.initBackgroundCleanup();
  }

  /**
   * Enqueues an upload task and initiates processing if below concurrency limit.
   */
  public enqueue(
    file: File,
    options: UploadTaskOptions = {},
    isStagedUpload = false
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const task: QueuedUploadTask = {
        id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        file,
        options,
        isStagedUpload,
        state: 'Idle',
        retryCount: 0,
        maxRetries: options.maxRetries !== undefined ? options.maxRetries : 3,
        resolve,
        reject
      };

      this.logStateChange(task, 'Idle', "Task enqueued in UploadManager queue.");
      this.queue.push(task);
      this.processNext();
    });
  }

  /**
   * Dequeues and processes pending uploads up to concurrency limit.
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
   * Core State Machine Runner
   */
  private async executeStateMachine(task: QueuedUploadTask): Promise<void> {
    const { file, options, isStagedUpload } = task;
    const startTime = Date.now();

    try {
      // -------------------------------------------------------------
      // STEP 1: User selected file.
      // -------------------------------------------------------------
      this.logStep(1, "User selected file.", {
        name: file.name,
        size: file.size,
        type: file.type,
        id: task.id
      });

      // -------------------------------------------------------------
      // STATE: Validating
      // -------------------------------------------------------------
      this.transitionState(task, 'Validating');

      // 1. Basic File Validation
      if (!file || file.size === 0) {
        throw this.createStepError("Validating", "The selected file is empty or invalid.", 400);
      }

      const fileName = file.name.toLowerCase();
      const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(fileName);
      const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(fileName);

      if (!isImage && !isVideo) {
        throw this.createStepError("Validating", "Unsupported file format. Please select a valid image (JPG, PNG, WEBP) or video (MP4, MOV, WEBM).", 400);
      }

      const maxSize = isVideo ? 90 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const limitMb = isVideo ? "90" : "10";
        throw this.createStepError("Validating", `File size (${sizeMb} MB) exceeds the maximum limit of ${limitMb} MB. Please select a smaller file.`, 413);
      }

      // 2. Pre-Upload Health Check
      const health = await this.checkUploadHealth();
      if (!health.ok) {
        throw this.createStepError("Validating (Health Check)", health.error || "Upload service is not ready.", 503);
      }

      // -------------------------------------------------------------
      // STATE: Compressing (Images only)
      // -------------------------------------------------------------
      let fileToUpload = file;
      let stagedDataUrl: string | null = null;

      if (isImage) {
        this.transitionState(task, 'Compressing');
        this.logStep(2, "Compression begins.");
        this.updateStats(task, 0, 'processing', 'Optimizing image...');

        try {
          if (isStagedUpload) {
            // Convert to base64 with compression for moderation staging
            stagedDataUrl = await this.compressToBase64(file);
          } else {
            // Compress image Blob/File for Cloudinary upload
            fileToUpload = await this.compressImageFile(file);
          }
          this.logStep(3, "Compression completed.", { originalSize: file.size, newSize: fileToUpload.size });
        } catch (compErr: any) {
          console.warn("[UPLOAD MANAGER] Image compression warning, using original file:", compErr.message);
          this.logStep(3, "Compression completed (fallback to original file).");
          if (isStagedUpload) {
            stagedDataUrl = await this.fileToDataUrl(file);
          }
        }
      }

      // If this is a staged base64 upload (not direct to Cloudinary), complete immediately
      if (isStagedUpload && stagedDataUrl) {
        this.transitionState(task, 'Completed');
        this.logStep(15, "Upload completed (Staged locally for moderation).");
        this.updateStats(task, file.size, 'completed', 'Staged successfully');
        task.resolve({ isStaged: true, dataUrl: stagedDataUrl, url: stagedDataUrl });
        return;
      }

      // -------------------------------------------------------------
      // STATE: Uploading (with automated retry & exponential backoff)
      // -------------------------------------------------------------
      this.transitionState(task, 'Uploading');

      const resourceType = isVideo ? "video" : isImage ? "image" : "auto";
      const folder = options.folder || "scholars_class_2026";
      const endpointUrl = "/api/upload";

      let uploadResult: UploadResult | null = null;
      let attempt = 0;

      while (attempt <= task.maxRetries) {
        try {
          this.logStep(4, `Upload started (Attempt ${attempt + 1}/${task.maxRetries + 1}).`);
          this.updateStats(task, 0, attempt > 0 ? 'retrying' : 'uploading', attempt > 0 ? `Retrying upload (Attempt ${attempt + 1}/${task.maxRetries + 1})...` : 'Uploading file to cloud...');

          if (isVideo) {
            // Requirement 1 & 2: Large videos MUST bypass Express proxy and upload directly via signed Cloudinary upload
            this.logStep(5, `Initiating direct signed video upload to Cloudinary.`);
            uploadResult = await this.performDirectCloudinaryUpload(task, fileToUpload, folder, resourceType, startTime);
          } else {
            // For images (max 10 MB), try direct upload first, falling back to Express proxy if direct upload fails
            try {
              this.logStep(5, `Initiating direct signed image upload to Cloudinary.`);
              uploadResult = await this.performDirectCloudinaryUpload(task, fileToUpload, folder, resourceType, startTime);
            } catch (dirErr: any) {
              console.warn(`[UPLOAD] Direct image upload failed (${dirErr.message}), falling back to Express proxy /api/upload...`);
              const formData = new FormData();
              formData.append("file", fileToUpload);
              formData.append("resource_type", resourceType);
              formData.append("folder", folder);
              uploadResult = await this.performNetworkUpload(task, endpointUrl, formData, fileToUpload.size, startTime);
            }
          }
          break; // Success! Break retry loop
        } catch (netErr: any) {
          attempt++;
          const isRetryable = this.isRetryableError(netErr);
          if (attempt <= task.maxRetries && isRetryable) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 8000);
            console.warn(`[UPLOAD RETRY] Attempt ${attempt}/${task.maxRetries} failed: ${netErr.message}. Retrying in ${Math.round(backoffMs)}ms...`);
            this.updateStats(task, 0, 'retrying', `Network glitch detected. Retrying in ${Math.round(backoffMs / 1000)}s...`);
            await new Promise(r => setTimeout(r, backoffMs));
          } else {
            throw netErr;
          }
        }
      }

      if (!uploadResult) {
        throw this.createStepError("Uploading", "Upload failed after maximum retries.", 504);
      }

      // -------------------------------------------------------------
      // STATE: Verifying Cloudinary
      // -------------------------------------------------------------
      this.transitionState(task, 'Verifying Cloudinary');
      if (!uploadResult.url || !uploadResult.url.startsWith("http")) {
        throw this.createStepError("Verifying Cloudinary", "Cloudinary upload succeeded but did not return a valid secure URL.", 500, uploadResult);
      }

      // -------------------------------------------------------------
      // STATE: Writing Firestore (with automatic orphan cleanup on failure)
      // -------------------------------------------------------------
      this.transitionState(task, 'Writing Firestore');
      this.logStep(11, "Firestore write started.");

      if (options.onWriteFirestore) {
        try {
          await options.onWriteFirestore(uploadResult);
          this.logStep(12, "Firestore write completed.");
        } catch (fsErr: any) {
          this.logStepFailure("Writing Firestore", fsErr.message || "Failed to commit upload record to database.", 500, uploadResult, fsErr);
          
          // Requirement 6: If Cloudinary succeeds but Firestore fails, automatically delete Cloudinary asset!
          console.warn(`[ORPHAN CLEANUP] Firestore write failed! Automatically scrubbing orphaned Cloudinary asset: ${uploadResult.url}...`);
          await this.deleteCloudinaryAsset(uploadResult.secure_url || uploadResult.url);
          
          throw this.createStepError("Writing Firestore", `Failed to save upload record to database (${fsErr.message}). The cloud image was cleaned up automatically. Please try again.`, 500);
        }
      } else {
        this.logStep(12, "Firestore write completed (No secondary write hook required).");
      }

      // -------------------------------------------------------------
      // STATE: Completed
      // -------------------------------------------------------------
      this.transitionState(task, 'Completed');
      this.logStep(15, "Upload completed successfully.", uploadResult);
      this.updateStats(task, fileToUpload.size, 'completed', 'Upload complete!');
      task.resolve(uploadResult);

    } catch (err: any) {
      this.transitionState(task, 'Failed');
      this.logStepFailure(task.state, err.message || "Upload failed.", err.status || 500, err.cloudinaryResp, err.expressErr, err.stack);
      this.updateStats(task, 0, 'error', err.message || 'Upload failed');
      task.reject(err);
    }
  }

  /**
   * Executes XHR/Fetch upload with real-time progress events
   */
  private performNetworkUpload(
    task: QueuedUploadTask,
    endpointUrl: string,
    formData: FormData,
    totalSize: number,
    startTime: number
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpointUrl, true);
      xhr.withCredentials = true;
      xhr.setRequestHeader("Accept", "application/json");
      xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const loaded = event.loaded;
          const percent = Math.min(99, Math.round((loaded / totalSize) * 100));
          const elapsedSec = Math.max(0.2, (Date.now() - startTime) / 1000);
          const speed = loaded / elapsedSec;
          const remainingSec = Math.max(0, (totalSize - loaded) / Math.max(1, speed));

          this.updateStats(task, loaded, 'uploading', `Uploading (${percent}%)...`, {
            percent,
            speedBytesPerSec: speed,
            timeRemainingSec: remainingSec
          });
        }
      };

      xhr.onload = () => {
        const status = xhr.status;
        if (status === 413) {
          reject(this.createStepError("Uploading", "File size exceeds server limits (HTTP 413: Payload Too Large). Please upload an image under 10 MB or video under 90 MB.", 413));
          return;
        }

        let responseJson: any = {};
        try {
          responseJson = JSON.parse(xhr.responseText);
        } catch {
          const errMsg = `Server returned an unexpected non-JSON response (HTTP ${status}). Please verify your internet connection or check server status.`;
          reject(this.createStepError("Uploading", errMsg, status || 500));
          return;
        }

        if (status >= 200 && status < 300 && responseJson.success !== false && (responseJson.url || responseJson.secure_url)) {
          // STEP 14: Frontend received JSON.
          this.logStep(14, "Frontend received JSON.", responseJson);
          resolve(responseJson as UploadResult);
        } else {
          const errMsg = responseJson.error || `Server error (HTTP ${status})`;
          reject(this.createStepError("Uploading", errMsg, status || 500, responseJson));
        }
      };

      xhr.onerror = () => {
        reject(this.createStepError("Uploading", "Network connection was interrupted while uploading. Please check your internet connection.", 0));
      };

      xhr.ontimeout = () => {
        reject(this.createStepError("Uploading", "The upload timed out because the server took too long to respond.", 504));
      };

      // Set timeout to 5 mins for video, 2 mins for image
      xhr.timeout = task.file.type.startsWith("video/") ? 300000 : 120000;
      xhr.send(formData);
    });
  }

  /**
   * Helper to format secure Cloudinary URLs with auto-optimization parameters
   */
  private optimizeUrl(url: string | null | undefined): string {
    if (!url) return "";
    const str = String(url);
    if (!str.includes("cloudinary.com")) return str;

    if (str.includes("/image/upload/")) {
      if (str.includes("/f_auto,q_auto")) return str;
      return str.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
    }
    if (str.includes("/video/upload/")) {
      if (str.includes("/f_auto,q_auto")) return str;
      return str.replace("/video/upload/", "/video/upload/f_auto,q_auto/");
    }
    return str;
  }

  /**
   * Executes direct browser-to-Cloudinary signed upload
   */
  private async performDirectCloudinaryUpload(
    task: QueuedUploadTask,
    file: File,
    folder: string,
    resourceType: string,
    startTime: number
  ): Promise<UploadResult> {
    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
    const targetResType = isVideo ? "video" : (file.type.startsWith("image/") ? "image" : (resourceType && resourceType !== "auto" ? resourceType : "auto"));

    this.logStep(5, `Requesting Cloudinary signature from /api/cloudinary-signature for resource_type=${targetResType}...`);

    const sigRes = await fetch(`/api/cloudinary-signature?folder=${encodeURIComponent(folder)}&resource_type=${encodeURIComponent(targetResType)}`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    if (!sigRes.ok) {
      const errText = await sigRes.text().catch(() => "");
      throw this.createStepError("Signing", `Failed to get upload credentials from server (HTTP ${sigRes.status}). ${errText}`, sigRes.status);
    }

    const sigData = await sigRes.json();
    if (!sigData.success || !sigData.signature) {
      throw this.createStepError("Signing", sigData.error || "Server returned invalid signature data.", 500);
    }

    this.logStep(6, `Signature obtained. Starting direct browser-to-Cloudinary XHR upload (${targetResType})...`);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", sigData.apiKey);
    formData.append("timestamp", sigData.timestamp);
    formData.append("folder", sigData.folder);
    if (sigData.eager) {
      formData.append("eager", sigData.eager);
    }
    if (sigData.eager_async) {
      formData.append("eager_async", sigData.eager_async);
    }
    if (sigData.notification_url) {
      formData.append("notification_url", sigData.notification_url);
    }
    if (sigData.transformation) {
      formData.append("transformation", sigData.transformation);
    }
    formData.append("signature", sigData.signature);

    formData.append("resource_type", targetResType);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${targetResType}/upload`;

    // Explicitly log the exact multipart/form-data request parameters for verification
    const exactRequestParams: Record<string, any> = {};
    formData.forEach((value, key) => {
      if (value instanceof File) {
        exactRequestParams[key] = `[File object: name="${value.name}", size=${value.size}, type="${value.type}"]`;
      } else {
        exactRequestParams[key] = value;
      }
    });
    console.log("==========================================================");
    console.log("[EXACT CLOUDINARY MULTIPART/FORM-DATA REQUEST PARAMETERS]");
    console.log(JSON.stringify(exactRequestParams, null, 2));
    console.log("==========================================================");
    this.logStep(7, "Exact multipart/form-data request sent to Cloudinary", exactRequestParams);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl, true);
      xhr.setRequestHeader("Accept", "application/json");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const loaded = event.loaded;
          const percent = Math.min(99, Math.round((loaded / file.size) * 100));
          const elapsedSec = Math.max(0.2, (Date.now() - startTime) / 1000);
          const speed = loaded / elapsedSec;
          const remainingSec = Math.max(0, (file.size - loaded) / Math.max(1, speed));

          this.updateStats(task, loaded, 'uploading', `Uploading directly to cloud (${percent}%)...`, {
            percent,
            speedBytesPerSec: speed,
            timeRemainingSec: remainingSec
          });
        }
      };

      xhr.onload = () => {
        const status = xhr.status;
        if (status === 413) {
          reject(this.createStepError("Uploading", "File size exceeds Cloudinary limits (HTTP 413: Payload Too Large).", 413));
          return;
        }

        let responseJson: any = {};
        try {
          responseJson = JSON.parse(xhr.responseText);
        } catch {
          console.error("[CLOUDINARY RAW RESPONSE ERROR - NOT JSON]:", xhr.responseText);
          reject(this.createStepError("Uploading", `Cloudinary returned non-JSON response (HTTP ${status}).`, status || 500));
          return;
        }

        console.log("==========================================================");
        console.log(`[EXACT CLOUDINARY JSON RESPONSE - HTTP ${status}]`);
        console.log(JSON.stringify(responseJson, null, 2));
        console.log("==========================================================");

        if (status >= 200 && status < 300 && (responseJson.url || responseJson.secure_url)) {
          this.logStep(14, "Direct Cloudinary upload succeeded.", responseJson);
          const rawUrl = responseJson.secure_url || responseJson.url;
          const optimizedUrl = this.optimizeUrl(rawUrl);
          resolve({
            url: optimizedUrl,
            secure_url: optimizedUrl,
            public_id: responseJson.public_id,
            format: responseJson.format,
            resource_type: responseJson.resource_type || targetResType
          });
        } else {
          console.error("[CLOUDINARY EXACT ERROR DETAILS]:", {
            "error.message": responseJson.error?.message || responseJson.error || "Unknown error",
            "error.http_code": status,
            "error.name": responseJson.error?.name || "CloudinaryError",
            "full_response": responseJson
          });
          const errMsg = responseJson.error?.message || responseJson.error || `Cloudinary upload error (HTTP ${status})`;
          reject(this.createStepError("Uploading", errMsg, status || 500, responseJson));
        }
      };

      xhr.onerror = () => {
        reject(this.createStepError("Uploading", "Network connection error during direct Cloudinary upload.", 0));
      };

      xhr.ontimeout = () => {
        reject(this.createStepError("Uploading", "The direct cloud upload timed out.", 504));
      };

      xhr.timeout = file.type.startsWith("video/") ? 300000 : 120000;
      xhr.send(formData);
    });
  }

  /**
   * Executes resumable chunked browser-to-Cloudinary upload with automatic retry and resume
   * Requirements 3 & 14: Support videos up to 90 MB, upload in resumable chunks, auto-retry on interruption.
   */
  private async performResumableChunkedUpload(
    task: QueuedUploadTask,
    file: File,
    sigData: any,
    targetResType: string,
    startTime: number
  ): Promise<UploadResult> {
    const CHUNK_SIZE = 6 * 1024 * 1024; // 6 MB chunk size
    const uniqueUploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const uploadUrl = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${targetResType}/upload`;
    let offset = 0;

    console.log(`[RESUMABLE UPLOAD START] File: "${file.name}", Size: ${file.size} bytes, ChunkSize: ${CHUNK_SIZE}, UploadID: ${uniqueUploadId}`);
    this.logStep(7, "Starting resumable chunked upload", { file: file.name, size: file.size, uploadId: uniqueUploadId });

    while (offset < file.size) {
      let chunkRetries = 0;
      const maxChunkRetries = 3;
      let chunkSuccess = false;
      let finalResult: UploadResult | null = null;

      while (!chunkSuccess && chunkRetries <= maxChunkRetries) {
        if (chunkRetries > 0) {
          console.warn(`[RESUMABLE UPLOAD RETRY] Chunk retry #${chunkRetries} at offset ${offset}. Checking server offset...`);
          // Query Cloudinary for the last successfully received byte
          try {
            const rangeRes = await fetch(uploadUrl, {
              method: "GET",
              headers: {
                "X-Unique-Upload-Id": uniqueUploadId,
                "Content-Range": `bytes */${file.size}`
              }
            });
            const rangeHeader = rangeRes.headers.get("range");
            if (rangeHeader && rangeHeader.includes("bytes=0-")) {
              const match = rangeHeader.match(/bytes=0-(\d+)/);
              if (match && match[1]) {
                const lastReceivedByte = parseInt(match[1], 10);
                offset = lastReceivedByte + 1;
                console.log(`[RESUMABLE UPLOAD RESUME] Resuming from verified server offset: ${offset}`);
              }
            }
          } catch (rangeErr) {
            console.warn("[RESUMABLE UPLOAD RESUME CHECK FAILED]:", rangeErr);
          }
          // Exponential backoff before retrying
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, chunkRetries - 1)));
        }

        const start = offset;
        const end = Math.min(offset + CHUNK_SIZE - 1, file.size - 1);
        const chunkBlob = file.slice(start, end + 1);

        console.log(`[SENDING CHUNK] Bytes ${start}-${end}/${file.size} (Size: ${chunkBlob.size})`);

        const formData = new FormData();
        formData.append("file", chunkBlob, file.name);
        formData.append("api_key", sigData.apiKey);
        formData.append("timestamp", sigData.timestamp);
        formData.append("folder", sigData.folder);
        if (sigData.eager) formData.append("eager", sigData.eager);
        if (sigData.eager_async) formData.append("eager_async", sigData.eager_async);
        if (sigData.notification_url) formData.append("notification_url", sigData.notification_url);
        if (sigData.transformation) formData.append("transformation", sigData.transformation);
        formData.append("signature", sigData.signature);
        formData.append("resource_type", targetResType);

        try {
          const chunkRes = await new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", uploadUrl, true);
            xhr.setRequestHeader("Accept", "application/json");
            xhr.setRequestHeader("X-Unique-Upload-Id", uniqueUploadId);
            xhr.setRequestHeader("Content-Range", `bytes ${start}-${end}/${file.size}`);

            xhr.upload.onprogress = (event) => {
              if (event.lengthComputable) {
                const totalLoaded = start + event.loaded;
                const percent = Math.min(99, Math.round((totalLoaded / file.size) * 100));
                const elapsedSec = Math.max(0.2, (Date.now() - startTime) / 1000);
                const speed = totalLoaded / elapsedSec;
                const remainingSec = Math.max(0, (file.size - totalLoaded) / Math.max(1, speed));

                this.updateStats(task, totalLoaded, 'uploading', `Uploading chunk (${percent}%)...`, {
                  percent,
                  speedBytesPerSec: speed,
                  timeRemainingSec: remainingSec
                });
              }
            };

            xhr.onload = () => {
              const status = xhr.status;
              if (status === 413) {
                reject(this.createStepError("Uploading", "Chunk size exceeds server limit (HTTP 413).", 413));
                return;
              }
              let responseJson: any = {};
              try {
                responseJson = JSON.parse(xhr.responseText);
              } catch {
                if (status === 308 || (status >= 200 && status < 300)) {
                  resolve({ status, raw: xhr.responseText });
                  return;
                }
                reject(this.createStepError("Uploading", `Server returned non-JSON response (HTTP ${status}).`, status || 500));
                return;
              }

              if (status === 308 || (status >= 200 && status < 300)) {
                resolve({ status, json: responseJson });
              } else {
                reject(this.createStepError("Uploading", responseJson.error?.message || responseJson.error || `Chunk upload error (${status})`, status || 500, responseJson));
              }
            };

            xhr.onerror = () => reject(new Error("Network connection error during chunk upload."));
            xhr.ontimeout = () => reject(new Error("Chunk upload timed out."));
            xhr.timeout = 180000; // 3 mins per chunk
            xhr.send(formData);
          });

          chunkSuccess = true;
          offset = end + 1;
          if (end === file.size - 1 || (chunkRes.json && (chunkRes.json.url || chunkRes.json.secure_url))) {
            const resp = chunkRes.json || {};
            this.logStep(14, "Resumable chunked upload completed successfully.", resp);
            const rawUrl = resp.secure_url || resp.url;
            const optimizedUrl = this.optimizeUrl(rawUrl);
            finalResult = {
              url: optimizedUrl,
              secure_url: optimizedUrl,
              public_id: resp.public_id,
              format: resp.format,
              resource_type: resp.resource_type || targetResType
            };
          }
        } catch (chunkErr: any) {
          chunkRetries++;
          console.error(`[RESUMABLE UPLOAD CHUNK ERROR] Attempt ${chunkRetries}/${maxChunkRetries} failed:`, chunkErr);
          if (chunkRetries > maxChunkRetries) {
            throw chunkErr.message ? chunkErr : this.createStepError("Uploading", `Resumable chunk upload failed after ${maxChunkRetries} retries.`, 500);
          }
        }
      }

      if (finalResult) {
        return finalResult;
      }
    }

    throw this.createStepError("Uploading", "Upload completed without receiving a valid asset URL from Cloudinary.", 500);
  }

  /**
   * Health checks before upload begins
   */
  public async checkUploadHealth(): Promise<{ ok: boolean; error?: string }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { ok: false, error: "Your device is currently offline. Please connect to the internet to upload files." };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('/api/health', { method: 'GET', signal: controller.signal as any });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { ok: false, error: `Upload server reported an unhealthy status (${res.status}).` };
      }

      const data = await res.json();
      if (data.cloudinary === false) {
        return { ok: false, error: "Cloud storage credentials are not configured on the server." };
      }

      return { ok: true };
    } catch (err: any) {
      console.warn("[UPLOAD HEALTH CHECK FAILED]", err.message);
      // If health check endpoint is not found (404/network error), allow retry via fallback if online
      if (err.name === 'AbortError' || err.message?.includes('timeout')) {
        return { ok: false, error: "Upload server health check timed out. Please verify server connectivity." };
      }
      // Return ok:true if online and server is just missing health route during hot reload
      return { ok: true };
    }
  }

  /**
   * Deletes a Cloudinary asset with automatic retry and local queue fallback.
   * Requirement 7: If Firestore succeeds but Cloudinary cleanup fails, log and retry!
   */
  public async deleteCloudinaryAsset(urlOrUrls?: string | (string | undefined | null)[], maxRetries = 3): Promise<boolean> {
    if (!urlOrUrls) return true;
    const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
    let allSucceeded = true;

    for (const u of urls) {
      if (!u || typeof u !== 'string' || !u.includes("cloudinary.com")) continue;

      let attempt = 0;
      let deleted = false;

      while (attempt <= maxRetries && !deleted) {
        try {
          attempt++;
          console.log(`[CLOUDINARY CLEANUP] Scrubbing media asset (Attempt ${attempt}/${maxRetries + 1}): ${u}`);
          const res = await fetch("/api/delete-cloudinary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: u })
          });

          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data.skipped) {
              console.log(`[CLOUDINARY CLEANUP] Asset cleanup skipped or handled by server: ${u}`);
            } else {
              console.log(`[CLOUDINARY CLEANUP SUCCESS] Successfully scrubbed from cloud: ${u}`);
            }
            deleted = true;
            this.removeFromCleanupQueue(u);
            break;
          } else {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `HTTP ${res.status}`);
          }
        } catch (err: any) {
          console.warn(`[CLOUDINARY CLEANUP WARNING] Attempt ${attempt} failed for ${u}:`, err.message);
          if (attempt <= maxRetries) {
            const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 6000);
            await new Promise(r => setTimeout(r, backoffMs));
          }
        }
      }

      if (!deleted) {
        allSucceeded = false;
        console.warn(`[CLOUDINARY CLEANUP] Could not complete cloud scrubbing immediately for asset: ${u}. Retaining in background queue.`);
        this.addToCleanupQueue(u);
      }
    }

    return allSucceeded;
  }

  private addToCleanupQueue(url: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const queue = JSON.parse(localStorage.getItem('cloudinary_cleanup_queue') || '[]');
      if (!queue.includes(url)) {
        queue.push(url);
        localStorage.setItem('cloudinary_cleanup_queue', JSON.stringify(queue));
      }
    } catch (e) {
      console.error("Failed to save to local cleanup queue:", e);
    }
  }

  private removeFromCleanupQueue(url: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      let queue = JSON.parse(localStorage.getItem('cloudinary_cleanup_queue') || '[]');
      queue = queue.filter((u: string) => u !== url);
      localStorage.setItem('cloudinary_cleanup_queue', JSON.stringify(queue));
    } catch (e) {}
  }

  private initBackgroundCleanup(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    // Check cleanup queue every 60 seconds
    this.backgroundCleanupInterval = setInterval(() => {
      try {
        const queue = JSON.parse(localStorage.getItem('cloudinary_cleanup_queue') || '[]');
        if (queue.length > 0 && navigator.onLine) {
          console.log(`[BACKGROUND CLEANUP] Retrying ${queue.length} queued asset deletions...`);
          const toRetry = [...queue];
          this.deleteCloudinaryAsset(toRetry, 1);
        }
      } catch (e) {}
    }, 60000);
  }

  // -------------------------------------------------------------
  // Helper & Logging Methods
  // -------------------------------------------------------------
  private transitionState(task: QueuedUploadTask, newState: UploadStateMachineState): void {
    const oldState = task.state;
    task.state = newState;
    this.logStateChange(task, newState, `Transitioned from ${oldState} -> ${newState}`);
  }

  private logStateChange(task: QueuedUploadTask, state: UploadStateMachineState, message: string): void {
    console.log(`\n==========================================================`);
    console.log(`[UPLOAD STATE MACHINE: ${state}]`);
    console.log(`- Upload ID: ${task.id}`);
    console.log(`- File Name: ${task.file.name}`);
    console.log(`- File Size: ${(task.file.size / (1024 * 1024)).toFixed(2)} MB`);
    console.log(`- Timestamp: ${new Date().toISOString()}`);
    console.log(`- Status: ${message}`);
    console.log(`==========================================================\n`);
  }

  private logStep(stepNum: number, stepName: string, details?: any): void {
    console.log(`STEP ${stepNum}: ${stepName}`, details ? details : '');
  }

  private logStepFailure(stepName: string, reason: string, httpStatus?: number | string, cloudinaryResp?: any, expressErr?: any, stack?: string): void {
    console.error(`\nSTEP FAILED: ${stepName}`);
    console.error(`Reason: ${reason}`);
    console.error(`Stack trace: ${stack || 'N/A'}`);
    console.error(`HTTP Status: ${httpStatus || 'N/A'}`);
    console.error(`Cloudinary Response:`, cloudinaryResp || 'N/A');
    console.error(`Express Error:`, expressErr || 'N/A');
    console.error(`==========================================================\n`);
  }

  private createStepError(stepName: string, reason: string, status?: number, cloudinaryResp?: any, expressErr?: any): Error & { status?: number; cloudinaryResp?: any; expressErr?: any } {
    const err: any = new Error(reason);
    err.status = status;
    err.cloudinaryResp = cloudinaryResp;
    err.expressErr = expressErr;
    return err;
  }

  private isRetryableError(err: any): boolean {
    if (!err) return false;
    const status = err.status || 0;
    const msg = (err.message || "").toLowerCase();
    // Non-retryable permanent errors
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 413 || status === 422) {
      return false;
    }
    if (msg.includes("limit exceeded") || msg.includes("unsupported") || msg.includes("format") || msg.includes("too large") || msg.includes("validation")) {
      return false;
    }
    // Retryable temporary network failures (500, 502, 503, 504, timeout, network interrupted, status 0)
    return status === 0 || status === 408 || status === 429 || status >= 500 || msg.includes("network") || msg.includes("timeout") || msg.includes("interrupted") || msg.includes("failed to fetch") || msg.includes("load failed");
  }

  private updateStats(
    task: QueuedUploadTask,
    loadedBytes: number,
    status: UploadProgressStats['status'],
    statusText: string,
    extra?: Partial<UploadProgressStats>
  ): void {
    const totalSize = task.file.size || 1;
    const percent = extra?.percent !== undefined ? extra.percent : Math.min(100, Math.round((loadedBytes / totalSize) * 100));
    
    const stats: UploadProgressStats = {
      percent,
      uploadedBytes: loadedBytes,
      totalBytes: totalSize,
      speedBytesPerSec: extra?.speedBytesPerSec || 0,
      speedFormatted: this.formatSpeed(extra?.speedBytesPerSec || 0),
      timeRemainingSec: extra?.timeRemainingSec || 0,
      timeRemainingFormatted: this.formatTimeRemaining(extra?.timeRemainingSec || 0),
      status,
      statusText,
      fileName: task.file.name
    };

    if (task.options.onProgress) {
      try {
        task.options.onProgress(percent, stats);
      } catch (e) {}
    }
  }

  private formatSpeed(bytesPerSec: number): string {
    if (!bytesPerSec || bytesPerSec <= 0 || !isFinite(bytesPerSec)) return "0 B/s";
    if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    if (bytesPerSec >= 1024) return `${Math.round(bytesPerSec / 1024)} KB/s`;
    return `${Math.round(bytesPerSec)} B/s`;
  }

  private formatTimeRemaining(seconds: number): string {
    if (!seconds || seconds <= 0 || !isFinite(seconds) || seconds > 86400) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private async compressImageFile(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        }, "image/jpeg", 0.85);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  }

  private async compressToBase64(file: File): Promise<string> {
    const compressedFile = await this.compressImageFile(file);
    return this.fileToDataUrl(compressedFile);
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file data."));
      reader.readAsDataURL(file);
    });
  }
}

export const uploadManager = new UploadManagerService();
