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
    const usersCollectionRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersCollectionRef);
    
    const users = usersSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));
    
    return users;
  } catch (error) {
    console.error("Error fetching Firestore users:", error);
    return [];
  }
};

// Function to sync Firestore users with our application database
export const syncFirestoreUsers = async () => {
  try {
    // Fetch users from Firestore
    const firestoreUsers = await fetchFirestoreUsers();
    
    // Fetch existing users from our API
    const existingUsersResponse = await fetch('/api/users');
    const existingUsers = await existingUsersResponse.json();
    
    // Find which users need to be created or updated
    const usersToSync = firestoreUsers.filter(firestoreUser => {
      // Check if the user already exists in our database
      const existingUser = existingUsers.find((user: any) => user.uid === firestoreUser.uid);
      
      // If the user doesn't exist or has different data, sync it
      return !existingUser || 
        existingUser.role !== firestoreUser.role || 
        existingUser.department !== firestoreUser.department;
    });
    
    // Create or update each user
    for (const userToSync of usersToSync) {
      const existingUser = existingUsers.find((user: any) => user.uid === userToSync.uid);
      
      if (!existingUser) {
        // Create new user
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: userToSync.uid,
            email: userToSync.email || `user-${userToSync.uid}@example.com`,
            displayName: userToSync.displayName || userToSync.email?.split('@')[0] || "User",
            role: userToSync.role || "employee",
            department: userToSync.department || null,
          })
        });
      } else {
        // Update existing user
        await fetch(`/api/users/${existingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: userToSync.role,
            department: userToSync.department || null,
          })
        });
      }
    }
    
    return true;
  } catch (error) {
    console.error("Error syncing Firestore users:", error);
    return false;
  }
};

export { auth, db, storage };
export default app;
