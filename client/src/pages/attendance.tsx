import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { TimeDisplay } from "@/components/time/time-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { 
  CalendarIcon, Search, Loader2, UserCheck, Clock, 
  MapPin, Timer, Users, TrendingUp, Activity, RefreshCw, Zap
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { EnterpriseAttendanceCheckIn } from "@/components/attendance/enterprise-attendance-check-in";
import { AttendanceCheckOut } from "@/components/attendance/attendance-check-out";

export default function Attendance() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [date, setDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("today");
  
  // Check-in/out modal states
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);

  // Fetch current user's attendance records
  const { data: attendanceRecords = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/attendance", { userId: user?.uid }],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      // For regular employees, fetch only their own attendance data
      // For admins/master_admins, they can still see all data if needed
      const attendanceResponse = await apiRequest(`/api/attendance?userId=${user.uid}`, 'GET');
      
      if (!attendanceResponse.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      
      const attendanceData = await attendanceResponse.json();
      
      // Enrich attendance records with user info (current user's info)
      return attendanceData.map((record: any) => ({
        ...record,
        userName: user.displayName || user.email?.split('@')[0] || "You",
        userDepartment: user.department,
        userEmail: user.email
      }));
    },
    enabled: !!user?.uid,
    refetchInterval: 30000, // Real-time updates every 30 seconds
  });

  // Fetch current user's attendance for today - Fixed timezone issue
  const { data: todayAttendance } = useQuery({
    queryKey: ["/api/attendance/today", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return null;
      // Use server-side date calculation to prevent timezone mismatches
      const response = await apiRequest(`/api/attendance/today?userId=${user.uid}`, 'GET');
      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) ? data[0] : data;
      }
      return null;
    },
    enabled: !!user?.uid,
  });

  // Fetch office locations
  const { data: officeLocations = [] } = useQuery({
    queryKey: ["/api/office-locations"],
    queryFn: async () => {
      const response = await apiRequest('/api/office-locations', 'GET');
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
  });

  // Ultra-fast department timing with intelligent caching
  const { data: departmentTiming, refetch: refetchTiming } = useQuery({
    queryKey: ["/api/departments/timing", user?.department],
    queryFn: async () => {
      if (!user?.department) return null;
      console.log('ATTENDANCE: Fast-fetching department timing for', user.department);
      const response = await apiRequest(`/api/departments/${user.department}/timing`, 'GET');
      if (response.ok) {
        const timing = await response.json();
        console.log('ATTENDANCE: Retrieved timing (cached):', timing);
        return timing;
      }
      return null;
    },
    enabled: !!user?.department,
    staleTime: 30000, // Smart caching - 30 seconds
    gcTime: 60000, // Garbage collect after 1 minute
    refetchInterval: 30000, // Reduced frequency - every 30 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  // Enhanced refresh functions with comprehensive invalidation
  const refreshAttendance = () => {
    console.log('ATTENDANCE: Refreshing all attendance data');
    // Invalidate all attendance-related queries
    queryClient.invalidateQueries({ 
      predicate: (query) => {
        const queryKey = query.queryKey[0];
        if (typeof queryKey === 'string') {
          return queryKey.includes('/api/attendance') || queryKey.includes('/api/departments/timing');
        }
        return false;
      }
    });
    
    // Force immediate refetch of critical data
    refetchTiming();
    refetch();
  };

  // Enhanced timing refresh with cache clearing
  const refreshTiming = () => {
    console.log('ATTENDANCE: Refreshing department timing');
    // Clear all timing-related cache
    queryClient.removeQueries({ 
      predicate: (query) => {
        const queryKey = query.queryKey[0];
        if (typeof queryKey === 'string') {
          return queryKey.includes('/api/departments/timing');
        }
        return false;
      }
    });
    
    // Force immediate refetch
    refetchTiming();
  };

  // Listen for storage events (cross-tab updates) and window focus
  useEffect(() => {
    const handleFocus = () => {
      console.log('ATTENDANCE: Window focused, refreshing timing');
      refreshTiming();
    };
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'department_timing_updated') {
        console.log('ATTENDANCE: Department timing updated in another tab');
        refreshTiming();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refetchTiming]);

  // Add visibility change listener for better real-time updates
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('ATTENDANCE: Page became visible, refreshing timing');
        refreshTiming();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Filter attendance records based on search query
  const filteredAttendance = attendanceRecords.filter((record: any) =>
    record.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    record.userDepartment?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get attendance statistics
  const getAttendanceStats = (records: any[]) => {
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const overtime = records.filter(r => r.overtimeHours && r.overtimeHours > 0).length;
    
    return { total, present, absent, late, overtime };
  };

  const stats = getAttendanceStats(attendanceRecords);

  // Enhanced attendance state logic with clear UX states
  const getAttendanceState = () => {
    if (!departmentTiming) return { state: 'no_timing', canCheckIn: false, canCheckOut: false };
    if (!todayAttendance) return { state: 'not_started', canCheckIn: true, canCheckOut: false };
    if (todayAttendance.checkInTime && !todayAttendance.checkOutTime) return { state: 'checked_in', canCheckIn: false, canCheckOut: true };
    if (todayAttendance.checkInTime && todayAttendance.checkOutTime) return { state: 'completed', canCheckIn: false, canCheckOut: false };
    return { state: 'unknown', canCheckIn: false, canCheckOut: false };
  };

  const attendanceState = getAttendanceState();
  const canCheckIn = attendanceState.canCheckIn;
  const canCheckOut = attendanceState.canCheckOut;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <span>Dashboard</span>
        <span>/</span>
        <span className="font-medium text-foreground">Attendance</span>
      </div>

      {/* Header Section with Clear Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Attendance</h1>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-muted-foreground">Track your daily attendance and work hours</p>
            <Badge 
              variant={
                attendanceState.state === 'completed' ? "default" : 
                attendanceState.state === 'checked_in' ? "secondary" : 
                attendanceState.state === 'not_started' ? "outline" : "destructive"
              } 
              className="text-xs"
            >
              {
                attendanceState.state === 'completed' ? "Day Complete" :
                attendanceState.state === 'checked_in' ? "Currently Working" :
                attendanceState.state === 'not_started' ? "Ready to Start" :
                attendanceState.state === 'no_timing' ? "Timing Not Set" : "Unknown State"
              }
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshAttendance} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Today's Status Card - Primary Action Area */}
      {user && (
        <Card className="border-2 border-primary/20 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Today's Attendance
                <span className="text-sm font-normal text-muted-foreground">
                  ({new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })})
                </span>
              </CardTitle>
              {departmentTiming && (
                <div className="text-xs text-muted-foreground">
                  Office: <TimeDisplay time={departmentTiming.checkInTime} format12Hour={true} /> - <TimeDisplay time={departmentTiming.checkOutTime} format12Hour={true} />
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Status Display */}
            {todayAttendance ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                  <div className="p-2 bg-green-100 rounded-full">
                    <Clock className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Check In</p>
                    <p className="font-semibold"><TimeDisplay time={todayAttendance.checkInTime} format12Hour={true} /></p>
                    <p className="text-xs text-muted-foreground">{todayAttendance.attendanceType || 'Office'}</p>
                  </div>
                </div>
                
                {todayAttendance.checkOutTime ? (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                    <div className="p-2 bg-red-100 rounded-full">
                      <Timer className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Check Out</p>
                      <p className="font-semibold"><TimeDisplay time={todayAttendance.checkOutTime} format12Hour={true} /></p>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const checkIn = new Date(todayAttendance.checkInTime);
                          const checkOut = new Date(todayAttendance.checkOutTime);
                          const hours = Math.floor((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60));
                          const minutes = Math.floor(((checkOut.getTime() - checkIn.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
                          return `${hours}h ${minutes}m worked`;
                        })()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-dashed">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <Timer className="h-4 w-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Check Out</p>
                      <p className="font-semibold text-gray-400">Pending</p>
                      <p className="text-xs text-muted-foreground">Still working</p>
                    </div>
                  </div>
                )}

                {todayAttendance.overtimeHours && todayAttendance.overtimeHours > 0 ? (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-orange-200">
                    <div className="p-2 bg-orange-100 rounded-full">
                      <Zap className="h-4 w-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Overtime</p>
                      <p className="font-semibold text-orange-600">{todayAttendance.overtimeHours.toFixed(1)}h</p>
                      <p className="text-xs text-muted-foreground">Extra hours</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-dashed">
                    <div className="p-2 bg-gray-100 rounded-full">
                      <Zap className="h-4 w-4 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Overtime</p>
                      <p className="font-semibold text-gray-400">None</p>
                      <p className="text-xs text-muted-foreground">Regular hours</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No attendance recorded today</h3>
                <p className="text-sm text-muted-foreground mb-4">Start your workday by checking in</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              {!departmentTiming ? (
                <div className="flex-1 text-center py-4">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="text-orange-700 font-medium mb-2">Department Timing Not Configured</div>
                    <div className="text-sm text-orange-600 mb-3">
                      Your department's working hours must be configured before you can check in.
                    </div>
                    {user?.role === "master_admin" && (
                      <div className="space-y-2">
                        <div className="text-xs text-orange-500">
                          Go to Departments → Configure Attendance Timing for {user?.department} department
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={refreshTiming}
                          className="text-orange-600 border-orange-300 hover:bg-orange-50"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refresh Timing
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {canCheckIn && (
                    <Button 
                      onClick={() => setShowCheckInModal(true)} 
                      className="bg-green-600 hover:bg-green-700 flex-1 h-12"
                      size="lg"
                    >
                      <UserCheck className="h-5 w-5 mr-2" />
                      Check In Now
                    </Button>
                  )}
                  {canCheckOut && (
                    <Button 
                      onClick={() => setShowCheckOutModal(true)} 
                      className="bg-red-600 hover:bg-red-700 flex-1 h-12"
                      size="lg"
                    >
                      <Timer className="h-5 w-5 mr-2" />
                      Check Out
                    </Button>
                  )}
                  {!canCheckIn && !canCheckOut && todayAttendance && (
                    <Badge variant="secondary" className="py-2 px-4">
                      Attendance Complete for Today
                    </Badge>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department Timing Settings Display */}
      {departmentTiming && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-purple-600" />
                Department Timing Settings
                <Badge variant="outline" className="ml-2">{user?.department?.toUpperCase()}</Badge>
              </CardTitle>
              <CardDescription>Your department's configured working hours and policies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-white rounded-lg border">
                  <div className="text-sm text-muted-foreground mb-1">Check In Time</div>
                  <div className="text-lg font-semibold text-green-600"><TimeDisplay time={departmentTiming.checkInTime} format12Hour={true} /></div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border">
                  <div className="text-sm text-muted-foreground mb-1">Check Out Time</div>
                  <div className="text-lg font-semibold text-red-600"><TimeDisplay time={departmentTiming.checkOutTime} format12Hour={true} /></div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border">
                  <div className="text-sm text-muted-foreground mb-1">Working Hours</div>
                  <div className="text-lg font-semibold text-blue-600">{departmentTiming.workingHours}h</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg border">
                  <div className="text-sm text-muted-foreground mb-1">Overtime Threshold</div>
                  <div className="text-lg font-semibold text-orange-600">{departmentTiming.overtimeThresholdMinutes}m</div>
                </div>
              </div>
              {departmentTiming.isFlexibleTiming && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-700 font-medium">Flexible Timing Enabled</div>
                  <div className="text-xs text-blue-600">Your department allows flexible working hours</div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Overtime Explanation */}
          <OvertimeExplanationCard 
            departmentTiming={departmentTiming}
          />
        </div>
      )}

      {/* Weekly Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Weekly Summary
          </CardTitle>
          <CardDescription>Your attendance performance this week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-600">{stats.present}</div>
              <div className="text-xs text-green-700">Days Present</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-2xl font-bold text-orange-600">{stats.overtime}</div>
              <div className="text-xs text-orange-700">Overtime Days</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
              <div className="text-xs text-yellow-700">Late Arrivals</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="text-2xl font-bold text-blue-600">
                {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%
              </div>
              <div className="text-xs text-blue-700">Attendance Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance History with Improved Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold">Attendance History</h2>
            <p className="text-sm text-muted-foreground">Track your daily attendance records and patterns</p>
          </div>
          <TabsList className="grid w-full sm:w-auto grid-cols-3">
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <CardTitle className="text-lg">Today's Details</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search records..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-48"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredAttendance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No attendance records found for the selected date
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttendance.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.userName}</div>
                          <div className="text-sm text-muted-foreground">{record.userEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{record.userDepartment || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        {record.checkInTime ? <TimeDisplay time={record.checkInTime} format12Hour={true} /> : '-'}
                      </TableCell>
                      <TableCell>
                        {record.checkOutTime ? <TimeDisplay time={record.checkOutTime} format12Hour={true} /> : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {record.workingHours ? (
                            <>
                              <span>{record.workingHours.toFixed(1)}h</span>
                              {record.overtimeHours && record.overtimeHours > 0 && (
                                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                  <Zap className="h-3 w-3 mr-1" />
                                  +{record.overtimeHours.toFixed(1)}h OT
                                </Badge>
                              )}
                            </>
                          ) : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          record.attendanceType === 'office' ? 'default' :
                          record.attendanceType === 'remote' ? 'secondary' : 'outline'
                        }>
                          {record.attendanceType === 'office' ? 'Office' :
                           record.attendanceType === 'remote' ? 'Remote' : 'Field Work'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          record.status === 'present' ? 'default' :
                          record.status === 'late' ? 'secondary' : 'destructive'
                        }>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {record.isWithinOfficeRadius ? 'Office' : 
                           record.distanceFromOffice ? `${Math.round(record.distanceFromOffice)}m away` : 'Unknown'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="week" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">This Week's Records</CardTitle>
              <CardDescription>
                Showing attendance records for the current week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredAttendance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No attendance records found for this week
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAttendance.slice(0, 7).map((record: any) => (
                    <div key={record.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                          <span className="font-medium">{formatDate(record.checkInTime)}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(record.checkInTime).toLocaleDateString('en-US', { weekday: 'short' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-green-600" />
                          <span className="text-sm"><TimeDisplay time={record.checkInTime} format12Hour={true} /></span>
                          {record.checkOutTime && (
                            <>
                              <span className="text-muted-foreground">→</span>
                              <Timer className="h-4 w-4 text-red-600" />
                              <span className="text-sm"><TimeDisplay time={record.checkOutTime} format12Hour={true} /></span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={record.status === 'present' ? 'default' : record.status === 'late' ? 'secondary' : 'destructive'}>
                          {record.status}
                        </Badge>
                        {record.overtimeHours && record.overtimeHours > 0 && (
                          <Badge variant="outline" className="text-orange-600">
                            <Zap className="h-3 w-3 mr-1" />
                            {record.overtimeHours.toFixed(1)}h OT
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="month" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg">Monthly Overview</CardTitle>
                  <CardDescription>
                    Comprehensive view of your monthly attendance
                  </CardDescription>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formatDate(date)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(newDate) => newDate && setDate(newDate)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : filteredAttendance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No attendance records found for the selected month
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendance.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{formatDate(record.checkInTime)}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(record.checkInTime).toLocaleDateString('en-US', { weekday: 'short' })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {record.checkInTime ? <TimeDisplay time={record.checkInTime} format12Hour={true} /> : '-'}
                          </TableCell>
                          <TableCell>
                            {record.checkOutTime ? <TimeDisplay time={record.checkOutTime} format12Hour={true} /> : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {record.workingHours ? (
                                <>
                                  <span>{record.workingHours.toFixed(1)}h</span>
                                  {record.overtimeHours && record.overtimeHours > 0 && (
                                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                                      <Zap className="h-3 w-3 mr-1" />
                                      +{record.overtimeHours.toFixed(1)}h
                                    </Badge>
                                  )}
                                </>
                              ) : '-'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              record.attendanceType === 'office' ? 'default' :
                              record.attendanceType === 'remote' ? 'secondary' : 'outline'
                            }>
                              {record.attendanceType === 'office' ? 'Office' :
                               record.attendanceType === 'remote' ? 'Remote' : 'Field Work'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              record.status === 'present' ? 'default' :
                              record.status === 'late' ? 'secondary' : 'destructive'
                            }>
                              {record.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Check-in Modal */}
      <EnterpriseAttendanceCheckIn
        isOpen={showCheckInModal}
        onClose={() => setShowCheckInModal(false)}
        onSuccess={refreshAttendance}
        officeLocations={officeLocations}
      />

      {/* Check-out Modal */}
      <AttendanceCheckOut
        isOpen={showCheckOutModal}
        onClose={() => setShowCheckOutModal(false)}
        onSuccess={refreshAttendance}
        currentAttendance={todayAttendance}
        departmentTiming={departmentTiming}
      />
    </div>
  );
}