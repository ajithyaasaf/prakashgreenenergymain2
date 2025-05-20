import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuthContext } from '@/contexts/auth-context';
import { usePermissions } from '@/hooks/use-permissions';
import { format, subDays, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Download, Calendar, Clock, UserCheck, MapPin, InfoIcon } from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend 
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import * as XLSX from 'xlsx';

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface AttendanceRecord {
  id: number;
  userId: number;
  userName: string;
  date: string;
  checkInTime: string;
  checkOutTime: string | null;
  location: string;
  reason: string | null;
  status: string;
  overtimeHours: number;
}

// Date presets for quick selection
const datePresets = {
  today: {
    from: new Date(),
    to: new Date()
  },
  yesterday: {
    from: subDays(new Date(), 1),
    to: subDays(new Date(), 1)
  },
  thisWeek: {
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfWeek(new Date(), { weekStartsOn: 1 })
  },
  thisMonth: {
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  },
  lastMonth: {
    from: startOfMonth(subDays(new Date(), 30)),
    to: endOfMonth(subDays(new Date(), 30))
  }
};

export function AttendanceReport() {
  const { toast } = useToast();
  const { user } = useAuthContext();
  const { hasPermission } = usePermissions();
  const [dateRange, setDateRange] = useState(datePresets.thisWeek);
  const [selectedDatePreset, setSelectedDatePreset] = useState('thisWeek');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [view, setView] = useState<'list' | 'chart'>('list');
  
  // Fetch all users for filter dropdown
  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['/api/users'],
    enabled: hasPermission('view_all_reports') || hasPermission('manage_attendance')
  });
  
  // Fetch attendance data
  const { data: attendanceData, isLoading: loadingAttendance } = useQuery({
    queryKey: [
      '/api/attendance/report', 
      {
        from: format(dateRange.from, 'yyyy-MM-dd'),
        to: format(dateRange.to, 'yyyy-MM-dd'),
        userId: selectedUserId || undefined
      }
    ],
    refetchOnWindowFocus: false,
  });
  
  // Handle date preset selection
  const handleDatePresetChange = (preset: string) => {
    setSelectedDatePreset(preset);
    setDateRange(datePresets[preset as keyof typeof datePresets]);
  };
  
  // Handle custom date range selection
  const handleDateRangeChange = (type: 'from' | 'to', date: Date) => {
    setSelectedDatePreset('custom');
    setDateRange(prev => ({
      ...prev,
      [type]: date
    }));
  };
  
  // Export to Excel function
  const exportToExcel = () => {
    if (!attendanceData || !attendanceData.length) {
      toast({
        title: "No data to export",
        description: "There is no attendance data available for export.",
        variant: "destructive",
      });
      return;
    }
    
    // Format data for export
    const exportData = attendanceData.map((record: AttendanceRecord) => ({
      'Employee': record.userName,
      'Date': format(new Date(record.date), 'dd/MM/yyyy'),
      'Check-In': record.checkInTime ? format(new Date(record.checkInTime), 'hh:mm a') : 'N/A',
      'Check-Out': record.checkOutTime ? format(new Date(record.checkOutTime), 'hh:mm a') : 'N/A',
      'Location': record.location === 'office' ? 'Office' : 'Field',
      'Status': record.status,
      'Overtime (hrs)': record.overtimeHours ? record.overtimeHours.toFixed(2) : '0',
      'Reason': record.reason || 'N/A'
    }));
    
    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');
    
    // Generate filename with date range
    const fromDate = format(dateRange.from, 'yyyy-MM-dd');
    const toDate = format(dateRange.to, 'yyyy-MM-dd');
    const fileName = `Attendance_Report_${fromDate}_to_${toDate}.xlsx`;
    
    // Save file
    XLSX.writeFile(wb, fileName);
    
    toast({
      title: "Export Successful",
      description: `Attendance report has been exported as ${fileName}`,
    });
  };
  
  // Prepare chart data
  const prepareChartData = () => {
    if (!attendanceData) return null;
    
    const labels: string[] = [];
    const checkInCounts: number[] = [];
    const overtimeHours: number[] = [];
    
    // Group by date
    const dateGroups = attendanceData.reduce((acc: Record<string, any[]>, record: AttendanceRecord) => {
      const dateStr = format(new Date(record.date), 'yyyy-MM-dd');
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(record);
      return acc;
    }, {});
    
    // Build data arrays
    Object.keys(dateGroups).sort().forEach(date => {
      labels.push(format(new Date(date), 'MMM dd'));
      checkInCounts.push(dateGroups[date].length);
      
      // Sum overtime hours for the day
      const dayOvertimeHours = dateGroups[date].reduce(
        (sum: number, record: AttendanceRecord) => sum + (record.overtimeHours || 0), 
        0
      );
      overtimeHours.push(Number(dayOvertimeHours.toFixed(2)));
    });
    
    return {
      labels,
      datasets: [
        {
          label: 'Attendance Count',
          data: checkInCounts,
          backgroundColor: '#a7ce3b',
          borderColor: '#8aaf22',
          borderWidth: 1,
        },
        {
          label: 'Overtime Hours',
          data: overtimeHours,
          backgroundColor: '#157fbe',
          borderColor: '#0d6eab',
          borderWidth: 1,
        },
      ],
    };
  };
  
  const chartData = prepareChartData();
  const chartOptions = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Attendance and Overtime Summary',
      },
    },
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-primary">Attendance Report</CardTitle>
        <CardDescription>
          View and export attendance data across your organization
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="w-full md:w-1/4">
            <Label htmlFor="date-preset">Date Range</Label>
            <Select
              value={selectedDatePreset}
              onValueChange={handleDatePresetChange}
            >
              <SelectTrigger id="date-preset">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="thisWeek">This Week</SelectItem>
                <SelectItem value="thisMonth">This Month</SelectItem>
                <SelectItem value="lastMonth">Last Month</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full md:w-1/4">
            <Label htmlFor="from-date">From Date</Label>
            <DatePicker
              date={dateRange.from}
              setDate={(date) => handleDateRangeChange('from', date)}
            />
          </div>
          
          <div className="w-full md:w-1/4">
            <Label htmlFor="to-date">To Date</Label>
            <DatePicker
              date={dateRange.to}
              setDate={(date) => handleDateRangeChange('to', date)}
            />
          </div>
          
          <div className="w-full md:w-1/4">
            <Label htmlFor="user-filter">Employee</Label>
            <Select
              value={selectedUserId}
              onValueChange={setSelectedUserId}
            >
              <SelectTrigger id="user-filter">
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Employees</SelectItem>
                {users && users.map((user: any) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'chart')} className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList>
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="chart">Chart View</TabsTrigger>
            </TabsList>
            
            <Button variant="outline" onClick={exportToExcel}>
              <Download className="h-4 w-4 mr-2" />
              Export to Excel
            </Button>
          </div>
          
          <TabsContent value="list" className="mt-0">
            {loadingAttendance ? (
              <div className="space-y-2">
                {Array(5).fill(null).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4 p-3 border rounded">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !attendanceData || attendanceData.length === 0 ? (
              <div className="text-center py-8">
                <InfoIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-lg font-medium">No attendance records found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Try changing your filters or select a different date range.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="px-4 py-3 text-left text-sm font-medium">Employee</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Check In</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Check Out</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Location</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Overtime</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map((record: AttendanceRecord) => (
                      <tr key={record.id} className="border-b hover:bg-muted/50">
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary text-white">
                                {record.userName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{record.userName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1 text-muted-foreground" />
                            {format(new Date(record.date), 'dd MMM yyyy')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-green-500" />
                            {record.checkInTime 
                              ? format(new Date(record.checkInTime), 'hh:mm a') 
                              : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 text-red-500" />
                            {record.checkOutTime 
                              ? format(new Date(record.checkOutTime), 'hh:mm a') 
                              : '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                            <Badge variant={record.location === 'office' ? 'outline' : 'secondary'}>
                              {record.location === 'office' ? 'Office' : 'Field'}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Badge 
                            variant={
                              record.status === 'completed' ? 'default' :
                              record.status === 'in_progress' ? 'secondary' : 'outline'
                            }
                          >
                            {record.status === 'completed' ? 'Completed' :
                             record.status === 'in_progress' ? 'In Progress' : 
                             record.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {record.overtimeHours > 0 ? (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                              {record.overtimeHours.toFixed(2)} hrs
                            </Badge>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm max-w-[200px] truncate">
                          {record.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="chart" className="mt-0">
            {loadingAttendance ? (
              <div className="w-full h-[400px] flex items-center justify-center">
                <Skeleton className="h-[350px] w-full" />
              </div>
            ) : !chartData || chartData.labels.length === 0 ? (
              <div className="text-center py-8">
                <InfoIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-2 text-lg font-medium">No data available for chart</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Try changing your filters or select a different date range.
                </p>
              </div>
            ) : (
              <div className="w-full h-[400px]">
                <Bar data={chartData} options={chartOptions} height={350} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex flex-col items-start border-t p-4">
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm">On Time Check-in</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-sm">Late Check-in</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-sm">Field Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary"></div>
            <span className="text-sm">Overtime</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          <UserCheck className="h-4 w-4 inline mr-1" />
          {attendanceData ? attendanceData.length : 0} records found for the selected period
        </p>
      </CardFooter>
    </Card>
  );
}