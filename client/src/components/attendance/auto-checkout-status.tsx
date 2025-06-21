import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Clock, Timer, AlertTriangle, CheckCircle } from "lucide-react";
import { format, addHours } from "date-fns";

interface AutoCheckoutStatusProps {
  attendanceRecord?: any;
  departmentCheckoutTime?: string;
}

export function AutoCheckoutStatus({ attendanceRecord, departmentCheckoutTime = "19:00" }: AutoCheckoutStatusProps) {
  if (!attendanceRecord || attendanceRecord.checkOutTime) {
    return null; // Don't show if not checked in or already checked out
  }

  const isOvertimeRequested = attendanceRecord.overtimeRequested;
  const checkInTime = new Date(attendanceRecord.checkInTime);
  
  // Calculate department checkout time for today
  const [hour, minute] = departmentCheckoutTime.split(':').map(Number);
  const deptCheckoutTime = new Date(checkInTime);
  deptCheckoutTime.setHours(hour, minute, 0, 0);
  
  // Calculate auto-checkout time (2 hours after department checkout)
  const autoCheckoutTime = addHours(deptCheckoutTime, 2);
  
  // Current time
  const now = new Date();
  
  // Time until auto-checkout
  const timeUntilAutoCheckout = autoCheckoutTime.getTime() - now.getTime();
  const minutesUntilAutoCheckout = Math.floor(timeUntilAutoCheckout / (1000 * 60));
  const hoursUntilAutoCheckout = Math.floor(minutesUntilAutoCheckout / 60);
  
  // Emergency auto-checkout time (11:55 PM)
  const emergencyCheckoutTime = new Date(checkInTime);
  emergencyCheckoutTime.setHours(23, 55, 0, 0);
  
  const timeUntilEmergencyCheckout = emergencyCheckoutTime.getTime() - now.getTime();
  const minutesUntilEmergencyCheckout = Math.floor(timeUntilEmergencyCheckout / (1000 * 60));

  const getAutoCheckoutStatus = () => {
    if (isOvertimeRequested) {
      return {
        status: "overtime_active",
        message: "Auto-checkout cancelled - Overtime active",
        description: "You requested overtime. System will auto-checkout at 11:55 PM if you forget to checkout manually.",
        variant: "orange" as const,
        icon: Timer,
        timeInfo: `Emergency auto-checkout: ${format(emergencyCheckoutTime, 'h:mm a')}`
      };
    }
    
    if (now > deptCheckoutTime && timeUntilAutoCheckout > 0) {
      return {
        status: "auto_checkout_pending",
        message: "Auto-checkout scheduled",
        description: `System will automatically checkout in ${hoursUntilAutoCheckout}h ${minutesUntilAutoCheckout % 60}m if you don't checkout manually.`,
        variant: "yellow" as const,
        icon: Clock,
        timeInfo: `Auto-checkout at: ${format(autoCheckoutTime, 'h:mm a')}`
      };
    }
    
    if (now < deptCheckoutTime) {
      return {
        status: "normal_hours",
        message: "Normal working hours",
        description: `Auto-checkout will be scheduled after ${departmentCheckoutTime} if you don't checkout on time.`,
        variant: "green" as const,
        icon: CheckCircle,
        timeInfo: `Department checkout: ${format(deptCheckoutTime, 'h:mm a')}`
      };
    }
    
    return {
      status: "overdue",
      message: "Checkout overdue",
      description: "Please checkout now. Auto-checkout has already occurred or will occur soon.",
      variant: "red" as const,
      icon: AlertTriangle,
      timeInfo: "Immediate checkout recommended"
    };
  };

  const statusInfo = getAutoCheckoutStatus();

  const getBorderColor = (variant: string) => {
    switch (variant) {
      case "orange": return "border-orange-200 bg-orange-50";
      case "yellow": return "border-yellow-200 bg-yellow-50";
      case "green": return "border-green-200 bg-green-50";
      case "red": return "border-red-200 bg-red-50";
      default: return "border-gray-200 bg-gray-50";
    }
  };

  const getTextColor = (variant: string) => {
    switch (variant) {
      case "orange": return "text-orange-800";
      case "yellow": return "text-yellow-800";
      case "green": return "text-green-800";
      case "red": return "text-red-800";
      default: return "text-gray-800";
    }
  };

  const getIconColor = (variant: string) => {
    switch (variant) {
      case "orange": return "text-orange-600";
      case "yellow": return "text-yellow-600";
      case "green": return "text-green-600";
      case "red": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const StatusIcon = statusInfo.icon;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Auto-Checkout Status
          </div>
          <Badge variant={statusInfo.variant === "green" ? "default" : "destructive"}>
            {statusInfo.status.replace(/_/g, ' ').toUpperCase()}
          </Badge>
        </CardTitle>
        <CardDescription>
          Automatic checkout system monitors your attendance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <Alert className={getBorderColor(statusInfo.variant)}>
          <StatusIcon className={`h-4 w-4 ${getIconColor(statusInfo.variant)}`} />
          <AlertDescription className={getTextColor(statusInfo.variant)}>
            <strong>{statusInfo.message}</strong><br />
            {statusInfo.description}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-600">Check-in Time</div>
            <div className="text-base font-semibold">
              {format(checkInTime, 'h:mm a')}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-sm font-medium text-gray-600">Status Info</div>
            <div className="text-base font-semibold">
              {statusInfo.timeInfo}
            </div>
          </div>
        </div>

        {/* Auto-checkout rules */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Auto-Checkout Rules:</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• System waits 2 hours after department checkout time ({format(deptCheckoutTime, 'h:mm a')})</li>
            <li>• Working hours calculated until department checkout time only</li>
            <li>• Overtime requests cancel the 2-hour auto-checkout timer</li>
            <li>• Emergency auto-checkout occurs at 11:55 PM for forgotten checkouts</li>
            {isOvertimeRequested && (
              <li className="text-orange-600 font-medium">• Overtime active - 2-hour timer cancelled</li>
            )}
          </ul>
        </div>

      </CardContent>
    </Card>
  );
}