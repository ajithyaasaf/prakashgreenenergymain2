import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuthContext } from "@/contexts/auth-context";
import { 
  Calculator, 
  Settings, 
  Users, 
  FileSpreadsheet, 
  Download, 
  Upload,
  Plus,
  Edit3,
  Eye,
  DollarSign,
  Calendar,
  Building2,
  CheckCircle,
  AlertCircle,
  Clock
} from "lucide-react";

// Types
interface PayrollFieldConfig {
  id: string;
  name: string;
  displayName: string;
  category: "earnings" | "deductions" | "attendance";
  dataType: "number" | "percentage" | "boolean" | "text";
  isRequired: boolean;
  isSystemField: boolean;
  defaultValue?: number;
  department?: string;
  sortOrder: number;
  isActive: boolean;
}

interface EnhancedSalaryStructure {
  id: string;
  userId: string;
  employeeId: string;
  fixedBasic: number;
  fixedHRA: number;
  fixedConveyance: number;
  customEarnings: Record<string, number>;
  customDeductions: Record<string, number>;
  perDaySalaryBase: "basic" | "basic_hra" | "gross";
  overtimeRate: number;
  epfApplicable: boolean;
  esiApplicable: boolean;
  vptAmount: number;
  templateId?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  isActive: boolean;
}

interface EnhancedPayroll {
  id: string;
  userId: string;
  employeeId: string;
  month: number;
  year: number;
  monthDays: number;
  presentDays: number;
  paidLeaveDays: number;
  overtimeHours: number;
  perDaySalary: number;
  earnedBasic: number;
  earnedHRA: number;
  earnedConveyance: number;
  overtimePay: number;
  dynamicEarnings: Record<string, number>;
  dynamicDeductions: Record<string, number>;
  epfDeduction: number;
  esiDeduction: number;
  vptDeduction: number;
  tdsDeduction: number;
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  status: "draft" | "processed" | "approved" | "paid";
  processedBy?: string;
  processedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  remarks?: string;
}

interface User {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  department: string;
  designation: string;
  employeeId?: string;
  role?: string;
}

interface EnhancedPayrollSettings {
  id: string;
  epfEmployeeRate: number;
  epfEmployerRate: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  epfCeiling: number;
  esiThreshold: number;
  tdsThreshold: number;
  standardWorkingDays: number;
  standardWorkingHours: number;
  overtimeThresholdHours: number;
  companyName: string;
  companyAddress?: string;
  companyPan?: string;
  companyTan?: string;
  autoCalculateStatutory: boolean;
  allowManualOverride: boolean;
  requireApprovalForProcessing: boolean;
}

export default function EnhancedPayrollManagement() {
  const { toast } = useToast();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [isFieldConfigDialogOpen, setIsFieldConfigDialogOpen] = useState(false);
  const [isSalaryStructureDialogOpen, setIsSalaryStructureDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<string | null>(null);
  const [selectedStructures, setSelectedStructures] = useState<Set<string>>(new Set());
  const [selectedPayrolls, setSelectedPayrolls] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // API Queries
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.status}`);
      }
      const data = await response.json();
      // Return all users for salary structure creation (including admins if needed)
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.uid
  });

  const { data: fieldConfigs = [] } = useQuery<PayrollFieldConfig[]>({
    queryKey: ["/api/payroll/field-configs"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/payroll/field-configs');
      return response.json();
    },
    enabled: !!user?.firebaseUser
  });

  const { data: payrolls = [], refetch: refetchPayrolls } = useQuery<EnhancedPayroll[]>({
    queryKey: ["/api/enhanced-payrolls", selectedMonth, selectedYear, selectedDepartment],
    queryFn: async () => {
      const queryParams = {
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
        ...(selectedDepartment && selectedDepartment !== "all" && { department: selectedDepartment })
      };
      
      const response = await apiRequest('GET', '/api/enhanced-payrolls', queryParams);
      if (!response.ok) {
        throw new Error(`Failed to fetch payrolls: ${response.status}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.uid,
    refetchInterval: 5000 // Real-time updates every 5 seconds
  });

  const { data: salaryStructures = [], refetch: refetchSalaryStructures } = useQuery<EnhancedSalaryStructure[]>({
    queryKey: ["/api/enhanced-salary-structures"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/enhanced-salary-structures');
      if (!response.ok) {
        throw new Error(`Failed to fetch salary structures: ${response.status}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.uid,
    refetchInterval: 5000 // Real-time updates every 5 seconds
  });

  const { data: settings } = useQuery<EnhancedPayrollSettings>({
    queryKey: ["/api/enhanced-payroll-settings"],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/enhanced-payroll-settings');
      return response.json();
    },
    enabled: !!user?.firebaseUser
  });

  // Mutations
  const createFieldConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/payroll/field-configs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/field-configs"] });
      setIsFieldConfigDialogOpen(false);
      toast({ title: "Field configuration created successfully" });
    }
  });

  const createSalaryStructureMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/enhanced-salary-structures", data);
      if (!response.ok) {
        throw new Error(`Failed to create salary structure: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all related queries for real-time sync
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-salary-structures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-payrolls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsSalaryStructureDialogOpen(false);
      toast({ title: "Salary structure created successfully" });
      // Force refetch to show immediate updates
      refetchSalaryStructures();
    },
    onError: (error: any) => {
      toast({ title: "Error creating salary structure", description: error.message, variant: "destructive" });
    }
  });

  const bulkProcessPayrollMutation = useMutation({
    mutationFn: async (data: { month: number; year: number; userIds?: string[] }) => {
      const response = await apiRequest("POST", "/api/enhanced-payrolls/bulk-process", data);
      if (!response.ok) {
        throw new Error(`Failed to process payroll: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all related queries for complete synchronization
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-payrolls"] });
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-salary-structures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ 
        title: "Bulk processing completed", 
        description: `Processed ${data.payrolls?.length || 0} payrolls successfully` 
      });
      // Force immediate refetch for real-time updates
      refetchPayrolls();
      refetchSalaryStructures();
    },
    onError: (error: any) => {
      toast({ title: "Error processing payroll", description: error.message, variant: "destructive" });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PATCH", "/api/enhanced-payroll-settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-payroll-settings"] });
      setIsSettingsDialogOpen(false);
      toast({ title: "Settings updated successfully" });
    }
  });

  // Helper functions
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const departments = ["operations", "admin", "hr", "marketing", "sales", "technical", "housekeeping"];

  // Get earnings and deductions field configs
  const earningsFields = fieldConfigs.filter(field => field.category === "earnings" && field.isActive);
  const deductionsFields = fieldConfigs.filter(field => field.category === "deductions" && field.isActive);

  return (
    <div className="container mx-auto py-4 px-4 space-y-4 lg:py-6 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:justify-between lg:items-center lg:space-y-0">
        <div className="space-y-1">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Enhanced Payroll Management</h1>
          <p className="text-sm lg:text-base text-muted-foreground">
            Comprehensive payroll processing with flexible salary components
          </p>
        </div>
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 lg:flex-row lg:gap-2">
          <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Settings className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Settings</span>
                <span className="sm:hidden">Config</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl mx-auto">
              <DialogHeader>
                <DialogTitle>Payroll Settings</DialogTitle>
                <DialogDescription>
                  Configure statutory rates and company information
                </DialogDescription>
              </DialogHeader>
              <PayrollSettingsForm 
                settings={settings} 
                onSubmit={(data) => updateSettingsMutation.mutate(data)} 
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isFieldConfigDialogOpen} onOpenChange={setIsFieldConfigDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Add Field</span>
                <span className="sm:hidden">Field</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-lg mx-auto">
              <DialogHeader>
                <DialogTitle>Add Payroll Field</DialogTitle>
                <DialogDescription>
                  Create custom earnings or deduction fields
                </DialogDescription>
              </DialogHeader>
              <FieldConfigForm onSubmit={(data) => createFieldConfigMutation.mutate(data)} />
            </DialogContent>
          </Dialog>

          <Dialog open={isSalaryStructureDialogOpen} onOpenChange={setIsSalaryStructureDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <DollarSign className="h-4 w-4 mr-2" />
                <span className="hidden lg:inline">Create Salary Structure</span>
                <span className="lg:hidden">Salary</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] h-[95vh] max-w-7xl mx-auto overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-lg lg:text-xl font-bold">Create Comprehensive Salary Structure</DialogTitle>
                <DialogDescription>
                  Define detailed salary components, deductions, and working parameters for an employee
                </DialogDescription>
              </DialogHeader>
              <div className="max-h-[calc(95vh-120px)] overflow-y-auto">
                <SalaryStructureForm 
                  users={users}
                  earningsFields={earningsFields}
                  deductionsFields={deductionsFields}
                  onSubmit={(data) => createSalaryStructureMutation.mutate(data)} 
                />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Payroll Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="month" className="text-sm font-medium">Month</Label>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((month, index) => (
                    <SelectItem key={index} value={(index + 1).toString()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year" className="text-sm font-medium">Year</Label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" className="text-sm font-medium">Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept} value={dept}>
                      {dept.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label className="text-sm font-medium">Actions</Label>
              <Button 
                onClick={() => bulkProcessPayrollMutation.mutate({ 
                  month: selectedMonth, 
                  year: selectedYear,
                  userIds: selectedDepartment && selectedDepartment !== "all" ? users
                    .filter((user: any) => user.department === selectedDepartment)
                    .map((user: any) => user.id) : undefined
                })}
                disabled={bulkProcessPayrollMutation.isPending}
                className="w-full"
              >
                <Calculator className="h-4 w-4 mr-2" />
                {bulkProcessPayrollMutation.isPending ? "Processing..." : "Bulk Process"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Employees</CardTitle>
            <Users className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl lg:text-3xl font-bold text-gray-900">{payrolls.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {monthNames[selectedMonth - 1]} {selectedYear}
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Gross</CardTitle>
            <DollarSign className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold text-green-600">
              {formatCurrency(payrolls.reduce((sum, p) => sum + p.totalEarnings, 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Gross earnings
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Deductions</CardTitle>
            <AlertCircle className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold text-orange-600">
              {formatCurrency(payrolls.reduce((sum, p) => sum + p.totalDeductions, 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total deductions
            </p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Net Payable</CardTitle>
            <CheckCircle className="h-5 w-5 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold text-purple-600">
              {formatCurrency(payrolls.reduce((sum, p) => sum + p.netSalary, 0))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Final payable amount
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="payroll" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-none lg:flex">
          <TabsTrigger value="payroll" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Payroll Processing</span>
            <span className="sm:hidden">Payroll</span>
          </TabsTrigger>
          <TabsTrigger value="structures" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Salary Structures</span>
            <span className="sm:hidden">Structures</span>
          </TabsTrigger>
          <TabsTrigger value="fields" className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Field Configuration</span>
            <span className="sm:hidden">Fields</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payroll" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Payroll Register - {monthNames[selectedMonth - 1]} {selectedYear}
              </CardTitle>
              <CardDescription>
                Comprehensive payroll processing with flexible salary components
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PayrollTable 
                payrolls={payrolls}
                users={users}
                earningsFields={earningsFields}
                deductionsFields={deductionsFields}
                onEdit={setEditingPayroll}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="structures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Salary Structures
              </CardTitle>
              <CardDescription>
                Manage employee salary components and structures
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SalaryStructuresTable 
                structures={salaryStructures}
                users={users}
                earningsFields={earningsFields}
                deductionsFields={deductionsFields}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Field Configuration
              </CardTitle>
              <CardDescription>
                Configure custom earnings and deduction fields
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldConfigTable fieldConfigs={fieldConfigs} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Enhanced Payroll Processing Table Component
function PayrollTable({ 
  payrolls, 
  users, 
  earningsFields, 
  deductionsFields, 
  onEdit 
}: {
  payrolls: EnhancedPayroll[];
  users: User[];
  earningsFields: PayrollFieldConfig[];
  deductionsFields: PayrollFieldConfig[];
  onEdit: (id: string) => void;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft": return "bg-gray-100 text-gray-800";
      case "processed": return "bg-blue-100 text-blue-800";
      case "approved": return "bg-green-100 text-green-800";
      case "paid": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const toggleRowExpansion = (payrollId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(payrollId)) {
      newExpanded.delete(payrollId);
    } else {
      newExpanded.add(payrollId);
    }
    setExpandedRows(newExpanded);
  };

  const calculateOvertimeDetails = (payroll: EnhancedPayroll) => {
    const overtimeHours = payroll.overtimeHours || 0;
    const overtimePay = payroll.overtimePay || 0;
    const perHourRate = overtimeHours > 0 ? overtimePay / overtimeHours : 0;
    return { overtimeHours, overtimePay, perHourRate };
  };

  const filteredPayrolls = payrolls.filter(payroll => {
    const payrollUser = users.find((u: any) => u.id === payroll.userId);
    const statusMatch = statusFilter === "all" || payroll.status === statusFilter;
    const departmentMatch = departmentFilter === "all" || payrollUser?.department === departmentFilter;
    return statusMatch && departmentMatch;
  });

  const departments = ["operations", "admin", "hr", "marketing", "sales", "technical", "housekeeping"];

  // Enhanced summary calculations
  const totalPayrolls = filteredPayrolls.length;
  const totalGrossEarnings = filteredPayrolls.reduce((sum, p) => sum + p.totalEarnings, 0);
  const totalDeductions = filteredPayrolls.reduce((sum, p) => sum + p.totalDeductions, 0);
  const totalNetPayable = filteredPayrolls.reduce((sum, p) => sum + p.netSalary, 0);
  const totalOvertimeHours = filteredPayrolls.reduce((sum, p) => sum + (p.overtimeHours || 0), 0);
  const totalOvertimePay = filteredPayrolls.reduce((sum, p) => sum + (p.overtimePay || 0), 0);

  if (payrolls.length === 0) {
    return (
      <div className="text-center py-8">
        <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No payroll data found</h3>
        <p className="text-muted-foreground">
          Process payroll for the selected month to see data here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payrolls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold">{totalPayrolls}</div>
            <p className="text-xs text-muted-foreground">Processed records</p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Gross Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg lg:text-xl font-bold text-green-600">{formatCurrency(totalGrossEarnings)}</div>
            <p className="text-xs text-muted-foreground">Total earnings</p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg lg:text-xl font-bold text-red-600">{formatCurrency(totalDeductions)}</div>
            <p className="text-xs text-muted-foreground">All deductions</p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Payable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg lg:text-xl font-bold text-blue-600">{formatCurrency(totalNetPayable)}</div>
            <p className="text-xs text-muted-foreground">Final amount</p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">OT Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl lg:text-2xl font-bold text-orange-600">{totalOvertimeHours.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Overtime hours</p>
          </CardContent>
        </Card>
        <Card className="transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">OT Pay</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg lg:text-xl font-bold text-orange-600">{formatCurrency(totalOvertimePay)}</div>
            <p className="text-xs text-muted-foreground">Overtime payment</p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1 space-y-2">
          <Label htmlFor="status-filter" className="text-sm font-medium">Filter by Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-2">
          <Label htmlFor="department-filter" className="text-sm font-medium">Filter by Department</Label>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>
                  {dept.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Enhanced Payroll Table - Mobile-First Responsive */}
      <div className="block lg:hidden space-y-4">
        {/* Mobile Card Layout */}
        {filteredPayrolls.map((payroll) => {
          const payrollUser = users.find((u: any) => u.id === payroll.userId);
          const isExpanded = expandedRows.has(payroll.id);
          const { overtimeHours, overtimePay, perHourRate } = calculateOvertimeDetails(payroll);
          
          return (
            <Card key={payroll.id} className="w-full">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold">{payrollUser?.displayName}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{payroll.employeeId}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {payrollUser?.department?.toUpperCase() || 'N/A'}
                      </Badge>
                      <Badge className={`text-xs ${getStatusColor(payroll.status)}`}>
                        {payroll.status}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleRowExpansion(payroll.id)}
                    className="ml-2"
                  >
                    {isExpanded ? "−" : "+"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-600">Attendance</h4>
                    <div className="text-sm space-y-1 mt-1">
                      <div>Present: {payroll.presentDays}/{payroll.monthDays}</div>
                      <div>Leave: {payroll.paidLeaveDays || 0} days</div>
                      <div>Per Day: {formatCurrency(payroll.perDaySalary)}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-600">Basic Earnings</h4>
                    <div className="text-sm space-y-1 mt-1">
                      <div>Basic: {formatCurrency(payroll.earnedBasic)}</div>
                      <div>HRA: {formatCurrency(payroll.earnedHRA)}</div>
                      <div>Conv: {formatCurrency(payroll.earnedConveyance)}</div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-sm text-gray-600">Overtime</h4>
                    <div className="text-sm space-y-1 mt-1">
                      <div className="font-medium text-orange-600">{overtimeHours.toFixed(1)} hrs</div>
                      <div>{formatCurrency(overtimePay)}</div>
                      {perHourRate > 0 && (
                        <div className="text-muted-foreground">@{formatCurrency(perHourRate)}/hr</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-gray-600">Summary</h4>
                    <div className="text-sm space-y-1 mt-1">
                      <div className="font-medium text-green-600">{formatCurrency(payroll.totalEarnings)}</div>
                      <div className="text-red-600">-{formatCurrency(payroll.totalDeductions)}</div>
                      <div className="font-bold text-blue-600">{formatCurrency(payroll.netSalary)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => onEdit(payroll.id)}
                    className="flex-1"
                  >
                    <Edit3 className="h-3 w-3 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => toggleRowExpansion(payroll.id)}
                    className="flex-1"
                  >
                    <Eye className="h-3 w-3 mr-2" />
                    {isExpanded ? "Hide" : "Details"}
                  </Button>
                </div>

                {/* Expanded Details for Mobile */}
                {isExpanded && (
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-semibold text-lg">Complete Details - {payrollUser?.displayName}</h4>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm text-blue-600">Statutory Deductions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between">
                            <span>EPF:</span>
                            <span className="font-medium">{formatCurrency(payroll.epfDeduction)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>ESI:</span>
                            <span className="font-medium">{formatCurrency(payroll.esiDeduction)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>VPT:</span>
                            <span className="font-medium">{formatCurrency(payroll.vptDeduction)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>TDS:</span>
                            <span className="font-medium">{formatCurrency(payroll.tdsDeduction)}</span>
                          </div>
                        </CardContent>
                      </Card>

                      {Object.keys(payroll.dynamicEarnings).length > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm text-green-600">Additional Earnings</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {Object.entries(payroll.dynamicEarnings).map(([key, value]) => {
                              const field = earningsFields.find(f => f.name === key);
                              return (
                                <div key={key} className="flex justify-between">
                                  <span>{field?.displayName || key}:</span>
                                  <span className="font-medium">{formatCurrency(value as number)}</span>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      )}

                      {Object.keys(payroll.dynamicDeductions).length > 0 && (
                        <Card>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm text-red-600">Additional Deductions</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {Object.entries(payroll.dynamicDeductions).map(([key, value]) => {
                              const field = deductionsFields.find(f => f.name === key);
                              return (
                                <div key={key} className="flex justify-between">
                                  <span>{field?.displayName || key}:</span>
                                  <span className="font-medium">{formatCurrency(value as number)}</span>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden lg:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Employee Details</TableHead>
              <TableHead>Attendance & Days</TableHead>
              <TableHead>Basic Earnings</TableHead>
              <TableHead>Overtime Details</TableHead>
              <TableHead>Gross & Net</TableHead>
              <TableHead>Statutory Deductions</TableHead>
              <TableHead>Status & Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayrolls.map((payroll) => {
              const payrollUser = users.find((u: any) => u.id === payroll.userId);
              const isExpanded = expandedRows.has(payroll.id);
              const { overtimeHours, overtimePay, perHourRate } = calculateOvertimeDetails(payroll);
              
              return (
                <React.Fragment key={payroll.id}>
                  <TableRow className="hover:bg-gray-50">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(payroll.id)}
                        className="p-1"
                      >
                        {isExpanded ? "−" : "+"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{payrollUser?.displayName}</div>
                        <div className="text-sm text-muted-foreground">{payroll.employeeId}</div>
                        <Badge variant="outline" className="text-xs">
                          {payrollUser?.department?.toUpperCase() || 'N/A'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>Present: {payroll.presentDays}/{payroll.monthDays}</div>
                        <div>Leave: {payroll.paidLeaveDays || 0} days</div>
                        <div>Per Day: {formatCurrency(payroll.perDaySalary)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>Basic: {formatCurrency(payroll.earnedBasic)}</div>
                        <div>HRA: {formatCurrency(payroll.earnedHRA)}</div>
                        <div>Conv: {formatCurrency(payroll.earnedConveyance)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className="font-medium text-orange-600">{overtimeHours.toFixed(1)} hrs</div>
                        <div>{formatCurrency(overtimePay)}</div>
                        {perHourRate > 0 && (
                          <div className="text-muted-foreground">@{formatCurrency(perHourRate)}/hr</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-green-600">{formatCurrency(payroll.totalEarnings)}</div>
                        <div className="text-sm text-red-600">-{formatCurrency(payroll.totalDeductions)}</div>
                        <div className="font-bold border-t pt-1">{formatCurrency(payroll.netSalary)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>EPF: {formatCurrency(payroll.epfDeduction)}</div>
                        <div>ESI: {formatCurrency(payroll.esiDeduction)}</div>
                        {payroll.vptDeduction > 0 && (
                          <div>VPT: {formatCurrency(payroll.vptDeduction)}</div>
                        )}
                        {payroll.tdsDeduction > 0 && (
                          <div>TDS: {formatCurrency(payroll.tdsDeduction)}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Badge className={getStatusColor(payroll.status)}>
                          {payroll.status}
                        </Badge>
                        <div className="flex gap-1">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0" 
                            onClick={() => onEdit(payroll.id)}
                            title="Edit Payroll"
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={() => toggleRowExpansion(payroll.id)}
                            title="View Details"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded Row Details */}
                  {isExpanded && (
                    <TableRow className="bg-gray-50">
                      <TableCell colSpan={8}>
                        <div className="p-4 space-y-4">
                          <h4 className="font-semibold text-lg">Comprehensive Payroll Details - {payrollUser?.displayName}</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {/* Attendance Details */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-blue-600">Attendance Details</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span>Month Days:</span>
                                  <span className="font-medium">{payroll.monthDays}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Present Days:</span>
                                  <span className="font-medium">{payroll.presentDays}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Paid Leave:</span>
                                  <span className="font-medium">{payroll.paidLeaveDays || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Overtime Hours:</span>
                                  <span className="font-medium text-orange-600">{overtimeHours.toFixed(1)}</span>
                                </div>
                                <div className="border-t pt-2 flex justify-between font-bold">
                                  <span>Per Day Salary:</span>
                                  <span>{formatCurrency(payroll.perDaySalary)}</span>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Earnings Breakdown */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-green-600">Earnings Breakdown</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span>Earned Basic:</span>
                                  <span className="font-medium">{formatCurrency(payroll.earnedBasic)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Earned HRA:</span>
                                  <span className="font-medium">{formatCurrency(payroll.earnedHRA)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Earned Conveyance:</span>
                                  <span className="font-medium">{formatCurrency(payroll.earnedConveyance)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Overtime Pay:</span>
                                  <span className="font-medium text-orange-600">{formatCurrency(overtimePay)}</span>
                                </div>
                                
                                {Object.keys(payroll.dynamicEarnings || {}).length > 0 && (
                                  <>
                                    <div className="border-t pt-2 mt-2">
                                      <div className="text-sm font-medium text-muted-foreground mb-1">Additional Earnings:</div>
                                      {Object.entries(payroll.dynamicEarnings || {}).map(([key, value]) => (
                                        <div key={key} className="flex justify-between text-sm">
                                          <span>{key}:</span>
                                          <span>{formatCurrency(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                                
                                <div className="border-t pt-2 flex justify-between font-bold text-green-600">
                                  <span>Total Earnings:</span>
                                  <span>{formatCurrency(payroll.totalEarnings)}</span>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Deductions Breakdown */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-red-600">Deductions Breakdown</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span>EPF:</span>
                                  <span className="font-medium">{formatCurrency(payroll.epfDeduction)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>ESI:</span>
                                  <span className="font-medium">{formatCurrency(payroll.esiDeduction)}</span>
                                </div>
                                {payroll.vptDeduction > 0 && (
                                  <div className="flex justify-between">
                                    <span>VPT:</span>
                                    <span className="font-medium">{formatCurrency(payroll.vptDeduction)}</span>
                                  </div>
                                )}
                                {payroll.tdsDeduction > 0 && (
                                  <div className="flex justify-between">
                                    <span>TDS:</span>
                                    <span className="font-medium">{formatCurrency(payroll.tdsDeduction)}</span>
                                  </div>
                                )}
                                
                                {Object.keys(payroll.dynamicDeductions || {}).length > 0 && (
                                  <>
                                    <div className="border-t pt-2 mt-2">
                                      <div className="text-sm font-medium text-muted-foreground mb-1">Other Deductions:</div>
                                      {Object.entries(payroll.dynamicDeductions || {}).map(([key, value]) => (
                                        <div key={key} className="flex justify-between text-sm">
                                          <span>{key}:</span>
                                          <span>{formatCurrency(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                                
                                <div className="border-t pt-2 flex justify-between font-bold text-red-600">
                                  <span>Total Deductions:</span>
                                  <span>{formatCurrency(payroll.totalDeductions)}</span>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Processing Information */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-purple-600">Processing Info</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span>Status:</span>
                                  <Badge className={getStatusColor(payroll.status)}>
                                    {payroll.status}
                                  </Badge>
                                </div>
                                {payroll.processedBy && (
                                  <div className="flex justify-between">
                                    <span>Processed By:</span>
                                    <span className="font-medium">{payroll.processedBy}</span>
                                  </div>
                                )}
                                {payroll.processedAt && (
                                  <div className="flex justify-between">
                                    <span>Processed At:</span>
                                    <span className="font-medium">{new Date(payroll.processedAt).toLocaleDateString()}</span>
                                  </div>
                                )}
                                {payroll.approvedBy && (
                                  <div className="flex justify-between">
                                    <span>Approved By:</span>
                                    <span className="font-medium">{payroll.approvedBy}</span>
                                  </div>
                                )}
                                {payroll.remarks && (
                                  <div className="mt-2">
                                    <div className="text-sm font-medium text-muted-foreground mb-1">Remarks:</div>
                                    <div className="text-sm bg-gray-100 p-2 rounded">{payroll.remarks}</div>
                                  </div>
                                )}
                                <div className="border-t pt-2 flex justify-between font-bold text-blue-600">
                                  <span>Net Salary:</span>
                                  <span>{formatCurrency(payroll.netSalary)}</span>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filteredPayrolls.length === 0 && (
        <div className="text-center py-8">
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No payroll records found</h3>
          <p className="text-muted-foreground">
            {payrolls.length === 0 
              ? "Process payroll for the selected month to see data here."
              : "No payroll records match the selected filters."
            }
          </p>
        </div>
      )}
    </div>
  );
}

// Enhanced Salary Structures Table Component  
function SalaryStructuresTable({ 
  structures, 
  users, 
  earningsFields, 
  deductionsFields 
}: {
  structures: EnhancedSalaryStructure[];
  users: User[];
  earningsFields: PayrollFieldConfig[];
  deductionsFields: PayrollFieldConfig[];
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [salaryRangeFilter, setSalaryRangeFilter] = useState<string>("all");

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  const toggleRowExpansion = (structureId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(structureId)) {
      newExpanded.delete(structureId);
    } else {
      newExpanded.add(structureId);
    }
    setExpandedRows(newExpanded);
  };

  const calculateGrossSalary = (structure: EnhancedSalaryStructure) => {
    const customEarningsTotal = Object.values(structure.customEarnings || {}).reduce((sum, val) => sum + val, 0);
    return structure.fixedBasic + structure.fixedHRA + structure.fixedConveyance + customEarningsTotal;
  };

  const calculateTotalDeductions = (structure: EnhancedSalaryStructure) => {
    const customDeductionsTotal = Object.values(structure.customDeductions || {}).reduce((sum, val) => sum + val, 0);
    const epfAmount = structure.epfApplicable ? (structure.fixedBasic * 0.12) : 0;
    const esiAmount = structure.esiApplicable ? (calculateGrossSalary(structure) * 0.0075) : 0;
    return customDeductionsTotal + epfAmount + esiAmount + (structure.vptAmount || 0);
  };

  const filteredStructures = structures.filter(structure => {
    const structureUser = users.find((u: any) => u.id === structure.userId);
    const departmentMatch = filterDepartment === "all" || structureUser?.department === filterDepartment;
    
    const grossSalary = calculateGrossSalary(structure);
    let salaryRangeMatch = true;
    
    if (salaryRangeFilter !== "all") {
      switch (salaryRangeFilter) {
        case "0-25000":
          salaryRangeMatch = grossSalary <= 25000;
          break;
        case "25000-50000":
          salaryRangeMatch = grossSalary > 25000 && grossSalary <= 50000;
          break;
        case "50000-100000":
          salaryRangeMatch = grossSalary > 50000 && grossSalary <= 100000;
          break;
        case "100000+":
          salaryRangeMatch = grossSalary > 100000;
          break;
      }
    }
    
    return departmentMatch && salaryRangeMatch;
  });

  const departments = ["operations", "admin", "hr", "marketing", "sales", "technical", "housekeeping"];

  // Summary calculations
  const totalStructures = filteredStructures.length;
  const totalGrossPayroll = filteredStructures.reduce((sum, s) => sum + calculateGrossSalary(s), 0);
  const totalDeductions = filteredStructures.reduce((sum, s) => sum + calculateTotalDeductions(s), 0);
  const averageSalary = totalStructures > 0 ? totalGrossPayroll / totalStructures : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Structures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStructures}</div>
            <p className="text-xs text-muted-foreground">Active salary structures</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gross Payroll</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalGrossPayroll)}</div>
            <p className="text-xs text-muted-foreground">Monthly gross payroll</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalDeductions)}</div>
            <p className="text-xs text-muted-foreground">Monthly deductions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageSalary)}</div>
            <p className="text-xs text-muted-foreground">Average gross salary</p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="department-filter">Filter by Department</Label>
          <Select value={filterDepartment} onValueChange={setFilterDepartment}>
            <SelectTrigger>
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>
                  {dept.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="salary-range-filter">Filter by Salary Range</Label>
          <Select value={salaryRangeFilter} onValueChange={setSalaryRangeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Ranges" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ranges</SelectItem>
              <SelectItem value="0-25000">₹0 - ₹25,000</SelectItem>
              <SelectItem value="25000-50000">₹25,000 - ₹50,000</SelectItem>
              <SelectItem value="50000-100000">₹50,000 - ₹1,00,000</SelectItem>
              <SelectItem value="100000+">₹1,00,000+</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Enhanced Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Employee Details</TableHead>
              <TableHead>Fixed Salary Components</TableHead>
              <TableHead>Day Structure</TableHead>
              <TableHead>Gross & Net</TableHead>
              <TableHead>Statutory</TableHead>
              <TableHead>Configuration</TableHead>
              <TableHead>Status & Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStructures.map((structure) => {
              const structureUser = users.find((u: any) => u.id === structure.userId);
              const customEarningsTotal = Object.values(structure.customEarnings || {}).reduce((sum, val) => sum + val, 0);
              const customDeductionsTotal = Object.values(structure.customDeductions || {}).reduce((sum, val) => sum + val, 0);
              const grossSalary = calculateGrossSalary(structure);
              const totalDeductions = calculateTotalDeductions(structure);
              const netSalary = grossSalary - totalDeductions;
              const isExpanded = expandedRows.has(structure.id);
              
              return (
                <React.Fragment key={structure.id}>
                  <TableRow className="hover:bg-gray-50">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRowExpansion(structure.id)}
                        className="p-1"
                      >
                        {isExpanded ? "−" : "+"}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{structureUser?.displayName}</div>
                        <div className="text-sm text-muted-foreground">{structure.employeeId}</div>
                        <Badge variant="outline" className="text-xs">
                          {structureUser?.department?.toUpperCase() || 'N/A'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>Basic: {formatCurrency(structure.fixedBasic)}</div>
                        <div>HRA: {formatCurrency(structure.fixedHRA)}</div>
                        <div>Conv: {formatCurrency(structure.fixedConveyance)}</div>
                        {customEarningsTotal > 0 && (
                          <div className="text-green-600">+{formatCurrency(customEarningsTotal)}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>Base: {structure.perDaySalaryBase || 'basic'}</div>
                        <div>OT Rate: {structure.overtimeRate || 1.5}x</div>
                        <div className="text-muted-foreground">Per day calculated</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-green-600">{formatCurrency(grossSalary)}</div>
                        <div className="text-sm text-red-600">-{formatCurrency(totalDeductions)}</div>
                        <div className="font-bold border-t pt-1">{formatCurrency(netSalary)}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div className={`px-2 py-1 rounded text-xs ${structure.epfApplicable ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          EPF: {structure.epfApplicable ? "Yes" : "No"}
                        </div>
                        <div className={`px-2 py-1 rounded text-xs ${structure.esiApplicable ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                          ESI: {structure.esiApplicable ? "Yes" : "No"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm">
                        <div>VPT: {formatCurrency(structure.vptAmount || 0)}</div>
                        <div className="text-muted-foreground">
                          Since: {new Date(structure.effectiveFrom).toLocaleDateString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2">
                        <Badge className="text-xs bg-green-100 text-green-800">
                          {structure.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                            <Edit3 className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  
                  {/* Expanded Row Details */}
                  {isExpanded && (
                    <TableRow className="bg-gray-50">
                      <TableCell colSpan={8}>
                        <div className="p-4 space-y-4">
                          <h4 className="font-semibold text-lg">Detailed Salary Breakdown - {structureUser?.displayName}</h4>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Earnings Breakdown */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-green-600">Earnings Components</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span>Fixed Basic:</span>
                                  <span className="font-medium">{formatCurrency(structure.fixedBasic)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Fixed HRA:</span>
                                  <span className="font-medium">{formatCurrency(structure.fixedHRA)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Fixed Conveyance:</span>
                                  <span className="font-medium">{formatCurrency(structure.fixedConveyance)}</span>
                                </div>
                                
                                {Object.keys(structure.customEarnings || {}).length > 0 && (
                                  <>
                                    <div className="border-t pt-2 mt-2">
                                      <div className="text-sm font-medium text-muted-foreground mb-1">Custom Earnings:</div>
                                      {Object.entries(structure.customEarnings || {}).map(([key, value]) => (
                                        <div key={key} className="flex justify-between text-sm">
                                          <span>{key}:</span>
                                          <span>{formatCurrency(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                                
                                <div className="border-t pt-2 flex justify-between font-bold text-green-600">
                                  <span>Gross Earnings:</span>
                                  <span>{formatCurrency(grossSalary)}</span>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Deductions Breakdown */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-red-600">Deductions</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                {structure.epfApplicable && (
                                  <div className="flex justify-between">
                                    <span>EPF (12%):</span>
                                    <span className="font-medium">{formatCurrency(structure.fixedBasic * 0.12)}</span>
                                  </div>
                                )}
                                {structure.esiApplicable && (
                                  <div className="flex justify-between">
                                    <span>ESI (0.75%):</span>
                                    <span className="font-medium">{formatCurrency(grossSalary * 0.0075)}</span>
                                  </div>
                                )}
                                {structure.vptAmount && structure.vptAmount > 0 && (
                                  <div className="flex justify-between">
                                    <span>VPT:</span>
                                    <span className="font-medium">{formatCurrency(structure.vptAmount)}</span>
                                  </div>
                                )}
                                
                                {Object.keys(structure.customDeductions || {}).length > 0 && (
                                  <>
                                    <div className="border-t pt-2 mt-2">
                                      <div className="text-sm font-medium text-muted-foreground mb-1">Custom Deductions:</div>
                                      {Object.entries(structure.customDeductions || {}).map(([key, value]) => (
                                        <div key={key} className="flex justify-between text-sm">
                                          <span>{key}:</span>
                                          <span>{formatCurrency(value)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </>
                                )}
                                
                                <div className="border-t pt-2 flex justify-between font-bold text-red-600">
                                  <span>Total Deductions:</span>
                                  <span>{formatCurrency(totalDeductions)}</span>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Configuration Details */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-sm text-blue-600">Configuration</CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-2">
                                <div className="flex justify-between">
                                  <span>Per Day Base:</span>
                                  <span className="font-medium capitalize">{structure.perDaySalaryBase || 'basic'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Overtime Rate:</span>
                                  <span className="font-medium">{structure.overtimeRate || 1.5}x</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>EPF Applicable:</span>
                                  <Badge className={structure.epfApplicable ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                                    {structure.epfApplicable ? "Yes" : "No"}
                                  </Badge>
                                </div>
                                <div className="flex justify-between">
                                  <span>ESI Applicable:</span>
                                  <Badge className={structure.esiApplicable ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}>
                                    {structure.esiApplicable ? "Yes" : "No"}
                                  </Badge>
                                </div>
                                <div className="flex justify-between">
                                  <span>Status:</span>
                                  <Badge className={structure.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                                    {structure.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </div>
                                <div className="border-t pt-2 flex justify-between font-bold text-blue-600">
                                  <span>Net Salary:</span>
                                  <span>{formatCurrency(netSalary)}</span>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {filteredStructures.length === 0 && (
        <div className="text-center py-8">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No salary structures found</h3>
          <p className="text-muted-foreground">
            {structures.length === 0 
              ? "Create salary structures to see data here."
              : "No structures match the selected filters."
            }
          </p>
        </div>
      )}
    </div>
  );
}

// Field Configuration Table Component
function FieldConfigTable({ fieldConfigs }: { fieldConfigs: PayrollFieldConfig[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Field Name</TableHead>
            <TableHead>Display Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Data Type</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Required</TableHead>
            <TableHead>System Field</TableHead>
            <TableHead>Sort Order</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fieldConfigs.map((field) => (
            <TableRow key={field.id}>
              <TableCell className="font-medium">{field.name}</TableCell>
              <TableCell>{field.displayName}</TableCell>
              <TableCell>
                <Badge variant={field.category === "earnings" ? "default" : "secondary"}>
                  {field.category}
                </Badge>
              </TableCell>
              <TableCell>{field.dataType}</TableCell>
              <TableCell>{field.department?.toUpperCase() || "All"}</TableCell>
              <TableCell>{field.isRequired ? "Yes" : "No"}</TableCell>
              <TableCell>{field.isSystemField ? "Yes" : "No"}</TableCell>
              <TableCell>{field.sortOrder}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={field.isSystemField}>
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// Field Configuration Form Component
function FieldConfigForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    category: "earnings" as "earnings" | "deductions",
    dataType: "number" as "number" | "percentage" | "boolean" | "text",
    isRequired: false,
    defaultValue: 0,
    department: "",
    sortOrder: 1
  });

  const departments = ["operations", "admin", "hr", "marketing", "sales", "technical", "housekeeping"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      isSystemField: false,
      isActive: true
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Field Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="field_name"
            required
          />
        </div>
        <div>
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="Field Display Name"
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category} onValueChange={(value: "earnings" | "deductions") => 
            setFormData({ ...formData, category: value })
          }>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="earnings">Earnings</SelectItem>
              <SelectItem value="deductions">Deductions</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="dataType">Data Type</Label>
          <Select value={formData.dataType} onValueChange={(value: "number" | "percentage" | "boolean" | "text") => 
            setFormData({ ...formData, dataType: value })
          }>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="number">Number</SelectItem>
              <SelectItem value="percentage">Percentage</SelectItem>
              <SelectItem value="boolean">Boolean</SelectItem>
              <SelectItem value="text">Text</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="department">Department</Label>
          <Select value={formData.department} onValueChange={(value) => 
            setFormData({ ...formData, department: value })
          }>
            <SelectTrigger>
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(dept => (
                <SelectItem key={dept} value={dept}>
                  {dept.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="defaultValue">Default Value</Label>
          <Input
            id="defaultValue"
            type="number"
            value={formData.defaultValue}
            onChange={(e) => setFormData({ ...formData, defaultValue: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label htmlFor="sortOrder">Sort Order</Label>
          <Input
            id="sortOrder"
            type="number"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 1 })}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isRequired"
          checked={formData.isRequired}
          onCheckedChange={(checked) => setFormData({ ...formData, isRequired: !!checked })}
        />
        <Label htmlFor="isRequired">Required Field</Label>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">Create Field</Button>
      </div>
    </form>
  );
}

// Salary Structure Form Component
function SalaryStructureForm({ 
  users, 
  earningsFields, 
  deductionsFields, 
  onSubmit 
}: {
  users: User[];
  earningsFields: PayrollFieldConfig[];
  deductionsFields: PayrollFieldConfig[];
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    // Employee Information
    userId: "",
    employeeId: "",
    designation: "",
    department: "",
    dateOfJoining: "",
    
    // Fixed Salary Components (Monthly)
    fixedSalary: 0,
    fixedBasic: 0,
    fixedHRA: 0,
    fixedConveyance: 0,
    
    // Day Structure
    monthDays: 30,
    perDaySalary: 0,
    workingDays: 30,
    monthWorkingHours: 0,
    perDayWorkingHours: 8,
    overtimeRate: 1.5,
    
    // Earnings
    earnedBasic: 0,
    earnedHRA: 0,
    earnedConveyance: 0,
    otherEarnings: 0,
    grossSalary: 0,
    overtimePay: 0,
    
    // Deductions
    epfDeduction: 0,
    esiDeduction: 0,
    vptDeduction: 0,
    tdsDeduction: 0,
    loanDeduction: 0,
    advanceDeduction: 0,
    fineDeduction: 0,
    creditDeduction: 0,
    totalDeductions: 0,
    
    // Final Salary
    netSalary: 0,
    
    // Configuration
    perDaySalaryBase: "basic_hra" as "basic" | "basic_hra" | "gross",
    epfApplicable: true,
    esiApplicable: true,
    autoCalculate: true,
    effectiveFrom: new Date().toISOString().split('T')[0],
    
    // Custom fields
    customEarnings: {} as Record<string, number>,
    customDeductions: {} as Record<string, number>,
    
    // Remarks
    remarks: ""
  });

  const selectedUser = users.find(u => u.id === formData.userId);

  // Auto-calculation when values change
  React.useEffect(() => {
    if (formData.autoCalculate) {
      calculateSalary();
    }
  }, [
    formData.fixedSalary,
    formData.fixedBasic,
    formData.fixedHRA,
    formData.fixedConveyance,
    formData.monthDays,
    formData.workingDays,
    formData.overtimePay,
    formData.epfApplicable,
    formData.esiApplicable,
    formData.autoCalculate
  ]);

  const calculateSalary = () => {
    const gross = formData.fixedBasic + formData.fixedHRA + formData.fixedConveyance + formData.otherEarnings;
    const perDay = gross / formData.monthDays;
    const earnedBasic = (formData.fixedBasic / formData.monthDays) * formData.workingDays;
    const earnedHRA = (formData.fixedHRA / formData.monthDays) * formData.workingDays;
    const earnedConveyance = (formData.fixedConveyance / formData.monthDays) * formData.workingDays;
    
    // Statutory deductions
    let epf = 0, esi = 0;
    if (formData.epfApplicable && gross <= 15000) {
      epf = Math.min(gross * 0.12, 1800); // 12% capped at 15000 salary
    }
    if (formData.esiApplicable && gross <= 21000) {
      esi = gross * 0.0075; // 0.75%
    }
    
    const totalDeductions = epf + esi + formData.vptDeduction + formData.tdsDeduction + 
                           formData.loanDeduction + formData.advanceDeduction + 
                           formData.fineDeduction + formData.creditDeduction;
    
    const totalEarnings = earnedBasic + earnedHRA + earnedConveyance + formData.otherEarnings + formData.overtimePay;
    const netSalary = totalEarnings - totalDeductions;

    setFormData(prev => ({
      ...prev,
      perDaySalary: Math.round(perDay),
      earnedBasic: Math.round(earnedBasic),
      earnedHRA: Math.round(earnedHRA),
      earnedConveyance: Math.round(earnedConveyance),
      grossSalary: Math.round(gross),
      epfDeduction: Math.round(epf),
      esiDeduction: Math.round(esi),
      totalDeductions: Math.round(totalDeductions),
      netSalary: Math.round(netSalary)
    }));
  };

  const handleUserChange = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user) {
      setFormData(prev => ({
        ...prev,
        userId,
        employeeId: user.employeeId || user.uid || "",
        designation: user.designation || "",
        department: user.department || ""
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      employeeId: selectedUser?.employeeId || selectedUser?.uid || "",
      effectiveFrom: new Date(formData.effectiveFrom),
      isActive: true
    });
  };



  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-h-[80vh] overflow-y-auto">
      {/* Employee Information */}
      <div className="bg-gray-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-5 w-5" />
          Employee Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="userId">Employee ({users?.length || 0} available)</Label>
            <Select value={formData.userId} onValueChange={handleUserChange}>
              <SelectTrigger>
                <SelectValue placeholder={users?.length > 0 ? "Select Employee" : "Loading employees..."} />
              </SelectTrigger>
              <SelectContent>
                {users?.length > 0 ? (
                  users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.displayName || user.email} ({user.department?.toUpperCase() || 'N/A'})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-users" disabled>
                    No employees found
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              value={formData.designation}
              onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
              placeholder="Auto-filled from user"
              readOnly
            />
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={formData.department}
              onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
              placeholder="Auto-filled from user"
              readOnly
            />
          </div>
          <div>
            <Label htmlFor="effectiveFrom">Effective From</Label>
            <Input
              id="effectiveFrom"
              type="date"
              value={formData.effectiveFrom}
              onChange={(e) => setFormData(prev => ({ ...prev, effectiveFrom: e.target.value }))}
              required
            />
          </div>
        </div>
      </div>

      {/* Fixed Salary Structure */}
      <div className="bg-green-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Fixed Salary Structure (Monthly)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="fixedSalary">Fixed Salary</Label>
            <Input
              id="fixedSalary"
              type="number"
              value={formData.fixedSalary}
              onChange={(e) => setFormData(prev => ({ ...prev, fixedSalary: parseFloat(e.target.value) || 0 }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="fixedBasic">Fixed Basic</Label>
            <Input
              id="fixedBasic"
              type="number"
              value={formData.fixedBasic}
              onChange={(e) => setFormData(prev => ({ ...prev, fixedBasic: parseFloat(e.target.value) || 0 }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="fixedHRA">Fixed HRA</Label>
            <Input
              id="fixedHRA"
              type="number"
              value={formData.fixedHRA}
              onChange={(e) => setFormData(prev => ({ ...prev, fixedHRA: parseFloat(e.target.value) || 0 }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="fixedConveyance">Fixed Conveyance</Label>
            <Input
              id="fixedConveyance"
              type="number"
              value={formData.fixedConveyance}
              onChange={(e) => setFormData(prev => ({ ...prev, fixedConveyance: parseFloat(e.target.value) || 0 }))}
              required
            />
          </div>
        </div>
      </div>

      {/* Day Structure */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Day Structure & Working Hours
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="monthDays">Month Days <span className="text-sm text-gray-500">(Auto-calculated)</span></Label>
            <Input
              id="monthDays"
              type="number"
              value={formData.monthDays}
              readOnly
              className="bg-blue-50 border-blue-200"
              title="Automatically calculated based on selected month/year"
            />
          </div>
          <div>
            <Label htmlFor="perDaySalary">Per Day Salary</Label>
            <Input
              id="perDaySalary"
              type="number"
              value={formData.perDaySalary}
              readOnly
              className="bg-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="perDayWorkingHours">Per Day Hours</Label>
            <Input
              id="perDayWorkingHours"
              type="number"
              value={formData.perDayWorkingHours}
              onChange={(e) => setFormData(prev => ({ ...prev, perDayWorkingHours: parseFloat(e.target.value) || 8 }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="overtimeRate">OT Rate (x)</Label>
            <Input
              id="overtimeRate"
              type="number"
              step="0.1"
              value={formData.overtimeRate}
              onChange={(e) => setFormData(prev => ({ ...prev, overtimeRate: parseFloat(e.target.value) || 1.5 }))}
            />
          </div>
        </div>
      </div>

      {/* Earnings */}
      <div className="bg-yellow-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Earned Salary & Overtime
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <div>
            <Label htmlFor="earnedBasic">Earned Basic</Label>
            <Input
              id="earnedBasic"
              type="number"
              value={formData.earnedBasic}
              readOnly
              className="bg-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="earnedHRA">Earned HRA</Label>
            <Input
              id="earnedHRA"
              type="number"
              value={formData.earnedHRA}
              readOnly
              className="bg-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="earnedConveyance">Earned Conveyance</Label>
            <Input
              id="earnedConveyance"
              type="number"
              value={formData.earnedConveyance}
              readOnly
              className="bg-gray-100"
            />
          </div>
          <div>
            <Label htmlFor="otherEarnings">Other Earnings</Label>
            <Input
              id="otherEarnings"
              type="number"
              value={formData.otherEarnings}
              onChange={(e) => setFormData(prev => ({ ...prev, otherEarnings: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label htmlFor="overtimePay">Overtime Pay</Label>
            <Input
              id="overtimePay"
              type="number"
              value={formData.overtimePay}
              onChange={(e) => setFormData(prev => ({ ...prev, overtimePay: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label htmlFor="grossSalary">Gross Salary</Label>
            <Input
              id="grossSalary"
              type="number"
              value={formData.grossSalary}
              readOnly
              className="bg-gray-100 font-bold"
            />
          </div>
        </div>
      </div>

      {/* Deductions */}
      <div className="bg-red-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Deductions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <Label htmlFor="epfDeduction">EPF</Label>
            <Input
              id="epfDeduction"
              type="number"
              value={formData.epfDeduction}
              onChange={(e) => setFormData(prev => ({ ...prev, epfDeduction: parseFloat(e.target.value) || 0 }))}
              readOnly={formData.autoCalculate}
              className={formData.autoCalculate ? "bg-gray-100" : ""}
            />
          </div>
          <div>
            <Label htmlFor="esiDeduction">ESI</Label>
            <Input
              id="esiDeduction"
              type="number"
              value={formData.esiDeduction}
              onChange={(e) => setFormData(prev => ({ ...prev, esiDeduction: parseFloat(e.target.value) || 0 }))}
              readOnly={formData.autoCalculate}
              className={formData.autoCalculate ? "bg-gray-100" : ""}
            />
          </div>
          <div>
            <Label htmlFor="vptDeduction">VPT</Label>
            <Input
              id="vptDeduction"
              type="number"
              value={formData.vptDeduction}
              onChange={(e) => setFormData(prev => ({ ...prev, vptDeduction: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label htmlFor="tdsDeduction">TDS</Label>
            <Input
              id="tdsDeduction"
              type="number"
              value={formData.tdsDeduction}
              onChange={(e) => setFormData(prev => ({ ...prev, tdsDeduction: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label htmlFor="loanDeduction">Loan</Label>
            <Input
              id="loanDeduction"
              type="number"
              value={formData.loanDeduction}
              onChange={(e) => setFormData(prev => ({ ...prev, loanDeduction: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label htmlFor="advanceDeduction">Advance</Label>
            <Input
              id="advanceDeduction"
              type="number"
              value={formData.advanceDeduction}
              onChange={(e) => setFormData(prev => ({ ...prev, advanceDeduction: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label htmlFor="fineDeduction">Fine</Label>
            <Input
              id="fineDeduction"
              type="number"
              value={formData.fineDeduction}
              onChange={(e) => setFormData(prev => ({ ...prev, fineDeduction: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label htmlFor="creditDeduction">Credit</Label>
            <Input
              id="creditDeduction"
              type="number"
              value={formData.creditDeduction}
              onChange={(e) => setFormData(prev => ({ ...prev, creditDeduction: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <Label htmlFor="totalDeductions">Total Deductions</Label>
            <Input
              id="totalDeductions"
              type="number"
              value={formData.totalDeductions}
              readOnly
              className="bg-gray-100 font-bold"
            />
          </div>
        </div>
      </div>

      {/* Configuration & Controls */}
      <div className="bg-purple-50 p-6 rounded-lg">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuration & Final Salary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div>
            <Label htmlFor="perDaySalaryBase">Per Day Salary Base</Label>
            <Select value={formData.perDaySalaryBase} onValueChange={(value: "basic" | "basic_hra" | "gross") => 
              setFormData(prev => ({ ...prev, perDaySalaryBase: value }))
            }>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="basic">Basic Only</SelectItem>
                <SelectItem value="basic_hra">Basic + HRA</SelectItem>
                <SelectItem value="gross">Gross Salary</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="epfApplicable"
              checked={formData.epfApplicable}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, epfApplicable: !!checked }))}
            />
            <Label htmlFor="epfApplicable">EPF Applicable</Label>
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="esiApplicable"
              checked={formData.esiApplicable}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, esiApplicable: !!checked }))}
            />
            <Label htmlFor="esiApplicable">ESI Applicable</Label>
          </div>
          <div className="flex items-center space-x-2 pt-6">
            <Checkbox
              id="autoCalculate"
              checked={formData.autoCalculate}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoCalculate: !!checked }))}
            />
            <Label htmlFor="autoCalculate">Auto Calculate</Label>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="netSalary">Net Salary</Label>
            <Input
              id="netSalary"
              type="number"
              value={formData.netSalary}
              readOnly
              className="bg-green-100 font-bold text-lg"
            />
          </div>
          <div>
            <Label htmlFor="remarks">Remarks</Label>
            <Input
              id="remarks"
              value={formData.remarks}
              onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
              placeholder="Additional notes or comments"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-6 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={calculateSalary}
          className="flex items-center gap-2"
        >
          <Calculator className="h-4 w-4" />
          Recalculate
        </Button>
        <div className="flex gap-2">
          <Button type="submit" size="lg" className="bg-primary hover:bg-primary-dark">
            <CheckCircle className="h-4 w-4 mr-2" />
            Create Salary Structure
          </Button>
        </div>
      </div>
    </form>
  );
}

// Payroll Settings Form Component
function PayrollSettingsForm({ 
  settings, 
  onSubmit 
}: {
  settings?: EnhancedPayrollSettings;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    epfEmployeeRate: settings?.epfEmployeeRate || 12,
    epfEmployerRate: settings?.epfEmployerRate || 12,
    esiEmployeeRate: settings?.esiEmployeeRate || 0.75,
    esiEmployerRate: settings?.esiEmployerRate || 3.25,
    epfCeiling: settings?.epfCeiling || 15000,
    esiThreshold: settings?.esiThreshold || 21000,
    tdsThreshold: settings?.tdsThreshold || 250000,
    standardWorkingDays: settings?.standardWorkingDays || 26,
    standardWorkingHours: settings?.standardWorkingHours || 8,
    overtimeThresholdHours: settings?.overtimeThresholdHours || 8,
    companyName: settings?.companyName || "Prakash Greens Energy",
    companyAddress: settings?.companyAddress || "",
    companyPan: settings?.companyPan || "",
    companyTan: settings?.companyTan || "",
    autoCalculateStatutory: settings?.autoCalculateStatutory || true,
    allowManualOverride: settings?.allowManualOverride || true,
    requireApprovalForProcessing: settings?.requireApprovalForProcessing || false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[500px] overflow-y-auto">
      {/* Statutory Rates */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Statutory Rates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="epfEmployeeRate">EPF Employee Rate (%)</Label>
            <Input
              id="epfEmployeeRate"
              type="number"
              step="0.01"
              value={formData.epfEmployeeRate}
              onChange={(e) => setFormData({ ...formData, epfEmployeeRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="epfEmployerRate">EPF Employer Rate (%)</Label>
            <Input
              id="epfEmployerRate"
              type="number"
              step="0.01"
              value={formData.epfEmployerRate}
              onChange={(e) => setFormData({ ...formData, epfEmployerRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="esiEmployeeRate">ESI Employee Rate (%)</Label>
            <Input
              id="esiEmployeeRate"
              type="number"
              step="0.01"
              value={formData.esiEmployeeRate}
              onChange={(e) => setFormData({ ...formData, esiEmployeeRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="esiEmployerRate">ESI Employer Rate (%)</Label>
            <Input
              id="esiEmployerRate"
              type="number"
              step="0.01"
              value={formData.esiEmployerRate}
              onChange={(e) => setFormData({ ...formData, esiEmployerRate: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      {/* Thresholds */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Thresholds</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="epfCeiling">EPF Ceiling (₹)</Label>
            <Input
              id="epfCeiling"
              type="number"
              value={formData.epfCeiling}
              onChange={(e) => setFormData({ ...formData, epfCeiling: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="esiThreshold">ESI Threshold (₹)</Label>
            <Input
              id="esiThreshold"
              type="number"
              value={formData.esiThreshold}
              onChange={(e) => setFormData({ ...formData, esiThreshold: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="tdsThreshold">TDS Threshold (₹)</Label>
            <Input
              id="tdsThreshold"
              type="number"
              value={formData.tdsThreshold}
              onChange={(e) => setFormData({ ...formData, tdsThreshold: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      {/* Working Hours */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Working Hours</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="standardWorkingDays">Standard Working Days</Label>
            <Input
              id="standardWorkingDays"
              type="number"
              value={formData.standardWorkingDays}
              onChange={(e) => setFormData({ ...formData, standardWorkingDays: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="standardWorkingHours">Standard Working Hours</Label>
            <Input
              id="standardWorkingHours"
              type="number"
              value={formData.standardWorkingHours}
              onChange={(e) => setFormData({ ...formData, standardWorkingHours: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <Label htmlFor="overtimeThresholdHours">Overtime Threshold Hours</Label>
            <Input
              id="overtimeThresholdHours"
              type="number"
              value={formData.overtimeThresholdHours}
              onChange={(e) => setFormData({ ...formData, overtimeThresholdHours: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      {/* Company Information */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Company Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="companyAddress">Company Address</Label>
            <Input
              id="companyAddress"
              value={formData.companyAddress}
              onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="companyPan">Company PAN</Label>
            <Input
              id="companyPan"
              value={formData.companyPan}
              onChange={(e) => setFormData({ ...formData, companyPan: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="companyTan">Company TAN</Label>
            <Input
              id="companyTan"
              value={formData.companyTan}
              onChange={(e) => setFormData({ ...formData, companyTan: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Configuration Options */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Configuration</h3>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="autoCalculateStatutory"
              checked={formData.autoCalculateStatutory}
              onCheckedChange={(checked) => setFormData({ ...formData, autoCalculateStatutory: checked === true })}
            />
            <Label htmlFor="autoCalculateStatutory">Auto Calculate Statutory Deductions</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="allowManualOverride"
              checked={formData.allowManualOverride}
              onCheckedChange={(checked) => setFormData({ ...formData, allowManualOverride: checked === true })}
            />
            <Label htmlFor="allowManualOverride">Allow Manual Override</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="requireApprovalForProcessing"
              checked={formData.requireApprovalForProcessing}
              onCheckedChange={(checked) => setFormData({ ...formData, requireApprovalForProcessing: !!checked })}
            />
            <Label htmlFor="requireApprovalForProcessing">Require Approval for Processing</Label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">Update Settings</Button>
      </div>
    </form>
  );
}