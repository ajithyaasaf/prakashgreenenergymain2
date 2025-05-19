import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Quotation {
  id: string;
  number: string;
  amount: number;
  customer: string;
  location: string;
}

interface RecentQuotationsProps {
  quotations: Quotation[];
  title?: string;
  period?: string;
}

export function RecentQuotations({ 
  quotations, 
  title = "Recent Quotations", 
  period = "Last 7 days" 
}: RecentQuotationsProps) {
  return (
    <Card className="border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">{title}</h2>
          <span className="text-xs text-gray-500">{period}</span>
        </div>
        <div className="space-y-4">
          {quotations.map((quotation) => (
            <div key={quotation.id} className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-secondary">
                <i className="ri-file-list-3-line text-lg"></i>
              </div>
              <div className="ml-3 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">{quotation.number}</h3>
                  <span className="text-xs text-gray-500">{formatCurrency(quotation.amount)}</span>
                </div>
                <p className="text-xs text-gray-500">{quotation.customer}, {quotation.location}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200">
          <Button 
            variant="ghost" 
            className="text-secondary text-sm font-medium p-0"
            asChild
          >
            <Link href="/quotations/new">
              <span>Create New Quotation</span>
              <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
