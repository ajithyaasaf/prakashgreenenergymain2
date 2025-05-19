import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Battery, Plug, Activity, Search, PlusCircle, Pencil, Trash2, Loader2 } from "lucide-react";

export default function Products() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ["/api/products"],
  });

  // Filter products by search query
  const filteredProducts = products?.filter((product: any) => {
    const query = searchQuery.toLowerCase();
    return (
      product.name?.toLowerCase().includes(query) ||
      product.type?.toLowerCase().includes(query) ||
      product.make?.toLowerCase().includes(query)
    );
  });

  // Function to render product icon
  const renderProductIcon = (product: any) => {
    const type = product.type?.toLowerCase() || '';
    
    if (type.includes('battery') || type.includes('power')) {
      return <Battery className="h-5 w-5 text-gray-500" />;
    } else if (type.includes('inverter') || type.includes('plug')) {
      return <Plug className="h-5 w-5 text-gray-500" />;
    } else {
      return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  // Function to determine stock status
  const getStockStatus = (quantity: number) => {
    if (quantity <= 5) {
      return { label: "Critical", style: "bg-red-100 text-red-800" };
    } else if (quantity <= 10) {
      return { label: "Low", style: "bg-yellow-100 text-yellow-800" };
    } else {
      return { label: "In Stock", style: "bg-green-100 text-green-800" };
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading products...</span>
      </div>
    );
  }

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
          <div>
            <CardTitle className="text-xl">Products</CardTitle>
            <CardDescription>Manage your product inventory</CardDescription>
          </div>
          <Button 
            className="bg-primary hover:bg-primary-dark text-white"
            onClick={() => setShowAddForm(true)}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </CardHeader>
        <CardContent className="px-6">
          <div className="mb-4 flex items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search products by name, type, or make"
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
                  <TableHead>Product</TableHead>
                  <TableHead>Voltage/Rating</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      {searchQuery ? "No products match your search" : "No products found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts?.map((product: any) => {
                    const status = getStockStatus(product.quantity);
                    
                    return (
                      <TableRow key={product.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center">
                              {renderProductIcon(product)}
                            </div>
                            <div>
                              <div className="font-medium">{product.name}</div>
                              <div className="text-sm text-gray-500">{product.make || product.type}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {product.voltage && <div>{product.voltage}</div>}
                          {product.rating && <div>{product.rating}</div>}
                        </TableCell>
                        <TableCell>{product.unit || "Piece"}</TableCell>
                        <TableCell>{formatCurrency(product.price)}</TableCell>
                        <TableCell>{product.quantity} units</TableCell>
                        <TableCell>
                          <Badge className={cn("font-medium", status.style)}>
                            {status.label}
                          </Badge>
                        </TableCell>
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Product Dialog - Placeholder for now */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-[600px]">
          <CardHeader>
            <CardTitle>Add New Product</CardTitle>
            <CardDescription>
              Fill in the details to add a new product to your inventory.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>Product form will be implemented here.</p>
          </CardContent>
        </DialogContent>
      </Dialog>
    </>
  );
}
