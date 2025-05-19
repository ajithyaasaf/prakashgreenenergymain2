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
          // Check Firebase to get user data with Firestore directly
          import("firebase/firestore").then(async ({ getFirestore, doc, getDoc }) => {
            try {
              const db = getFirestore();
              const userDocRef = doc(db, "users", firebaseUser.uid);
              const userDoc = await getDoc(userDocRef);
              
              if (userDoc.exists()) {
                const firestoreData = userDoc.data();
                console.log("Firestore data:", firestoreData);
                
                // Try to fetch user profile from our API
                const response = await fetch(`/api/users/profile?uid=${firebaseUser.uid}`, {
                  credentials: "include",
                });

                if (response.ok) {
                  // If user profile exists in the backend, merge with Firestore data
                  const userData = await response.json();
                  setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName || userData.displayName,
                    photoURL: firebaseUser.photoURL,
                    role: firestoreData.role || userData.role || "employee",
                    department: userData.department || null,
                    id: userData.id,
                  });
                } else {
                  // If user doesn't exist in backend yet, create one with Firestore role
                  // Create a new user in the backend
                  try {
                    const createResponse = await apiRequest("POST", "/api/users", {
                      uid: firebaseUser.uid,
                      email: firebaseUser.email,
                      displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User",
                      role: firestoreData.role || "employee",
                      department: null,
                    });
                    
                    if (createResponse.ok) {
                      const newUserData = await createResponse.json();
                      setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                        photoURL: firebaseUser.photoURL,
                        role: firestoreData.role || "employee",
                        department: null,
                        id: newUserData.id,
                      });
                    } else {
                      // If creating user fails, just use Firebase data with Firestore role
                      setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                        photoURL: firebaseUser.photoURL,
                        role: firestoreData.role || "employee",
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
                      role: firestoreData.role || "employee",
                      department: null,
                    });
                  }
                }
              } else {
                // No Firestore document, fallback to basic auth
                handleBasicAuth(firebaseUser);
              }
            } catch (firestoreError) {
              console.error("Error fetching Firestore data:", firestoreError);
              handleBasicAuth(firebaseUser);
            }
          }).catch(error => {
            console.error("Error importing Firestore:", error);
            handleBasicAuth(firebaseUser);
          });
        } catch (error) {
          console.error("Error in auth flow:", error);
          handleBasicAuth(firebaseUser);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Helper function for basic auth without Firestore
    const handleBasicAuth = async (firebaseUser: User) => {
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
          // Default role fallback
          const userRole = "employee";
          
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
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          role: "employee",
          department: null,
        });
      }
      setLoading(false);
    };

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
