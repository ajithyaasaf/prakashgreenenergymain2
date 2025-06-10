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

interface AttendanceCheckOutProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAttendance: any;
  departmentTiming?: any;
}

// Default office coordinates
const DEFAULT_OFFICE = {
  latitude: 9.966844592415782,
  longitude: 78.1338405791111,
  radius: 100
};

export function AttendanceCheckOut({ 
  isOpen, 
  onClose, 
  onSuccess, 
  currentAttendance, 
  departmentTiming 
}: AttendanceCheckOutProps) {
  const { user } = useAuthContext();
  const { location, error: locationError, isLoading: locationLoading, getCurrentLocation, calculateDistance } = useGeolocation();
  const { toast } = useToast();

  // Form states
  const [reason, setReason] = useState("");
  const [otReason, setOtReason] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Network status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Calculate overtime
  const calculateOvertimeInfo = () => {
    if (!currentAttendance?.checkInTime || !departmentTiming) {
      return { hasOvertime: false, overtimeHours: 0, overtimeMinutes: 0 };
    }

    const checkInTime = new Date(currentAttendance.checkInTime);
    const currentTime = new Date();
    const workingMinutes = Math.floor((currentTime.getTime() - checkInTime.getTime()) / (1000 * 60));
    
    const standardWorkingMinutes = (departmentTiming.workingHours || 8) * 60;
    const overtimeThreshold = departmentTiming.overtimeThresholdMinutes || 30;
    
    const potentialOvertimeMinutes = workingMinutes - standardWorkingMinutes;
    const hasOvertime = potentialOvertimeMinutes >= overtimeThreshold;
    
    return {
      hasOvertime,
      overtimeHours: Math.floor(potentialOvertimeMinutes / 60),
      overtimeMinutes: potentialOvertimeMinutes % 60,
      totalWorkingHours: Math.floor(workingMinutes / 60),
      totalWorkingMinutes: workingMinutes % 60
    };
  };

  const overtimeInfo = calculateOvertimeInfo();

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
    }
  }, [isOpen]);

  // Camera functions
  const startCamera = async () => {
    try {
      // Check for camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }
      
      // Enhanced video constraints for better compatibility
      const constraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: 'user' // Front-facing camera
        },
        audio: false
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Check if video tracks are available
      const videoTracks = mediaStream.getVideoTracks();
      if (videoTracks.length === 0) {
        throw new Error('No video tracks found in stream');
      }
      
      setStream(mediaStream);
      setIsCameraActive(true);
      
      if (videoRef.current) {
        const video = videoRef.current;
        
        // Clear any existing content and reset state
        video.srcObject = null;
        video.load();
        
        // Set essential video properties
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.controls = false;
        
        // Assign the stream
        video.srcObject = mediaStream;
        
        // Force play
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
    stopCamera();
  };

  const validateForm = (): string | null => {
    if (!location) return "Location access is required for check-out";
    if (!isOnline) return "Internet connection is required";
    
    // Check for early checkout (before 6:30 PM)
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const expectedCheckOutTime = (departmentTiming?.checkOutTime || "18:30").split(":");
    const expectedMinutes = parseInt(expectedCheckOutTime[0]) * 60 + parseInt(expectedCheckOutTime[1]);
    
    const isEarlyCheckout = currentTime < expectedMinutes;
    if (isEarlyCheckout && !reason.trim()) {
      return "Early checkout requires a reason to be provided";
    }
    
    // Overtime validation
    if (overtimeInfo.hasOvertime) {
      if (!otReason.trim()) return "Please provide a reason for overtime work";
      if (!capturedPhoto) return "Photo is mandatory for overtime verification";
    }
    
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Validation Error",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiRequest('POST', '/api/attendance/check-out', {
        userId: user?.uid,
        latitude: location!.latitude.toString(),
        longitude: location!.longitude.toString(),
        reason: reason || undefined,
        otReason: overtimeInfo.hasOvertime ? otReason : undefined,
        otImageUrl: overtimeInfo.hasOvertime ? capturedPhoto : undefined,
        overtimeHours: overtimeInfo.hasOvertime ? (overtimeInfo.overtimeHours + overtimeInfo.overtimeMinutes / 60) : undefined,
      });

      if (response.ok) {
        toast({
          title: "Check-out Successful",
          description: `Work session completed${overtimeInfo.hasOvertime ? ' with overtime recorded' : ''}`,
        });
        resetForm();
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check out');
      }
    } catch (error: any) {
      toast({
        title: "Check-out Failed",
        description: error.message || "Failed to record check-out",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Check Out from Work
          </DialogTitle>
          <DialogDescription>
            Complete your work session. Overtime verification may be required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Work Summary */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Check-in Time:</span>
                  <span className="text-sm">
                    {currentAttendance?.checkInTime 
                      ? new Date(currentAttendance.checkInTime).toLocaleTimeString()
                      : 'Not available'
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Working Time:</span>
                  <span className="text-sm">
                    {overtimeInfo.totalWorkingHours}h {overtimeInfo.totalWorkingMinutes}m
                  </span>
                </div>
                {overtimeInfo.hasOvertime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-orange-600">Overtime:</span>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      <Zap className="h-3 w-3 mr-1" />
                      {overtimeInfo.overtimeHours}h {overtimeInfo.overtimeMinutes}m OT
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Overtime Alert */}
          {overtimeInfo.hasOvertime && (
            <Alert className="border-orange-200 bg-orange-50">
              <Zap className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium text-orange-800">
                    Overtime Detected ({overtimeInfo.overtimeHours}h {overtimeInfo.overtimeMinutes}m)
                  </p>
                  <p className="text-sm text-orange-700">
                    Please provide a reason and take a photo for overtime verification.
                  </p>
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
                </div>
              </CardContent>
            </Card>
          )}

          {/* Early Checkout Warning */}
          {(() => {
            const now = new Date();
            const currentTime = now.getHours() * 60 + now.getMinutes();
            const expectedCheckOutTime = (departmentTiming?.checkOutTime || "18:30").split(":");
            const expectedMinutes = parseInt(expectedCheckOutTime[0]) * 60 + parseInt(expectedCheckOutTime[1]);
            const isEarlyCheckout = currentTime < expectedMinutes;
            
            return isEarlyCheckout && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-amber-800">
                      Early Checkout Detected
                    </p>
                    <p className="text-sm text-amber-700">
                      You are checking out before the expected time ({departmentTiming?.checkOutTime || "18:30"}). Please provide a reason below.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            );
          })()}

          {/* General Reason (Required for early checkout) */}
          <div className="space-y-2">
            {(() => {
              const now = new Date();
              const currentTime = now.getHours() * 60 + now.getMinutes();
              const expectedCheckOutTime = (departmentTiming?.checkOutTime || "18:30").split(":");
              const expectedMinutes = parseInt(expectedCheckOutTime[0]) * 60 + parseInt(expectedCheckOutTime[1]);
              const isEarlyCheckout = currentTime < expectedMinutes;
              
              return (
                <>
                  <Label htmlFor="reason">
                    Remarks {isEarlyCheckout ? "*" : "(Optional)"}
                  </Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={isEarlyCheckout 
                      ? "Please explain the reason for early checkout" 
                      : "Add any comments about your work session"
                    }
                    rows={3}
                    required={isEarlyCheckout}
                  />
                </>
              );
            })()}
          </div>

          {/* Overtime Reason (Required if OT) */}
          {overtimeInfo.hasOvertime && (
            <div className="space-y-2">
              <Label htmlFor="ot-reason">Overtime Reason *</Label>
              <Textarea
                id="ot-reason"
                value={otReason}
                onChange={(e) => setOtReason(e.target.value)}
                placeholder="Please explain why overtime was necessary"
                rows={3}
                required
              />
            </div>
          )}

          {/* Photo Capture for Overtime */}
          {overtimeInfo.hasOvertime && (
            <div className="space-y-4">
              <Label>Overtime Photo Verification *</Label>
              
              {!capturedPhoto ? (
                <div className="space-y-4">
                  {!isCameraActive ? (
                    <Button onClick={startCamera} variant="outline" className="w-full">
                      <Camera className="h-4 w-4 mr-2" />
                      Start Camera for OT Verification
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-64 object-cover"
                        />
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
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={capturedPhoto}
                      alt="Overtime verification photo"
                      className="w-full h-64 object-cover"
                    />
                  </div>
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

        <DialogFooter>
          <Button onClick={onClose} variant="outline" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !location || !isOnline}
            className="bg-red-600 hover:bg-red-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking Out...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Check Out
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}