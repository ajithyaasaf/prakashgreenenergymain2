import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { 
  CalendarIcon, Search, Loader2, FileText, BarChart, UserCheck, Clock, 
  Plus, Edit, Trash2, Eye, Download, Upload, Settings, Users, 
  CheckCircle, XCircle, AlertCircle, MapPin, Camera
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { departments } from "@shared/schema";

export default function AttendanceManagement() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("live");
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    employeeName: string;
    date: string;
    time: string;
    attendanceType: string;
    customerName?: string;
    location?: string;
  } | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    status: '',
    overtimeHours: 0,
    remarks: ''
  });

  // Real-time attendance data - Fixed memory leak with cleanup
  const { data: liveAttendance = [], isLoading: isLoadingLive, refetch: refetchLive } = useQuery({
    queryKey: ['/api/attendance/live'],
    enabled: !!user && user.role === "master_admin",
    refetchInterval: 30000, // Refresh every 30 seconds
    refetchOnWindowFocus: false, // Prevent excessive refetching
  });

  // Daily attendance records
  const { data: dailyAttendance = [], isLoading: isLoadingDaily, refetch: refetchDaily } = useQuery({
    queryKey: ['/api/attendance', { date: selectedDate.toISOString().split('T')[0] }],
    enabled: !!user,
    queryFn: async () => {
      const dateParam = selectedDate.toISOString().split('T')[0];
      const attendanceResponse = await apiRequest('GET', `/api/attendance?date=${dateParam}`);
      const attendanceData = await attendanceResponse.json();
      
      // Enrich with user details
      const usersResponse = await apiRequest('GET', '/api/users');
      const users = await usersResponse.json();
      
      return attendanceData.map((record: any) => {
        const userDetails = users.find((u: any) => u.id === record.userId);
        return {
          ...record,
          userName: userDetails?.displayName || `User #${record.userId}`,
          userDepartment: userDetails?.department || null,
          userDesignation: userDetails?.designation || null,
          userEmail: userDetails?.email || null
        };
      });
    },
  });

  // Attendance policies
  const { data: attendancePolicies = [] } = useQuery({
    queryKey: ['/api/attendance/policies'],
    enabled: !!user,
  });

  // Department statistics
  const { data: departmentStats = [] } = useQuery({
    queryKey: ['/api/attendance/department-stats', selectedDate.toISOString().split('T')[0]],
    enabled: !!user,
    queryFn: async () => {
      const dateParam = selectedDate.toISOString().split('T')[0];
      const response = await apiRequest('GET', `/api/attendance/department-stats?date=${dateParam}`);
      return response.json();
    },
  });

  // Update attendance mutation
  const updateAttendanceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest('PATCH', `/api/attendance/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendance'] });
      refetchLive();
      refetchDaily();
      setShowEditModal(false);
      toast({
        title: "Success",
        description: "Attendance record updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update attendance record",
        variant: "destructive",
      });
    },
  });

  // Bulk actions mutation
  const bulkActionMutation = useMutation({
    mutationFn: async ({ action, attendanceIds, data }: { 
      action: string; 
      attendanceIds: string[]; 
      data?: any 
    }) => {
      const response = await apiRequest('POST', '/api/attendance/bulk-action', { action, attendanceIds, data });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/attendance'] });
      refetchLive();
      refetchDaily();
      toast({
        title: "Success",
        description: "Bulk action completed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to perform bulk action",
        variant: "destructive",
      });
    },
  });

  // Filter attendance records
  const filteredDailyAttendance = dailyAttendance.filter((record: any) => {
    const matchesSearch = !searchQuery || 
      record.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = selectedDepartment === "all" || 
      record.userDepartment === selectedDepartment;
    
    const matchesStatus = selectedStatus === "all" || record.status === selectedStatus;
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  // Filter live attendance
  const filteredLiveAttendance = liveAttendance.filter((record: any) => {
    const matchesSearch = !searchQuery || 
      record.userName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = selectedDepartment === "all" || 
      record.userDepartment === selectedDepartment;
    
    return matchesSearch && matchesDepartment;
  });

  // Handle edit attendance
  const handleEditAttendance = (record: any) => {
    setEditingAttendance(record);
    setEditForm({
      checkInTime: record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5) : '',
      checkOutTime: record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5) : '',
      status: record.status || 'present',
      overtimeHours: record.overtimeHours || 0,
      remarks: record.remarks || ''
    });
    setShowEditModal(true);
  };

  // Handle save edit
  const handleSaveEdit = () => {
    if (!editingAttendance) return;
    
    const updateData: any = {
      status: editForm.status,
      overtimeHours: editForm.overtimeHours,
      remarks: editForm.remarks,
      approvedBy: user?.uid
    };

    // Convert times to full datetime if provided
    if (editForm.checkInTime) {
      const checkInDate = new Date(editingAttendance.date);
      const [hours, minutes] = editForm.checkInTime.split(':');
      checkInDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      updateData.checkInTime = checkInDate.toISOString();
    }

    if (editForm.checkOutTime) {
      const checkOutDate = new Date(editingAttendance.date);
      const [hours, minutes] = editForm.checkOutTime.split(':');
      checkOutDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      updateData.checkOutTime = checkOutDate.toISOString();
    }

    updateAttendanceMutation.mutate({
      id: editingAttendance.id,
      data: updateData
    });
  };

  // Handle image viewing with preloading
  const handleViewImage = async (record: any) => {
    if (!record.checkInImageUrl) {
      toast({
        title: "No Image Available",
        description: "This attendance record doesn't have an associated photo",
        variant: "destructive",
      });
      return;
    }
    
    setImageLoading(true);
    setShowImageModal(true);
    setSelectedImage(null); // Reset previous image
    
    // Prepare image metadata
    const imageData = {
      url: record.checkInImageUrl,
      employeeName: record.userName || 'Unknown Employee',
      date: formatDate(new Date(record.date)),
      time: record.checkInTime ? formatTime(new Date(record.checkInTime)) : 'Unknown Time',
      attendanceType: record.attendanceType === 'field_work' ? 'Field Work' : 
                     record.attendanceType === 'remote' ? 'Remote Work' : 'Office',
      customerName: record.customerName,
      location: record.location
    };
    
    // Preload image with timeout for better UX
    const img = new Image();
    const timeout = setTimeout(() => {
      setImageLoading(false);
      toast({
        title: "Loading Timeout",
        description: "Image is taking too long to load. Please try again.",
        variant: "destructive",
      });
    }, 10000); // 10 second timeout
    
    img.onload = () => {
      clearTimeout(timeout);
      setSelectedImage(imageData);
      setImageLoading(false);
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      setImageLoading(false);
      setShowImageModal(false);
      toast({
        title: "Image Load Failed",
        description: "Unable to load the attendance photo. The image may be corrupted or unavailable.",
        variant: "destructive",
      });
    };
    
    img.src = record.checkInImageUrl;
  };

  // Reset image modal state
  const handleCloseImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
    setImageLoading(false);
  };

  // Status badge styles
  const getStatusBadge = (status: string) => {
    // Handle null/undefined status values
    if (!status) {
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
          Unknown
        </Badge>
      );
    }

    const styles = {
      present: "bg-green-100 text-green-800 border-green-200",
      absent: "bg-red-100 text-red-800 border-red-200",
      late: "bg-orange-100 text-orange-800 border-orange-200",
      leave: "bg-yellow-100 text-yellow-800 border-yellow-200",
      holiday: "bg-blue-100 text-blue-800 border-blue-200",
      half_day: "bg-purple-100 text-purple-800 border-purple-200"
    };
    
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "font-medium capitalize border", 
          styles[status as keyof typeof styles] || "bg-gray-100 text-gray-800 border-gray-200"
        )}
        style={{
          backgroundColor: status === 'present' ? '#dcfce7' : 
                          status === 'absent' ? '#fee2e2' :
                          status === 'late' ? '#fed7aa' :
                          status === 'leave' ? '#fef3c7' :
                          status === 'holiday' ? '#dbeafe' :
                          status === 'half_day' ? '#e9d5ff' : '#f3f4f6',
          color: status === 'present' ? '#166534' : 
                status === 'absent' ? '#991b1b' :
                status === 'late' ? '#c2410c' :
                status === 'leave' ? '#a16207' :
                status === 'holiday' ? '#1e40af' :
                status === 'half_day' ? '#7c3aed' : '#374151'
        }}
      >
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  // Check if user is master admin
  if (user?.role !== "master_admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Access Denied</h3>
          <p className="text-gray-500">Only master administrators can access attendance management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Attendance Management</h1>
          <p className="text-gray-500">Complete control over employee attendance system</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setShowPolicyModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Settings className="h-4 w-4 mr-2" />
            Policies
          </Button>
          <Button className="bg-green-600 hover:bg-green-700">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Department Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {departmentStats.map((dept: any) => (
          <Card key={dept.department}>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500 capitalize">{dept.department}</p>
                  <div className="flex space-x-2 mt-1">
                    <span className="text-green-600 font-semibold">{dept.present}</span>
                    <span className="text-red-600 font-semibold">{dept.absent}</span>
                    <span className="text-orange-600 font-semibold">{dept.late}</span>
                  </div>
                </div>
                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="live" className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
              Live Tracking
            </TabsTrigger>
            <TabsTrigger value="daily" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Daily Records
            </TabsTrigger>
            <TabsTrigger value="corrections" className="flex items-center gap-2">
              <Edit className="h-4 w-4" />
              Corrections
            </TabsTrigger>
          </TabsList>
          
          {/* Filters */}
          <div className="flex space-x-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search employees..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept.charAt(0).toUpperCase() + dept.slice(1).replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeTab === "daily" && (
              <>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="leave">Leave</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                  </SelectContent>
                </Select>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="border-gray-300">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {formatDate(selectedDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      className="rounded-md border"
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
        </div>

        {/* Live Tracking Tab */}
        <TabsContent value="live" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                Live Attendance Tracking
              </CardTitle>
              <CardDescription>
                Real-time monitoring of employee check-ins and check-outs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingLive ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredLiveAttendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No active attendance records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLiveAttendance.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.userName}
                          </TableCell>
                          <TableCell className="capitalize">
                            {record.userDepartment || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {record.checkInTime ? formatTime(new Date(record.checkInTime)) : '-'}
                          </TableCell>
                          <TableCell className="capitalize">
                            {record.location || 'office'}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(record.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditAttendance(record)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              {record.checkInImageUrl && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleViewImage(record)}
                                  title="View Field Work Photo"
                                >
                                  <Camera className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily Records Tab */}
        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Attendance Records - {formatDate(selectedDate)}</CardTitle>
              <CardDescription>
                Comprehensive view of all employee attendance for the selected date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Working Hours</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingDaily ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredDailyAttendance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                          No attendance records found for this date
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDailyAttendance.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{record.userName}</div>
                              <div className="text-xs text-gray-500">{record.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            {record.userDepartment || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {record.checkInTime ? formatTime(new Date(record.checkInTime)) : '-'}
                          </TableCell>
                          <TableCell>
                            {record.checkOutTime ? formatTime(new Date(record.checkOutTime)) : '-'}
                          </TableCell>
                          <TableCell>
                            {record.workingHours ? `${record.workingHours.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell>
                            {record.overtimeHours ? `${record.overtimeHours.toFixed(1)}h` : '-'}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(record.status)}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditAttendance(record)}
                                title="Edit Attendance"
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              {record.checkInImageUrl && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleViewImage(record)}
                                  title="View Field Work Photo"
                                >
                                  <Camera className="h-3 w-3" />
                                </Button>
                              )}
                              <Button 
                                size="sm" 
                                variant="outline"
                                title="View Details"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Corrections Tab */}
        <TabsContent value="corrections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance Corrections</CardTitle>
              <CardDescription>
                Review and approve attendance correction requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <p>No pending correction requests</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Image Viewer Modal */}
      <Dialog open={showImageModal} onOpenChange={handleCloseImageModal}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Field Work Attendance Photo
            </DialogTitle>
            <DialogDescription>
              {selectedImage && `Photo taken by ${selectedImage.employeeName} on ${selectedImage.date} at ${selectedImage.time}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Image Container */}
            <div className="flex-1 relative bg-gray-50 flex items-center justify-center overflow-hidden">
              {imageLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  <p className="text-sm text-gray-600">Loading image...</p>
                </div>
              ) : selectedImage ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img
                    src={selectedImage.url}
                    alt="Field work attendance photo"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg cursor-zoom-in"
                    onClick={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (img.style.transform === 'scale(2)') {
                        img.style.transform = 'scale(1)';
                        img.style.cursor = 'zoom-in';
                      } else {
                        img.style.transform = 'scale(2)';
                        img.style.cursor = 'zoom-out';
                      }
                    }}
                    style={{ transition: 'transform 0.3s ease' }}
                  />
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No image available</p>
                </div>
              )}
            </div>
            
            {/* Image Metadata */}
            {selectedImage && (
              <div className="p-6 border-t bg-white">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Employee</Label>
                    <p className="font-medium">{selectedImage.employeeName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Date & Time</Label>
                    <p className="font-medium">{selectedImage.date}</p>
                    <p className="text-gray-600">{selectedImage.time}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500 uppercase tracking-wide">Attendance Type</Label>
                    <Badge variant="outline" className="mt-1">
                      {selectedImage.attendanceType}
                    </Badge>
                  </div>
                  {selectedImage.customerName && (
                    <div>
                      <Label className="text-xs text-gray-500 uppercase tracking-wide">Customer</Label>
                      <p className="font-medium">{selectedImage.customerName}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <CheckCircle className="h-3 w-3" />
                    Verified attendance photo
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (selectedImage?.url) {
                          const link = document.createElement('a');
                          link.href = selectedImage.url;
                          link.download = `attendance-${selectedImage.employeeName}-${selectedImage.date}.jpg`;
                          link.click();
                        }
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCloseImageModal}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Attendance Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Attendance Record</DialogTitle>
            <DialogDescription>
              Modify attendance details for {editingAttendance?.userName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="checkInTime">Check In Time</Label>
                <Input
                  id="checkInTime"
                  type="time"
                  value={editForm.checkInTime}
                  onChange={(e) => setEditForm({ ...editForm, checkInTime: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="checkOutTime">Check Out Time</Label>
                <Input
                  id="checkOutTime"
                  type="time"
                  value={editForm.checkOutTime}
                  onChange={(e) => setEditForm({ ...editForm, checkOutTime: e.target.value })}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={editForm.status} onValueChange={(value) => setEditForm({ ...editForm, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="leave">Leave</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="overtimeHours">Overtime Hours</Label>
              <Input
                id="overtimeHours"
                type="number"
                step="0.5"
                min="0"
                value={editForm.overtimeHours}
                onChange={(e) => setEditForm({ ...editForm, overtimeHours: parseFloat(e.target.value) || 0 })}
              />
            </div>
            
            <div>
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                placeholder="Add remarks or notes..."
                value={editForm.remarks}
                onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateAttendanceMutation.isPending}
            >
              {updateAttendanceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}