/**
 * Site Visit Start Modal
 * Handles the initial site visit creation workflow
 */

import { useState, useEffect } from "react";
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
  Zap
} from "lucide-react";

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
  const [locationPermission, setLocationPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    visitPurpose: '',
    customer: {
      name: '',
      mobile: '',
      address: '',
      ebServiceNumber: '',
      propertyType: '',
    },
    notes: ''
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setLocationPermission('pending');
      setCurrentLocation(null);
      setSelectedPhoto(null);
      setPhotoPreview(null);
      setFormData({
        visitPurpose: '',
        customer: {
          name: '',
          mobile: '',
          address: '',
          ebServiceNumber: '',
          propertyType: '',
        },
        notes: ''
      });
      requestLocationPermission();
    }
  }, [isOpen]);

  const requestLocationPermission = async () => {
    if (!navigator.geolocation) {
      setLocationPermission('denied');
      toast({
        title: "Location Not Supported",
        description: "Your device doesn't support location services",
        variant: "destructive",
      });
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000
        });
      });

      setCurrentLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      setLocationPermission('granted');
    } catch (error) {
      console.error('Location permission denied:', error);
      setLocationPermission('denied');
      toast({
        title: "Location Required",
        description: "Location permission is required to start a site visit",
        variant: "destructive",
      });
    }
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

  const createSiteVisitMutation = useMutation({
    mutationFn: async (data: any) => {
      // First upload photo to Cloudinary if selected
      let photoUrl = '';
      if (selectedPhoto) {
        const formData = new FormData();
        formData.append('file', selectedPhoto);
        formData.append('upload_preset', 'site_visits'); // You'll need to configure this in Cloudinary
        
        try {
          const response = await fetch(
            `https://api.cloudinary.com/v1_1/your_cloud_name/image/upload`, // Replace with your Cloudinary URL
            {
              method: 'POST',
              body: formData,
            }
          );
          const result = await response.json();
          photoUrl = result.secure_url;
        } catch (error) {
          console.error('Photo upload failed:', error);
          throw new Error('Failed to upload photo');
        }
      }

      // Create site visit
      return apiRequest('/api/site-visits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          siteInPhotoUrl: photoUrl || 'https://via.placeholder.com/400x300?text=Site+Photo', // Fallback
          siteInTime: new Date(),
          siteInLocation: currentLocation,
          status: 'in_progress'
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Site Visit Started",
        description: "Your site visit has been started successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/site-visits'] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start site visit",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!currentLocation) {
      toast({
        title: "Location Required",
        description: "Please enable location services to start a site visit",
        variant: "destructive",
      });
      return;
    }

    if (!formData.visitPurpose || !formData.customer.name || !formData.customer.mobile || !formData.customer.address || !formData.customer.propertyType) {
      toast({
        title: "Required Fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    createSiteVisitMutation.mutate(formData);
  };

  const canProceedToStep2 = locationPermission === 'granted' && formData.visitPurpose;
  const canProceedToStep3 = formData.customer.name && formData.customer.mobile && formData.customer.address && formData.customer.propertyType;

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

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Location Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    {locationPermission === 'pending' && (
                      <>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        <span>Requesting location permission...</span>
                      </>
                    )}
                    {locationPermission === 'granted' && (
                      <>
                        <CheckCircle className="h-6 w-6 text-green-600" />
                        <div>
                          <p className="font-medium">Location Acquired</p>
                          <p className="text-sm text-muted-foreground">
                            Accuracy: {currentLocation?.accuracy ? `${Math.round(currentLocation.accuracy)}m` : 'Unknown'}
                          </p>
                        </div>
                      </>
                    )}
                    {locationPermission === 'denied' && (
                      <>
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                        <div>
                          <p className="font-medium text-red-600">Location Required</p>
                          <p className="text-sm text-muted-foreground">Please enable location services</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={requestLocationPermission}
                        >
                          Retry
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customerName">Customer Name *</Label>
                      <Input
                        id="customerName"
                        value={formData.customer.name}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          customer: { ...prev.customer, name: e.target.value }
                        }))}
                        placeholder="Enter customer name"
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
                  Next: Photo & Confirm
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Photo & Confirmation */}
          {step === 3 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Site In Photo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sitePhoto">Take Site Photo</Label>
                      <Input
                        id="sitePhoto"
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
                          alt="Site photo preview"
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
                          Photo will be taken with location and timestamp
                        </p>
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
                <Button variant="outline" onClick={() => setStep(2)}>
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
      </DialogContent>
    </Dialog>
  );
}