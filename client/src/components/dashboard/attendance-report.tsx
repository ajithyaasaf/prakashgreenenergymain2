import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend, 
  ArcElement 
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { Loader2, Calendar as CalendarIcon, Download, FileSpreadsheet } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface AttendanceRecord {
  id: number;
  userId: number;
  userName: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  location: string | null;
  status: string;
  overtimeHours?: number;
}

interface AttendanceReportProps {
  userId?: number;
  showAllUsers?: boolean;
}

export function AttendanceReport({ userId, showAllUsers = false }: AttendanceReportProps) {
  const { user } = useAuthContext();
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ from: Date, to: Date }>(() => {
    const today = new Date();
    return { from: today, to: today };
  });

  // Update date range based on report type
  const updateDateRange = () => {
    if (reportType === "daily") {
      setDateRange({ from: selectedDate, to: selectedDate });
    } else if (reportType === "weekly") {
      setDateRange({
        from: startOfWeek(selectedWeek, { weekStartsOn: 0 }), // Sunday
        to: endOfWeek(selectedWeek, { weekStartsOn: 0 }), // Saturday
      });
    } else if (reportType === "monthly") {
      setDateRange({
        from: startOfMonth(selectedMonth),
        to: endOfMonth(selectedMonth),
      });
    }
  };

  // Update date range when report type or selected dates change
  useState(() => {
    updateDateRange();
  });

  // Format date range for display
  const formattedDateRange = `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`;

  // Fetch attendance records for the date range
  const { data: attendanceRecords, isLoading } = useQuery({
    queryKey: [
      '/api/attendance', 
      userId || user?.id,
      dateRange.from.toISOString().split('T')[0],
      dateRange.to.toISOString().split('T')[0],
    ],
    queryFn: async () => {
      const targetId = userId || user?.id;
      if (!targetId) return [];
      
      try {
        const fromDate = dateRange.from.toISOString().split('T')[0];
        const toDate = dateRange.to.toISOString().split('T')[0];
        let url = '/api/attendance/report';
        
        // If specific user report
        if (!showAllUsers) {
          url += `?userId=${targetId}&from=${fromDate}&to=${toDate}`;
        } else {
          // Admin report for all users
          url += `?from=${fromDate}&to=${toDate}`;
        }
        
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Failed to fetch attendance records');
        }
        
        return res.json();
      } catch (error) {
        console.error('Error fetching attendance records:', error);
        return [];
      }
    },
    enabled: !!userId || !!user?.id,
  });

  // Generate summary data for charts
  const generateSummaryData = () => {
    if (!attendanceRecords) return null;
    
    // Status counts
    const statusCount = {
      present: 0,
      absent: 0, 
      late: 0,
      leave: 0
    };
    
    // Overtime hours (for technical team)
    let totalOvertimeHours = 0;
    
    // Working hours by day
    const workingHoursByDay: Record<string, number> = {};
    
    // Process records
    attendanceRecords.forEach((record: AttendanceRecord) => {
      // Count statuses
      statusCount[record.status as keyof typeof statusCount] = (statusCount[record.status as keyof typeof statusCount] || 0) + 1;
      
      // Sum overtime hours
      if (record.overtimeHours) {
        totalOvertimeHours += record.overtimeHours;
      }
      
      // Calculate working hours if both check-in and check-out present
      if (record.checkInTime && record.checkOutTime) {
        const checkIn = new Date(record.checkInTime);
        const checkOut = new Date(record.checkOutTime);
        const hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        
        const dayStr = format(new Date(record.date), 'MMM dd');
        workingHoursByDay[dayStr] = (workingHoursByDay[dayStr] || 0) + hoursWorked;
      }
    });
    
    // Generate days for the selected range
    const daysInRange = eachDayOfInterval({
      start: dateRange.from,
      end: dateRange.to
    }).map(date => format(date, 'MMM dd'));
    
    // Ensure all days have values (even if zero)
    const workingHoursData = daysInRange.map(day => workingHoursByDay[day] || 0);
    
    return {
      statusCount,
      totalOvertimeHours,
      workingHoursByDay: {
        labels: daysInRange,
        data: workingHoursData
      }
    };
  };

  const summaryData = generateSummaryData();
  
  // Chart data for status distribution
  const statusChartData = {
    labels: ['Present', 'Absent', 'Late', 'Leave'],
    datasets: [
      {
        data: summaryData ? [
          summaryData.statusCount.present, 
          summaryData.statusCount.absent, 
          summaryData.statusCount.late, 
          summaryData.statusCount.leave
        ] : [0, 0, 0, 0],
        backgroundColor: [
          'rgba(75, 192, 192, 0.6)',
          'rgba(255, 99, 132, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(255, 205, 86, 0.6)',
        ],
        borderColor: [
          'rgb(75, 192, 192)',
          'rgb(255, 99, 132)',
          'rgb(255, 159, 64)',
          'rgb(255, 205, 86)',
        ],
        borderWidth: 1,
      },
    ],
  };
  
  // Chart data for working hours
  const workingHoursChartData = {
    labels: summaryData?.workingHoursByDay.labels || [],
    datasets: [
      {
        label: 'Working Hours',
        data: summaryData?.workingHoursByDay.data || [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1,
      },
    ],
  };

  // Export data as Excel
  const exportToExcel = () => {
    if (!attendanceRecords || attendanceRecords.length === 0) {
      return;
    }
    
    // In a real application, we would use a library like xlsx
    // For now, we'll create a CSV file
    const headers = ['Name', 'Date', 'Check In', 'Check Out', 'Location', 'Status', 'Overtime Hours'];
    
    const csvRows = [
      headers.join(','),
      ...attendanceRecords.map((record: AttendanceRecord) => {
        const checkIn = record.checkInTime ? formatTime(new Date(record.checkInTime)) : '-';
        const checkOut = record.checkOutTime ? formatTime(new Date(record.checkOutTime)) : '-';
        const date = formatDate(new Date(record.date));
        
        return [
          record.userName,
          date,
          checkIn,
          checkOut,
          record.location || '-',
          record.status,
          record.overtimeHours ? record.overtimeHours.toFixed(2) : '0.00'
        ].join(',');
      })
    ];
    
    const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    
    // Create download link
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_report_${reportType}_${format(dateRange.from, 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between px-6">
        <CardTitle className="text-lg">Attendance Report</CardTitle>
        <div className="flex items-center space-x-2">
          <Select
            value={reportType}
            onValueChange={(value) => setReportType(value as "daily" | "weekly" | "monthly")}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          
          {reportType === "daily" && (
            <div className="relative">
              <Button
                variant="outline"
                className="w-[240px] pl-3 text-left font-normal flex justify-between items-center"
                onClick={() => {
                  const calendarEl = document.getElementById('date-picker');
                  if (calendarEl) {
                    calendarEl.style.display = calendarEl.style.display === 'none' ? 'block' : 'none';
                  }
                }}
              >
                {formatDate(selectedDate)}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
              <div id="date-picker" className="absolute top-full mt-2 right-0 z-50 bg-white border shadow-lg rounded-md p-2" style={{ display: 'none' }}>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(date);
                      setDateRange({ from: date, to: date });
                      document.getElementById('date-picker')!.style.display = 'none';
                    }
                  }}
                />
              </div>
            </div>
          )}
          
          {reportType === "weekly" && (
            <div className="relative">
              <Button
                variant="outline"
                className="w-[240px] pl-3 text-left font-normal flex justify-between items-center"
                onClick={() => {
                  const calendarEl = document.getElementById('week-picker');
                  if (calendarEl) {
                    calendarEl.style.display = calendarEl.style.display === 'none' ? 'block' : 'none';
                  }
                }}
              >
                Week of {format(startOfWeek(selectedWeek, { weekStartsOn: 0 }), 'MMM dd, yyyy')}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
              <div id="week-picker" className="absolute top-full mt-2 right-0 z-50 bg-white border shadow-lg rounded-md p-2" style={{ display: 'none' }}>
                <Calendar
                  mode="single"
                  selected={selectedWeek}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedWeek(date);
                      setDateRange({
                        from: startOfWeek(date, { weekStartsOn: 0 }),
                        to: endOfWeek(date, { weekStartsOn: 0 }),
                      });
                      document.getElementById('week-picker')!.style.display = 'none';
                    }
                  }}
                />
              </div>
            </div>
          )}
          
          {reportType === "monthly" && (
            <div className="relative">
              <Button
                variant="outline"
                className="w-[240px] pl-3 text-left font-normal flex justify-between items-center"
                onClick={() => {
                  const calendarEl = document.getElementById('month-picker');
                  if (calendarEl) {
                    calendarEl.style.display = calendarEl.style.display === 'none' ? 'block' : 'none';
                  }
                }}
              >
                {format(selectedMonth, 'MMMM yyyy')}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
              <div id="month-picker" className="absolute top-full mt-2 right-0 z-50 bg-white border shadow-lg rounded-md p-2" style={{ display: 'none' }}>
                <Calendar
                  mode="single"
                  selected={selectedMonth}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedMonth(date);
                      setDateRange({
                        from: startOfMonth(date),
                        to: endOfMonth(date),
                      });
                      document.getElementById('month-picker')!.style.display = 'none';
                    }
                  }}
                />
              </div>
            </div>
          )}
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={exportToExcel}
            disabled={!attendanceRecords || attendanceRecords.length === 0}
          >
            <FileSpreadsheet className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-500">Date Range</h3>
            <p className="text-lg font-medium">{formattedDateRange}</p>
          </div>
          {summaryData && (
            <div className="text-right">
              <h3 className="text-sm font-medium text-gray-500">Total Overtime Hours</h3>
              <p className="text-lg font-medium">{summaryData.totalOvertimeHours.toFixed(2)} hours</p>
            </div>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !attendanceRecords || attendanceRecords.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No attendance records found for the selected period.
          </div>
        ) : (
          <>
            <Tabs defaultValue="table" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="table">Table View</TabsTrigger>
                <TabsTrigger value="charts">Charts</TabsTrigger>
              </TabsList>
              
              <TabsContent value="table">
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {showAllUsers && <TableHead>Employee</TableHead>}
                        <TableHead>Date</TableHead>
                        <TableHead>Check In</TableHead>
                        <TableHead>Check Out</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Hours Worked</TableHead>
                        {showAllUsers && user?.department === 'technical_team' && (
                          <TableHead>Overtime Hours</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.map((record: AttendanceRecord) => {
                        // Calculate hours worked
                        let hoursWorked = 0;
                        if (record.checkInTime && record.checkOutTime) {
                          const checkIn = new Date(record.checkInTime);
                          const checkOut = new Date(record.checkOutTime);
                          hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
                        }
                        
                        return (
                          <TableRow key={record.id}>
                            {showAllUsers && <TableCell>{record.userName}</TableCell>}
                            <TableCell>{formatDate(new Date(record.date))}</TableCell>
                            <TableCell>
                              {record.checkInTime 
                                ? formatTime(new Date(record.checkInTime))
                                : "-"}
                            </TableCell>
                            <TableCell>
                              {record.checkOutTime 
                                ? formatTime(new Date(record.checkOutTime))
                                : "-"}
                            </TableCell>
                            <TableCell className="capitalize">
                              {record.location || "-"}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                ${record.status === 'present' ? 'bg-green-100 text-green-800' : ''}
                                ${record.status === 'absent' ? 'bg-red-100 text-red-800' : ''}
                                ${record.status === 'late' ? 'bg-orange-100 text-orange-800' : ''}
                                ${record.status === 'leave' ? 'bg-yellow-100 text-yellow-800' : ''}
                              `}>
                                {record.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              {hoursWorked > 0 ? hoursWorked.toFixed(2) : "-"}
                            </TableCell>
                            {showAllUsers && user?.department === 'technical_team' && (
                              <TableCell>
                                {record.overtimeHours ? record.overtimeHours.toFixed(2) : "-"}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              
              <TabsContent value="charts">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Attendance Status Distribution</h3>
                    <div className="h-64">
                      <Pie 
                        data={statusChartData} 
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'bottom',
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-4">Working Hours by Day</h3>
                    <div className="h-64">
                      <Bar 
                        data={workingHoursChartData} 
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: {
                                display: true,
                                text: 'Hours',
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="mt-4 text-right">
              <Button 
                onClick={exportToExcel}
                className="flex items-center"
                disabled={!attendanceRecords || attendanceRecords.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}