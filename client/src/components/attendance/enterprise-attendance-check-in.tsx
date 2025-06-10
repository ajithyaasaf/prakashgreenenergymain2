import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Camera, Wifi, WifiOff, Loader2, CheckCircle, AlertTriangle, Timer, Building2, Smartphone, Monitor } from "lucide-react";
import { DeviceDetection, getDeviceInfo, getLocationStatusMessage } from "@/utils/device-detection";

interface EnterpriseAttendanceCheckInProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  officeLocations?: any[];
}

interface LocationValidation {
  type: string;
  confidence: number;
  distance: number;
  detectedOffice: string | null;
  message: string;
  recommendations: string[];
}

export function EnterpriseAttendanceCheckIn({ isOpen, onClose, onSuccess }: EnterpriseAttendanceCheckInProps) {
  const { user } = useAuthContext();
  const { location, error: locationError, isLoading: locationLoading, getCurrentLocation } = useGeolocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get device information for smart validation
  const deviceInfo = getDeviceInfo();

  // Device-aware GPS quality text
  const getGPSQualityText = (accuracy: number): string => {
    if (deviceInfo.type === 'mobile') {
      // Mobile device - show actual GPS accuracy
      if (accuracy <= 10) return "(Excellent)";
      if (accuracy <= 50) return "(Good)";
      if (accuracy <= 200) return "(Fair - Indoor OK)";
      if (accuracy <= 500) return "(Indoor Signal)";
      return "(Weak)";
    } else {
      // Desktop/Laptop - show network positioning status
      const expected = DeviceDetection.getExpectedAccuracy(deviceInfo);
      if (accuracy <= expected.typical) return "(Network Position OK)";
      if (accuracy <= expected.max) return "(Network Position)";
      return "(Limited Network Signal)";
    }
  };

  // Form states
  const [attendanceType, setAttendanceType] = useState<"office" | "remote" | "field_work">("office");
  const [customerName, setCustomerName] = useState("");
  const [reason, setReason] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Location validation states
  const [locationValidation, setLocationValidation] = useState<LocationValidation | null>(null);
  const [isLocationRefreshing, setIsLocationRefreshing] = useState(false);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Network status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Device-aware location status display
  const getLocationStatus = () => {
    if (locationError) return { text: "Location Error", color: "destructive" };
    if (locationLoading) return { text: "Getting Location...", color: "secondary" };
    if (!location) return { text: "Location Required", color: "outline" };
    
    const statusInfo = getLocationStatusMessage(location.accuracy);
    
    // Map our color scheme to badge variants
    const colorMap = {
      success: "default" as const,
      info: "secondary" as const,
      warning: "outline" as const,
      error: "destructive" as const
    };
    
    return { 
      text: statusInfo.message, 
      color: colorMap[statusInfo.color],
      technical: statusInfo.technical
    };
  };

  const locationStatus = getLocationStatus();

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Enhanced location refresh
  const refreshLocation = async () => {
    setIsLocationRefreshing(true);
    try {
      await getCurrentLocation();
      console.log('FRONTEND: Location refreshed successfully');
    } catch (error) {
      console.error('FRONTEND: Location refresh failed:', error);
      toast({
        title: "Location Refresh Failed",
        description: "Unable to get current location. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLocationRefreshing(false);
    }
  };

  // Enhanced check-in mutation with enterprise validation and photo upload
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid || !location) {
        throw new Error('Location data not available');
      }

      // Ensure we have captured photo for field work
      if (attendanceType === "field_work" && !capturedPhoto) {
        throw new Error('Photo is required for field work');
      }

      // Prepare request data
      let photoUploadUrl = undefined;

      // Upload photo to Cloudinary if available
      if (capturedPhoto && attendanceType === "field_work") {
        console.log('FRONTEND: Uploading photo to Cloudinary...');
        
        try {
          const uploadResponse = await apiRequest('POST', '/api/attendance/upload-photo', {
            imageData: capturedPhoto,
            userId: user.uid,
            attendanceType: attendanceType
          });

          if (!uploadResponse.ok) {
            throw new Error('Photo upload failed');
          }

          const uploadResult = await uploadResponse.json();
          photoUploadUrl = uploadResult.url;
          
          console.log('FRONTEND: Photo uploaded successfully:', photoUploadUrl);
          
          toast({
            title: "Photo Uploaded",
            description: "Photo uploaded to cloud storage successfully",
            variant: "default",
          });
        } catch (uploadError) {
          console.error('FRONTEND: Photo upload failed:', uploadError);
          toast({
            title: "Photo Upload Failed",
            description: "Unable to upload photo. Please try again.",
            variant: "destructive",
          });
          throw new Error('Photo upload failed. Please try again.');
        }
      }

      const requestData = {
        userId: user.uid,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        attendanceType,
        reason: attendanceType !== "office" ? reason : undefined,
        customerName: attendanceType === "field_work" ? customerName : undefined,
        imageUrl: photoUploadUrl,
        deviceInfo: {
          type: deviceInfo.type,
          userAgent: deviceInfo.userAgent,
          locationCapability: deviceInfo.locationCapability
        }
      };

      console.log('FRONTEND: Sending check-in request with enterprise location data');
      console.log('Location data:', { 
        latitude: location.latitude, 
        longitude: location.longitude, 
        accuracy: location.accuracy,
        type: attendanceType,
        hasPhoto: !!photoUploadUrl
      });

      const response = await apiRequest('POST', '/api/attendance/check-in', requestData);

      if (!response.ok) {
        const errorData = await response.json();
        
        // Store location validation results for display
        if (errorData.locationValidation) {
          setLocationValidation(errorData.locationValidation);
        }
        
        throw new Error(errorData.message || 'Failed to check in');
      }

      const result = await response.json();
      
      // Store successful location validation for display
      if (result.location?.validation) {
        setLocationValidation({
          type: result.location.validation.type,
          confidence: result.location.validation.confidence,
          distance: result.location.validation.distance,
          detectedOffice: result.location.office?.name || null,
          message: result.message,
          recommendations: result.recommendations || []
        });
      }

      return result;
    },
    onSuccess: (data) => {
      console.log('FRONTEND: Check-in successful with enterprise validation');
      console.log('Location validation:', data.location?.validation);
      
      const validationType = data.location?.validation?.type || 'standard';
      const confidence = data.location?.validation?.confidence || 0;
      const indoorDetection = data.location?.validation?.indoorDetection ? ' (Indoor GPS)' : '';
      
      toast({
        title: "Check-in Successful",
        description: `${data.message} - ${validationType} validation (${confidence}% confidence)${indoorDetection}`,
        variant: "default",
      });
      
      // Reset form
      setAttendanceType("office");
      setCustomerName("");
      setReason("");
      setCapturedPhoto(null);
      setLocationValidation(null);
      
      // Cleanup camera
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
        setIsCameraActive(false);
      }
      
      // Invalidate queries to refresh attendance data
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          if (typeof queryKey === 'string') {
            return queryKey.includes('/api/attendance') || queryKey.includes('/api/activity-logs');
          }
          return false;
        }
      });
      
      onSuccess();
      onClose();
    },
    onError: (error: Error) => {
      console.log('FRONTEND: Check-in failed -', error.message);
      
      toast({
        title: "Check-in Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Camera functions
  const startCamera = async () => {
    try {
      console.log('CAMERA: Starting camera for attendance photo...');
      console.log('CAMERA: Navigator available:', !!navigator);
      console.log('CAMERA: MediaDevices available:', !!navigator.mediaDevices);
      console.log('CAMERA: getUserMedia available:', !!navigator.mediaDevices?.getUserMedia);
      
      // Try basic camera access first
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      console.log('CAMERA: Stream obtained:', {
        id: mediaStream.id,
        active: mediaStream.active,
        tracks: mediaStream.getTracks().length,
        videoTracks: mediaStream.getVideoTracks().length
      });
      
      setStream(mediaStream);
      setIsCameraActive(true);
      
      if (videoRef.current) {
        const video = videoRef.current;
        console.log('CAMERA: Video element found, setting up...');
        
        // Clear any existing content
        video.srcObject = null;
        
        // Set essential video properties
        video.muted = true;
        video.playsInline = true;
        video.controls = false;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        
        // Add comprehensive event logging
        const events = ['loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'playing', 'pause', 'ended', 'error'];
        events.forEach(eventName => {
          video.addEventListener(eventName, (e) => {
            console.log(`CAMERA: Video event - ${eventName}`, e);
            if (eventName === 'loadedmetadata' || eventName === 'canplay') {
              setIsVideoReady(true);
            }
          });
        });
        
        // Assign the stream
        console.log('CAMERA: Assigning stream to video element');
        video.srcObject = mediaStream;
        
        // Force play with multiple attempts
        const attemptPlay = async (attempt = 1) => {
          try {
            console.log(`CAMERA: Play attempt ${attempt}`);
            await video.play();
            console.log('CAMERA: Video playing successfully');
            setIsVideoReady(true);
          } catch (playError) {
            console.log(`CAMERA: Play attempt ${attempt} failed:`, playError);
            if (attempt < 3) {
              setTimeout(() => attemptPlay(attempt + 1), 200 * attempt);
            } else {
              console.log('CAMERA: All play attempts failed, but stream should be visible');
              setIsVideoReady(true);
            }
          }
        };
        
        // Start play attempts after short delay
        setTimeout(() => attemptPlay(), 100);
        
        console.log('CAMERA: Video setup complete');
      } else {
        console.error('CAMERA: Video ref is null!');
      }
      
    } catch (error) {
      console.error('CAMERA: Access failed:', error);
      toast({
        title: "Camera Access Failed",
        description: "Unable to access camera. Please check permissions and try again.",
        variant: "destructive",
      });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      console.log('CAMERA: Capturing photo...', {
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        readyState: video.readyState
      });
      
      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(photoDataUrl);
        
        console.log('CAMERA: Photo captured successfully, size:', photoDataUrl.length);
        
        // Stop camera after capture
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
          setIsCameraActive(false);
        }
        
        toast({
          title: "Photo Captured",
          description: "Photo captured successfully and ready for upload",
          variant: "default",
        });
      } else {
        console.error('CAMERA: Video not ready for capture');
        toast({
          title: "Capture Failed",
          description: "Please wait for camera to load completely before capturing",
          variant: "destructive",
        });
      }
    } else {
      console.error('CAMERA: Video or canvas element not available');
      toast({
        title: "Capture Failed",
        description: "Camera not properly initialized",
        variant: "destructive",
      });
    }
  };

  const resetPhoto = () => {
    console.log('CAMERA: Resetting photo and stopping camera...');
    setCapturedPhoto(null);
    setIsVideoReady(false);
    
    if (videoRef.current) {
      // Clean up event listeners if they exist
      const video = videoRef.current;
      if ((video as any).cameraCleanup) {
        (video as any).cameraCleanup();
        delete (video as any).cameraCleanup;
      }
      
      // Clear video source
      video.srcObject = null;
    }
    
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('CAMERA: Stopped track:', track.kind);
      });
      setStream(null);
    }
    setIsCameraActive(false);
  };

  // Form validation
  const isFormValid = () => {
    if (!location) return false;
    if (attendanceType === "field_work") {
      return customerName.trim() !== "" && capturedPhoto !== null;
    }
    if (attendanceType === "remote") {
      return reason.trim() !== "";
    }
    return true;
  };

  // Enhanced submit handler
  const handleSubmit = async () => {
    if (!isOnline) {
      toast({
        title: "No Internet Connection",
        description: "Please check your internet connection and try again.",
        variant: "destructive",
      });
      return;
    }

    if (!location) {
      toast({
        title: "Location Required",
        description: "Please enable location services and refresh your location.",
        variant: "destructive",
      });
      return;
    }

    checkInMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Enterprise Check-in
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Network Status */}
          <div className="flex items-center gap-2 text-sm">
            {isOnline ? (
              <>
                <Wifi className="h-4 w-4 text-green-600" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-red-600" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Location Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location Status
                {deviceInfo.type === 'mobile' ? (
                  <Smartphone className="h-3 w-3 text-green-600" />
                ) : (
                  <Monitor className="h-3 w-3 text-blue-600" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant={locationStatus.color as any}>
                  {locationStatus.text}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshLocation}
                  disabled={isLocationRefreshing}
                >
                  {isLocationRefreshing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Refresh"
                  )}
                </Button>
              </div>
              
              {/* Device Information */}
              <div className="text-xs text-gray-600 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Device:</span>
                  <Badge variant="outline" className="text-xs">
                    {deviceInfo.type.charAt(0).toUpperCase() + deviceInfo.type.slice(1)}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {deviceInfo.locationCapability.charAt(0).toUpperCase() + deviceInfo.locationCapability.slice(1)} GPS
                  </Badge>
                </div>
              </div>
              
              {location && (
                <div className="text-xs text-gray-600 space-y-1">
                  <div>{locationStatus.technical || `${deviceInfo.type === 'mobile' ? 'GPS' : 'Network'} Accuracy: ${Math.round(location.accuracy)}m ${getGPSQualityText(location.accuracy)}`}</div>
                  <div>Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</div>
                </div>
              )}

              {locationError && (
                <div className="text-xs text-red-600">
                  Error: {locationError.message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Location Validation Results */}
          {locationValidation && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {locationValidation.type === 'failed' ? (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  Location Validation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm">{locationValidation.message}</div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">{locationValidation.type}</Badge>
                  <Badge variant="outline">{locationValidation.confidence}% confidence</Badge>
                  <Badge variant="outline">{locationValidation.distance}m</Badge>
                </div>
                {locationValidation.detectedOffice && (
                  <div className="text-xs text-green-600">
                    Office: {locationValidation.detectedOffice}
                  </div>
                )}
                {locationValidation.recommendations.length > 0 && (
                  <div className="text-xs text-gray-600">
                    {locationValidation.recommendations.map((rec, index) => (
                      <div key={index}>• {rec}</div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Attendance Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="attendance-type">Attendance Type</Label>
            <Select value={attendanceType} onValueChange={(value: any) => setAttendanceType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select attendance type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="office">Office Work</SelectItem>
                <SelectItem value="remote">Remote Work</SelectItem>
                <SelectItem value="field_work">Field Work</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Remote Work Reason */}
          {attendanceType === "remote" && (
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Remote Work *</Label>
              <Textarea
                id="reason"
                placeholder="Please provide a reason for working remotely today..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          {/* Field Work Details */}
          {attendanceType === "field_work" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="customer-name">Customer Name *</Label>
                <Input
                  id="customer-name"
                  placeholder="Enter customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              {/* Photo Capture for Field Work */}
              <div className="space-y-2">
                <Label>Field Work Photo * (Required)</Label>
                
                {!capturedPhoto && !isCameraActive && (
                  <Button onClick={() => {
                    console.log('BUTTON: Take Photo clicked');
                    startCamera();
                  }} variant="outline" className="w-full">
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
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
                        onCanPlay={() => {
                          console.log('CAMERA: Video can play - stream is ready');
                        }}
                        onLoadedData={() => {
                          console.log('CAMERA: Video data loaded');
                        }}
                        onPlaying={() => {
                          console.log('CAMERA: Video is now playing');
                        }}
                      />
                      <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                        LIVE
                      </div>
                      {/* Loading indicator overlay */}
                      {!isVideoReady && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-sm">
                          <div className="text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            <div>Loading camera...</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={capturePhoto} className="flex-1">
                        <Camera className="h-4 w-4 mr-2" />
                        Capture Photo
                      </Button>
                      <Button onClick={resetPhoto} variant="outline">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {capturedPhoto && (
                  <div className="space-y-2">
                    <img src={capturedPhoto} alt="Captured" className="w-full rounded border" />
                    <Button onClick={resetPhoto} variant="outline" className="w-full">
                      Retake Photo
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid() || checkInMutation.isPending || !isOnline}
            className="w-full"
          >
            {checkInMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing Check-in...
              </>
            ) : (
              <>
                <Timer className="h-4 w-4 mr-2" />
                Check In
              </>
            )}
          </Button>

          {!isOnline && (
            <div className="text-center text-sm text-red-600">
              Internet connection required for check-in
            </div>
          )}
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </DialogContent>
    </Dialog>
  );
}