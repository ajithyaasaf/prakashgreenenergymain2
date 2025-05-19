import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, PencilLine, PlusCircle, ArrowRight } from "lucide-react";
import { getInitials, formatDate } from "@/lib/utils";

interface Customer {
  id: number;
  name: string;
  email: string;
  location: string;
  addedOn: Date;
}

interface RecentCustomersTableProps {
  customers: Customer[];
}

export function RecentCustomersTable({ customers }: RecentCustomersTableProps) {
  return (
    <Card className="border border-gray-200 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-gray-200">
        <CardTitle className="font-semibold text-lg">Recent Customers</CardTitle>
        <Button variant="ghost" size="icon" asChild>
          <Link href="/customers/new">
            <PlusCircle className="h-5 w-5 text-secondary" />
          </Link>
        </Button>
      </CardHeader>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-gray-50">
            <TableRow>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Added On</TableHead>
              <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
                      <span>{getInitials(customer.name)}</span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                      <div className="text-sm text-gray-500">{customer.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{customer.location}</div>
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{formatDate(customer.addedOn)}</div>
                </TableCell>
                <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                      <Link href={`/customers/${customer.id}`}>
                        <Eye className="h-4 w-4 text-secondary" />
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                      <Link href={`/customers/${customer.id}/edit`}>
                        <PencilLine className="h-4 w-4 text-gray-500" />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <CardContent className="px-6 py-4 border-t border-gray-200">
        <Button variant="ghost" className="text-secondary text-sm font-medium p-0" asChild>
          <Link href="/customers">
            <span>View All Customers</span>
            <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
