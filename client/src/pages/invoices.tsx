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

export default function Invoices() {
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch invoices and customers
  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["/api/invoices"],
  });
  
  const { data: customers, isLoading: customersLoading } = useQuery({
    queryKey: ["/api/customers"],
  });

  // Status badge styles
  const statusStyles = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800"
  };

  // Filter invoices by search query
  const filteredInvoices = invoices?.filter((invoice: any) => {
    const query = searchQuery.toLowerCase();
    // Find customer for this invoice
    const customer = customers?.find((c: any) => c.id === invoice.customerId);
    const customerName = customer?.name?.toLowerCase() || '';
    
    return (
      invoice.invoiceNumber.toLowerCase().includes(query) ||
      customerName.includes(query) ||
      invoice.status.toLowerCase().includes(query)
    );
  });

  // Loading state
  if (invoicesLoading || customersLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Loading invoices...</span>
      </div>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between px-6 py-4">
        <div>
          <CardTitle className="text-xl">Invoices</CardTitle>
          <CardDescription>Manage your customer invoices</CardDescription>
        </div>
        <Button 
          className="bg-primary hover:bg-primary-dark text-white"
          onClick={() => window.location.href = "/invoices/new"}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </CardHeader>
      <CardContent className="px-6">
        <div className="mb-4 flex items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by invoice number or customer"
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
                <TableHead>Invoice No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    {searchQuery ? "No invoices match your search" : "No invoices found"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices?.map((invoice: any) => {
                  // Find customer for this invoice
                  const customer = customers?.find((c: any) => c.id === invoice.customerId);
                  
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                      <TableCell>
                        <div>{customer?.name || "Unknown"}</div>
                        <div className="text-sm text-gray-500">{customer?.location}</div>
                      </TableCell>
                      <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                      <TableCell>{invoice.dueDate ? formatDate(invoice.dueDate) : "-"}</TableCell>
                      <TableCell>{formatCurrency(invoice.totalAmount)}</TableCell>
                      <TableCell>
                        <Badge className={cn("font-medium capitalize", 
                          invoice.status in statusStyles 
                            ? statusStyles[invoice.status as keyof typeof statusStyles] 
                            : "bg-gray-100"
                        )}>
                          {invoice.status}
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
