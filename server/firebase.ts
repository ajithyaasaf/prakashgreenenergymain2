import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Firebase server configuration
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || "solar-energy-56bc8",
  privateKey: process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : undefined,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "solar-energy-56bc8.firebasestorage.app",
};

// Initialize Firebase Admin with error handling
let app;
let auth;
let db;
let storage;

try {
  if (firebaseConfig.privateKey && firebaseConfig.clientEmail) {
    app = initializeApp({
      credential: cert(firebaseConfig as ServiceAccount),
      storageBucket: firebaseConfig.storageBucket
    });
  } else {
    // Initialize with default project credentials (when running on cloud services)
    app = initializeApp({
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket
    });
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log("Firebase Admin initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase Admin:", error);
  throw new Error("Failed to initialize Firebase Admin. Check environment variables and credentials.");
}

export { app, auth, db, storage };