import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthContext } from "@/contexts/auth-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AuthLoading } from "@/components/auth/auth-loading";

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

  // Track if we're in the process of redirecting
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // This effect handles the redirect to login with a smoother transition
  useEffect(() => {
    if (!user && !loading && !isRedirecting) {
      // Set redirecting state to prevent multiple redirects
      setIsRedirecting(true);
      
      // Store a transitioning flag to prevent login UI flash
      sessionStorage.setItem('auth_transitioning', 'true');
      
      // Use a slight delay to ensure smooth transition
      const redirectTimer = setTimeout(() => {
        window.location.href = "/login";
      }, 100);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [user, loading, isRedirecting]);

  // Show custom loading state during authentication check or redirect
  if (loading || isRedirecting || !user) {
    return <AuthLoading />;
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