import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  writeBatch, 
  query, 
  orderBy, 
  where,
  onSnapshot 
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { uploadFileToCloudinary, base64ToFile } from "../utils/uploadHelper";
import { 
  Student, 
  Superlative, 
  TeacherTribute, 
  TimelineEvent, 
  GuestbookEntry, 
  VideoMemory, 
  Photo, 
  CustomSection, 
  PendingSubmission,
  CommunityMemory,
  MediaComment,
  GraduationStudent,
  GraduationSettings,
  GraduationMemory,
  GraduationMemoryComment
} from "../types";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('[FIRESTORE HANDLED GRACEFULLY] Firestore Error details:', JSON.stringify(errInfo));
}

// Helper to sanitize undefined values recursively
export function sanitizeData(data: any): any {
  if (data === undefined) return null;
  if (data === null) return null;
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  if (typeof data === "object") {
    const clean: any = {};
    for (const key of Object.keys(data)) {
      clean[key] = sanitizeData(data[key]);
    }
    return clean;
  }
  return data;
}

// ==========================================================
// MODERATION PIPELINE HELPERS
// ==========================================================

/**
 * Automatically scrubs Cloudinary assets via backend when items are rejected or deleted.
 */
export async function scrubCloudinaryMedia(urlOrUrls?: string | (string | undefined | null)[]): Promise<void> {
  if (!urlOrUrls) return;
  const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
  for (const u of urls) {
    if (u && typeof u === 'string' && u.includes("cloudinary.com")) {
      try {
        console.log("[CLOUDINARY CLEANUP] Scrubbing media asset from cloud:", u);
        await fetch("/api/delete-cloudinary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: u })
        });
      } catch (err) {
        console.warn("[CLOUDINARY CLEANUP WARNING] Failed to scrub media:", u, err);
      }
    }
  }
}

/**
 * 1. submitToModeration(type, data)
 * Sanitizes input fields, appends a unique ID, and writes data to the 'submissions' collection.
 */
export async function submitToModeration(type: string, data: any): Promise<{ success: boolean; id: string; message: string }> {
  try {
    const sanitized = sanitizeData(data);
    const id = `pend-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const fullPath = `submissions/${id}`;
    const docRef = doc(db, "submissions", id);
    
    const submission: PendingSubmission = {
      id,
      type,
      submittedAt: new Date().toISOString(),
      data: { ...sanitized, id: sanitized.id || id }
    };
    
    console.log(`[FIRESTORE WRITE ATTEMPT] Operation: setDoc, Path: ${fullPath}, Collection: submissions, DocID: ${id}`);
    await setDoc(docRef, submission);
    console.log(`[FIRESTORE WRITE SUCCESS] Path: ${fullPath}`);
    return {
      success: true,
      id,
      message: `Your ${type} post was submitted successfully and is awaiting administrator approval.`
    };
  } catch (error: any) {
    const fullPath = `submissions/pend-*`;
    console.error(`[FIRESTORE WRITE FAILURE] setDoc failed for path: ${fullPath}`, error);
    handleFirestoreError(error, OperationType.WRITE, fullPath);
    throw error;
  }
}

/**
 * 2. fetchPendingSubmissions()
 * Retrieves all items awaiting moderation sorted by submission date.
 */
export async function fetchPendingSubmissions(): Promise<PendingSubmission[]> {
  try {
    const colRef = collection(db, "submissions");
    const q = query(colRef, orderBy("submittedAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as PendingSubmission);
  } catch (error) {
    console.warn("fetchPendingSubmissions dynamic sort error (indexes might be building), falling back to client sort:", error);
    try {
      const colRef = collection(db, "submissions");
      const snapshot = await getDocs(colRef);
      const items = snapshot.docs.map(d => d.data() as PendingSubmission);
      return items.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    } catch (innerErr) {
      console.error("fetchPendingSubmissions fallback failed:", innerErr);
      return [];
    }
  }
}

/**
 * 3. approveSubmission(item)
 * Uses Firestore writeBatch (atomic transaction) to approve the item, move to production, and remove from staging.
 */
export async function approveSubmission(item: PendingSubmission): Promise<void> {
  const batch = writeBatch(db);
  const submissionRef = doc(db, "submissions", item.id);
  
  const typeMap: { [key: string]: string } = {
    guestbook: "guestbook",
    student: "students",
    students: "students",
    superlative: "superlatives",
    superlatives: "superlatives",
    timeline: "timeline",
    video: "videos",
    videos: "videos",
    teacher_tribute: "teacher_tributes",
    teacher_tributes: "teacher_tributes",
    photo: "photos",
    photos: "photos"
  };

  const adminId = auth.currentUser?.uid || auth.currentUser?.email || 'Admin';
  const timestamp = new Date().toISOString();

  // If the submission has a staged Base64 Data URL, upload it to Cloudinary now that Admin has approved it!
  const imgFields = ['imageUrl', 'photoUrl', 'url', 'image', 'mediaUrl', 'thumbnailUrl'];
  for (const field of imgFields) {
    if (item.data && typeof item.data[field] === 'string' && item.data[field].startsWith('data:image/')) {
      try {
        console.log(`[APPROVAL UPLOAD] Uploading staged Base64 image field '${field}' to Cloudinary...`);
        const file = base64ToFile(item.data[field], `approved_${item.id}_${field}.jpg`);
        const uploadRes = await uploadFileToCloudinary(file, { folder: 'scholars_class_2026', forceUpload: true });
        item.data[field] = uploadRes.secure_url || uploadRes.url;
        item.data.isStaged = false;
        console.log(`[APPROVAL UPLOAD SUCCESS] Field '${field}' uploaded to Cloudinary: ${item.data[field]}`);
      } catch (uploadErr) {
        console.error(`[APPROVAL UPLOAD ERROR] Failed to upload staged image for field '${field}':`, uploadErr);
      }
    }
  }

  // 1. Update the existing submission document in the submissions collection
  batch.update(submissionRef, {
    status: "Approved",
    approved: true,
    approvedAt: timestamp,
    approvedBy: adminId,
    updatedAt: timestamp
  });

  if (item.type === "student_portrait_update") {
    const studentId = item.data.studentId;
    const newImageUrl = item.data.imageUrl || item.data.image;
    
    // Query old image URL
    const studentRef = doc(db, "students", studentId);
    const studentSnap = await getDoc(studentRef);
    let oldImageUrl = "";
    if (studentSnap.exists()) {
      oldImageUrl = studentSnap.data().image;
    }
    
    // Background deletion request for the stale asset from Cloudinary
    if (oldImageUrl && oldImageUrl.includes("cloudinary.com")) {
      try {
        await fetch("/api/delete-cloudinary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: oldImageUrl })
        });
      } catch (err) {
        console.error("Cloud cleanup warning for student portrait replace:", err);
      }
    }
    
    batch.update(studentRef, { image: newImageUrl });
  } else {
    // Normal entry move to production collection
    const collectionName = typeMap[item.type] || item.type;
    const finalDocId = item.data.id || `${item.type}-${Date.now()}`;
    const targetDocRef = doc(db, collectionName, finalDocId);
    
    // Auto-tag graduation category if relevant
    const isGraduation = 
      (item.data.event && item.data.event.toLowerCase().includes("grad")) || 
      (item.data.category && item.data.category.toLowerCase().includes("grad")) ||
      (item.data.tag && item.data.tag.toLowerCase().includes("grad")) ||
      (item.data.title && item.data.title.toLowerCase().includes("grad")) ||
      (item.data.caption && item.data.caption.toLowerCase().includes("grad"));

    const isFeatured = item.data.featured === true || item.data.featured === 'true';

    let finalPayload: any = { 
      ...item.data, 
      id: finalDocId,
      status: "Approved",
      approved: true,
      approvedAt: timestamp,
      approvedBy: adminId,
      updatedAt: timestamp,
      featured: isFeatured
    };

    if (collectionName === "photos") {
      finalPayload.url = item.data.photoUrl || item.data.url || "";
      finalPayload.photoUrl = item.data.photoUrl || item.data.url || "";
      finalPayload.title = item.data.title || item.data.caption || "Student Photo";
      finalPayload.caption = item.data.caption || item.data.title || "Student Photo";
      finalPayload.submittedBy = item.data.submittedBy || item.data.contributorName || "Anonymous";
      finalPayload.contributorName = item.data.contributorName || item.data.submittedBy || "Anonymous";
      finalPayload.role = item.data.role || item.data.relation || "Parent";
      finalPayload.relation = item.data.relation || item.data.role || "Parent";
      finalPayload.date = item.data.date || item.data.uploadedAt?.split('T')[0] || new Date().toISOString().split('T')[0];
      finalPayload.uploadedAt = item.data.uploadedAt || item.data.date || new Date().toISOString();
    } else if (collectionName === "videos") {
      finalPayload.url = item.data.url || item.data.videoUrl || "";
      finalPayload.videoUrl = item.data.url || item.data.videoUrl || "";
      finalPayload.title = item.data.title || item.data.caption || `${item.data.event || 'Video'} memory`;
      finalPayload.caption = item.data.caption || item.data.title || `${item.data.event || 'Video'} memory`;
      finalPayload.submittedBy = item.data.submittedBy || item.data.contributorName || "Anonymous";
      finalPayload.contributorName = item.data.contributorName || item.data.submittedBy || "Anonymous";
      finalPayload.role = item.data.role || item.data.relation || "Contributor";
      finalPayload.relation = item.data.relation || item.data.role || "Contributor";
      finalPayload.date = item.data.date || item.data.uploadedAt?.split('T')[0] || new Date().toISOString().split('T')[0];
      finalPayload.uploadedAt = item.data.uploadedAt || item.data.date || new Date().toISOString();
    }

    if (isGraduation) {
      finalPayload.category = "Graduation";
      finalPayload.tag = "Graduation";
      finalPayload.event = "Graduation Ceremony";
    }
    
    batch.set(targetDocRef, finalPayload);
    console.log(`[FIRESTORE WRITE] Collection: ${collectionName}, DocID: ${finalDocId}, Action: approveSubmission, Payload:`, finalPayload);
  }
  
  // Commit transaction batch
  await batch.commit();
  console.log(`[FIRESTORE BATCH COMMIT SUCCESS] Approved submission ID: ${item.id}`);
}

/**
 * 4. rejectSubmission(item)
 * Removes from submissions collection and scrubs orphaned media attachments from Cloudinary immediately.
 */
export async function rejectSubmission(item: PendingSubmission, reason: string = ""): Promise<void> {
  const submissionRef = doc(db, "submissions", item.id);
  
  const mediaUrls = [
    item.data?.imageUrl,
    item.data?.photoUrl,
    item.data?.url,
    item.data?.videoUrl,
    item.data?.image,
    item.data?.mediaUrl,
    item.data?.thumbnailUrl
  ];
  
  await scrubCloudinaryMedia(mediaUrls);
  
  // Per explicit requirement: automatically delete rejected submissions from database immediately to save space!
  await deleteDoc(submissionRef);
  console.log(`[FIRESTORE DELETE] Rejected and scrubbed submission ID: ${item.id}`);
}

// ==========================================================
// REAL-TIME EVENT SUBSCRIPTIONS
// ==========================================================

/**
 * Subscribe to changes in school branding config (logoUrl, title)
 */
export function subscribeSchoolLogo(callback: (logoUrl: string) => void) {
  const docRef = doc(db, "branding", "config");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists() && docSnap.data().logoUrl) {
      callback(docSnap.data().logoUrl);
    } else {
      callback(""); // Let caller know there's no custom logo configured
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, "branding/config");
  });
}

/**
 * Monitors ticker alerts, flash announcements, or celebration banners.
 */
export function subscribeActiveBannerEvent(callback: (banner: { text: string; active: boolean; type?: string } | null) => void) {
  const docRef = doc(db, "branding", "config");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists() && docSnap.data().banner) {
      callback(docSnap.data().banner);
    } else {
      callback(null);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, "branding/config");
  });
}

/**
 * Synchronizes administrative custom sections dynamically in order indexes
 */
export function subscribeCustomSections(callback: (sections: CustomSection[]) => void) {
  const colRef = collection(db, "custom_sections");
  return onSnapshot(colRef, (snapshot) => {
    const list: CustomSection[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as CustomSection);
    });
    // Sort by orderIndex
    list.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    callback(list);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, "custom_sections");
  });
}

/**
 * Update school logo url
 */
export async function updateSchoolLogo(logoUrl: string): Promise<void> {
  const docRef = doc(db, "branding", "config");
  await setDoc(docRef, { logoUrl }, { merge: true });
}

/**
 * Update celebration banner text or active state
 */
export async function updateActiveBannerEvent(text: string, active: boolean, type = "announcement"): Promise<void> {
  const docRef = doc(db, "branding", "config");
  await setDoc(docRef, { banner: { text, active, type } }, { merge: true });
}

/**
 * Add or update a custom section
 */
export async function saveCustomSection(section: CustomSection): Promise<void> {
  const docRef = doc(db, "custom_sections", section.id);
  await setDoc(docRef, section);
}

/**
 * Delete custom section
 */
export async function deleteCustomSection(id: string): Promise<void> {
  const docRef = doc(db, "custom_sections", id);
  await deleteDoc(docRef);
}

// ==========================================================
// SEED DATA UTILITY (Cold-Start Backup)
// ==========================================================

export async function seedDatabaseIfEmpty(): Promise<void> {
  try {
    const seedCheckRef = doc(db, "system", "seed_status");
    const seedSnap = await getDoc(seedCheckRef);
    
    // Proactive Backfill check: even if already seeded, make sure any existing entries without approved status are migrated
    const collectionsToBackfill = ["students", "superlatives", "teacher_tributes", "timeline", "guestbook", "custom_sections", "photos", "videos"];
    for (const colName of collectionsToBackfill) {
      try {
        const snap = await getDocs(collection(db, colName));
        if (!snap.empty) {
          const backfillBatch = writeBatch(db);
          let needsCommit = false;
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.status !== "Approved" || data.approved !== true) {
              backfillBatch.update(docSnap.ref, {
                status: "Approved",
                approved: true,
                approvedAt: data.approvedAt || new Date().toISOString(),
                approvedBy: data.approvedBy || "System Backfill"
              });
              needsCommit = true;
              console.log(`[BACKFILL] Document ${docSnap.id} in collection ${colName} marked as Approved`);
            }
          });
          if (needsCommit) {
            await backfillBatch.commit();
            console.log(`[BACKFILL SUCCESS] Successfully updated and verified documents in ${colName}`);
          }
        }
      } catch (backfillErr) {
        console.error(`[BACKFILL ERROR] Failed to backfill ${colName}:`, backfillErr);
      }
    }

    if (seedSnap.exists() && seedSnap.data().seeded === true) {
      console.log("Database already seeded with default data.");
      return;
    }
    
    console.log("Firestore database is empty or requires seeding. Beginning active seed sequence...");
    
    const batch = writeBatch(db);
    
    // Seed initial logo and active banner config
    const brandingRef = doc(db, "branding", "config");
    batch.set(brandingRef, {
      logoUrl: "",
      banner: {
        text: "🎉 Congratulations to the resilient Class of 2026 on your glorious graduation day! 🎉",
        active: true,
        type: "announcement"
      }
    });
    
    const systemApprovalMetadata = {
      status: "Approved",
      approved: true,
      approvedAt: new Date().toISOString(),
      approvedBy: "System Setup"
    };

    // Seed Students
    const initialStudents: Student[] = [
      {
        id: "stud-1",
        name: "Sarah Andrews",
        nickname: "The Brain",
        image: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600",
        favoriteMemory: "Delivering the Valedictorian address and pulling late night eco-sensors coding sessions.",
        messageToClassmates: "We survived, thrived, and coded! Let's conquer the next chapter with courage.",
        aspirations: "Artificial Intelligence Research Scientist",
        house: "Emerald House"
      },
      {
        id: "stud-2",
        name: "Liam Mercer",
        nickname: "Speedy",
        image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=600",
        favoriteMemory: "Sprinting to a thrilling gold photo-finish in the 100m Dash during Sports Day 2026.",
        messageToClassmates: "Never stop running towards your dreams. The finish line is just the beginning!",
        aspirations: "Sports Medicine Specialist",
        house: "Emerald House"
      },
      {
        id: "stud-3",
        name: "Marcus Vance",
        nickname: "Maestro",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=600",
        favoriteMemory: "Conducting the 50-strong choir backstage at the candlelight winter recital.",
        messageToClassmates: "Let your life be a beautiful symphony of kindness, hard work, and good tunes.",
        aspirations: "Orchestral Conductor & Violinist",
        house: "Gold House"
      },
      {
        id: "stud-4",
        name: "Evelyn Harris",
        nickname: "Spellbound",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=max&q=80&w=600",
        favoriteMemory: "Earning the spelling bee title after a intense spelling showdown.",
        messageToClassmates: "Word by word, story by story, let's write an amazing next chapter together.",
        aspirations: "Literature Professor & Author",
        house: "Ruby House"
      }
    ];
    
    initialStudents.forEach(stud => {
      batch.set(doc(db, "students", stud.id), { ...stud, ...systemApprovalMetadata });
    });
    
    // Seed Superlatives
    const initialSuperlatives: Superlative[] = [
      {
        id: "sup-1",
        category: "Most Likely to Succeed",
        description: "Voted by peers for outstanding technological innovations and leading student projects.",
        studentName: "Sarah Andrews",
        studentImage: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=600"
      },
      {
        id: "sup-2",
        category: "Class Maestro & Artist",
        description: "Honoring musical dedication and backstage coordination across theatrical plays.",
        studentName: "Marcus Vance",
        studentImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=600"
      },
      {
        id: "sup-3",
        category: "Most Athletic Star",
        description: "For outstanding speed records and leading Emerald House on the track field.",
        studentName: "Liam Mercer",
        studentImage: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=600"
      }
    ];
    
    initialSuperlatives.forEach(sup => {
      batch.set(doc(db, "superlatives", sup.id), { ...sup, ...systemApprovalMetadata });
    });
    
    // Seed Teacher Tributes
    const initialTributes: TeacherTribute[] = [
      {
        id: "tt-1",
        name: "Dr. Elizabeth Sterling",
        subject: "History & Principal",
        image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=max&q=80&w=600",
        message: "To our dear graduates: You have navigated difficult years with exceptional resilience, bright curiosity, and supportive community care. Keep making us proud!"
      },
      {
        id: "tt-2",
        name: "Mr. David Davis",
        subject: "Ecology & Physics",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=600",
        message: "Never lose your wonder of how things work. Ask bold questions, test your theories, and cherish the delicate environment around you."
      }
    ];
    
    initialTributes.forEach(tt => {
      batch.set(doc(db, "teacher_tributes", tt.id), { ...tt, ...systemApprovalMetadata });
    });
    
    // Seed Timeline Events
    const initialTimelineEvents: TimelineEvent[] = [
      {
        id: "te-1",
        date: "2026-06-15",
        title: "The Class of 2026 Commencement",
        description: "Celebrating the glorious commencement of 250 minds under a bright sky with the definitive cap toss.",
        image: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1200"
      },
      {
        id: "te-2",
        date: "2026-05-12",
        title: "Historic Sports Day 2026 Finish",
        description: "A series of intense relays and track triumphs, ending with Emerald House lifting the championship trophy.",
        image: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=1200"
      },
      {
        id: "te-3",
        date: "2025-12-18",
        title: "Annual Winter Concert",
        description: "Student musicians performed Beethoven's classical symphonies for charity on a candlelit night.",
        image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=1200"
      }
    ];
    
    initialTimelineEvents.forEach(te => {
      batch.set(doc(db, "timeline", te.id), { ...te, ...systemApprovalMetadata });
    });
    
    // Seed Guestbook Entries
    const initialGuestbook: GuestbookEntry[] = [
      {
        id: "gb-1",
        name: "Mrs. Abigail Vance",
        role: "Parent",
        message: "Words can't describe our gratitude to Wisdom Link's principal and teachers! A beautiful, supportive environment for our children.",
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hours ago
      },
      {
        id: "gb-2",
        name: "Principal Elizabeth Sterling",
        role: "Teacher",
        message: "Welcome to our live Digital Yearbook and Guestbook archive! Post your greetings and memories here.",
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 24 hours ago
      }
    ];
    
    initialGuestbook.forEach(gb => {
      batch.set(doc(db, "guestbook", gb.id), { ...gb, ...systemApprovalMetadata });
    });
    
    // Seed default custom sections
    const defaultCustomSection: CustomSection = {
      id: "sect-info",
      title: "Special Flash Spotlight",
      subtext: "An administrative spotlight panel created dynamically to show updates on alumni reunions, events, and awards.",
      mediaUrl: "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?auto=format&fit=crop&q=80&w=800",
      mediaType: "image",
      orderIndex: 1,
      layoutType: "spotlight"
    };
    batch.set(doc(db, "custom_sections", defaultCustomSection.id), { ...defaultCustomSection, ...systemApprovalMetadata });
    
    // Seed Administrators
    const adminsToSeed = ["justfashion414@gmail.com", "adesegunakinye416@gmail.com"];
    adminsToSeed.forEach((emailStr) => {
      const norm = emailStr.trim().toLowerCase();
      batch.set(doc(db, "admins", norm), {
        email: norm,
        addedAt: new Date().toISOString(),
        addedBy: "System Setup"
      });
    });

    // Set seed status doc
    batch.set(seedCheckRef, { seeded: true, timestamp: new Date().toISOString() });
    
    await batch.commit();
    console.log("Firestore database successfully seeded with approved records!");
  } catch (err) {
    console.error("Critical: Failed to seed Firestore database:", err);
  }
}

// ==========================================================
// ADDITIONAL DYNAMIC REAL-TIME ARCHIVE LISTENERS
// ==========================================================

export function subscribeStudents(callback: (students: Student[]) => void) {
  const colRef = collection(db, "students");
  const q = query(colRef, where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: Student[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as Student);
    });
    console.log(`[FIRESTORE READ] Collection: students, Count: ${list.length}, Query Filters: status == "Approved"`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "students"));
}

export function subscribeSuperlatives(callback: (superlatives: Superlative[]) => void) {
  const colRef = collection(db, "superlatives");
  const q = query(colRef, where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: Superlative[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as Superlative);
    });
    console.log(`[FIRESTORE READ] Collection: superlatives, Count: ${list.length}, Query Filters: status == "Approved"`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "superlatives"));
}

export function subscribeTeacherTributes(callback: (tributes: TeacherTribute[]) => void) {
  const colRef = collection(db, "teacher_tributes");
  const q = query(colRef, where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: TeacherTribute[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as TeacherTribute);
    });
    console.log(`[FIRESTORE READ] Collection: teacher_tributes, Count: ${list.length}, Query Filters: status == "Approved"`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "teacher_tributes"));
}

export function subscribeTimeline(callback: (events: TimelineEvent[]) => void) {
  const colRef = collection(db, "timeline");
  const q = query(colRef, where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: TimelineEvent[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as TimelineEvent);
    });
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    console.log(`[FIRESTORE READ] Collection: timeline, Count: ${list.length}, Query Filters: status == "Approved"`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "timeline"));
}

export function subscribeGuestbook(callback: (entries: GuestbookEntry[]) => void) {
  const colRef = collection(db, "guestbook");
  const q = query(colRef, where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: GuestbookEntry[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as GuestbookEntry);
    });
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    console.log(`[FIRESTORE READ] Collection: guestbook, Count: ${list.length}, Query Filters: status == "Approved"`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "guestbook"));
}

export function subscribePhotos(callback: (photos: Photo[]) => void) {
  const colRef = collection(db, "photos");
  const q = query(colRef, where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: Photo[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as Photo);
    });
    console.log(`[FIRESTORE READ] Collection: photos, Count: ${list.length}, Query Filters: status == "Approved"`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "photos"));
}

export function subscribeVideos(callback: (videos: VideoMemory[]) => void) {
  const colRef = collection(db, "videos");
  const q = query(colRef, where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: VideoMemory[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as VideoMemory);
    });
    console.log(`[FIRESTORE READ] Collection: videos, Count: ${list.length}, Query Filters: status == "Approved"`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "videos"));
}

export async function updateApprovedStudent(id: string, studentData: any): Promise<void> {
  try {
    const docRef = doc(db, "students", id);
    await setDoc(docRef, studentData, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `students/${id}`);
  }
}

export async function deleteApprovedStudent(id: string): Promise<void> {
  try {
    const docRef = doc(db, "students", id);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `students/${id}`);
  }
}

export function subscribeCommunityMemories(callback: (memories: CommunityMemory[]) => void) {
  const q = query(collection(db, "community_memories"), where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: CommunityMemory[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as CommunityMemory;
      if (data) {
        list.push({ id: doc.id, ...data });
      }
    });
    // Sort by upload date or creation date descending
    list.sort((a, b) => new Date(b.createdAt || b.uploadDate).getTime() - new Date(a.createdAt || a.uploadDate).getTime());
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "community_memories"));
}

// ==========================================================
// MEDIA COMMENTS SYSTEM
// ==========================================================

export async function submitComment(commentData: Omit<MediaComment, 'id' | 'status'>): Promise<void> {
  try {
    const commentsCol = collection(db, "comments");
    const newDocRef = doc(commentsCol);
    const commentPayload: MediaComment = {
      ...commentData,
      id: newDocRef.id,
      status: "Pending"
    };
    await setDoc(newDocRef, commentPayload);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "comments");
  }
}

export function subscribeApprovedComments(callback: (comments: MediaComment[]) => void) {
  const q = query(collection(db, "comments"), where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: MediaComment[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as MediaComment;
      if (data) {
        list.push({ id: doc.id, ...data });
      }
    });
    // Sort chronological ascending (oldest first, fits comment sections)
    list.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "comments_approved"));
}

export function subscribePendingComments(callback: (comments: MediaComment[]) => void) {
  const q = query(collection(db, "comments"), where("status", "==", "Pending"));
  return onSnapshot(q, (snapshot) => {
    const list: MediaComment[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as MediaComment;
      if (data) {
        list.push({ id: doc.id, ...data });
      }
    });
    // Sort chronological descending (newest first for moderation queue)
    list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "comments_pending"));
}

export async function approveComment(id: string, approvedBy: string): Promise<void> {
  try {
    const docRef = doc(db, "comments", id);
    await updateDoc(docRef, {
      status: "Approved",
      approvedAt: new Date().toISOString(),
      approvedBy
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `comments/${id}`);
  }
}

export async function rejectComment(id: string, reason?: string): Promise<void> {
  try {
    const docRef = doc(db, "comments", id);
    await deleteDoc(docRef);
    console.log(`[FIRESTORE DELETE] Rejected and deleted comment ID: ${id}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `comments/${id}`);
  }
}

// ==========================================================
// MEDIA LIKES SYSTEM
// ==========================================================

export function getBrowserSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  let sessionId = localStorage.getItem('school_media_session_id');
  if (!sessionId) {
    sessionId = 'user_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    localStorage.setItem('school_media_session_id', sessionId);
  }
  return sessionId;
}

export async function toggleLike(mediaId: string): Promise<boolean> {
  try {
    const userId = auth.currentUser?.uid || getBrowserSessionId();
    // Unique ID combining userId and mediaId so a user can only like once (duplicate prevention)
    const safeMediaDocId = encodeURIComponent(mediaId).replace(/%/g, '_');
    const docId = `${userId}_${safeMediaDocId}`;
    const docRef = doc(db, "likes", docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      // Unlike
      await deleteDoc(docRef);
      return false; // Liked state is now false
    } else {
      // Like
      await setDoc(docRef, {
        id: docId,
        mediaId: mediaId,
        userId: userId,
        createdAt: new Date().toISOString()
      });
      return true; // Liked state is now true
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `likes`);
    return false;
  }
}

export function subscribeMediaLikes(mediaId: string, callback: (likesCount: number, hasLiked: boolean) => void) {
  const q = query(collection(db, "likes"), where("mediaId", "==", mediaId));
  const userId = auth.currentUser?.uid || getBrowserSessionId();
  return onSnapshot(q, (snapshot) => {
    const likesCount = snapshot.size;
    let hasLiked = false;
    snapshot.forEach((doc) => {
      if (doc.data().userId === userId) {
        hasLiked = true;
      }
    });
    callback(likesCount, hasLiked);
  }, (err) => handleFirestoreError(err, OperationType.GET, "likes"));
}

// ==========================================================
// GRADUATION SYSTEM SERVICE HELPERS
// ==========================================================

export async function saveGraduationStudent(student: GraduationStudent): Promise<void> {
  try {
    const docRef = doc(db, "graduation_students", student.studentId);
    await setDoc(docRef, sanitizeData(student));
    console.log(`[FIRESTORE WRITE] Collection: graduation_students, DocID: ${student.studentId}, Action: saveGraduationStudent`);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `graduation_students/${student.studentId}`);
    throw err;
  }
}

export async function rejectGraduationStudent(studentId: string, reason: string, rejectedBy: string): Promise<void> {
  try {
    const docRef = doc(db, "graduation_students", studentId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      await scrubCloudinaryMedia([
        data.image,
        data.profilePicture,
        data.profilePhoto,
        ...(Array.isArray(data.personalAlbum) ? data.personalAlbum : []),
        ...(Array.isArray(data.gallery) ? data.gallery : [])
      ]);
    }
    await deleteDoc(docRef);
    console.log(`[FIRESTORE DELETE] Rejected and deleted graduation student ID: ${studentId}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `graduation_students/${studentId}`);
    throw err;
  }
}

export async function deleteGraduationStudent(studentId: string): Promise<void> {
  try {
    const docRef = doc(db, "graduation_students", studentId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      await scrubCloudinaryMedia([
        data.image,
        data.profilePicture,
        data.profilePhoto,
        ...(Array.isArray(data.personalAlbum) ? data.personalAlbum : []),
        ...(Array.isArray(data.gallery) ? data.gallery : [])
      ]);
    }
    await deleteDoc(docRef);
    console.log(`[FIRESTORE DELETE] Collection: graduation_students, DocID: ${studentId}, Action: deleteGraduationStudent`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `graduation_students/${studentId}`);
    throw err;
  }
}

export function subscribeAllGraduationStudents(callback: (students: GraduationStudent[]) => void) {
  const colRef = collection(db, "graduation_students");
  return onSnapshot(colRef, (snapshot) => {
    const list: GraduationStudent[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as unknown as GraduationStudent);
    });
    console.log(`[FIRESTORE READ ALL] Collection: graduation_students, Count: ${list.length}`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "graduation_students"));
}

export function subscribeApprovedGraduationStudents(callback: (students: GraduationStudent[]) => void) {
  const colRef = collection(db, "graduation_students");
  const q = query(colRef, where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: GraduationStudent[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as unknown as GraduationStudent);
    });
    console.log(`[FIRESTORE READ APPROVED] Collection: graduation_students, Count: ${list.length}`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "graduation_students_approved"));
}

export function subscribeGraduationSettings(callback: (settings: GraduationSettings | null) => void) {
  const docRef = doc(db, "graduation_settings", "settings");
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as GraduationSettings);
    } else {
      callback(null);
    }
  }, (err) => handleFirestoreError(err, OperationType.GET, "graduation_settings/settings"));
}

export async function saveGraduationSettings(settings: GraduationSettings): Promise<void> {
  try {
    const docRef = doc(db, "graduation_settings", "settings");
    await setDoc(docRef, sanitizeData(settings));
    console.log(`[FIRESTORE WRITE] Collection: graduation_settings, DocID: settings, Action: saveGraduationSettings`);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, "graduation_settings/settings");
    throw err;
  }
}

// ==========================================================
// GRADUATION CEREMONY GALLERY SERVICE
// ==========================================================

export async function submitGraduationCeremonyMemory(memoryData: Partial<GraduationMemory>): Promise<string> {
  const id = memoryData.id || `grad-ceremony-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const fullPath = `graduation_memories/${id}`;
  try {
    const now = new Date().toISOString();
    const docRef = doc(db, "graduation_memories", id);
    const fullMemory: Record<string, any> = {
      id,
      title: memoryData.title || memoryData.caption || 'Graduation Memory',
      eventName: memoryData.eventName || 'Graduation Ceremony',
      graduationYear: memoryData.graduationYear || new Date().getFullYear().toString(),
      uploadedByType: memoryData.uploadedByType || 'Visitor',
      memoryType: memoryData.memoryType || 'General Memory',
      mediaType: memoryData.mediaType || 'image',
      mediaUrl: memoryData.mediaUrl || '',
      thumbnailUrl: memoryData.thumbnailUrl || '',
      caption: memoryData.caption || '',
      status: memoryData.status || 'Pending',
      likesCount: memoryData.likesCount || 0,
      commentsCount: memoryData.commentsCount || 0,
      uploaderName: memoryData.uploaderName || 'Anonymous',
      createdAt: memoryData.createdAt || now,
      updatedAt: now
    };

    if (memoryData.approvedBy) fullMemory.approvedBy = memoryData.approvedBy;
    if (memoryData.approvedAt) fullMemory.approvedAt = memoryData.approvedAt;
    if (memoryData.rejectedBy) fullMemory.rejectedBy = memoryData.rejectedBy;
    if (memoryData.rejectedAt) fullMemory.rejectedAt = memoryData.rejectedAt;
    if (memoryData.rejectionReason) fullMemory.rejectionReason = memoryData.rejectionReason;

    console.log(`[FIRESTORE WRITE ATTEMPT] Operation: setDoc, Target Document Path: ${fullPath}, Collection: graduation_memories, DocID: ${id}, Payload mediaUrl size: ${fullMemory.mediaUrl?.length || 0} chars`);
    await setDoc(docRef, sanitizeData(fullMemory));
    console.log(`[FIRESTORE WRITE SUCCESS] Path: ${fullPath}, Status: ${fullMemory.status}`);
    return id;
  } catch (err: any) {
    console.error(`[FIRESTORE WRITE DENIED/FAILED] setDoc failed for path: ${fullPath}. Error:`, err);
    handleFirestoreError(err, OperationType.WRITE, fullPath);
    throw err;
  }
}

export function subscribeApprovedGraduationMemories(callback: (memories: GraduationMemory[]) => void) {
  const colRef = collection(db, "graduation_memories");
  const q = query(colRef, where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: GraduationMemory[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as GraduationMemory);
    });
    // Sort descending by createdAt
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    console.log(`[FIRESTORE READ APPROVED] Collection: graduation_memories, Count: ${list.length}`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "graduation_memories_approved"));
}

export function subscribeAllGraduationMemories(callback: (memories: GraduationMemory[]) => void) {
  const colRef = collection(db, "graduation_memories");
  return onSnapshot(colRef, (snapshot) => {
    const list: GraduationMemory[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as GraduationMemory);
    });
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    console.log(`[FIRESTORE READ ALL] Collection: graduation_memories, Count: ${list.length}`);
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "graduation_memories_all"));
}

export async function approveGraduationMemory(id: string, adminName: string): Promise<void> {
  try {
    const docRef = doc(db, "graduation_memories", id);
    const snap = await getDoc(docRef);
    let mediaUrl = "";
    let thumbnailUrl = "";
    let updated = false;

    if (snap.exists()) {
      const mem = snap.data();
      mediaUrl = mem.mediaUrl || "";
      thumbnailUrl = mem.thumbnailUrl || "";

      if (mediaUrl && typeof mediaUrl === 'string' && mediaUrl.startsWith('data:image/')) {
        const file = base64ToFile(mediaUrl, `approved_grad_mem_${id}.jpg`);
        const res = await uploadFileToCloudinary(file, { folder: 'scholars_class_2026', forceUpload: true });
        mediaUrl = res.secure_url || res.url;
        updated = true;
      }
      if (thumbnailUrl && typeof thumbnailUrl === 'string' && thumbnailUrl.startsWith('data:image/')) {
        const file = base64ToFile(thumbnailUrl, `approved_grad_thumb_${id}.jpg`);
        const res = await uploadFileToCloudinary(file, { folder: 'scholars_class_2026', forceUpload: true });
        thumbnailUrl = res.secure_url || res.url;
        updated = true;
      }
    }

    const updatePayload: any = {
      status: 'Approved',
      approvedBy: adminName || 'Admin',
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (updated) {
      updatePayload.mediaUrl = mediaUrl;
      updatePayload.thumbnailUrl = thumbnailUrl;
      updatePayload.isStaged = false;
    }
    await updateDoc(docRef, updatePayload);
    console.log(`[FIRESTORE WRITE] Collection: graduation_memories, DocID: ${id}, Approved by ${adminName}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `graduation_memories/${id}`);
    throw err;
  }
}

export async function rejectGraduationMemory(id: string, adminName: string, reason?: string): Promise<void> {
  try {
    const docRef = doc(db, "graduation_memories", id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      await scrubCloudinaryMedia([data.mediaUrl, data.thumbnailUrl, data.url]);
    }
    await deleteDoc(docRef);
    console.log(`[FIRESTORE DELETE] Rejected and deleted graduation memory DocID: ${id}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `graduation_memories/${id}`);
    throw err;
  }
}

export async function deleteGraduationMemory(id: string): Promise<void> {
  try {
    const docRef = doc(db, "graduation_memories", id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      await scrubCloudinaryMedia([data.mediaUrl, data.thumbnailUrl, data.url]);
    }
    await deleteDoc(docRef);
    console.log(`[FIRESTORE DELETE] Collection: graduation_memories, DocID: ${id}`);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `graduation_memories/${id}`);
    throw err;
  }
}

export async function updateGraduationMemoryThumbnail(id: string, thumbnailUrl: string): Promise<void> {
  try {
    const docRef = doc(db, "graduation_memories", id);
    await updateDoc(docRef, {
      thumbnailUrl,
      updatedAt: new Date().toISOString()
    });
    console.log(`[FIRESTORE WRITE] Collection: graduation_memories, DocID: ${id}, Updated Thumbnail`);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `graduation_memories/${id}`);
    throw err;
  }
}

export async function addGraduationMemoryComment(commentData: Partial<GraduationMemoryComment>): Promise<string> {
  try {
    const id = `comment-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const docRef = doc(db, "graduation_memory_comments", id);
    const comment: GraduationMemoryComment = {
      id,
      memoryId: commentData.memoryId || '',
      authorName: commentData.authorName || 'Anonymous',
      authorRole: commentData.authorRole || 'Guest',
      text: commentData.text || '',
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    await setDoc(docRef, sanitizeData(comment));
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'graduation_memory_comments');
    throw err;
  }
}

export function subscribeGraduationMemoryComments(memoryId: string, callback: (comments: GraduationMemoryComment[]) => void) {
  const colRef = collection(db, "graduation_memory_comments");
  const q = query(colRef, where("memoryId", "==", memoryId), where("status", "==", "Approved"));
  return onSnapshot(q, (snapshot) => {
    const list: GraduationMemoryComment[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as GraduationMemoryComment);
    });
    list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "graduation_memory_comments"));
}

export function subscribeAllGraduationComments(callback: (comments: GraduationMemoryComment[]) => void) {
  const colRef = collection(db, "graduation_memory_comments");
  return onSnapshot(colRef, (snapshot) => {
    const list: GraduationMemoryComment[] = [];
    snapshot.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() } as GraduationMemoryComment);
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(list);
  }, (err) => handleFirestoreError(err, OperationType.GET, "graduation_memory_comments_all"));
}

export async function approveGraduationComment(commentId: string, adminName: string): Promise<void> {
  try {
    const docRef = doc(db, "graduation_memory_comments", commentId);
    await updateDoc(docRef, {
      status: 'Approved',
      approvedBy: adminName || 'Admin',
      approvedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `graduation_memory_comments/${commentId}`);
    throw err;
  }
}

export async function deleteGraduationComment(commentId: string): Promise<void> {
  try {
    const docRef = doc(db, "graduation_memory_comments", commentId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `graduation_memory_comments/${commentId}`);
    throw err;
  }
}



