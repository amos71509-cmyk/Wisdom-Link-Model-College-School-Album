export interface UploadResult {
  url: string;
  secure_url: string;
  public_id?: string;
  format?: string;
  resource_type?: string;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  folder?: string;
}

/**
 * Uploads a file (image or video) directly to the server proxy using multipart/form-data.
 * Ensures binary files up to 1GB (including 600MB videos) transmit reliably without Base64 memory issues.
 */
export async function uploadFileToCloudinary(
  selectedFile: File | null | undefined,
  options: UploadOptions = {}
): Promise<UploadResult> {
  // Requirement 8: If the upload request does not contain a file, stop immediately
  if (!selectedFile) {
    console.warn("[UPLOAD ABORTED] No file was selected.");
    throw new Error("No file was selected.");
  }

  // Requirement 2: Never send an empty file
  if (!(selectedFile instanceof File) || selectedFile.size <= 0) {
    console.warn("[UPLOAD ABORTED] Selected file is invalid or 0 bytes:", selectedFile);
    throw new Error("The selected file is empty or invalid.");
  }

  const isVideo = selectedFile.type.startsWith("video/");
  const isImage = selectedFile.type.startsWith("image/");
  const resourceType = isVideo ? "video" : isImage ? "image" : "auto";
  const folder = options.folder || "scholars_class_2026";
  const endpoint = isVideo ? "/api/upload-video" : "/api/upload";

  // Requirement 1: Construct FormData with file, resource_type, folder
  const formData = new FormData();
  formData.append("file", selectedFile);
  formData.append("resource_type", resourceType);
  formData.append("folder", folder);

  // Requirement 7: Logging before uploading
  console.log(`[CLIENT UPLOAD INITIATED] Endpoint: ${endpoint}`);
  console.log(`- File Name: ${selectedFile.name}`);
  console.log(`- File Size: ${selectedFile.size} bytes (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)`);
  console.log(`- File Type: ${selectedFile.type || "unknown"}`);
  console.log(`- File Exists: true (instanceof File, size > 0)`);
  console.log(`- FormData Keys: file, resource_type, folder`);
  console.log(`- Resource Type: ${resourceType}, Target Folder: ${folder}`);

  if (options.onProgress) {
    options.onProgress(10);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint, true);

    if (xhr.upload && options.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          console.log(`[CLIENT UPLOAD PROGRESS] ${selectedFile.name}: ${percent}% (${event.loaded}/${event.total} bytes)`);
          options.onProgress?.(percent);
        }
      };
    }

    xhr.onload = () => {
      console.log(`[CLIENT UPLOAD RESPONSE] HTTP Status: ${xhr.status}`);
      let data: any = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        console.error("[CLIENT UPLOAD RESPONSE PARSE ERROR] Raw text:", xhr.responseText.substring(0, 500));
        return reject(
          new Error(`Server returned non-JSON response (HTTP Status ${xhr.status}): ${xhr.responseText.substring(0, 200)}`)
        );
      }

      console.log("[CLIENT UPLOAD RESPONSE DATA]", data);

      if (xhr.status >= 200 && xhr.status < 300 && data.success && (data.url || data.secure_url)) {
        const finalUrl = data.secure_url || data.url;
        console.log(`[CLIENT UPLOAD SUCCESS] Secure URL returned: ${finalUrl}`);
        resolve({
          url: finalUrl,
          secure_url: finalUrl,
          public_id: data.public_id,
          format: data.format,
          resource_type: data.resource_type,
        });
      } else {
        // Requirement 9: Improve Cloudinary error handling
        let errorMessage = data.error || `Upload failed with HTTP Status ${xhr.status}`;
        if (errorMessage.includes("Missing 'file'") || errorMessage.includes("Missing file")) {
          errorMessage = "The upload request did not include the selected file.";
        }
        console.error(`[CLIENT UPLOAD ERROR] ${errorMessage}`);
        reject(new Error(errorMessage));
      }
    };

    xhr.onerror = () => {
      console.error("[CLIENT UPLOAD NETWORK ERROR]");
      reject(new Error("Network error occurred during file upload. Please check your internet connection."));
    };

    xhr.ontimeout = () => {
      console.error("[CLIENT UPLOAD TIMEOUT]");
      reject(new Error("Upload timed out. The file may be too large for the current connection speed."));
    };

    // Send multipart/form-data
    xhr.send(formData);
  });
}
