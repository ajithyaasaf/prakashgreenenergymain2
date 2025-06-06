import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { 
  CalendarIcon, Search, Loader2, UserCheck, Clock, 
  MapPin, Camera, Wifi, WifiOff, CheckCircle, XCircle, AlertTriangle,
  Timer, Users, TrendingUp, Activity, RefreshCw
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Attendance() {
  const { user } = useAuthContext();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [date, setDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("today");
  
  // Real-time tracking states
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentLocation, setCurrentLocation] = useState<GeolocationCoordinates | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Check-in/out modal states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");
  const [checkInType, setCheckInType] = useState<"office" | "remote" | "field">("office");
  const [customerName, setCustomerName] = useState("");
  const [otReason, setOtReason] = useState("");
  
  // Camera and photo states
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Real-time attendance tracking - refetch every 30 seconds
  const { data: attendanceRecords = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/attendance", { date: date.toISOString().split('T')[0] }],
    queryFn: async () => {
      const dateParam = date.toISOString().split('T')[0];
      const attendanceResponse = await apiRequest('GET', `/api/attendance?date=${dateParam}`);
      const attendanceData = await attendanceResponse.json();
      
      // Fetch user details for each attendance record
      const usersResponse = await apiRequest('GET', '/api/users');
      const users = await usersResponse.json();
      
      // Enrich attendance records with user names
      return attendanceData.map((record: any) => {
        const userDetails = users.find((u: any) => u.id === record.userId);
        return {
          ...record,
          userName: userDetails ? userDetails.displayName : `User #${record.userId}`,
          userDepartment: userDetails ? userDetails.department : null,
          userEmail: userDetails ? userDetails.email : null
        };
      });
    },
    refetchInterval: 30000, // Real-time updates every 30 seconds
  });

  // Fetch user's attendance summary for the current month
  const { data: attendanceSummary } = useQuery({
    queryKey: ["/api/attendance/summary", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const summaryResponse = await apiRequest('GET', `/api/attendance/summary?userId=${user.id}`);
      return await summaryResponse.json();
    },
    enabled: !!user?.id,
  });

  // Check-in mutation with GPS and photo verification
  const checkInMutation = useMutation({
    mutationFn: async (data: {
      location: GeolocationCoordinates;
      photo?: string;
      type: string;
      remarks?: string;
    }) => {
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.firebaseUser?.getIdToken()}`
        },
        body: JSON.stringify({
          userId: user?.id,
          latitude: data.location.latitude.toString(),
          longitude: data.location.longitude.toString(),
          attendanceType: data.type,
          imageUrl: data.photo,
          reason: data.remarks,
          customerName: data.customerName
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to check in');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      refetch();
      setShowCheckInModal(false);
      resetCheckInState();
      toast({
        title: "Check-in Successful",
        description: "Your attendance has been recorded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Check-in Failed",
        description: error.message || "Failed to record attendance",
        variant: "destructive",
      });
    },
  });

  // Check-out mutation
  const checkOutMutation = useMutation({
    mutationFn: async (data: {
      location: GeolocationCoordinates;
      photo?: string;
      remarks?: string;
      otReason?: string;
    }) => {
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({
          userId: user?.id,
          latitude: data.location.latitude.toString(),
          longitude: data.location.longitude.toString(),
          imageUrl: data.photo,
          reason: data.remarks,
          otReason: data.otReason
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to check out');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      refetch();
      setShowCheckOutModal(false);
      resetCheckInState();
      toast({
        title: "Check-out Successful",
        description: "Your work session has been recorded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Check-out Failed",
        description: error.message || "Failed to record check-out",
        variant: "destructive",
      });
    },
  });

  // Real-time location and network monitoring
  useEffect(() => {
    const handleOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);
    
    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOnlineStatus);
    };
  }, []);

  // Get current location with high accuracy
  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser");
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation(position.coords);
        setIsGettingLocation(false);
      },
      (error) => {
        setLocationError(error.message);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  // Camera functions for photo verification
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraActive(true);
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Could not access camera. Please allow camera permissions.",
        variant: "destructive",
      });
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedPhoto(photoData);
        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  };

  const resetCheckInState = () => {
    setCapturedPhoto(null);
    setRemarks("");
    setCheckInType("office");
    stopCamera();
  };

  // Filter attendance records by search query
  const filteredRecords = attendanceRecords?.filter((record: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return record.userName.toLowerCase().includes(query) ||
           record.userEmail?.toLowerCase().includes(query);
  });

  // Get today's attendance for current user
  const currentUserAttendance = attendanceRecords?.find((record: any) => 
    record.userId === user?.id
  );

  // Enhanced time-based check-in/out logic
  const currentTime = new Date();
  const currentHour = currentTime.getHours();
  
  // Allow check-in from 6 AM to 12 PM, check-out anytime after check-in
  const canCheckIn = !currentUserAttendance?.checkInTime && currentHour >= 6;
  const canCheckOut = currentUserAttendance?.checkInTime && !currentUserAttendance?.checkOutTime;
  
  // Calculate working hours
  const calculateWorkingHours = (checkIn: string, checkOut?: string) => {
    if (!checkOut) return 0;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  };

  // Handle check-in process
  const handleCheckIn = () => {
    if (!isOnline) {
      toast({
        title: "Network Error",
        description: "Please check your internet connection",
        variant: "destructive",
      });
      return;
    }
    getCurrentLocation();
    setShowCheckInModal(true);
  };

  // Handle check-out process
  const handleCheckOut = () => {
    if (!isOnline) {
      toast({
        title: "Network Error", 
        description: "Please check your internet connection",
        variant: "destructive",
      });
      return;
    }
    getCurrentLocation();
    setShowCheckOutModal(true);
  };

  // Process check-in with all verifications
  const processCheckIn = () => {
    if (!currentLocation) {
      toast({
        title: "Location Required",
        description: "Please allow location access to check in",
        variant: "destructive",
      });
      return;
    }

    checkInMutation.mutate({
      location: currentLocation,
      photo: capturedPhoto || undefined,
      type: checkInType,
      remarks: remarks
    });
  };

  // Process check-out with verifications
  const processCheckOut = () => {
    if (!currentLocation) {
      toast({
        title: "Location Required",
        description: "Please allow location access to check out",
        variant: "destructive",
      });
      return;
    }

    checkOutMutation.mutate({
      location: currentLocation,
      photo: capturedPhoto || undefined,
      remarks: remarks
    });
  };

  // Status badge styles
  const statusStyles = {
    present: "bg-green-100 text-green-800",
    leave: "bg-yellow-100 text-yellow-800",
    absent: "bg-red-100 text-red-800",
    late: "bg-orange-100 text-orange-800"
  };

  // Refresh data when date changes
  useEffect(() => {
    refetch();
  }, [date, refetch]);

  return (
    <div className="space-y-6">
      {/* Header with real-time status */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Attendance Tracking</h1>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <div className="flex items-center gap-1">
                  <Wifi className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Online</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <WifiOff className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-red-600">Offline</span>
                </div>
              )}
            </div>
            
            {currentLocation && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-600">Location: {currentLocation.accuracy.toFixed(0)}m accuracy</span>
              </div>
            )}
            
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-purple-600">Auto-refresh: 30s</span>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <Button
            onClick={() => refetch()}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          
          {canCheckIn && (
            <Button 
              onClick={handleCheckIn}
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={checkInMutation.isPending || !isOnline}
            >
              <UserCheck className="h-4 w-4 mr-2" />
              Check In
            </Button>
          )}
          
          {canCheckOut && (
            <Button 
              onClick={handleCheckOut}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={checkOutMutation.isPending || !isOnline}
            >
              <Timer className="h-4 w-4 mr-2" />
              Check Out
            </Button>
          )}
        </div>
      </div>

      {/* Current Status Card */}
      {currentUserAttendance && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-blue-900">Your Today's Attendance</h3>
                <div className="flex items-center gap-6 mt-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm">Check-in: {currentUserAttendance.checkInTime ? formatTime(new Date(currentUserAttendance.checkInTime)) : 'Not checked in'}</span>
                  </div>
                  {currentUserAttendance.checkOutTime && (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-sm">Check-out: {formatTime(new Date(currentUserAttendance.checkOutTime))}</span>
                    </div>
                  )}
                  {currentUserAttendance.checkInTime && currentUserAttendance.checkOutTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-blue-600" />
                      <span className="text-sm">Working hours: {calculateWorkingHours(currentUserAttendance.checkInTime, currentUserAttendance.checkOutTime).toFixed(1)}h</span>
                    </div>
                  )}
                </div>
              </div>
              <Badge className={cn("px-3 py-1", statusStyles[currentUserAttendance.status as keyof typeof statusStyles])}>
                {currentUserAttendance.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Summary Cards */}
      {attendanceSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">This Month</p>
                  <p className="text-2xl font-bold text-green-600">{attendanceSummary.presentDays}</p>
                  <p className="text-xs text-gray-500">Present Days</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Absent</p>
                  <p className="text-2xl font-bold text-red-600">{attendanceSummary.absentDays}</p>
                  <p className="text-xs text-gray-500">Days</p>
                </div>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Average Hours</p>
                  <p className="text-2xl font-bold text-blue-600">{attendanceSummary.averageHours}</p>
                  <p className="text-xs text-gray-500">Per Day</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Overtime</p>
                  <p className="text-2xl font-bold text-purple-600">{attendanceSummary.overtimeHours}</p>
                  <p className="text-xs text-gray-500">Hours</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="today" className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Today's Records
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              History
            </TabsTrigger>
            {hasPermission(['attendance.view_all', 'attendance.view_team']) && (
              <TabsTrigger value="team" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team View
              </TabsTrigger>
            )}
          </TabsList>
          
          <div className="flex space-x-2">
            {activeTab === 'history' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="border-gray-300">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {formatDate(date)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(date) => date && setDate(date)}
                    className="rounded-md border"
                  />
                </PopoverContent>
              </Popover>
            )}
            
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search employees..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Today's Records Tab */}
        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Attendance - {formatDate(new Date())}</CardTitle>
              <CardDescription>
                Real-time attendance tracking for all employees
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
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          No attendance records found for today
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{record.userName}</div>
                              <div className="text-xs text-gray-500">{record.userEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            {record.userDepartment?.replace('_', ' ') || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {record.checkInTime ? formatTime(new Date(record.checkInTime)) : '-'}
                          </TableCell>
                          <TableCell>
                            {record.checkOutTime ? formatTime(new Date(record.checkOutTime)) : '-'}
                          </TableCell>
                          <TableCell>
                            {record.checkInTime && record.checkOutTime 
                              ? `${calculateWorkingHours(record.checkInTime, record.checkOutTime).toFixed(1)}h`
                              : record.checkInTime 
                                ? 'In progress'
                                : '-'
                            }
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("font-medium", statusStyles[record.status as keyof typeof statusStyles])}>
                              {record.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">
                            {record.location || 'Office'}
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

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Attendance History - {formatDate(date)}</CardTitle>
              <CardDescription>
                Historical attendance records for the selected date
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredRecords.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          No attendance records found for {formatDate(date)}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRecords.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.userName}
                          </TableCell>
                          <TableCell className="capitalize">
                            {record.userDepartment?.replace('_', ' ') || 'N/A'}
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
                            <Badge className={cn("font-medium", statusStyles[record.status as keyof typeof statusStyles])}>
                              {record.status}
                            </Badge>
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

        {/* Team View Tab */}
        {hasPermission(['attendance.view_all', 'attendance.view_team']) && (
          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Team Attendance Overview</CardTitle>
                <CardDescription>
                  Monitor team attendance and productivity metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-4" />
                  <p>Team analytics and reports will be displayed here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Check-in Modal with GPS and Photo Verification */}
      <Dialog open={showCheckInModal} onOpenChange={setShowCheckInModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Check In</DialogTitle>
            <DialogDescription>
              Complete your check-in with location and photo verification
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Location Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Location Status</span>
              </div>
              <div className="flex items-center gap-2">
                {isGettingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : currentLocation ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">
                  {isGettingLocation ? "Getting location..." : 
                   currentLocation ? `Accurate to ${currentLocation.accuracy.toFixed(0)}m` :
                   locationError || "Location required"}
                </span>
              </div>
            </div>
            
            {!currentLocation && !isGettingLocation && (
              <Button 
                onClick={getCurrentLocation}
                variant="outline" 
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Get Current Location
              </Button>
            )}

            {/* Check-in Type */}
            <div>
              <Label htmlFor="checkInType">Check-in Type</Label>
              <Select value={checkInType} onValueChange={setCheckInType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select check-in type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="remote">Remote Work</SelectItem>
                  <SelectItem value="field">Field Work</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Photo Verification */}
            <div>
              <Label>Photo Verification (Optional)</Label>
              <div className="mt-2">
                {!capturedPhoto ? (
                  <div className="space-y-2">
                    {!isCameraActive ? (
                      <Button 
                        onClick={startCamera}
                        variant="outline" 
                        className="w-full"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photo
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <video 
                          ref={videoRef}
                          autoPlay 
                          playsInline
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <div className="flex gap-2">
                          <Button onClick={capturePhoto} className="flex-1">
                            <Camera className="h-4 w-4 mr-2" />
                            Capture
                          </Button>
                          <Button onClick={stopCamera} variant="outline">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <img 
                      src={capturedPhoto} 
                      alt="Captured" 
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button 
                      onClick={() => setCapturedPhoto(null)}
                      variant="outline"
                      size="sm"
                    >
                      Retake Photo
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Remarks */}
            <div>
              <Label htmlFor="remarks">Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                placeholder="Add any remarks about your check-in..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCheckInModal(false);
              resetCheckInState();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={processCheckIn}
              disabled={checkInMutation.isPending || !currentLocation}
              className="bg-green-600 hover:bg-green-700"
            >
              {checkInMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check In
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Check-out Modal */}
      <Dialog open={showCheckOutModal} onOpenChange={setShowCheckOutModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Check Out</DialogTitle>
            <DialogDescription>
              Complete your check-out and end your work session
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Working Hours Summary */}
            {currentUserAttendance?.checkInTime && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium">Today's Session</span>
                </div>
                <div className="text-sm space-y-1">
                  <div>Check-in: {formatTime(new Date(currentUserAttendance.checkInTime))}</div>
                  <div>Working hours: {calculateWorkingHours(currentUserAttendance.checkInTime, new Date().toISOString()).toFixed(1)}h</div>
                </div>
              </div>
            )}

            {/* Location Status */}
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Location Status</span>
              </div>
              <div className="flex items-center gap-2">
                {isGettingLocation ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : currentLocation ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">
                  {isGettingLocation ? "Getting location..." : 
                   currentLocation ? `Accurate to ${currentLocation.accuracy.toFixed(0)}m` :
                   locationError || "Location required"}
                </span>
              </div>
            </div>
            
            {!currentLocation && !isGettingLocation && (
              <Button 
                onClick={getCurrentLocation}
                variant="outline" 
                className="w-full"
              >
                <MapPin className="h-4 w-4 mr-2" />
                Get Current Location
              </Button>
            )}

            {/* Photo Verification */}
            <div>
              <Label>Photo Verification (Optional)</Label>
              <div className="mt-2">
                {!capturedPhoto ? (
                  <div className="space-y-2">
                    {!isCameraActive ? (
                      <Button 
                        onClick={startCamera}
                        variant="outline" 
                        className="w-full"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Take Photo
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <video 
                          ref={videoRef}
                          autoPlay 
                          playsInline
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <div className="flex gap-2">
                          <Button onClick={capturePhoto} className="flex-1">
                            <Camera className="h-4 w-4 mr-2" />
                            Capture
                          </Button>
                          <Button onClick={stopCamera} variant="outline">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <img 
                      src={capturedPhoto} 
                      alt="Captured" 
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button 
                      onClick={() => setCapturedPhoto(null)}
                      variant="outline"
                      size="sm"
                    >
                      Retake Photo
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Remarks */}
            <div>
              <Label htmlFor="checkoutRemarks">Remarks (Optional)</Label>
              <Textarea
                id="checkoutRemarks"
                placeholder="Add any remarks about your work session..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCheckOutModal(false);
              resetCheckInState();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={processCheckOut}
              disabled={checkOutMutation.isPending || !currentLocation}
              className="bg-red-600 hover:bg-red-700"
            >
              {checkOutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}