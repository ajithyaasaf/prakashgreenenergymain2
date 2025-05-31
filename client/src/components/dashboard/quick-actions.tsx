import { Link } from "wouter";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  iconBgColor: string;
  iconColor: string;
  href: string;
  onClick?: () => void;
}

interface QuickActionsProps {
  actions: QuickAction[];
  title?: string;
}

export function QuickActions({ actions, title = "Quick Actions" }: QuickActionsProps) {
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-4 sm:p-5 md:p-6">
        <CardTitle className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">{title}</CardTitle>
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {actions.map((action) => (
            <Link 
              key={action.id} 
              href={action.href}
              onClick={action.onClick}
            >
              <div className="flex flex-col items-center justify-center p-2 sm:p-3 md:p-4 bg-gray-50 hover:bg-gray-100 rounded-lg sm:rounded-xl transition-colors cursor-pointer active:scale-95 touch-manipulation">
                <div className={cn(
                  "h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 rounded-full flex items-center justify-center mb-1 sm:mb-2",
                  action.iconBgColor
                )}>
                  <i className={cn(action.icon, "text-base sm:text-lg md:text-xl", action.iconColor)}></i>
                </div>
                <span className="text-xs sm:text-sm text-gray-700 text-center leading-tight">{action.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
