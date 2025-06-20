import { useState, useRef, useEffect } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Camera, MapPin, Clock, AlertTriangle, CheckCircle, XCircle, 
  Loader2, Timer, Zap, Wifi, WifiOff, RefreshCw
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { formatTimeString, formatTime } from "@/lib/utils";

interface SmartAttendanceCheckOutProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAttendance: any;
  departmentTiming?: any;
}

interface CheckoutTimeStatus {
  isEarly: boolean;
  isLate: boolean;
  lateMinutes: number;
  earlyMinutes: number;
  showOTButton: boolean;
  autoCheckoutTime: Date;
  expectedCheckOutTime: Date;
  canEnableOvertime: boolean;
}

export function SmartAttendanceCheckOut({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentAttendance, 
  departmentTiming 
}: SmartAttendanceCheckOutProps) {
  const { user } = useAuthContext();
  const { location, error: locationError, isLoading: locationLoading, getCurrentLocation } = useGeolocation();
  const { toast } = useToast();

  // Form states
  const [reason, setReason] = useState("");
  const [otReason, setOtReason] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOvertimeCheckout, setIsOvertimeCheckout] = useState(false);
  const [timeStatus, setTimeStatus] = useState<CheckoutTimeStatus | null>(null);
  const [showOvertimeConfirmation, setShowOvertimeConfirmation] = useState(false);
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);
  const [enableOvertimeMutation, setEnableOvertimeMutation] = useState(false);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Network status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Calculate checkout time status
  const calculateCheckoutStatus = (): CheckoutTimeStatus => {
    if (!currentAttendance?.checkInTime || !departmentTiming) {
      return { 
        isEarly: false,
        isLate: false, 
        lateMinutes: 0,
        earlyMinutes: 0, 
        showOTButton: false, 
        autoCheckoutTime: new Date(),
        expectedCheckOutTime: new Date(),
        canEnableOvertime: false
      };
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

    const isLate = now > expectedCheckOutTime;
    const isEarly = now < expectedCheckOutTime;
    const lateMinutes = isLate ? Math.floor((now.getTime() - expectedCheckOutTime.getTime()) / (1000 * 60)) : 0;
    const earlyMinutes = isEarly ? Math.floor((expectedCheckOutTime.getTime() - now.getTime()) / (1000 * 60)) : 0;
    
    // Auto-checkout time is 2 hours after expected checkout
    const autoCheckoutTime = new Date(expectedCheckOutTime.getTime() + (2 * 60 * 60 * 1000));

    return {
      isEarly,
      isLate,
      lateMinutes,
      earlyMinutes,
      showOTButton: isLate,
      autoCheckoutTime,
      expectedCheckOutTime,
      canEnableOvertime: isLate && !currentAttendance?.overtimeEnabled
    };
  };

  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      getCurrentLocation();
      setTimeStatus(calculateCheckoutStatus());
      setOvertimeEnabled(currentAttendance?.overtimeEnabled || false);
    }
  }, [isOpen, currentAttendance, departmentTiming]);

  // Handle overtime enablement
  const handleEnableOvertime = async () => {
    if (!currentAttendance?.id) return;

    setEnableOvertimeMutation(true);
    try {
      const response = await apiRequest('POST', `/api/attendance/${currentAttendance.id}/enable-overtime`);
      
      if (response.ok) {
        setOvertimeEnabled(true);
        setShowOvertimeConfirmation(false);
        
        // Update the time status to reflect new auto checkout time
        setTimeStatus(calculateCheckoutStatus());
        
        toast({
          title: "Overtime Enabled",
          description: "Overtime mode activated. Auto checkout disabled until 11:55 PM.",
          variant: "default"
        });
        
        // Refresh the attendance data
        onSuccess();
      } else {
        const errorData = await response.json();
        toast({
          title: "Failed to Enable Overtime",
          description: errorData.message || "Could not enable overtime mode",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error enabling overtime:", error);
      toast({
        title: "Error",
        description: "Failed to enable overtime mode",
        variant: "destructive"
      });
    } finally {
      setEnableOvertimeMutation(false);
    }
  };

  // Real-time countdown update
  useEffect(() => {
    if (!isOpen || !timeStatus?.isLate) return;

    const interval = setInterval(() => {
      setTimeStatus(calculateCheckoutStatus());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [isOpen, timeStatus?.isLate, departmentTiming]);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: 'user'
        },
        audio: false
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      const videoTracks = mediaStream.getVideoTracks();
      
      if (videoTracks.length === 0) {
        throw new Error('No video tracks found in stream');
      }
      
      setStream(mediaStream);
      setIsCameraActive(true);
      
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = null;
        video.load();
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.controls = false;
        video.srcObject = mediaStream;
        
        setTimeout(async () => {
          try {
            await video.play();
          } catch (playError) {
            console.warn('Auto-play failed, but stream should still be visible:', playError);
          }
        }, 100);
      }
    } catch (error) {
      let errorMessage = "Unable to access camera. ";
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += "Please allow camera permissions and try again.";
        } else if (error.name === 'NotFoundError') {
          errorMessage += "No camera found on this device.";
        } else if (error.name === 'NotReadableError') {
          errorMessage += "Camera is being used by another application.";
        } else {
          errorMessage += error.message;
        }
      }
      
      toast({
        title: "Camera Access Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(photoData);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const resetForm = () => {
    setReason("");
    setOtReason("");
    setCapturedPhoto(null);
    setIsOvertimeCheckout(false);
    stopCamera();
  };

  const handleSubmit = async (overtimeMode = false) => {
    if (!user?.uid || !location) return;

    setIsSubmitting(true);
    setIsOvertimeCheckout(overtimeMode);

    try {
      let photoUploadUrl = null;

      // Upload photo if captured (required for overtime)
      if (capturedPhoto) {
        console.log('Uploading checkout photo...');
        const uploadResponse = await apiRequest('POST', '/api/attendance/upload-photo', {
          imageData: capturedPhoto,
          userId: user.uid,
          attendanceType: overtimeMode ? "overtime_checkout" : "checkout"
        });

        if (!uploadResponse.ok) {
          throw new Error('Photo upload failed. Please try again.');
        }

        const uploadData = await uploadResponse.json();
        photoUploadUrl = uploadData.url;
        console.log('Photo uploaded successfully:', photoUploadUrl);
      }

      // Validate OT requirements
      if (overtimeMode) {
        if (!otReason.trim()) {
          throw new Error('Overtime reason is required');
        }
        if (!photoUploadUrl) {
          throw new Error('Photo is required for overtime verification');
        }
      }

      const response = await apiRequest('POST', '/api/attendance/check-out', {
        userId: user.uid,
        latitude: location.latitude,
        longitude: location.longitude,
        imageUrl: photoUploadUrl,
        reason,
        otReason: overtimeMode ? otReason : undefined,
        isOvertimeCheckout: overtimeMode
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check out');
      }

      const result = await response.json();
      
      toast({
        title: "Check-out Successful",
        description: result.message,
        variant: "default",
      });

      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: "Check-out Failed",
        description: error.message || 'An unexpected error occurred',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Smart Check Out
          </DialogTitle>
          <DialogDescription>
            Complete your attendance check-out. 
            {timeStatus?.isLate && (
              <span className="text-amber-600 font-medium">
                You are {timeStatus.lateMinutes} minutes late.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Late checkout notification with countdown */}
          {timeStatus?.isLate && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium text-amber-800">
                    Late Checkout Detected ({timeStatus.lateMinutes} minutes)
                  </div>
                  <div className="text-sm text-amber-700">
                    Expected checkout: {departmentTiming?.checkOutTime || '18:00'}
                  </div>
                  <div className="text-xs text-amber-600">
                    Auto-checkout in: {Math.max(0, Math.floor((timeStatus.autoCheckoutTime.getTime() - new Date().getTime()) / (1000 * 60)))} minutes
                  </div>
                  <div className="text-xs text-blue-600 mt-2">
                    Choose "Check Out" for normal checkout or "OT" to claim overtime hours.
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Location Status */}
          {location && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">
                    Location: {location.accuracy.toFixed(0)}m accuracy
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* General Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Remarks (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add any comments about your work session"
              rows={3}
            />
          </div>

          {/* Overtime section (only when OT button clicked) */}
          {isOvertimeCheckout && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-800">Overtime Verification Required</h3>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="otReason">Overtime Reason *</Label>
                      <Textarea
                        id="otReason"
                        placeholder="Explain why you worked overtime today..."
                        value={otReason}
                        onChange={(e) => setOtReason(e.target.value)}
                        rows={3}
                        required
                      />
                    </div>
                    
                    <div>
                      <Label>Photo Verification *</Label>
                      <p className="text-sm text-blue-700 mb-3">
                        Photo is mandatory for overtime verification.
                      </p>
                      
                      {!capturedPhoto && !isCameraActive && (
                        <Button onClick={startCamera} variant="outline" className="w-full">
                          <Camera className="h-4 w-4 mr-2" />
                          Take Overtime Verification Photo
                        </Button>
                      )}

                      {isCameraActive && (
                        <div className="space-y-2">
                          <div className="relative bg-black rounded border overflow-hidden">
                            <video 
                              ref={videoRef} 
                              autoPlay 
                              playsInline
                              muted
                              className="w-full h-64 object-cover"
                              style={{ 
                                transform: 'scaleX(-1)',
                                minHeight: '16rem',
                                backgroundColor: '#000'
                              }}
                            />
                            <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                              LIVE - OT VERIFICATION
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={capturePhoto} className="flex-1">
                              <Camera className="h-4 w-4 mr-2" />
                              Capture Photo
                            </Button>
                            <Button onClick={stopCamera} variant="outline">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {capturedPhoto && (
                        <div className="space-y-2">
                          <img 
                            src={capturedPhoto} 
                            alt="Overtime verification photo" 
                            className="w-full rounded border" 
                          />
                          <Button 
                            onClick={() => {
                              setCapturedPhoto(null);
                              startCamera();
                            }} 
                            variant="outline" 
                            className="w-full"
                          >
                            Retake Photo
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error Display */}
          {locationError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Location Error: {locationError.message}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          
          {/* Smart checkout buttons */}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || !location || !isOnline}
              className="flex-1 sm:flex-none"
              variant={timeStatus?.showOTButton ? "outline" : "default"}
            >
              {isSubmitting && !isOvertimeCheckout ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking out...
                </>
              ) : (
                <>
                  <Timer className="mr-2 h-4 w-4" />
                  Check Out
                </>
              )}
            </Button>
            
            {/* OT Button appears when late */}
            {timeStatus?.showOTButton && (
              <Button
                onClick={() => {
                  setIsOvertimeCheckout(true);
                  if (!isOvertimeCheckout) {
                    // Just toggle to show OT form, don't submit yet
                    return;
                  }
                  handleSubmit(true);
                }}
                disabled={isSubmitting || !location || !isOnline}
                className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700"
              >
                {isSubmitting && isOvertimeCheckout ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing OT...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    OT
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* Submit OT button (appears after OT form is filled) */}
          {isOvertimeCheckout && !isSubmitting && (
            <Button
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting || !location || !isOnline || !otReason.trim() || !capturedPhoto}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              <Zap className="mr-2 h-4 w-4" />
              Submit Overtime Checkout
            </Button>
          )}
        </DialogFooter>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>

      {/* Overtime Confirmation Dialog */}
      <Dialog open={showOvertimeConfirmation} onOpenChange={setShowOvertimeConfirmation}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              Enable Overtime Mode
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-sm text-orange-800">
                Are you sure you want to enable overtime mode?
              </p>
              <ul className="mt-2 text-xs text-orange-700 space-y-1">
                <li>• Auto checkout will be disabled until 11:55 PM</li>
                <li>• You'll need to manually check out when done</li>
                <li>• Photo verification required for overtime checkout</li>
                <li>• Overtime hours will be calculated for payroll</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowOvertimeConfirmation(false)}
              disabled={enableOvertimeMutation}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnableOvertime}
              disabled={enableOvertimeMutation}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {enableOvertimeMutation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                <>
                  <Zap className="mr-2 h-4 w-4" />
                  Yes, Enable OT
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}