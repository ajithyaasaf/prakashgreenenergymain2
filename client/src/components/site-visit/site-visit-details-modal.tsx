/**
 * Site Visit Details Modal
 * Displays detailed information about a site visit
 */

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, 
  Clock, 
  Camera, 
  User, 
  Phone, 
  Building,
  Calendar,
  FileText,
  Zap,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";

interface SiteVisit {
  id: string;
  userId: string;
  department: 'technical' | 'marketing' | 'admin';
  visitPurpose: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  siteInTime: string;
  siteOutTime?: string;
  customer: {
    name: string;
    mobile: string;
    address: string;
    propertyType: string;
    ebServiceNumber?: string;
  };
  technicalData?: {
    serviceTypes: string[];
    workType: string;
    workingStatus: string;
    pendingRemarks?: string;
    teamMembers: string[];
    description?: string;
  };
  marketingData?: {
    updateRequirements: boolean;
    projectType: string;
    onGridConfig?: any;
    offGridConfig?: any;
    hybridConfig?: any;
    waterHeaterConfig?: any;
    waterPumpConfig?: any;
  };
  adminData?: {
    bankProcess?: any;
    ebProcess?: any;
    purchase?: string;
    driving?: string;
    officialCashTransactions?: string;
    officialPersonalWork?: string;
    others?: string;
  };
  sitePhotos: Array<{
    url: string;
    timestamp: string;
    description?: string;
  }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface SiteVisitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  siteVisit: SiteVisit | null;
}

export function SiteVisitDetailsModal({ isOpen, onClose, siteVisit }: SiteVisitDetailsModalProps) {
  if (!siteVisit) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-orange-100 text-orange-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getDepartmentColor = (department: string) => {
    switch (department) {
      case 'technical': return 'bg-blue-100 text-blue-800';
      case 'marketing': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getWorkingStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending': return <AlertCircle className="h-4 w-4 text-orange-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const calculateDuration = () => {
    const startTime = new Date(siteVisit.siteInTime);
    const endTime = siteVisit.siteOutTime ? new Date(siteVisit.siteOutTime) : new Date();
    const diffInMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      const minutes = diffInMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Site Visit Details
          </DialogTitle>
          <DialogDescription>
            Complete information about the site visit
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getStatusColor(siteVisit.status)}>
                  {siteVisit.status.replace('_', ' ')}
                </Badge>
                <Badge variant="outline" className={getDepartmentColor(siteVisit.department)}>
                  {siteVisit.department}
                </Badge>
                <Badge variant="outline">
                  {siteVisit.visitPurpose}
                </Badge>
              </div>
              <h2 className="text-2xl font-bold">{siteVisit.customer.name}</h2>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Visit ID: {siteVisit.id.slice(0, 8)}</p>
              <p>Created: {format(new Date(siteVisit.createdAt), 'PPP')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Customer Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{siteVisit.customer.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{siteVisit.customer.propertyType} Property</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{siteVisit.customer.mobile}</span>
                </div>
                
                <div className="flex items-start gap-3">
                  <Building className="h-4 w-4 text-muted-foreground mt-1" />
                  <span className="text-sm">{siteVisit.customer.address}</span>
                </div>

                {siteVisit.customer.ebServiceNumber && (
                  <div className="flex items-center gap-3">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">EB Service Number</p>
                      <p className="font-medium">{siteVisit.customer.ebServiceNumber}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Visit Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Visit Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Site In Time</p>
                    <p className="font-medium">{format(new Date(siteVisit.siteInTime), 'PPP p')}</p>
                  </div>
                </div>

                {siteVisit.siteOutTime && (
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Site Out Time</p>
                      <p className="font-medium">{format(new Date(siteVisit.siteOutTime), 'PPP p')}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">{calculateDuration()}</p>
                  </div>
                </div>

                {siteVisit.status === 'in_progress' && (
                  <Badge variant="outline" className="text-orange-600">
                    Visit in Progress
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Department-Specific Data */}
          {siteVisit.technicalData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Technical Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Service Types</p>
                  <div className="flex flex-wrap gap-2">
                    {siteVisit.technicalData.serviceTypes.map((service, index) => (
                      <Badge key={index} variant="outline">
                        {service.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Work Type</p>
                    <p className="font-medium capitalize">{siteVisit.technicalData.workType.replace('_', ' ')}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Working Status</p>
                    <div className="flex items-center gap-2">
                      {getWorkingStatusIcon(siteVisit.technicalData.workingStatus)}
                      <span className="font-medium capitalize">{siteVisit.technicalData.workingStatus}</span>
                    </div>
                  </div>
                </div>

                {siteVisit.technicalData.teamMembers.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Team Members</p>
                    <div className="flex flex-wrap gap-2">
                      {siteVisit.technicalData.teamMembers.map((member, index) => (
                        <Badge key={index} variant="secondary">
                          {member}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {siteVisit.technicalData.pendingRemarks && (
                  <div>
                    <p className="text-sm text-muted-foreground">Pending Remarks</p>
                    <p className="text-sm bg-orange-50 p-3 rounded-lg border border-orange-200">
                      {siteVisit.technicalData.pendingRemarks}
                    </p>
                  </div>
                )}

                {siteVisit.technicalData.description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{siteVisit.technicalData.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {siteVisit.marketingData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Marketing Project Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Update Requirements</p>
                    <Badge variant={siteVisit.marketingData.updateRequirements ? "default" : "secondary"}>
                      {siteVisit.marketingData.updateRequirements ? "Yes" : "No"}
                    </Badge>
                  </div>
                  
                  <div>
                    <p className="text-sm text-muted-foreground">Project Type</p>
                    <Badge variant="outline" className="capitalize">
                      {siteVisit.marketingData.projectType.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Project Configuration Details */}
                {(siteVisit.marketingData.onGridConfig || 
                  siteVisit.marketingData.offGridConfig || 
                  siteVisit.marketingData.hybridConfig ||
                  siteVisit.marketingData.waterHeaterConfig ||
                  siteVisit.marketingData.waterPumpConfig) && (
                  <div className="space-y-3">
                    <Separator />
                    <h4 className="font-medium">Configuration Details</h4>
                    {/* You can expand this to show specific configuration details */}
                    <p className="text-sm text-muted-foreground">
                      Detailed project specifications available
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {siteVisit.adminData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Administrative Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {siteVisit.adminData.bankProcess && (
                  <div>
                    <p className="text-sm text-muted-foreground">Bank Process</p>
                    <p className="font-medium">{siteVisit.adminData.bankProcess.step}</p>
                    {siteVisit.adminData.bankProcess.description && (
                      <p className="text-sm text-muted-foreground">{siteVisit.adminData.bankProcess.description}</p>
                    )}
                  </div>
                )}

                {siteVisit.adminData.ebProcess && (
                  <div>
                    <p className="text-sm text-muted-foreground">EB Process</p>
                    <p className="font-medium">{siteVisit.adminData.ebProcess.type}</p>
                    {siteVisit.adminData.ebProcess.description && (
                      <p className="text-sm text-muted-foreground">{siteVisit.adminData.ebProcess.description}</p>
                    )}
                  </div>
                )}

                {Object.entries(siteVisit.adminData).map(([key, value]) => {
                  if (key === 'bankProcess' || key === 'ebProcess' || !value) return null;
                  return (
                    <div key={key}>
                      <p className="text-sm text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Site Photos */}
          {siteVisit.sitePhotos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Site Photos ({siteVisit.sitePhotos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {siteVisit.sitePhotos.map((photo, index) => (
                    <div key={index} className="space-y-2">
                      <div className="relative">
                        <img
                          src={photo.url}
                          alt={`Site photo ${index + 1}`}
                          className="w-full h-48 object-cover rounded-lg"
                        />
                        <Badge className="absolute top-2 right-2 text-xs">
                          {format(new Date(photo.timestamp), 'MMM d, HH:mm')}
                        </Badge>
                      </div>
                      {photo.description && (
                        <p className="text-sm text-muted-foreground">{photo.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {siteVisit.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{siteVisit.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {siteVisit.status === 'in_progress' && (
              <Button>
                Continue Visit
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}