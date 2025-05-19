import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { formatDate, formatTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CalendarIcon, Search, Loader2 } from "lucide-react";
import { CheckInModal } from "@/components/dashboard/check-in-modal";

export default function Attendance() {
  const { user } = useAuthContext();
  const [date, setDate] = useState<Date>(new Date());
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch attendance records for the selected date
  const { data: attendanceRecords, isLoading, refetch } = useQuery({
    queryKey: ["/api/attendance", { date: date.toISOString().split('T')[0] }],
    queryFn: async () => {
      // This would normally fetch from the API
      // For now returning mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      return [
        {
          id: 1,
          userId: 1,
          userName: "Rajesh Sharma",
          date: new Date().toISOString(),
          checkInTime: new Date().setHours(9, 32, 0, 0),
          checkOutTime: new Date().setHours(18, 45, 0, 0),
          location: "office",
          status: "present"
        },
        {
          id: 2,
          userId: 2,
          userName: "Priya Patel",
          date: new Date().toISOString(),
          checkInTime: new Date().setHours(9, 15, 0, 0),
          checkOutTime: null,
          location: "office",
          status: "present"
        },
        {
          id: 3,
          userId: 3,
          userName: "Vikram Kumar",
          date: new Date().toISOString(),
          checkInTime: null,
          checkOutTime: null,
          location: null,
          status: "leave"
        }
      ];
    },
  });

  // Filter attendance records by search query
  const filteredRecords = attendanceRecords?.filter((record: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return record.userName.toLowerCase().includes(query);
  });

  // Get today's attendance for current user
  const currentUserAttendance = attendanceRecords?.find((record: any) => 
    record.userId === user?.id
  );

  // Check if user can check in/out based on time
  const currentTime = new Date();
  const canCheckIn = currentTime.getHours() >= 9 && currentTime.getMinutes() >= 30 && !currentUserAttendance?.checkInTime;
  const canCheckOut = currentUserAttendance?.checkInTime && !currentUserAttendance?.checkOutTime;

  // Status badge styles
  const statusStyles = {
    present: "bg-green-100 text-green-800",
    leave: "bg-yellow-100 text-yellow-800",
    absent: "bg-red-100 text-red-800",
    late: "bg-orange-100 text-orange-800"
  };

  // Handle check in/out
  const handleCheckInOut = () => {
    setShowCheckInModal(true);
  };

  // Refresh data when date changes
  useEffect(() => {
    refetch();
  }, [date, refetch]);

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
          <div>
            <CardTitle className="text-xl">Attendance</CardTitle>
            <CardDescription>Track employee attendance</CardDescription>
          </div>
          
          <div className="flex space-x-2">
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
            
            <Button 
              onClick={handleCheckInOut}
              className="bg-primary hover:bg-primary-dark text-white"
              disabled={!canCheckIn && !canCheckOut}
            >
              {canCheckOut ? "Check Out" : "Check In"}
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="px-6">
          {/* Current day summary */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gray-50">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Present</p>
                  <p className="text-2xl font-bold">
                    {attendanceRecords?.filter(r => r.status === 'present').length || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <i className="ri-user-follow-line text-lg"></i>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-50">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">On Leave</p>
                  <p className="text-2xl font-bold">
                    {attendanceRecords?.filter(r => r.status === 'leave').length || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                  <i className="ri-calendar-check-line text-lg"></i>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-50">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Absent</p>
                  <p className="text-2xl font-bold">
                    {attendanceRecords?.filter(r => r.status === 'absent').length || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                  <i className="ri-user-unfollow-line text-lg"></i>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-50">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Late</p>
                  <p className="text-2xl font-bold">
                    {attendanceRecords?.filter(r => r.status === 'late').length || 0}
                  </p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                  <i className="ri-time-line text-lg"></i>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="mb-4 flex items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by employee name"
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRecords?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchQuery ? "No employees match your search" : "No attendance records found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords?.map((record: any) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.userName}
                      </TableCell>
                      <TableCell>
                        {record.checkInTime ? formatTime(new Date(record.checkInTime)) : "-"}
                      </TableCell>
                      <TableCell>
                        {record.checkOutTime ? formatTime(new Date(record.checkOutTime)) : "-"}
                      </TableCell>
                      <TableCell className="capitalize">
                        {record.location || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("font-medium capitalize", 
                          record.status in statusStyles 
                            ? statusStyles[record.status as keyof typeof statusStyles] 
                            : "bg-gray-100"
                        )}>
                          {record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {record.status === "leave" ? "Approved Leave" : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Check-in Modal */}
      <CheckInModal open={showCheckInModal} onOpenChange={setShowCheckInModal} />
    </>
  );
}
