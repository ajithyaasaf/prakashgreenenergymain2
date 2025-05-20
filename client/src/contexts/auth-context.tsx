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
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (firebaseUser) {
        // Get all users first to find the user by UID
        fetch('/api/users')
          .then(response => response.ok ? response.json() : [])
          .then(users => {
            const existingUser = users.find((u: any) => u.uid === firebaseUser.uid);
            
            if (existingUser) {
              console.log("Found existing user:", existingUser);
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || existingUser.displayName,
                photoURL: firebaseUser.photoURL,
                role: existingUser.role,
                department: existingUser.department,
                id: existingUser.id,
              });
              setLoading(false);
              
              // Check Firebase to get user data with Firestore
              import("firebase/firestore")
                .then(({ getFirestore, doc, getDoc }) => {
                  const db = getFirestore();
                  const userDocRef = doc(db, "users", firebaseUser.uid);
                  return getDoc(userDocRef);
                })
                .then(userDoc => {
                  if (userDoc && userDoc.exists()) {
                    const firestoreData = userDoc.data();
                    console.log("Firestore data:", firestoreData);
                    
                    // If the Firestore role is different from the existing user's role, update it
                    if (firestoreData.role && firestoreData.role !== existingUser.role) {
                      console.log("Updating role to:", firestoreData.role);
                      
                      return fetch(`/api/users/${existingUser.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ role: firestoreData.role }),
                        credentials: 'include'
                      })
                      .then(updateResponse => {
                        if (updateResponse.ok) {
                          return updateResponse.json();
                        } else {
                          throw new Error("Failed to update role");
                        }
                      })
                      .then(updatedUser => {
                        setUser(prevUser => ({
                          ...prevUser!,
                          role: updatedUser.role,
                        }));
                      })
                      .catch(updateError => {
                        console.error("Error updating user role:", updateError);
                        // Still update the local state with Firestore role
                        setUser(prevUser => ({
                          ...prevUser!,
                          role: firestoreData.role as UserRole,
                        }));
                      });
                    }
                  }
                })
                .catch(firestoreError => {
                  console.error("Error fetching Firestore data:", firestoreError);
                });
            } else {
              // User doesn't exist in our database yet, create a new one
              handleNewUser(firebaseUser);
            }
          })
          .catch(error => {
            console.error("Error in auth flow:", error);
            handleBasicAuth(firebaseUser);
          });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [toast]);

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