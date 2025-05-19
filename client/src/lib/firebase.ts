import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAq5YJoV4BqdJvFj9p9X6Hk3IQlOTPXBMM",
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "prakash-greens-energy"}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "prakash-greens-energy",
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "prakash-greens-energy"}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "712345678901",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:712345678901:web:1234567890abcdef",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Authentication functions
export const loginWithEmail = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const registerWithEmail = (email: string, password: string) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const loginWithGoogle = () => {
  return signInWithPopup(auth, googleProvider);
};

export const logoutUser = () => {
  return signOut(auth);
};

export const updateUserProfile = (user: User, profile: { displayName?: string | null; photoURL?: string | null }) => {
  return updateProfile(user, profile);
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export { auth, db, storage };
export default app;
