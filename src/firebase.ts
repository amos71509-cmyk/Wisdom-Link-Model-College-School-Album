import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDocFromServer
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import appletConfig from "../firebase-applet-config.json";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletConfig.apiKey || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || appletConfig.authDomain || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletConfig.projectId || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletConfig.storageBucket || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || appletConfig.messagingSenderId || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletConfig.appId || "",
};


// Check if we have minimum requirements, otherwise provide a mock configuration to prevent crashes during build
const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId);

const finalConfig = isConfigured ? firebaseConfig : {
  apiKey: "mock-api-key-for-building-purposes-only",
  authDomain: "mock-project.firebaseapp.com",
  projectId: "mock-project",
  storageBucket: "mock-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456",
};

const app = getApps().length === 0 ? initializeApp(finalConfig) : getApp();

// Get custom database ID if configured
const customDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || appletConfig.firestoreDatabaseId || "(default)";

// Initialize Firestore with robust local persistent cache and multi-tab manager
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, customDatabaseId);


const auth = getAuth(app);

/**
 * Connection verification helper using getDocFromServer
 * Reports true if online (can contact firestore server), false otherwise
 */
export async function verifyConnectionState(): Promise<boolean> {
  if (!isConfigured) {
    console.warn("Firebase is running on mock configuration. Connection state: OFFLINE");
    return false;
  }
  try {
    const dummyRef = doc(db, "_connection_check_", "status");
    await getDocFromServer(dummyRef);
    return true;
  } catch (error: any) {
    // If we get an error other than network failure (e.g. permission-denied or not-found),
    // it means we successfully contacted the server.
    if (error && error.code && error.code !== "unavailable") {
      return true;
    }
    console.error("Firebase network connection check failed:", error);
    return false;
  }
}

export { app, db, auth, isConfigured };
