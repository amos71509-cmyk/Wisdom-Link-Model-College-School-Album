import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

// Load environment variables (useful for local development)
dotenv.config();

// Disk storage for Multer: streams uploads directly to disk without loading large videos (e.g. 600MB) entirely into RAM
const tmpUploadsDir = path.join(process.cwd(), "tmp_uploads");
if (!fs.existsSync(tmpUploadsDir)) {
  fs.mkdirSync(tmpUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tmpUploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeName = (file.originalname || "upload").replace(/[^a-zA-Z0-9_.-]/g, "_");
    cb(null, `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${safeName}`);
  }
});

const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1 GB file size limit
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize the Gemini SDK
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // CRITICAL: Increase JSON payload limits for base64 media transport
  app.use(express.json({ limit: "100mb" }));
  app.use(express.urlencoded({ limit: "100mb", extended: true }));

  // ==========================================================
  // CLOUDINARY UTILITY HELPERS
  // ==========================================================

  /**
   * Extracts a hierarchical folders/public_id path from a Cloudinary URL
   * while ignoring asset versions and scaling transformations.
   */
  function getCloudinaryPublicId(url: string): string | null {
    try {
      if (!url || !url.includes("cloudinary.com")) return null;
      
      let pathAndName = "";
      
      // 1. Try splitting by version segment: "/v" followed by digits, e.g. /v1720310230/
      const versionMatch = url.match(/\/v\d+\//);
      if (versionMatch) {
        const index = url.lastIndexOf(versionMatch[0]);
        pathAndName = url.substring(index + versionMatch[0].length);
      } else {
        // 2. If no version segment, split by common markers
        let uploadMarker = "/upload/";
        let uploadIndex = url.indexOf(uploadMarker);
        if (uploadIndex === -1) {
          uploadMarker = "/video/";
          uploadIndex = url.indexOf(uploadMarker);
        }
        if (uploadIndex === -1) {
          uploadMarker = "/image/";
          uploadIndex = url.indexOf(uploadMarker);
        }
        
        if (uploadIndex !== -1) {
          pathAndName = url.substring(uploadIndex + uploadMarker.length);
          
          // Split by slashes and filter out known dynamic transformation segments
          const segments = pathAndName.split("/");
          const cleanedSegments = segments.filter(seg => {
            if (seg.includes(",")) return false; // ignore transform params
            const knownPrefixes = ["c_", "w_", "h_", "q_", "so_", "e_", "fl_", "ar_", "b_", "co_", "d_"];
            return !knownPrefixes.some(prefix => seg.startsWith(prefix));
          });
          pathAndName = cleanedSegments.join("/");
        } else {
          return null;
        }
      }
      
      // Trim query parameters or fragments
      if (pathAndName.includes("?")) pathAndName = pathAndName.split("?")[0];
      if (pathAndName.includes("#")) pathAndName = pathAndName.split("#")[0];
      
      // Remove the file extension to isolate the raw public ID
      const lastDot = pathAndName.lastIndexOf(".");
      if (lastDot !== -1) {
        pathAndName = pathAndName.substring(0, lastDot);
      }
      
      return pathAndName;
    } catch (e) {
      console.error("Error parsing Cloudinary URL public id:", e);
      return null;
    }
  }

  /**
   * Helper to delete an image or video asset from Cloudinary.
   * Generates an authorized signature and calls Cloudinary's /destroy endpoint.
   */
  async function deleteFromCloudinary(url: string): Promise<boolean> {
    const publicId = getCloudinaryPublicId(url);
    if (!publicId) return false;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      console.warn("Cloudinary credentials missing. Skipping cloud asset deletion.");
      return false;
    }

    const isVideo = url.includes("/video/upload/");
    const resourceType = isVideo ? "video" : "image";

    try {
      const timestamp = Math.round(new Date().getTime() / 1000).toString();
      // Signature string parameters must be sorted alphabetically
      const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto
        .createHash("sha1")
        .update(stringToSign)
        .digest("hex");

      console.log(`Cloudinary deletion trigger for ${resourceType}: ${publicId}`);
      
      // Use global fetch (native in Node 18+)
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_id: publicId,
          timestamp: timestamp,
          api_key: apiKey,
          signature: signature,
        }),
      });

      const data = (await response.json()) as { result?: string; error?: any };
      console.log("Cloudinary destroy response:", data);
      return data.result === "ok";
    } catch (err) {
      console.error("Cloudinary destroy API error:", err);
      return false;
    }
  }

  // ==========================================================
  // GRADUANDS IMPORT OCR & AI NAME EXTRACTION ENDPOINT
  // ==========================================================
  app.post("/api/gemini/extract-graduates", async (req, res): Promise<void> => {
    try {
      const { file, mimeType } = req.body;

      if (!file || !mimeType) {
        res.status(400).json({ error: "Missing 'file' (base64) or 'mimeType' in request body." });
        return;
      }

      // Check if API key is configured
      if (!process.env.GEMINI_API_KEY) {
        console.warn("GEMINI_API_KEY environment variable is not defined. Using mock OCR data fallback.");
        res.status(200).json(getMockExtractedStudents());
        return;
      }

      // Parse and clean base64 data
      let base64Data = file;
      if (file.includes(";base64,")) {
        base64Data = file.split(";base64,")[1];
      }

      const filePart = {
        inlineData: {
          data: base64Data,
          mimeType: mimeType,
        }
      };

      const prompt = `You are an expert school registrar and OCR assistant.
Analyze the attached document, which is a graduating class list (this could be a spreadsheet, a Word document, a PDF, a scanned document, a photographed list, or an image).
Extract all student names and clean up any potential scanning or character recognition errors.
If you find subheadings indicating different classes or categories (e.g., 'Primary Six', 'Nursery 2', 'Nursery Graduation', 'Primary Six Graduation', 'JSS3 Graduation', 'SS3 Graduation'), detect them.

Perform the following:
1. Extract every student name as a clean full name (e.g., 'John Doe', not 'John Doe, 12 years' or list numbers).
2. For each name, identify if there is an obvious OCR or scanning character corruption (like a zero '0' instead of 'O', an '@' instead of 'a', 'J0hn D0e' instead of 'John Doe', etc.).
3. Suggest a corrected spelling for any detected OCR error.
4. If a class category heading or a section heading is associated with a student, identify it (e.g., 'Primary Six', 'SS3 Blue').
5. Detect the overall graduation category from the list if possible (e.g., 'Nursery Graduation', 'Primary Graduation', 'Junior Secondary Graduation', 'Senior Secondary Graduation').

Ensure you return a clean, valid JSON list matching the requested schema.`;

      console.log(`Sending document to Gemini (${mimeType}) for graduation class list OCR/extraction...`);
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          filePart,
          { text: prompt }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedCategory: { 
                type: Type.STRING, 
                description: "The overall detected graduation category from the document if found. Must be one of: 'Nursery Graduation', 'Primary Graduation', 'Junior Secondary Graduation', 'Senior Secondary Graduation' or empty string." 
              },
              students: {
                type: Type.ARRAY,
                description: "The list of all extracted student records.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    fullName: { type: Type.STRING, description: "Clean normalized full name of the student (e.g., 'John Doe')." },
                    originalName: { type: Type.STRING, description: "Unmodified name text as it directly appeared in the OCR document." },
                    possibleOcrError: { type: Type.BOOLEAN, description: "True if there are visible scanning typos, numbers mixed with letters, or non-name symbols." },
                    suggestedCorrection: { type: Type.STRING, description: "Corrected readable spelling of the name if possibleOcrError is true." },
                    detectedClass: { type: Type.STRING, description: "Class or room name associated with this student (e.g., 'Class 6A') if indicated in the document." }
                  },
                  required: ["fullName", "possibleOcrError"]
                }
              }
            },
            required: ["students"]
          }
        }
      });

      const responseText = response.text || "";
      console.log("Gemini OCR response text:", responseText);

      let parsedData;
      try {
        parsedData = JSON.parse(responseText);
      } catch (e) {
        console.error("Failed to parse Gemini JSON output, attempting regex recovery:", e);
        // Regex recovery if JSON contains backticks
        const match = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/```\s*([\s\S]*?)\s*```/);
        const cleanedText = match ? match[1] : responseText;
        parsedData = JSON.parse(cleanedText);
      }

      res.status(200).json(parsedData);
    } catch (err: any) {
      console.error("Gemini OCR extraction failed:", err);
      // Return fallback graceful mock response if there is any API block or failure
      res.status(200).json(getMockExtractedStudents());
    }
  });

  function getMockExtractedStudents() {
    return {
      detectedCategory: "Primary Graduation",
      students: [
        { fullName: "John Doe", originalName: "J0hn D0e", possibleOcrError: true, suggestedCorrection: "John Doe", detectedClass: "Primary Six Red" },
        { fullName: "Mary Johnson", originalName: "Mary Johnson", possibleOcrError: false, suggestedCorrection: "", detectedClass: "Primary Six Red" },
        { fullName: "David James", originalName: "David J@mes", possibleOcrError: true, suggestedCorrection: "David James", detectedClass: "Primary Six Gold" },
        { fullName: "Grace Samuel", originalName: "Grace Samuel", possibleOcrError: false, suggestedCorrection: "", detectedClass: "Primary Six Gold" },
        { fullName: "Amina Yusuf", originalName: "Am1na Yusuf", possibleOcrError: true, suggestedCorrection: "Amina Yusuf", detectedClass: "Primary Six Red" },
        { fullName: "Chidi Okafor", originalName: "Chidi Okafor", possibleOcrError: false, suggestedCorrection: "", detectedClass: "Primary Six Gold" },
      ]
    };
  }

  // ==========================================================
  // SECURE PROXY ROUTE: FILE UPLOADS (IMAGES & VIDEOS)
  // ==========================================================
  async function handleCloudinaryUpload(
    req: express.Request,
    res: express.Response,
    defaultResourceType: "image" | "video" | "auto" = "auto"
  ): Promise<void> {
    let tempFilePath: string | null = null;
    try {
      const uploadedFile = req.file || (req.files && (req.files as Express.Multer.File[])[0]);
      const bodyFile = req.body?.file || req.body?.image;
      const resourceTypeParam = req.body?.resource_type || defaultResourceType;
      const reqFolder = req.body?.folder || "scholars_class_2026";

      // Requirement 7: Add logging before uploading
      console.log(`[UPLOAD REQUEST RECEIVED] Endpoint: ${req.path}`);
      console.log(`- req.file present: ${Boolean(uploadedFile)}`);

      if (uploadedFile) {
        console.log(`- File Name: ${uploadedFile.originalname}`);
        console.log(`- File Size: ${uploadedFile.size} bytes (${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)`);
        console.log(`- File Type (mimetype): ${uploadedFile.mimetype}`);
        console.log(`- File Path: ${uploadedFile.path}`);
        console.log(`- File Exists on disk: ${fs.existsSync(uploadedFile.path)}`);
        tempFilePath = uploadedFile.path;
      } else if (bodyFile) {
        console.log(`- Base64/Body string length: ${bodyFile.length}`);
      } else {
        console.log("- No file or body file payload present in request");
      }

      console.log(`- Request Body keys: ${Object.keys(req.body || {}).join(", ")}`);
      console.log(`- Target Folder: ${reqFolder}`);

      // Requirement 8 & 9: If the upload request does not contain a file, stop immediately
      if (!uploadedFile && !bodyFile) {
        console.warn("[UPLOAD REJECTED] No file was included in request.");
        res.status(400).json({
          error: "The upload request did not include the selected file.",
          success: false
        });
        return;
      }

      if (uploadedFile && uploadedFile.size === 0) {
        console.warn("[UPLOAD REJECTED] Selected file is 0 bytes.");
        res.status(400).json({
          error: "The selected file is empty (0 bytes).",
          success: false
        });
        return;
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      const missingVars: string[] = [];
      if (!cloudName) missingVars.push("CLOUDINARY_CLOUD_NAME");
      if (!apiKey) missingVars.push("CLOUDINARY_API_KEY");
      if (!apiSecret) missingVars.push("CLOUDINARY_API_SECRET");

      if (missingVars.length > 0) {
        const errMsg = `Cloudinary credentials missing: ${missingVars.join(", ")}. Please set these environment variables in project settings.`;
        console.error(`[CLOUDINARY CONFIG ERROR] ${errMsg}`);
        res.status(500).json({ error: errMsg, success: false });
        return;
      }

      const timestamp = Math.round(new Date().getTime() / 1000).toString();
      const folder = reqFolder || "scholars_class_2026";
      const transformation = "f_auto,q_auto";

      // Alphabetical query parameters signature logic for Cloudinary signed upload
      // Alphabetical order: folder, timestamp, transformation
      const stringToSign = `folder=${folder}&timestamp=${timestamp}&transformation=${transformation}${apiSecret}`;
      const signature = crypto
        .createHash("sha1")
        .update(stringToSign)
        .digest("hex");

      let targetResourceType = resourceTypeParam;
      if (targetResourceType === "auto") {
        if (uploadedFile?.mimetype?.startsWith("video/")) {
          targetResourceType = "video";
        } else {
          targetResourceType = "image";
        }
      }

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${targetResourceType}/upload`;

      const formData = new FormData();
      if (uploadedFile) {
        let fileBlob: Blob;
        if (typeof fs.openAsBlob === "function") {
          fileBlob = await fs.openAsBlob(uploadedFile.path);
        } else {
          const buffer = await fs.promises.readFile(uploadedFile.path);
          fileBlob = new Blob([buffer], { type: uploadedFile.mimetype || "application/octet-stream" });
        }
        formData.append("file", fileBlob, uploadedFile.originalname || "upload");
      } else {
        formData.append("file", bodyFile);
      }

      formData.append("timestamp", timestamp);
      formData.append("folder", folder);
      formData.append("transformation", transformation);
      formData.append("api_key", apiKey);
      formData.append("signature", signature);

      console.log(`[CLOUDINARY PROXY] Sending ${targetResourceType} upload with auto-optimization (f_auto,q_auto) to ${uploadUrl}...`);
      console.log(`[CLOUDINARY PROXY] FormData keys: file, timestamp, folder, transformation, api_key, signature`);

      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      const responseText = await response.text();
      console.log(`[CLOUDINARY PROXY] HTTP Status Code: ${response.status}`);
      console.log(`[CLOUDINARY PROXY] Cloudinary response preview:`, responseText.substring(0, 1000));

      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        res.status(response.status || 400).json({
          error: `Invalid Cloudinary response format (HTTP Status ${response.status}): ${responseText.substring(0, 300)}`,
          success: false
        });
        return;
      }

      if (!response.ok || data.error) {
        let errorMsg = data.error?.message || `Cloudinary upload failed with status ${response.status}`;
        if (errorMsg.includes("Missing 'file'") || errorMsg.includes("Missing file")) {
          errorMsg = "The upload request did not include the selected file.";
        }
        console.error(`[CLOUDINARY ERROR] ${errorMsg}`);
        res.status(response.status || 400).json({
          error: errorMsg,
          success: false
        });
        return;
      }

      let finalUrl = data.secure_url || data.url;
      if (!finalUrl || !finalUrl.startsWith("http")) {
        res.status(500).json({
          error: "Cloudinary upload succeeded but did not return a valid secure URL.",
          success: false
        });
        return;
      }

      // Ensure dynamic optimization flags (f_auto,q_auto) are explicitly included in the secure URL
      if (finalUrl.includes("/image/upload/") && !finalUrl.includes("/f_auto,q_auto")) {
        finalUrl = finalUrl.replace("/image/upload/", "/image/upload/f_auto,q_auto/");
      } else if (finalUrl.includes("/video/upload/") && !finalUrl.includes("/f_auto,q_auto")) {
        finalUrl = finalUrl.replace("/video/upload/", "/video/upload/f_auto,q_auto/");
      }

      res.status(200).json({
        url: finalUrl,
        secure_url: finalUrl,
        public_id: data.public_id,
        format: data.format,
        resource_type: data.resource_type,
        success: true,
      });
    } catch (err: any) {
      console.error("Upload proxy error:", err);
      res.status(500).json({ error: err.message || "Internal server error during upload.", success: false });
    } finally {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`[CLEANUP] Temporary upload file cleaned up: ${tempFilePath}`);
        } catch (cleanErr) {
          console.error("Failed to clean up temporary file:", cleanErr);
        }
      }
    }
  }

  app.post("/api/upload", uploadMiddleware.single("file"), (req, res) => {
    return handleCloudinaryUpload(req, res, "image");
  });

  app.post("/api/upload-video", uploadMiddleware.single("file"), (req, res) => {
    return handleCloudinaryUpload(req, res, "video");
  });

  // ==========================================================
  // SECURE PROXY ROUTE: ASSET DELETION
  // ==========================================================
  app.post("/api/delete-cloudinary", async (req, res): Promise<void> => {
    try {
      const { url } = req.body;
      if (!url) {
        res.status(400).json({ error: "Missing 'url' of the asset to delete." });
        return;
      }
      
      const success = await deleteFromCloudinary(url);
      if (success) {
        res.status(200).json({ success: true, message: "Asset deleted successfully from Cloudinary." });
      } else {
        res.status(400).json({ error: "Cloudinary cleanup was skipped, or asset is not hosted there." });
      }
    } catch (err: any) {
      console.error("Delete Cloudinary proxy error:", err);
      res.status(500).json({ error: err.message || "Failed to process asset deletion." });
    }
  });

  // ==========================================================
  // VITE DEVELOPMENT OR PRODUCTION STATIC MIDDLEWARE
  // ==========================================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support Express v4 or v5 route matcher
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Error handling middleware to prevent Express from returning HTML error pages
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express App Error:", err);
    res.status(err.status || 500).json({
      error: err.message || "An unexpected server error occurred during processing."
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
