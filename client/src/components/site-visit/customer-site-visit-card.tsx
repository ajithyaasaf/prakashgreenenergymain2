import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Timer,
  Camera,
  Eye,
  LogOut,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  MapPin,
  Phone,
  User,
  Calendar,
  Link2,
  ArrowUpRight
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  };
  technicalData?: any;
  marketingData?: any;
  adminData?: any;
  sitePhotos: Array<{
    url: string;
    timestamp: string;
    description?: string;
  }>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isFollowUp?: boolean;
  followUpOf?: string;
  hasFollowUps?: boolean;
  followUpCount?: number;
  followUpReason?: string;
  followUpDescription?: string;
}

interface CustomerGroup {
  customer: {
    name: string;
    mobile: string;
    address: string;
    propertyType: string;
  };
  visits: SiteVisit[];
  latestVisit: SiteVisit;
  totalVisits: number;
  hasInProgress: boolean;
  hasCompleted: boolean;
}

interface CustomerSiteVisitCardProps {
  customerGroup: CustomerGroup;
  onView: (visit: SiteVisit) => void;
  onCheckout?: (visit: SiteVisit) => void;
  onFollowUp?: (visit: SiteVisit) => void;
  onDelete?: (id: string) => void;
  showActions: boolean;
}

export function CustomerSiteVisitCard({
  customerGroup,
  onView,
  onCheckout,
  onFollowUp,
  onDelete,
  showActions
}: CustomerSiteVisitCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
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

  const getFollowUpReasonDisplay = (reason: string) => {
    switch (reason) {
      case 'additional_assessment': return 'Additional Assessment';
      case 'installation_follow_up': return 'Installation Follow-up';
      case 'maintenance_check': return 'Maintenance Check';
      case 'customer_request': return 'Customer Request';
      case 'technical_issue': return 'Technical Issue';
      case 'other': return 'Other';
      default: return reason;
    }
  };

  const getOverallStatus = () => {
    if (customerGroup.hasInProgress) return { status: 'in_progress', text: 'Visit in Progress' };
    if (customerGroup.hasCompleted) return { status: 'completed', text: 'Latest Visit Completed' };
    return { status: 'pending', text: 'No Recent Activity' };
  };

  const overallStatus = getOverallStatus();
  const latestVisit = customerGroup.latestVisit;
  
  // Sort visits by creation date (newest first)
  const sortedVisits = [...customerGroup.visits].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Customer Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  {customerGroup.customer.name}
                </h3>
                <Badge className={getStatusColor(overallStatus.status)}>
                  {overallStatus.text}
                </Badge>
                {customerGroup.totalVisits > 1 && (
                  <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                    {customerGroup.totalVisits} visits
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {customerGroup.customer.mobile}
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {customerGroup.customer.address}
                </div>
              </div>
            </div>

            {showActions && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onView(latestVisit)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                
                {latestVisit.status === 'in_progress' && onCheckout && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onCheckout(latestVisit)}
                    className="text-orange-600 hover:text-orange-700"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                )}
                
                {latestVisit.status === 'completed' && onFollowUp && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onFollowUp(latestVisit)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Latest Visit Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">Latest Visit</h4>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={getDepartmentColor(latestVisit.department)}>
                  {latestVisit.department}
                </Badge>
                <Badge variant="outline">
                  {latestVisit.visitPurpose}
                </Badge>
                {latestVisit.isFollowUp && (
                  <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                    <Link2 className="h-3 w-3 mr-1" />
                    Follow-up: {getFollowUpReasonDisplay(latestVisit.followUpReason || 'other')}
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {latestVisit.siteOutTime ? (
                  <span>Completed {formatDistanceToNow(new Date(latestVisit.siteOutTime))} ago</span>
                ) : (
                  <span>Started {formatDistanceToNow(new Date(latestVisit.siteInTime))} ago</span>
                )}
              </div>
              
              {latestVisit.siteOutTime && (
                <div className="flex items-center gap-1">
                  <Timer className="h-4 w-4" />
                  <span>Duration: {Math.round((new Date(latestVisit.siteOutTime).getTime() - new Date(latestVisit.siteInTime).getTime()) / (1000 * 60))}min</span>
                </div>
              )}
              
              {latestVisit.sitePhotos.length > 0 && (
                <div className="flex items-center gap-1">
                  <Camera className="h-4 w-4" />
                  <span>{latestVisit.sitePhotos.length} photos</span>
                </div>
              )}
            </div>

            {latestVisit.isFollowUp && latestVisit.followUpDescription && (
              <p className="text-sm text-purple-600 mt-2 italic">
                Follow-up reason: "{latestVisit.followUpDescription}"
              </p>
            )}
          </div>

          {/* Visit History (Collapsible) */}
          {customerGroup.totalVisits > 1 && (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                  <span className="text-sm font-medium">
                    View Visit History ({customerGroup.totalVisits - 1} previous visits)
                  </span>
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="space-y-3 mt-3">
                {sortedVisits.slice(1).map((visit, index) => (
                  <div key={visit.id} className="border-l-2 border-gray-200 pl-4 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(visit.status)} variant="secondary">
                          {visit.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className={getDepartmentColor(visit.department)}>
                          {visit.department}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {visit.visitPurpose}
                        </span>
                        {visit.isFollowUp && (
                          <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                            <Link2 className="h-3 w-3 mr-1" />
                            Follow-up
                          </Badge>
                        )}
                      </div>
                      
                      {showActions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onView(visit)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {visit.siteOutTime ? (
                          <span>Completed {formatDistanceToNow(new Date(visit.siteOutTime))} ago</span>
                        ) : (
                          <span>Started {formatDistanceToNow(new Date(visit.siteInTime))} ago</span>
                        )}
                      </div>
                      
                      {visit.sitePhotos.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Camera className="h-4 w-4" />
                          <span>{visit.sitePhotos.length} photos</span>
                        </div>
                      )}
                    </div>

                    {visit.isFollowUp && visit.followUpDescription && (
                      <p className="text-sm text-purple-600 mt-1 italic">
                        "{visit.followUpDescription}"
                      </p>
                    )}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
}