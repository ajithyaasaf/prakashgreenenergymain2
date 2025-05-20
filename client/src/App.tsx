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
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AuthProvider, useAuthContext } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";

import { ProtectedRoute } from "@/components/auth/protected-route";

function Router() {
  return (
    <Switch>
      {/* Public routes - no auth required */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Dashboard - accessible to all authenticated users */}
      <Route path="/">
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Customer management - accessible to Sales & Marketing */}
      <Route path="/customers">
        <ProtectedRoute 
          requiredPermission="manage_customers"
          requiredDepartment={["sales_and_marketing"]}
        >
          <DashboardLayout>
            <Customers />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Product management - accessible to Technical Team */}
      <Route path="/products">
        <ProtectedRoute 
          requiredPermission="manage_products"
          requiredDepartment={["technical_team"]}
        >
          <DashboardLayout>
            <Products />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Quotation management - accessible to Sales & Marketing */}
      <Route path="/quotations">
        <ProtectedRoute 
          requiredPermission="manage_quotations"
          requiredDepartment={["sales_and_marketing"]}
        >
          <DashboardLayout>
            <Quotations />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Invoice management - accessible to Accounts */}
      <Route path="/invoices">
        <ProtectedRoute 
          requiredPermission="manage_invoices"
          requiredDepartment={["accounts"]}
        >
          <DashboardLayout>
            <Invoices />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Attendance management - accessible to HR */}
      <Route path="/attendance">
        <ProtectedRoute 
          requiredPermission="manage_attendance"
          requiredDepartment={["hr"]}
        >
          <DashboardLayout>
            <Attendance />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Leave management - accessible to HR */}
      <Route path="/leave">
        <ProtectedRoute 
          requiredPermission="manage_leaves"
          requiredDepartment={["hr"]}
        >
          <DashboardLayout>
            <Leave />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* User management - accessible to Admins and Master Admins */}
      <Route path="/user-management">
        <ProtectedRoute 
          requiredPermission="manage_access"
          requiredRole={["master_admin", "admin"]}
        >
          <DashboardLayout>
            <UserManagement />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Department management - accessible only to Master Admins */}
      <Route path="/departments">
        <ProtectedRoute 
          requiredPermission="manage_departments"
          requiredRole="master_admin"
        >
          <DashboardLayout>
            <Departments />
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
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
