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
import { getInitials } from "@/lib/utils";
import { Search, PlusCircle, Pencil, UserCog, Loader2 } from "lucide-react";

export default function UserManagement() {
  const { user } = useAuthContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddUserDialog, setShowAddUserDialog] = useState(false);
  
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
  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      // This would normally fetch from the API
      // For now returning mock data
      await new Promise(resolve => setTimeout(resolve, 500));
      return [
        {
          id: 1,
          uid: "123",
          email: "rajesh@prakashgreens.com",
          displayName: "Rajesh Sharma",
          role: "master_admin",
          department: null,
          profileImageUrl: null,
          createdAt: "2023-01-15T08:30:00.000Z"
        },
        {
          id: 2,
          uid: "456",
          email: "priya@prakashgreens.com",
          displayName: "Priya Patel",
          role: "admin",
          department: "hr",
          profileImageUrl: null,
          createdAt: "2023-02-10T10:15:00.000Z"
        },
        {
          id: 3,
          uid: "789",
          email: "vikram@prakashgreens.com",
          displayName: "Vikram Kumar",
          role: "employee",
          department: "technical_team",
          profileImageUrl: null,
          createdAt: "2023-03-05T14:45:00.000Z"
        },
        {
          id: 4,
          uid: "101",
          email: "ananya@prakashgreens.com",
          displayName: "Ananya Singh",
          role: "employee",
          department: "sales_and_marketing",
          profileImageUrl: null,
          createdAt: "2023-03-20T09:30:00.000Z"
        }
      ];
    },
  });

  // Filter users by search query
  const filteredUsers = users?.filter((user: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.displayName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.department && user.department.toLowerCase().includes(query))
    );
  });

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

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
          <div>
            <CardTitle className="text-xl">User Management</CardTitle>
            <CardDescription>Manage user accounts and permissions</CardDescription>
          </div>
          <Button 
            className="bg-primary hover:bg-primary-dark text-white"
            onClick={() => setShowAddUserDialog(true)}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add User
          </Button>
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
                            {userData.profileImageUrl ? (
                              <img 
                                src={userData.profileImageUrl} 
                                alt={userData.displayName} 
                                className="h-10 w-10 rounded-full"
                              />
                            ) : (
                              <span>{getInitials(userData.displayName)}</span>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="font-medium">{userData.displayName}</div>
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
                          {userData.role.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {userData.department ? departmentNames[userData.department] || userData.department : "-"}
                      </TableCell>
                      <TableCell>{formatDate(userData.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-8 p-2">
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
            <p>User form will be implemented here.</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
