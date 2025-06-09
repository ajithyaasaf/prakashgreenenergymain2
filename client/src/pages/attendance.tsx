import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatTime } from "@/lib/utils";
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

  // Determine if user can check in/out
  const canCheckIn = !todayAttendance?.checkInTime;
  const canCheckOut = todayAttendance?.checkInTime && !todayAttendance?.checkOutTime;

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance Management</h1>
          <p className="text-muted-foreground">
            Track employee attendance with geolocation verification and overtime monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refreshAttendance} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Actions for Current User */}
      {user && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Today's Attendance
            </CardTitle>
            <CardDescription>
              {todayAttendance ? (
                <div className="flex items-center gap-4 text-sm">
                  {todayAttendance.checkInTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      In: {formatTime(todayAttendance.checkInTime)}
                    </span>
                  )}
                  {todayAttendance.checkOutTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Out: {formatTime(todayAttendance.checkOutTime)}
                    </span>
                  )}
                  {todayAttendance.overtimeHours && todayAttendance.overtimeHours > 0 && (
                    <span className="flex items-center gap-1 text-orange-600">
                      <Zap className="h-4 w-4" />
                      OT: {todayAttendance.overtimeHours.toFixed(1)}h
                    </span>
                  )}
                </div>
              ) : (
                "No attendance record for today"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {canCheckIn && (
                <Button onClick={() => setShowCheckInModal(true)} className="bg-green-600 hover:bg-green-700">
                  <UserCheck className="h-4 w-4 mr-2" />
                  Check In
                </Button>
              )}
              {canCheckOut && (
                <Button onClick={() => setShowCheckOutModal(true)} className="bg-red-600 hover:bg-red-700">
                  <Timer className="h-4 w-4 mr-2" />
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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Present</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absent</CardTitle>
            <Activity className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.late}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overtime</CardTitle>
            <Zap className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.overtime}</div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle>Attendance Records</CardTitle>
              <CardDescription>
                View and manage employee attendance for {formatDate(date)}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
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
                        {record.checkInTime ? formatTime(record.checkInTime) : '-'}
                      </TableCell>
                      <TableCell>
                        {record.checkOutTime ? formatTime(record.checkOutTime) : '-'}
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