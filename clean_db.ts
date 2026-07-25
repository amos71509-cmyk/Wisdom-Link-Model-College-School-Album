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

async function clean() {
  console.log("=== STARTING CLEANUP OF REJECTED/DELETED RECORDS ===");
  const collections = [
    "comments",
    "graduation_memory_comments",
    "graduation_students",
    "graduation_memories",
    "community_memories",
    "photos",
    "videos",
    "students",
    "teacher_tributes",
    "superlatives",
    "guestbook"
  ];

  let totalDeleted = 0;

  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const status = data.status || '';
        if (status === 'Rejected' || status === 'Deleted' || data.isDeleted === true || data.deleted === true) {
          console.log(`[DELETING] Found ${status} record in [${colName}]: ID = ${docSnap.id}`);
          await deleteDoc(doc(db, colName, docSnap.id));
          totalDeleted++;
        }
      }
    } catch (err: any) {
      console.log(`Note: Could not scan [${colName}]: ${err.message}`);
    }
  }

  console.log(`\n=== CLEANUP FINISHED! Total rejected/deleted records purged: ${totalDeleted} ===`);
  process.exit(0);
}

clean();
