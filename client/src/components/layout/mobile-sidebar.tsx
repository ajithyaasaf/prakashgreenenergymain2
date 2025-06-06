import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useEffect, useState } from "react";
import type { SystemPermission } from "@shared/schema";

interface MobileSidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function MobileSidebar({ isOpen, setIsOpen }: MobileSidebarProps) {
  const [location] = useLocation();
  const { user, hasPermission, hasRole, canApprove } = useAuthContext();
  const [screenWidth, setScreenWidth] = useState(window.innerWidth);

  // Update screen width on resize
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine grid columns based on screen width
  const getGridCols = () => {
    if (screenWidth < 360) return "grid-cols-2";
    if (screenWidth < 640) return "grid-cols-3";
    return "grid-cols-4";
  };

  interface NavItem {
    href: string;
    label: string;
    icon: string;
    requiredPermissions?: SystemPermission | SystemPermission[];
    roles?: ("master_admin" | "admin" | "employee")[];
    requiresApproval?: boolean;
  }

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "ri-dashboard-line", requiredPermissions: "dashboard.view" },
    { href: "/customers", label: "Customers", icon: "ri-user-3-line", requiredPermissions: ["customers.view", "customers.create"] },
    { href: "/products", label: "Products", icon: "ri-store-2-line", requiredPermissions: ["products.view", "products.create"] },
    { href: "/quotations", label: "Quotations", icon: "ri-file-list-3-line", requiredPermissions: ["quotations.view", "quotations.create"] },
    { href: "/invoices", label: "Invoices", icon: "ri-bill-line", requiredPermissions: ["invoices.view", "invoices.create"] },
    { href: "/attendance", label: "Attendance", icon: "ri-time-line", requiredPermissions: ["attendance.view_own", "attendance.view_team", "attendance.view_all"] },
    { href: "/leave", label: "Leave", icon: "ri-calendar-check-line", requiredPermissions: ["leave.view_own", "leave.view_team", "leave.view_all"] },
    { href: "/user-management", label: "Users", icon: "ri-user-settings-line", roles: ["master_admin", "admin"], requiredPermissions: ["users.view", "users.create"] },
    { href: "/departments", label: "Departments", icon: "ri-building-line", roles: ["master_admin"], requiredPermissions: ["departments.view", "departments.create"] },
    { href: "/attendance-management", label: "Attendance Mgmt", icon: "ri-shield-user-line", roles: ["master_admin"] },
    { href: "/payroll-management", label: "Payroll Mgmt", icon: "ri-money-dollar-circle-line", roles: ["master_admin"] },
    { href: "/office-locations", label: "Offices", icon: "ri-map-pin-line", roles: ["master_admin"], requiredPermissions: "system.settings" },
    { href: "/settings", label: "Settings", icon: "ri-settings-4-line" },
  ];

  // Filter items based on enterprise RBAC permissions
  const filteredNavItems = navItems.filter(item => {
    // Always show items with no restrictions
    if (!item.roles && !item.requiredPermissions && !item.requiresApproval) return true;
    
    // If no user, don't show restricted items
    if (!user) return false;
    
    // Check role-based access if specified
    if (item.roles && !hasRole(item.roles)) return false;
    
    // Check enterprise permissions
    if (item.requiredPermissions && !hasPermission(item.requiredPermissions)) return false;
    
    // Check approval permissions if required
    if (item.requiresApproval && !canApprove) return false;
    
    return true;
  });

  return (
    <>
      {/* Mobile menu overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
      
      {/* Mobile menu drawer */}
      <div 
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 transition-all duration-300 ease-in-out transform md:hidden",
          isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none",
          "max-h-[85vh] overflow-y-auto rounded-t-xl shadow-xl"
        )}
      >
        <div className="sticky top-0 z-10 p-4 border-b border-gray-200 flex justify-between items-center bg-white">
          <h2 className="font-bold text-lg">Menu</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
            aria-label="Close menu"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        
        <div className="p-3">
          <nav className={cn("grid gap-3", getGridCols())}>
            {filteredNavItems.map((item, index) => (
              <Link 
                key={index} 
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex flex-col items-center p-3 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors duration-200 active:scale-95 touch-manipulation",
                  location === item.href && "active bg-primary/10 border-b-2 md:border-b-4 border-primary"
                )}
              >
                <i className={`${item.icon} text-xl mb-1 ${location === item.href ? 'text-primary' : ''}`}></i>
                <span className="text-[10px] sm:text-xs font-medium text-center leading-tight">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        
        {user && (
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                {user?.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || "User"} 
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <i className="ri-user-line text-gray-500"></i>
                )}
              </div>
              <div className="ml-3 min-w-0">
                <p className="font-medium text-sm truncate">{user?.displayName || "User"}</p>
                <p className="text-xs text-gray-500 truncate">{user?.role === "master_admin" ? "Master Admin" : user?.role === "admin" ? "Admin" : "Employee"}</p>
              </div>
              <button 
                onClick={() => {
                  import("@/lib/firebase").then(({ logoutUser }) => {
                    logoutUser().then(() => {
                      window.location.href = "/login";
                    });
                  });
                }} 
                className="ml-auto text-gray-500 hover:text-gray-700 cursor-pointer"
                aria-label="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
