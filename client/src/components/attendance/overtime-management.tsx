import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, Timer, AlertTriangle, CheckCircle, Zap, Calendar } from "lucide-react";
import { format } from "date-fns";

interface OvertimeManagementProps {
  attendanceRecord?: any;
  onOvertimeRequested?: () => void;
}

export function OvertimeManagement({ attendanceRecord, onOvertimeRequested }: OvertimeManagementProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Get current attendance status
  const { data: todayAttendance, isLoading } = useQuery({
    queryKey: ['/api/attendance/today', user?.uid],
    enabled: !!user?.uid
  });

  // Request overtime mutation
  const requestOvertimeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/attendance/request-overtime', {});
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to request overtime');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Overtime Requested",
        description: data.message,
        variant: "default",
      });
      
      // Invalidate attendance queries
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          if (typeof queryKey === 'string') {
            return queryKey.includes('/api/attendance');
          }
          return false;
        }
      });
      
      setIsDialogOpen(false);
      onOvertimeRequested?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Overtime Request Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const currentTime = new Date();
  const attendance = attendanceRecord || todayAttendance;

  // Early login detection
  const isEarlyLogin = attendance?.isEarlyLogin;
  const earlyLoginMinutes = attendance?.earlyLoginMinutes || 0;

  // Overtime status
  const overtimeRequested = attendance?.overtimeRequested;
  const overtimeStartTime = attendance?.overtimeStartTime;
  const overtimeEndTime = attendance?.overtimeEndTime;

  // Calculate current overtime hours if active
  const calculateCurrentOvertimeHours = () => {
    if (!overtimeRequested || !overtimeStartTime) return 0;
    
    const startTime = new Date(overtimeStartTime);
    const endTime = overtimeEndTime ? new Date(overtimeEndTime) : currentTime;
    const diffMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    return Math.max(0, diffMinutes / 60);
  };

  const currentOvertimeHours = calculateCurrentOvertimeHours();

  // Department timing logic (simplified for frontend)
  const getDepartmentCheckoutTime = () => {
    const department = user?.department;
    const timings = {
      operations: '18:00',
      admin: '17:30',
      hr: '17:30',
      marketing: '17:30',
      sales: '18:00',
      technical: '18:00',
      housekeeping: '17:00'
    };
    return timings[department as keyof typeof timings] || '18:00';
  };

  const canRequestOvertime = () => {
    if (!attendance || attendance.checkOutTime) return false;
    if (overtimeRequested) return false;
    
    const checkoutTime = getDepartmentCheckoutTime();
    const [hour, minute] = checkoutTime.split(':').map(Number);
    const expectedCheckout = new Date();
    expectedCheckout.setHours(hour, minute, 0, 0);
    
    return currentTime >= expectedCheckout;
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Overtime Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2">Loading attendance data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Overtime Management
          </div>
          {overtimeRequested && (
            <Badge variant="default" className="bg-orange-500 text-white">
              <Zap className="h-3 w-3 mr-1" />
              Active OT
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Manage overtime requests and early login detection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Early Login Detection */}
        {isEarlyLogin && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Early Login Detected!</strong><br />
              You logged in {earlyLoginMinutes} minutes before your department's start time.
              You're eligible for overtime if you work past your scheduled checkout time.
            </AlertDescription>
          </Alert>
        )}

        {/* Current Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-600">Check-in Time</div>
            <div className="text-lg font-semibold">
              {attendance?.checkInTime ? format(new Date(attendance.checkInTime), 'HH:mm') : 'Not checked in'}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-600">Expected Checkout</div>
            <div className="text-lg font-semibold">
              {getDepartmentCheckoutTime()}
            </div>
          </div>
        </div>

        <Separator />

        {/* Overtime Status */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Overtime Status</h3>
            {overtimeRequested ? (
              <Badge variant="default" className="bg-green-500 text-white">
                <CheckCircle className="h-3 w-3 mr-1" />
                Approved
              </Badge>
            ) : (
              <Badge variant="outline">Not Requested</Badge>
            )}
          </div>

          {overtimeRequested ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-600">OT Start Time</div>
                  <div className="text-base font-semibold">
                    {overtimeStartTime ? format(new Date(overtimeStartTime), 'HH:mm') : '-'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-600">Current OT Hours</div>
                  <div className="text-base font-semibold text-orange-600">
                    {currentOvertimeHours.toFixed(1)}h
                  </div>
                </div>
              </div>
              
              <Alert className="border-orange-200 bg-orange-50">
                <Clock className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Overtime Active</strong><br />
                  • 2-hour auto-checkout has been cancelled<br />
                  • Manual checkout required when work is complete<br />
                  • Emergency auto-checkout will occur at 11:55 PM if you forget<br />
                  • Working hours will be calculated until {getDepartmentCheckoutTime()} for auto-checkout
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Request overtime to continue working past your scheduled checkout time.
                This will disable auto-checkout and allow you to work extended hours.
              </p>
              
              {canRequestOvertime() ? (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full" variant="default">
                      <Timer className="h-4 w-4 mr-2" />
                      Request Overtime
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Request Overtime</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          Requesting overtime will:
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Cancel the 2-hour auto-checkout timer</li>
                            <li>Start overtime tracking from {getDepartmentCheckoutTime()}</li>
                            <li>Require manual checkout when work is complete</li>
                            <li>Track overtime hours for payroll processing</li>
                            <li>If you forget to checkout, system will auto-checkout at 11:55 PM with department checkout time</li>
                          </ul>
                        </AlertDescription>
                      </Alert>
                      
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setIsDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          onClick={() => requestOvertimeMutation.mutate()}
                          disabled={requestOvertimeMutation.isPending}
                        >
                          {requestOvertimeMutation.isPending ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Requesting...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Confirm Request
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Alert className="border-gray-200 bg-gray-50">
                  <Clock className="h-4 w-4 text-gray-600" />
                  <AlertDescription className="text-gray-800">
                    {!attendance ? 
                      'Check in first to request overtime' :
                      attendance.checkOutTime ?
                        'You have already checked out today' :
                        `Overtime can be requested after ${getDepartmentCheckoutTime()}`
                    }
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Early Login Benefits */}
        {isEarlyLogin && (
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-blue-700">Early Login Benefits</h3>
              <div className="text-sm text-blue-600 space-y-1">
                <p>✓ Priority overtime eligibility</p>
                <p>✓ Extended working hours allowed</p>
                <p>✓ Automatic overtime calculation</p>
                <p>✓ Enhanced payroll processing</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}