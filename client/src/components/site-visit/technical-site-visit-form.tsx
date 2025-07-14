/**
 * Technical Department Site Visit Form
 * Handles technical-specific fields as per specifications
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  Users, 
  CheckCircle, 
  AlertTriangle,
  Wrench,
  Settings,
  Camera,
  MapPin
} from "lucide-react";
import { serviceTypes, technicalWorkTypes, workingStatus } from "@shared/schema";

interface TechnicalSiteVisitFormProps {
  onSubmit: (data: TechnicalFormData) => void;
  onBack: () => void;
  isLoading?: boolean;
}

interface TechnicalFormData {
  serviceTypes: string[];
  workType: string;
  workingStatus: string;
  pendingRemarks?: string;
  teamMembers: string[];
  description?: string;
}

// Service types with user-friendly labels
const serviceTypeOptions = [
  { value: 'on_grid', label: 'On-grid', description: 'Grid-tied solar system' },
  { value: 'off_grid', label: 'Off-grid', description: 'Standalone solar system' },
  { value: 'hybrid', label: 'Hybrid', description: 'Grid-tied with battery backup' },
  { value: 'solar_panel', label: 'Solar Panel', description: 'Panel installation/maintenance' },
  { value: 'camera', label: 'Camera', description: 'Security camera systems' },
  { value: 'water_pump', label: 'Water Pump', description: 'Solar water pumping system' },
  { value: 'water_heater', label: 'Water Heater', description: 'Solar water heating system' },
  { value: 'lights_accessories', label: 'Lights & Accessories', description: 'LED lights and accessories' },
  { value: 'others', label: 'Others', description: 'Other technical services' }
];

// Work types with categories
const workTypeOptions = [
  { 
    category: 'Installation & Setup',
    items: [
      { value: 'installation', label: 'Installation' },
      { value: 'wifi_configuration', label: 'WiFi Configuration' },
      { value: 'structure', label: 'Structure Work' },
      { value: 'welding_work', label: 'Welding Work' }
    ]
  },
  {
    category: 'Maintenance & Service',
    items: [
      { value: 'amc', label: 'AMC (Annual Maintenance)' },
      { value: 'service', label: 'Service' },
      { value: 'repair', label: 'Repair' },
      { value: 'cleaning', label: 'Cleaning' }
    ]
  },
  {
    category: 'Troubleshooting',
    items: [
      { value: 'electrical_fault', label: 'Electrical Fault' },
      { value: 'inverter_fault', label: 'Inverter Fault' },
      { value: 'solar_panel_fault', label: 'Solar Panel Fault' },
      { value: 'wiring_issue', label: 'Wiring Issue' },
      { value: 'camera_fault', label: 'Camera Fault' },
      { value: 'light_fault', label: 'Light Fault' }
    ]
  },
  {
    category: 'Other Services',
    items: [
      { value: 'site_visit', label: 'Site Visit' },
      { value: 'light_installation', label: 'Light Installation' },
      { value: 'painting', label: 'Painting' },
      { value: 'others', label: 'Others' }
    ]
  }
];

// Common team members (can be customized per organization)
const commonTeamMembers = [
  'Team Leader',
  'Senior Technician',
  'Technician',
  'Junior Technician',
  'Welder',
  'Helper',
  'Electrician'
];

export function TechnicalSiteVisitForm({ onSubmit, onBack, isLoading }: TechnicalSiteVisitFormProps) {
  const [formData, setFormData] = useState<TechnicalFormData>({
    serviceTypes: [],
    workType: '',
    workingStatus: '',
    pendingRemarks: '',
    teamMembers: [],
    description: ''
  });

  const [customTeamMember, setCustomTeamMember] = useState('');

  const handleServiceTypeChange = (serviceType: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      serviceTypes: checked 
        ? [...prev.serviceTypes, serviceType]
        : prev.serviceTypes.filter(type => type !== serviceType)
    }));
  };

  const handleTeamMemberChange = (member: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: checked 
        ? [...prev.teamMembers, member]
        : prev.teamMembers.filter(m => m !== member)
    }));
  };

  const addCustomTeamMember = () => {
    if (customTeamMember.trim() && !formData.teamMembers.includes(customTeamMember.trim())) {
      setFormData(prev => ({
        ...prev,
        teamMembers: [...prev.teamMembers, customTeamMember.trim()]
      }));
      setCustomTeamMember('');
    }
  };

  const removeTeamMember = (member: string) => {
    setFormData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.filter(m => m !== member)
    }));
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const isFormValid = formData.serviceTypes.length > 0 && 
                     formData.workType && 
                     formData.workingStatus &&
                     (formData.workingStatus === 'completed' || formData.pendingRemarks?.trim());

  return (
    <div className="space-y-6">
      {/* Service Types Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Service Types
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select all applicable service types for this site visit:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {serviceTypeOptions.map((service) => (
                <div key={service.value} className="flex items-start space-x-3">
                  <Checkbox
                    id={service.value}
                    checked={formData.serviceTypes.includes(service.value)}
                    onCheckedChange={(checked) => 
                      handleServiceTypeChange(service.value, checked as boolean)
                    }
                  />
                  <div className="space-y-1">
                    <Label htmlFor={service.value} className="text-sm font-medium">
                      {service.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {service.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {formData.serviceTypes.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-muted-foreground mb-2">Selected:</p>
                <div className="flex flex-wrap gap-2">
                  {formData.serviceTypes.map((type) => (
                    <Badge key={type} variant="secondary">
                      {serviceTypeOptions.find(s => s.value === type)?.label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Type of Work */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Type of Work
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={formData.workType} onValueChange={(value) => 
            setFormData(prev => ({ ...prev, workType: value }))
          }>
            <SelectTrigger>
              <SelectValue placeholder="Select the type of work performed" />
            </SelectTrigger>
            <SelectContent>
              {workTypeOptions.map((category) => (
                <div key={category.category}>
                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                    {category.category}
                  </div>
                  {category.items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                  <Separator className="my-1" />
                </div>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Working Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Working Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup 
            value={formData.workingStatus} 
            onValueChange={(value) => 
              setFormData(prev => ({ ...prev, workingStatus: value }))
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pending" id="pending" />
              <Label htmlFor="pending" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Pending
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="completed" id="completed" />
              <Label htmlFor="completed" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Completed
              </Label>
            </div>
          </RadioGroup>

          {/* Pending Remarks */}
          {formData.workingStatus === 'pending' && (
            <div className="mt-4">
              <Label htmlFor="pendingRemarks">Pending Remarks *</Label>
              <Textarea
                id="pendingRemarks"
                value={formData.pendingRemarks}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  pendingRemarks: e.target.value 
                }))}
                placeholder="Describe what work is pending and why..."
                className="mt-1"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Technical Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Technical Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Select team members involved in this site visit:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {commonTeamMembers.map((member) => (
                <div key={member} className="flex items-center space-x-2">
                  <Checkbox
                    id={member}
                    checked={formData.teamMembers.includes(member)}
                    onCheckedChange={(checked) => 
                      handleTeamMemberChange(member, checked as boolean)
                    }
                  />
                  <Label htmlFor={member} className="text-sm">
                    {member}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Team Member Input */}
          <div className="space-y-2">
            <Label htmlFor="customMember">Add Custom Team Member</Label>
            <div className="flex gap-2">
              <Input
                id="customMember"
                value={customTeamMember}
                onChange={(e) => setCustomTeamMember(e.target.value)}
                placeholder="Enter team member name"
                onKeyPress={(e) => e.key === 'Enter' && addCustomTeamMember()}
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={addCustomTeamMember}
                disabled={!customTeamMember.trim()}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Selected Team Members */}
          {formData.teamMembers.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Selected Team Members:</p>
              <div className="flex flex-wrap gap-2">
                {formData.teamMembers.map((member) => (
                  <Badge key={member} variant="secondary" className="flex items-center gap-1">
                    {member}
                    <button
                      onClick={() => removeTeamMember(member)}
                      className="ml-1 text-xs hover:text-destructive"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Description */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Description</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              description: e.target.value 
            }))}
            placeholder="Any additional details about the technical work performed..."
            rows={3}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back to Customer Details
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!isFormValid || isLoading}
          className="flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Processing...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4" />
              Continue to Site Photos
            </>
          )}
        </Button>
      </div>
    </div>
  );
}