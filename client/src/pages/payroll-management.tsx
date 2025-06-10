import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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

  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const token = await user?.firebaseUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  };

  // API Queries
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await fetch('/api/users', {
        headers: await getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      return data.filter((user: any) => user.role !== "master_admin");
    },
    enabled: !!user?.firebaseUser
  });

  const { data: fieldConfigs = [] } = useQuery<PayrollFieldConfig[]>({
    queryKey: ["/api/payroll/field-configs"],
    queryFn: async () => {
      const response = await fetch('/api/payroll/field-configs', {
        headers: await getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch field configs');
      return response.json();
    },
    enabled: !!user?.firebaseUser
  });

  const { data: payrolls = [] } = useQuery<EnhancedPayroll[]>({
    queryKey: ["/api/enhanced-payrolls", selectedMonth, selectedYear, selectedDepartment],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("month", selectedMonth.toString());
      params.append("year", selectedYear.toString());
      if (selectedDepartment && selectedDepartment !== "all") {
        params.append("department", selectedDepartment);
      }
      
      const response = await fetch(`/api/enhanced-payrolls?${params}`, {
        headers: await getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch payrolls');
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user?.firebaseUser
  });

  const { data: salaryStructures = [] } = useQuery<EnhancedSalaryStructure[]>({
    queryKey: ["/api/enhanced-salary-structures"],
    queryFn: async () => {
      const response = await fetch('/api/enhanced-salary-structures', {
        headers: await getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch salary structures');
      return response.json();
    },
    enabled: !!user?.firebaseUser
  });

  const { data: settings } = useQuery<EnhancedPayrollSettings>({
    queryKey: ["/api/enhanced-payroll-settings"],
    queryFn: async () => {
      const response = await fetch('/api/enhanced-payroll-settings', {
        headers: await getAuthHeaders()
      });
      if (!response.ok) throw new Error('Failed to fetch payroll settings');
      return response.json();
    },
    enabled: !!user?.firebaseUser
  });

  // Mutations
  const createFieldConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/payroll/field-configs", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create field config');
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
      const response = await fetch("/api/enhanced-salary-structures", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create salary structure');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-salary-structures"] });
      setIsSalaryStructureDialogOpen(false);
      toast({ title: "Salary structure created successfully" });
    }
  });

  const bulkProcessPayrollMutation = useMutation({
    mutationFn: async (data: { month: number; year: number; userIds?: string[] }) => {
      const response = await fetch("/api/enhanced-payrolls/bulk-process", {
        method: "POST",
        headers: await getAuthHeaders(),
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to process payroll');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/enhanced-payrolls"] });
      toast({ 
        title: "Bulk processing completed", 
        description: `Processed ${data.payrolls?.length || 0} payrolls successfully` 
      });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/enhanced-payroll-settings", {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update settings');
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

  const departments = ["cre", "operations", "accounts", "hr", "it", "sales"];

  // Get earnings and deductions field configs
  const earningsFields = fieldConfigs.filter(field => field.category === "earnings" && field.isActive);
  const deductionsFields = fieldConfigs.filter(field => field.category === "deductions" && field.isActive);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Enhanced Payroll Management</h1>
          <p className="text-muted-foreground">
            Comprehensive payroll processing with flexible salary components
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
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
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Field
              </Button>
            </DialogTrigger>
            <DialogContent>
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
              <Button variant="outline" size="sm">
                <DollarSign className="h-4 w-4 mr-2" />
                Salary Structure
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Create Salary Structure</DialogTitle>
                <DialogDescription>
                  Define salary components for an employee
                </DialogDescription>
              </DialogHeader>
              <SalaryStructureForm 
                users={users}
                earningsFields={earningsFields}
                deductionsFields={deductionsFields}
                onSubmit={(data) => createSalaryStructureMutation.mutate(data)} 
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Payroll Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="month">Month</Label>
              <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                <SelectTrigger>
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

            <div>
              <Label htmlFor="year">Year</Label>
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                <SelectTrigger>
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

            <div>
              <Label htmlFor="department">Department</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
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

            <div className="flex items-end">
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payrolls.length}</div>
            <p className="text-xs text-muted-foreground">
              {monthNames[selectedMonth - 1]} {selectedYear}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gross</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(payrolls.reduce((sum, p) => sum + p.totalEarnings, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Gross earnings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(payrolls.reduce((sum, p) => sum + p.totalDeductions, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Total deductions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Payable</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(payrolls.reduce((sum, p) => sum + p.netSalary, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Final payable amount
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="payroll" className="space-y-4">
        <TabsList>
          <TabsTrigger value="payroll">Payroll Processing</TabsTrigger>
          <TabsTrigger value="structures">Salary Structures</TabsTrigger>
          <TabsTrigger value="fields">Field Configuration</TabsTrigger>
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

// Payroll Table Component
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
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Basic</TableHead>
            <TableHead>HRA</TableHead>
            <TableHead>Conveyance</TableHead>
            {earningsFields.filter(f => !f.isSystemField).map(field => (
              <TableHead key={field.id}>{field.displayName}</TableHead>
            ))}
            <TableHead>Gross Earnings</TableHead>
            <TableHead>EPF</TableHead>
            <TableHead>ESI</TableHead>
            {deductionsFields.filter(f => !f.isSystemField).map(field => (
              <TableHead key={field.id}>{field.displayName}</TableHead>
            ))}
            <TableHead>Total Deductions</TableHead>
            <TableHead>Net Salary</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payrolls.map((payroll) => {
            const payrollUser = users.find((u: any) => u.id === payroll.userId);
            return (
              <TableRow key={payroll.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{payrollUser?.displayName}</div>
                    <div className="text-sm text-muted-foreground">{payroll.employeeId}</div>
                  </div>
                </TableCell>
                <TableCell>{payrollUser?.department?.toUpperCase()}</TableCell>
                <TableCell>{formatCurrency(payroll.earnedBasic)}</TableCell>
                <TableCell>{formatCurrency(payroll.earnedHRA)}</TableCell>
                <TableCell>{formatCurrency(payroll.earnedConveyance)}</TableCell>
                {earningsFields.filter(f => !f.isSystemField).map(field => (
                  <TableCell key={field.id}>
                    {formatCurrency(payroll.dynamicEarnings[field.name] || 0)}
                  </TableCell>
                ))}
                <TableCell className="font-medium">{formatCurrency(payroll.totalEarnings)}</TableCell>
                <TableCell>{formatCurrency(payroll.epfDeduction)}</TableCell>
                <TableCell>{formatCurrency(payroll.esiDeduction)}</TableCell>
                {deductionsFields.filter(f => !f.isSystemField).map(field => (
                  <TableCell key={field.id}>
                    {formatCurrency(payroll.dynamicDeductions[field.name] || 0)}
                  </TableCell>
                ))}
                <TableCell>{formatCurrency(payroll.totalDeductions)}</TableCell>
                <TableCell className="font-medium">{formatCurrency(payroll.netSalary)}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(payroll.status)}>
                    {payroll.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(payroll.id)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// Salary Structures Table Component  
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
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Basic</TableHead>
            <TableHead>HRA</TableHead>
            <TableHead>Conveyance</TableHead>
            <TableHead>Custom Earnings</TableHead>
            <TableHead>Custom Deductions</TableHead>
            <TableHead>EPF/ESI</TableHead>
            <TableHead>Effective From</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {structures.map((structure) => {
            const structureUser = users.find((u: any) => u.id === structure.userId);
            const customEarningsTotal = Object.values(structure.customEarnings).reduce((sum, val) => sum + val, 0);
            const customDeductionsTotal = Object.values(structure.customDeductions).reduce((sum, val) => sum + val, 0);
            
            return (
              <TableRow key={structure.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{structureUser?.displayName}</div>
                    <div className="text-sm text-muted-foreground">{structure.employeeId}</div>
                  </div>
                </TableCell>
                <TableCell>{structureUser?.department?.toUpperCase()}</TableCell>
                <TableCell>{formatCurrency(structure.fixedBasic)}</TableCell>
                <TableCell>{formatCurrency(structure.fixedHRA)}</TableCell>
                <TableCell>{formatCurrency(structure.fixedConveyance)}</TableCell>
                <TableCell>{formatCurrency(customEarningsTotal)}</TableCell>
                <TableCell>{formatCurrency(customDeductionsTotal)}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div>EPF: {structure.epfApplicable ? "Yes" : "No"}</div>
                    <div>ESI: {structure.esiApplicable ? "Yes" : "No"}</div>
                  </div>
                </TableCell>
                <TableCell>{new Date(structure.effectiveFrom).toLocaleDateString()}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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

  const departments = ["cre", "operations", "accounts", "hr", "it", "sales"];

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
              <SelectItem value="">All Departments</SelectItem>
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
    userId: "",
    employeeId: "",
    fixedBasic: 0,
    fixedHRA: 0,
    fixedConveyance: 0,
    customEarnings: {} as Record<string, number>,
    customDeductions: {} as Record<string, number>,
    perDaySalaryBase: "basic_hra" as "basic" | "basic_hra" | "gross",
    overtimeRate: 1.5,
    epfApplicable: true,
    esiApplicable: true,
    vptAmount: 0,
    effectiveFrom: new Date().toISOString().split('T')[0]
  });

  const selectedUser = users.find(u => u.id === formData.userId);

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
    <form onSubmit={handleSubmit} className="space-y-6 max-h-[600px] overflow-y-auto">
      {/* Employee Selection */}
      <div>
        <Label htmlFor="userId">Employee</Label>
        <Select value={formData.userId} onValueChange={(value) => 
          setFormData({ ...formData, userId: value })
        }>
          <SelectTrigger>
            <SelectValue placeholder="Select Employee" />
          </SelectTrigger>
          <SelectContent>
            {users.map(user => (
              <SelectItem key={user.id} value={user.id}>
                {user.displayName} ({user.department?.toUpperCase()})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fixed Components */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Fixed Salary Components</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="fixedBasic">Fixed Basic</Label>
            <Input
              id="fixedBasic"
              type="number"
              value={formData.fixedBasic}
              onChange={(e) => setFormData({ ...formData, fixedBasic: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          <div>
            <Label htmlFor="fixedHRA">Fixed HRA</Label>
            <Input
              id="fixedHRA"
              type="number"
              value={formData.fixedHRA}
              onChange={(e) => setFormData({ ...formData, fixedHRA: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
          <div>
            <Label htmlFor="fixedConveyance">Fixed Conveyance</Label>
            <Input
              id="fixedConveyance"
              type="number"
              value={formData.fixedConveyance}
              onChange={(e) => setFormData({ ...formData, fixedConveyance: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>
        </div>
      </div>

      {/* Custom Earnings */}
      {earningsFields.filter(f => !f.isSystemField).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Custom Earnings</h3>
          <div className="grid grid-cols-2 gap-4">
            {earningsFields.filter(f => !f.isSystemField).map(field => (
              <div key={field.id}>
                <Label htmlFor={field.name}>{field.displayName}</Label>
                <Input
                  id={field.name}
                  type="number"
                  value={formData.customEarnings[field.name] || field.defaultValue || 0}
                  onChange={(e) => setFormData({
                    ...formData,
                    customEarnings: {
                      ...formData.customEarnings,
                      [field.name]: parseFloat(e.target.value) || 0
                    }
                  })}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Deductions */}
      {deductionsFields.filter(f => !f.isSystemField).length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Custom Deductions</h3>
          <div className="grid grid-cols-2 gap-4">
            {deductionsFields.filter(f => !f.isSystemField).map(field => (
              <div key={field.id}>
                <Label htmlFor={field.name}>{field.displayName}</Label>
                <Input
                  id={field.name}
                  type="number"
                  value={formData.customDeductions[field.name] || field.defaultValue || 0}
                  onChange={(e) => setFormData({
                    ...formData,
                    customDeductions: {
                      ...formData.customDeductions,
                      [field.name]: parseFloat(e.target.value) || 0
                    }
                  })}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Configuration</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="perDaySalaryBase">Per Day Salary Base</Label>
            <Select value={formData.perDaySalaryBase} onValueChange={(value: "basic" | "basic_hra" | "gross") => 
              setFormData({ ...formData, perDaySalaryBase: value })
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
          <div>
            <Label htmlFor="overtimeRate">Overtime Rate</Label>
            <Input
              id="overtimeRate"
              type="number"
              step="0.1"
              value={formData.overtimeRate}
              onChange={(e) => setFormData({ ...formData, overtimeRate: parseFloat(e.target.value) || 1.5 })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="epfApplicable"
              checked={formData.epfApplicable}
              onCheckedChange={(checked) => setFormData({ ...formData, epfApplicable: checked === true })}
            />
            <Label htmlFor="epfApplicable">EPF Applicable</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="esiApplicable"
              checked={formData.esiApplicable}
              onCheckedChange={(checked) => setFormData({ ...formData, esiApplicable: checked === true })}
            />
            <Label htmlFor="esiApplicable">ESI Applicable</Label>
          </div>
          <div>
            <Label htmlFor="effectiveFrom">Effective From</Label>
            <Input
              id="effectiveFrom"
              type="date"
              value={formData.effectiveFrom}
              onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
              required
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">Create Salary Structure</Button>
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