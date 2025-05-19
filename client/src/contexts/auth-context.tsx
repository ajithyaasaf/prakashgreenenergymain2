import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User } from "firebase/auth";
import { apiRequest } from "@/lib/queryClient";
import { onAuthChange, auth } from "@/lib/firebase";
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Try to fetch user profile from API
          const response = await fetch(`/api/users/profile?uid=${firebaseUser.uid}`, {
            credentials: "include",
          });

          if (response.ok) {
            // If user profile exists in the backend, use it
            const userData = await response.json();
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || userData.displayName,
              photoURL: firebaseUser.photoURL,
              role: userData.role || "employee",
              department: userData.department || null,
              id: userData.id,
            });
          } else {
            // If user doesn't exist in backend yet, check Firestore directly
            // and create a backend user profile
            
            // For now, fallback to Firebase data with default role
            const userRole = "employee"; // Default role for new users
            
            // Create a new user in the backend
            try {
              const createResponse = await apiRequest("POST", "/api/users", {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User",
                role: userRole,
                department: null,
              });
              
              if (createResponse.ok) {
                const newUserData = await createResponse.json();
                setUser({
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                  photoURL: firebaseUser.photoURL,
                  role: userRole,
                  department: null,
                  id: newUserData.id,
                });
              } else {
                // If creating user fails, just use Firebase data
                setUser({
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                  photoURL: firebaseUser.photoURL,
                  role: userRole,
                  department: null,
                });
              }
            } catch (createError) {
              console.error("Error creating user profile:", createError);
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                role: userRole,
                department: null,
              });
            }
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          // Fallback to basic Firebase user data
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: "employee", // Default role for new users
            department: null,
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const createUserProfile = async (userData: Partial<AuthUser>) => {
    try {
      if (!auth.currentUser) {
        throw new Error("No authenticated user found");
      }

      const response = await apiRequest("POST", "/api/users", {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        displayName: userData.displayName || auth.currentUser.displayName,
        role: userData.role || "employee",
        department: userData.department || null,
      });

      if (response.ok) {
        const newUserData = await response.json();
        setUser({
          ...user,
          ...newUserData,
        });
        toast({
          title: "Profile Created",
          description: "Your user profile has been created successfully.",
          variant: "success",
        });
      } else {
        throw new Error("Failed to create user profile");
      }
    } catch (error) {
      console.error("Error creating user profile:", error);
      toast({
        title: "Error",
        description: "Failed to create user profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  const updateUserProfile = async (userData: Partial<AuthUser>) => {
    try {
      if (!user?.id) {
        throw new Error("No user profile found");
      }

      const response = await apiRequest("PATCH", `/api/users/${user.id}`, userData);

      if (response.ok) {
        const updatedUserData = await response.json();
        setUser({
          ...user,
          ...updatedUserData,
        });
        toast({
          title: "Profile Updated",
          description: "Your user profile has been updated successfully.",
          variant: "success",
        });
      } else {
        throw new Error("Failed to update user profile");
      }
    } catch (error) {
      console.error("Error updating user profile:", error);
      toast({
        title: "Error",
        description: "Failed to update user profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        createUserProfile,
        updateUserProfile,
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
