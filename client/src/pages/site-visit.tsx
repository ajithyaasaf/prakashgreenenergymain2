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
  RefreshCw
} from "lucide-react";
import { SiteVisitStartModal } from "@/components/site-visit/site-visit-start-modal";
import { SiteVisitDetailsModal } from "@/components/site-visit/site-visit-details-modal";
import { SiteVisitCheckoutModal } from "@/components/site-visit/site-visit-checkout-modal";
import { FollowUpModal } from "@/components/site-visit/follow-up-modal";
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
  followUpReason?: string;
  followUpCount?: number;
  hasFollowUps?: boolean;
}

// Unified Site Visit Types
interface CustomerVisitGroup {
  customerMobile: string;
  customerName: string;
  customerAddress: string;
  primaryVisit: SiteVisit;
  followUps: SiteVisit[];
  totalVisits: number;
  latestStatus: string;
  hasActiveVisit: boolean;
}

// Group visits by customer mobile number
function groupVisitsByCustomer(visits: SiteVisit[]): CustomerVisitGroup[] {
  if (!visits || !Array.isArray(visits)) {
    return [];
  }

  const groupMap = new Map<string, CustomerVisitGroup>();

  visits.forEach(visit => {
    const mobile = visit.customer.mobile;
    
    if (!groupMap.has(mobile)) {
      // Initialize new group with this visit as primary
      groupMap.set(mobile, {
        customerMobile: mobile,
        customerName: visit.customer.name,
        customerAddress: visit.customer.address,
        primaryVisit: visit,
        followUps: [],
        totalVisits: 1,
        latestStatus: visit.status,
        hasActiveVisit: visit.status === 'in_progress'
      });
    } else {
      const group = groupMap.get(mobile)!;
      
      // If this visit is newer than current primary, swap them
      const visitTime = new Date(visit.createdAt || visit.siteInTime);
      const primaryTime = new Date(group.primaryVisit.createdAt || group.primaryVisit.siteInTime);
      
      if (visitTime > primaryTime) {
        // Move current primary to follow-ups and set this as new primary
        group.followUps.unshift(group.primaryVisit);
        group.primaryVisit = visit;
      } else {
        // Add as follow-up (maintain chronological order)
        group.followUps.push(visit);
      }
      
      group.totalVisits++;
      
      // Update status to latest active status
      if (visit.status === 'in_progress') {
        group.hasActiveVisit = true;
        group.latestStatus = 'in_progress';
      } else if (group.latestStatus !== 'in_progress') {
        group.latestStatus = visit.status;
      }
    }
  });

  // Sort follow-ups by date (newest first)
  groupMap.forEach(group => {
    group.followUps.sort((a, b) => 
      new Date(b.createdAt || b.siteInTime).getTime() - 
      new Date(a.createdAt || a.siteInTime).getTime()
    );
  });

  // Convert to array and sort by latest activity
  return Array.from(groupMap.values()).sort((a, b) => {
    const aLatest = Math.max(
      new Date(a.primaryVisit.createdAt || a.primaryVisit.siteInTime).getTime(),
      ...a.followUps.map(f => new Date(f.createdAt || f.siteInTime).getTime())
    );
    const bLatest = Math.max(
      new Date(b.primaryVisit.createdAt || b.primaryVisit.siteInTime).getTime(),
      ...b.followUps.map(f => new Date(f.createdAt || f.siteInTime).getTime())
    );
    return bLatest - aLatest;
  });
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

  // Check if user has access to Site Visit features
  const hasAccess = user?.department && ['technical', 'marketing', 'admin', 'administration'].includes(user.department.toLowerCase());

  // Fetch user's site visits
  const { data: mySiteVisits, isLoading: isLoadingMy } = useQuery({
    queryKey: ['/api/site-visits', { userId: user?.uid }],
    queryFn: async () => {
      const response = await apiRequest(`/api/site-visits?userId=${user?.uid}`, 'GET');
      return await response.json();
    },
    enabled: Boolean(hasAccess && user?.uid && activeTab === 'my-visits'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch team/all site visits based on permissions
  const { data: teamSiteVisits, isLoading: isLoadingTeam } = useQuery({
    queryKey: ['/api/site-visits', { department: user?.department }],
    queryFn: async () => {
      const response = await apiRequest(`/api/site-visits?department=${user?.department}`, 'GET');
      return await response.json();
    },
    enabled: Boolean(hasAccess && user?.department && activeTab === 'team-visits'),
    refetchInterval: 30000,
  });

  // Fetch active site visits
  const { data: activeSiteVisits, isLoading: isLoadingActive } = useQuery({
    queryKey: ['/api/site-visits/active'],
    queryFn: async () => {
      const response = await apiRequest('/api/site-visits/active', 'GET');
      return await response.json();
    },
    enabled: Boolean(hasAccess && activeTab === 'active-visits'),
    refetchInterval: 15000, // More frequent updates for active visits
  });

  // Fetch site visit statistics
  const { data: stats } = useQuery({
    queryKey: ['/api/site-visits/stats'],
    queryFn: async () => {
      const response = await apiRequest('/api/site-visits/stats', 'GET');
      return await response.json();
    },
    enabled: Boolean(hasAccess),
  });

  // Delete site visit mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/site-visits/${id}`, 'DELETE'),
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
        <Button onClick={() => setIsStartModalOpen(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Start Site Visit
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Visits</p>
                  <p className="text-2xl font-bold">{(stats as any)?.total || 0}</p>
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
                  <p className="text-2xl font-bold">{(stats as any)?.inProgress || 0}</p>
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
                  <p className="text-2xl font-bold">{(stats as any)?.completed || 0}</p>
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
                  <p className="text-2xl font-bold">{(stats as any)?.byDepartment?.[user?.department || ''] || 0}</p>
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
              ) : (mySiteVisits as any)?.data?.length === 0 ? (
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
                  {(() => {
                    const data = (mySiteVisits as any)?.data || [];
                    return groupVisitsByCustomer(data);
                  })().map((group: CustomerVisitGroup) => (
                    <UnifiedSiteVisitCard
                      key={group.customerMobile}
                      visitGroup={group}
                      onView={handleViewDetails}
                      onCheckout={handleCheckoutSiteVisit}
                      onFollowUp={handleFollowUpVisit}
                      onDelete={handleDeleteSiteVisit}
                      showActions={true}
                    />
                  ))}
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
              ) : (activeSiteVisits as SiteVisit[])?.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No active site visits</h3>
                  <p className="text-muted-foreground">
                    All site visits have been completed
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupVisitsByCustomer((activeSiteVisits as SiteVisit[]) || []).map((group: CustomerVisitGroup) => (
                    <UnifiedSiteVisitCard
                      key={group.customerMobile}
                      visitGroup={group}
                      onView={handleViewDetails}
                      onCheckout={handleCheckoutSiteVisit}
                      onFollowUp={handleFollowUpVisit}
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
              ) : (teamSiteVisits as any)?.data?.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No team site visits</h3>
                  <p className="text-muted-foreground">
                    No site visits from your department team yet
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupVisitsByCustomer((teamSiteVisits as any)?.data || []).map((group: CustomerVisitGroup) => (
                    <UnifiedSiteVisitCard
                      key={group.customerMobile}
                      visitGroup={group}
                      onView={handleViewDetails}
                      onCheckout={handleCheckoutSiteVisit}
                      onFollowUp={handleFollowUpVisit}
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

// Unified Site Visit Card Component
interface UnifiedSiteVisitCardProps {
  visitGroup: CustomerVisitGroup;
  onView: (visit: SiteVisit) => void;
  onCheckout?: (visit: SiteVisit) => void;
  onFollowUp?: (visit: SiteVisit) => void;
  onDelete?: (visitId: string) => void;
  showActions: boolean;
}

function UnifiedSiteVisitCard({ visitGroup, onView, onCheckout, onFollowUp, onDelete, showActions }: UnifiedSiteVisitCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getDepartmentColor = (department: string) => {
    switch (department) {
      case 'technical': return 'bg-blue-100 text-blue-800';
      case 'marketing': return 'bg-green-100 text-green-800';
      case 'admin': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (timeString: string) => {
    try {
      return formatDistanceToNow(new Date(timeString), { addSuffix: true });
    } catch {
      return 'Unknown time';
    }
  };

  const currentActiveVisit = visitGroup.hasActiveVisit 
    ? (visitGroup.primaryVisit.status === 'in_progress' 
        ? visitGroup.primaryVisit 
        : visitGroup.followUps.find(f => f.status === 'in_progress'))
    : null;

  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{visitGroup.customerName}</CardTitle>
              <Badge className={getStatusColor(visitGroup.latestStatus)}>
                {visitGroup.latestStatus.replace('_', ' ')}
              </Badge>
              {visitGroup.totalVisits > 1 && (
                <Badge variant="secondary" className="text-xs">
                  {visitGroup.totalVisits} visits
                </Badge>
              )}
              {visitGroup.followUps.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {visitGroup.followUps.length} follow-up{visitGroup.followUps.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{visitGroup.customerMobile}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span className="flex-1">{visitGroup.customerAddress}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Primary Visit Display */}
        <div className="border rounded-lg p-3 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge className={getDepartmentColor(visitGroup.primaryVisit.department)}>
                {visitGroup.primaryVisit.department}
              </Badge>
              <span className="text-sm font-medium">Latest Visit</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatTime(visitGroup.primaryVisit.siteInTime)}
            </span>
          </div>
          
          <div className="text-sm space-y-1">
            <div><strong>Purpose:</strong> {visitGroup.primaryVisit.visitPurpose}</div>
            {visitGroup.primaryVisit.notes && (
              <div><strong>Notes:</strong> {visitGroup.primaryVisit.notes}</div>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Check-in: {formatTime(visitGroup.primaryVisit.siteInTime)}</span>
              {visitGroup.primaryVisit.siteOutTime && (
                <span>Check-out: {formatTime(visitGroup.primaryVisit.siteOutTime)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Follow-ups Section */}
        {visitGroup.followUps.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost" 
              size="sm" 
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full justify-between text-sm h-8"
            >
              <span>Follow-up History ({visitGroup.followUps.length})</span>
              <RefreshCw className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
            
            {isExpanded && (
              <div className="space-y-2 pl-4 border-l-2 border-blue-200">
                {visitGroup.followUps.map((followUp, index) => (
                  <div key={followUp.id} className="border rounded-lg p-3 bg-blue-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={getDepartmentColor(followUp.department)}>
                          {followUp.department}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Follow-up #{visitGroup.followUps.length - index}
                        </Badge>
                        <Badge className={getStatusColor(followUp.status)}>
                          {followUp.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(followUp.siteInTime)}
                      </span>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      {followUp.followUpReason && (
                        <div><strong>Reason:</strong> {followUp.followUpReason.replace(/_/g, ' ')}</div>
                      )}
                      <div><strong>Purpose:</strong> {followUp.visitPurpose}</div>
                      {followUp.notes && (
                        <div><strong>Notes:</strong> {followUp.notes}</div>
                      )}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Check-in: {formatTime(followUp.siteInTime)}</span>
                        {followUp.siteOutTime && (
                          <span>Check-out: {formatTime(followUp.siteOutTime)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {showActions && (
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onView(visitGroup.primaryVisit)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Details
            </Button>
            
            {currentActiveVisit && onCheckout && (
              <Button
                size="sm"
                onClick={() => onCheckout(currentActiveVisit)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Check-out
              </Button>
            )}
            
            {onFollowUp && visitGroup.latestStatus !== 'cancelled' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onFollowUp(visitGroup.primaryVisit)}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Follow-up
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Legacy Site Visit Card Component (kept for compatibility)
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

  return (
    <Card className="hover:shadow-md transition-shadow">
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
            </div>
            
            <div>
              <h3 className="font-semibold text-lg">{siteVisit.customer.name}</h3>
              <p className="text-sm text-muted-foreground">{siteVisit.customer.address}</p>
              <p className="text-sm text-muted-foreground">{siteVisit.customer.mobile}</p>
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