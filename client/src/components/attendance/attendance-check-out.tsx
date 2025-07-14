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
// Removed deprecated formatTime imports - using TimeDisplay component instead
import { TimeDisplay } from "@/components/time/time-display";

interface AttendanceCheckOutProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAttendance: any;
  departmentTiming?: any;
}


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

  // FIXED: Simplified overtime detection - let server handle calculations
  const calculateOvertimeInfo = () => {
    if (!currentAttendance?.checkInTime || !departmentTiming) {
      return { hasOvertime: false, overtimeHours: 0, overtimeMinutes: 0, requiresPhoto: false };
    }
    
    const checkInTime = new Date(currentAttendance.checkInTime);
    const currentTime = new Date();
    const workingMinutes = Math.floor((currentTime.getTime() - checkInTime.getTime()) / (1000 * 60));
    
    // Parse department checkout time for basic UI display
    const checkOutTimeStr = departmentTiming.checkOutTime || "6:00 PM";
    const currentTimeMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    
    // Simple time parsing for UI estimation only
    let departmentCheckoutMinutes = 18 * 60; // Default 6:00 PM
    const timeMatch = checkOutTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch) {
      let [, hours, minutes, period] = timeMatch;
      let hour24 = parseInt(hours);
      if (period.toUpperCase() === 'PM' && hour24 !== 12) hour24 += 12;
      if (period.toUpperCase() === 'AM' && hour24 === 12) hour24 = 0;
      departmentCheckoutMinutes = hour24 * 60 + parseInt(minutes);
    }
    
    // FIXED: Unified overtime calculation - total work time minus department standard hours
    const totalWorkingMinutes = Math.floor((currentTime.getTime() - checkInTime.getTime()) / (1000 * 60));
    const departmentStandardMinutes = departmentTiming.workingHours * 60;
    const overtimeMinutes = Math.max(0, totalWorkingMinutes - departmentStandardMinutes);
    const hasOvertime = overtimeMinutes > 0;
    const overtimeThreshold = departmentTiming.overtimeThresholdMinutes || 30;
    const requiresPhoto = overtimeMinutes >= overtimeThreshold;
    
    return {
      hasOvertime,
      overtimeHours: Math.floor(overtimeMinutes / 60),
      overtimeMinutes: overtimeMinutes % 60,
      totalWorkingHours: Math.floor(workingMinutes / 60),
      totalWorkingMinutes: workingMinutes % 60,
      departmentWorkingHours: departmentTiming.workingHours,
      departmentOvertimeThreshold: overtimeThreshold,
      requiresPhoto,
      workingMinutesTotal: workingMinutes
    };
  };

  const overtimeInfo = calculateOvertimeInfo();

  // Calculate early checkout info (simplified - no policy enforcement)
  const calculateEarlyCheckoutInfo = () => {
    if (!currentAttendance?.checkInTime || !departmentTiming) {
      return { isEarlyCheckout: false, earlyMinutes: 0 };
    }
    
    const checkInTime = new Date(currentAttendance.checkInTime);
    const currentTime = new Date();
    const workingMinutes = Math.floor((currentTime.getTime() - checkInTime.getTime()) / (1000 * 60));
    const workingHours = workingMinutes / 60;
    const expectedHours = departmentTiming.workingHours || 8;
    
    const isEarlyCheckout = workingHours < expectedHours;
    const earlyMinutes = isEarlyCheckout ? Math.floor((expectedHours - workingHours) * 60) : 0;
    
    return {
      isEarlyCheckout,
      earlyMinutes,
      workingHours: Number(workingHours.toFixed(1)),
      expectedHours
    };
  };

  const earlyCheckoutInfo = calculateEarlyCheckoutInfo();
  
  // Overtime warning for any work beyond department checkout time
  const getOvertimeWarning = () => {
    if (!overtimeInfo.hasOvertime) return null;
    
    const overtimeTotal = overtimeInfo.overtimeMinutes + (overtimeInfo.overtimeHours * 60);
    
    return {
      type: 'overtime_detected',
      message: `Working ${overtimeTotal} minutes beyond department checkout time. Photo and reason required for overtime verification.`
    };
  };

  const overtimeWarning = getOvertimeWarning();

  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  // Cleanup camera stream on component unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
        setIsCameraActive(false);
      }
    };
  }, [stream]);

  // Cleanup on modal close
  useEffect(() => {
    if (!isOpen && stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  }, [isOpen, stream]);

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
    
    // Parse department timing properly (12-hour format)
    const expectedTimeStr = departmentTiming?.checkOutTime || "6:30 PM";
    const timeMatch = expectedTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    let expectedMinutes = 18 * 60 + 30; // Default 6:30 PM
    if (timeMatch) {
      let [, hours, minutes, period] = timeMatch;
      let hour24 = parseInt(hours);
      if (period.toUpperCase() === 'PM' && hour24 !== 12) hour24 += 12;
      if (period.toUpperCase() === 'AM' && hour24 === 12) hour24 = 0;
      expectedMinutes = hour24 * 60 + parseInt(minutes);
    }
    
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
      let photoUploadUrl = undefined;

      // Upload photo to Cloudinary if overtime requires it
      if (overtimeInfo.hasOvertime && capturedPhoto) {
        try {
          const uploadResponse = await apiRequest('/api/attendance/upload-photo', 'POST', {
            imageData: capturedPhoto,
            userId: user?.uid,
            attendanceType: 'overtime_checkout'
          });

          const uploadData = await uploadResponse.json();
          
          if (uploadData.success) {
            photoUploadUrl = uploadData.url;
          } else {
            throw new Error('Photo upload failed');
          }
        } catch (uploadError) {
          toast({
            title: "Photo Upload Failed",
            description: "Unable to upload overtime verification photo. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }

      // Submit check-out with uploaded photo URL
      const checkOutData = {
        userId: user?.uid,
        latitude: location!.latitude,
        longitude: location!.longitude,
        reason: reason || undefined,
        otReason: overtimeInfo.hasOvertime ? otReason : undefined,
        imageUrl: photoUploadUrl, // Use uploaded Cloudinary URL
      };

      // Get Firebase auth token
      const auth = await import('firebase/auth');
      const currentUser = auth.getAuth().currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      const token = await currentUser.getIdToken();

      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(checkOutData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check out');
      }

      const responseData = await response.json();

      toast({
        title: "Check-out Successful",
        description: `Work session completed${overtimeInfo.hasOvertime ? ' with overtime recorded' : ''}`,
      });
      
      resetForm();
      onSuccess();
      onClose();

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
          {/* Department Timing Info */}
          {departmentTiming && (
            <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div>
                    <div className="text-xs text-muted-foreground">Check-in Time</div>
                    <div className="text-sm font-semibold text-green-600"><TimeDisplay time={departmentTiming.checkInTime} format12Hour={true} /></div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Check-out Time</div>
                    <div className="text-sm font-semibold text-red-600"><TimeDisplay time={departmentTiming.checkOutTime} format12Hour={true} /></div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Working Hours</div>
                    <div className="text-sm font-semibold text-blue-600">{departmentTiming.workingHours}h</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">OT Threshold</div>
                    <div className="text-sm font-semibold text-orange-600">{departmentTiming.overtimeThresholdMinutes}m</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Work Summary */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Check-in Time:</span>
                  <span className="text-sm">
                    {currentAttendance?.checkInTime 
                      ? <TimeDisplay time={currentAttendance.checkInTime} format12Hour={true} />
                      : 'Not available'
                    }
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Current Time:</span>
                  <span className="text-sm"><TimeDisplay time={new Date()} format12Hour={true} /></span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Working Time:</span>
                  <span className="text-sm font-semibold">
                    {overtimeInfo.totalWorkingHours}h {overtimeInfo.totalWorkingMinutes}m
                  </span>
                </div>
                {departmentTiming && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Standard Hours:</span>
                    <span className="text-sm">{departmentTiming.workingHours}h</span>
                  </div>
                )}
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
            // Parse department timing properly (12-hour format)
            const expectedTimeStr = departmentTiming?.checkOutTime || "6:30 PM";
            const timeMatch = expectedTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            let expectedMinutes = 18 * 60 + 30; // Default 6:30 PM
            if (timeMatch) {
              let [, hours, minutes, period] = timeMatch;
              let hour24 = parseInt(hours);
              if (period.toUpperCase() === 'PM' && hour24 !== 12) hour24 += 12;
              if (period.toUpperCase() === 'AM' && hour24 === 12) hour24 = 0;
              expectedMinutes = hour24 * 60 + parseInt(minutes);
            }
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
                      You are checking out before the expected time (<TimeDisplay time={departmentTiming?.checkOutTime || "6:30 PM"} format12Hour={true} />). Please provide a reason below.
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
              // Parse department timing properly (12-hour format)
              const expectedTimeStr = departmentTiming?.checkOutTime || "6:30 PM";
              const timeMatch = expectedTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
              let expectedMinutes = 18 * 60 + 30; // Default 6:30 PM
              if (timeMatch) {
                let [, hours, minutes, period] = timeMatch;
                let hour24 = parseInt(hours);
                if (period.toUpperCase() === 'PM' && hour24 !== 12) hour24 += 12;
                if (period.toUpperCase() === 'AM' && hour24 === 12) hour24 = 0;
                expectedMinutes = hour24 * 60 + parseInt(minutes);
              }
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
                placeholder="Example: Completing urgent client deliverable, project deadline requirements, emergency maintenance work..."
                value={otReason}
                onChange={(e) => setOtReason(e.target.value)}
                rows={3}
                className={otReason.trim().length > 0 && otReason.trim().length < 10 ? "border-orange-300" : ""}
              />
              <div className="flex justify-between text-xs">
                <span className={otReason.trim().length < 10 ? "text-orange-600" : "text-green-600"}>
                  {otReason.trim().length}/10 characters minimum
                </span>
                {otReason.trim().length >= 10 && (
                  <span className="text-green-600">✓ Valid overtime reason</span>
                )}
              </div>
            </div>
          )}

          {/* Photo Capture for Overtime */}
          {overtimeInfo.hasOvertime && (
            <div className="space-y-4">
              <Label>Overtime Photo Verification *</Label>
              
              {!capturedPhoto && !isCameraActive && (
                <Button onClick={startCamera} variant="outline" className="w-full">
                  <Camera className="h-4 w-4 mr-2" />
                  Take Photo for OT Verification
                </Button>
              )}

              {/* Camera view - always render video element but hide when not active */}
              <div className="space-y-2" style={{ display: isCameraActive ? 'block' : 'none' }}>
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
                    onCanPlay={() => {
                      console.log('CAMERA: Overtime video can play - stream is ready');
                    }}
                    onLoadedData={() => {
                      console.log('CAMERA: Overtime video data loaded');
                    }}
                    onPlaying={() => {
                      console.log('CAMERA: Overtime video is now playing');
                    }}
                    onLoadedMetadata={() => {
                      console.log('CAMERA: Overtime video metadata loaded');
                    }}
                  />
                  <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    LIVE - OT VERIFICATION
                  </div>
                </div>
                {isCameraActive && (
                  <div className="flex gap-2">
                    <Button onClick={capturePhoto} className="flex-1">
                      <Camera className="h-4 w-4 mr-2" />
                      Capture Photo
                    </Button>
                    <Button onClick={stopCamera} variant="outline">
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

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
            disabled={
              isSubmitting || 
              !location || 
              !isOnline || 
              (overtimeInfo.hasOvertime && (!otReason.trim() || otReason.trim().length < 10))
            }
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
                {overtimeInfo.hasOvertime && (!otReason.trim() || otReason.trim().length < 10) 
                  ? 'Complete OT Requirements' 
                  : 'Check Out'}
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