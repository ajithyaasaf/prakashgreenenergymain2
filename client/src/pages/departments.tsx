import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Search, PlusCircle, Pencil, Trash2, UserCog, Users, Loader2, Check } from "lucide-react";

export default function Departments() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDepartmentDialog, setShowAddDepartmentDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [currentDepartment, setCurrentDepartment] = useState<any>(null);
  const [formState, setFormState] = useState({
    name: "",
    description: ""
  });
  
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
  
  // Helper function to reset form state
  const resetForm = () => {
    setFormState({
      name: "",
      description: ""
    });
    setCurrentDepartment(null);
  };
  
  // Create department mutation
  const createDepartmentMutation = useMutation({
    mutationFn: (departmentData: { name: string; description: string }) => {
      return apiRequest('/api/departments', 'POST', departmentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Department created",
        description: "The department has been successfully created.",
        variant: "default"
      });
      setShowAddDepartmentDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create department",
        variant: "destructive"
      });
    }
  });
  
  // Update department mutation
  const updateDepartmentMutation = useMutation({
    mutationFn: (departmentData: { id: number; name: string; description: string }) => {
      const { id, ...data } = departmentData;
      return apiRequest(`/api/departments/${id}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Department updated",
        description: "The department has been successfully updated.",
        variant: "default"
      });
      setShowEditDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update department",
        variant: "destructive"
      });
    }
  });
  
  // Delete department mutation
  const deleteDepartmentMutation = useMutation({
    mutationFn: (id: number) => {
      return apiRequest(`/api/departments/${id}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({
        title: "Department deleted",
        description: "The department has been successfully deleted.",
        variant: "default"
      });
      setShowDeleteDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete department",
        variant: "destructive"
      });
    }
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
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => {
                              setCurrentDepartment(department);
                              setFormState({
                                name: department.name,
                                description: department.description || ""
                              });
                              setShowEditDialog(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => {
                              setCurrentDepartment(department);
                              setShowDeleteDialog(true);
                            }}
                          >
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

      {/* Add/Edit Department Dialog */}
      <Dialog 
        open={showAddDepartmentDialog || showEditDialog} 
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
            setShowAddDepartmentDialog(false);
            setShowEditDialog(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{showEditDialog ? 'Edit Department' : 'Add New Department'}</DialogTitle>
            <DialogDescription>
              {showEditDialog ? 'Update department information.' : 'Create a new department in the organization.'}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 py-4" onSubmit={(e) => {
            e.preventDefault();
            if (showEditDialog) {
              updateDepartmentMutation.mutate({ 
                id: currentDepartment.id, 
                name: formState.name, 
                description: formState.description 
              });
            } else {
              createDepartmentMutation.mutate(formState);
            }
          }}>
            <div className="grid gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">Department Name</label>
                <Input
                  id="name"
                  placeholder="Enter department name"
                  required
                  value={formState.name}
                  onChange={(e) => setFormState({...formState, name: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">Description</label>
                <Input
                  id="description"
                  placeholder="Brief description of the department"
                  value={formState.description}
                  onChange={(e) => setFormState({...formState, description: e.target.value})}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  if (showEditDialog) {
                    setShowEditDialog(false);
                  } else {
                    setShowAddDepartmentDialog(false);
                  }
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
              >
                {(createDepartmentMutation.isPending || updateDepartmentMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {showEditDialog ? 'Update Department' : 'Create Department'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the department
              {currentDepartment ? ` "${currentDepartment.name}"` : ''} and all related data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (currentDepartment) {
                  deleteDepartmentMutation.mutate(currentDepartment.id);
                }
              }}
              disabled={deleteDepartmentMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDepartmentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
