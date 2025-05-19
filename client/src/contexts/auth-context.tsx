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

  // Helper function to create a new user
  const handleNewUser = async (firebaseUser: User) => {
    try {
      // Try to fetch Firestore data first
      let userRole = "employee"; // Default role
      
      try {
        const { getFirestore, doc, getDoc } = await import("firebase/firestore");
        const db = getFirestore();
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const firestoreData = userDoc.data();
          console.log("Firestore data for new user:", firestoreData);
          
          // Use role from Firestore if available
          if (firestoreData.role) {
            userRole = firestoreData.role;
          }
        }
      } catch (firestoreError) {
        console.error("Error getting Firestore data for new user:", firestoreError);
        // Continue with default role
      }
      
      // Create a new user in the backend
      try {
        const createResponse = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User",
            role: userRole,
            department: null,
          }),
          credentials: 'include'
        });
        
        if (createResponse.ok) {
          const newUserData = await createResponse.json();
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
        } else {
          console.error("Failed to create user:", await createResponse.text());
          handleBasicAuth(firebaseUser);
        }
      } catch (createError) {
        console.error("Error creating user:", createError);
        handleBasicAuth(firebaseUser);
      }
    } catch (error) {
      console.error("Error in handleNewUser:", error);
      handleBasicAuth(firebaseUser);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get all users first to find the user by UID
          const usersResponse = await fetch('/api/users');
          if (usersResponse.ok) {
            const users = await usersResponse.json();
            const existingUser = users.find((u: any) => u.uid === firebaseUser.uid);
            
            if (existingUser) {
              console.log("Found existing user:", existingUser);
              
              // Check Firebase to get user data with Firestore directly
              import("firebase/firestore").then(async ({ getFirestore, doc, getDoc }) => {
                try {
                  const db = getFirestore();
                  const userDocRef = doc(db, "users", firebaseUser.uid);
                  const userDoc = await getDoc(userDocRef);
                  
                  if (userDoc.exists()) {
                    const firestoreData = userDoc.data();
                    console.log("Firestore data:", firestoreData);
                    
                    // If the Firestore role is different from the existing user's role, update it
                    if (firestoreData.role && firestoreData.role !== existingUser.role) {
                      console.log("Updating role to:", firestoreData.role);
                      try {
                        // Update the user's role to match Firestore
                        const updateResponse = await fetch(`/api/users/${existingUser.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ role: firestoreData.role }),
                          credentials: 'include'
                        });
                        
                        if (updateResponse.ok) {
                          const updatedUser = await updateResponse.json();
                          setUser({
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName || updatedUser.displayName,
                            photoURL: firebaseUser.photoURL,
                            role: updatedUser.role,
                            department: updatedUser.department,
                            id: updatedUser.id,
                          });
                        } else {
                          // If update fails, use existing user with Firestore role
                          setUser({
                            ...existingUser,
                            role: firestoreData.role,
                          });
                        }
                      } catch (updateError) {
                        console.error("Error updating user role:", updateError);
                        // Use existing user but with Firestore role
                        setUser({
                          ...existingUser,
                          role: firestoreData.role,
                        });
                      }
                    } else {
                      // User exists and role matches or no Firestore role, use the existing user
                      setUser({
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || existingUser.displayName,
                        photoURL: firebaseUser.photoURL,
                        role: existingUser.role,
                        department: existingUser.department,
                        id: existingUser.id,
                      });
                    }
                  } else {
                    // No Firestore document, use existing user from database
                    setUser({
                      uid: firebaseUser.uid,
                      email: firebaseUser.email,
                      displayName: firebaseUser.displayName || existingUser.displayName,
                      photoURL: firebaseUser.photoURL,
                      role: existingUser.role,
                      department: existingUser.department,
                      id: existingUser.id,
                    });
                  }
                } catch (firestoreError) {
                  console.error("Error fetching Firestore data:", firestoreError);
                  // Fallback to existing user
                  setUser({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName || existingUser.displayName,
                    photoURL: firebaseUser.photoURL,
                    role: existingUser.role,
                    department: existingUser.department,
                    id: existingUser.id,
                  });
                }
                
                setLoading(false);
              }).catch(error => {
                console.error("Error importing Firestore:", error);
                // Fallback to existing user if Firestore import fails
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
              });
            } else {
              // User doesn't exist in our database yet, create a new one
              handleNewUser(firebaseUser);
            }
          } else {
            console.error("Error fetching users list");
            handleNewUser(firebaseUser);
          }
        } catch (error) {
          console.error("Error in auth flow:", error);
          handleNewUser(firebaseUser);
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
