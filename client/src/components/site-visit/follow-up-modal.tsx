/**
 * Enhanced Follow-up Site Visit Modal
 * Advanced follow-up system with timeline view and better UX
 */

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { locationService, LocationStatus } from "@/lib/location-service";
import { 
  MapPin, Camera, User, Phone, MapPinIcon, Clock, RefreshCw, Upload,
  ArrowRight, History, AlertCircle, CheckCircle, Calendar, 
  FileText, Building, Zap, Users
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

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
  siteOutTime?: string;
  status: string;
  followUpCount?: number;
  isFollowUp?: boolean;
  followUpOf?: string;
  followUpReason?: string;
  notes?: string;
  technicalData?: any;
  marketingData?: any;
  adminData?: any;
}

interface FollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalVisit: SiteVisit | null;
}

const followUpReasons = [
  { 
    value: "additional_work_required", 
    label: "Additional Work Required",
    description: "More work needed to complete the task",
    icon: Zap,
    color: "bg-orange-100 text-orange-800 border-orange-200"
  },
  { 
    value: "issue_resolution", 
    label: "Issue Resolution",
    description: "Follow-up to resolve reported issues",
    icon: AlertCircle,
    color: "bg-red-100 text-red-800 border-red-200"
  },
  { 
    value: "status_check", 
    label: "Status Check",
    description: "Regular check on project progress",
    icon: CheckCircle,
    color: "bg-blue-100 text-blue-800 border-blue-200"
  },
  { 
    value: "customer_request", 
    label: "Customer Request",
    description: "Follow-up requested by customer",
    icon: User,
    color: "bg-green-100 text-green-800 border-green-200"
  },
  { 
    value: "maintenance", 
    label: "Maintenance",
    description: "Scheduled maintenance visit",
    icon: Clock,
    color: "bg-purple-100 text-purple-800 border-purple-200"
  },
  { 
    value: "other", 
    label: "Other",
    description: "Other follow-up requirement",
    icon: FileText,
    color: "bg-gray-100 text-gray-800 border-gray-200"
  }
];

// Follow-up templates for quick creation
const followUpTemplates = {
  technical: [
    { reason: "additional_work_required", description: "Additional technical work required to complete installation." },
    { reason: "issue_resolution", description: "Technical issue reported - need to investigate and resolve." },
    { reason: "maintenance", description: "Scheduled maintenance check for installed system." }
  ],
  marketing: [
    { reason: "customer_request", description: "Customer requested follow-up meeting for project discussion." },
    { reason: "status_check", description: "Follow-up to check project status and customer satisfaction." },
    { reason: "additional_work_required", description: "Additional project requirements identified during initial visit." }
  ],
  admin: [
    { reason: "status_check", description: "Follow-up on bank process or EB office documentation status." },
    { reason: "customer_request", description: "Customer requested update on administrative processes." },
    { reason: "issue_resolution", description: "Administrative issue needs resolution - follow-up required." }
  ]
};

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
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch visit history for the customer  
  const { data: visitHistory } = useQuery({
    queryKey: ['/api/site-visits/customer-history', originalVisit?.customer.mobile],
    queryFn: async () => {
      if (!originalVisit?.customer.mobile) return [];
      
      try {
        // Get fresh token from Firebase Auth
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        if (!currentUser) {
          console.warn('No authenticated user found');
          return [];
        }
        
        const token = await currentUser.getIdToken(true); // Force refresh
        
        const response = await fetch(`/api/site-visits/customer-history?mobile=${encodeURIComponent(originalVisit.customer.mobile)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.warn('Customer history fetch failed:', response.status, response.statusText);
          return []; // Return empty array instead of throwing error
        }
        
        return response.json();
      } catch (error) {
        console.warn('Customer history query failed:', error);
        return [];
      }
    },
    enabled: isOpen && !!originalVisit?.customer.mobile,
    retry: false, // Don't retry failed requests automatically
  });

  // Auto-detect location when modal opens and reset form
  useEffect(() => {
    if (isOpen && originalVisit) {
      detectLocation();
      // Reset form state
      setCurrentStep(1);
      setFollowUpReason("");
      setDescription("");
      setSelectedTemplate("");
      setSelectedPhoto(null);
      setPhotoPreview(null);
    }
  }, [isOpen, originalVisit]);

  const detectLocation = async () => {
    setLocationStatus({ status: 'detecting', location: null });
    
    try {
      console.log('🔍 Starting location detection for follow-up...');
      const result = await locationService.detectLocation();
      
      console.log('📍 Location detection result:', result);
      
      if (result.status === 'granted' && result.location) {
        console.log('✅ Follow-up location detected successfully:', {
          address: result.location.address,
          formattedAddress: result.location.formattedAddress,
          coordinates: `${result.location.latitude}, ${result.location.longitude}`,
          accuracy: result.location.accuracy
        });
        
        setLocationStatus(result);
      } else {
        console.error('❌ Location detection failed:', result.error);
        setLocationStatus({ 
          status: result.status,
          location: null,
          error: result.error || 'Location detection failed'
        });
      }
    } catch (error) {
      console.error('❌ Location service error:', error);
      setLocationStatus({ 
        status: 'error',
        location: null,
        error: 'Location service unavailable'
      });
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

  // Handle template selection
  const handleTemplateSelect = (template: any) => {
    setFollowUpReason(template.reason);
    setDescription(template.description);
    setSelectedTemplate(template.reason);
  };

  // Get department-specific templates
  const getDepartmentTemplates = () => {
    const department = originalVisit?.department as keyof typeof followUpTemplates;
    return followUpTemplates[department] || followUpTemplates.technical;
  };

  // Format visit time for display
  const formatVisitTime = (timeString: string) => {
    const date = new Date(timeString);
    return {
      date: format(date, 'MMM dd, yyyy'),
      time: format(date, 'h:mm a'),
      relative: formatDistanceToNow(date, { addSuffix: true })
    };
  };

  // Handle close with confirmation
  const handleCloseWithConfirmation = () => {
    if (followUpReason || description) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
        handleClose();
      }
    } else {
      handleClose();
    }
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
    <Dialog open={isOpen} onOpenChange={handleCloseWithConfirmation}>
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
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {locationStatus.location.formattedAddress || locationStatus.location.address}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Accuracy: {Math.round(locationStatus.location.accuracy)}m</span>
                        <span>•</span>
                        <span>
                          {locationStatus.location.latitude.toFixed(6)}, {locationStatus.location.longitude.toFixed(6)}
                        </span>
                      </div>
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

          {/* Visit Timeline */}
          {visitHistory && visitHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Visit History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {visitHistory.map((visit: any, index: number) => (
                      <div key={visit.id} className="flex items-center gap-3 p-2 rounded border">
                        <div className={`w-2 h-2 rounded-full ${
                          visit.status === 'completed' ? 'bg-green-500' : 
                          visit.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-400'
                        }`} />
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <span className="font-medium text-sm">
                              {visit.isFollowUp ? 'Follow-up' : 'Original'} - {visit.visitPurpose}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatVisitTime(visit.siteInTime).relative}
                            </span>
                          </div>
                          {visit.followUpReason && (
                            <span className="text-xs text-muted-foreground">
                              Reason: {visit.followUpReason.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Quick Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Templates</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select a template to quickly fill follow-up details for {originalVisit.department} department
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2">
                {getDepartmentTemplates().map((template) => (
                  <Button
                    key={template.reason}
                    variant={selectedTemplate === template.reason ? "default" : "outline"}
                    className="justify-start h-auto p-3"
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <div className="text-left">
                      <div className="font-medium">
                        {followUpReasons.find(r => r.value === template.reason)?.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {template.description}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Follow-up Details */}
          <Card>
            <CardHeader>
              <CardTitle>Follow-up Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reason Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Follow-up Reason *</label>
                <Select value={followUpReason} onValueChange={setFollowUpReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason for follow-up" />
                  </SelectTrigger>
                  <SelectContent>
                    {followUpReasons.map((reason) => {
                      const IconComponent = reason.icon;
                      return (
                        <SelectItem key={reason.value} value={reason.value}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            <div>
                              <div className="font-medium">{reason.label}</div>
                              <div className="text-xs text-muted-foreground">
                                {reason.description}
                              </div>
                            </div>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Description * 
                  <span className="text-muted-foreground">
                    ({description.length}/100 characters)
                  </span>
                </label>
                <Textarea
                  placeholder="Describe the reason for this follow-up visit..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={100}
                  rows={3}
                  className={description.length < 10 ? "border-red-300" : ""}
                />
                {description.length < 10 && description.length > 0 && (
                  <p className="text-xs text-red-600">
                    Description must be at least 10 characters
                  </p>
                )}
              </div>
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

          {/* Actions */}
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleCloseWithConfirmation}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !locationStatus.location || !followUpReason || description.length < 10}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Creating Follow-up...' : 'Start Follow-up Visit'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}