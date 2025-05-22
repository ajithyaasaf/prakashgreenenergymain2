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
  
  // Fetch leaves from Firestore
  const { data: leaves, isLoading } = useQuery({
    queryKey: ["/api/leaves"],
    queryFn: async () => {
      const response = await fetch('/api/leaves');
      if (!response.ok) {
        throw new Error('Failed to fetch leaves');
      }
      return response.json();
    }
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
      leave.reason?.toLowerCase().includes(query) ||
      leave.status?.toLowerCase().includes(query)
    );
  });

  // Status badge styles
  const statusStyles = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    escalated: "bg-purple-100 text-purple-800"
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading leave records...</span>
      </div>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
          <div>
            <CardTitle className="text-xl">Leave Management</CardTitle>
            <CardDescription>Manage your leave applications</CardDescription>
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
                  <TableHead>Leave Period</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Applied On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeaves?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchQuery ? "No leave records match your search" : "No leave records found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeaves?.map((leave: any) => (
                    <TableRow key={leave.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {calculateLeaveDays(leave.startDate, leave.endDate)} days
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={leave.reason}>
                          {leave.reason}
                        </div>
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
                      <TableCell>{formatDate(leave.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {leave.status === 'pending' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-destructive"
                            >
                              <X className="h-4 w-4" />
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

      {/* Apply Leave Dialog */}
      <Dialog open={showApplyLeaveDialog} onOpenChange={setShowApplyLeaveDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>
              Fill in the details to submit your leave application.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4">
            <p>Leave application form will be implemented here.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}