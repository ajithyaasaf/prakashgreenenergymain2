import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Search, PlusCircle, Pencil, Download, Eye, Loader2 } from "lucide-react";

export default function Quotations() {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch quotations and customers
  const { data: quotations, isLoading: quotationsLoading } = useQuery({
    queryKey: ["/api/quotations"],
  });
  
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["/api/customers"],
  });

  // Status badge styles
  const statusStyles = {
    draft: "bg-gray-100 text-gray-800",
    sent: "bg-blue-100 text-blue-800",
    accepted: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800"
  };

  // Filter quotations by search query
  const filteredQuotations = quotations?.filter((quotation: any) => {
    const query = searchQuery.toLowerCase();
    // Find customer for this quotation
    const customer = customers?.find((c: any) => c.id === quotation.customerId);
    const customerName = customer?.name?.toLowerCase() || '';
    
    return (
      quotation.quotationNumber?.toLowerCase().includes(query) ||
      customerName.includes(query) ||
      quotation.status?.toLowerCase().includes(query)
    );
  });

  // Loading state
  if (quotationsLoading || customersLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading quotations...</span>
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
        <div>
          <CardTitle className="text-xl">Quotations</CardTitle>
          <CardDescription>Manage your customer quotations</CardDescription>
        </div>
        <Button 
          className="bg-primary hover:bg-primary-dark text-white"
          onClick={() => window.location.href = "/quotations/new"}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Quotation
        </Button>
      </CardHeader>
      <CardContent className="px-6">
        <div className="mb-4 flex items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by quotation number or customer"
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
                <TableHead>Quotation No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredQuotations?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {searchQuery ? "No quotations match your search" : "No quotations found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredQuotations?.map((quotation: any) => {
                  // Find customer for this quotation
                  const customer = customers?.find((c: any) => c.id === quotation.customerId);
                  
                  return (
                    <TableRow key={quotation.id}>
                      <TableCell className="font-medium">{quotation.quotationNumber}</TableCell>
                      <TableCell>
                        <div>{customer?.name || "Unknown"}</div>
                        <div className="text-sm text-gray-500">{customer?.location}</div>
                      </TableCell>
                      <TableCell>{formatDate(quotation.createdAt)}</TableCell>
                      <TableCell>{formatCurrency(quotation.totalAmount)}</TableCell>
                      <TableCell>
                        <Badge className={cn("font-medium capitalize", 
                          quotation.status in statusStyles 
                            ? statusStyles[quotation.status as keyof typeof statusStyles] 
                            : "bg-gray-100"
                        )}>
                          {quotation.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Download className="h-4 w-4" />
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
  );
}
