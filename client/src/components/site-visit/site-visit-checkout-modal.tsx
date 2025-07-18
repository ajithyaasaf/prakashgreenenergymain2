/**
 * Site Visit Checkout Modal
 * Handles the completion of a site visit with photos and final remarks
 */

import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  MapPin, 
  Camera, 
  CheckCircle, 
  Clock,
  Upload,
  X,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { EnhancedLocationCapture } from "./enhanced-location-capture";
import { LocationData } from "@/lib/location-service";

interface SiteVisit {
  id: string;
  userId: string;
  department: 'technical' | 'marketing' | 'admin';
  visitPurpose: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  siteInTime: string;
  customer: {
    name: string;
    mobile: string;
    address: string;
  };
  notes?: string;
}

interface SiteVisitCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteVisit: SiteVisit;
}

interface PhotoUpload {
  file: File;
  preview: string;
  description: string;
}

export function SiteVisitCheckoutModal({ isOpen, onClose, siteVisit }: SiteVisitCheckoutModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [finalRemarks, setFinalRemarks] = useState('');
  const [photos, setPhotos] = useState<PhotoUpload[]>([]);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [locationCaptured, setLocationCaptured] = useState(false);

  const handleLocationCaptured = (location: LocationData) => {
    setCurrentLocation(location);
    setLocationCaptured(true);
  };

  const handleLocationError = (error: string) => {
    toast({
      title: "Location Error",
      description: error,
      variant: "destructive",
    });
    setLocationCaptured(false);
  };

  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotos(prev => [...prev, {
            file,
            preview: e.target?.result as string,
            description: ''
          }]);
        };
        reader.readAsDataURL(file);
      }
    });

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const updatePhotoDescription = (index: number, description: string) => {
    setPhotos(prev => prev.map((photo, i) => 
      i === index ? { ...photo, description } : photo
    ));
  };

  const checkoutSiteVisitMutation = useMutation({
    mutationFn: async () => {
      if (!currentLocation) {
        throw new Error('Location is required for checkout');
      }

      // Upload photos first if any
      const uploadedPhotos = [];
      
      for (const photo of photos) {
        try {
          const formData = new FormData();
          formData.append('file', photo.file);
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
          uploadedPhotos.push({
            url: result.secure_url,
            timestamp: new Date(),
            description: photo.description || 'Site visit photo'
          });
        } catch (error) {
          console.error('Photo upload failed:', error);
          // Continue with other photos even if one fails
        }
      }

      // Update site visit with checkout data
      return apiRequest(`/api/site-visits/${siteVisit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'completed',
          siteOutTime: new Date(),
          siteOutLocation: currentLocation,
          finalRemarks,
          sitePhotos: uploadedPhotos,
          completedAt: new Date()
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Site Visit Completed",
        description: "Your site visit has been completed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/site-visits'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to complete site visit",
        variant: "destructive",
      });
    },
  });

  const handleCheckout = () => {
    if (!locationCaptured || !currentLocation) {
      toast({
        title: "Location Required",
        description: "Please allow location detection to complete the site visit",
        variant: "destructive",
      });
      return;
    }

    if (finalRemarks.trim().length < 10) {
      toast({
        title: "Final Remarks Required",
        description: "Please provide detailed final remarks (at least 10 characters)",
        variant: "destructive",
      });
      return;
    }

    checkoutSiteVisitMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Complete Site Visit
          </DialogTitle>
          <DialogDescription>
            Finalize your site visit with photos and remarks
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Visit Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Visit Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p className="font-medium">{siteVisit.customer.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purpose</p>
                  <Badge variant="secondary">{siteVisit.visitPurpose}</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Started At</p>
                  <p className="font-medium">{format(new Date(siteVisit.siteInTime), 'PPP p')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">
                    {(() => {
                      const start = new Date(siteVisit.siteInTime);
                      const now = new Date();
                      const diffHours = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60));
                      const diffMinutes = Math.floor(((now.getTime() - start.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
                      return `${diffHours}h ${diffMinutes}m`;
                    })()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <EnhancedLocationCapture
            onLocationCaptured={handleLocationCaptured}
            onLocationError={handleLocationError}
            title="Site Checkout Location"
            description="We need to capture your location for site checkout"
            autoDetect={true}
            required={true}
            showAddress={true}
          />

          {/* Photo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Site Photos ({photos.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add Photos
                </Button>
              </div>

              {photos.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {photos.map((photo, index) => (
                    <div key={index} className="space-y-2">
                      <div className="relative">
                        <img
                          src={photo.preview}
                          alt={`Site photo ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-2 right-2 h-6 w-6 p-0"
                          onClick={() => removePhoto(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Photo description (optional)"
                        value={photo.description}
                        onChange={(e) => updatePhotoDescription(index, e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Final Remarks */}
          <Card>
            <CardHeader>
              <CardTitle>Final Remarks *</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={finalRemarks}
                onChange={(e) => setFinalRemarks(e.target.value)}
                placeholder="Summarize the work completed, findings, next steps, or any important notes about this site visit..."
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {finalRemarks.length}/10 characters minimum
              </p>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={checkoutSiteVisitMutation.isPending || !locationCaptured || finalRemarks.trim().length < 10}
            >
              {checkoutSiteVisitMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Complete Site Visit
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}