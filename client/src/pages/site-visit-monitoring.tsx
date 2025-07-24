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
  User, Zap
} from "lucide-react";
import { format } from "date-fns";

interface SiteVisit {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  siteAddress: string;
  department: string;
  visitType: string;
  siteInTime: Date;
  siteOutTime?: Date;
  status: 'in_progress' | 'completed' | 'cancelled';
  sitePhotos: {
    url: string;
    caption?: string;
    timestamp: Date;
  }[];
  notes?: string;
  visitPurpose: string;
  userName: string;
  userDepartment: string;
  latitude?: number;
  longitude?: number;
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
  customer?: {
    ebServiceNumber?: string;
    propertyType?: string;
  };
}

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

  // Force data refresh when filters change
  const refetchData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/site-visits/monitoring"] });
    refetch();
  };
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Live site visits data with real-time updates
  const { data: siteVisits = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/site-visits/monitoring", statusFilter, departmentFilter, dateFilter],
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
      
      // Enrich with user information
      return visits.map((visit: any) => ({
        ...visit,
        siteInTime: new Date(visit.siteInTime),
        siteOutTime: visit.siteOutTime ? new Date(visit.siteOutTime) : null,
        sitePhotos: visit.sitePhotos?.map((photo: any) => ({
          ...photo,
          timestamp: new Date(photo.timestamp)
        })) || []
      }));
    },
    refetchInterval: 15000, // Live updates every 15 seconds
    enabled: hasAccess
  });

  // Debug: Log all site visits data to understand the structure (can be removed after testing)
  console.log('SITE_VISITS_RAW_DATA:', siteVisits.map(visit => ({
    id: visit.id,
    customerName: visit.customerName,
    status: visit.status,
    department: visit.department,
    siteInTime: visit.siteInTime,
    siteOutTime: visit.siteOutTime
  })));

  // Dashboard statistics
  const stats = {
    total: siteVisits.length,
    inProgress: siteVisits.filter(v => v.status === 'in_progress').length,
    completed: siteVisits.filter(v => v.status === 'completed').length,
    today: siteVisits.filter(v => {
      const today = new Date();
      const visitDate = new Date(v.siteInTime);
      return visitDate.toDateString() === today.toDateString();
    }).length
  };
  
  console.log('SITE_VISITS_STATS:', stats);

  // Filtered data with debugging
  const filteredVisits = siteVisits.filter(visit => {
    const matchesSearch = !searchQuery || 
      visit.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visit.siteAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
      visit.userName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = !dateFilter || 
      format(visit.siteInTime, 'yyyy-MM-dd') === dateFilter;
    
    const matchesDepartment = !departmentFilter || departmentFilter === 'all' || 
      visit.department.toLowerCase() === departmentFilter.toLowerCase();
    
    const matchesStatus = !statusFilter || statusFilter === 'all' || visit.status === statusFilter;
    
    // Debug logging for status filter issues (can be removed after testing)
    if (statusFilter === 'completed') {
      console.log('SITE_VISIT_FILTER_DEBUG:', {
        visitId: visit.id,
        customerName: visit.customerName,
        status: visit.status,
        statusFilter,
        matchesStatus,
        department: visit.department,
        siteInTime: visit.siteInTime
      });
    }
    
    return matchesSearch && matchesDate && matchesDepartment && matchesStatus;
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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Site Visit Monitoring</h1>
          <p className="text-gray-600">Live monitoring and reporting dashboard for all site visits</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={exportSiteVisitsData} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Visits</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-orange-600">{stats.inProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Today's Visits</p>
                <p className="text-2xl font-bold text-purple-600">{stats.today}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by customer, address, or employee..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-40"
            />
            
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-40">
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
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {(searchQuery || dateFilter || (departmentFilter && departmentFilter !== 'all') || (statusFilter && statusFilter !== 'all')) && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setDateFilter("");
                  setDepartmentFilter("all");
                  setStatusFilter("all");
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
            Site Visits ({filteredVisits.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              Loading site visits...
            </div>
          ) : filteredVisits.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No site visits found matching your criteria
            </div>
          ) : (
            <div className="space-y-4">
              {filteredVisits.map((visit) => (
                <Card key={visit.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <h3 className="font-semibold text-lg">{visit.customerName}</h3>
                          <p className="text-sm text-muted-foreground">{visit.visitPurpose || 'Site Visit'}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge 
                            variant={
                              visit.status === 'completed' ? 'default' : 
                              visit.status === 'in_progress' ? 'secondary' : 'destructive'
                            }
                            className="capitalize"
                          >
                            {visit.status === 'in_progress' ? 'In Progress' : 
                             visit.status === 'completed' ? 'Completed' : 'Cancelled'}
                          </Badge>
                          <Badge variant="outline" className="capitalize">{visit.department}</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Customer & Contact Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">Address:</span>
                          <span className="text-muted-foreground">{visit.siteAddress}</span>
                        </div>
                        {visit.customerPhone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-green-500" />
                            <span className="font-medium">Phone:</span>
                            <span className="text-muted-foreground">{visit.customerPhone}</span>
                          </div>
                        )}
                        {visit.customerEmail && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">Email:</span>
                            <span className="text-muted-foreground">{visit.customerEmail}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-purple-500" />
                          <span className="font-medium">Employee:</span>
                          <span className="text-muted-foreground">{visit.userName} ({visit.userDepartment})</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-indigo-500" />
                          <span className="font-medium">Check-in:</span>
                          <span className="text-muted-foreground">{format(visit.siteInTime, 'MMM dd, yyyy HH:mm')}</span>
                        </div>
                        {visit.siteOutTime && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-red-500" />
                            <span className="font-medium">Check-out:</span>
                            <span className="text-muted-foreground">{format(visit.siteOutTime, 'MMM dd, yyyy HH:mm')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location & Photo Info */}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="flex items-center gap-4">
                        {visit.siteInLocation && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Navigation className="h-3 w-3" />
                            Location Tracked
                          </Badge>
                        )}
                        {visit.sitePhotos?.length > 0 && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Camera className="h-3 w-3" />
                            {visit.sitePhotos.length} Photos
                          </Badge>
                        )}
                        {(visit.technicalData || visit.marketingData || visit.adminData) && (
                          <Badge variant="outline" className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Department Data
                          </Badge>
                        )}
                      </div>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedVisit(visit);
                              setCurrentImageIndex(0);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Complete Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Site Visit Details - {visit.customerName}</DialogTitle>
                          </DialogHeader>
                          
                          {selectedVisit && (
                            <Tabs defaultValue="overview" className="space-y-4">
                              <TabsList>
                                <TabsTrigger value="overview">Overview</TabsTrigger>
                                <TabsTrigger value="photos">Photos ({selectedVisit.sitePhotos?.length || 0})</TabsTrigger>
                                <TabsTrigger value="location">Location</TabsTrigger>
                                <TabsTrigger value="data">Department Data</TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="overview" className="space-y-6">
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {/* Customer Information Card */}
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="flex items-center gap-2 text-lg">
                                        <Users className="h-5 w-5" />
                                        Customer Information
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-blue-500" />
                                        <span className="font-medium">Name:</span>
                                        <span>{selectedVisit.customerName}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-green-500" />
                                        <span className="font-medium">Phone:</span>
                                        <span>{selectedVisit.customerPhone}</span>
                                      </div>
                                      {selectedVisit.customerEmail && (
                                        <div className="flex items-center gap-2">
                                          <Mail className="h-4 w-4 text-orange-500" />
                                          <span className="font-medium">Email:</span>
                                          <span>{selectedVisit.customerEmail}</span>
                                        </div>
                                      )}
                                      <div className="flex items-start gap-2">
                                        <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
                                        <span className="font-medium">Address:</span>
                                        <span className="text-sm">{selectedVisit.siteAddress}</span>
                                      </div>
                                      {selectedVisit.customer?.ebServiceNumber && (
                                        <div className="flex items-center gap-2">
                                          <Building className="h-4 w-4 text-purple-500" />
                                          <span className="font-medium">EB Service:</span>
                                          <span>{selectedVisit.customer.ebServiceNumber}</span>
                                        </div>
                                      )}
                                      {selectedVisit.customer?.propertyType && (
                                        <div className="flex items-center gap-2">
                                          <Building className="h-4 w-4 text-indigo-500" />
                                          <span className="font-medium">Property Type:</span>
                                          <Badge variant="outline" className="capitalize">
                                            {selectedVisit.customer.propertyType}
                                          </Badge>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                  
                                  {/* Visit Information Card */}
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="flex items-center gap-2 text-lg">
                                        <Calendar className="h-5 w-5" />
                                        Visit Information
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-purple-500" />
                                        <span className="font-medium">Employee:</span>
                                        <span>{selectedVisit.userName}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4 text-blue-500" />
                                        <span className="font-medium">Department:</span>
                                        <Badge variant="outline" className="capitalize">
                                          {selectedVisit.department}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-green-500" />
                                        <span className="font-medium">Purpose:</span>
                                        <Badge variant="secondary" className="capitalize">
                                          {selectedVisit.visitPurpose || 'Site Visit'}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-indigo-500" />
                                        <span className="font-medium">Status:</span>
                                        <Badge 
                                          variant={
                                            selectedVisit.status === 'completed' ? 'default' : 
                                            selectedVisit.status === 'in_progress' ? 'secondary' : 'destructive'
                                          }
                                          className="capitalize"
                                        >
                                          {selectedVisit.status.replace('_', ' ')}
                                        </Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-blue-500" />
                                        <span className="font-medium">Check-in:</span>
                                        <span className="text-sm">{format(selectedVisit.siteInTime, 'MMM dd, yyyy HH:mm:ss')}</span>
                                      </div>
                                      {selectedVisit.siteOutTime && (
                                        <div className="flex items-center gap-2">
                                          <Clock className="h-4 w-4 text-red-500" />
                                          <span className="font-medium">Check-out:</span>
                                          <span className="text-sm">{format(selectedVisit.siteOutTime, 'MMM dd, yyyy HH:mm:ss')}</span>
                                        </div>
                                      )}
                                      {selectedVisit.siteInTime && selectedVisit.siteOutTime && (
                                        <div className="flex items-center gap-2">
                                          <TrendingUp className="h-4 w-4 text-orange-500" />
                                          <span className="font-medium">Duration:</span>
                                          <span className="text-sm">
                                            {Math.round((new Date(selectedVisit.siteOutTime).getTime() - new Date(selectedVisit.siteInTime).getTime()) / (1000 * 60))} minutes
                                          </span>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                </div>

                                {/* Photos Overview */}
                                {selectedVisit.siteInPhotoUrl && (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="flex items-center gap-2 text-lg">
                                        <Camera className="h-5 w-5" />
                                        Check-in Photo
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <img 
                                        src={selectedVisit.siteInPhotoUrl}
                                        alt="Check-in photo"
                                        className="w-full max-w-md h-48 object-cover rounded-lg border"
                                      />
                                    </CardContent>
                                  </Card>
                                )}

                                {selectedVisit.siteOutPhotoUrl && (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="flex items-center gap-2 text-lg">
                                        <Camera className="h-5 w-5" />
                                        Check-out Photo
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <img 
                                        src={selectedVisit.siteOutPhotoUrl}
                                        alt="Check-out photo"
                                        className="w-full max-w-md h-48 object-cover rounded-lg border"
                                      />
                                    </CardContent>
                                  </Card>
                                )}
                                
                                {selectedVisit.notes && (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="flex items-center gap-2 text-lg">
                                        <FileText className="h-5 w-5" />
                                        Notes
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                      <p className="text-sm bg-gray-50 p-4 rounded-lg border">{selectedVisit.notes}</p>
                                    </CardContent>
                                  </Card>
                                )}
                              </TabsContent>
                              
                              <TabsContent value="photos">
                                {selectedVisit.sitePhotos?.length > 0 ? (
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-medium">Site Photos</h4>
                                      <p className="text-sm text-gray-600">
                                        {currentImageIndex + 1} of {selectedVisit.sitePhotos.length}
                                      </p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                      <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                                        <img 
                                          src={selectedVisit.sitePhotos[currentImageIndex]?.url}
                                          alt={`Site photo ${currentImageIndex + 1}`}
                                          className="w-full h-96 object-cover"
                                        />
                                      </div>
                                      
                                      {selectedVisit.sitePhotos[currentImageIndex]?.caption && (
                                        <p className="text-sm text-gray-600">
                                          {selectedVisit.sitePhotos[currentImageIndex].caption}
                                        </p>
                                      )}
                                      
                                      <p className="text-xs text-gray-500">
                                        Captured: {format(selectedVisit.sitePhotos[currentImageIndex]?.timestamp, 'MMM dd, yyyy HH:mm:ss')}
                                      </p>
                                      
                                      {selectedVisit.sitePhotos.length > 1 && (
                                        <div className="flex justify-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={currentImageIndex === 0}
                                            onClick={() => setCurrentImageIndex(currentImageIndex - 1)}
                                          >
                                            Previous
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={currentImageIndex === selectedVisit.sitePhotos.length - 1}
                                            onClick={() => setCurrentImageIndex(currentImageIndex + 1)}
                                          >
                                            Next
                                          </Button>
                                        </div>
                                      )}
                                      
                                      {/* Thumbnail gallery */}
                                      <div className="grid grid-cols-6 gap-2">
                                        {selectedVisit.sitePhotos.map((photo, index) => (
                                          <button
                                            key={index}
                                            onClick={() => setCurrentImageIndex(index)}
                                            className={`aspect-square rounded border-2 overflow-hidden ${
                                              index === currentImageIndex ? 'border-blue-500' : 'border-gray-200'
                                            }`}
                                          >
                                            <img 
                                              src={photo.url}
                                              alt={`Thumbnail ${index + 1}`}
                                              className="w-full h-full object-cover"
                                            />
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-gray-500">
                                    <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    No photos available for this site visit
                                  </div>
                                )}
                              </TabsContent>
                              
                              <TabsContent value="location" className="space-y-6">
                                {(selectedVisit.siteInLocation || selectedVisit.siteOutLocation) ? (
                                  <div className="space-y-6">
                                    {/* Check-in Location */}
                                    {selectedVisit.siteInLocation && (
                                      <Card>
                                        <CardHeader>
                                          <CardTitle className="flex items-center gap-2 text-lg">
                                            <MapPin className="h-5 w-5 text-green-500" />
                                            Check-in Location
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-3">
                                              <div className="flex items-center gap-2">
                                                <Navigation className="h-4 w-4 text-blue-500" />
                                                <span className="font-medium">Coordinates:</span>
                                                <span className="text-sm">
                                                  {selectedVisit.siteInLocation.latitude?.toFixed(6)}, {selectedVisit.siteInLocation.longitude?.toFixed(6)}
                                                </span>
                                              </div>
                                              {selectedVisit.siteInLocation.accuracy && (
                                                <div className="flex items-center gap-2">
                                                  <TrendingUp className="h-4 w-4 text-orange-500" />
                                                  <span className="font-medium">Accuracy:</span>
                                                  <Badge variant="outline">±{selectedVisit.siteInLocation.accuracy}m</Badge>
                                                </div>
                                              )}
                                              <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
                                                <span className="font-medium">Address:</span>
                                                <span className="text-sm">{selectedVisit.siteInLocation.address || 'Address not available'}</span>
                                              </div>
                                            </div>
                                            <div>
                                              <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => {
                                                  const url = `https://www.google.com/maps?q=${selectedVisit.siteInLocation.latitude},${selectedVisit.siteInLocation.longitude}`;
                                                  window.open(url, '_blank');
                                                }}
                                              >
                                                <Navigation className="h-4 w-4 mr-2" />
                                                View Check-in on Maps
                                              </Button>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )}

                                    {/* Check-out Location */}
                                    {selectedVisit.siteOutLocation && (
                                      <Card>
                                        <CardHeader>
                                          <CardTitle className="flex items-center gap-2 text-lg">
                                            <MapPin className="h-5 w-5 text-red-500" />
                                            Check-out Location
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-3">
                                              <div className="flex items-center gap-2">
                                                <Navigation className="h-4 w-4 text-blue-500" />
                                                <span className="font-medium">Coordinates:</span>
                                                <span className="text-sm">
                                                  {selectedVisit.siteOutLocation.latitude?.toFixed(6)}, {selectedVisit.siteOutLocation.longitude?.toFixed(6)}
                                                </span>
                                              </div>
                                              {selectedVisit.siteOutLocation.accuracy && (
                                                <div className="flex items-center gap-2">
                                                  <TrendingUp className="h-4 w-4 text-orange-500" />
                                                  <span className="font-medium">Accuracy:</span>
                                                  <Badge variant="outline">±{selectedVisit.siteOutLocation.accuracy}m</Badge>
                                                </div>
                                              )}
                                              <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-red-500 mt-0.5" />
                                                <span className="font-medium">Address:</span>
                                                <span className="text-sm">{selectedVisit.siteOutLocation.address || 'Address not available'}</span>
                                              </div>
                                            </div>
                                            <div>
                                              <Button
                                                variant="outline"
                                                className="w-full"
                                                onClick={() => {
                                                  const url = `https://www.google.com/maps?q=${selectedVisit.siteOutLocation.latitude},${selectedVisit.siteOutLocation.longitude}`;
                                                  window.open(url, '_blank');
                                                }}
                                              >
                                                <Navigation className="h-4 w-4 mr-2" />
                                                View Check-out on Maps
                                              </Button>
                                            </div>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )}

                                    {/* Location Comparison */}
                                    {selectedVisit.siteInLocation && selectedVisit.siteOutLocation && (
                                      <Card>
                                        <CardHeader>
                                          <CardTitle className="flex items-center gap-2 text-lg">
                                            <BarChart3 className="h-5 w-5 text-purple-500" />
                                            Location Analysis
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                          <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                              <TrendingUp className="h-4 w-4 text-blue-500" />
                                              <span className="font-medium">Distance between locations:</span>
                                              <Badge variant="secondary">
                                                {(() => {
                                                  const R = 6371; // Earth's radius in km
                                                  const dLat = (selectedVisit.siteOutLocation.latitude - selectedVisit.siteInLocation.latitude) * Math.PI / 180;
                                                  const dLon = (selectedVisit.siteOutLocation.longitude - selectedVisit.siteInLocation.longitude) * Math.PI / 180;
                                                  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                                                           Math.cos(selectedVisit.siteInLocation.latitude * Math.PI / 180) * Math.cos(selectedVisit.siteOutLocation.latitude * Math.PI / 180) *
                                                           Math.sin(dLon/2) * Math.sin(dLon/2);
                                                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                                  const distance = R * c * 1000; // Convert to meters
                                                  return distance < 1000 ? `${Math.round(distance)}m` : `${(distance/1000).toFixed(2)}km`;
                                                })()}
                                              </Badge>
                                            </div>
                                            <Button
                                              variant="outline"
                                              className="w-full"
                                              onClick={() => {
                                                const url = `https://www.google.com/maps/dir/${selectedVisit.siteInLocation.latitude},${selectedVisit.siteInLocation.longitude}/${selectedVisit.siteOutLocation.latitude},${selectedVisit.siteOutLocation.longitude}`;
                                                window.open(url, '_blank');
                                              }}
                                            >
                                              <Navigation className="h-4 w-4 mr-2" />
                                              View Route on Maps
                                            </Button>
                                          </div>
                                        </CardContent>
                                      </Card>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center py-12">
                                    <MapPin className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Location Data Available</h3>
                                    <p className="text-sm text-gray-500">Location tracking was not enabled for this site visit</p>
                                  </div>
                                )}
                              </TabsContent>
                              
                              <TabsContent value="data" className="space-y-6">
                                {/* Technical Data */}
                                {selectedVisit.technicalData && (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="flex items-center gap-2 text-lg">
                                        <Zap className="h-5 w-5 text-blue-500" />
                                        Technical Department Data
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {selectedVisit.technicalData.serviceTypes && (
                                          <div>
                                            <span className="font-medium">Service Types:</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {selectedVisit.technicalData.serviceTypes.map((type: string, index: number) => (
                                                <Badge key={index} variant="secondary" className="text-xs">
                                                  {type.replace('_', ' ').toUpperCase()}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {selectedVisit.technicalData.workType && (
                                          <div>
                                            <span className="font-medium">Work Type:</span>
                                            <Badge variant="outline" className="ml-2 capitalize">
                                              {selectedVisit.technicalData.workType.replace('_', ' ')}
                                            </Badge>
                                          </div>
                                        )}
                                        {selectedVisit.technicalData.workingStatus && (
                                          <div>
                                            <span className="font-medium">Status:</span>
                                            <Badge 
                                              variant={selectedVisit.technicalData.workingStatus === 'completed' ? 'default' : 'secondary'}
                                              className="ml-2 capitalize"
                                            >
                                              {selectedVisit.technicalData.workingStatus}
                                            </Badge>
                                          </div>
                                        )}
                                        {selectedVisit.technicalData.teamMembers && (
                                          <div>
                                            <span className="font-medium">Team Members:</span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {selectedVisit.technicalData.teamMembers.map((member: string, index: number) => (
                                                <Badge key={index} variant="outline" className="text-xs">
                                                  {member}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      {selectedVisit.technicalData.pendingRemarks && (
                                        <div className="pt-3 border-t">
                                          <span className="font-medium">Pending Remarks:</span>
                                          <p className="text-sm mt-1 bg-yellow-50 p-3 rounded border">
                                            {selectedVisit.technicalData.pendingRemarks}
                                          </p>
                                        </div>
                                      )}
                                      {selectedVisit.technicalData.description && (
                                        <div className="pt-3 border-t">
                                          <span className="font-medium">Description:</span>
                                          <p className="text-sm mt-1 bg-gray-50 p-3 rounded">
                                            {selectedVisit.technicalData.description}
                                          </p>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                )}
                                
                                {/* Marketing Data */}
                                {selectedVisit.marketingData && (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="flex items-center gap-2 text-lg">
                                        <TrendingUp className="h-5 w-5 text-green-500" />
                                        Marketing Department Data
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <span className="font-medium">Requirements Update:</span>
                                          <Badge 
                                            variant={selectedVisit.marketingData.updateRequirements ? 'default' : 'secondary'}
                                            className="ml-2"
                                          >
                                            {selectedVisit.marketingData.updateRequirements ? 'Yes' : 'No'}
                                          </Badge>
                                        </div>
                                        {selectedVisit.marketingData.projectType && (
                                          <div>
                                            <span className="font-medium">Project Type:</span>
                                            <Badge variant="outline" className="ml-2 capitalize">
                                              {selectedVisit.marketingData.projectType.replace('_', ' ')}
                                            </Badge>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Project Configuration Details */}
                                      {selectedVisit.marketingData.onGridConfig && (
                                        <div className="pt-3 border-t">
                                          <h5 className="font-medium mb-2">On-Grid Configuration</h5>
                                          <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>Panel: {selectedVisit.marketingData.onGridConfig.solarPanelMake}</div>
                                            <div>Inverter: {selectedVisit.marketingData.onGridConfig.inverterMake}</div>
                                            <div>Panel Count: {selectedVisit.marketingData.onGridConfig.panelCount}</div>
                                            <div>Project Value: ₹{selectedVisit.marketingData.onGridConfig.projectValue}</div>
                                          </div>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                )}
                                
                                {/* Admin Data */}
                                {selectedVisit.adminData && (
                                  <Card>
                                    <CardHeader>
                                      <CardTitle className="flex items-center gap-2 text-lg">
                                        <Building className="h-5 w-5 text-purple-500" />
                                        Administrative Data
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                      {selectedVisit.adminData.bankProcess && (
                                        <div>
                                          <span className="font-medium">Bank Process:</span>
                                          <Badge variant="outline" className="ml-2 capitalize">
                                            {selectedVisit.adminData.bankProcess.step?.replace('_', ' ')}
                                          </Badge>
                                          {selectedVisit.adminData.bankProcess.description && (
                                            <p className="text-sm mt-2 bg-blue-50 p-3 rounded">
                                              {selectedVisit.adminData.bankProcess.description}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                      
                                      {selectedVisit.adminData.ebProcess && (
                                        <div>
                                          <span className="font-medium">EB Process:</span>
                                          <Badge variant="outline" className="ml-2 capitalize">
                                            {selectedVisit.adminData.ebProcess.type?.replace('_', ' ')}
                                          </Badge>
                                          {selectedVisit.adminData.ebProcess.description && (
                                            <p className="text-sm mt-2 bg-yellow-50 p-3 rounded">
                                              {selectedVisit.adminData.ebProcess.description}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                      
                                      {Object.entries(selectedVisit.adminData).filter(([key, value]) => 
                                        !['bankProcess', 'ebProcess'].includes(key) && value
                                      ).map(([key, value]) => (
                                        <div key={key} className="pt-3 border-t">
                                          <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                          <p className="text-sm mt-1 bg-gray-50 p-3 rounded">
                                            {value as string}
                                          </p>
                                        </div>
                                      ))}
                                    </CardContent>
                                  </Card>
                                )}
                                
                                {!selectedVisit.technicalData && !selectedVisit.marketingData && !selectedVisit.adminData && (
                                  <div className="text-center py-12">
                                    <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                                    <h3 className="text-lg font-medium text-gray-600 mb-2">No Department Data Available</h3>
                                    <p className="text-sm text-gray-500">No department-specific information was captured for this site visit</p>
                                  </div>
                                )}
                              </TabsContent>
                            </Tabs>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}