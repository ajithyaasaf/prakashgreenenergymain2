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
      <CardContent className="p-6">
        <CardTitle className="font-semibold text-lg mb-4">{title}</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {actions.map((action) => (
            <Link 
              key={action.id} 
              href={action.href}
              onClick={action.onClick}
            >
              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">
                <div className={cn(
                  "h-12 w-12 rounded-full flex items-center justify-center mb-2",
                  action.iconBgColor
                )}>
                  <i className={cn(action.icon, "text-xl", action.iconColor)}></i>
                </div>
                <span className="text-sm text-gray-700">{action.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
