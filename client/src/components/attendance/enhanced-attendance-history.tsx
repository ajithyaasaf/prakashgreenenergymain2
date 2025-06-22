import { useState, useMemo, useEffect } from "react";
import { formatDate, formatTime, cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Search, Filter, Download, SortAsc, SortDesc, Calendar as CalendarIcon,
  Clock, Timer, MapPin, Zap, TrendingUp, ArrowLeft, ArrowRight,
  MoreHorizontal, Eye, FileSpreadsheet, BarChart3, Users
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userDepartment: string;
  checkInTime: string;
  checkOutTime?: string;
  workingHours?: number;
  overtimeHours?: number;
  status: 'present' | 'late' | 'absent' | 'early_departure';
  attendanceType: 'office' | 'remote' | 'field';
  location?: string;
  isWithinOfficeRadius?: boolean;
  distanceFromOffice?: number;
  date: string;
}

interface EnhancedAttendanceHistoryProps {
  attendanceRecords: AttendanceRecord[];
  isLoading: boolean;
  userRole?: string;
  showAllUsers?: boolean;
  onRefresh?: () => void;
}

type SortField = 'date' | 'checkInTime' | 'workingHours' | 'status' | 'userName';
type SortOrder = 'asc' | 'desc';

const ITEMS_PER_PAGE = 15;

export function EnhancedAttendanceHistory({ 
  attendanceRecords, 
  isLoading, 
  userRole = 'employee',
  showAllUsers = false,
  onRefresh
}: EnhancedAttendanceHistoryProps) {
  const queryClient = useQueryClient();
  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Auto-refresh and keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'r':
            e.preventDefault();
            onRefresh?.();
            break;
          case 'f':
            e.preventDefault();
            document.getElementById('attendance-search')?.focus();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [onRefresh]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (onRefresh && !isLoading) {
        queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [onRefresh, isLoading, queryClient]);

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    const variants = {
      present: { variant: "default" as const, className: "bg-green-100 text-green-800 border-green-200" },
      late: { variant: "secondary" as const, className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      absent: { variant: "destructive" as const, className: "bg-red-100 text-red-800 border-red-200" },
      early_departure: { variant: "outline" as const, className: "bg-orange-100 text-orange-800 border-orange-200" }
    };
    
    const config = variants[status as keyof typeof variants] || variants.absent;
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  // Get work type badge styling
  const getTypeBadge = (type: string) => {
    const variants = {
      office: { variant: "default" as const, className: "bg-blue-100 text-blue-800" },
      remote: { variant: "secondary" as const, className: "bg-purple-100 text-purple-800" },
      field: { variant: "outline" as const, className: "bg-green-100 text-green-800" }
    };
    
    const config = variants[type as keyof typeof variants] || variants.office;
    return (
      <Badge variant={config.variant} className={config.className}>
        {type.toUpperCase()}
      </Badge>
    );
  };

  // Filter and sort records
  const filteredAndSortedRecords = useMemo(() => {
    let filtered = attendanceRecords.filter(record => {
      // Search filter
      const searchMatch = searchQuery === "" || 
        (record.userName && record.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (record.userEmail && record.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (record.userDepartment && record.userDepartment.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (record.checkInTime && formatDate(record.checkInTime).toLowerCase().includes(searchQuery.toLowerCase()));

      // Status filter
      const statusMatch = statusFilter === "all" || record.status === statusFilter;

      // Type filter
      const typeMatch = typeFilter === "all" || record.attendanceType === typeFilter;

      // Date range filter
      const recordDate = record.checkInTime ? new Date(record.checkInTime) : new Date();
      const dateMatch = (!dateRange.from || recordDate >= dateRange.from) &&
                       (!dateRange.to || recordDate <= dateRange.to);

      return searchMatch && statusMatch && typeMatch && dateMatch;
    });

    // Sort records
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'date':
          aValue = a.checkInTime ? new Date(a.checkInTime) : new Date(0);
          bValue = b.checkInTime ? new Date(b.checkInTime) : new Date(0);
          break;
        case 'checkInTime':
          aValue = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
          bValue = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
          break;
        case 'workingHours':
          aValue = a.workingHours || 0;
          bValue = b.workingHours || 0;
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'userName':
          aValue = (a.userName || '').toLowerCase();
          bValue = (b.userName || '').toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [attendanceRecords, searchQuery, statusFilter, typeFilter, dateRange, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = filteredAndSortedRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const total = filteredAndSortedRecords.length;
    const present = filteredAndSortedRecords.filter(r => r.status === 'present').length;
    const late = filteredAndSortedRecords.filter(r => r.status === 'late').length;
    const absent = filteredAndSortedRecords.filter(r => r.status === 'absent').length;
    const totalHours = filteredAndSortedRecords.reduce((sum, r) => sum + (r.workingHours || 0), 0);
    const totalOvertime = filteredAndSortedRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);
    const avgHours = total > 0 ? totalHours / total : 0;

    return { total, present, late, absent, totalHours, totalOvertime, avgHours };
  }, [filteredAndSortedRecords]);

  // Export functionality
  const handleExport = (format: 'csv' | 'excel') => {
    if (filteredAndSortedRecords.length === 0) {
      return;
    }

    const headers = ['Date', 'Employee', 'Department', 'Check In', 'Check Out', 'Hours', 'Overtime', 'Status', 'Type', 'Location'];
    const csvData = filteredAndSortedRecords.map(record => [
      record.checkInTime ? formatDate(record.checkInTime) : '-',
      record.userName || 'Unknown',
      record.userDepartment || 'N/A',
      record.checkInTime ? formatTime(record.checkInTime) : '-',
      record.checkOutTime ? formatTime(record.checkOutTime) : 'Pending',
      record.workingHours ? record.workingHours.toFixed(1) : '-',
      record.overtimeHours ? record.overtimeHours.toFixed(1) : '0',
      record.status || 'unknown',
      record.attendanceType || 'office',
      record.isWithinOfficeRadius ? 'Office' : 
       (record.distanceFromOffice ? `${Math.round(record.distanceFromOffice)}m away` : 'Unknown')
    ]);

    // Escape CSV fields that contain commas
    const escapeCsvField = (field: string) => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [headers, ...csvData]
      .map(row => row.map(escapeCsvField).join(','))
      .join('\n');
      
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-history-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Mobile card view component
  const MobileCardView = ({ record }: { record: AttendanceRecord }) => (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="font-semibold text-sm">{record.userName || 'Unknown User'}</div>
            <div className="text-xs text-muted-foreground">{record.userEmail || 'No email'}</div>
            <div className="text-xs text-muted-foreground">{record.userDepartment || 'No department'}</div>
          </div>
          <div className="flex flex-col gap-1 items-end">
            {getStatusBadge(record.status || 'unknown')}
            {getTypeBadge(record.attendanceType || 'office')}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span>{record.checkInTime ? formatDate(record.checkInTime) : 'No date'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-green-600" />
            <span>{record.checkInTime ? formatTime(record.checkInTime) : 'Not checked in'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-red-600" />
            <span>{record.checkOutTime ? formatTime(record.checkOutTime) : 'Pending'}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span>{record.workingHours ? `${record.workingHours.toFixed(1)}h` : '0h'}</span>
          </div>
        </div>
        
        {record.overtimeHours && record.overtimeHours > 0 && (
          <div className="mt-3 p-2 bg-orange-50 rounded border border-orange-200">
            <div className="flex items-center gap-2 text-sm text-orange-700">
              <Zap className="h-4 w-4" />
              <span>Overtime: {record.overtimeHours.toFixed(1)}h</span>
            </div>
          </div>
        )}
        
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>
            {record.isWithinOfficeRadius ? 'Office Location' : 
             record.distanceFromOffice ? `${Math.round(record.distanceFromOffice)}m from office` : 'Location Unknown'}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Summary Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{summaryStats.total}</div>
            <div className="text-xs text-blue-700">Total Records</div>
          </div>
        </Card>
        <Card className="p-4 bg-green-50 border-green-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{summaryStats.present}</div>
            <div className="text-xs text-green-700">Present Days</div>
          </div>
        </Card>
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{summaryStats.late}</div>
            <div className="text-xs text-yellow-700">Late Arrivals</div>
          </div>
        </Card>
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{summaryStats.absent}</div>
            <div className="text-xs text-red-700">Absent Days</div>
          </div>
        </Card>
        <Card className="p-4 bg-purple-50 border-purple-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{summaryStats.totalHours.toFixed(1)}</div>
            <div className="text-xs text-purple-700">Total Hours</div>
          </div>
        </Card>
        <Card className="p-4 bg-orange-50 border-orange-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{summaryStats.totalOvertime.toFixed(1)}</div>
            <div className="text-xs text-orange-700">Overtime Hours</div>
          </div>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Attendance History
              {filteredAndSortedRecords.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {filteredAndSortedRecords.length} records
                </Badge>
              )}
            </CardTitle>
            
            <div className="flex flex-wrap items-center gap-2">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg lg:hidden">
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className="h-8 px-3"
                >
                  Table
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('cards')}
                  className="h-8 px-3"
                >
                  Cards
                </Button>
              </div>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport('csv')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export as CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="attendance-search"
                placeholder="Search by name, email, department, or date... (Ctrl+F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="early_departure">Early Departure</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Work Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="office">Office</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="field">Field Work</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Date Range Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full lg:w-auto justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateRange.from ? (
                    dateRange.to ? (
                      `${formatDate(dateRange.from)} - ${formatDate(dateRange.to)}`
                    ) : (
                      formatDate(dateRange.from)
                    )
                  ) : (
                    "Date Range"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range) => setDateRange(range || {})}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <LoadingSkeleton />
          ) : filteredAndSortedRecords.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">No Records Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all" || typeFilter !== "all" || dateRange.from
                  ? "No attendance records match your current filters. Try adjusting your search criteria."
                  : "No attendance records available for the selected period."}
              </p>
              {(searchQuery || statusFilter !== "all" || typeFilter !== "all" || dateRange.from) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setTypeFilter("all");
                    setDateRange({});
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              {viewMode === 'cards' && (
                <div className="lg:hidden">
                  {paginatedRecords.map((record) => (
                    <MobileCardView key={record.id} record={record} />
                  ))}
                </div>
              )}

              {/* Desktop Table View */}
              {viewMode === 'table' && (
                <div className="hidden lg:block">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          {showAllUsers && (
                            <TableHead>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSort('userName')}
                                className="font-semibold"
                              >
                                Employee
                                {sortField === 'userName' && (
                                  sortOrder === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <SortDesc className="ml-1 h-4 w-4" />
                                )}
                              </Button>
                            </TableHead>
                          )}
                          <TableHead>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('date')}
                              className="font-semibold"
                            >
                              Date
                              {sortField === 'date' && (
                                sortOrder === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <SortDesc className="ml-1 h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('checkInTime')}
                              className="font-semibold"
                            >
                              Check In
                              {sortField === 'checkInTime' && (
                                sortOrder === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <SortDesc className="ml-1 h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead>Check Out</TableHead>
                          <TableHead>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('workingHours')}
                              className="font-semibold"
                            >
                              Hours
                              {sortField === 'workingHours' && (
                                sortOrder === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <SortDesc className="ml-1 h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSort('status')}
                              className="font-semibold"
                            >
                              Status
                              {sortField === 'status' && (
                                sortOrder === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <SortDesc className="ml-1 h-4 w-4" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRecords.map((record, index) => (
                          <TableRow 
                            key={record.id} 
                            className={cn(
                              "hover:bg-gray-50 transition-colors",
                              index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                            )}
                          >
                            {showAllUsers && (
                              <TableCell>
                                <div>
                                  <div className="font-medium text-sm">{record.userName}</div>
                                  <div className="text-xs text-muted-foreground">{record.userEmail}</div>
                                  <Badge variant="outline" className="text-xs mt-1">{record.userDepartment}</Badge>
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">
                                  {record.checkInTime ? formatDate(record.checkInTime) : 'No date'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {record.checkInTime ? new Date(record.checkInTime).toLocaleDateString('en-US', { weekday: 'short' }) : '-'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4 text-green-600" />
                                <span className="font-mono text-sm">
                                  {record.checkInTime ? formatTime(record.checkInTime) : 'Not checked in'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Timer className="h-4 w-4 text-red-600" />
                                <span className="font-mono text-sm">
                                  {record.checkOutTime ? formatTime(record.checkOutTime) : (
                                    <span className="text-muted-foreground">Pending</span>
                                  )}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {record.workingHours && record.workingHours > 0 ? (
                                  <>
                                    <span className="font-semibold text-sm">{record.workingHours.toFixed(1)}h</span>
                                    {record.overtimeHours && record.overtimeHours > 0 && (
                                      <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                                        <Zap className="h-3 w-3 mr-1" />
                                        +{record.overtimeHours.toFixed(1)}h
                                      </Badge>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">0h</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getTypeBadge(record.attendanceType || 'office')}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(record.status || 'unknown')}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-24">
                                  {record.isWithinOfficeRadius ? 'Office' : 
                                   record.distanceFromOffice ? `${Math.round(record.distanceFromOffice)}m away` : 'Unknown'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>
                                    <Eye className="h-4 w-4 mr-2" />
                                    View Details
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedRecords.length)} of {filteredAndSortedRecords.length} records
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, currentPage - 2) + i;
                        if (pageNum > totalPages) return null;
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}