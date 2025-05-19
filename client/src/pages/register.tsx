import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { AuthForm } from "@/components/auth/auth-form";
import { RegisterForm } from "@/components/auth/register-form";
import { useAuthContext } from "@/contexts/auth-context";

export default function Register() {
  const { user } = useAuthContext();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (user) {
      setLocation("/dashboard");
    }
  }, [user, setLocation]);

  return (
    <AuthForm
      title="Create an account"
      description="Enter your details to create a new account"
      footer={
        <div className="text-sm text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-secondary hover:underline">
            Log in
          </Link>
        </div>
      }
    >
      <RegisterForm />
    </AuthForm>
  );
}
