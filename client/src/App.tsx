import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Customers from "@/pages/customers";
import Products from "@/pages/products";
import Quotations from "@/pages/quotations";
import Invoices from "@/pages/invoices";
import Attendance from "@/pages/attendance";
import Leave from "@/pages/leave";
import UserManagement from "@/pages/user-management";
import Departments from "@/pages/departments";
import OfficeLocations from "@/pages/office-locations";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AuthProvider, useAuthContext } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";
import { AppLoader } from "@/components/app-loader";

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
      
      {/* User management - enterprise permission and role based */}
      <Route path="/user-management">
        <ProtectedRoute 
          requiredPermissions={["users.view", "users.create"]}
          requiredRole={["master_admin", "admin"]}
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
