/**
 * Follow-up Site Visit Modal
 * Simplified modal for creating follow-up visits to existing sites
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { locationService, LocationStatus } from "@/lib/location-service";
import { MapPin, Camera, User, Phone, MapPinIcon, Clock, RefreshCw, Upload } from "lucide-react";
import { format } from "date-fns";

interface SiteVisit {
  id: string;
  customer: {
    name: string;
    mobile: string;
    address: string;
    propertyType: string;
    ebServiceNumber?: string;
  };
  visitPurpose: string;
  department: string;
  siteInTime: string;
  status: string;
  followUpCount?: number;
}

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalVisit: SiteVisit | null;
}

const followUpReasons = [
  { value: "additional_work_required", label: "Additional Work Required" },
  { value: "issue_resolution", label: "Issue Resolution" },
  { value: "status_check", label: "Status Check" },
  { value: "customer_request", label: "Customer Request" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" }
];

export function FollowUpModal({ isOpen, onClose, originalVisit }: FollowUpModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>({
    status: 'detecting',
    location: null
  });
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [followUpReason, setFollowUpReason] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auto-detect location when modal opens
  useEffect(() => {
    if (isOpen && originalVisit) {
      detectLocation();
    }
  }, [isOpen, originalVisit]);

  const detectLocation = async () => {
    setLocationStatus({ status: 'detecting', location: null });
    const result = await locationService.detectLocation();
    setLocationStatus(result);
    
    if (result.status === 'granted') {
      console.log('✅ Follow-up location detected:', result.location?.address);
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => setPhotoPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
  };

  const createFollowUpMutation = useMutation({
    mutationFn: async (data: any) => {
      // Upload photo to Cloudinary if provided
      let photoUrl: string | undefined = undefined;
      
      if (selectedPhoto) {
        try {
          const formData = new FormData();
          formData.append('file', selectedPhoto);
          formData.append('upload_preset', 'attendance_photos');
          formData.append('folder', 'site_visits/follow_ups');

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
          throw new Error('Failed to upload photo');
        }
      }

      return apiRequest('/api/site-visits/follow-up', 'POST', {
        originalVisitId: originalVisit!.id,
        siteInLocation: locationStatus.location,
        siteInPhotoUrl: photoUrl,
        followUpReason,
        description
      });
    },
    onSuccess: () => {
      toast({
        title: "Follow-up Created",
        description: `Follow-up visit started for ${originalVisit?.customer.name}`,
      });
      
      // Invalidate queries to refresh the site visits list
      queryClient.invalidateQueries({ queryKey: ['/api/site-visits'] });
      queryClient.invalidateQueries({ queryKey: ['/api/site-visits/stats'] });
      
      handleClose();
    },
    onError: (error: any) => {
      console.error('Follow-up creation failed:', error);
      toast({
        title: "Follow-up Failed",
        description: error.message || "Failed to create follow-up visit",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async () => {
    if (!locationStatus.location) {
      toast({
        title: "Location Required",
        description: "Please allow location access to continue",
        variant: "destructive",
      });
      return;
    }

    if (!followUpReason) {
      toast({
        title: "Reason Required",
        description: "Please select a reason for the follow-up",
        variant: "destructive",
      });
      return;
    }

    if (description.length < 10) {
      toast({
        title: "Description Required",
        description: "Please provide a description of at least 10 characters",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await createFollowUpMutation.mutateAsync({});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setLocationStatus({ status: 'detecting', location: null });
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setFollowUpReason("");
    setDescription("");
    setIsSubmitting(false);
    onClose();
  };

  if (!originalVisit) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            Follow-up Visit
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Original Visit Info */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Original Visit Details</CardTitle>
                <Badge variant="outline">
                  Follow-up #{(originalVisit.followUpCount || 0) + 1}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{originalVisit.customer.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{originalVisit.customer.mobile}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPinIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{originalVisit.customer.address}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(new Date(originalVisit.siteInTime), 'MMM dd, yyyy')}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Detection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Current Location</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={detectLocation}
                  disabled={locationStatus.status === 'detecting'}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  {locationStatus.status === 'detecting' ? 'Detecting...' : 'Get Location'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {locationStatus.status === 'detecting' && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Detecting your current location...</span>
                </div>
              )}
              
              {locationStatus.status === 'granted' && locationStatus.location && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium">{locationStatus.location.address}</p>
                      <p className="text-sm text-muted-foreground">
                        Accuracy: {Math.round(locationStatus.location.accuracy)}m
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {locationStatus.status === 'denied' && (
                <div className="text-red-600 text-sm">
                  <p>{locationStatus.error}</p>
                </div>
              )}
              
              {locationStatus.status === 'error' && (
                <div className="text-amber-600 text-sm">
                  <p>{locationStatus.error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Photo Upload (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle>Photo (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedPhoto ? (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                  <Camera className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload a photo for this follow-up visit
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                    id="photo-upload"
                  />
                  <label htmlFor="photo-upload">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Photo
                      </span>
                    </Button>
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <img
                      src={photoPreview!}
                      alt="Selected photo"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={removePhoto}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Follow-up Details */}
          <Card>
            <CardHeader>
              <CardTitle>Follow-up Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Follow-up Reason *
                </label>
                <Select value={followUpReason} onValueChange={setFollowUpReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason for follow-up" />
                  </SelectTrigger>
                  <SelectContent>
                    {followUpReasons.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Description *
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the work or purpose of this follow-up visit..."
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {description.length}/10 characters minimum
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !locationStatus.location || !followUpReason || description.length < 10}
            >
              {isSubmitting ? 'Creating Follow-up...' : 'Start Follow-up Visit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}