import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { formatDate, cn } from "@/lib/utils";
import { syncFirestoreUsers } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";
import { Search, PlusCircle, Pencil, UserCog, Loader2, AlertTriangle, RefreshCw } from "lucide-react";

export default function UserManagement() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Only master_admin and admin can access this page
  if (user?.role !== "master_admin" && user?.role !== "admin") {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="text-center">
            <UserCog className="h-10 w-10 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium">Access Denied</h3>
            <p className="text-sm text-gray-500 mt-2">
              You don't have permission to access this page. This area is restricted to administrators.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Fetch users
  const { data: users = [], isLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["/api/users"],
  });

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ["/api/departments"],
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiRequest("PATCH", `/api/users/${userData.id}`, userData);
      if (!response.ok) {
        throw new Error("Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate users query to refetch
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      
      // Show success message
      toast({
        title: "User updated",
        description: "User details have been successfully updated.",
        variant: "success" as any,
      });
      
      // Close edit dialog
      setShowEditDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update user: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Enhanced function that cleans up placeholder data without requiring Firebase
  const handleSyncUsers = async () => {
    setIsSyncing(true);
    try {
      // Get current users from database
      const apiUsers = await queryClient.fetchQuery({ queryKey: ["/api/users"] });
      
      // Find users that need their information improved
      const usersToUpdate = (apiUsers as any[]).filter(user => 
        user.email?.includes('@example.com') || 
        !user.displayName || 
        user.displayName?.startsWith('user-')
      );
      
      if (usersToUpdate.length === 0) {
        toast({
          title: "No updates needed",
          description: "All users already have proper names and emails.",
          variant: "default"
        });
        setIsSyncing(false);
        return;
      }
      
      // Update each user with better display information
      for (const user of usersToUpdate) {
        // Extract a better name from the user ID or email
        let betterName = "User";
        
        // If email contains something usable (not example.com), use it
        if (user.email && !user.email.includes('@example.com')) {
          betterName = user.email.split('@')[0];
          // Capitalize first letter and replace dots/underscores with spaces
          betterName = betterName
            .replace(/\./g, ' ')
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        } else {
          // Use their UID to create a proper name
          betterName = `User ${user.id}`;
        }
        
        // Update the user record
        await updateUserMutation.mutateAsync({
          id: user.id,
          displayName: betterName,
          email: user.email,
          role: user.role,
          department: user.department
        });
      }
      
      // Refresh the data
      await refetchUsers();
      
      toast({
        title: "User data improved",
        description: `Updated ${usersToUpdate.length} users with better display names.`,
        variant: "success" as any,
      });
    } catch (error) {
      console.error("Error cleaning up user data:", error);
      toast({
        title: "Update failed",
        description: "There was a problem updating user display information.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter users by search query
  const filteredUsers = Array.isArray(users) ? users.filter((user: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.displayName?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      (user.department && user.department.toLowerCase().includes(query))
    );
  }) : [];

  // Role badge styles
  const roleStyles = {
    master_admin: "bg-purple-100 text-purple-800",
    admin: "bg-blue-100 text-blue-800",
    employee: "bg-green-100 text-green-800"
  };

  // Department display names
  const departmentNames: Record<string, string> = {
    cre: "Customer Relations",
    accounts: "Accounts",
    hr: "Human Resources",
    sales_and_marketing: "Sales & Marketing",
    technical_team: "Technical Team"
  };

  // Handle opening edit dialog
  const handleEditUser = (userData: any) => {
    setEditUser(userData);
    setShowEditDialog(true);
  };

  // Handle saving user changes
  const handleSaveUserChanges = () => {
    if (!editUser) return;
    
    updateUserMutation.mutate(editUser);
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
          <div>
            <CardTitle className="text-xl">User Management</CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline"
              onClick={handleSyncUsers}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Updating Users...' : 'Fix User Display Names'}
            </Button>
            <Button 
              className="bg-primary hover:bg-primary-dark text-white"
              onClick={() => setShowAddUserDialog(true)}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="px-6">
          <div className="mb-4 flex items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by name, email, or department"
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                ) : filteredUsers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchQuery ? "No users match your search" : "No users found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers?.map((userData: any) => (
                    <TableRow key={userData.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                            {userData.photoURL ? (
                              <img 
                                src={userData.photoURL} 
                                alt={userData.displayName} 
                                className="h-10 w-10 rounded-full"
                              />
                            ) : (
                              <span>{getInitials(userData.displayName || userData.email)}</span>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">{userData.displayName || 'No Name'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{userData.email}</TableCell>
                      <TableCell>
                        <Badge className={cn("font-medium capitalize", 
                          userData.role in roleStyles 
                            ? roleStyles[userData.role as keyof typeof roleStyles] 
                            : "bg-gray-100"
                        )}>
                          {userData.role?.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {userData.department ? departmentNames[userData.department] || userData.department : (
                          <div className="flex items-center text-amber-600">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            <span className="text-xs">Not assigned</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>{userData.createdAt ? formatDate(userData.createdAt) : 'Unknown'}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 p-2"
                          onClick={() => handleEditUser(userData)}
                        >
                          <Pencil className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Enter details to create a new user account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p>To add users, have them register through the registration page.</p>
            <p>After registration, you can edit their roles and departments here.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Modify user role and department assignment.
            </DialogDescription>
          </DialogHeader>
          
          {editUser && (
            <div className="py-4 space-y-4">
              <div className="space-y-1">
                <Label htmlFor="edit-name">Name</Label>
                <Input 
                  id="edit-name" 
                  value={editUser.displayName || ''} 
                  onChange={(e) => setEditUser({...editUser, displayName: e.target.value})}
                  placeholder="Enter user name"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="edit-email">Email</Label>
                <Input 
                  id="edit-email" 
                  value={editUser.email || ''} 
                  onChange={(e) => setEditUser({...editUser, email: e.target.value})}
                  placeholder="Enter email address"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editUser.role}
                  onValueChange={(value) => setEditUser({...editUser, role: value})}
                  disabled={user.role !== "master_admin" || editUser.role === "master_admin"}
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {(user.role === "master_admin" || editUser.role !== "master_admin") && (
                      <>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        {user.role === "master_admin" && (
                          <SelectItem value="master_admin">Master Admin</SelectItem>
                        )}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {user.role !== "master_admin" && editUser.role === "master_admin" && (
                  <p className="text-xs text-amber-600 mt-1">
                    Only master admins can change the role of other master admins.
                  </p>
                )}
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="edit-department">Department</Label>
                <Select
                  value={editUser.department || "none"}
                  onValueChange={(value) => setEditUser({...editUser, department: value === "none" ? null : value})}
                >
                  <SelectTrigger id="edit-department">
                    <SelectValue placeholder="Assign department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Department</SelectItem>
                    <SelectItem value="cre">Customer Relations</SelectItem>
                    <SelectItem value="accounts">Accounts</SelectItem>
                    <SelectItem value="hr">Human Resources</SelectItem>
                    <SelectItem value="sales_and_marketing">Sales & Marketing</SelectItem>
                    <SelectItem value="technical_team">Technical Team</SelectItem>
                  </SelectContent>
                </Select>
                {!editUser.department && (
                  <p className="text-xs text-amber-600 mt-1">
                    Employees without a department can only access the basic dashboard.
                  </p>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveUserChanges}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
