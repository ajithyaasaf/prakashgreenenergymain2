import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { AuthForm } from "@/components/auth/auth-form";
import { LoginForm } from "@/components/auth/login-form";
import { auth } from "@/lib/firebase";

export default function Login() {
  const [, setLocation] = useLocation();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    const checkAuthState = auth.onAuthStateChanged((user) => {
      if (user) {
        setLocation("/dashboard");
      }
    });
    
    return () => checkAuthState();
  }, [setLocation]);

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
