import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatTime, formatTimeString } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { 
  CalendarIcon, Search, Loader2, UserCheck, Clock, 
  MapPin, Timer, Users, TrendingUp, Activity, RefreshCw, Zap,
  ArrowUpDown, Filter, Download, ChevronLeft, ChevronRight,
  BarChart3, Target, AlertCircle
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { EnterpriseAttendanceCheckIn } from "@/components/attendance/enterprise-attendance-check-in";
import { AttendanceCheckOut } from "@/components/attendance/attendance-check-out";
import { OvertimeManagement } from "@/components/attendance/overtime-management";
import { EnhancedCheckout } from "@/components/attendance/enhanced-checkout";
import { AutoCheckoutStatus } from "@/components/attendance/auto-checkout-status";

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
  const [showEnhancedCheckOutModal, setShowEnhancedCheckOutModal] = useState(false);
  
  // Enhanced filtering and sorting states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const itemsPerPage = 10;

  // Fetch current user's attendance records
  const { data: attendanceRecords = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/attendance", { userId: user?.uid }],
    queryFn: async () => {
      if (!user?.uid) return [];
      
      // For regular employees, fetch only their own attendance data
      // For admins/master_admins, they can still see all data if needed
      const attendanceResponse = await apiRequest('GET', `/api/attendance?userId=${user.uid}`);
      
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

  // Fetch current user's attendance for today
  const { data: todayAttendance } = useQuery({
    queryKey: ["/api/attendance/today", user?.uid],
    queryFn: async () => {
      if (!user?.uid) return null;
      const today = new Date().toISOString().split('T')[0];
      const response = await apiRequest('GET', `/api/attendance?userId=${user.uid}&date=${today}`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    },
    enabled: !!user?.uid,
  });

  // Fetch office locations
  const { data: officeLocations = [] } = useQuery({
    queryKey: ["/api/office-locations"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/office-locations');
      if (response.ok) {
        return await response.json();
      }
      return [];
    },
  });

  // Fetch department timing for current user
  const { data: departmentTiming } = useQuery({
    queryKey: ["/api/departments/timing", user?.department],
    queryFn: async () => {
      if (!user?.department) return null;
      const response = await apiRequest('GET', `/api/departments/${user.department}/timing`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    },
    enabled: !!user?.department,
  });

  // Refresh attendance data
  const refreshAttendance = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
    queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
    refetch();
  };

  // Enhanced filtering and sorting logic
  const filteredAndSortedAttendance = attendanceRecords
    .filter((record: any) => {
      // Search filter
      const searchMatch = !searchQuery || 
        record.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.userDepartment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        formatDate(record.checkInTime).toLowerCase().includes(searchQuery.toLowerCase());
      
      // Status filter
      const statusMatch = statusFilter === 'all' || record.status === statusFilter;
      
      // Type filter
      const typeMatch = typeFilter === 'all' || record.attendanceType === typeFilter;
      
      return searchMatch && statusMatch && typeMatch;
    })
    .sort((a: any, b: any) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'date':
          compareValue = new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime();
          break;
        case 'hours':
          compareValue = (a.workingHours || 0) - (b.workingHours || 0);
          break;
        case 'status':
          compareValue = (a.status || '').localeCompare(b.status || '');
          break;
        case 'overtime':
          compareValue = (a.overtimeHours || 0) - (b.overtimeHours || 0);
          break;
        default:
          compareValue = 0;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedAttendance.length / itemsPerPage);
  const paginatedAttendance = filteredAndSortedAttendance.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Enhanced attendance statistics
  const getAttendanceStats = (records: any[]) => {
    const total = records.length;
    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const overtime = records.filter(r => r.overtimeHours && r.overtimeHours > 0).length;
    
    const totalHours = records.reduce((sum, r) => sum + (r.workingHours || 0), 0);
    const totalOvertimeHours = records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);
    const averageHours = total > 0 ? totalHours / total : 0;
    const attendanceRate = total > 0 ? (present / total) * 100 : 0;
    
    return { 
      total, present, absent, late, overtime, 
      totalHours, totalOvertimeHours, averageHours, attendanceRate 
    };
  };

  const stats = getAttendanceStats(attendanceRecords);
  const filteredStats = getAttendanceStats(filteredAndSortedAttendance);

  // Export functionality
  const handleExport = () => {
    const csvContent = [
      ['Date', 'Check In', 'Check Out', 'Hours', 'Overtime', 'Status', 'Type', 'Location'],
      ...filteredAndSortedAttendance.map((record: any) => [
        formatDate(record.checkInTime),
        record.checkInTime ? formatTime(record.checkInTime) : '-',
        record.checkOutTime ? formatTime(record.checkOutTime) : '-',
        record.workingHours ? `${record.workingHours.toFixed(1)}h` : '-',
        record.overtimeHours ? `${record.overtimeHours.toFixed(1)}h` : '-',
        record.status || '-',
        record.attendanceType || '-',
        record.isWithinOfficeRadius ? 'Office' : 'Remote'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Reset filters
  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
    setSortBy('date');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // Determine if user can check in/out
  const canCheckIn = !todayAttendance?.checkInTime;
  const canCheckOut = todayAttendance?.checkInTime && !todayAttendance?.checkOutTime;

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
            {todayAttendance && (
              <Badge variant={todayAttendance.checkOutTime ? "default" : "secondary"} className="text-xs">
                {todayAttendance.checkOutTime ? "Day Complete" : todayAttendance.checkInTime ? "Checked In" : "Not Started"}
              </Badge>
            )}
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
                  Office: {formatTimeString(departmentTiming.checkInTime)} - {formatTimeString(departmentTiming.checkOutTime)}
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
                    <p className="font-semibold">{formatTime(todayAttendance.checkInTime)}</p>
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
                      <p className="font-semibold">{formatTime(todayAttendance.checkOutTime)}</p>
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
                  onClick={() => setShowEnhancedCheckOutModal(true)} 
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
            </div>
          </CardContent>
        </Card>
      )}

      {/* Department Timing Settings Display */}
      {departmentTiming && (
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
                <div className="text-lg font-semibold text-green-600">{formatTimeString(departmentTiming.checkInTime)}</div>
              </div>
              <div className="text-center p-4 bg-white rounded-lg border">
                <div className="text-sm text-muted-foreground mb-1">Check Out Time</div>
                <div className="text-lg font-semibold text-red-600">{formatTimeString(departmentTiming.checkOutTime)}</div>
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
      )}

      {/* Auto-Checkout Status Section */}
      {todayAttendance && (
        <AutoCheckoutStatus 
          attendanceRecord={todayAttendance}
          departmentCheckoutTime={departmentTiming?.checkOutTime}
        />
      )}

      {/* Overtime Management Section */}
      {todayAttendance && (
        <OvertimeManagement 
          attendanceRecord={todayAttendance}
          onOvertimeRequested={refreshAttendance}
        />
      )}

      {/* Enhanced Statistics Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Attendance Overview
            </CardTitle>
            <CardDescription>Your attendance performance summary</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200 hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                <div className="text-xs text-green-700">Days Present</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats.attendanceRate.toFixed(1)}% rate
                </div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200 hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-orange-600">{stats.overtime}</div>
                <div className="text-xs text-orange-700">Overtime Days</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats.totalOvertimeHours.toFixed(1)}h total
                </div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200 hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
                <div className="text-xs text-yellow-700">Late Arrivals</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats.total > 0 ? ((stats.late / stats.total) * 100).toFixed(1) : 0}%
                </div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200 hover:shadow-md transition-shadow">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.averageHours.toFixed(1)}h
                </div>
                <div className="text-xs text-blue-700">Avg. Daily Hours</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stats.totalHours.toFixed(1)}h total
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Attendance Rate</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.min(stats.attendanceRate, 100)}%` }}
                  ></div>
                </div>
                <span className="text-sm font-semibold">{stats.attendanceRate.toFixed(1)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">On-time Rate</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${stats.total > 0 ? ((stats.present - stats.late) / stats.total) * 100 : 0}%` }}
                  ></div>
                </div>
                <span className="text-sm font-semibold">
                  {stats.total > 0 ? (((stats.present - stats.late) / stats.total) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">This Month</span>
                <span className="font-semibold">{stats.total} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Hours</span>
                <span className="font-semibold">{stats.totalHours.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Overtime</span>
                <span className="font-semibold text-orange-600">{stats.totalOvertimeHours.toFixed(1)}h</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Attendance History */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <CardTitle className="text-xl">Attendance History</CardTitle>
              <CardDescription>
                Track and analyze your attendance records with advanced filtering
                {filteredAndSortedAttendance.length !== attendanceRecords.length && (
                  <span className="text-blue-600 ml-1">
                    ({filteredAndSortedAttendance.length} of {attendanceRecords.length} records)
                  </span>
                )}
              </CardDescription>
            </div>
            
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-48"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="remote">Remote</SelectItem>
                  <SelectItem value="field">Field Work</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="overtime">Overtime</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
              
              <Button variant="outline" size="sm" onClick={resetFilters}>
                <Filter className="h-4 w-4 mr-1" />
                Reset
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
                <p className="text-sm text-muted-foreground">Loading attendance records...</p>
              </div>
            </div>
          ) : filteredAndSortedAttendance.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No records found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all' || typeFilter !== 'all' 
                  ? 'Try adjusting your filters or search terms'
                  : 'No attendance records available for the selected period'
                }
              </p>
              {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
                <Button variant="outline" onClick={resetFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="lg:hidden space-y-4">
                {paginatedAttendance.map((record: any) => (
                  <Card key={record.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-medium">{formatDate(record.checkInTime)}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(record.checkInTime).toLocaleDateString('en-US', { weekday: 'short' })}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={
                            record.status === 'present' ? 'default' :
                            record.status === 'late' ? 'secondary' : 'destructive'
                          }>
                            {record.status}
                          </Badge>
                          <Badge variant={
                            record.attendanceType === 'office' ? 'default' :
                            record.attendanceType === 'remote' ? 'secondary' : 'outline'
                          }>
                            {record.attendanceType === 'office' ? 'Office' :
                             record.attendanceType === 'remote' ? 'Remote' : 'Field'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Check In</div>
                          <div className="font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3 text-green-600" />
                            {record.checkInTime ? formatTime(record.checkInTime) : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Check Out</div>
                          <div className="font-medium flex items-center gap-1">
                            <Timer className="h-3 w-3 text-red-600" />
                            {record.checkOutTime ? formatTime(record.checkOutTime) : 'Pending'}
                          </div>
                        </div>
                      </div>
                      
                      <Separator className="my-3" />
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-muted-foreground">Hours:</span>
                          <span className="font-semibold">
                            {record.workingHours ? `${record.workingHours.toFixed(1)}h` : '-'}
                          </span>
                        </div>
                        {record.overtimeHours && record.overtimeHours > 0 && (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                            <Zap className="h-3 w-3 mr-1" />
                            +{record.overtimeHours.toFixed(1)}h OT
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden lg:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedAttendance.map((record: any) => (
                      <TableRow key={record.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{formatDate(record.checkInTime)}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(record.checkInTime).toLocaleDateString('en-US', { weekday: 'short' })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-green-600" />
                            {record.checkInTime ? formatTime(record.checkInTime) : '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Timer className="h-3 w-3 text-red-600" />
                            {record.checkOutTime ? formatTime(record.checkOutTime) : (
                              <span className="text-muted-foreground">Pending</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">
                              {record.workingHours ? `${record.workingHours.toFixed(1)}h` : '-'}
                            </span>
                            {record.overtimeHours && record.overtimeHours > 0 && (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                +{record.overtimeHours.toFixed(1)}h
                              </Badge>
                            )}
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
                          <Badge 
                            variant={
                              record.status === 'present' ? 'default' :
                              record.status === 'late' ? 'secondary' : 'destructive'
                            }
                            className={
                              record.status === 'present' ? 'bg-green-100 text-green-800 hover:bg-green-100' :
                              record.status === 'late' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' : 
                              'bg-red-100 text-red-800 hover:bg-red-100'
                            }
                          >
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedAttendance.length)} of {filteredAndSortedAttendance.length} records
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        );
                      })}
                      {totalPages > 5 && <span className="text-muted-foreground">...</span>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>

      </Card>

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

      {/* Enhanced Check-out Modal */}
      <EnhancedCheckout
        isOpen={showEnhancedCheckOutModal}
        onClose={() => setShowEnhancedCheckOutModal(false)}
        onSuccess={refreshAttendance}
        attendanceRecord={todayAttendance}
      />
    </div>
  );
}