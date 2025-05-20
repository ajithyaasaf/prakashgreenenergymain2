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
import { getFirestore, collection, getDocs } from "firebase/firestore";
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

// Function to sync Firestore users with our application database
export const syncFirestoreUsers = async () => {
  try {
    // Get current authenticated user
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("No authenticated user found");
    }

    // Get current user's credentials for use with Firebase SDK
    const idToken = await currentUser.getIdToken();

    // Get all Firestore users (from firestore collection)
    const usersCollectionRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersCollectionRef);
    
    const firestoreUsers = usersSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
    
    // Fetch existing users from our API
    const existingUsersResponse = await fetch('/api/users');
    const existingUsers = await existingUsersResponse.json();
    
    // Track successful syncs
    const syncResults = [];
    
    // Process each Firestore user
    for (const firestoreUser of firestoreUsers) {
      try {
        // Find if this user already exists in our app database
        const existingUser = existingUsers.find((user: any) => user.uid === firestoreUser.uid);
        
        // First, try to get the full email from auth.currentUser if it's the current user
        let email = firestoreUser.email;
        let displayName = firestoreUser.displayName;
        
        // If this is the current user, we definitely have their email and name
        if (firestoreUser.uid === currentUser.uid) {
          email = currentUser.email || email;
          displayName = currentUser.displayName || displayName;
        }
        
        // If we still don't have an email, create a placeholder based on UID
        // This ensures we always have an email even if we can't get the real one
        if (!email) {
          email = `user-${firestoreUser.uid}@example.com`;
        }
        
        // If we don't have a display name, try to derive it from the email
        if (!displayName) {
          displayName = email.split('@')[0] || "User";
        }
        
        // Set default role if not present
        const role = firestoreUser.role || "employee";
        
        // Create or update user in our app
        if (!existingUser) {
          // Create new user
          const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: firestoreUser.uid,
              email: email,
              displayName: displayName,
              role: role,
              department: firestoreUser.department || null,
            })
          });
          
          if (response.ok) {
            const newUser = await response.json();
            syncResults.push({
              uid: firestoreUser.uid,
              status: 'created',
              email,
              displayName
            });
          }
        } else {
          // Only update if there are changes
          if (existingUser.role !== role || 
              existingUser.department !== firestoreUser.department || 
              existingUser.displayName !== displayName) {
                
            const response = await fetch(`/api/users/${existingUser.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                role: role,
                department: firestoreUser.department || null,
                displayName: displayName
              })
            });
            
            if (response.ok) {
              syncResults.push({
                uid: firestoreUser.uid,
                status: 'updated',
                email,
                displayName
              });
            }
          } else {
            syncResults.push({
              uid: firestoreUser.uid,
              status: 'unchanged',
              email,
              displayName
            });
          }
        }
      } catch (userError) {
        console.error(`Error syncing user ${firestoreUser.uid}:`, userError);
        syncResults.push({
          uid: firestoreUser.uid,
          status: 'error',
          error: userError.message
        });
      }
    }
    
    console.log("User sync results:", syncResults);
    return syncResults;
  } catch (error) {
    console.error("Error syncing Firestore users:", error);
    return false;
  }
};

export { auth, db, storage };
export default app;
