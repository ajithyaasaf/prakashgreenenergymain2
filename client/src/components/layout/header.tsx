import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { PlusCircle, Bell, Search, Menu } from "lucide-react";
import { CheckInModal } from "@/components/dashboard/check-in-modal";

interface HeaderProps {
  onMenuClick: (e: React.MouseEvent) => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const [location] = useLocation();
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  
  // Map of routes to display names
  const routeTitles: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/customers": "Customers",
    "/products": "Products",
    "/quotations": "Quotations",
    "/invoices": "Invoices",
    "/attendance": "Attendance",
    "/leave": "Leave Management",
    "/user-management": "User Management",
    "/departments": "Departments",
    "/settings": "Settings",
  };

  // Determine the current page title
  const pageTitle = routeTitles[location] || "Dashboard";
  
  // Define option types
  type MenuOptionWithHref = { label: string; href: string; onClick?: undefined };
  type MenuOptionWithAction = { label: string; onClick: () => void; href?: undefined };
  type MenuOption = MenuOptionWithHref | MenuOptionWithAction;

  // New entry options based on current page
  const getNewEntryOptions = (): MenuOption[] => {
    switch (location) {
      case "/customers":
        return [{ label: "New Customer", href: "/customers/new" }];
      case "/products":
        return [{ label: "New Product", href: "/products/new" }];
      case "/quotations":
        return [{ label: "New Quotation", href: "/quotations/new" }];
      case "/invoices":
        return [{ label: "New Invoice", href: "/invoices/new" }];
      case "/attendance":
        return [{ label: "Check In/Out", onClick: () => setShowCheckInModal(true) }];
      case "/leave":
        return [{ label: "Apply Leave", href: "/leave/new" }];
      default:
        return [
          { label: "New Customer", href: "/customers/new" },
          { label: "New Product", href: "/products/new" },
          { label: "New Quotation", href: "/quotations/new" },
          { label: "New Invoice", href: "/invoices/new" }
        ];
    }
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 md:px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Mobile menu button - visible only on mobile */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden" 
              onClick={onMenuClick}
              aria-label="Toggle menu"
            >
              <Menu className="h-6 w-6 text-gray-700" />
            </Button>

            <div>
              <h1 className="text-xl md:text-2xl font-bold">{pageTitle}</h1>
              <p className="text-xs md:text-sm text-gray-500">Welcome back, Rajesh!</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input 
                type="text" 
                placeholder="Search..." 
                className="pl-10 pr-4 py-2 w-64" 
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="bg-primary hover:bg-primary-dark text-white px-2 md:px-4">
                  <PlusCircle className="md:mr-2 h-4 w-4" />
                  <span className="hidden md:inline">New Entry</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Create New</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {getNewEntryOptions().map((option, index) => (
                  <DropdownMenuItem 
                    key={index} 
                    onClick={() => {
                      if ('onClick' in option && option.onClick) {
                        option.onClick();
                      } else if ('href' in option && option.href) {
                        window.location.href = option.href;
                      }
                    }}
                  >
                    {option.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="relative">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5 text-gray-600" />
                <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full"></span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <CheckInModal open={showCheckInModal} onOpenChange={setShowCheckInModal} />
    </>
  );
}
