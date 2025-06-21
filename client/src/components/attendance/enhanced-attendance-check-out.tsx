import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Camera, Clock, Timer, Loader2, AlertTriangle, CheckCircle, Upload, Zap, MapPin } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface EnhancedCheckOutProps {
  onSuccess: () => void;
  onClose: () => void;
  isOpen: boolean;
  todayAttendance: any;
  departmentTiming: any;
}

export function EnhancedAttendanceCheckOut({ onSuccess, onClose, isOpen, todayAttendance, departmentTiming }: EnhancedCheckOutProps) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State management
  const [step, setStep] = useState<"detection" | "early_checkout" | "overtime_option" | "overtime_confirmation" | "capture" | "processing">("detection");
  const [isEarlyCheckOut, setIsEarlyCheckOut] = useState(false);
  const [earlyCheckOutMinutes, setEarlyCheckOutMinutes] = useState(0);
  const [canRequestOvertime, setCanRequestOvertime] = useState(false);
  const [showOvertimeOption, setShowOvertimeOption] = useState(false);
  const [isOvertimeCheckout, setIsOvertimeCheckout] = useState(false);
  const [showOvertimeConfirmation, setShowOvertimeConfirmation] = useState(false);
  const [reason, setReason] = useState("");
  const [otReason, setOtReason] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Check overtime eligibility
  const { data: overtimeEligible } = useQuery({
    queryKey: ["/api/attendance/overtime-eligible", todayAttendance?.id],
    queryFn: async () => {
      if (!todayAttendance?.id) return false;
      const response = await apiRequest('GET', `/api/attendance/${todayAttendance.id}/overtime-eligible`);
      if (response.ok) {
        return await response.json();
      }
      return false;
    },
    enabled: !!todayAttendance?.id && isOpen,
  });

  // Initialize checkout detection when modal opens
  useEffect(() => {
    if (isOpen && departmentTiming) {
      performCheckoutDetection();
      getCurrentLocation();
    }
  }, [isOpen, departmentTiming]);

  const performCheckoutDetection = () => {
    if (!departmentTiming?.checkOutTime) {
      setStep("processing");
      return;
    }

    const now = new Date();
    const [checkOutHour, checkOutMinute] = departmentTiming.checkOutTime.split(':').map(Number);
    
    const expectedCheckOutTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      checkOutHour,
      checkOutMinute
    );

    const isEarly = now < expectedCheckOutTime;
    const minutesEarly = isEarly ? Math.floor((expectedCheckOutTime.getTime() - now.getTime()) / (1000 * 60)) : 0;
    
    setIsEarlyCheckOut(isEarly);
    setEarlyCheckOutMinutes(minutesEarly);

    // Check if user can request overtime (after expected checkout time)
    const canOT = now >= expectedCheckOutTime;
    setCanRequestOvertime(canOT);

    if (isEarly) {
      setStep("early_checkout");
    } else if (canOT) {
      setStep("overtime_option");
    } else {
      setStep("processing");
    }
  };

  // Get current location
  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);

    try {
      if (!navigator.geolocation) {
        throw new Error("Geolocation is not supported");
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        });
      });

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
    } catch (error: any) {
      console.error("Location error:", error);
      // Continue without location if not available
      setLocation({ latitude: 0, longitude: 0 });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Handle image capture/upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload image to Cloudinary
  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'attendance_images');

    const response = await fetch(
      'https://api.cloudinary.com/v1_1/your-cloud-name/image/upload',
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }

    const data = await response.json();
    return data.secure_url;
  };

  // Enable overtime mutation
  const enableOvertimeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/attendance/${todayAttendance.id}/enable-overtime`, 'POST');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to enable overtime');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Overtime Enabled",
        description: data.message,
        variant: "default"
      });
      setIsOvertimeCheckout(true);
      setStep("capture");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Enhanced check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!location) {
        throw new Error("Location is required");
      }

      let imageUrl = "";
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const response = await apiRequest('/api/attendance/enhanced-check-out', 'POST', {
        attendanceId: todayAttendance.id,
        latitude: location.latitude.toString(),
        longitude: location.longitude.toString(),
        reason: isEarlyCheckOut ? reason : undefined,
        imageUrl,
        isOvertimeCheckout,
        otReason: isOvertimeCheckout ? otReason : undefined,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Check-out failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Check-out Successful",
        description: data.message,
        variant: "default"
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
      
      onSuccess();
      onClose();
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Check-out Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setStep("detection");
    setIsEarlyCheckOut(false);
    setEarlyCheckOutMinutes(0);
    setCanRequestOvertime(false);
    setShowOvertimeOption(false);
    setIsOvertimeCheckout(false);
    setShowOvertimeConfirmation(false);
    setReason("");
    setOtReason("");
    setImageFile(null);
    setImagePreview("");
    setLocation(null);
  };

  const handleClose = () => {
    if (!checkOutMutation.isPending && !enableOvertimeMutation.isPending) {
      resetForm();
      onClose();
    }
  };

  const canProceedToCheckOut = () => {
    if (!location) return false;
    if (isEarlyCheckOut && reason.trim().length === 0) return false;
    if (isOvertimeCheckout && otReason.trim().length === 0) return false;
    return true;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-red-600" />
              Enhanced Check-Out
              {isEarlyCheckOut && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Early Checkout Detected
                </Badge>
              )}
              {isOvertimeCheckout && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  Overtime Mode
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {step === "detection" && "Analyzing checkout timing..."}
              {step === "early_checkout" && "Early checkout detected - reason required"}
              {step === "overtime_option" && "You can request overtime or proceed with regular checkout"}
              {step === "capture" && "Capture details for checkout"}
              {step === "processing" && "Processing your checkout..."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Early Checkout Detection */}
            {step === "early_checkout" && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-800">
                    <AlertTriangle className="h-5 w-5" />
                    Early Check-out Detected
                  </CardTitle>
                  <CardDescription className="text-yellow-700">
                    You are checking out {earlyCheckOutMinutes} minutes before your scheduled time of{" "}
                    {departmentTiming?.checkOutTime}. Please provide a reason.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <span className="font-medium">Expected Check-out:</span>
                      <div className="text-yellow-700">{departmentTiming?.checkOutTime}</div>
                    </div>
                    <div>
                      <span className="font-medium">Current Time:</span>
                      <div className="text-yellow-700">{new Date().toLocaleTimeString('en-IN', { 
                        hour: '2-digit', 
                        minute: '2-digit', 
                        hour12: true 
                      })}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="early-reason">Reason for Early Check-out *</Label>
                    <Textarea
                      id="early-reason"
                      placeholder="Please explain why you are checking out early..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                    />
                    <Button 
                      onClick={() => setStep("processing")} 
                      disabled={reason.trim().length === 0}
                      className="w-full"
                    >
                      Continue with Early Check-out
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Overtime Option */}
            {step === "overtime_option" && (
              <div className="space-y-4">
                <Card className="border-orange-200 bg-orange-50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-800">
                      <Zap className="h-5 w-5" />
                      Overtime Available
                    </CardTitle>
                    <CardDescription className="text-orange-700">
                      You're checking out after {departmentTiming?.checkOutTime}. You can request overtime or proceed with regular checkout.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="font-medium">Scheduled End:</span>
                        <div className="text-orange-700">{departmentTiming?.checkOutTime}</div>
                      </div>
                      <div>
                        <span className="font-medium">Current Time:</span>
                        <div className="text-orange-700">{new Date().toLocaleTimeString('en-IN', { 
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: true 
                        })}</div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Button 
                        onClick={() => setShowOvertimeConfirmation(true)}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                      >
                        <Zap className="h-4 w-4 mr-2" />
                        Request Overtime
                      </Button>
                      <Button 
                        onClick={() => setStep("processing")} 
                        variant="outline"
                        className="w-full"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Regular Check-out (No Overtime)
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Capture Details */}
            {step === "capture" && (
              <div className="space-y-4">
                {isOvertimeCheckout && (
                  <div>
                    <Label htmlFor="ot-reason">Overtime Work Description *</Label>
                    <Textarea
                      id="ot-reason"
                      placeholder="Describe the overtime work you performed..."
                      value={otReason}
                      onChange={(e) => setOtReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="image">Photo (Optional)</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {imagePreview ? (
                      <div className="space-y-2">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="mx-auto max-h-32 rounded"
                        />
                        <Button variant="outline" onClick={() => {
                          setImageFile(null);
                          setImagePreview("");
                        }}>
                          Change Photo
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Camera className="h-8 w-8 mx-auto text-gray-400" />
                        <div className="text-sm text-gray-600">
                          Optional: Capture workplace photo
                        </div>
                        <Input
                          id="image"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <Button 
                          variant="outline" 
                          onClick={() => document.getElementById('image')?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Select Photo
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={() => setStep("processing")} 
                  disabled={!canProceedToCheckOut()}
                  className="w-full"
                >
                  Complete Check-out
                </Button>
              </div>
            )}

            {/* Processing Step */}
            {step === "processing" && (
              <div className="space-y-4">
                {isLoadingLocation && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center space-y-2">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        <div className="text-sm text-gray-600">Getting location...</div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {location && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center space-y-4">
                        <div className="text-lg font-semibold">Ready to Check-out</div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div>Time: {new Date().toLocaleTimeString('en-IN', { 
                            hour: '2-digit', 
                            minute: '2-digit', 
                            hour12: true 
                          })}</div>
                          {isEarlyCheckOut && (
                            <div className="text-yellow-600">
                              Early check-out ({earlyCheckOutMinutes} minutes early)
                            </div>
                          )}
                          {isOvertimeCheckout && (
                            <div className="text-orange-600">
                              Overtime check-out
                            </div>
                          )}
                        </div>
                        
                        <Button 
                          onClick={() => checkOutMutation.mutate()}
                          disabled={checkOutMutation.isPending}
                          className="w-full"
                        >
                          {checkOutMutation.isPending ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing Check-out...
                            </>
                          ) : (
                            <>
                              <Timer className="h-4 w-4 mr-2" />
                              Complete Check-out
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Overtime Confirmation Dialog */}
      <AlertDialog open={showOvertimeConfirmation} onOpenChange={setShowOvertimeConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-600" />
              Enable Overtime?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to request overtime? This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Disable the 2-hour auto-checkout buffer</li>
                <li>Set final auto-checkout at 11:55 PM</li>
                <li>Require overtime work description</li>
                <li>Count hours beyond {departmentTiming?.checkOutTime} as overtime</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowOvertimeConfirmation(false);
                enableOvertimeMutation.mutate();
              }}
              disabled={enableOvertimeMutation.isPending}
            >
              {enableOvertimeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enabling...
                </>
              ) : (
                "Yes, Enable Overtime"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}