import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { formatCurrency } from "@/lib/utils";
import { StatsCard } from "@/components/dashboard/stats-card";
import { AttendanceCard } from "@/components/dashboard/attendance-card";
import { PendingApprovalsCard } from "@/components/dashboard/pending-approvals-card";
import { RecentCustomersTable } from "@/components/dashboard/recent-customers-table";
import { LowStockProductsTable } from "@/components/dashboard/low-stock-products-table";
import { RecentQuotations } from "@/components/dashboard/recent-quotations";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { CheckInModal } from "@/components/dashboard/check-in-modal";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user } = useAuthContext();
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // Fetch summary data
  const { data: summaryData, isLoading: loadingSummary } = useQuery({
    queryKey: ["/api/dashboard/summary"],
    queryFn: async () => {
      // This would be replaced with real data from the API
      return {
        overallPerformance: {
          growthPercent: 4.5,
          revenue: {
            value: 2450000, // in paise/cents
            change: {
              value: 12,
              period: "last month"
            }
          },
          newCustomers: {
            value: 18,
            change: {
              value: 5,
              period: "last month"
            }
          }
        },
        attendance: {
          date: new Date(),
          items: [
            { status: "present", count: 18, total: 22 },
            { status: "leave", count: 3, total: 22 },
            { status: "absent", count: 1, total: 22 }
          ]
        },
        pendingApprovals: [
          { 
            id: "pa1", 
            type: "Leave Approval", 
            description: "Vikram Kumar - 3 days casual leave",
            time: "2 hrs ago" 
          },
          { 
            id: "pa2", 
            type: "Invoice Approval", 
            description: "INV-2023-072 - ₹75,000",
            time: "5 hrs ago" 
          },
          { 
            id: "pa3", 
            type: "Quotation Approval", 
            description: "QT-2023-045 - ₹1,25,000",
            time: "Yesterday" 
          }
        ]
      };
    }
  });

  // Fetch customers data
  const { data: customersData, isLoading: loadingCustomers } = useQuery({
    queryKey: ["/api/customers"],
  });

  // Fetch products data
  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ["/api/products"],
  });

  // Fetch quotations data
  const { data: quotationsData, isLoading: loadingQuotations } = useQuery({
    queryKey: ["/api/quotations"],
  });

  // Fetch invoices data
  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ["/api/invoices"],
  });

  // Format recent customers
  const recentCustomers = customersData?.slice(0, 3).map((customer: any) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email || '',
    location: customer.location || 'N/A',
    addedOn: new Date(customer.createdAt)
  })) || [];

  // Format low stock products
  const lowStockProducts = productsData?.filter((product: any) => product.quantity <= 10)
    .slice(0, 3)
    .map((product: any) => ({
      id: product.id,
      name: product.name,
      type: product.type || product.make || '',
      icon: product.type?.toLowerCase().includes('battery') ? 'battery' : 
            product.type?.toLowerCase().includes('inverter') ? 'plug' : 'dashboard',
      currentStock: product.quantity,
      price: product.price,
      status: product.quantity <= 5 ? 'critical' : 'low'
    })) || [];

  // Format recent quotations
  const recentQuotations = quotationsData?.slice(0, 3).map((quotation: any) => {
    const customer = customersData?.find((c: any) => c.id === quotation.customerId);
    return {
      id: quotation.id.toString(),
      number: quotation.quotationNumber,
      amount: quotation.totalAmount,
      customer: customer?.name || 'Unknown',
      location: customer?.location || 'N/A'
    };
  }) || [];

  // Format recent invoices
  const recentInvoices = invoicesData?.slice(0, 3).map((invoice: any) => {
    const customer = customersData?.find((c: any) => c.id === invoice.customerId);
    return {
      id: invoice.id.toString(),
      number: invoice.invoiceNumber,
      amount: invoice.totalAmount,
      status: invoice.status,
      customer: customer?.name || 'Unknown',
      location: customer?.location || 'N/A'
    };
  }) || [];

  // Recent activity
  const recentActivity = [
    {
      id: "act1",
      icon: "ri-user-add-line",
      iconBgColor: "bg-primary",
      title: "New customer added",
      description: "Sundar Designs, Chennai",
      time: "2 hours ago"
    },
    {
      id: "act2",
      icon: "ri-file-list-3-line",
      iconBgColor: "bg-secondary",
      title: "Quotation created",
      description: "QT-2023-051 for ₹1,24,500",
      time: "3 hours ago"
    },
    {
      id: "act3",
      icon: "ri-time-line",
      iconBgColor: "bg-purple-500",
      title: "Employee checked in",
      description: "Ramesh Kumar at 9:32 AM",
      time: "5 hours ago"
    },
    {
      id: "act4",
      icon: "ri-bill-line",
      iconBgColor: "bg-green-500",
      title: "Invoice paid",
      description: "INV-2023-073 for ₹1,15,200",
      time: "6 hours ago"
    }
  ];

  // Quick actions
  const quickActions = [
    {
      id: "qa1",
      label: "Add Customer",
      icon: "ri-user-add-line",
      iconBgColor: "bg-primary bg-opacity-20",
      iconColor: "text-primary",
      href: "/customers/new"
    },
    {
      id: "qa2",
      label: "Add Product",
      icon: "ri-store-2-line",
      iconBgColor: "bg-secondary bg-opacity-20",
      iconColor: "text-secondary",
      href: "/products/new"
    },
    {
      id: "qa3",
      label: "New Quotation",
      icon: "ri-file-list-3-line",
      iconBgColor: "bg-green-500 bg-opacity-20",
      iconColor: "text-green-500",
      href: "/quotations/new"
    },
    {
      id: "qa4",
      label: "New Invoice",
      icon: "ri-bill-line",
      iconBgColor: "bg-purple-500 bg-opacity-20",
      iconColor: "text-purple-500",
      href: "/invoices/new"
    },
    {
      id: "qa5",
      label: "Apply Leave",
      icon: "ri-calendar-check-line",
      iconBgColor: "bg-yellow-500 bg-opacity-20",
      iconColor: "text-yellow-500",
      href: "/leave/new"
    },
    {
      id: "qa6",
      label: "Reports",
      icon: "ri-file-chart-line",
      iconBgColor: "bg-red-500 bg-opacity-20",
      iconColor: "text-red-500",
      href: "/reports"
    }
  ];

  // Loading state
  if (loadingSummary || loadingCustomers || loadingProducts || loadingQuotations || loadingInvoices) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
        <span className="ml-2 text-base sm:text-lg">Loading dashboard data...</span>
      </div>
    );
  }

  return (
    <>
      {/* Dashboard Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-4 sm:mb-6">
        {/* Overall Stats Card */}
        <StatsCard
          title="Overall Performance"
          growthPercent={summaryData.overallPerformance.growthPercent}
          stats={[
            {
              label: "Revenue",
              value: formatCurrency(summaryData.overallPerformance.revenue.value),
              change: summaryData.overallPerformance.revenue.change
            },
            {
              label: "New Customers",
              value: summaryData.overallPerformance.newCustomers.value.toString(),
              change: summaryData.overallPerformance.newCustomers.change
            }
          ]}
        />

        {/* Today's Attendance */}
        <AttendanceCard
          date={summaryData.attendance.date}
          items={summaryData.attendance.items}
          onCheckInOut={() => setShowCheckInModal(true)}
        />

        {/* Pending Approvals */}
        <PendingApprovalsCard
          approvals={summaryData.pendingApprovals}
          onViewAll={() => window.location.href = "/approvals"}
        />
      </div>

      {/* Recent Customers & Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6 mb-4 sm:mb-6">
        {/* Recent Customers */}
        <RecentCustomersTable customers={recentCustomers} />

        {/* Low Stock Products */}
        <LowStockProductsTable products={lowStockProducts} />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-4 sm:mb-6">
        {/* Recent Quotations Card */}
        <RecentQuotations quotations={recentQuotations} />

        {/* Recent Invoices Card */}
        <RecentInvoices invoices={recentInvoices} />

        {/* Recent Activity Card */}
        <div className="sm:col-span-2 md:col-span-1">
          <ActivityTimeline activities={recentActivity} />
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions actions={quickActions} />

      {/* Check-in Modal */}
      <CheckInModal open={showCheckInModal} onOpenChange={setShowCheckInModal} />
    </>
  );
}
