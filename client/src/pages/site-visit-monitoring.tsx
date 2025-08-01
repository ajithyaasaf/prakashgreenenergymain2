import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MapPin, Search, Download, Eye, Calendar, Clock, Users, Building, 
  Camera, FileText, Filter, RefreshCw, TrendingUp, BarChart3,
  CheckCircle, XCircle, AlertTriangle, Navigation, Phone, Mail,
  User, Zap, ChevronDown
} from "lucide-react";
import { format } from "date-fns";
import { SiteVisitDetailsModal } from "@/components/site-visit/site-visit-details-modal";

interface SiteVisit {
  id: string;
  userId: string;
  department: string;
  visitPurpose: string;
  siteInTime: Date;
  siteOutTime?: Date;
  status: 'in_progress' | 'completed' | 'cancelled';
  sitePhotos: {
    url: string;
    caption?: string;
    timestamp: Date;
  }[];
  notes?: string;
  userName: string;
  userDepartment: string;
  // Customer data (nested object structure)
  customer: {
    name: string;
    mobile: string;
    address: string;
    propertyType?: string;
    ebServiceNumber?: string;
  };
  // Enhanced follow-up system
  isFollowUp?: boolean;
  followUpOf?: string;
  followUpReason?: string;
  followUpDescription?: string;
  followUpCount?: number;
  hasFollowUps?: boolean;
  // Department-specific data
  technicalData?: any;
  marketingData?: any;
  adminData?: any;
  // Location data
  siteInLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
  siteOutLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    address?: string;
  };
  siteInPhotoUrl?: string;
  siteOutPhotoUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CustomerVisitGroup {
  customerMobile: string;
  customerName: string;
  customerAddress: string;
  primaryVisit: SiteVisit;
  followUps: SiteVisit[];
  totalVisits: number;
  latestStatus: string;
  hasActiveVisit: boolean;
  latestActivity: Date;
}

// Customer Visit Group Card Component
const CustomerVisitGroupCard = ({ 
  group, 
  onViewDetails 
}: { 
  group: CustomerVisitGroup; 
  onViewDetails: (visit: SiteVisit) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-3 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
              <h3 className="font-semibold text-base sm:text-lg">{group.customerName}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={
                    group.latestStatus === 'completed' ? 'default' : 
                    group.latestStatus === 'in_progress' ? 'secondary' : 'destructive'
                  }
                  className="capitalize text-xs"
                >
                  {group.latestStatus === 'in_progress' ? 'In Progress' : 
                   group.latestStatus === 'completed' ? 'Completed' : 'Cancelled'}
                </Badge>
                <Badge variant="outline" className="capitalize text-xs">{group.primaryVisit.department}</Badge>
                {group.primaryVisit.isFollowUp && (
                  <Badge variant="outline" className="text-xs border-purple-500 text-purple-700">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Follow-up
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs border-blue-500 text-blue-700">
                  <Users className="h-3 w-3 mr-1" />
                  {group.totalVisits} Visit{group.totalVisits !== 1 ? 's' : ''}
                </Badge>
                {group.followUps.length > 0 && (
                  <Badge variant="outline" className="text-xs border-green-500 text-green-700">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    {group.followUps.length} Follow-up{group.followUps.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-xs sm:text-sm text-muted-foreground">
                {group.primaryVisit.isFollowUp ? 'Follow-up:' : 'Latest:'} {group.primaryVisit.visitPurpose || 'Site Visit'}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(group.latestActivity, 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
          </div>
        </div>

        {/* Customer & Contact Info */}
        <div className="space-y-3 mb-4">
          <div className="flex items-start gap-2 text-xs sm:text-sm">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <span className="font-medium">Address:</span>
              <span className="text-muted-foreground ml-1 break-words">{group.customerAddress}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
              <span className="font-medium">Phone:</span>
              <span className="text-muted-foreground">{group.customerMobile}</span>
            </div>
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500 flex-shrink-0" />
              <span className="font-medium">Employee:</span>
              <span className="text-muted-foreground">{group.primaryVisit.userName}</span>
            </div>
          </div>
        </div>

        {/* Action buttons and visit timeline toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t">
          <div className="flex flex-wrap items-center gap-2">
            {group.primaryVisit.siteInLocation && (
              <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                <Navigation className="h-2 w-2 sm:h-3 sm:w-3" />
                Location Tracked
              </Badge>
            )}
            {group.primaryVisit.sitePhotos?.length > 0 && (
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <Camera className="h-2 w-2 sm:h-3 sm:w-3" />
                Photos
              </Badge>
            )}
          </div>
          
          <div className="flex gap-2">
            {group.totalVisits > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs"
              >
                <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                {isExpanded ? 'Hide' : 'Show'} All ({group.totalVisits})
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => onViewDetails(group.primaryVisit)}
            >
              <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="text-xs sm:text-sm">View Latest</span>
            </Button>
          </div>
        </div>

        {/* Expanded view showing all visits */}
        {isExpanded && group.totalVisits > 1 && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">All Visits ({group.totalVisits})</h4>
            <div className="space-y-2">
              {/* Primary Visit */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-xs">Latest</Badge>
                    <span className="text-sm font-medium">{group.primaryVisit.visitPurpose}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(group.primaryVisit.createdAt || group.primaryVisit.siteInTime), 'MMM dd, HH:mm')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="text-xs">{group.primaryVisit.status}</Badge>
                  <Badge variant="outline" className="text-xs">{group.primaryVisit.department}</Badge>
                </div>
              </div>
              
              {/* Follow-up Visits */}
              {group.followUps.map((visit, index) => (
                <div key={visit.id} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        #{group.followUps.length - index}
                      </Badge>
                      <span className="text-sm font-medium">{visit.visitPurpose}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(visit.createdAt || visit.siteInTime), 'MMM dd, HH:mm')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="text-xs">{visit.status}</Badge>
                    <Badge variant="outline" className="text-xs">{visit.department}</Badge>
                    {visit.isFollowUp && (
                      <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                        Follow-up
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function SiteVisitMonitoring() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Access control - only master_admin and HR department
  const hasAccess = user?.role === "master_admin" || 
                   (user?.department && user.department.toLowerCase() === 'hr');

  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [followUpFilter, setFollowUpFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grouped" | "individual">("grouped");

  // Force data refresh when filters change
  const refetchData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/site-visits/monitoring"] });
    refetch();
  };
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsVisit, setDetailsVisit] = useState<SiteVisit | null>(null);

  // Live site visits data with real-time updates
  const { data: siteVisits = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/site-visits/monitoring", statusFilter, departmentFilter, dateFilter, followUpFilter],
    queryFn: async () => {
      // Build query params
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (departmentFilter && departmentFilter !== 'all') params.append('department', departmentFilter);
      if (dateFilter) params.append('startDate', dateFilter);
      
      const queryString = params.toString();
      const url = `/api/site-visits${queryString ? `?${queryString}` : ''}`;
      
      console.log('SITE_VISITS_QUERY_URL:', url);
      
      const response = await apiRequest(url, 'GET');
      const responseData = await response.json();
      
      console.log('SITE_VISITS_API_RESPONSE:', responseData);
      
      // The API returns { data: [...], filters: {}, count: number }
      const visits = responseData.data || responseData || [];
      
      // Enrich with user information and proper data mapping
      return visits.map((visit: any) => ({
        ...visit,
        siteInTime: new Date(visit.siteInTime),
        siteOutTime: visit.siteOutTime ? new Date(visit.siteOutTime) : null,
        createdAt: visit.createdAt ? new Date(visit.createdAt) : new Date(visit.siteInTime),
        updatedAt: visit.updatedAt ? new Date(visit.updatedAt) : new Date(),
        sitePhotos: visit.sitePhotos?.map((photo: any) => ({
          ...photo,
          timestamp: new Date(photo.timestamp)
        })) || [],
        // Ensure customer data structure is consistent
        customer: visit.customer || {
          name: visit.customerName || 'Unknown Customer',
          mobile: visit.customerPhone || '',
          address: visit.siteAddress || '',
          propertyType: visit.customer?.propertyType || 'unknown'
        }
      }));
    },
    refetchInterval: 15000, // Live updates every 15 seconds
    enabled: hasAccess
  });

  // Debug: Log all site visits data to understand the structure (can be removed after testing)
  console.log('SITE_VISITS_RAW_DATA:', siteVisits.map(visit => ({
    id: visit.id,
    customerName: visit.customer?.name,
    status: visit.status,
    department: visit.department,
    isFollowUp: visit.isFollowUp,
    followUpCount: visit.followUpCount,
    siteInTime: visit.siteInTime,
    siteOutTime: visit.siteOutTime
  })));

  // Enhanced dashboard statistics with follow-up metrics
  const stats = {
    total: siteVisits.length,
    inProgress: siteVisits.filter(v => v.status === 'in_progress').length,
    completed: siteVisits.filter(v => v.status === 'completed').length,
    today: siteVisits.filter(v => {
      const today = new Date();
      const visitDate = new Date(v.siteInTime);
      return visitDate.toDateString() === today.toDateString();
    }).length,
    // Enhanced follow-up metrics
    followUps: siteVisits.filter(v => v.isFollowUp).length,
    originalVisits: siteVisits.filter(v => !v.isFollowUp).length,
    withFollowUps: siteVisits.filter(v => v.hasFollowUps).length,
    totalFollowUpCount: siteVisits.reduce((sum, v) => sum + (v.followUpCount || 0), 0)
  };
  
  console.log('SITE_VISITS_STATS:', stats);

  // Group visits by customer function
  const groupVisitsByCustomer = (visits: SiteVisit[]): CustomerVisitGroup[] => {
    if (!visits || !Array.isArray(visits)) {
      return [];
    }

    const groupMap = new Map<string, CustomerVisitGroup>();

    visits.forEach(visit => {
      const mobile = visit.customer?.mobile || visit.customerPhone || 'unknown';
      
      if (!groupMap.has(mobile)) {
        // Initialize new group with this visit as primary
        groupMap.set(mobile, {
          customerMobile: mobile,
          customerName: visit.customer?.name || visit.customerName || 'Unknown Customer',
          customerAddress: visit.customer?.address || visit.siteAddress || '',
          primaryVisit: visit,
          followUps: [],
          totalVisits: 1,
          latestStatus: visit.status,
          hasActiveVisit: visit.status === 'in_progress',
          latestActivity: new Date(visit.createdAt || visit.siteInTime)
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
          group.latestActivity = visitTime;
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
    return Array.from(groupMap.values()).sort((a, b) => 
      b.latestActivity.getTime() - a.latestActivity.getTime()
    );
  };

  // Enhanced filtered data with follow-up awareness
  const filteredVisits = siteVisits.filter(visit => {
    const matchesSearch = !searchQuery || 
      visit.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visit.customer?.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visit.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visit.followUpReason?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = !dateFilter || 
      format(visit.siteInTime, 'yyyy-MM-dd') === dateFilter;
    
    const matchesDepartment = !departmentFilter || departmentFilter === 'all' || 
      visit.department.toLowerCase() === departmentFilter.toLowerCase();
    
    const matchesStatus = !statusFilter || statusFilter === 'all' || visit.status === statusFilter;
    
    const matchesFollowUp = !followUpFilter || followUpFilter === 'all' || 
      (followUpFilter === 'original' && !visit.isFollowUp) ||
      (followUpFilter === 'follow_up' && visit.isFollowUp) ||
      (followUpFilter === 'with_follow_ups' && visit.hasFollowUps);
    
    return matchesSearch && matchesDate && matchesDepartment && matchesStatus && matchesFollowUp;
  });

  // Get grouped data
  const groupedVisits = groupVisitsByCustomer(filteredVisits);

  // Filter grouped visits based on filters
  const filteredGroups = groupedVisits.filter(group => {
    const matchesSearch = !searchQuery || 
      group.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.customerAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      group.primaryVisit.userName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = !dateFilter || 
      format(group.primaryVisit.siteInTime, 'yyyy-MM-dd') === dateFilter;
    
    const matchesDepartment = !departmentFilter || departmentFilter === 'all' || 
      group.primaryVisit.department.toLowerCase() === departmentFilter.toLowerCase();
    
    const matchesStatus = !statusFilter || statusFilter === 'all' || group.latestStatus === statusFilter;
    
    const matchesFollowUp = !followUpFilter || followUpFilter === 'all' || 
      (followUpFilter === 'original' && !group.primaryVisit.isFollowUp) ||
      (followUpFilter === 'follow_up' && group.primaryVisit.isFollowUp) ||
      (followUpFilter === 'with_follow_ups' && group.followUps.length > 0);
    
    return matchesSearch && matchesDate && matchesDepartment && matchesStatus && matchesFollowUp;
  });

  // Export functionality
  const exportSiteVisitsData = async () => {
    try {
      const response = await apiRequest("/api/site-visits/export", 'POST', {
        filters: {
          dateFilter,
          departmentFilter,
          statusFilter,
          searchQuery
        }
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `site-visits-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "Site visits data has been downloaded"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Unable to export data. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Access denied screen
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="py-10">
            <div className="text-center space-y-4">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
              <h3 className="text-lg font-medium">Access Restricted</h3>
              <p className="text-gray-600">
                This monitoring dashboard is only accessible to Master Administrators and HR Department personnel.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Site Visit Monitoring</h1>
          <p className="text-sm sm:text-base text-gray-600">Live monitoring and reporting dashboard for all site visits</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button
              variant={viewMode === "grouped" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grouped")}
              className="h-8 px-3"
            >
              <Users className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Grouped</span>
            </Button>
            <Button
              variant={viewMode === "individual" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("individual")}
              className="h-8 px-3"
            >
              <FileText className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Individual</span>
            </Button>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" className="flex-1 sm:flex-initial">
            <RefreshCw className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Refresh</span>
          </Button>
          <Button onClick={exportSiteVisitsData} variant="outline" size="sm" className="flex-1 sm:flex-initial">
            <Download className="h-4 w-4 mr-2" />
            <span className="hidden xs:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Enhanced Statistics Cards with Follow-up Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <Card>
          <CardContent className="py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Visits</p>
                <p className="text-lg sm:text-2xl font-bold">{stats.total}</p>
              </div>
              <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">In Progress</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-600">{stats.inProgress}</p>
              </div>
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Completed</p>
                <p className="text-lg sm:text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Today</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-600">{stats.today}</p>
              </div>
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Follow-ups</p>
                <p className="text-lg sm:text-2xl font-bold text-indigo-600">{stats.followUps}</p>
              </div>
              <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Has Follow-ups</p>
                <p className="text-lg sm:text-2xl font-bold text-teal-600">{stats.withFollowUps}</p>
              </div>
              <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-teal-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-3 sm:py-4">
          <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-wrap sm:gap-4">
            <div className="flex-1 sm:min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by customer, address, or employee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 text-sm"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:flex sm:gap-4">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="sm:w-40 text-sm"
              />
              
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="hr">HR</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="sm:w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={followUpFilter} onValueChange={setFollowUpFilter}>
                <SelectTrigger className="sm:w-40">
                  <SelectValue placeholder="Follow-up Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Visits</SelectItem>
                  <SelectItem value="original">Original Visits</SelectItem>
                  <SelectItem value="follow_up">Follow-up Visits</SelectItem>
                  <SelectItem value="with_follow_ups">Has Follow-ups</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(searchQuery || dateFilter || (departmentFilter && departmentFilter !== 'all') || (statusFilter && statusFilter !== 'all') || (followUpFilter && followUpFilter !== 'all')) && (
              <Button 
                variant="outline" 
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  setSearchQuery("");
                  setDateFilter("");
                  setDepartmentFilter("all");
                  setStatusFilter("all");
                  setFollowUpFilter("all");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Site Visits Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Site Visits ({viewMode === "grouped" ? filteredGroups.length : filteredVisits.length} {viewMode === "grouped" ? "customers" : "visits"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading site visits...
            </div>
          ) : (viewMode === "grouped" ? filteredGroups.length === 0 : filteredVisits.length === 0) ? (
            <div className="text-center py-8 text-gray-500">
              No site visits found matching your criteria
            </div>
          ) : (
            <div className="space-y-4">
              {viewMode === "grouped" ? (
                // Grouped View - Customer Visit Groups
                filteredGroups.map((group) => (
                  <CustomerVisitGroupCard
                    key={group.customerMobile}
                    group={group}
                    onViewDetails={setSelectedVisit}
                  />
                ))
              ) : (
                // Individual View - All visits separately  
                filteredVisits.map((visit) => (
                <Card key={visit.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                          <h3 className="font-semibold text-base sm:text-lg">{visit.customer?.name || visit.customerName || 'Unknown Customer'}</h3>
                          <div className="flex flex-wrap gap-2">
                            <Badge 
                              variant={
                                visit.status === 'completed' ? 'default' : 
                                visit.status === 'in_progress' ? 'secondary' : 'destructive'
                              }
                              className="capitalize text-xs"
                            >
                              {visit.status === 'in_progress' ? 'In Progress' : 
                               visit.status === 'completed' ? 'Completed' : 'Cancelled'}
                            </Badge>
                            <Badge variant="outline" className="capitalize text-xs">{visit.department}</Badge>
                            {visit.isFollowUp && (
                              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Follow-up
                              </Badge>
                            )}
                            {visit.hasFollowUps && !visit.isFollowUp && (
                              <Badge variant="outline" className="text-xs border-green-500 text-green-700">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                {visit.followUpCount} Follow-up{visit.followUpCount !== 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">{visit.visitPurpose || 'Site Visit'}</p>
                          {visit.isFollowUp && visit.followUpReason && (
                            <p className="text-xs text-purple-600 font-medium">
                              Reason: {visit.followUpReason.replace('_', ' ')}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Customer & Contact Info */}
                    <div className="space-y-3 mb-4">
                      <div className="flex items-start gap-2 text-xs sm:text-sm">
                        <MapPin className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="font-medium">Address:</span>
                          <span className="text-muted-foreground ml-1 break-words">
                            {visit.customer?.address || visit.siteAddress || 'No address provided'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                        {(visit.customer?.mobile || visit.customerPhone) && (
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <Phone className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 flex-shrink-0" />
                            <span className="font-medium">Phone:</span>
                            <span className="text-muted-foreground">{visit.customer?.mobile || visit.customerPhone}</span>
                          </div>
                        )}
                        {visit.customer?.propertyType && (
                          <div className="flex items-center gap-2 text-xs sm:text-sm">
                            <Building className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500 flex-shrink-0" />
                            <span className="font-medium">Property:</span>
                            <span className="text-muted-foreground capitalize">{visit.customer.propertyType}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <Users className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500 flex-shrink-0" />
                          <span className="font-medium">Employee:</span>
                          <span className="text-muted-foreground">{visit.userName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm">
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-500 flex-shrink-0" />
                          <span className="font-medium">Check-in:</span>
                          <span className="text-muted-foreground">{format(visit.siteInTime, 'MMM dd, HH:mm')}</span>
                        </div>
                        {visit.siteOutTime && (
                          <div className="flex items-center gap-2 text-xs sm:text-sm col-span-1 sm:col-span-2">
                            <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 flex-shrink-0" />
                            <span className="font-medium">Check-out:</span>
                            <span className="text-muted-foreground">{format(visit.siteOutTime, 'MMM dd, HH:mm')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location & Photo Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t">
                      <div className="flex flex-wrap items-center gap-2">
                        {visit.siteInLocation && (
                          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                            <Navigation className="h-2 w-2 sm:h-3 sm:w-3" />
                            Location Tracked
                          </Badge>
                        )}
                        {visit.sitePhotos?.length > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1 text-xs">
                            <Camera className="h-2 w-2 sm:h-3 sm:w-3" />
                            {visit.sitePhotos.length} Photos
                          </Badge>
                        )}
                        {(visit.technicalData || visit.marketingData || visit.adminData) && (
                          <Badge variant="outline" className="flex items-center gap-1 text-xs">
                            <FileText className="h-2 w-2 sm:h-3 sm:w-3" />
                            Data
                          </Badge>
                        )}
                      </div>
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setDetailsVisit(visit);
                          setIsDetailsModalOpen(true);
                        }}
                      >
                        <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                        <span className="text-xs sm:text-sm">View Details</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Site Visit Details Modal */}
      <SiteVisitDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        siteVisit={detailsVisit}
      />
    </div>
  );
}