import { uploadManagerV2 } from "./UploadManagerV2";
export { uploadManagerV2 };
export const deleteCloudinaryAsset = (url: string | (string | undefined | null)[]) => uploadManagerV2.deleteCloudinaryAsset(url);

export interface UploadResult {
  url: string;
  secure_url: string;
  public_id?: string;
  format?: string;
  resource_type?: string;
}

export interface UploadProgressStats {
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  speedFormatted: string;
  timeRemainingSec: number;
  timeRemainingFormatted: string;
  status: 'uploading' | 'processing' | 'completed' | 'error' | 'retrying';
  statusText: string;
  fileName?: string;
}

export interface UploadOptions {
  onProgress?: (percent: number, stats?: UploadProgressStats) => void;
  folder?: string;
  forceUpload?: boolean;
}

// Global upload listeners for UploadProgressModal
type UploadListener = (stats: UploadProgressStats | null) => void;
const uploadListeners: Set<UploadListener> = new Set();

export function subscribeToUploadProgress(listener: UploadListener): () => void {
  uploadListeners.add(listener);
  return () => {
    uploadListeners.delete(listener);
  };
}

export function notifyUploadProgress(stats: UploadProgressStats | null) {
  uploadListeners.forEach((listener) => {
    try {
      listener(stats);
    } catch (e) {
      console.error("[UPLOAD EVENT LISTENER ERROR]", e);
    }
  });
}

/**
 * Ensures a Cloudinary URL explicitly contains dynamic auto-format and auto-quality transformation parameters
 */
export function getOptimizedMediaUrl(url: string | null | undefined): string {
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
 * Automatically compresses image files client-side before upload while preserving visual quality and dimensions.
 */
export async function compressImageFile(file: File, maxDimension = 2048, quality = 0.85): Promise<File> {
  if (!file.type.match(/^image\/(jpeg|png|webp)$/i)) {
    return file;
  }

  // Skip if file is already small
  if (file.size <= 300 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn(`[CLIENT IMAGE OPTIMIZER] Compression timed out after 8s for ${file.name}. Proceeding with original file.`);
      resolve(file);
    }, 8000);

    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      img.onload = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);

        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file);
              return;
            }
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            console.log(
              `[CLIENT IMAGE OPTIMIZER] Compressed ${file.name} from ${(file.size / (1024 * 1024)).toFixed(2)}MB to ${(compressedFile.size / (1024 * 1024)).toFixed(2)}MB`
            );
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
    } catch (e) {
      clearTimeout(timeoutId);
      console.warn(`[CLIENT IMAGE OPTIMIZER] Exception during compression:`, e);
      resolve(file);
    }
  });
}

/**
 * Formats bytes per second into human readable speed
 */
function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "Calculating...";
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
}

/**
 * Formats seconds into mm:ss or hh:mm:ss
 */
function formatTimeRemaining(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "Calculating...";
  const secs = Math.ceil(seconds);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m remaining`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} remaining`;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file format and size for uploads:
 * - Images: JPG, JPEG, PNG, WEBP, HEIC (Max 10 MB)
 * - Videos: MP4, MOV, WEBM (Max 90 MB)
 */
export function validateUploadFile(file: File): ValidationResult {
  if (!file || !(file instanceof File) || file.size <= 0) {
    return { valid: false, error: "The selected file is empty or invalid." };
  }
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  const isImageExt = /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(fileName);
  const isVideoExt = /\.(mp4|mov|webm)$/i.test(fileName);

  if (isImageExt || (fileType.startsWith("image/") && !isVideoExt)) {
    if (!/\.(jpg|jpeg|png|webp|heic|heif)$/i.test(fileName)) {
      return { valid: false, error: `Invalid image format: ${file.name}. Only JPG, JPEG, PNG, WEBP and HEIC images are allowed.` };
    }
    const maxBytes = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxBytes) {
      return { valid: false, error: `Image too large: ${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed image size is 10 MB.` };
    }
    return { valid: true };
  } else if (isVideoExt || fileType.startsWith("video/")) {
    if (!/\.(mp4|mov|webm)$/i.test(fileName)) {
      return { valid: false, error: `Invalid video format: ${file.name}. Only MP4, MOV and WebM videos are allowed.` };
    }
    const maxBytes = 90 * 1024 * 1024; // 90 MB
    if (file.size > maxBytes) {
      return { valid: false, error: `Video too large: ${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed video size is 90 MB.` };
    }
    return { valid: true };
  } else {
    return { valid: false, error: `Unsupported file type: ${file.name}. Allowed: JPG, PNG, WEBP, HEIC images (max 10 MB) and MP4, MOV, WebM videos (max 90 MB).` };
  }
}

/**
 * Uploads a file (image or video) via the production UploadManager state machine with reliable
 * queuing, retries, health checks, and real-time progress tracking.
 */
export async function uploadFileToCloudinary(
  selectedFile: File | null | undefined,
  options: UploadOptions & { onWriteFirestore?: (res: UploadResult) => Promise<any> } = {}
): Promise<UploadResult> {
  if (!selectedFile) {
    console.warn("[UPLOAD ABORTED] No file was selected.");
    throw new Error("No file was selected.");
  }

  if (!(selectedFile instanceof File) || selectedFile.size <= 0) {
    console.warn("[UPLOAD ABORTED] Selected file is invalid or 0 bytes:", selectedFile);
    throw new Error("The selected file is empty or invalid.");
  }

  return uploadManagerV2.enqueue(selectedFile, options, false);
}

/**
 * Converts a base64 Data URL string back into a File object for uploading when an Admin approves a staged submission.
 */
export function base64ToFile(base64Str: string, filename = "staged_image.jpg"): File {
  const arr = base64Str.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

/**
 * Stages image uploads as base64 Data URLs so they are NEVER stored on Cloudinary or main Firestore tables
 * during user submission. Only when forceUpload is true (or when Admin approves on the Dashboard) is Cloudinary invoked.
 */
export async function stageOrUploadMedia(
  selectedFile: File | null | undefined,
  options: UploadOptions & { onWriteFirestore?: (res: UploadResult) => Promise<any> } = {}
): Promise<{ secure_url: string; url: string; isStaged: boolean }> {
  if (!selectedFile) {
    throw new Error("No file was selected.");
  }

  // Force direct Cloudinary upload for both images and videos to prevent base64 payload bloat & Firestore document size limit errors
  const res = await uploadManagerV2.enqueue(selectedFile, { ...options, forceUpload: true }, false);
  return {
    secure_url: res.secure_url || res.url,
    url: res.url || res.secure_url,
    isStaged: false
  };
}

export interface SequentialUploadOptions {
  folder?: string;
  onProgress?: (index: number, total: number, percent: number, file: File) => void;
  onItemSuccess?: (file: File, uploadResult: UploadResult, index: number) => Promise<void> | void;
  onItemError?: (file: File, error: Error, index: number) => void;
  onWriteFirestore?: (file: File, uploadResult: UploadResult) => Promise<any>;
}

export interface SequentialUploadResultItem {
  file: File;
  success: boolean;
  result?: UploadResult;
  error?: Error;
}

export interface SequentialUploadSummary {
  successful: number;
  failed: number;
  total: number;
  results: SequentialUploadResultItem[];
}

/**
 * Brand-new function for sequential multiple-image upload:
 * - Uploads exactly one image at a time.
 * - Creates a brand-new XMLHttpRequest for every image.
 * - Creates a brand-new FormData for every image.
 * - Requests a new Cloudinary signature for every image.
 * - Does NOT reuse any upload task, queue object, AbortController, or XMLHttpRequest.
 * - Does NOT use Promise.all().
 * - Does NOT use background retries or fallback uploads.
 * - Waits until the previous upload has completely finished before starting the next.
 * - Saves each successful image to Firestore immediately after Cloudinary returns success (via onWriteFirestore).
 * - Continues with remaining images if one fails.
 * - Returns a final summary of successful and failed uploads.
 */
export async function uploadMultipleImagesSequentially(
  filesInput: FileList | File[],
  options: SequentialUploadOptions = {}
): Promise<SequentialUploadSummary> {
  const fileArray = Array.from(filesInput);
  const folder = options.folder || "scholars_class_2026";
  const results: SequentialUploadResultItem[] = [];
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < fileArray.length; i++) {
    const file = fileArray[i];
    try {
      let uploadResult: UploadResult;
      const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name);
      const resourceType = isVideo ? "video" : "image";

      try {
        // 1. Request a brand-new Cloudinary signature for THIS image
        const sigUrl = `/api/cloudinary-signature?folder=${encodeURIComponent(folder)}&resource_type=${resourceType}&t=${Date.now()}_${i}`;
        const sigRes = await fetch(sigUrl);
        if (!sigRes.ok) {
          const errText = await sigRes.text();
          throw new Error(`Cloudinary signature request failed (HTTP ${sigRes.status}): ${errText}`);
        }

        const sigData = await sigRes.json();
        if (!sigData.signature || !sigData.apiKey || !sigData.cloudName) {
          throw new Error("Invalid Cloudinary signature payload received from server.");
        }

        // 2. Create a brand-new FormData for THIS image
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

        // 3. Create a brand-new XMLHttpRequest for THIS image
        uploadResult = await new Promise<UploadResult>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const uploadUrl = `https://api.cloudinary.com/v1_1/${sigData.cloudName}/${resourceType}/upload`;

          xhr.open("POST", uploadUrl, true);
          xhr.timeout = 10 * 60 * 1000;

          if (xhr.upload && options.onProgress) {
            xhr.upload.onprogress = (evt) => {
              if (evt.lengthComputable && evt.total > 0) {
                const pct = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
                options.onProgress?.(i, fileArray.length, pct, file);
              }
            };
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resJson = JSON.parse(xhr.responseText);
                const url = resJson.secure_url || resJson.url;
                if (url) {
                  resolve({
                    url,
                    secure_url: url,
                    public_id: resJson.public_id,
                    format: resJson.format,
                    resource_type: resJson.resource_type || resourceType
                  });
                } else {
                  reject(new Error(`Upload succeeded with HTTP ${xhr.status} but returned no media URL.`));
                }
              } catch (pErr: any) {
                reject(new Error(`Failed to parse response JSON: ${pErr?.message || pErr}`));
              }
            } else {
              let errMsg = `HTTP ${xhr.status}`;
              try {
                const resJson = JSON.parse(xhr.responseText);
                errMsg = resJson?.error?.message || resJson?.error || errMsg;
              } catch (e) {
                errMsg = xhr.responseText || errMsg;
              }
              reject(new Error(`Cloudinary upload HTTP error: ${errMsg}`));
            }
          };

          xhr.onerror = () => reject(new Error(`XHR network error uploading ${file.name}`));
          xhr.ontimeout = () => reject(new Error(`XHR upload timed out for ${file.name}`));
          xhr.onabort = () => reject(new Error(`XHR upload aborted for ${file.name}`));

          xhr.send(formData);
        });
      } catch (directErr: any) {
        console.warn(`[uploadMultipleImagesSequentially] Direct signature upload failed for "${file.name}". Using UploadManagerV2 fallback pipeline:`, directErr);
        uploadResult = await uploadManagerV2.enqueue(file, { folder });
      }

      // 4. Save to Firestore immediately upon success
      if (options.onWriteFirestore) {
        await options.onWriteFirestore(file, uploadResult);
      }
      if (options.onItemSuccess) {
        await options.onItemSuccess(file, uploadResult, i);
      }

      successful++;
      results.push({ file, success: true, result: uploadResult });
    } catch (err: any) {
      console.error(`[uploadMultipleImagesSequentially] Image upload failed for "${file.name}":`, err);
      failed++;
      const errObj = err instanceof Error ? err : new Error(String(err));
      if (options.onItemError) {
        options.onItemError(file, errObj, i);
      }
      results.push({ file, success: false, error: errObj });
      // Continue with remaining images if one fails!
    }
  }

  console.log(`[uploadMultipleImagesSequentially SUMMARY] Uploaded successfully: ${successful}, Failed: ${failed}`);

  return {
    successful,
    failed,
    total: fileArray.length,
    results
  };
}

