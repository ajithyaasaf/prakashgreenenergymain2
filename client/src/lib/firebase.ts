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
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBo8D4pTG6oNGg4qy7V4AaC73qfAB0HRcc",
  authDomain: "solar-energy-56bc8.firebaseapp.com",
  databaseURL: "https://solar-energy-56bc8-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "solar-energy-56bc8",
  storageBucket: "solar-energy-56bc8.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "833087081002",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:833087081002:web:10001186150884d311d153",
  measurementId: "G-2S9TJM6E3C"
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
