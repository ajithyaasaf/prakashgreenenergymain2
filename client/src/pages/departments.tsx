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
import { Search, PlusCircle, Pencil, Trash2, UserCog, Users, Loader2 } from "lucide-react";

export default function Departments() {
  const { user } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDepartmentDialog, setShowAddDepartmentDialog] = useState(false);
  
  // Only master_admin can access this page
  if (user?.role !== "master_admin") {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="text-center">
            <UserCog className="h-10 w-10 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium">Access Denied</h3>
            <p className="text-sm text-gray-500 mt-2">
              You don't have permission to access this page. This area is restricted to master administrators.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Fetch departments
  const { data: departments, isLoading } = useQuery({
    queryKey: ["/api/departments"],
  });

  // Fetch users for employee count
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
  });

  // Filter departments by search query
  const filteredDepartments = departments?.filter((department: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      department.name.toLowerCase().includes(query) ||
      department.description?.toLowerCase().includes(query)
    );
  });

  // Count employees in each department
  const getEmployeeCount = (departmentName: string) => {
    return users?.filter((user: any) => user.department === departmentName.toLowerCase().replace(/ /g, '_')).length || 0;
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
          <div>
            <CardTitle className="text-xl">Departments</CardTitle>
            <CardDescription>Manage company departments</CardDescription>
          </div>
          <Button 
            className="bg-primary hover:bg-primary-dark text-white"
            onClick={() => setShowAddDepartmentDialog(true)}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Department
          </Button>
        </CardHeader>
        
        <CardContent className="px-6">
          <div className="mb-4 flex items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search departments"
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
                  <TableHead>Department Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Created On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredDepartments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      {searchQuery ? "No departments match your search" : "No departments found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDepartments?.map((department: any) => (
                    <TableRow key={department.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                            <Users className="h-5 w-5" />
                          </div>
                          <div className="ml-3 font-medium">{department.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>{department.description || "-"}</TableCell>
                      <TableCell>{getEmployeeCount(department.name)}</TableCell>
                      <TableCell>{formatDate(department.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
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

      {/* Add Department Dialog */}
      <Dialog open={showAddDepartmentDialog} onOpenChange={setShowAddDepartmentDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
            <DialogDescription>
              Create a new department in the organization.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>Department form will be implemented here.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
