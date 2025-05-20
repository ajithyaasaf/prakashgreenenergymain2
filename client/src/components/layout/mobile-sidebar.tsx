import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import { useAuthContext } from "@/contexts/auth-context";
import { useEffect, useState } from "react";

interface MobileSidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function MobileSidebar({ isOpen, setIsOpen }: MobileSidebarProps) {
  const [location] = useLocation();
  const { user } = useAuthContext();
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
    roles?: ("master_admin" | "admin" | "employee")[];
    departments?: ("cre" | "accounts" | "hr" | "sales_and_marketing" | "technical_team")[];
    permission?: string;
  }

  const navItems: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "ri-dashboard-line" },
    { href: "/customers", label: "Customers", icon: "ri-user-3-line", departments: ["sales_and_marketing"] },
    { href: "/products", label: "Products", icon: "ri-store-2-line", departments: ["technical_team"] },
    { href: "/quotations", label: "Quotations", icon: "ri-file-list-3-line", departments: ["sales_and_marketing"] },
    { href: "/invoices", label: "Invoices", icon: "ri-bill-line", departments: ["accounts"] },
    { href: "/attendance", label: "Attendance", icon: "ri-time-line", departments: ["hr"] },
    { href: "/leave", label: "Leave", icon: "ri-calendar-check-line", departments: ["hr"] },
    { href: "/user-management", label: "Users", icon: "ri-user-settings-line", roles: ["master_admin", "admin"] },
    { href: "/departments", label: "Departments", icon: "ri-building-line", roles: ["master_admin"] },
    { href: "/office-locations", label: "Offices", icon: "ri-map-pin-line", roles: ["master_admin"] },
    { href: "/settings", label: "Settings", icon: "ri-settings-4-line" },
  ];

  // Filter items based on user role and department
  const filteredNavItems = navItems.filter(item => {
    // Always show items with no restrictions
    if (!item.roles && !item.departments) return true;
    
    // If no user, don't show restricted items
    if (!user) return false;
    
    // Check role-based access
    if (item.roles && !item.roles.includes(user.role)) return false;
    
    // Master admin can access everything
    if (user.role === "master_admin") return true;
    
    // Check department-based access for employees
    if (item.departments && user.department) {
      if (!item.departments.includes(user.department)) {
        // Department doesn't match and user is an employee
        if (user.role === "employee") return false;
      }
    }
    
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
          "max-h-[80vh] overflow-y-auto rounded-t-xl shadow-xl"
        )}
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="font-bold text-lg">Menu</h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close menu"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        
        <div className="p-3">
          <nav className={cn("grid gap-2", getGridCols())}>
            {filteredNavItems.map((item, index) => (
              <Link 
                key={index} 
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex flex-col items-center p-3 rounded-md hover:bg-gray-100 text-gray-700 transition-colors duration-200",
                  location === item.href && "active bg-primary/10 border-b-4 border-primary"
                )}
              >
                <i className={`${item.icon} text-xl ${location === item.href ? 'text-primary' : ''}`}></i>
                <span className="text-xs mt-1 text-center">{item.label}</span>
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
