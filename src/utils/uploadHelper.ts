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

function notifyUploadProgress(stats: UploadProgressStats | null) {
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
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
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
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
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
 * Uploads a file (image or video) using reliable multipart/form-data with real-time
 * progress tracking, speed (MB/s), estimated time remaining, and automatic Cloudinary optimization.
 */
export async function uploadFileToCloudinary(
  selectedFile: File | null | undefined,
  options: UploadOptions = {}
): Promise<UploadResult> {
  if (!selectedFile) {
    console.warn("[UPLOAD ABORTED] No file was selected.");
    throw new Error("No file was selected.");
  }

  if (!(selectedFile instanceof File) || selectedFile.size <= 0) {
    console.warn("[UPLOAD ABORTED] Selected file is invalid or 0 bytes:", selectedFile);
    throw new Error("The selected file is empty or invalid.");
  }

  const validation = validateUploadFile(selectedFile);
  if (!validation.valid) {
    console.warn("[UPLOAD ABORTED] File validation failed:", validation.error);
    throw new Error(validation.error || "File validation failed.");
  }

  const isVideo = selectedFile.type.startsWith("video/");
  const isImage = selectedFile.type.startsWith("image/");
  const resourceType = isVideo ? "video" : isImage ? "image" : "auto";
  const folder = options.folder || "scholars_class_2026";

  let fileToUpload = selectedFile;
  if (isImage) {
    try {
      fileToUpload = await compressImageFile(selectedFile);
    } catch (e) {
      console.warn("[IMAGE OPTIMIZER] Skipped client compression:", e);
    }
  }

  const fileSize = fileToUpload.size;
  console.log(`[MEDIA UPLOAD STARTED] File: ${fileToUpload.name}, Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB (${resourceType})`);

  const startTime = Date.now();

  const updateStats = (
    loadedBytes: number,
    status: UploadProgressStats['status'],
    statusText: string
  ) => {
    const percent = Math.min(100, Math.round((loadedBytes / fileSize) * 100));
    const elapsedTimeSec = Math.max(0.2, (Date.now() - startTime) / 1000);
    const speedBytesPerSec = loadedBytes / elapsedTimeSec;
    const remainingBytes = Math.max(0, fileSize - loadedBytes);
    const timeRemainingSec = remainingBytes / Math.max(1, speedBytesPerSec);

    const stats: UploadProgressStats = {
      percent,
      uploadedBytes: loadedBytes,
      totalBytes: fileSize,
      speedBytesPerSec,
      speedFormatted: formatSpeed(speedBytesPerSec),
      timeRemainingSec,
      timeRemainingFormatted: formatTimeRemaining(timeRemainingSec),
      status,
      statusText,
      fileName: fileToUpload.name,
    };

    if (options.onProgress) {
      options.onProgress(percent, stats);
    }

    notifyUploadProgress(stats);
  };

  updateStats(0, 'uploading', 'Starting upload...');

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", fileToUpload);
    formData.append("resource_type", resourceType);
    formData.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", isVideo ? "/api/upload-video" : "/api/upload", true);

    if (xhr.upload) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          updateStats(event.loaded, 'uploading', 'Uploading media file...');
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.success && (data.url || data.secure_url)) {
            const rawUrl = data.secure_url || data.url;
            const optimizedUrl = getOptimizedMediaUrl(rawUrl);

            updateStats(fileSize, 'completed', 'Upload & Optimization Completed!');
            setTimeout(() => notifyUploadProgress(null), 3500);

            resolve({
              url: optimizedUrl,
              secure_url: optimizedUrl,
              public_id: data.public_id,
              format: data.format,
              resource_type: data.resource_type,
            });
            return;
          }
          throw new Error(data.error || "Server responded without a valid URL.");
        } catch (e: any) {
          console.error("[UPLOAD PARSE ERROR]", e, xhr.responseText);
          updateStats(fileSize, 'error', e.message || 'Failed to parse upload response.');
          reject(e);
        }
      } else {
        let errMessage = `Upload failed with HTTP status ${xhr.status}`;
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData.error) errMessage = errData.error;
        } catch {}
        console.error(`[UPLOAD HTTP ERROR] ${errMessage}`);
        updateStats(0, 'error', errMessage);
        reject(new Error(errMessage));
      }
    };

    xhr.onerror = () => {
      const netErr = 'Network error during file upload. Please check your connection.';
      console.error(`[UPLOAD NETWORK ERROR]`, netErr);
      updateStats(0, 'error', netErr);
      reject(new Error(netErr));
    };

    xhr.send(formData);
  });
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
  options: UploadOptions = {}
): Promise<{ secure_url: string; url: string; isStaged: boolean }> {
  if (!selectedFile) {
    throw new Error("No file was selected.");
  }

  const validation = validateUploadFile(selectedFile);
  if (!validation.valid) {
    throw new Error(validation.error || "File validation failed.");
  }

  const isImage = selectedFile.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(selectedFile.name);

  // If forceUpload is explicitly specified (e.g., Admin direct upload or Admin approving a staged item), or if it is a video, upload to Cloudinary.
  if (options.forceUpload || !isImage) {
    const res = await uploadFileToCloudinary(selectedFile, options);
    return {
      secure_url: res.secure_url || res.url,
      url: res.url || res.secure_url,
      isStaged: false
    };
  }

  // Otherwise, compress and stage as Base64 Data URL so no Cloudinary storage is consumed during user upload!
  try {
    const compressed = await compressImageFile(selectedFile, 1024, 0.82);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(compressed);
    });
    console.log(`[STAGING QUEUE] Staged image as Base64 Data URL (${(dataUrl.length / 1024).toFixed(1)} KB). Cloudinary upload deferred until Admin approval.`);
    return {
      secure_url: dataUrl,
      url: dataUrl,
      isStaged: true
    };
  } catch (err) {
    console.warn("[STAGING QUEUE FALLBACK] Compression failed, uploading directly:", err);
    const res = await uploadFileToCloudinary(selectedFile, options);
    return {
      secure_url: res.secure_url || res.url,
      url: res.url || res.secure_url,
      isStaged: false
    };
  }
}
