import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "firebase/auth";
import { apiRequest } from "@/lib/queryClient";
import { onAuthChange } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

type UserRole = "master_admin" | "admin" | "employee";
type Department = "cre" | "accounts" | "hr" | "sales_and_marketing" | "technical_team" | null;

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: UserRole;
  department: Department;
  id?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  createUserProfile: (userData: Partial<AuthUser>) => Promise<void>;
  updateUserProfile: (userData: Partial<AuthUser>) => Promise<void>;
  hasPermission: (role: UserRole[] | UserRole) => boolean;
  isDepartmentMember: (department: Department[] | Department) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Helper function for basic auth without Firestore
  const handleBasicAuth = (firebaseUser: User) => {
    // Just set basic user data from Firebase
    setUser({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      role: "employee",
      department: null,
    });
    
    setLoading(false);
  };

  // Helper function to create a new user
  const handleNewUser = (firebaseUser: User) => {
    // Create a new user in the backend
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User",
        role: "employee", // Default role
        department: null,
      }),
      credentials: 'include'
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(`Failed to create user: ${response.statusText}`);
      }
    })
    .then(newUserData => {
      console.log("Created new user:", newUserData);
      
      setUser({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || newUserData.displayName,
        photoURL: firebaseUser.photoURL,
        role: newUserData.role,
        department: newUserData.department,
        id: newUserData.id,
      });
      
      // Show success toast
      toast({
        title: "Account created",
        description: "Your account has been successfully set up.",
        variant: "success" as any,
      });
    })
    .catch(error => {
      console.error("Error creating user:", error);
      handleBasicAuth(firebaseUser);
    })
    .finally(() => {
      setLoading(false);
    });
  };
  
  useEffect(() => {
    // Keep existing user during transitions to prevent UI flicker
    let currentUser: AuthUser | null = null;
    let isInitialAuth = true;
    
    // Keep track of auth state in localStorage to prevent flashes
    const persistedAuth = localStorage.getItem('authState');
    if (persistedAuth) {
      try {
        const parsedAuth = JSON.parse(persistedAuth);
        // Set the persisted user immediately to prevent login screen flash
        setUser(parsedAuth);
      } catch (e) {
        // If parsing fails, ignore the persisted data
        console.error("Failed to parse persisted auth state");
      }
    }
    
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      // Handle logout
      if (!firebaseUser) {
        setUser(null);
        localStorage.removeItem('authState');
        setLoading(false);
        return;
      }
      
      // If this is the first auth event or we're changing users
      if (isInitialAuth || !currentUser || currentUser.uid !== firebaseUser.uid) {
        // Don't set loading to true if we already have a user (prevents login screen flash)
        if (!user) {
          setLoading(true);
        }
        
        // Create temporary user object
        currentUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          role: "employee", // Default role, will be updated
          department: null,
        };
        
        // For initial auth, don't update user state if we already have persisted data
        // This prevents unnecessary re-renders and UI flicker
        if (!isInitialAuth || !user) {
          setUser(currentUser);
        }
        
        try {
          // Import syncUser function for auto-sync
          const { syncUser } = await import("@/lib/firebase");
          
          // Sync this user with our database
          const result = await syncUser(firebaseUser.uid, true);
          
          if (result.status === 'error') {
            // If there was an error syncing, fall back to basic auth
            handleBasicAuth(firebaseUser);
            return;
          }
          
          // Get the user data and update state
          const userData = result.user;
          
          // Update our current user reference
          currentUser = {
            uid: firebaseUser.uid,
            email: userData.email || firebaseUser.email,
            displayName: userData.displayName || firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: userData.role,
            department: userData.department,
            id: userData.id,
          };
          
          // Set the complete user data
          setUser(currentUser);
          
          // Persist the auth state to prevent login flashes on page refresh
          localStorage.setItem('authState', JSON.stringify(currentUser));
          
          // Mark that we've completed the initial auth
          isInitialAuth = false;
        } catch (error) {
          console.error("Error syncing user data:", error);
          // Fall back to basic auth if there was an error
          handleBasicAuth(firebaseUser);
        } finally {
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [toast, user]);

  const createUserProfile = async (userData: Partial<AuthUser>) => {
    if (!user) return;
    
    try {
      const response = await apiRequest("POST", "/api/users", {
        ...userData,
        uid: user.uid,
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        setUser((prevUser) => prevUser ? { ...prevUser, ...updatedUser } : null);
        
        toast({
          title: "Profile updated",
          description: "Your profile has been successfully updated.",
          variant: "success" as any,
        });
      }
    } catch (error) {
      console.error("Error creating user profile:", error);
      
      toast({
        title: "Error",
        description: "There was an error updating your profile.",
        variant: "destructive",
      });
    }
  };

  const updateUserProfile = async (userData: Partial<AuthUser>) => {
    if (!user || !user.id) return;
    
    try {
      const response = await apiRequest("PATCH", `/api/users/${user.id}`, userData);
      
      if (response.ok) {
        const updatedUser = await response.json();
        setUser((prevUser) => prevUser ? { ...prevUser, ...updatedUser } : null);
        
        toast({
          title: "Profile updated",
          description: "Your profile has been successfully updated.",
          variant: "success" as any,
        });
      }
    } catch (error) {
      console.error("Error updating user profile:", error);
      
      toast({
        title: "Error",
        description: "There was an error updating your profile.",
        variant: "destructive",
      });
    }
  };

  // Role-based permission check
  const hasPermission = (roles: UserRole[] | UserRole): boolean => {
    if (!user) return false;
    
    if (Array.isArray(roles)) {
      return roles.includes(user.role);
    }
    
    return user.role === roles;
  };
  
  // Department-based permission check
  const isDepartmentMember = (departments: Department[] | Department): boolean => {
    if (!user || !user.department) return false;
    
    if (Array.isArray(departments)) {
      return departments.includes(user.department);
    }
    
    return user.department === departments;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        createUserProfile,
        updateUserProfile,
        hasPermission,
        isDepartmentMember,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  
  if (context === undefined) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  
  return context;
}