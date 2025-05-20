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
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration from environment variables
console.log("Loading Firebase config with API key:", import.meta.env.VITE_FIREBASE_API_KEY ? "present" : "missing");

const firebaseConfig = {
  apiKey: "AIzaSyBo8D4pTG6oNGg4qy7V4AaC73qfAB0HRcc",
  authDomain: "solar-energy-56bc8.firebaseapp.com",
  databaseURL: "https://solar-energy-56bc8-default-rtdb.firebaseio.com",
  projectId: "solar-energy-56bc8",
  storageBucket: "solar-energy-56bc8.firebasestorage.app",
  messagingSenderId: "833087081002",
  appId: "1:833087081002:web:10001186150884d311d153",
  measurementId: "G-2S9TJM6E3C"
};

// Utility function to check if we have valid Firebase configuration
export const hasValidFirebaseConfig = () => {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY && 
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID && 
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET &&
    import.meta.env.VITE_FIREBASE_APP_ID
  );
};

// Initialize Firebase with error handling
// Add proper type definitions to fix the type errors
let app: ReturnType<typeof initializeApp>;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;
let storage: ReturnType<typeof getStorage>;

try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log("Firebase initialized successfully");
} catch (error) {
  console.error("Error initializing Firebase:", error);
  // Create dummy objects to prevent app crashes
  app = {} as ReturnType<typeof initializeApp>;
  auth = { 
    currentUser: null, 
    onAuthStateChanged: (cb: (user: User | null) => void) => { cb(null); return () => {}; } 
  } as ReturnType<typeof getAuth>;
  db = { 
    collection: () => ({}),
    type: 'firestore',
    app: {} as any,
    toJSON: () => ({})
  } as ReturnType<typeof getFirestore>;
  storage = {} as ReturnType<typeof getStorage>;
}
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

// Function to fetch all Firestore users
export const fetchFirestoreUsers = async () => {
  try {
    // First get data from Firestore
    const usersCollectionRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersCollectionRef);
    
    const firestoreUsers = usersSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
    
    // Then get additional data from Firebase Auth
    const { getAuth } = await import("firebase/auth");
    const firebaseAuth = getAuth();
    
    // Use Firebase Admin SDK functions available through our backend API
    const response = await fetch('/api/firebase/list-users');
    let authUsers: any[] = [];
    
    if (response.ok) {
      authUsers = await response.json();
    } else {
      console.warn("Failed to fetch Firebase Auth users from backend API");
    }
    
    // Merge Firestore data with Auth data
    const mergedUsers = firestoreUsers.map(firestoreUser => {
      // Try to find matching auth user
      const authUser = authUsers.find(au => au.uid === firestoreUser.uid);
      
      if (authUser) {
        return {
          ...firestoreUser,
          email: authUser.email || firestoreUser.email || null,
          displayName: authUser.displayName || firestoreUser.displayName || null
        };
      }
      
      return firestoreUser;
    });
    
    return mergedUsers;
  } catch (error) {
    console.error("Error fetching Firestore users:", error);
    return [];
  }
};

// Function to get Firestore user data
export const getFirestoreUserData = async (uid: string) => {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      return {
        uid,
        ...userDoc.data()
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error getting Firestore user data:", error);
    return null;
  }
};

// Function to get auth user data for a specific uid
export const getAuthUserData = async (uid: string) => {
  const currentUser = auth.currentUser;
  
  // If this is the current user, we can directly use their data
  if (currentUser && currentUser.uid === uid) {
    return {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL
    };
  }
  
  // Otherwise return null - we'll need to create placeholders
  return null;
};

// Define a type for Firestore user data
interface FirestoreUser {
  uid: string;
  email?: string;
  displayName?: string;
  role?: "master_admin" | "admin" | "employee";
  department?: "cre" | "accounts" | "hr" | "sales_and_marketing" | "technical_team" | null;
  [key: string]: any; // For other fields that might be present
}

// Function to sync a specific user with our application database
export const syncUser = async (uid: string, forceFull = false) => {
  try {
    // Get user data from Firestore
    const firestoreUser = await getFirestoreUserData(uid) as FirestoreUser | null;
    
    // Get user auth data if available
    const authUser = await getAuthUserData(uid);
    
    // Get existing user from our API
    const existingUsersResponse = await fetch('/api/users');
    const existingUsers = await existingUsersResponse.json();
    const existingUser = existingUsers.find((user: any) => user.uid === uid);
    
    // Merge data with priority to auth data
    let email = authUser?.email || firestoreUser?.email || `user-${uid}@example.com`;
    let displayName = authUser?.displayName || firestoreUser?.displayName || email.split('@')[0] || "User";
    const role = firestoreUser?.role || "employee";
    const department = firestoreUser?.department || null;
    
    // Create or update user
    if (!existingUser) {
      // Create new user
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid,
          email,
          displayName,
          role,
          department
        })
      });
      
      if (response.ok) {
        const newUser = await response.json();
        return { status: 'created', user: newUser };
      }
    } else if (forceFull || existingUser.role !== role || 
        existingUser.department !== department || 
        existingUser.displayName !== displayName ||
        existingUser.email !== email) {
      
      // Update existing user
      const response = await fetch(`/api/users/${existingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          department,
          displayName,
          email
        })
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        return { status: 'updated', user: updatedUser };
      }
    }
    
    return { status: 'unchanged', user: existingUser };
  } catch (error) {
    console.error(`Error syncing user ${uid}:`, error);
    return { status: 'error', error: String(error) };
  }
};

// Function to sync Firestore users with our application database
export const syncFirestoreUsers = async () => {
  try {
    // Get current authenticated user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No authenticated user found");
    }

    // Get all Firestore users (from firestore collection)
    const usersCollectionRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersCollectionRef);
    
    const firestoreUsers = usersSnapshot.docs.map(doc => ({
      uid: doc.id
    }));
    
    // Track successful syncs
    const syncResults = [];
    
    // Process each Firestore user
    for (const firestoreUser of firestoreUsers) {
      const result = await syncUser(firestoreUser.uid);
      syncResults.push({
        uid: firestoreUser.uid,
        status: result.status,
        ...result.user
      });
    }
    
    console.log("User sync results:", syncResults);
    return syncResults;
  } catch (error) {
    console.error("Error syncing Firestore users:", error);
    return [];
  }
};

export { auth, db, storage };
export default app;
