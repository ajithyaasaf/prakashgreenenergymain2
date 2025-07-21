import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/hooks/use-geolocation";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MapPin, Camera, Loader2, RefreshCw, CheckCircle, 
  AlertTriangle, Timer, Clock, Building2
} from "lucide-react";

interface SimplifiedAttendanceCheckInProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function SimplifiedAttendanceCheckIn({ isOpen, onClose, onSuccess }: SimplifiedAttendanceCheckInProps) {
  const { user } = useAuthContext();
  const { location, error: locationError, isLoading: locationLoading, getCurrentLocation } = useGeolocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string>("");
  const [isLocationRefreshing, setIsLocationRefreshing] = useState(false);
  const [isAddressLoading, setIsAddressLoading] = useState(false);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Network status
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Monitor network status
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

  // Fetch location on modal open
  useEffect(() => {
    if (isOpen && !location) {
      getCurrentLocation();
    }
  }, [isOpen, getCurrentLocation, location]);

  // Fetch address when location changes
  useEffect(() => {
    if (location && isOpen) {
      fetchLocationAddress();
    }
  }, [location, isOpen]);

  // Cleanup camera when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetPhoto();
    }
  }, [isOpen]);

  // Simple location status display
  const getLocationStatus = () => {
    if (locationError) return { text: "Location Error", color: "destructive" as const };
    if (locationLoading) return { text: "Getting Location...", color: "secondary" as const };
    if (!location) return { text: "Location Required", color: "outline" as const };
    
    return { 
      text: "Location Ready", 
      color: "default" as const
    };
  };

  const locationStatus = getLocationStatus();

  // Fetch address from location using Google Maps API
  const fetchLocationAddress = async () => {
    if (!location) return;
    
    setIsAddressLoading(true);
    try {
      // Direct Google Maps reverse geocoding for accurate address
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.GOOGLE_MAPS_API_KEY;
      
      if (apiKey) {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.latitude},${location.longitude}&key=${apiKey}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            const address = data.results[0].formatted_address;
            setCurrentAddress(address);
            console.log('Google Maps address resolved:', address);
            return;
          }
        }
      }
      
      // Fallback to coordinates if Google Maps API unavailable
      setCurrentAddress(`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
      console.log('Using coordinate fallback for address');
    } catch (error) {
      console.error('Failed to fetch address:', error);
      setCurrentAddress(`${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`);
    } finally {
      setIsAddressLoading(false);
    }
  };

  // Enhanced location refresh with immediate address fetch
  const refreshLocation = async () => {
    setIsLocationRefreshing(true);
    setCurrentAddress("");
    try {
      console.log('FRONTEND: Refreshing location and address...');
      await getCurrentLocation();
      console.log('FRONTEND: Location refreshed successfully');
      
      toast({
        title: "Location Updated",
        description: "Getting your current address...",
        variant: "default",
      });
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

  // Form validation
  const isFormValid = () => {
    return location && capturedPhoto;
  };

  // Enhanced check-in mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!user?.uid || !location || !capturedPhoto) {
        throw new Error('Required data not available');
      }

      // Upload photo to Cloudinary
      console.log('FRONTEND: Uploading photo to Cloudinary...');
      
      let photoUploadUrl = undefined;
      try {
        const uploadResponse = await apiRequest('/api/attendance/upload-photo', 'POST', {
          imageData: capturedPhoto,
          userId: user.uid,
          attendanceType: 'office'
        });

        if (!uploadResponse.ok) {
          throw new Error('Photo upload failed');
        }

        const uploadResult = await uploadResponse.json();
        photoUploadUrl = uploadResult.url;
        
        console.log('FRONTEND: Photo uploaded successfully:', photoUploadUrl);
        
        toast({
          title: "Photo Uploaded",
          description: "Photo uploaded successfully",
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

      // Device detection for attendance context
      const deviceInfo = {
        type: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'mobile' as const : 'desktop' as const,
        userAgent: navigator.userAgent,
        locationCapability: location.accuracy <= 10 ? 'excellent' as const : location.accuracy <= 50 ? 'good' as const : 'limited' as const
      };

      const requestData = {
        userId: user.uid,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        attendanceType: 'office',
        imageUrl: photoUploadUrl,
        deviceInfo
      };

      console.log('FRONTEND: Sending simplified check-in request');
      console.log('Location data:', { 
        latitude: location.latitude, 
        longitude: location.longitude, 
        accuracy: location.accuracy,
        hasPhoto: !!photoUploadUrl,
        address: currentAddress
      });

      const response = await apiRequest('/api/attendance/check-in', 'POST', requestData);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check in');
      }

      const result = await response.json();
      return result;
    },
    onSuccess: (data) => {
      console.log('FRONTEND: Check-in successful');
      
      toast({
        title: "Check-in Successful",
        description: `${data.message} at ${currentAddress || 'current location'}`,
        variant: "default",
      });
      
      // Reset form
      setCapturedPhoto(null);
      setCurrentAddress("");
      
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
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported on this device');
      }
      
      const constraints = {
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          facingMode: 'user' // Front-facing camera
        },
        audio: false
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(mediaStream);
      setIsCameraActive(true);
      setIsVideoReady(false);
      
      if (videoRef.current) {
        const video = videoRef.current;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.controls = false;
        video.srcObject = mediaStream;
        
        setTimeout(async () => {
          try {
            await video.play();
            console.log('CAMERA: Video play successful');
          } catch (playError) {
            console.warn('CAMERA: Auto-play failed, but stream should still be visible:', playError);
          }
        }, 100);
      }
      
    } catch (error) {
      console.error('CAMERA: Access failed:', error);
      setIsCameraActive(false);
      setIsVideoReady(false);
      
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
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(photoDataUrl);
        
        // Stop camera after capture
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
          setIsCameraActive(false);
        }
        
        toast({
          title: "Photo Captured",
          description: "Photo captured successfully",
          variant: "default",
        });
      } else {
        toast({
          title: "Capture Failed",
          description: "Please wait for camera to load completely",
          variant: "destructive",
        });
      }
    }
  };

  const resetPhoto = () => {
    setCapturedPhoto(null);
    setIsVideoReady(false);
    
    if (videoRef.current) {
      const video = videoRef.current;
      video.srcObject = null;
      video.load();
    }
    
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
    setIsCameraActive(false);
  };

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

    if (!capturedPhoto) {
      toast({
        title: "Photo Required",
        description: "Please take a selfie photo for attendance verification.",
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
            <Clock className="h-5 w-5" />
            Check In
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location Status Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Current Location
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
                    <>
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      Getting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>
              
              {/* Current Address Display */}
              {location && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-gray-700">Address:</div>
                  {isAddressLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Getting address...</span>
                    </div>
                  ) : currentAddress ? (
                    <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
                      {currentAddress}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                    </div>
                  )}
                  
                  {location && (
                    <div className="text-xs text-gray-500">
                      Accuracy: {location.accuracy.toFixed(0)} meters
                    </div>
                  )}
                </div>
              )}

              {locationError && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {locationError.message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photo Capture */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Selfie Photo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!capturedPhoto && !isCameraActive && (
                <Button onClick={startCamera} variant="outline" className="w-full">
                  <Camera className="h-4 w-4 mr-2" />
                  Take Selfie
                </Button>
              )}

              {/* Camera view */}
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
                    onCanPlay={() => setIsVideoReady(true)}
                    onLoadedData={() => setIsVideoReady(true)}
                    onPlaying={() => setIsVideoReady(true)}
                    onLoadedMetadata={() => setIsVideoReady(true)}
                  />
                  <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                    LIVE
                  </div>
                  {!isVideoReady && isCameraActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white text-sm">
                      <div className="text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        <div>Loading camera...</div>
                      </div>
                    </div>
                  )}
                </div>
                {isCameraActive && (
                  <div className="flex gap-2">
                    <Button onClick={capturePhoto} className="flex-1" disabled={!isVideoReady}>
                      <Camera className="h-4 w-4 mr-2" />
                      Capture
                    </Button>
                    <Button onClick={resetPhoto} variant="outline">
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {capturedPhoto && (
                <div className="space-y-2">
                  <img src={capturedPhoto} alt="Captured selfie" className="w-full rounded border" />
                  <Button onClick={resetPhoto} variant="outline" className="w-full">
                    Retake Photo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Requirements Status */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Requirements:</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                {location ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                )}
                <span>Current location</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {capturedPhoto ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                )}
                <span>Selfie photo</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid() || checkInMutation.isPending || !isOnline}
            className="w-full"
          >
            {checkInMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking In...
              </>
            ) : (
              <>
                <Timer className="h-4 w-4 mr-2" />
                {isFormValid() ? 'Check In Now' : 'Complete Requirements Above'}
              </>
            )}
          </Button>

          {!isOnline && (
            <div className="text-center text-sm text-red-600">
              Internet connection required for check-in
            </div>
          )}

          {isFormValid() && (
            <div className="text-xs text-green-600 text-center p-2 bg-green-50 rounded">
              Ready to check in! Your attendance will be recorded with current location and time.
            </div>
          )}
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </DialogContent>
    </Dialog>
  );
}