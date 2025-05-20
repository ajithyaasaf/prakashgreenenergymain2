import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuthContext } from "@/contexts/auth-context";
import { Permission, usePermissions } from "@/hooks/use-permissions";
import { Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: Permission;
  fallbackUrl?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredPermission,
  fallbackUrl = "/dashboard"
}: ProtectedRouteProps) {
  const { user, loading } = useAuthContext();
  const { hasPermission } = usePermissions();
  const [, setLocation] = useLocation();

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading...</span>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    window.location.href = "/login";
    return null;
  }

  // Check for specific permission if required
  if (requiredPermission && !hasPermission(requiredPermission)) {
    // If user doesn't have permission, show an access denied message
    // or redirect to a fallback URL
    return (
      <DashboardLayout>
        <div className="container mx-auto py-6">
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>
              You don't have permission to access this feature.
              {fallbackUrl && (
                <button 
                  className="ml-2 text-primary underline"
                  onClick={() => setLocation(fallbackUrl)}
                >
                  Go back
                </button>
              )}
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  // User is authenticated and has required permission, render children
  return <>{children}</>;
}