import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OfflineIndicator } from "@/components/offline/offline-indicator";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AuthProvider, useAuthContext } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";
import { AppLoader } from "@/components/app-loader";
import { Suspense, lazy, useEffect } from "react";
import { withChunkLoading, preloadRouteChunks } from "@/utils/chunk-loader";

// Enhanced lazy loading with progressive chunking and preloading
const Customers = withChunkLoading(() => import("@/pages/customers"), "Loading customer management...");
const Products = withChunkLoading(() => import("@/pages/products"), "Loading product catalog...");
const Quotations = withChunkLoading(() => import("@/pages/quotations"), "Loading quotation system...");
const Invoices = withChunkLoading(() => import("@/pages/invoices"), "Loading invoice management...");
const Attendance = withChunkLoading(() => import("@/pages/attendance"), "Loading attendance tracker...");
const AttendanceManagement = withChunkLoading(() => import("@/pages/attendance-management"), "Loading attendance administration...");
const PayrollManagement = withChunkLoading(() => import("@/pages/payroll-management"), "Loading payroll system...");
const Leave = withChunkLoading(() => import("@/pages/leave"), "Loading leave management...");
const UserManagement = withChunkLoading(() => import("@/pages/user-management"), "Loading user administration...");
const Departments = withChunkLoading(() => import("@/pages/departments"), "Loading department management...");
const OfficeLocations = withChunkLoading(() => import("@/pages/office-locations"), "Loading office configuration...");

// Advanced loading fallback component
const LazyPageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <div className="text-center">
        <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        <p className="text-xs text-muted-foreground mt-1">Optimizing performance</p>
      </div>
    </div>
  </div>
);

import { ProtectedRoute } from "@/components/auth/protected-route";
import { RootHandler } from "@/components/auth/root-handler";

function Router() {
  // Initialize progressive route preloading for better performance
  useEffect(() => {
    preloadRouteChunks();
  }, []);

  return (
    <Switch>
      {/* Public routes - no auth required */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Root route - intelligent redirect based on auth state */}
      <Route path="/" component={RootHandler} />
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Customer management - enterprise permission based */}
      <Route path="/customers">
        <ProtectedRoute 
          requiredPermissions={["customers.view", "customers.create"]}
        >
          <DashboardLayout>
            <Customers />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Product management - enterprise permission based */}
      <Route path="/products">
        <ProtectedRoute 
          requiredPermissions={["products.view", "products.create"]}
        >
          <DashboardLayout>
            <Products />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Quotation management - enterprise permission based */}
      <Route path="/quotations">
        <ProtectedRoute 
          requiredPermissions={["quotations.view", "quotations.create"]}
        >
          <DashboardLayout>
            <Quotations />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Invoice management - enterprise permission based */}
      <Route path="/invoices">
        <ProtectedRoute 
          requiredPermissions={["invoices.view", "invoices.create"]}
        >
          <DashboardLayout>
            <Invoices />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Attendance management - enterprise permission based */}
      <Route path="/attendance">
        <ProtectedRoute 
          requiredPermissions={["attendance.view_own", "attendance.view_team", "attendance.view_all"]}
        >
          <DashboardLayout>
            <Attendance />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Leave management - enterprise permission based */}
      <Route path="/leave">
        <ProtectedRoute 
          requiredPermissions={["leave.view_own", "leave.view_team", "leave.view_all"]}
        >
          <DashboardLayout>
            <Leave />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* User management - enterprise permission based */}
      <Route path="/user-management">
        <ProtectedRoute 
          requiredPermissions={["users.view"]}
        >
          <DashboardLayout>
            <UserManagement />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Department management - enterprise permission based */}
      <Route path="/departments">
        <ProtectedRoute 
          requiredPermissions={["departments.view", "departments.create"]}
          requiredRole="master_admin"
        >
          <DashboardLayout>
            <Departments />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Office Locations - enterprise system administration */}
      <Route path="/office-locations">
        <ProtectedRoute 
          requiredPermissions="system.settings"
          requiredRole="master_admin"
        >
          <DashboardLayout>
            <OfficeLocations />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Attendance Management - master admin only */}
      <Route path="/attendance-management">
        <ProtectedRoute 
          requiredRole="master_admin"
        >
          <DashboardLayout>
            <AttendanceManagement />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Payroll Management - master admin only */}
      <Route path="/payroll-management">
        <ProtectedRoute 
          requiredRole="master_admin"
        >
          <DashboardLayout>
            <PayrollManagement />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

// This component sits inside the AuthProvider
function AppContent() {
  const { loading } = useAuthContext();
  
  // Prevent login screen flash by showing a loading screen during auth check
  if (loading) {
    return <AppLoader />;
  }
  
  // Only wrap in these providers when the auth state is determined
  return (
    <TooltipProvider>
      <Toaster />
      <Router />
    </TooltipProvider>
  );
}

export default App;
