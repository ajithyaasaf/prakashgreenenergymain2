import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/contexts/auth-context";
import { Leaf, LogOut } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: ("master_admin" | "admin" | "employee")[];
  departments?: ("cre" | "accounts" | "hr" | "sales_and_marketing" | "technical_team")[];
  permission?: string;
}

export function Sidebar() {
  const [location] = useLocation();
  const { user, hasPermission, isDepartmentMember } = useAuthContext();
  
  // Import permissions hook
  const permissions = (() => {
    try {
      const { Permission } = require("@/hooks/use-permissions");
      return Permission;
    } catch {
      return {};
    }
  })();

  // Define navigation items with role-based and department-based visibility
  const navItems: NavItem[] = [
    { 
      href: "/dashboard", 
      label: "Dashboard", 
      icon: <i className="ri-dashboard-line mr-3 text-xl"></i>
    },
    { 
      href: "/customers", 
      label: "Customers", 
      icon: <i className="ri-user-3-line mr-3 text-xl"></i>,
      permission: "manage_customers",
      departments: ["sales_and_marketing"]
    },
    { 
      href: "/products", 
      label: "Products", 
      icon: <i className="ri-store-2-line mr-3 text-xl"></i>,
      permission: "manage_products",
      departments: ["technical_team"]
    },
    { 
      href: "/quotations", 
      label: "Quotations", 
      icon: <i className="ri-file-list-3-line mr-3 text-xl"></i>,
      permission: "manage_quotations",
      departments: ["sales_and_marketing"]
    },
    { 
      href: "/invoices", 
      label: "Invoices", 
      icon: <i className="ri-bill-line mr-3 text-xl"></i>,
      permission: "manage_invoices",
      departments: ["accounts"]
    },
    { 
      href: "/attendance", 
      label: "Attendance", 
      icon: <i className="ri-time-line mr-3 text-xl"></i>,
      permission: "manage_attendance",
      departments: ["hr"]
    },
    { 
      href: "/leave", 
      label: "Leave Management", 
      icon: <i className="ri-calendar-check-line mr-3 text-xl"></i>,
      permission: "manage_leaves",
      departments: ["hr"]
    },
    { 
      href: "/user-management", 
      label: "User Management", 
      icon: <i className="ri-user-settings-line mr-3 text-xl"></i>,
      roles: ["master_admin", "admin"],
      permission: "manage_access"
    },
    { 
      href: "/departments", 
      label: "Departments", 
      icon: <i className="ri-building-line mr-3 text-xl"></i>,
      roles: ["master_admin"],
      permission: "manage_departments"
    },
    { 
      href: "/settings", 
      label: "Settings", 
      icon: <i className="ri-settings-4-line mr-3 text-xl"></i>
    },
  ];

  // Filter items based on user role, department, and permissions
  const filteredNavItems = navItems.filter(item => {
    // Always show items with no restrictions
    if (!item.roles && !item.departments && !item.permission) return true;
    
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
    <aside className="hidden md:flex md:w-64 flex-col bg-white border-r border-gray-200 h-full">
      <div className="p-4 border-b border-gray-200 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl">Prakash Greens</span>
        </div>
      </div>
      <div className="overflow-y-auto flex-grow p-2">
        <nav className="space-y-1">
          {filteredNavItems.map((item, index) => (
            <Link 
              key={index} 
              href={item.href}
              className={cn(
                "sidebar-item flex items-center px-4 py-3 rounded-md hover:bg-gray-100 text-gray-700",
                location === item.href && "active border-l-4 border-primary bg-primary/10"
              )}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
            {user?.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || "User"} 
                className="h-10 w-10 rounded-full"
              />
            ) : (
              <i className="ri-user-line text-gray-500"></i>
            )}
          </div>
          <div className="ml-3">
            <p className="font-medium text-sm">{user?.displayName || "User"}</p>
            <p className="text-xs text-gray-500">{user?.role === "master_admin" ? "Master Admin" : user?.role === "admin" ? "Admin" : "Employee"}</p>
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
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
