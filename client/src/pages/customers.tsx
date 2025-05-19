import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomerForm } from "@/components/customers/customer-form";
import { Loader2, PlusCircle, Search, Eye, Pencil, Trash2 } from "lucide-react";

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch customers
  const { data: customers, isLoading } = useQuery({
    queryKey: ["/api/customers"],
  });

  // Delete customer mutation
  const deleteMutation = useMutation({
    mutationFn: async (customerId: number) => {
      const response = await apiRequest("DELETE", `/api/customers/${customerId}`);
      if (!response.ok) {
        throw new Error("Failed to delete customer");
      }
      return customerId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Customer deleted",
        description: "The customer has been deleted successfully",
        variant: "success",
      });
      setShowDeleteDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    },
  });

  // Filter customers by search query
  const filteredCustomers = customers?.filter((customer: any) => {
    const query = searchQuery.toLowerCase();
    return (
      customer.name?.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query) ||
      customer.location?.toLowerCase().includes(query)
    );
  });

  // Handle customer deletion
  const handleDeleteCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setShowDeleteDialog(true);
  };

  // Handle customer edit
  const handleEditCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setShowEditForm(true);
  };

  // Handle form success
  const handleFormSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    setShowAddForm(false);
    setShowEditForm(false);
    setSelectedCustomer(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading customers...</span>
      </div>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
          <div>
            <CardTitle className="text-xl">Customers</CardTitle>
            <CardDescription>Manage your customer database</CardDescription>
          </div>
          <Button 
            className="bg-primary hover:bg-primary-dark text-white"
            onClick={() => setShowAddForm(true)}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </CardHeader>
        <CardContent className="px-6">
          <div className="mb-4 flex items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by name, email, or location"
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
                  <TableHead>Phone</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Added On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      {searchQuery ? "No customers match your search" : "No customers found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers?.map((customer: any) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.email || "-"}</TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell>{customer.location || "-"}</TableCell>
                      <TableCell>{formatDate(customer.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditCustomer(customer)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 w-8 p-0 text-destructive"
                            onClick={() => handleDeleteCustomer(customer)}
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

      {/* Add Customer Dialog */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-[600px]">
          <CustomerForm onSuccess={handleFormSuccess} />
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
        <DialogContent className="sm:max-w-[600px]">
          <CustomerForm 
            initialData={selectedCustomer} 
            onSuccess={handleFormSuccess} 
            isEditing={true}
          />
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCustomer?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteMutation.mutate(selectedCustomer?.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
