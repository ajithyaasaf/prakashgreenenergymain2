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
import { TechnicalSiteVisitForm } from "./technical-site-visit-form";
import { MarketingSiteVisitForm } from "./marketing-site-visit-form";
import { AdminSiteVisitForm } from "./admin-site-visit-form";
import { EnhancedLocationCapture } from "./enhanced-location-capture";
import { LocationData } from "@/lib/location-service";

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
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [lastErrorMessage, setLastErrorMessage] = useState<string>('');
  
  const [formData, setFormData] = useState({
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

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCurrentLocation(null);
      setLocationCaptured(false);
      setSelectedPhoto(null);
      setPhotoPreview(null);
      setLastErrorMessage(''); // Clear previous error message
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
      // Create site visit payload
      const siteVisitPayload = {
        ...data,
        siteInPhotoUrl: selectedPhoto ? 'Photo captured locally' : '', // Photo handling disabled temporarily
        siteInTime: new Date(),
        siteInLocation: currentLocation,
        status: 'in_progress',
        // Include department-specific data
        technicalSiteVisit: data.technicalData,
        marketingSiteVisit: data.marketingData,
        adminSiteVisit: data.adminData,
        departmentType: userDepartment
      };

      // Use apiRequest correctly with url, method, and data parameters
      return apiRequest('/api/site-visits', 'POST', siteVisitPayload);
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
    if (!locationCaptured || !currentLocation) {
      toast({
        title: "Location Required",
        description: "Please allow location detection to start a site visit",
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

    // Validate department-specific data
    if (!canProceedToStep4) {
      toast({
        title: "Department Details Required",
        description: `Please complete the ${userDepartment} department specific details`,
        variant: "destructive",
      });
      return;
    }

    createSiteVisitMutation.mutate(formData);
  };

  const canProceedToStep2 = locationCaptured && formData.visitPurpose;
  const canProceedToStep3 = formData.customer.name && formData.customer.mobile && formData.customer.address && formData.customer.propertyType;
  const canProceedToStep4 = (userDepartment === 'technical' && formData.technicalData) ||
                           (userDepartment === 'marketing' && formData.marketingData) ||
                           (userDepartment === 'admin' && formData.adminData);

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
                  Next: {userDepartment.charAt(0).toUpperCase() + userDepartment.slice(1)} Details
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Department-Specific Forms */}
          {step === 3 && (
            <div className="space-y-4">
              {userDepartment === 'technical' && (
                <TechnicalSiteVisitForm 
                  onSubmit={(data) => {
                    setFormData(prev => ({ ...prev, technicalData: data }));
                    setStep(4);
                  }}
                  onBack={() => setStep(2)}
                  isLoading={false}
                />
              )}
              
              {userDepartment === 'marketing' && (
                <MarketingSiteVisitForm 
                  onSubmit={(data) => {
                    setFormData(prev => ({ ...prev, marketingData: data }));
                    setStep(4);
                  }}
                  onBack={() => setStep(2)}
                  isLoading={false}
                />
              )}
              
              {userDepartment === 'admin' && (
                <AdminSiteVisitForm 
                  onSubmit={(data) => {
                    setFormData(prev => ({ ...prev, adminData: data }));
                    setStep(4);
                  }}
                  onBack={() => setStep(2)}
                  isLoading={false}
                />
              )}
            </div>
          )}

          {/* Step 4: Photo & Confirmation */}
          {step === 4 && (
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
      </DialogContent>
    </Dialog>
  );
}