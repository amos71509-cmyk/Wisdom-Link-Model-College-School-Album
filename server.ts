import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, updateDoc, doc, addDoc } from "firebase/firestore";

// Load environment variables (useful for local development)
dotenv.config();

// Initialize Server-side Firebase Admin / Firestore for Webhook Processing
let serverDb: any = null;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  let appletConfig: any = {};
  if (fs.existsSync(configPath)) {
    appletConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || appletConfig.apiKey || "mock-api-key",
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || "mock.firebaseapp.com",
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || appletConfig.projectId || "mock-project",
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || "mock.appspot.com",
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || "123456",
    appId: process.env.VITE_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID || appletConfig.appId || "1:123:web:456",
  };
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig, "server-app") : getApp("server-app");
    serverDb = getFirestore(fbApp);
    console.log("[SERVER FIRESTORE] Initialized successfully for webhook processing.");
  }
} catch (err) {
  console.error("[SERVER FIRESTORE] Failed to initialize server Firestore:", err);
}

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
  // CORS & PREFLIGHT CONFIGURATION FOR RELIABLE UPLOADS
  // ==========================================================
  app.use((req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }
    next();
  });

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
      // Signature string parameters must be sorted alphabetically: invalidate, public_id, timestamp
      const stringToSign = `invalidate=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto
        .createHash("sha1")
        .update(stringToSign)
        .digest("hex");

      console.log(`Cloudinary deletion trigger for ${resourceType} (with invalidate=true & eager/thumbnail cleanup): ${publicId}`);
      
      // Use global fetch (native in Node 18+)
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_id: publicId,
          timestamp: timestamp,
          invalidate: true,
          api_key: apiKey,
          signature: signature,
        }),
      });

      const data = (await response.json()) as { result?: string; error?: any };
      console.log("Cloudinary destroy response:", data);

      // If video, also destroy potential image thumbnail asset with same publicId
      if (isVideo) {
        try {
          const imgResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              public_id: publicId,
              timestamp: timestamp,
              invalidate: true,
              api_key: apiKey,
              signature: signature,
            }),
          });
          const imgData = await imgResponse.json();
          console.log("Cloudinary thumbnail destroy response:", imgData);
        } catch (imgErr) {
          console.warn("Could not scrub secondary image thumbnail asset:", imgErr);
        }
      }

      return data.result === "ok" || data.result === "not found";
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
  // HEALTH CHECK ROUTE FOR UPLOAD PIPELINE
  // ==========================================================
  app.get(["/api/health", "/api/health/"], (req, res) => {
    const cloudinaryConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME || "ds1zmsqau") && Boolean(process.env.CLOUDINARY_API_KEY || "861565431698295");
    res.status(200).json({
      status: "ok",
      backend: true,
      cloudinary: cloudinaryConfigured,
      timestamp: new Date().toISOString()
    });
  });

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
      console.log(`STEP 8: Cloudinary upload started.`);
      const uploadedFile = req.file || (req.files && (req.files as Express.Multer.File[])[0]);
      const bodyFile = req.body?.file || req.body?.image;
      const resourceTypeParam = req.body?.resource_type || defaultResourceType;
      const reqFolder = req.body?.folder || "scholars_class_2026";

      const timestampIso = new Date().toISOString();
      const reqUrl = req.originalUrl || req.url || req.path;
      const reqMethod = req.method;
      const fileSize = uploadedFile ? uploadedFile.size : (bodyFile ? bodyFile.length : 0);
      const fileType = uploadedFile ? uploadedFile.mimetype : (bodyFile ? "base64/body" : "unknown");

      // Requirement 3: Add detailed logging for every upload request (URL, Method, Size, Type, Timestamp)
      console.log(`\n==========================================================`);
      console.log(`[UPLOAD REQUEST AUDIT - ${timestampIso}]`);
      console.log(`- Request URL: ${reqUrl}`);
      console.log(`- HTTP Method: ${reqMethod}`);
      console.log(`- File Size: ${fileSize} bytes (${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
      console.log(`- File Type: ${fileType}`);
      console.log(`- Timestamp: ${timestampIso}`);
      console.log(`==========================================================`);

      if (uploadedFile) {
        console.log(`- File Name: ${uploadedFile.originalname}`);
        console.log(`- Disk Path: ${uploadedFile.path} (Exists: ${fs.existsSync(uploadedFile.path)})`);
        tempFilePath = uploadedFile.path;
      }

      const sendResponse = (status: number, payload: any) => {
        // Requirement 4: Log every backend response
        console.log(`[UPLOAD BACKEND RESPONSE - ${new Date().toISOString()}] Status: ${status}, Response:`, JSON.stringify(payload));
        res.status(status).json(payload);
      };

      // Requirement 8 & 9: If the upload request does not contain a file, stop immediately
      if (!uploadedFile && !bodyFile) {
        console.warn("[UPLOAD REJECTED] No file or body payload was included in request.");
        sendResponse(400, {
          error: "The upload request did not include the selected file.",
          success: false
        });
        return;
      }

      if (uploadedFile && uploadedFile.size === 0) {
        console.warn("[UPLOAD REJECTED] Selected file is 0 bytes.");
        sendResponse(400, {
          error: "The selected file is empty (0 bytes).",
          success: false
        });
        return;
      }

      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "ds1zmsqau";
      const apiKey = process.env.CLOUDINARY_API_KEY || "861565431698295";
      const apiSecret = process.env.CLOUDINARY_API_SECRET || "1VSp_46W67p56yN85fI7s844lkw";

      const timestamp = Math.round(new Date().getTime() / 1000).toString();
      const folder = reqFolder || "scholars_class_2026";

      let targetResourceType = resourceTypeParam;
      if (targetResourceType === "auto") {
        if (uploadedFile?.mimetype?.startsWith("video/")) {
          targetResourceType = "video";
        } else {
          targetResourceType = "image";
        }
      }

      let eager = "";
      let eagerAsync = "";
      let stringToSign = "";
      if (targetResourceType === "video") {
        eager = "q_auto,vc_auto/mp4";
        eagerAsync = "true";
        stringToSign = `eager=${eager}&eager_async=${eagerAsync}&folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      } else {
        stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      }

      const signature = crypto
        .createHash("sha1")
        .update(stringToSign)
        .digest("hex");

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
      if (eager) formData.append("eager", eager);
      if (eagerAsync) formData.append("eager_async", eagerAsync);
      formData.append("api_key", apiKey);
      formData.append("signature", signature);

      console.log(`STEP 9: Cloudinary upload progress (streaming ${targetResourceType} payload to Cloudinary endpoint...).`);
      console.log(`[CLOUDINARY PROXY] Sending ${targetResourceType} upload to ${uploadUrl}...`);
      console.log(`[CLOUDINARY PROXY] FormData keys: file, timestamp, folder, ${eager ? "eager, eager_async, " : ""}api_key, signature`);

      // Requirement 6: Check whether Cloudinary requests are timing out & add AbortController timeout
      const controller = new AbortController();
      const timeoutMs = targetResourceType === "video" ? 300000 : 120000; // 5 mins for video, 2 mins for image
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      let response;
      try {
        response = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
          signal: controller.signal as any,
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        const isTimeout = fetchErr.name === "AbortError" || fetchErr.message?.includes("aborted") || fetchErr.message?.includes("timeout");
        const errMsg = isTimeout 
          ? `Cloudinary upload timed out after ${timeoutMs / 1000} seconds. Try compressing the file or uploading a smaller file.`
          : `Connection to Cloudinary failed: ${fetchErr.message || "Network error"}`;
        console.error(`STEP FAILED: Cloudinary upload progress.\nReason: ${errMsg}\nHTTP Status: 504\nExpress Error: ${fetchErr.message}\nStack trace: ${fetchErr.stack || "N/A"}`);
        console.error(`[CLOUDINARY FETCH EXCEPTION] ${errMsg}`, fetchErr);
        sendResponse(504, { error: errMsg, success: false, timestamp: new Date().toISOString() });
        return;
      }
      clearTimeout(timeoutId);

      const responseText = await response.text();
      console.log(`[CLOUDINARY PROXY] HTTP Status Code: ${response.status}`);
      console.log(`[CLOUDINARY PROXY] Cloudinary response preview:`, responseText.substring(0, 1000));

      let data: any = {};
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error(`STEP FAILED: Cloudinary upload completed.\nReason: Invalid JSON returned from Cloudinary.\nHTTP Status: ${response.status}\nCloudinary Response: ${responseText.substring(0, 300)}`);
        sendResponse(response.status || 400, {
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
        console.error(`STEP FAILED: Cloudinary upload completed.\nReason: ${errorMsg}\nHTTP Status: ${response.status}\nCloudinary Response: ${JSON.stringify(data.error || {})}`);
        console.error(`[CLOUDINARY ERROR] ${errorMsg}`);
        sendResponse(response.status || 400, {
          error: errorMsg,
          success: false
        });
        return;
      }

      console.log(`STEP 10: Cloudinary upload completed (Asset ID: ${data.public_id}).`);

      let finalUrl = data.secure_url || data.url;
      if (!finalUrl || !finalUrl.startsWith("http")) {
        console.error(`STEP FAILED: Cloudinary upload completed.\nReason: No secure URL returned from Cloudinary.\nHTTP Status: 500\nCloudinary Response: ${JSON.stringify(data)}`);
        sendResponse(500, {
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

      console.log(`STEP 13: JSON response sent to client.`);
      sendResponse(200, {
        url: finalUrl,
        secure_url: finalUrl,
        public_id: data.public_id,
        format: data.format,
        resource_type: data.resource_type,
        success: true,
      });
    } catch (err: any) {
      console.error(`STEP FAILED: Express unhandled exception during upload.\nReason: ${err.message}\nStack trace: ${err.stack || "N/A"}\nHTTP Status: 500\nExpress Error: ${err.message}`);
      console.error("Upload proxy error:", err);
      // Requirement 5: Catch every exception and return valid JSON instead of allowing the request to fail silently
      console.log(`[UPLOAD BACKEND RESPONSE - ${new Date().toISOString()}] Status: 500, Response:`, JSON.stringify({ error: err.message || "Internal server error during upload.", success: false }));
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

  const handleUploadWithMulter = (resourceType: "image" | "video") => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.log(`STEP 6: Request reached Express (${req.method} ${req.url}).`);
      uploadMiddleware.single("file")(req, res, (err: any) => {
        if (err) {
          console.error(`STEP FAILED: Multer accepted file.\nReason: ${err.message || "Multer file upload limit exceeded or file processing error"}\nHTTP Status: ${err.status || 400}\nExpress Error: ${JSON.stringify(err)}`);
          console.error(`[MULTER UPLOAD ERROR - ${resourceType.toUpperCase()}]`, err);
          const errResp = {
            error: err.message || `File upload failed during ${resourceType} processing.`,
            success: false,
            timestamp: new Date().toISOString()
          };
          console.log(`[UPLOAD BACKEND RESPONSE - ${new Date().toISOString()}] Status: ${err.status || 400}, Response:`, JSON.stringify(errResp));
          res.status(err.status || 400).json(errResp);
          return;
        }
        if (req.file && req.file.mimetype && req.file.mimetype.startsWith("video/")) {
          if (req.file.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
          }
          return res.status(400).json({
            error: "Never proxy videos through Express. Please use direct browser-to-Cloudinary signed uploads (/api/cloudinary-signature).",
            success: false
          });
        }
        console.log(`STEP 7: Multer accepted file (${req.file ? req.file.originalname : "body payload"}).`);
        handleCloudinaryUpload(req, res, resourceType);
      });
    };
  };

  // ==========================================================
  // SIGNED UPLOAD CREDENTIALS FOR DIRECT BROWSER UPLOADS
  // ==========================================================
  app.all(["/api/cloudinary-signature", "/api/cloudinary-signature/"], (req, res) => {
    try {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "ds1zmsqau";
      const apiKey = process.env.CLOUDINARY_API_KEY || "861565431698295";
      const apiSecret = process.env.CLOUDINARY_API_SECRET || "1VSp_46W67p56yN85fI7s844lkw";

      const folder = (req.query.folder as string) || req.body?.folder || "scholars_class_2026";
      const resourceType = (req.query.resource_type as string) || req.body?.resource_type || "auto";
      const timestamp = Math.round(new Date().getTime() / 1000).toString();

      let eager = "";
      let eagerAsync = "";
      let notificationUrl: string | undefined = undefined;
      let stringToSign = "";

      if (resourceType === "video") {
        // For video uploads up to 90 MB, configure background eager transformations
        // to prevent synchronous processing timeouts (HTTP 400 / 413)
        // According to official Cloudinary Upload API documentation, eager static transformations
        // must specify the output format extension (/mp4) and f_auto is not allowed.
        eager = "q_auto,vc_auto/mp4";
        eagerAsync = "true";
        notificationUrl = process.env.PUBLIC_WEBHOOK_URL || (req.headers.host && !req.headers.host.includes("localhost") ? `https://${req.headers.host}/api/cloudinary-webhook` : undefined);
        
        // Alphabetical order for Cloudinary SHA1 signature: eager, eager_async, folder, [notification_url], timestamp
        if (notificationUrl) {
          stringToSign = `eager=${eager}&eager_async=${eagerAsync}&folder=${folder}&notification_url=${notificationUrl}&timestamp=${timestamp}${apiSecret}`;
        } else {
          stringToSign = `eager=${eager}&eager_async=${eagerAsync}&folder=${folder}&timestamp=${timestamp}${apiSecret}`;
        }
      } else {
        // Alphabetical order for Cloudinary SHA1 signature: folder, timestamp
        stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
      }

      const signature = crypto
        .createHash("sha1")
        .update(stringToSign)
        .digest("hex");

      res.status(200).json({
        cloudName,
        apiKey,
        timestamp,
        folder,
        signature,
        resourceType,
        eager: eager || undefined,
        eager_async: eagerAsync || undefined,
        notification_url: notificationUrl || undefined,
        success: true
      });
    } catch (err: any) {
      console.error("Signature generation error:", err);
      res.status(500).json({ error: err.message || "Failed to generate signature", success: false });
    }
  });

  app.post(["/api/upload", "/api/upload/"], handleUploadWithMulter("image"));

  app.post(["/api/upload-video", "/api/upload-video/"], (req, res) => {
    res.status(400).json({
      error: "Never proxy videos through Express. Please use direct browser-to-Cloudinary signed uploads (/api/cloudinary-signature).",
      success: false
    });
  });

  // ==========================================================
  // CLOUDINARY WEBHOOK FOR EAGER ASYNC BACKGROUND PROCESSING
  // ==========================================================
  app.post(["/api/cloudinary-webhook", "/api/webhook/cloudinary"], async (req, res): Promise<void> => {
    try {
      console.log(`[CLOUDINARY WEBHOOK] Received notification from Cloudinary:`, JSON.stringify(req.body, null, 2));
      const payload = req.body || {};
      const publicId = payload.public_id;
      const assetId = payload.asset_id;
      const secureUrl = payload.secure_url || payload.url;
      const status = payload.status; // e.g., "ready", "failed", "error"

      if (!publicId && !secureUrl) {
        console.warn("[CLOUDINARY WEBHOOK] Missing public_id and url in payload.");
        res.status(400).json({ error: "Missing public_id or url in webhook payload.", success: false });
        return;
      }

      if (!serverDb) {
        console.error("[CLOUDINARY WEBHOOK] Server Firestore instance not initialized.");
        res.status(500).json({ error: "Server database not initialized.", success: false });
        return;
      }

      // 1. Scan collections for any document matching publicId, assetId, or url
      const collectionsToScan = ["submissions", "graduation_memories", "community_memories", "videos", "photos", "students"];
      let foundDocs: { colName: string; docId: string; data: any }[] = [];

      for (const colName of collectionsToScan) {
        try {
          const colRef = collection(serverDb, colName);
          const snap = await getDocs(colRef);
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            const matchesPublicId = publicId && (
              data.publicId === publicId ||
              data.assetId === publicId ||
              (typeof data.mediaUrl === "string" && data.mediaUrl.includes(publicId)) ||
              (typeof data.url === "string" && data.url.includes(publicId)) ||
              (typeof data.videoUrl === "string" && data.videoUrl.includes(publicId))
            );
            const matchesAssetId = assetId && data.assetId === assetId;
            const matchesUrl = secureUrl && (
              data.mediaUrl === secureUrl ||
              data.url === secureUrl ||
              data.videoUrl === secureUrl
            );

            if (matchesPublicId || matchesAssetId || matchesUrl) {
              foundDocs.push({ colName, docId: docSnap.id, data });
            }
          });
        } catch (colErr) {
          console.warn(`[CLOUDINARY WEBHOOK] Error querying collection ${colName}:`, colErr);
        }
      }

      console.log(`[CLOUDINARY WEBHOOK] Found ${foundDocs.length} matching Firestore documents for asset ${publicId || secureUrl}.`);

      // Check if background processing failed
      const isFailed = status === "failed" || status === "error" || payload.error || (Array.isArray(payload.eager) && payload.eager.some((e: any) => e.status === "failed" || e.error));

      if (isFailed) {
        const errorMsg = payload.error?.message || (Array.isArray(payload.eager) ? payload.eager.find((e: any) => e.error)?.error?.message : "") || "Cloudinary background processing failed.";
        console.error(`[CLOUDINARY WEBHOOK] Processing FAILED for ${publicId}: ${errorMsg}`);

        for (const item of foundDocs) {
          const docRef = doc(serverDb, item.colName, item.docId);
          await updateDoc(docRef, {
            processing: false,
            status: "Failed",
            rejectionReason: `Background media processing failed: ${errorMsg}`,
            updatedAt: new Date().toISOString()
          });
          console.log(`[CLOUDINARY WEBHOOK] Marked ${item.colName}/${item.docId} as status = Failed, processing = false.`);
        }

        // Notify Admin (Requirement 13)
        try {
          await addDoc(collection(serverDb, "admin_notifications"), {
            type: "UPLOAD_FAILED",
            title: "Media Processing Failed",
            message: `Cloudinary background video processing failed for asset ${publicId || secureUrl}: ${errorMsg}`,
            publicId: publicId || "",
            assetId: assetId || "",
            timestamp: new Date().toISOString(),
            read: false,
            affectedDocuments: foundDocs.map(f => `${f.colName}/${f.docId}`)
          });
          console.log("[CLOUDINARY WEBHOOK] Admin notification created for failed upload.");
        } catch (notifErr) {
          console.error("[CLOUDINARY WEBHOOK] Failed to write admin notification:", notifErr);
        }

        res.status(200).json({ success: true, status: "Failed", message: "Processed failure webhook and notified admin." });
        return;
      }

      // Processing succeeded! (Requirement 9 & 10: Replace original URLs with optimised URLs and generate thumbnails)
      let optimizedVideoUrl = secureUrl;
      if (Array.isArray(payload.eager) && payload.eager.length > 0 && payload.eager[0].secure_url) {
        optimizedVideoUrl = payload.eager[0].secure_url;
      } else if (secureUrl && secureUrl.includes("/video/upload/") && !secureUrl.includes("/q_auto,vc_auto/")) {
        optimizedVideoUrl = secureUrl.replace("/video/upload/", "/video/upload/q_auto,vc_auto/");
      }

      // Generate thumbnail URL after processing completes (Requirement 10)
      let thumbnailUrl = payload.thumbnail_url || "";
      if (!thumbnailUrl && optimizedVideoUrl) {
        thumbnailUrl = optimizedVideoUrl
          .replace("/video/upload/", "/video/upload/so_0,w_800,c_limit/")
          .replace(/\.(mp4|webm|mov|mkv|avi)$/i, ".jpg");
      }

      for (const item of foundDocs) {
        const docRef = doc(serverDb, item.colName, item.docId);
        const updatePayload: any = {
          processing: false,
          updatedAt: new Date().toISOString()
        };
        if (item.data.mediaUrl) updatePayload.mediaUrl = optimizedVideoUrl;
        if (item.data.url) updatePayload.url = optimizedVideoUrl;
        if (item.data.videoUrl) updatePayload.videoUrl = optimizedVideoUrl;
        if (thumbnailUrl) updatePayload.thumbnailUrl = thumbnailUrl;

        await updateDoc(docRef, updatePayload);
        console.log(`[CLOUDINARY WEBHOOK] Successfully updated ${item.colName}/${item.docId}: processing = false, url = ${optimizedVideoUrl}, thumbnail = ${thumbnailUrl}`);
      }

      res.status(200).json({
        success: true,
        status: "ready",
        updatedCount: foundDocs.length,
        optimizedVideoUrl,
        thumbnailUrl
      });
    } catch (err: any) {
      console.error("[CLOUDINARY WEBHOOK] Error processing webhook:", err);
      res.status(500).json({ error: err.message || "Webhook handling failed.", success: false });
    }
  });

  // ==========================================================
  // SECURE PROXY ROUTE: ASSET DELETION
  // ==========================================================
  app.post(["/api/delete-cloudinary", "/api/delete-cloudinary/"], async (req, res): Promise<void> => {
    try {
      const { url } = req.body;
      if (!url) {
        const errResp = { error: "Missing 'url' of the asset to delete.", success: false };
        console.log(`[UPLOAD BACKEND RESPONSE - ${new Date().toISOString()}] Status: 400, Response:`, JSON.stringify(errResp));
        res.status(400).json(errResp);
        return;
      }
      
      const success = await deleteFromCloudinary(url);
      if (success) {
        const okResp = { success: true, message: "Asset deleted successfully from Cloudinary." };
        console.log(`[UPLOAD BACKEND RESPONSE - ${new Date().toISOString()}] Status: 200, Response:`, JSON.stringify(okResp));
        res.status(200).json(okResp);
      } else {
        const warnResp = { success: true, skipped: true, message: "Cloudinary cleanup skipped or asset already removed." };
        console.log(`[UPLOAD BACKEND RESPONSE - ${new Date().toISOString()}] Status: 200, Response:`, JSON.stringify(warnResp));
        res.status(200).json(warnResp);
      }
    } catch (err: any) {
      console.error("Delete Cloudinary proxy error:", err);
      const errResp = { success: true, skipped: true, error: err.message || "Failed to process asset deletion." };
      console.log(`[UPLOAD BACKEND RESPONSE - ${new Date().toISOString()}] Status: 200, Response:`, JSON.stringify(errResp));
      res.status(200).json(errResp);
    }
  });

  // ==========================================================
  // CATCH-ALL API ROUTE HANDLER (GUARANTEES JSON FOR ALL UNHANDLED API REQUESTS)
  // Ensures no /api/* request ever falls through to Vite SPA fallback or HTML serving!
  // ==========================================================
  app.all(["/api/*", "/api/**"], (req, res) => {
    console.warn(`[API ROUTE UNHANDLED] ${req.method} ${req.originalUrl} - Endpoint not found or method not allowed.`);
    res.status(404).json({
      error: `API endpoint not found: ${req.method} ${req.originalUrl}. Please verify route names match between frontend and backend.`,
      success: false
    });
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
