import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, PlusCircle, Loader2, Calendar, X } from "lucide-react";

export default function Leave() {
  const { user } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [showApplyLeaveDialog, setShowApplyLeaveDialog] = useState(false);
  
  // Fetch leaves for current user
  const { data: leaves, isLoading } = useQuery({
    queryKey: ["/api/leaves", { userId: user?.id }],
    queryFn: async () => {
      // This would normally fetch from the API
      // For now returning mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      return [
        {
          id: 1,
          userId: 1,
          startDate: "2023-07-10T00:00:00.000Z",
          endDate: "2023-07-12T00:00:00.000Z",
          reason: "Personal reasons",
          status: "approved",
          approvalFlow: [
            { level: "Team Lead", status: "approved", date: "2023-07-05T10:30:00.000Z" },
            { level: "HR", status: "approved", date: "2023-07-06T14:20:00.000Z" },
            { level: "GM", status: "approved", date: "2023-07-07T09:45:00.000Z" }
          ]
        },
        {
          id: 2,
          userId: 1,
          startDate: "2023-08-21T00:00:00.000Z",
          endDate: "2023-08-21T00:00:00.000Z",
          reason: "Medical appointment",
          status: "pending",
          approvalFlow: [
            { level: "Team Lead", status: "pending", date: null },
            { level: "HR", status: "pending", date: null },
            { level: "GM", status: "pending", date: null }
          ]
        },
        {
          id: 3,
          userId: 1,
          startDate: "2023-09-05T00:00:00.000Z",
          endDate: "2023-09-06T00:00:00.000Z",
          reason: "Family function",
          status: "rejected",
          approvalFlow: [
            { level: "Team Lead", status: "approved", date: "2023-08-30T11:20:00.000Z" },
            { level: "HR", status: "rejected", date: "2023-08-31T16:15:00.000Z" },
            { level: "GM", status: "pending", date: null }
          ]
        }
      ];
    },
  });

  // Calculate total leave days
  const calculateLeaveDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  // Filter leaves by search query
  const filteredLeaves = leaves?.filter((leave: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      leave.reason.toLowerCase().includes(query) ||
      leave.status.toLowerCase().includes(query)
    );
  });

  // Status badge styles
  const statusStyles = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    escalated: "bg-purple-100 text-purple-800"
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
          <div>
            <CardTitle className="text-xl">Leave Management</CardTitle>
            <CardDescription>Apply and track your leave requests</CardDescription>
          </div>
          <Button 
            className="bg-primary hover:bg-primary-dark text-white"
            onClick={() => setShowApplyLeaveDialog(true)}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Apply Leave
          </Button>
        </CardHeader>
        
        <CardContent className="px-6">
          {/* Leave balance summary */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gray-50">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Annual Entitlement</p>
                  <p className="text-2xl font-bold">12 days</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Calendar className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-50">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Used</p>
                  <p className="text-2xl font-bold">3 days</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
                  <i className="ri-calendar-check-line text-lg"></i>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-50">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-bold">2 days</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                  <i className="ri-time-line text-lg"></i>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gray-50">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Balance</p>
                  <p className="text-2xl font-bold">7 days</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <i className="ri-calendar-line text-lg"></i>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="mb-4 flex items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by reason or status"
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
                  <TableHead>Date(s)</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Applied On</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
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
                ) : filteredLeaves?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchQuery ? "No leave requests match your search" : "No leave requests found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeaves?.map((leave: any) => (
                    <TableRow key={leave.id}>
                      <TableCell>
                        {formatDate(leave.startDate)} 
                        {leave.startDate !== leave.endDate && ` to ${formatDate(leave.endDate)}`}
                      </TableCell>
                      <TableCell>
                        {calculateLeaveDays(leave.startDate, leave.endDate)} day(s)
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {leave.reason}
                      </TableCell>
                      <TableCell>
                        {formatDate(leave.createdAt || "2023-07-01")}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("font-medium capitalize", 
                          leave.status in statusStyles 
                            ? statusStyles[leave.status as keyof typeof statusStyles] 
                            : "bg-gray-100"
                        )}>
                          {leave.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {leave.status === "pending" && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 p-0 text-red-500"
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Apply Leave Dialog */}
      <Dialog open={showApplyLeaveDialog} onOpenChange={setShowApplyLeaveDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>
              Submit a new leave request. Your current balance is 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>Leave application form will be implemented here.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
