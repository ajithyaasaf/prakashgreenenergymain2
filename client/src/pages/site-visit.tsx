/**
 * Site Visit Management Page
 * Handles field operations for Technical, Marketing, and Admin departments
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Plus, 
  MapPin, 
  Clock, 
  Timer,
  Users, 
  Activity, 
  Camera,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit,
  Trash2,
  LogOut,
  RefreshCw,
  ArrowUpRight,
  Link2
} from "lucide-react";
import { SiteVisitStartModal } from "@/components/site-visit/site-visit-start-modal";
import { SiteVisitDetailsModal } from "@/components/site-visit/site-visit-details-modal";
import { SiteVisitCheckoutModal } from "@/components/site-visit/site-visit-checkout-modal";
import { FollowUpModal } from "@/components/site-visit/follow-up-modal";
import { CustomerSiteVisitCard } from "@/components/site-visit/customer-site-visit-card";
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
  // Follow-up fields
  isFollowUp?: boolean;
  followUpOf?: string;
  hasFollowUps?: boolean;
  followUpCount?: number;
  followUpReason?: string;
  followUpDescription?: string;
}

export default function SiteVisitPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedSiteVisit, setSelectedSiteVisit] = useState<SiteVisit | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("my-visits");
  const [viewMode, setViewMode] = useState<"individual" | "customer">("customer");

  // Check if user has access to Site Visit features
  const hasAccess = user?.department && ['technical', 'marketing', 'admin', 'administration'].includes(user.department.toLowerCase());

  // Fetch user's site visits
  const { data: mySiteVisits, isLoading: isLoadingMy } = useQuery({
    queryKey: ['/api/site-visits', { userId: user?.uid }],
    enabled: hasAccess && !!user?.uid,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch team/all site visits based on permissions
  const { data: teamSiteVisits, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['/api/site-visits', { department: user?.department }],
    enabled: hasAccess && !!user?.department && activeTab === 'team-visits',
    refetchInterval: 30000,
  });

  // Fetch active site visits
  const { data: activeSiteVisits, isLoading: isLoadingActive } = useQuery({
    queryKey: ['/api/site-visits/active'],
    enabled: hasAccess && activeTab === 'active-visits',
    refetchInterval: 15000, // More frequent updates for active visits
  });

  // Fetch site visit statistics
  const { data: stats } = useQuery({
    queryKey: ['/api/site-visits/stats'],
    enabled: hasAccess,
  });

  // Delete site visit mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/site-visits/${id}`, {
      method: 'DELETE'
    }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Site visit deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/site-visits'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete site visit",
        variant: "destructive",
      });
    },
  });

  const handleDeleteSiteVisit = (id: string) => {
    if (confirm("Are you sure you want to delete this site visit?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleViewDetails = (siteVisit: SiteVisit) => {
    setSelectedSiteVisit(siteVisit);
    setIsDetailsModalOpen(true);
  };

  const handleCheckoutSiteVisit = (siteVisit: SiteVisit) => {
    setSelectedSiteVisit(siteVisit);
    setIsCheckoutModalOpen(true);
  };

  const handleFollowUpVisit = (siteVisit: SiteVisit) => {
    setSelectedSiteVisit(siteVisit);
    setIsFollowUpModalOpen(true);
  };

  // Group site visits by customer for customer view mode
  const groupSiteVisitsByCustomer = (visits: SiteVisit[]) => {
    const groups = visits.reduce((acc: any, visit: SiteVisit) => {
      const customerKey = `${visit.customer.name}_${visit.customer.mobile}`;
      if (!acc[customerKey]) {
        acc[customerKey] = {
          customer: visit.customer,
          visits: [],
          latestVisit: visit,
          totalVisits: 0,
          hasInProgress: false,
          hasCompleted: false
        };
      }
      
      acc[customerKey].visits.push(visit);
      acc[customerKey].totalVisits++;
      
      // Update latest visit if this one is more recent
      if (new Date(visit.createdAt) > new Date(acc[customerKey].latestVisit.createdAt)) {
        acc[customerKey].latestVisit = visit;
      }
      
      // Track status types
      if (visit.status === 'in_progress') {
        acc[customerKey].hasInProgress = true;
      }
      if (visit.status === 'completed') {
        acc[customerKey].hasCompleted = true;
      }
      
      return acc;
    }, {});

    return Object.values(groups);
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-6 w-6" />
              Site Visit Management
            </CardTitle>
            <CardDescription>
              Field operations management for Technical, Marketing, and Admin departments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
              <p className="text-muted-foreground mb-4">
                Site Visit features are only available to Technical, Marketing, and Admin departments.
              </p>
              <Badge variant="outline">
                Your Department: {user?.department || 'Not Assigned'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Site Visit Management</h1>
          <p className="text-muted-foreground">
            Manage field operations and site visits for {user?.department} department
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center border rounded-lg">
            <Button
              variant={viewMode === "customer" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("customer")}
              className="rounded-r-none"
            >
              Customer View
            </Button>
            <Button
              variant={viewMode === "individual" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("individual")}
              className="rounded-l-none"
            >
              Individual Visits
            </Button>
          </div>
          <Button onClick={() => setIsStartModalOpen(true)} size="lg">
            <Plus className="h-4 w-4 mr-2" />
            Start Site Visit
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Visits</p>
                  <p className="text-2xl font-bold">{stats.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{stats.inProgress || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Department</p>
                  <p className="text-2xl font-bold">{stats.byDepartment?.[user?.department] || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Site Visits Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="my-visits">My Visits</TabsTrigger>
          <TabsTrigger value="active-visits">Active Visits</TabsTrigger>
          <TabsTrigger value="team-visits">Team Visits</TabsTrigger>
        </TabsList>

        {/* My Site Visits */}
        <TabsContent value="my-visits">
          <Card>
            <CardHeader>
              <CardTitle>My Site Visits</CardTitle>
              <CardDescription>
                Your personal site visits and field operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMy ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : mySiteVisits?.data?.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No site visits yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start your first site visit to begin tracking field operations
                  </p>
                  <Button onClick={() => setIsStartModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Start Site Visit
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {viewMode === "customer" ? (
                    // Customer grouped view
                    groupSiteVisitsByCustomer(mySiteVisits?.data || []).map((customerGroup: any) => (
                      <CustomerSiteVisitCard
                        key={`${customerGroup.customer.name}_${customerGroup.customer.mobile}`}
                        customerGroup={customerGroup}
                        onView={handleViewDetails}
                        onCheckout={handleCheckoutSiteVisit}
                        onFollowUp={handleFollowUpVisit}
                        onDelete={handleDeleteSiteVisit}
                        showActions={true}
                      />
                    ))
                  ) : (
                    // Individual visit view
                    mySiteVisits?.data?.map((visit: SiteVisit) => (
                      <SiteVisitCard
                        key={visit.id}
                        siteVisit={visit}
                        onView={() => handleViewDetails(visit)}
                        onCheckout={() => handleCheckoutSiteVisit(visit)}
                        onFollowUp={() => handleFollowUpVisit(visit)}
                        onDelete={() => handleDeleteSiteVisit(visit.id)}
                        showActions={true}
                      />
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Active Site Visits */}
        <TabsContent value="active-visits">
          <Card>
            <CardHeader>
              <CardTitle>Active Site Visits</CardTitle>
              <CardDescription>
                Currently in-progress site visits across all departments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingActive ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : activeSiteVisits?.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No active site visits</h3>
                  <p className="text-muted-foreground">
                    All site visits have been completed
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeSiteVisits?.map((visit: SiteVisit) => (
                    <SiteVisitCard
                      key={visit.id}
                      siteVisit={visit}
                      onView={() => handleViewDetails(visit)}
                      onCheckout={() => handleCheckoutSiteVisit(visit)}
                      onFollowUp={() => handleFollowUpVisit(visit)}
                      showActions={true}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Site Visits */}
        <TabsContent value="team-visits">
          <Card>
            <CardHeader>
              <CardTitle>Team Site Visits</CardTitle>
              <CardDescription>
                Site visits from your department team
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingTeam ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : teamSiteVisits?.data?.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No team site visits</h3>
                  <p className="text-muted-foreground">
                    No site visits from your department team yet
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {teamSiteVisits?.data?.map((visit: SiteVisit) => (
                    <SiteVisitCard
                      key={visit.id}
                      siteVisit={visit}
                      onView={() => handleViewDetails(visit)}
                      onCheckout={() => handleCheckoutSiteVisit(visit)}
                      onFollowUp={() => handleFollowUpVisit(visit)}
                      showActions={true}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <SiteVisitStartModal
        isOpen={isStartModalOpen}
        onClose={() => setIsStartModalOpen(false)}
        userDepartment={user?.department?.toLowerCase() === 'administration' ? 'admin' : (user?.department || 'technical')}
      />

      <SiteVisitDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        siteVisit={selectedSiteVisit}
      />

      {selectedSiteVisit && (
        <SiteVisitCheckoutModal
          isOpen={isCheckoutModalOpen}
          onClose={() => setIsCheckoutModalOpen(false)}
          siteVisit={selectedSiteVisit}
        />
      )}

      <FollowUpModal
        isOpen={isFollowUpModalOpen}
        onClose={() => setIsFollowUpModalOpen(false)}
        originalVisit={selectedSiteVisit}
      />
    </div>
  );
}

// Site Visit Card Component
interface SiteVisitCardProps {
  siteVisit: SiteVisit;
  onView: () => void;
  onCheckout?: () => void;
  onFollowUp?: () => void;
  onDelete?: () => void;
  showActions: boolean;
}

function SiteVisitCard({ siteVisit, onView, onCheckout, onFollowUp, onDelete, showActions }: SiteVisitCardProps) {
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

  return (
    <Card className={`hover:shadow-md transition-shadow ${siteVisit.isFollowUp ? 'border-l-4 border-l-blue-500 bg-blue-50/30' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
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
              
              {/* Follow-up indicators */}
              {siteVisit.isFollowUp && (
                <Badge variant="outline" className="text-purple-600 border-purple-200 bg-purple-50">
                  <Link2 className="h-3 w-3 mr-1" />
                  Follow-up: {getFollowUpReasonDisplay(siteVisit.followUpReason || 'other')}
                </Badge>
              )}
              
              {siteVisit.hasFollowUps && siteVisit.followUpCount && siteVisit.followUpCount > 0 && (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  {siteVisit.followUpCount} follow-up{siteVisit.followUpCount > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {siteVisit.customer.name}
                {siteVisit.isFollowUp && (
                  <span className="text-sm text-purple-600 font-normal">
                    (Follow-up Visit)
                  </span>
                )}
              </h3>
              <p className="text-sm text-muted-foreground">{siteVisit.customer.address}</p>
              <p className="text-sm text-muted-foreground">{siteVisit.customer.mobile}</p>
              
              {/* Follow-up description */}
              {siteVisit.isFollowUp && siteVisit.followUpDescription && (
                <p className="text-sm text-purple-600 mt-1 italic">
                  Follow-up reason: "{siteVisit.followUpDescription}"
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {siteVisit.siteOutTime ? (
                  <span>Completed {formatDistanceToNow(new Date(siteVisit.siteOutTime))} ago</span>
                ) : (
                  <span>Started {formatDistanceToNow(new Date(siteVisit.siteInTime))} ago</span>
                )}
              </div>
              {siteVisit.siteOutTime && (
                <div className="flex items-center gap-1">
                  <Timer className="h-4 w-4" />
                  <span>Duration: {Math.round((new Date(siteVisit.siteOutTime).getTime() - new Date(siteVisit.siteInTime).getTime()) / (1000 * 60))}min</span>
                </div>
              )}
              {siteVisit.sitePhotos.length > 0 && (
                <div className="flex items-center gap-1">
                  <Camera className="h-4 w-4" />
                  <span>{siteVisit.sitePhotos.length} photos</span>
                </div>
              )}
            </div>
          </div>

          {showActions && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onView}
              >
                <Eye className="h-4 w-4" />
              </Button>
              {siteVisit.status === 'in_progress' && onCheckout && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onCheckout}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
              {siteVisit.status === 'completed' && onFollowUp && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onFollowUp}
                  className="text-blue-600 hover:text-blue-700"
                  title="Create follow-up visit"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              {onDelete && siteVisit.status !== 'in_progress' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDelete}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}