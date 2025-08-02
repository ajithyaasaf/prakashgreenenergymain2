/**
 * Follow-Up Details Modal Component
 * Displays follow-up visit details separately from original site visits
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  MapPin, Clock, User, Phone, Building, 
  RefreshCw, FileText, AlertCircle, CheckCircle
} from "lucide-react";
import { format } from "date-fns";

interface FollowUpDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  followUpId: string;
  onCheckout?: (followUpId: string) => void;
}

export function FollowUpDetailsModal({ 
  isOpen, 
  onClose, 
  followUpId,
  onCheckout 
}: FollowUpDetailsModalProps) {
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const { data: followUpData, isLoading } = useQuery({
    queryKey: ['/api/follow-ups', followUpId],
    enabled: isOpen && !!followUpId
  });

  const followUp = (followUpData as any)?.data;
  
  console.log("FOLLOW_UP_MODAL_DEBUG:", {
    followUpId,
    followUpData,
    followUp,
    department: followUp?.department,
    status: followUp?.status
  });

  const formatTime = (timeString: string | undefined) => {
    if (!timeString) {
      return {
        date: 'Not available',
        time: 'Not available'
      };
    }
    
    const date = new Date(timeString);
    if (isNaN(date.getTime())) {
      return {
        date: 'Invalid date',
        time: 'Invalid time'
      };
    }
    
    return {
      date: format(date, 'MMM dd, yyyy'),
      time: format(date, 'h:mm a')
    };
  };

  const followUpReasons = {
    'additional_work_required': 'Additional Work Required',
    'issue_resolution': 'Issue Resolution',
    'status_check': 'Status Check', 
    'customer_request': 'Customer Request',
    'maintenance': 'Maintenance',
    'other': 'Other'
  };

  const statusColors = {
    'in_progress': 'bg-blue-100 text-blue-800',
    'completed': 'bg-green-100 text-green-800',
    'cancelled': 'bg-red-100 text-red-800'
  };

  const departmentColors = {
    'technical': 'bg-orange-100 text-orange-800',
    'marketing': 'bg-green-100 text-green-800', 
    'admin': 'bg-blue-100 text-blue-800'
  };

  const handleCheckout = () => {
    if (onCheckout && followUp?.id) {
      setIsCheckingOut(true);
      onCheckout(followUp.id);
      onClose();
    }
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!followUp) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Follow-up Not Found</h3>
            <p className="text-muted-foreground">The follow-up visit could not be found.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const siteInTime = formatTime(followUp.siteInTime);
  const siteOutTime = followUp.siteOutTime ? formatTime(followUp.siteOutTime) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Follow-up Visit Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Department */}
          <div className="flex items-center gap-2">
            <Badge className={departmentColors[followUp.department as keyof typeof departmentColors] || "bg-gray-100 text-gray-800"}>
              {followUp.department ? followUp.department.charAt(0).toUpperCase() + followUp.department.slice(1) : 'Unknown'}
            </Badge>
            <Badge className={statusColors[followUp.status as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
              {followUp.status ? followUp.status.replace('_', ' ') : 'Unknown'}
            </Badge>
          </div>

          {/* Customer Information */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{followUp.customer.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Mobile</p>
                <p className="font-medium flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {followUp.customer.mobile}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="font-medium flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-1 flex-shrink-0" />
                  {followUp.customer.address}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Property Type</p>
                <p className="font-medium flex items-center gap-1">
                  <Building className="h-3 w-3" />
                  {followUp.customer.propertyType}
                </p>
              </div>
            </div>
          </div>

          {/* Follow-up Information */}
          <div>
            <h3 className="font-semibold mb-3">Follow-up Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Reason</p>
                <p className="font-medium">
                  {followUp.followUpReason ? (followUpReasons[followUp.followUpReason as keyof typeof followUpReasons] || followUp.followUpReason) : 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{followUp.description || 'No description provided'}</p>
              </div>
              {followUp.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="font-medium">{followUp.notes}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Visit Timeline */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Visit Timeline
            </h3>
            <div className="space-y-4">
              {/* Check-in */}
              <div className="flex items-start gap-3">
                <div className="bg-green-100 p-2 rounded-full">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Checked In</p>
                  <p className="text-sm text-muted-foreground">
                    {siteInTime.date} at {siteInTime.time}
                  </p>
                  {followUp.siteInLocation?.address && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {followUp.siteInLocation.address}
                    </p>
                  )}
                </div>
              </div>

              {/* Check-out */}
              {siteOutTime ? (
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Checked Out</p>
                    <p className="text-sm text-muted-foreground">
                      {siteOutTime.date} at {siteOutTime.time}
                    </p>
                    {followUp.siteOutLocation?.address && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-3 w-3" />
                        {followUp.siteOutLocation.address}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="bg-yellow-100 p-2 rounded-full">
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium">In Progress</p>
                    <p className="text-sm text-muted-foreground">Visit is currently ongoing</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Photos */}
          {(followUp.siteInPhotoUrl || followUp.siteOutPhotoUrl) && (
            <div>
              <h3 className="font-semibold mb-3">Photos</h3>
              <div className="grid grid-cols-2 gap-4">
                {followUp.siteInPhotoUrl && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Check-in Photo</p>
                    <img 
                      src={followUp.siteInPhotoUrl} 
                      alt="Check-in photo"
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  </div>
                )}
                {followUp.siteOutPhotoUrl && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Check-out Photo</p>
                    <img 
                      src={followUp.siteOutPhotoUrl} 
                      alt="Check-out photo"
                      className="w-full h-40 object-cover rounded-lg border"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Site Photos */}
          {followUp.sitePhotos && followUp.sitePhotos.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Site Documentation Photos</h3>
              <div className="grid grid-cols-3 gap-3">
                {followUp.sitePhotos.map((photoUrl: string, index: number) => (
                  <img 
                    key={index}
                    src={photoUrl} 
                    alt={`Site photo ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {followUp.status === 'in_progress' && onCheckout && (
              <Button 
                onClick={handleCheckout}
                disabled={isCheckingOut}
              >
                {isCheckingOut ? 'Processing...' : 'Checkout'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}