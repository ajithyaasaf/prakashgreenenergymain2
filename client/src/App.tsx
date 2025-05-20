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
      
      {/* Protected routes - basic authentication required */}
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
      
      {/* Customer management - requires manage_customers permission */}
      <Route path="/customers">
        <ProtectedRoute requiredPermission="manage_customers">
          <DashboardLayout>
            <Customers />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Product management - requires manage_products permission */}
      <Route path="/products">
        <ProtectedRoute requiredPermission="manage_products">
          <DashboardLayout>
            <Products />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Quotation management - requires manage_quotations permission */}
      <Route path="/quotations">
        <ProtectedRoute requiredPermission="manage_quotations">
          <DashboardLayout>
            <Quotations />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Invoice management - requires manage_invoices permission */}
      <Route path="/invoices">
        <ProtectedRoute requiredPermission="manage_invoices">
          <DashboardLayout>
            <Invoices />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Attendance management - requires manage_attendance permission */}
      <Route path="/attendance">
        <ProtectedRoute requiredPermission="manage_attendance">
          <DashboardLayout>
            <Attendance />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Leave management - requires manage_leaves permission */}
      <Route path="/leave">
        <ProtectedRoute requiredPermission="manage_leaves">
          <DashboardLayout>
            <Leave />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* User management - requires manage_access permission */}
      <Route path="/user-management">
        <ProtectedRoute requiredPermission="manage_access">
          <DashboardLayout>
            <UserManagement />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      
      {/* Department management - requires manage_departments permission */}
      <Route path="/departments">
        <ProtectedRoute requiredPermission="manage_departments">
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
