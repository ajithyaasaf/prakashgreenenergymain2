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
import { Suspense, lazy } from "react";

// Simple lazy loading without complex chunk management
const Customers = lazy(() => import("@/pages/customers"));
const Products = lazy(() => import("@/pages/products"));
const Quotations = lazy(() => import("@/pages/quotations"));
const Invoices = lazy(() => import("@/pages/invoices"));
const Attendance = lazy(() => import("@/pages/attendance"));
const AttendanceManagement = lazy(() => import("@/pages/attendance-management"));
const PayrollManagement = lazy(() => import("@/pages/payroll-management"));
const Leave = lazy(() => import("@/pages/leave"));
const UserManagement = lazy(() => import("@/pages/user-management"));
const HRManagement = lazy(() => import("@/pages/hr-management"));
const Departments = lazy(() => import("@/pages/departments"));
const OfficeLocations = lazy(() => import("@/pages/office-locations"));
const SiteVisit = lazy(() => import("@/pages/site-visit"));

// Simple loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
  </div>
);

import { ProtectedRoute } from "@/components/auth/protected-route";
import { RootHandler } from "@/components/auth/root-handler";

function Router() {
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
            <Suspense fallback={<PageLoader />}>
              <Customers />
            </Suspense>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Product management - enterprise permission based */}
      <Route path="/products">
        <ProtectedRoute 
          requiredPermissions={["products.view", "products.create"]}
        >
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
              <Products />
            </Suspense>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Quotation management - enterprise permission based */}
      <Route path="/quotations">
        <ProtectedRoute 
          requiredPermissions={["quotations.view", "quotations.create"]}
        >
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
              <Quotations />
            </Suspense>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Invoice management - enterprise permission based */}
      <Route path="/invoices">
        <ProtectedRoute 
          requiredPermissions={["invoices.view", "invoices.create"]}
        >
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
              <Invoices />
            </Suspense>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Attendance management - enterprise permission based */}
      <Route path="/attendance">
        <ProtectedRoute 
          requiredPermissions={["attendance.view_own", "attendance.view_team", "attendance.view_all"]}
        >
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
              <Attendance />
            </Suspense>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Leave management - enterprise permission based */}
      <Route path="/leave">
        <ProtectedRoute 
          requiredPermissions={["leave.view_own", "leave.view_team", "leave.view_all"]}
        >
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
              <Leave />
            </Suspense>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Site Visit Management - Technical, Marketing, Admin departments only */}
      <Route path="/site-visit">
        <ProtectedRoute 
          requiredPermissions={["site_visit.view", "site_visit.create"]}
          requiredDepartments={["technical", "marketing", "admin"]}
          allowMasterAdmin={true}
        >
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
              <SiteVisit />
            </Suspense>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* User management - enterprise permission based */}
      <Route path="/user-management">
        <ProtectedRoute 
          requiredPermissions={["users.view"]}
        >
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
              <UserManagement />
            </Suspense>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* HR Management - enterprise employee management */}
      <Route path="/hr-management">
        <ProtectedRoute 
          requiredPermissions={["users.view"]}
          requiredDepartments={["hr", "admin"]}
          allowMasterAdmin={true}
        >
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
              <HRManagement />
            </Suspense>
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
            <Suspense fallback={<PageLoader />}>
              <Departments />
            </Suspense>
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
            <Suspense fallback={<PageLoader />}>
              <OfficeLocations />
            </Suspense>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Attendance Management - master admin only */}
      <Route path="/attendance-management">
        <ProtectedRoute 
          requiredRole="master_admin"
        >
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
              <AttendanceManagement />
            </Suspense>
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Payroll Management - master admin only */}
      <Route path="/payroll-management">
        <ProtectedRoute 
          requiredRole="master_admin"
        >
          <DashboardLayout>
            <Suspense fallback={<PageLoader />}>
              <PayrollManagement />
            </Suspense>
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
