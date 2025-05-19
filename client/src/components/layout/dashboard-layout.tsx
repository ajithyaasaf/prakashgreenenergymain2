import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./sidebar";
import { MobileSidebar } from "./mobile-sidebar";
import { Header } from "./header";
import { useAuthContext } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, loading } = useAuthContext();
  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading...</span>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar for desktop */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <MobileSidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />

        {/* Page header with actions */}
        <Header onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}
