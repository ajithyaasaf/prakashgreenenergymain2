import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { apiRequest } from "@/lib/queryClient";
import { formatDate, cn } from "@/lib/utils";
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
import {
  Search,
  PlusCircle,
  Pencil,
  UserCog,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

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
              You don't have permission to access this page. This area is
              restricted to administrators.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fetch users - only if user has admin permissions
  const {
    data: users = [],
    isLoading,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await apiRequest("/api/users", "GET");
      return res.json();
    },
    enabled: user?.role === "master_admin" || user?.role === "admin",
  });

  // Fetch departments - only if user has admin permissions
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await apiRequest("/api/departments", "GET");
      return res.json();
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await apiRequest(`/api/users/${userData.id}`, "PATCH", {
        ...userData,
        userId: user?.id,
      });
      if (!response.ok) {
        throw new Error("Failed to update user");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey[0];
          if (typeof queryKey === 'string') {
            return queryKey.includes('/api/users') || queryKey.includes('users');
          }
          return false;
        }
      });
      toast({
        title: "User updated",
        description: "User details have been successfully updated.",
      });
      setShowEditDialog(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update user: ${(error as Error).message}`,
        variant: "destructive",
      });
    },
  });

  // Sync users with Firestore
  const handleSyncUsers = async () => {
    setIsSyncing(true);
    try {
      const apiUsers = await queryClient.fetchQuery({ queryKey: ["users"] });
      const usersToUpdate = apiUsers.filter(
        (user: any) =>
          user.email?.includes("@example.com") ||
          !user.displayName ||
          user.displayName?.startsWith("User ") ||
          user.displayName === "No Name",
      );

      if (usersToUpdate.length === 0) {
        toast({
          title: "No updates needed",
          description: "All users have proper names and emails.",
          variant: "default",
        });
        setIsSyncing(false);
        return;
      }

      for (const user of usersToUpdate) {
        const betterName =
          user.email && !user.email.includes("@example.com")
            ? user.email
                .split("@")[0]
                .replace(/\./g, " ")
                .replace(/_/g, " ")
                .split(" ")
                .map(
                  (word: string) =>
                    word.charAt(0).toUpperCase() + word.slice(1),
                )
                .join(" ")
            : `Employee ${user.id.slice(0, 8)}`;

        await updateUserMutation.mutateAsync({
          id: user.id,
          displayName: betterName,
          email: user.email.includes("@example.com")
            ? `${betterName.toLowerCase().replace(" ", ".")}@prakashgreens.com`
            : user.email,
          role: user.role || "employee",
          department: user.department || null,
        });
      }

      await refetchUsers();
      toast({
        title: "Users synced",
        description: `Updated ${usersToUpdate.length} users with proper display names and emails.`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error syncing users:", error);
      toast({
        title: "Sync failed",
        description: "Failed to sync user data.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter users by search query
  const filteredUsers = Array.isArray(users)
    ? users.filter((user: any) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          user.displayName?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          (user.department && user.department.toLowerCase().includes(query))
        );
      })
    : [];

  // Role badge styles
  const roleStyles = {
    master_admin: "bg-purple-100 text-purple-800",
    admin: "bg-blue-100 text-blue-800",
    employee: "bg-green-100 text-green-800",
  };

  // Department display names (updated for new organizational structure)
  const departmentNames: Record<string, string> = {
    operations: "Operations",
    admin: "Administration", 
    hr: "Human Resources",
    marketing: "Marketing",
    sales: "Sales",
    technical: "Technical",
    housekeeping: "Housekeeping",
  };

  // Designation display names (updated based on organizational chart)
  const designationNames: Record<string, string> = {
    ceo: "CEO",
    gm: "GM", 
    officer: "Officer",
    executive: "Executive",
    cre: "CRE",
    team_leader: "Team Leader",
    technician: "Technician",
    welder: "Welder",
    house_man: "House Man",
  };

  // Fetch designations for form dropdown
  const { data: designations = [] } = useQuery({
    queryKey: ["designations"],
    queryFn: async () => {
      const res = await apiRequest("/api/designations", "GET");
      return res.json();
    },
  });

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
            <CardDescription>
              Manage user accounts and permissions
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={handleSyncUsers}
              disabled={isSyncing}
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
              />
              {isSyncing ? "Syncing Users..." : "Sync User Data"}
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
                  <TableHead>Designation</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-gray-500"
                    >
                      {searchQuery
                        ? "No users match your search"
                        : "No users found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((userData: any) => (
                    <TableRow key={userData.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                            {userData.photoURL ? (
                              <img
                                src={userData.photoURL}
                                alt={userData.displayName || "User"}
                                className="h-10 w-10 rounded-full"
                              />
                            ) : (
                              <span>
                                {getInitials(
                                  userData.displayName ||
                                    userData.email ||
                                    "User",
                                )}
                              </span>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">
                              {userData.displayName || "No Name"}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{userData.email || "No Email"}</TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "font-medium capitalize",
                            userData.role in roleStyles
                              ? roleStyles[
                                  userData.role as keyof typeof roleStyles
                                ]
                              : "bg-gray-100",
                          )}
                        >
                          {userData.role?.replace("_", " ") || "Unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {userData.department ? (
                          departmentNames[userData.department] ||
                          userData.department
                        ) : (
                          <div className="flex items-center text-amber-600">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            <span className="text-xs">Not assigned</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {userData.designation ? (
                          designationNames[userData.designation] ||
                          userData.designation
                        ) : (
                          <div className="flex items-center text-amber-600">
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            <span className="text-xs">Not assigned</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {userData.createdAt
                          ? formatDate(new Date(userData.createdAt))
                          : "Unknown"}
                      </TableCell>
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
            <p>
              To add users, have them register through the registration page.
            </p>
            <p>
              After registration, you can edit their roles and departments here.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddUserDialog(false)}
            >
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
                  value={editUser.displayName || ""}
                  onChange={(e) =>
                    setEditUser({ ...editUser, displayName: e.target.value })
                  }
                  placeholder="Enter user name"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={editUser.email || ""}
                  onChange={(e) =>
                    setEditUser({ ...editUser, email: e.target.value })
                  }
                  placeholder="Enter email address"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={editUser.role || "employee"}
                  onValueChange={(value) =>
                    setEditUser({ ...editUser, role: value })
                  }
                  disabled={
                    user?.role !== "master_admin" ||
                    editUser.role === "master_admin"
                  }
                >
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {(user?.role === "master_admin" ||
                      editUser.role !== "master_admin") && (
                      <>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        {user?.role === "master_admin" && (
                          <SelectItem value="master_admin">
                            Master Admin
                          </SelectItem>
                        )}
                      </>
                    )}
                  </SelectContent>
                </Select>
                {user?.role !== "master_admin" &&
                  editUser.role === "master_admin" && (
                    <p className="text-xs text-amber-600 mt-1">
                      Only master admins can change the role of other master
                      admins.
                    </p>
                  )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-department">Department</Label>
                <Select
                  value={editUser.department || "none"}
                  onValueChange={(value) =>
                    setEditUser({
                      ...editUser,
                      department: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger id="edit-department">
                    <SelectValue placeholder="Assign department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Department</SelectItem>
                    {departments.map((dept: string) => (
                      <SelectItem key={dept} value={dept}>
                        {departmentNames[dept] || dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!editUser.department && (
                  <p className="text-xs text-amber-600 mt-1">
                    Employees without a department can only access the basic
                    dashboard.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-designation">Designation</Label>
                <Select
                  value={editUser.designation || "none"}
                  onValueChange={(value) =>
                    setEditUser({
                      ...editUser,
                      designation: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger id="edit-designation">
                    <SelectValue placeholder="Assign designation" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Designation</SelectItem>
                    {Object.entries(designationNames).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!editUser.designation && (
                  <p className="text-xs text-amber-600 mt-1">
                    Designation determines permission level within the department.
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
              {updateUserMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
