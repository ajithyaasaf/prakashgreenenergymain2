import { useState, useRef, useEffect } from "react";
import { useAuthContext } from "@/contexts/auth-context";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Camera, MapPin, Clock, AlertTriangle, CheckCircle, XCircle, 
  Loader2, User, Building, Wifi, WifiOff, RefreshCw 
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface AttendanceCheckInProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  officeLocations: any[];
}

// Default office coordinates (Prakash Greens Energy)
const DEFAULT_OFFICE = {
  latitude: 9.966844592415782,
  longitude: 78.1338405791111,
  radius: 100
};

export function AttendanceCheckIn({ isOpen, onClose, onSuccess, officeLocations }: AttendanceCheckInProps) {
  const { user } = useAuthContext();
  const { location, error: locationError, isLoading: locationLoading, getCurrentLocation, calculateDistance } = useGeolocation();
  const { toast } = useToast();

  // Form states
  const [attendanceType, setAttendanceType] = useState<"office" | "remote" | "field_work">("office");
  const [customerName, setCustomerName] = useState("");
  const [reason, setReason] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Network status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Use provided office location or default
  const primaryOffice = officeLocations?.[0] || DEFAULT_OFFICE;
  
  const distanceFromOffice = location && primaryOffice 
    ? calculateDistance(
        location.latitude, 
        location.longitude, 
        parseFloat(primaryOffice.latitude.toString()), 
        parseFloat(primaryOffice.longitude.toString())
      )
    : null;

  // Debug logging for distance calculation
  useEffect(() => {
    if (location && primaryOffice && distanceFromOffice !== null) {
      console.log('LOCATION DEBUG:', {
        userLocation: { lat: location.latitude, lng: location.longitude },
        officeLocation: { 
          lat: parseFloat(primaryOffice.latitude.toString()), 
          lng: parseFloat(primaryOffice.longitude.toString()),
          radius: primaryOffice.radius 
        },
        distanceFromOffice,
        isWithinRadius: distanceFromOffice <= (primaryOffice.radius || 100)
      });
    }
  }, [location, primaryOffice, distanceFromOffice]);

  const isWithinOfficeRadius = distanceFromOffice !== null 
    ? distanceFromOffice <= (primaryOffice.radius || 100)
    : false;

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
      // Automatically get location when modal opens
      getCurrentLocation().catch(console.error);
    }
  }, [isOpen, getCurrentLocation]);

  // Camera functions
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: 640, height: 480 } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraActive(true);
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera permissions to take attendance photo",
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
    setAttendanceType("office");
    setCustomerName("");
    setReason("");
    setCapturedPhoto(null);
    stopCamera();
  };

  const validateForm = (): string | null => {
    if (!location) return "Location access is required for attendance";
    if (!isOnline) return "Internet connection is required";
    
    // Office attendance validation
    if (attendanceType === "office") {
      if (!isWithinOfficeRadius) {
        return "You are outside the office location. Please select 'Remote' or 'Field Work' and provide a reason.";
      }
    }
    
    // Remote work validation
    if (attendanceType === "remote") {
      if (!reason.trim()) return "Please provide a reason for remote work";
    }
    
    // Field work validation
    if (attendanceType === "field_work") {
      if (!customerName.trim()) return "Customer name is required for field work";
      if (!capturedPhoto) return "Photo is mandatory for field work attendance";
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
      const response = await apiRequest('POST', '/api/attendance/check-in', {
        userId: user?.id,
        latitude: location!.latitude.toString(),
        longitude: location!.longitude.toString(),
        attendanceType,
        customerName: attendanceType === "field_work" ? customerName : undefined,
        reason: attendanceType !== "office" ? reason : undefined,
        imageUrl: capturedPhoto || undefined,
        isWithinOfficeRadius,
        distanceFromOffice: distanceFromOffice || undefined,
      });

      if (response.ok) {
        toast({
          title: "Check-in Successful",
          description: "Your attendance has been recorded successfully",
        });
        resetForm();
        onSuccess();
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check in');
      }
    } catch (error: any) {
      toast({
        title: "Check-in Failed",
        description: error.message || "Failed to record attendance",
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
            <Clock className="h-5 w-5" />
            Check In to Work
          </DialogTitle>
          <DialogDescription>
            Mark your attendance for today. Location and photo verification may be required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {isOnline ? (
                    <Wifi className="h-4 w-4 text-green-600" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-red-600" />
                  )}
                  <span className="text-sm font-medium">
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {locationLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    ) : location ? (
                      <MapPin className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span className="text-sm font-medium">
                      {locationLoading ? "Getting Location..." : 
                       location ? `${location.accuracy.toFixed(0)}m accuracy` : "No Location"}
                    </span>
                  </div>
                  {!locationLoading && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => getCurrentLocation().catch(console.error)}
                      className="h-7 px-2"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Location Status */}
          {location && (
            <Alert className={isWithinOfficeRadius ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}>
              <MapPin className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <span>
                    {isWithinOfficeRadius 
                      ? `You are within the office radius (${distanceFromOffice?.toFixed(0)}m away)`
                      : `You are outside the office (${distanceFromOffice?.toFixed(0)}m away)`
                    }
                  </span>
                  <Badge variant={isWithinOfficeRadius ? "default" : "secondary"}>
                    {isWithinOfficeRadius ? "Inside Office" : "Outside Office"}
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Attendance Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="attendance-type">Attendance Type</Label>
            <Select
              value={attendanceType}
              onValueChange={(value: "office" | "remote" | "field_work") => {
                setAttendanceType(value);
                setCustomerName("");
                setReason("");
                setCapturedPhoto(null);
              }}
            >
              <SelectTrigger id="attendance-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Office Work
                  </div>
                </SelectItem>
                <SelectItem value="remote">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4" />
                    Remote Work
                  </div>
                </SelectItem>
                <SelectItem value="field_work">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Field Work
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Customer Name for Field Work */}
          {attendanceType === "field_work" && (
            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name *</Label>
              <Input
                id="customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Enter customer name for field work"
                required
              />
            </div>
          )}

          {/* Reason for Remote/Field Work */}
          {(attendanceType === "remote" || attendanceType === "field_work") && (
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason {attendanceType === "remote" ? "*" : "(Optional)"}
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Provide reason for ${attendanceType === "remote" ? "remote work" : "field work"}`}
                rows={3}
              />
            </div>
          )}

          {/* Photo Capture for Field Work */}
          {attendanceType === "field_work" && (
            <div className="space-y-4">
              <Label>Photo Verification *</Label>
              
              {!capturedPhoto ? (
                <div className="space-y-4">
                  {!isCameraActive ? (
                    <Button onClick={startCamera} variant="outline" className="w-full">
                      <Camera className="h-4 w-4 mr-2" />
                      Start Camera
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
                      alt="Captured attendance photo"
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
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking In...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Check In
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