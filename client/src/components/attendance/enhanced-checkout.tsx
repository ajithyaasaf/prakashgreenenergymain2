import { useState, useRef } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { MapPin, Camera, Clock, AlertTriangle, CheckCircle, Timer, LogOut } from "lucide-react";

interface EnhancedCheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  attendanceRecord?: any;
}

export function EnhancedCheckout({ isOpen, onClose, onSuccess, attendanceRecord }: EnhancedCheckoutProps) {
  const { user } = useAuthContext();
  const { location, error: locationError, isLoading: locationLoading, getCurrentLocation } = useGeolocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form states
  const [reason, setReason] = useState("");
  const [otReason, setOtReason] = useState("");
  const [earlyCheckoutReason, setEarlyCheckoutReason] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Enhanced checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!location) {
        throw new Error('Location is required for checkout');
      }

      // Upload photo if captured
      let photoUploadUrl = null;
      if (capturedPhoto) {
        try {
          const photoResponse = await apiRequest('POST', '/api/attendance/upload-photo', {
            imageData: capturedPhoto,
            userId: user?.uid,
            attendanceType: 'checkout'
          });

          if (photoResponse.ok) {
            const photoResult = await photoResponse.json();
            photoUploadUrl = photoResult.url;
          }
        } catch (error) {
          console.warn('Photo upload failed, continuing with checkout:', error);
        }
      }

      const requestData = {
        latitude: location.latitude,
        longitude: location.longitude,
        reason,
        otReason,
        earlyCheckoutReason,
        imageUrl: photoUploadUrl
      };

      const response = await apiRequest('POST', '/api/attendance/enhanced-check-out', requestData);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check out');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Check-out Successful",
        description: data.message,
        variant: "default",
      });
      
      // Reset form
      setReason("");
      setOtReason("");
      setEarlyCheckoutReason("");
      setCapturedPhoto(null);
      
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
      toast({
        title: "Check-out Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Camera functions
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      
      setStream(mediaStream);
      setIsCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          setIsVideoReady(true);
        };
      }
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !isVideoReady) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setCapturedPhoto(dataUrl);

    // Stop camera
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
      setIsVideoReady(false);
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  // Calculate timing information
  const currentTime = new Date();
  const isOvertimeUser = attendanceRecord?.overtimeRequested;
  const checkInTime = attendanceRecord?.checkInTime ? new Date(attendanceRecord.checkInTime) : null;
  
  // Department checkout time logic
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

  const expectedCheckoutTime = getDepartmentCheckoutTime();
  const [hour, minute] = expectedCheckoutTime.split(':').map(Number);
  const departmentCheckout = new Date();
  departmentCheckout.setHours(hour, minute, 0, 0);

  const isEarlyCheckout = currentTime < departmentCheckout && !isOvertimeUser;
  const earlyCheckoutMinutes = isEarlyCheckout ? 
    Math.floor((departmentCheckout.getTime() - currentTime.getTime()) / (1000 * 60)) : 0;

  // Calculate working hours
  const calculateWorkingHours = () => {
    if (!checkInTime) return 0;
    const workingMinutes = Math.floor((currentTime.getTime() - checkInTime.getTime()) / (1000 * 60));
    return Math.max(0, workingMinutes / 60);
  };

  const workingHours = calculateWorkingHours();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Enhanced Check-out
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Current Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-600">Working Hours</div>
                  <div className="text-xl font-bold text-blue-600">
                    {workingHours.toFixed(1)}h
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-gray-600">Expected Checkout</div>
                  <div className="text-lg font-semibold">
                    {expectedCheckoutTime}
                  </div>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                {isOvertimeUser && (
                  <Badge className="bg-orange-500 text-white">
                    <Timer className="h-3 w-3 mr-1" />
                    Overtime Active
                  </Badge>
                )}
                {isEarlyCheckout && (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Early Checkout
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Early checkout warning */}
          {isEarlyCheckout && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>Early Checkout Detected!</strong><br />
                You're checking out {earlyCheckoutMinutes} minutes before your scheduled time ({expectedCheckoutTime}).
                Please provide a reason for early checkout.
              </AlertDescription>
            </Alert>
          )}

          {/* Overtime status */}
          {isOvertimeUser && (
            <Alert className="border-orange-200 bg-orange-50">
              <Clock className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>Overtime Session Active</strong><br />
                Your overtime will be calculated from {expectedCheckoutTime} until now.
                Any work beyond this time will be tracked for payroll.
              </AlertDescription>
            </Alert>
          )}

          {/* Location Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Location Verification</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">
                    {locationLoading ? "Getting location..." : 
                     locationError ? "Location error" :
                     location ? `Location verified (±${location.accuracy.toFixed(0)}m)` : "Location required"}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={getCurrentLocation}
                  disabled={locationLoading}
                >
                  {locationLoading ? "Loading..." : "Refresh"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reason">General Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Any notes about your workday or checkout..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>

            {isOvertimeUser && (
              <div className="space-y-2">
                <Label htmlFor="otReason">Overtime Reason</Label>
                <Textarea
                  id="otReason"
                  placeholder="Describe the work completed during overtime..."
                  value={otReason}
                  onChange={(e) => setOtReason(e.target.value)}
                  rows={2}
                />
              </div>
            )}

            {isEarlyCheckout && (
              <div className="space-y-2">
                <Label htmlFor="earlyCheckoutReason">Early Checkout Reason *</Label>
                <Textarea
                  id="earlyCheckoutReason"
                  placeholder="Required: Explain why you're leaving early..."
                  value={earlyCheckoutReason}
                  onChange={(e) => setEarlyCheckoutReason(e.target.value)}
                  rows={2}
                  className={isEarlyCheckout && !earlyCheckoutReason ? "border-red-300" : ""}
                />
                {isEarlyCheckout && !earlyCheckoutReason && (
                  <p className="text-sm text-red-600">Early checkout reason is required</p>
                )}
              </div>
            )}
          </div>

          {/* Photo Capture */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Photo Verification (Optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!capturedPhoto ? (
                <div className="space-y-3">
                  {isCameraActive ? (
                    <div className="space-y-3">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full rounded-lg"
                        style={{ maxHeight: '200px', objectFit: 'cover' }}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={capturePhoto}
                          disabled={!isVideoReady}
                          className="flex-1"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Capture Photo
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (stream) {
                              stream.getTracks().forEach(track => track.stop());
                              setStream(null);
                              setIsCameraActive(false);
                              setIsVideoReady(false);
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={startCamera}
                      className="w-full"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Take Checkout Photo
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <img
                    src={capturedPhoto}
                    alt="Captured checkout photo"
                    className="w-full rounded-lg"
                    style={{ maxHeight: '200px', objectFit: 'cover' }}
                  />
                  <Button
                    variant="outline"
                    onClick={retakePhoto}
                    className="w-full"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Retake Photo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={
                checkoutMutation.isPending || 
                !location || 
                locationLoading ||
                (isEarlyCheckout && !earlyCheckoutReason.trim())
              }
              className="flex-1"
            >
              {checkoutMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Check Out
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </DialogContent>
    </Dialog>
  );
}