import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Leaf } from "lucide-react";

interface MobileSidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function MobileSidebar({ isOpen, setIsOpen }: MobileSidebarProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "ri-dashboard-line" },
    { href: "/customers", label: "Customers", icon: "ri-user-3-line" },
    { href: "/products", label: "Products", icon: "ri-store-2-line" },
    { href: "/quotations", label: "Quotations", icon: "ri-file-list-3-line" },
    { href: "/invoices", label: "Invoices", icon: "ri-bill-line" },
    { href: "/attendance", label: "Attendance", icon: "ri-time-line" },
    { href: "/leave", label: "Leave", icon: "ri-calendar-check-line" },
  ];

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm md:hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl">Prakash Greens</span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="text-gray-700"
        >
          <i className={`${isOpen ? 'ri-close-line' : 'ri-menu-line'} text-2xl`}></i>
        </button>
      </div>
      
      {/* Mobile menu */}
      <div className={cn("bg-white border-t border-gray-200 p-2", !isOpen && "hidden")}>
        <nav className="grid grid-cols-3 gap-2">
          {navItems.map((item, index) => (
            <Link 
              key={index} 
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex flex-col items-center p-3 rounded-md hover:bg-gray-100 text-gray-700",
                location === item.href && "border-b-4 border-primary"
              )}
            >
              <i className={`${item.icon} text-xl ${location === item.href ? 'text-primary' : ''}`}></i>
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
