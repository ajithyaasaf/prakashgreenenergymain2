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
  Users, 
  Activity, 
  Camera,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit,
  Trash2
} from "lucide-react";
import { SiteVisitStartModal } from "@/components/site-visit/site-visit-start-modal";
import { SiteVisitDetailsModal } from "@/components/site-visit/site-visit-details-modal";
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
}

export default function SiteVisitPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedSiteVisit, setSelectedSiteVisit] = useState<SiteVisit | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("my-visits");

  // Check if user has access to Site Visit features
  const hasAccess = user?.department && ['technical', 'marketing', 'admin'].includes(user.department);

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
                  {mySiteVisits?.data?.map((visit: SiteVisit) => (
                    <SiteVisitCard
                      key={visit.id}
                      siteVisit={visit}
                      onView={() => handleViewDetails(visit)}
                      onDelete={() => handleDeleteSiteVisit(visit.id)}
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
                      showActions={false}
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
                      showActions={false}
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
        userDepartment={user?.department || 'technical'}
      />

      <SiteVisitDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        siteVisit={selectedSiteVisit}
      />
    </div>
  );
}

// Site Visit Card Component
interface SiteVisitCardProps {
  siteVisit: SiteVisit;
  onView: () => void;
  onDelete?: () => void;
  showActions: boolean;
}

function SiteVisitCard({ siteVisit, onView, onDelete, showActions }: SiteVisitCardProps) {
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
                <span>Started {formatDistanceToNow(new Date(siteVisit.siteInTime))} ago</span>
              </div>
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
              {onDelete && (
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