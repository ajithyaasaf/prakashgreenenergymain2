/**
 * Site Visit Start Modal
 * Handles the initial site visit creation workflow
 */

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  MapPin, 
  Camera, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  ArrowRight,
  Users,
  Building,
  Zap,
  RotateCcw,
  X
} from "lucide-react";
import { TechnicalSiteVisitForm } from "./technical-site-visit-form";
import { MarketingSiteVisitForm } from "./marketing-site-visit-form";
import { AdminSiteVisitForm } from "./admin-site-visit-form";
import { EnhancedLocationCapture } from "./enhanced-location-capture";
import { LocationData } from "@/lib/location-service";
import ErrorBoundary from "@/components/error-boundary";
import CustomerAutocomplete from "@/components/ui/customer-autocomplete";

interface SiteVisitStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  userDepartment: string;
}

const visitPurposes = [
  { value: 'visit', label: 'Site Visit', icon: MapPin },
  { value: 'installation', label: 'Installation', icon: Building },
  { value: 'service', label: 'Service', icon: Zap },
  { value: 'purchase', label: 'Purchase', icon: Users },
  { value: 'eb_office', label: 'EB Office', icon: Building },
  { value: 'amc', label: 'AMC', icon: Clock },
  { value: 'bank', label: 'Bank', icon: Building },
  { value: 'other', label: 'Other', icon: MapPin }
];

const propertyTypes = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'agri', label: 'Agricultural' },
  { value: 'other', label: 'Other' }
];

export function SiteVisitStartModal({ isOpen, onClose, userDepartment }: SiteVisitStartModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState(1);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationCaptured, setLocationCaptured] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string>('');
  
  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentCamera, setCurrentCamera] = useState<'front' | 'back'>('back');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [formData, setFormData] = useState<{
    visitPurpose: string;
    customer: {
      name: string;
      mobile: string;
      address: string;
      ebServiceNumber: string;
      propertyType: string;
    };
    notes: string;
    technicalData: any;
    marketingData: any;
    adminData: any;
  }>({
    visitPurpose: '',
    customer: {
      name: '',
      mobile: '',
      address: '',
      ebServiceNumber: '',
      propertyType: '',
    },
    notes: '',
    technicalData: null,
    marketingData: null,
    adminData: null
  });

  // Reset form when modal opens (but not on camera errors)
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCurrentLocation(null);
      setLocationCaptured(false);
      setCapturedPhoto(null);
      setLastErrorMessage('');
      setIsCameraActive(false);
      setIsVideoReady(false);
      setCurrentCamera('back');
      
      setFormData({
        visitPurpose: '',
        customer: {
          name: '',
          mobile: '',
          address: '',
          ebServiceNumber: '',
          propertyType: '',
        },
        notes: '',
        technicalData: null,
        marketingData: null,
        adminData: null
      });
    }
  }, [isOpen]);

  // Cleanup camera stream when modal closes or component unmounts
  useEffect(() => {
    if (!isOpen && stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isOpen, stream]);

  const handleLocationCaptured = (location: LocationData) => {
    setCurrentLocation(location);
    setLocationCaptured(true);
  };

  const handleLocationError = (error: string) => {
    // Prevent repeated toast messages for the same error
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

  // Camera functions with better error handling
  const startCamera = async () => {
    try {
      console.log('SITE_VISIT_CAMERA: Starting camera...');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported on this device');
      }
      
      // Try with specific constraints first, then fall back to basic ones
      let mediaStream: MediaStream;
      const facingMode = currentCamera === 'front' ? 'user' : 'environment';
      
      try {
        // Try with preferred constraints
        const preferredConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280, min: 640, max: 1920 },
            height: { ideal: 720, min: 480, max: 1080 }
          },
          audio: false
        };
        
        console.log('SITE_VISIT_CAMERA: Trying preferred constraints:', preferredConstraints);
        mediaStream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
      } catch (preferredError) {
        console.warn('SITE_VISIT_CAMERA: Preferred constraints failed, trying basic:', preferredError);
        
        try {
          // Fall back to basic constraints
          const basicConstraints = {
            video: {
              facingMode: facingMode
            },
            audio: false
          };
          
          mediaStream = await navigator.mediaDevices.getUserMedia(basicConstraints);
        } catch (basicError) {
          console.warn('SITE_VISIT_CAMERA: Basic constraints failed, trying minimal:', basicError);
          
          // Last resort - minimal constraints
          const minimalConstraints = {
            video: true,
            audio: false
          };
          
          mediaStream = await navigator.mediaDevices.getUserMedia(minimalConstraints);
        }
      }
      setStream(mediaStream);
      setIsCameraActive(true);
      setIsVideoReady(false);
      
      if (videoRef.current) {
        const video = videoRef.current;
        
        // Clear any existing event handlers
        video.onloadedmetadata = null;
        video.onerror = null;
        video.oncanplay = null;
        
        // Set video properties
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.controls = false;
        
        // Handle video events with promises for better control
        const setupVideo = () => {
          return new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              console.warn('SITE_VISIT_CAMERA: Video setup timeout, forcing ready state');
              // Force ready state after timeout
              setIsVideoReady(true);
              resolve();
            }, 5000); // 5 second timeout
            
            video.onloadedmetadata = () => {
              clearTimeout(timeoutId);
              console.log('SITE_VISIT_CAMERA: Video metadata loaded, dimensions:', video.videoWidth, 'x', video.videoHeight);
              
              // Additional check - sometimes dimensions are 0 initially
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                setIsVideoReady(true);
                resolve();
              } else {
                // Wait a bit more for dimensions
                setTimeout(() => {
                  if (video.videoWidth > 0 && video.videoHeight > 0) {
                    setIsVideoReady(true);
                    resolve();
                  } else {
                    reject(new Error('Video dimensions invalid'));
                  }
                }, 1000);
              }
            };
            
            video.onerror = (e) => {
              clearTimeout(timeoutId);
              console.error('SITE_VISIT_CAMERA: Video error:', e);
              reject(e);
            };
            
            video.oncanplay = () => {
              console.log('SITE_VISIT_CAMERA: Video can play');
              // Sometimes onloadedmetadata doesn't fire, so try here too
              if (video.videoWidth > 0 && video.videoHeight > 0 && !isVideoReady) {
                clearTimeout(timeoutId);
                setIsVideoReady(true);
                resolve();
              }
            };
            
            // Set the stream
            video.srcObject = mediaStream;
            
            // Additional fallback - check if video is working after a short delay
            setTimeout(() => {
              if (video.readyState >= 2 && !isVideoReady) { // HAVE_CURRENT_DATA or higher
                console.log('SITE_VISIT_CAMERA: Fallback activation - video appears ready');
                clearTimeout(timeoutId);
                setIsVideoReady(true);
                resolve();
              }
            }, 2000);
          });
        };
        
        try {
          await setupVideo();
          
          // Try to play video after setup
          try {
            await video.play();
            console.log('SITE_VISIT_CAMERA: Video play successful');
          } catch (playError) {
            console.warn('SITE_VISIT_CAMERA: Auto-play failed, but continuing:', playError);
            // Set ready anyway since the stream is working
            setIsVideoReady(true);
          }
        } catch (setupError) {
          console.error('SITE_VISIT_CAMERA: Video setup failed:', setupError);
          throw setupError;
        }
      }
      
    } catch (error) {
      console.error('SITE_VISIT_CAMERA: Access failed:', error);
      
      // Clean up on error but don't reset the entire form
      setIsCameraActive(false);
      setIsVideoReady(false);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      
      let errorMessage = "Unable to access camera. ";
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += "Please allow camera permissions and try again.";
        } else if (error.name === 'NotFoundError') {
          errorMessage += "No camera found on this device.";
        } else if (error.name === 'NotReadableError') {
          errorMessage += "Camera is being used by another application.";
        } else if (error.name === 'NotSupportedError') {
          errorMessage += "Camera constraints not supported.";
        } else {
          errorMessage += error.message;
        }
      }
      
      toast({
        title: "Camera Access Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Don't throw the error to prevent form reset
      return;
    }
  };

  const capturePhoto = () => {
    console.log('SITE_VISIT_CAMERA: Attempting photo capture...');
    
    if (!videoRef.current || !canvasRef.current) {
      console.error('SITE_VISIT_CAMERA: Video or canvas ref not available');
      toast({
        title: "Capture Failed",
        description: "Camera not properly initialized. Please try again.",
        variant: "destructive",
      });
      return;
    }
    
    if (!isVideoReady) {
      console.error('SITE_VISIT_CAMERA: Video not ready');
      toast({
        title: "Capture Failed",
        description: "Please wait for camera to load completely",
        variant: "destructive",
      });
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) {
      console.error('SITE_VISIT_CAMERA: Cannot get canvas context');
      toast({
        title: "Capture Failed",
        description: "Canvas not supported. Please try a different browser.",
        variant: "destructive",
      });
      return;
    }
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('SITE_VISIT_CAMERA: Video dimensions invalid:', video.videoWidth, 'x', video.videoHeight);
      toast({
        title: "Capture Failed",
        description: "Camera feed not ready. Please wait a moment and try again.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);
      
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      if (photoDataUrl.length < 100) {
        throw new Error('Generated image data too small');
      }
      
      setCapturedPhoto(photoDataUrl);
      
      // Stop camera after successful capture
      stopCamera();
      
      console.log('SITE_VISIT_CAMERA: Photo captured successfully, size:', photoDataUrl.length);
      
      toast({
        title: "Photo Captured",
        description: "Site visit photo captured successfully",
        variant: "default",
      });
    } catch (error) {
      console.error('SITE_VISIT_CAMERA: Photo capture error:', error);
      toast({
        title: "Capture Failed",
        description: "Failed to capture photo. Please try again.",
        variant: "destructive",
      });
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
    console.log('SITE_VISIT_CAMERA: Switching camera from', currentCamera);
    const newCamera = currentCamera === 'front' ? 'back' : 'front';
    setCurrentCamera(newCamera);
    
    if (isCameraActive) {
      stopCamera();
      // Small delay to ensure camera is properly stopped
      setTimeout(() => {
        startCamera();
      }, 300);
    }
  };

  const resetPhoto = () => {
    setCapturedPhoto(null);
    stopCamera();
  };

  const createSiteVisitMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("=== MUTATION STARTED ===");
      console.log("Input data:", JSON.stringify(data, null, 2));
      console.log("Current location:", currentLocation);
      console.log("Captured photo:", capturedPhoto ? 'present' : 'none');
      
      // Upload photo to Cloudinary if provided
      let photoUrl: string | undefined = undefined;
      
      if (capturedPhoto) {
        try {
          console.log("Uploading photo via server-side Cloudinary service...");
          
          const uploadResponse = await apiRequest('/api/attendance/upload-photo', 'POST', {
            imageData: capturedPhoto, // Already base64 encoded
            userId: `site_visit_start_${Date.now()}`, // Unique ID for site visit start photos
            attendanceType: 'site_visit'
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.message || 'Photo upload failed');
          }

          const uploadResult = await uploadResponse.json();
          photoUrl = uploadResult.url;
          console.log("Photo uploaded successfully:", photoUrl);
        } catch (error) {
          console.error('Photo upload failed:', error);
          toast({
            title: "Photo Upload Failed",
            description: error instanceof Error ? error.message : "Could not upload photo. Please try again.",
            variant: "destructive",
          });
          throw error; // Re-throw to stop the mutation
        }
      }

      // Create site visit payload matching the schema exactly
      const siteVisitPayload = {
        visitPurpose: data.visitPurpose,
        siteInTime: new Date(), // Send as Date object for consistency with checkout
        siteInLocation: {
          latitude: currentLocation?.latitude || 0,
          longitude: currentLocation?.longitude || 0,
          accuracy: currentLocation?.accuracy,
          address: currentLocation?.formattedAddress || currentLocation?.address || 'Address not available'
        },
        ...(photoUrl && { siteInPhotoUrl: photoUrl }),
        customer: {
          ...data.customer,
          ebServiceNumber: data.customer.ebServiceNumber || '',
        },
        status: 'in_progress',
        // Include department-specific data with correct field names
        ...(data.technicalData && { technicalData: data.technicalData }),
        ...(data.marketingData && { marketingData: data.marketingData }),
        ...(data.adminData && { adminData: data.adminData }),
        sitePhotos: [],
        notes: data.notes || ''
      };

      console.log("=== FRONTEND SITE VISIT PAYLOAD ===");
      console.log("Payload being sent:", JSON.stringify(siteVisitPayload, null, 2));
      console.log("================================");

      try {
        console.log("Making API request to /api/site-visits...");
        const result = await apiRequest('/api/site-visits', 'POST', siteVisitPayload);
        console.log("API request successful:", result);
        return result;
      } catch (error) {
        console.error("API request failed:", error);
        throw error;
      }
    },
    onSuccess: (result) => {
      console.log("=== MUTATION SUCCESS ===");
      console.log("Result:", result);
      toast({
        title: "Site Visit Started",
        description: "Your site visit has been started successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/site-visits'] });
      onClose();
    },
    onError: (error: any) => {
      console.error("=== MUTATION ERROR ===");
      console.error("Error object:", error);
      console.error("Error message:", error.message);
      console.error("Error response:", error.response);
      toast({
        title: "Error",
        description: error.message || "Failed to start site visit",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    console.log("=== HANDLE SUBMIT STARTED ===");
    console.log("Form data:", JSON.stringify(formData, null, 2));
    console.log("Location captured:", locationCaptured);
    console.log("Current location:", currentLocation);
    console.log("Can proceed to step 4:", canProceedToStep4);
    console.log("Normalized department:", normalizedDepartment);
    
    if (!locationCaptured || !currentLocation) {
      console.log("Validation failed: Location required");
      toast({
        title: "Location Required",
        description: "Please allow location detection to start a site visit",
        variant: "destructive",
      });
      return;
    }

    if (!formData.visitPurpose || !formData.customer.name || !formData.customer.mobile || !formData.customer.address || !formData.customer.propertyType) {
      console.log("Validation failed: Required fields missing");
      toast({
        title: "Required Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate department-specific data
    if (!canProceedToStep4) {
      console.log("Validation failed: Department details required");
      toast({
        title: "Department Details Required",
        description: `Please complete the ${normalizedDepartment} department specific details`,
        variant: "destructive",
      });
      return;
    }

    console.log("All validations passed, calling mutation...");
    createSiteVisitMutation.mutate(formData);
  };

  // Map administration to admin for form logic
  const normalizedDepartment = userDepartment.toLowerCase() === 'administration' ? 'admin' : userDepartment;
  
  const canProceedToStep2 = locationCaptured && formData.visitPurpose;
  const canProceedToStep3 = formData.customer.name && formData.customer.mobile && formData.customer.address && formData.customer.propertyType;
  const canProceedToStep4 = (normalizedDepartment === 'technical' && formData.technicalData) ||
                           (normalizedDepartment === 'marketing' && formData.marketingData) ||
                           (normalizedDepartment === 'admin' && formData.adminData);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Start Site Visit
          </DialogTitle>
          <DialogDescription>
            Follow the steps to start your field site visit for {userDepartment} department
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-primary text-white' : 'bg-muted'}`}>
                1
              </div>
              <span className="text-sm font-medium">Purpose & Location</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-primary text-white' : 'bg-muted'}`}>
                2
              </div>
              <span className="text-sm font-medium">Customer Details</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-primary text-white' : 'bg-muted'}`}>
                3
              </div>
              <span className="text-sm font-medium">{userDepartment.charAt(0).toUpperCase() + userDepartment.slice(1)} Details</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div className={`flex items-center gap-2 ${step >= 4 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 4 ? 'bg-primary text-white' : 'bg-muted'}`}>
                4
              </div>
              <span className="text-sm font-medium">Photo & Confirm</span>
            </div>
          </div>

          {/* Step 1: Purpose Selection & Location */}
          {step === 1 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Visit Purpose</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {visitPurposes.map((purpose) => {
                      const Icon = purpose.icon;
                      return (
                        <Card
                          key={purpose.value}
                          className={`cursor-pointer transition-colors hover:bg-accent ${
                            formData.visitPurpose === purpose.value ? 'ring-2 ring-primary bg-accent' : ''
                          }`}
                          onClick={() => setFormData(prev => ({ ...prev, visitPurpose: purpose.value }))}
                        >
                          <CardContent className="p-4 text-center">
                            <Icon className="h-6 w-6 mx-auto mb-2" />
                            <p className="text-sm font-medium">{purpose.label}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <EnhancedLocationCapture
                onLocationCaptured={handleLocationCaptured}
                onLocationError={handleLocationError}
                title="Site Check-In Location"
                description="We need to detect your current location for site check-in"
                autoDetect={true}
                required={true}
                showAddress={true}
              />

              <div className="flex justify-end">
                <Button
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
                >
                  Next: Customer Details
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Customer Details */}
          {step === 2 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="customerName">Customer Name *</Label>
                    <CustomerAutocomplete
                      value={formData.customer}
                      onChange={(customerData) => setFormData(prev => ({
                        ...prev,
                        customer: { ...prev.customer, ...customerData }
                      }))}
                      placeholder="Start typing customer name or phone number..."
                    />
                  </div>

                  <div>
                    <Label htmlFor="customerMobile">Mobile Number *</Label>
                    <Input
                      id="customerMobile"
                      value={formData.customer.mobile}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        customer: { ...prev.customer, mobile: e.target.value }
                      }))}
                      placeholder="Enter mobile number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="customerAddress">Address *</Label>
                    <Textarea
                      id="customerAddress"
                      value={formData.customer.address}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        customer: { ...prev.customer, address: e.target.value }
                      }))}
                      placeholder="Enter complete address"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="propertyType">Property Type *</Label>
                      <Select
                        value={formData.customer.propertyType}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev,
                          customer: { ...prev.customer, propertyType: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select property type" />
                        </SelectTrigger>
                        <SelectContent>
                          {propertyTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {userDepartment === 'marketing' && (
                      <div>
                        <Label htmlFor="ebServiceNumber">EB Service Number</Label>
                        <Input
                          id="ebServiceNumber"
                          value={formData.customer.ebServiceNumber}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            customer: { ...prev.customer, ebServiceNumber: e.target.value }
                          }))}
                          placeholder="Enter EB service number"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="notes">Additional Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Any additional notes about the visit"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!canProceedToStep3}
                >
                  Next: {userDepartment.charAt(0).toUpperCase() + userDepartment.slice(1)} Details
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Department-Specific Forms */}
          {step === 3 && (
            <div className="space-y-4">
              {normalizedDepartment === 'technical' && (
                <ErrorBoundary>
                  <TechnicalSiteVisitForm 
                    onSubmit={(data) => {
                      setFormData(prev => ({ ...prev, technicalData: data, marketingData: null, adminData: null }));
                      setStep(4);
                    }}
                    onBack={() => setStep(2)}
                    isDisabled={false}
                  />
                </ErrorBoundary>
              )}
              
              {normalizedDepartment === 'marketing' && (
                <ErrorBoundary>
                  <MarketingSiteVisitForm 
                    onSubmit={(data) => {
                      setFormData(prev => ({ ...prev, marketingData: data, technicalData: null, adminData: null }));
                      setStep(4);
                    }}
                    onBack={() => setStep(2)}
                    isDisabled={false}
                  />
                </ErrorBoundary>
              )}
              
              {normalizedDepartment === 'admin' && (
                <ErrorBoundary>
                  <AdminSiteVisitForm 
                    onSubmit={(data) => {
                      setFormData(prev => ({ ...prev, adminData: data, technicalData: null, marketingData: null }));
                      setStep(4);
                    }}
                    onBack={() => setStep(2)}
                    isDisabled={false}
                  />
                </ErrorBoundary>
              )}
            </div>
          )}

          {/* Step 4: Photo & Confirmation */}
          {step === 4 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Site In Photo
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
                          Start Camera
                        </Button>
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                          <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Take a live photo of the site with location and timestamp
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
                            alt="Captured site photo"
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
                  </div>
                </CardContent>
              </Card>

              {/* Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Visit Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Purpose:</span>
                    <Badge variant="outline">{formData.visitPurpose}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{formData.customer.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mobile:</span>
                    <span>{formData.customer.mobile}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Property Type:</span>
                    <span className="capitalize">{formData.customer.propertyType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location:</span>
                    <span className="text-green-600">Acquired</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)}>
                  Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createSiteVisitMutation.isPending}
                >
                  {createSiteVisitMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Starting Visit...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Start Site Visit
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