/**
 * Site Visit Checkout Modal
 * Handles the site visit checkout process with location and photo verification
 */

import { useState, useEffect } from "react";
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
  AlertTriangle
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
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [lastErrorMessage, setLastErrorMessage] = useState<string>('');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCurrentLocation(null);
      setLocationCaptured(false);
      setSelectedPhoto(null);
      setPhotoPreview(null);
      setNotes('');
      setLastErrorMessage('');
    }
  }, [isOpen]);

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

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: async (data: any) => {
      // Upload photo to Cloudinary if provided
      let photoUrl = 'https://via.placeholder.com/400x300.jpg?text=No+Photo';
      
      if (selectedPhoto) {
        try {
          const formData = new FormData();
          formData.append('file', selectedPhoto);
          formData.append('upload_preset', 'attendance_photos');
          formData.append('folder', 'site_visits');

          const response = await fetch('https://api.cloudinary.com/v1_1/dpmcthtrb/image/upload', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Photo upload failed: ${response.statusText}`);
          }

          const result = await response.json();
          photoUrl = result.secure_url;
        } catch (error) {
          console.error('Photo upload failed:', error);
          toast({
            title: "Photo Upload Failed",
            description: "Could not upload photo. Please try again.",
            variant: "destructive",
          });
          return;
        }
      }

      // Create checkout payload
      const checkoutPayload = {
        status: 'completed',
        siteOutTime: new Date().toISOString(),
        checkoutLocation: currentLocation,
        checkoutPhoto: photoUrl,
        completionNotes: notes,
        updatedAt: new Date().toISOString()
      };

      return apiRequest(`/api/site-visits/${siteVisit.id}`, {
        method: 'PATCH',
        body: JSON.stringify(checkoutPayload),
      });
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
    onError: (error) => {
      console.error('Checkout failed:', error);
      toast({
        title: "Checkout Failed",
        description: "Could not complete site visit. Please try again.",
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
  const canCheckout = locationCaptured && selectedPhoto;

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
                  <CardTitle className="text-lg">Site Out Photo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="checkoutPhoto">Take Final Site Photo</Label>
                      <Input
                        id="checkoutPhoto"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoCapture}
                      />
                    </div>

                    {photoPreview && (
                      <div className="relative">
                        <img
                          src={photoPreview}
                          alt="Checkout photo preview"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Badge className="absolute top-2 right-2">
                          Preview
                        </Badge>
                      </div>
                    )}

                    {!photoPreview && (
                      <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                        <Camera className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Final photo will be taken with location and timestamp
                        </p>
                      </div>
                    )}
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
      </DialogContent>
    </Dialog>
  );
}

export default SiteVisitCheckoutModal;