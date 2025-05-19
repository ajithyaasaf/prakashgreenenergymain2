import { useState } from "react";
import { 
  loginWithEmail, 
  registerWithEmail, 
  loginWithGoogle, 
  logoutUser 
} from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useAuthContext } from "@/contexts/auth-context";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user, createUserProfile } = useAuthContext();

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      await loginWithEmail(email, password);
      toast({
        title: "Login Successful",
        description: "Welcome back!",
        variant: "success",
      });
      return true;
    } catch (error: any) {
      let message = "Failed to login. Please try again.";
      
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        message = "Invalid email or password.";
      } else if (error.code === "auth/too-many-requests") {
        message = "Too many failed login attempts. Please try again later.";
      } else if (error.code === "auth/network-request-failed") {
        message = "Network error. Please check your connection.";
      }
      
      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, password: string, displayName: string) => {
    setIsLoading(true);
    try {
      const userCredential = await registerWithEmail(email, password);
      
      // Update user profile with display name
      await userCredential.user.updateProfile({
        displayName: displayName,
      });
      
      // Create user profile in the backend
      await createUserProfile({
        displayName,
        role: "employee", // Default role for new users
      });
      
      toast({
        title: "Registration Successful",
        description: "Your account has been created.",
        variant: "success",
      });
      return true;
    } catch (error: any) {
      let message = "Failed to create account. Please try again.";
      
      if (error.code === "auth/email-already-in-use") {
        message = "Email already in use. Please try another email.";
      } else if (error.code === "auth/invalid-email") {
        message = "Invalid email address.";
      } else if (error.code === "auth/weak-password") {
        message = "Password is too weak. Please use a stronger password.";
      }
      
      toast({
        title: "Registration Failed",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogleProvider = async () => {
    setIsLoading(true);
    try {
      const result = await loginWithGoogle();
      
      // If this is a new user, create their profile in the backend
      if (result.additionalUserInfo?.isNewUser) {
        await createUserProfile({
          displayName: result.user.displayName || '',
          role: "employee", // Default role for new users
        });
      }
      
      toast({
        title: "Login Successful",
        description: "Welcome!",
        variant: "success",
      });
      return true;
    } catch (error: any) {
      let message = "Failed to login with Google. Please try again.";
      
      if (error.code === "auth/popup-closed-by-user") {
        message = "Google login popup was closed. Please try again.";
      }
      
      toast({
        title: "Login Failed",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      toast({
        title: "Logout Successful",
        description: "You have been logged out.",
        variant: "success",
      });
      return true;
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    isLoading,
    login,
    register,
    loginWithGoogle: loginWithGoogleProvider,
    logout,
  };
}
