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

function AuthenticatedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading...</span>
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login";
    return null;
  }

  return (
    <DashboardLayout>
      <Component />
    </DashboardLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      
      {/* Protected routes */}
      <Route path="/">
        <AuthenticatedRoute component={Dashboard} />
      </Route>
      <Route path="/dashboard">
        <AuthenticatedRoute component={Dashboard} />
      </Route>
      <Route path="/customers">
        <AuthenticatedRoute component={Customers} />
      </Route>
      <Route path="/products">
        <AuthenticatedRoute component={Products} />
      </Route>
      <Route path="/quotations">
        <AuthenticatedRoute component={Quotations} />
      </Route>
      <Route path="/invoices">
        <AuthenticatedRoute component={Invoices} />
      </Route>
      <Route path="/attendance">
        <AuthenticatedRoute component={Attendance} />
      </Route>
      <Route path="/leave">
        <AuthenticatedRoute component={Leave} />
      </Route>
      <Route path="/user-management">
        <AuthenticatedRoute component={UserManagement} />
      </Route>
      <Route path="/departments">
        <AuthenticatedRoute component={Departments} />
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
