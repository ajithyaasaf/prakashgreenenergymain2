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
  CheckCircle, XCircle, AlertTriangle, Navigation, Phone, Mail
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
  const [selectedVisit, setSelectedVisit] = useState<SiteVisit | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Live site visits data with real-time updates
  const { data: siteVisits = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/site-visits/monitoring"],
    queryFn: async () => {
      const response = await apiRequest("/api/site-visits", 'GET');
      const data = await response.json();
      
      // Enrich with user information
      return data.map((visit: any) => ({
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

  // Debug: Log all site visits data to understand the structure
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
    
    // Debug logging for status filter issues
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
                <div key={visit.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium">{visit.customerName}</h3>
                        <Badge 
                          variant={
                            visit.status === 'completed' ? 'default' : 
                            visit.status === 'in_progress' ? 'secondary' : 'destructive'
                          }
                        >
                          {visit.status === 'in_progress' ? 'In Progress' : 
                           visit.status === 'completed' ? 'Completed' : 'Cancelled'}
                        </Badge>
                        <Badge variant="outline">{visit.department}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {visit.siteAddress}
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {visit.userName} ({visit.userDepartment})
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(visit.siteInTime, 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                      
                      {visit.customerPhone && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone className="h-4 w-4" />
                          {visit.customerPhone}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {visit.sitePhotos?.length > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          {visit.sitePhotos.length} Photos
                        </Badge>
                      )}
                      
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
                            View Details
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
                              
                              <TabsContent value="overview" className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <h4 className="font-medium mb-2">Customer Information</h4>
                                    <div className="space-y-2 text-sm">
                                      <p><strong>Name:</strong> {selectedVisit.customerName}</p>
                                      <p><strong>Phone:</strong> {selectedVisit.customerPhone}</p>
                                      {selectedVisit.customerEmail && (
                                        <p><strong>Email:</strong> {selectedVisit.customerEmail}</p>
                                      )}
                                      <p><strong>Address:</strong> {selectedVisit.siteAddress}</p>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <h4 className="font-medium mb-2">Visit Information</h4>
                                    <div className="space-y-2 text-sm">
                                      <p><strong>Employee:</strong> {selectedVisit.userName}</p>
                                      <p><strong>Department:</strong> {selectedVisit.department}</p>
                                      <p><strong>Visit Type:</strong> {selectedVisit.visitType}</p>
                                      <p><strong>Purpose:</strong> {selectedVisit.visitPurpose}</p>
                                      <p><strong>Site In:</strong> {format(selectedVisit.siteInTime, 'MMM dd, yyyy HH:mm')}</p>
                                      {selectedVisit.siteOutTime && (
                                        <p><strong>Site Out:</strong> {format(selectedVisit.siteOutTime, 'MMM dd, yyyy HH:mm')}</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {selectedVisit.notes && (
                                  <div>
                                    <h4 className="font-medium mb-2">Notes</h4>
                                    <p className="text-sm bg-gray-50 p-3 rounded">{selectedVisit.notes}</p>
                                  </div>
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
                              
                              <TabsContent value="location">
                                {selectedVisit.latitude && selectedVisit.longitude ? (
                                  <div className="space-y-4">
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                      <p className="text-sm font-medium mb-2">GPS Coordinates</p>
                                      <p className="text-sm text-gray-600">
                                        Latitude: {selectedVisit.latitude}<br />
                                        Longitude: {selectedVisit.longitude}
                                      </p>
                                    </div>
                                    
                                    <Button
                                      variant="outline"
                                      className="w-full"
                                      onClick={() => {
                                        const url = `https://www.google.com/maps?q=${selectedVisit.latitude},${selectedVisit.longitude}`;
                                        window.open(url, '_blank');
                                      }}
                                    >
                                      <Navigation className="h-4 w-4 mr-2" />
                                      View on Google Maps
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="text-center py-8 text-gray-500">
                                    <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                    Location data not available
                                  </div>
                                )}
                              </TabsContent>
                              
                              <TabsContent value="data">
                                <div className="space-y-4">
                                  {selectedVisit.technicalData && (
                                    <div>
                                      <h4 className="font-medium mb-2">Technical Data</h4>
                                      <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">
                                        {JSON.stringify(selectedVisit.technicalData, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  
                                  {selectedVisit.marketingData && (
                                    <div>
                                      <h4 className="font-medium mb-2">Marketing Data</h4>
                                      <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">
                                        {JSON.stringify(selectedVisit.marketingData, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  
                                  {selectedVisit.adminData && (
                                    <div>
                                      <h4 className="font-medium mb-2">Admin Data</h4>
                                      <pre className="text-sm bg-gray-50 p-3 rounded overflow-auto">
                                        {JSON.stringify(selectedVisit.adminData, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  
                                  {!selectedVisit.technicalData && !selectedVisit.marketingData && !selectedVisit.adminData && (
                                    <div className="text-center py-8 text-gray-500">
                                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                      No department-specific data available
                                    </div>
                                  )}
                                </div>
                              </TabsContent>
                            </Tabs>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}