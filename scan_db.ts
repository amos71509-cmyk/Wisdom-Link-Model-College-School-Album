import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import appletConfig from "./firebase-applet-config.json";

const firebaseConfig = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, appletConfig.firestoreDatabaseId);

async function scan() {
  console.log("=== SCANNING FIRESTORE COLLECTIONS ===");
  const collections = [
    "comments",
    "graduation_memory_comments",
    "graduation_students",
    "graduation_memories",
    "community_memories",
    "submissions",
    "photos",
    "videos",
    "students",
    "teacher_tributes",
    "superlatives"
  ];

  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      console.log(`\nCollection: [${colName}] -> Total docs: ${snap.size}`);
      snap.forEach(docSnap => {
        const data = docSnap.data();
        console.log(`  - ID: ${docSnap.id} | status: ${data.status || 'N/A'} | profileApproved: ${data.profileApproved !== undefined ? data.profileApproved : 'N/A'}`);
      });
    } catch (err: any) {
      console.log(`Error reading collection [${colName}]: ${err.message}`);
    }
  }
  process.exit(0);
}

scan();
