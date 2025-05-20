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
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Log Firebase initialization (remove in production)
console.log("Initializing Firebase with project ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID);

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
          email: authUser.email || firestoreUser.email,
          displayName: authUser.displayName || firestoreUser.displayName
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

// Function to sync a specific user with our application database
export const syncUser = async (uid: string, forceFull = false) => {
  try {
    // Get user data from Firestore
    const firestoreUser = await getFirestoreUserData(uid);
    
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
