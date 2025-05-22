import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { AuthForm } from "@/components/auth/auth-form";
import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/lib/firebase";
import { AuthLoading } from "@/components/auth/auth-loading";
import logoPath from "@assets/new logo 2.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [showLoginForm, setShowLoginForm] = useState<boolean>(false);
  
  // Check if we are in the middle of an auth transition
  useEffect(() => {
    // Check for auth transitioning flag and clear it if present
    const authTransitioning = sessionStorage.getItem('auth_transitioning');
    if (authTransitioning === 'true') {
      sessionStorage.removeItem('auth_transitioning');
      setIsTransitioning(true);
      
      // Keep showing the loading screen for a smooth experience
      const timer = setTimeout(() => {
        setIsTransitioning(false);
        setShowLoginForm(true);
      }, 500);
      
      return () => clearTimeout(timer);
    } else {
      setShowLoginForm(true);
    }
  }, []);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    const checkAuthState = auth.onAuthStateChanged((user) => {
      if (user) {
        // Prevent login UI flash by showing loading state during transition
        setIsTransitioning(true);
        setShowLoginForm(false);
        
        // Slight delay for better visual transition
        setTimeout(() => {
          setLocation("/dashboard");
        }, 100);
      }
    });
    
    return () => checkAuthState();
  }, [setLocation]);

  // Show loading state during auth transitions
  if (isTransitioning) {
    return <AuthLoading />;
  }

  // Only show login form when ready
  if (!showLoginForm) {
    return <AuthLoading />;
  }

  return (
    <AuthForm
      title="Log in to your account"
      description="Enter your credentials to access your account"
      footer={
        <div className="text-sm text-center">
          Don't have an account?{" "}
          <Link href="/register" className="text-secondary hover:underline">
            Create an account
          </Link>
        </div>
      }
    >
      <LoginForm />
    </AuthForm>
  );
}
