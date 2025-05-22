import { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuthContext } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type Permission = 
  | "manage_departments" 
  | "set_office_locations" 
  | "manage_access"
  | "assign_departments" 
  | "manage_customers" 
  | "manage_products"
  | "manage_quotations"
  | "manage_invoices"
  | "manage_attendance"
  | "manage_leaves";

type Department = "cre" | "accounts" | "hr" | "sales_and_marketing" | "technical_team";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredPermission?: Permission;
  requiredRole?: "master_admin" | "admin" | "employee" | Array<"master_admin" | "admin" | "employee">;
  requiredDepartment?: Department | Department[];
  fallbackUrl?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredPermission,
  requiredRole,
  requiredDepartment,
  fallbackUrl = "/dashboard"
}: ProtectedRouteProps) {
  const { user, loading, hasPermission, isDepartmentMember } = useAuthContext();
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

  // Redirect to login if not authenticated (but avoid redirecting during initial load)
  if (!user && !loading) {
    // Use a more gradual transition to avoid UI flashes
    setTimeout(() => {
      window.location.href = "/login";
    }, 100);
    
    // Show a loading indicator while redirecting instead of null
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Redirecting...</span>
      </div>
    );
  }

  // Master admin can access everything
  if (user.role === "master_admin") {
    return <>{children}</>;
  }

  // Check role-based access if required
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(user.role)) {
      return renderAccessDenied(setLocation, fallbackUrl);
    }
  }

  // Check department-based access if required
  if (requiredDepartment && user.department) {
    const departments = Array.isArray(requiredDepartment) 
      ? requiredDepartment 
      : [requiredDepartment];
    
    if (!departments.includes(user.department) && user.role === "employee") {
      return renderAccessDenied(setLocation, fallbackUrl);
    }
  }

  // Admin can access most features except those explicitly restricted
  if (user.role === "admin") {
    // Admins can't access department management
    if (requiredPermission === "manage_departments") {
      return renderAccessDenied(setLocation, fallbackUrl);
    }
    
    return <>{children}</>;
  }

  // For employees, check department-specific permissions
  if (user.role === "employee") {
    // Allow access to basic dashboard for employees without department
    if (!requiredPermission && (!requiredDepartment || window.location.pathname === "/" || window.location.pathname === "/dashboard")) {
      return <>{children}</>;
    }
    
    // For other features, employees need a department
    if (!user.department) {
      return renderAccessDenied(setLocation, fallbackUrl);
    }
    
    // Department-specific permissions
    const deptPermissions: Record<Department, Permission[]> = {
      "hr": ["manage_attendance", "manage_leaves"],
      "accounts": ["manage_invoices"],
      "sales_and_marketing": ["manage_customers", "manage_quotations"],
      "technical_team": ["manage_products"],
      "cre": []
    };
    
    // Check if the required permission is allowed for the user's department
    if (requiredPermission && 
        !deptPermissions[user.department].includes(requiredPermission)) {
      return renderAccessDenied(setLocation, fallbackUrl);
    }
  }

  // User is authenticated and has required permissions, render children
  return <>{children}</>;
}

// Helper function to render access denied message
function renderAccessDenied(setLocation: (url: string) => void, fallbackUrl: string) {
  return (
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
  );
}