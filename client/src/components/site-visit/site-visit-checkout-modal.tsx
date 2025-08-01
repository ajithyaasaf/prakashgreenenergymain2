/**
 * Site Visit Checkout Modal
 * Handles the site visit checkout process with location and photo verification
 */

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  MapPin, 
  Camera, 
  CheckCircle, 
  Clock,
  User,
  AlertTriangle,
  RotateCcw,
  X
} from "lucide-react";
import { EnhancedLocationCapture } from "./enhanced-location-capture";
import { LocationData } from "@/lib/location-service";
import ErrorBoundary from "@/components/error-boundary";

interface SiteVisitCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteVisit: any;
}

export function SiteVisitCheckoutModal({ isOpen, onClose, siteVisit }: SiteVisitCheckoutModalProps) {
  const [step, setStep] = useState(1);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lastErrorMessage, setLastErrorMessage] = useState<string>('');
  
  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentCamera, setCurrentCamera] = useState<'front' | 'back'>('back');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCurrentLocation(null);
      setLocationCaptured(false);
      setCapturedPhoto(null);
      setNotes('');
      setLastErrorMessage('');
      setIsCameraActive(false);
      setIsVideoReady(false);
      setCurrentCamera('back');
      
      // Stop any existing camera stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  }, [isOpen, stream]);

  const handleLocationCaptured = (location: LocationData) => {
    setCurrentLocation(location);
    setLocationCaptured(true);
  };

  const handleLocationError = (error: string) => {
    if (error !== lastErrorMessage) {
      toast({
        title: "Location Error",
        description: error,
        variant: "destructive",
      });
      setLastErrorMessage(error);
    }
    setLocationCaptured(false);
  };

  // Camera functions
  const startCamera = async () => {
    try {
      console.log('CHECKOUT_CAMERA: Starting camera...');
      
      const constraints = {
        video: {
          facingMode: currentCamera === 'front' ? 'user' : 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
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
        
        video.onloadedmetadata = () => {
          console.log('CHECKOUT_CAMERA: Video metadata loaded');
          setIsVideoReady(true);
        };
        
        setTimeout(async () => {
          try {
            await video.play();
            console.log('CHECKOUT_CAMERA: Video play successful');
          } catch (playError) {
            console.warn('CHECKOUT_CAMERA: Auto-play failed:', playError);
          }
        }, 100);
      }
      
    } catch (error) {
      console.error('CHECKOUT_CAMERA: Access failed:', error);
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
    if (videoRef.current && canvasRef.current && isVideoReady) {
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
        stopCamera();
        
        toast({
          title: "Photo Captured",
          description: "Site checkout photo captured successfully",
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

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setIsVideoReady(false);
  };

  const switchCamera = async () => {
    const newCamera = currentCamera === 'front' ? 'back' : 'front';
    setCurrentCamera(newCamera);
    
    if (isCameraActive) {
      stopCamera();
      setTimeout(() => {
        startCamera();
      }, 200);
    }
  };

  const resetPhoto = () => {
    setCapturedPhoto(null);
    stopCamera();
  };

  const checkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      // Upload photo to Cloudinary if provided
      let photoUrl = 'https://via.placeholder.com/400x300.jpg?text=No+Photo';
      
      if (capturedPhoto) {
        try {
          console.log("Uploading checkout photo via server-side Cloudinary service...");
          
          const uploadResponse = await apiRequest('/api/attendance/upload-photo', 'POST', {
            imageData: capturedPhoto, // Already base64 encoded
            userId: 'site_visit_checkout', // Temporary user ID for site visit checkouts
            attendanceType: 'site_visit_checkout'
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.message || 'Photo upload failed');
          }

          const uploadResult = await uploadResponse.json();
          photoUrl = uploadResult.url;
          console.log("Checkout photo uploaded successfully:", photoUrl);
        } catch (error) {
          console.error('Photo upload failed:', error);
          toast({
            title: "Photo Upload Failed",
            description: error instanceof Error ? error.message : "Could not upload photo. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }

      // Create checkout payload - using correct schema field names
      const checkoutPayload = {
        status: 'completed',
        siteOutTime: new Date(), // Send as Date object, not ISO string
        siteOutLocation: currentLocation,
        siteOutPhotoUrl: photoUrl,
        notes: notes, // Use 'notes' instead of 'completionNotes'
        updatedAt: new Date()
      };

      console.log("=== FRONTEND CHECKOUT REQUEST ===");
      console.log("Site Visit ID:", siteVisit.id);
      console.log("Checkout payload:", checkoutPayload);
      console.log("================================");
      
      const response = await apiRequest(
        `/api/site-visits/${siteVisit.id}`,
        'PATCH',
        checkoutPayload
      );

      const result = await response.json();
      console.log("=== CHECKOUT SUCCESS ===");
      console.log("Server response:", result);
      console.log("=======================");
      
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Site Visit Completed",
        description: "Site visit has been successfully completed.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/site-visits'] });
      onClose();
    },
    onError: (error: any) => {
      console.error('Checkout failed:', error);
      
      // Provide more specific error messages
      let errorMessage = "Could not complete site visit. Please try again.";
      
      if (error?.message) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('permission') || error.message.includes('access')) {
          errorMessage = "Access denied. Please check your permissions.";
        } else if (error.message.includes('not found')) {
          errorMessage = "Site visit not found. Please refresh the page.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Checkout Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleSubmit = () => {
    if (!locationCaptured) {
      toast({
        title: "Location Required",
        description: "Please capture your checkout location first.",
        variant: "destructive",
      });
      return;
    }

    checkoutMutation.mutate({});
  };

  const canProceedToStep2 = locationCaptured;
  // Photo is optional according to schema - only require location
  const canCheckout = locationCaptured;

  if (!siteVisit) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Complete Site Visit
          </DialogTitle>
          <DialogDescription>
            Complete your site visit by capturing checkout location and photo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary text-white' : 'bg-muted'}`}>
                1
              </div>
              <span className="text-sm font-medium">Checkout Location</span>
            </div>
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary text-white' : 'bg-muted'}`}>
                2
              </div>
              <span className="text-sm font-medium">Photo & Notes</span>
            </div>
          </div>

          {/* Site Visit Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Site Visit Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Purpose:</span>
                <Badge variant="outline">{siteVisit.visitPurpose}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span className="font-medium">{siteVisit.customer?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Started:</span>
                <span>{new Date(siteVisit.siteInTime).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department:</span>
                <span className="capitalize">{siteVisit.department}</span>
              </div>
            </CardContent>
          </Card>

          {/* Step 1: Location Capture */}
          {step === 1 && (
            <div className="space-y-4">
              <ErrorBoundary>
                <EnhancedLocationCapture
                  onLocationCaptured={handleLocationCaptured}
                  onLocationError={handleLocationError}
                  title="Site Check-Out Location"
                  description="We need to detect your current location for site check-out"
                  autoDetect={true}
                  required={true}
                  showAddress={true}
                />
              </ErrorBoundary>

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
                >
                  Next: Photo & Notes
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Photo & Notes */}
          {step === 2 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Site Out Photo (Optional)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {!capturedPhoto && !isCameraActive && (
                      <div className="space-y-3">
                        <Button 
                          onClick={startCamera}
                          variant="outline"
                          className="w-full"
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Take Site Photo (Optional)
                        </Button>
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                          <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Optional: Take a final photo to document site completion
                          </p>
                        </div>
                      </div>
                    )}

                    {isCameraActive && !capturedPhoto && (
                      <div className="space-y-3">
                        <div className="relative">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-64 object-cover rounded-lg bg-black"
                          />
                          {!isVideoReady && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                              <div className="text-white text-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                                <p className="text-sm">Loading camera...</p>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-between">
                          <Button
                            variant="outline"
                            onClick={switchCamera}
                            disabled={!isVideoReady}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Switch to {currentCamera === 'front' ? 'Back' : 'Front'}
                          </Button>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="destructive"
                              onClick={stopCamera}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Cancel
                            </Button>
                            <Button
                              onClick={capturePhoto}
                              disabled={!isVideoReady}
                            >
                              <Camera className="h-4 w-4 mr-2" />
                              Capture
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {capturedPhoto && (
                      <div className="space-y-3">
                        <div className="relative">
                          <img
                            src={capturedPhoto}
                            alt="Captured checkout photo"
                            className="w-full h-64 object-cover rounded-lg"
                          />
                          <Badge className="absolute top-2 right-2">
                            Captured
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          onClick={resetPhoto}
                          className="w-full"
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Retake Photo
                        </Button>
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      Photo is optional - you can complete checkout without taking a photo
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Completion Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any final notes about the site visit completion..."
                    rows={4}
                  />
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={checkoutMutation.isPending}
                  className="flex items-center gap-2"
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Complete Site Visit
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </DialogContent>
    </Dialog>
  );
}

export default SiteVisitCheckoutModal;