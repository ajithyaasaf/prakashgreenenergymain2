import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { 
  Calculator, DollarSign, FileText, Download, Upload, Settings, 
  Users, Plus, Edit, Trash2, Eye, CheckCircle, XCircle, 
  AlertCircle, TrendingUp, PieChart, BarChart3, Calendar
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SalaryStructure {
  id: string;
  userId: string;
  employeeId: string;
  fixedSalary: number;
  basicSalary: number;
  hra: number;
  allowances: number;
  variableComponent: number;
  effectiveFrom: Date;
  isActive: boolean;
}

interface PayrollRecord {
  id: string;
  userId: string;
  employeeId: string;
  month: number;
  year: number;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  overtimeHours: number;
  leaveDays: number;
  fixedSalary: number;
  basicSalary: number;
  hra: number;
  allowances: number;
  variableComponent: number;
  overtimePay: number;
  grossSalary: number;
  pfDeduction: number;
  esiDeduction: number;
  tdsDeduction: number;
  advanceDeduction: number;
  totalDeductions: number;
  netSalary: number;
  status: "draft" | "pending" | "approved" | "paid" | "cancelled";
  userName?: string;
  userDepartment?: string;
  userDesignation?: string;
}

export default function PayrollManagement() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("overview");
  
  // Modal states
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingSalary, setEditingSalary] = useState<SalaryStructure | null>(null);
  
  // Form states
  const [salaryForm, setSalaryForm] = useState({
    userId: '',
    employeeId: '',
    fixedSalary: 0,
    basicSalary: 0,
    hra: 0,
    allowances: 0,
    variableComponent: 0
  });

  // Fetch payroll data for selected month/year
  const { data: payrollData = [], isLoading: isLoadingPayroll, refetch: refetchPayroll } = useQuery({
    queryKey: ['/api/payroll', { month: selectedMonth, year: selectedYear, department: selectedDepartment }],
    queryFn: async () => {
      const params = new URLSearchParams({
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
        ...(selectedDepartment !== "all" && { department: selectedDepartment })
      });
      
      const response = await fetch(`/api/payroll?${params}`);
      if (!response.ok) throw new Error('Failed to fetch payroll data');
      return response.json();
    },
  });

  // Fetch salary structures
  const { data: salaryStructures = [] } = useQuery({
    queryKey: ['/api/salary-structures'],
    queryFn: async () => {
      const response = await fetch('/api/salary-structures');
      if (!response.ok) throw new Error('Failed to fetch salary structures');
      return response.json();
    },
  });

  // Fetch payroll settings
  const { data: payrollSettings } = useQuery({
    queryKey: ['/api/payroll-settings'],
    queryFn: async () => {
      const response = await fetch('/api/payroll-settings');
      if (!response.ok) throw new Error('Failed to fetch payroll settings');
      return response.json();
    },
  });

  // Fetch payroll statistics
  const { data: payrollStats } = useQuery({
    queryKey: ['/api/payroll/stats', { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const response = await fetch(`/api/payroll/stats?month=${selectedMonth}&year=${selectedYear}`);
      if (!response.ok) throw new Error('Failed to fetch payroll statistics');
      return response.json();
    },
  });

  // Fetch users for salary structure assignment
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Process payroll mutation
  const processPayrollMutation = useMutation({
    mutationFn: async ({ month, year, userIds }: { month: number; year: number; userIds?: string[] }) => {
      return apiRequest('/api/payroll/process', {
        method: 'POST',
        body: JSON.stringify({ month, year, userIds })
      });
    },
    onSuccess: () => {
      refetchPayroll();
      setShowProcessModal(false);
      toast({
        title: "Success",
        description: "Payroll processed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process payroll",
        variant: "destructive",
      });
    },
  });

  // Create/Update salary structure mutation
  const saveSalaryMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editingSalary ? `/api/salary-structures/${editingSalary.id}` : '/api/salary-structures';
      const method = editingSalary ? 'PATCH' : 'POST';
      return apiRequest(url, { method, body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/salary-structures'] });
      setShowSalaryModal(false);
      resetSalaryForm();
      toast({
        title: "Success",
        description: `Salary structure ${editingSalary ? 'updated' : 'created'} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save salary structure",
        variant: "destructive",
      });
    },
  });

  // Approve payroll mutation
  const approvePayrollMutation = useMutation({
    mutationFn: async (payrollIds: string[]) => {
      return apiRequest('/api/payroll/approve', {
        method: 'POST',
        body: JSON.stringify({ payrollIds })
      });
    },
    onSuccess: () => {
      refetchPayroll();
      toast({
        title: "Success",
        description: "Payroll records approved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve payroll",
        variant: "destructive",
      });
    },
  });

  // Generate payslips mutation
  const generatePayslipsMutation = useMutation({
    mutationFn: async (payrollIds: string[]) => {
      return apiRequest('/api/payroll/generate-payslips', {
        method: 'POST',
        body: JSON.stringify({ payrollIds })
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Payslips generated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate payslips",
        variant: "destructive",
      });
    },
  });

  const resetSalaryForm = () => {
    setSalaryForm({
      userId: '',
      employeeId: '',
      fixedSalary: 0,
      basicSalary: 0,
      hra: 0,
      allowances: 0,
      variableComponent: 0
    });
    setEditingSalary(null);
  };

  const handleEditSalaryStructure = (salary: SalaryStructure) => {
    setEditingSalary(salary);
    setSalaryForm({
      userId: salary.userId,
      employeeId: salary.employeeId,
      fixedSalary: salary.fixedSalary,
      basicSalary: salary.basicSalary,
      hra: salary.hra || 0,
      allowances: salary.allowances || 0,
      variableComponent: salary.variableComponent || 0
    });
    setShowSalaryModal(true);
  };

  const handleSaveSalaryStructure = () => {
    if (!salaryForm.userId || !salaryForm.employeeId) {
      toast({
        title: "Validation Error",
        description: "Please select an employee and provide employee ID",
        variant: "destructive",
      });
      return;
    }

    saveSalaryMutation.mutate({
      ...salaryForm,
      effectiveFrom: new Date(),
      createdBy: user?.uid
    });
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: "bg-gray-100 text-gray-800",
      pending: "bg-yellow-100 text-yellow-800",
      approved: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
      cancelled: "bg-red-100 text-red-800"
    };
    
    return (
      <Badge className={cn("font-medium capitalize", styles[status as keyof typeof styles] || "bg-gray-100")}>
        {status}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Check if user is master admin
  if (user?.role !== "master_admin") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Access Denied</h3>
          <p className="text-gray-500">Only master administrators can access payroll management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Payroll Management</h1>
          <p className="text-gray-500">Enterprise payroll processing and management system</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setShowSettingsModal(true)}
            variant="outline"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button 
            onClick={() => setShowSalaryModal(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Salary Structure
          </Button>
          <Button 
            onClick={() => setShowProcessModal(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Period and Department Selection */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4">
              <div>
                <Label htmlFor="month">Month</Label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {new Date(0, i).toLocaleString('en', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="year">Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="department">Department</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="cre">CRE</SelectItem>
                    <SelectItem value="accounts">Accounts</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="sales_and_marketing">Sales & Marketing</SelectItem>
                    <SelectItem value="technical_team">Technical Team</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex space-x-2">
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Payroll
              </Button>
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Generate Reports
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Statistics */}
      {payrollStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Total Employees</p>
                  <p className="text-2xl font-bold">{payrollStats.totalEmployees}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Gross Salary</p>
                  <p className="text-2xl font-bold">{formatCurrency(payrollStats.totalGrossSalary)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Total Deductions</p>
                  <p className="text-2xl font-bold">{formatCurrency(payrollStats.totalDeductions)}</p>
                </div>
                <PieChart className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Net Payable</p>
                  <p className="text-2xl font-bold">{formatCurrency(payrollStats.totalNetSalary)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Payroll Overview</TabsTrigger>
          <TabsTrigger value="salary-structures">Salary Structures</TabsTrigger>
          <TabsTrigger value="advances">Salary Advances</TabsTrigger>
          <TabsTrigger value="reports">Reports & Analytics</TabsTrigger>
        </TabsList>

        {/* Payroll Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Payroll for {new Date(selectedYear, selectedMonth - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}
              </CardTitle>
              <CardDescription>
                Comprehensive payroll data with salary components and deductions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Employee</TableHead>
                      <TableHead>Dept</TableHead>
                      <TableHead>Working Days</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Fixed Salary</TableHead>
                      <TableHead>Basic</TableHead>
                      <TableHead>HRA</TableHead>
                      <TableHead>Allowances</TableHead>
                      <TableHead>OT Pay</TableHead>
                      <TableHead>Gross</TableHead>
                      <TableHead>PF</TableHead>
                      <TableHead>ESI</TableHead>
                      <TableHead>TDS</TableHead>
                      <TableHead>Advance</TableHead>
                      <TableHead>Net Salary</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingPayroll ? (
                      <TableRow>
                        <TableCell colSpan={17} className="text-center py-8">
                          <div className="flex justify-center">
                            Loading payroll data...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : payrollData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={17} className="text-center py-8 text-gray-500">
                          No payroll records found. Process payroll for this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      payrollData.map((record: PayrollRecord) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>{record.userName}</div>
                              <div className="text-xs text-gray-500">{record.employeeId}</div>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize text-xs">
                            {record.userDepartment?.replace('_', ' ') || 'N/A'}
                          </TableCell>
                          <TableCell className="text-center">{record.workingDays}</TableCell>
                          <TableCell className="text-center">{record.presentDays}</TableCell>
                          <TableCell className="text-right">{formatCurrency(record.fixedSalary)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(record.basicSalary)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(record.hra)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(record.allowances)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(record.overtimePay)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(record.grossSalary)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(record.pfDeduction)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(record.esiDeduction)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(record.tdsDeduction)}</TableCell>
                          <TableCell className="text-right text-red-600">{formatCurrency(record.advanceDeduction)}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">{formatCurrency(record.netSalary)}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button size="sm" variant="outline">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <FileText className="h-3 w-3" />
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
        </TabsContent>

        {/* Salary Structures Tab */}
        <TabsContent value="salary-structures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employee Salary Structures</CardTitle>
              <CardDescription>
                Manage salary components for all employees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>Fixed Salary</TableHead>
                      <TableHead>Basic Salary</TableHead>
                      <TableHead>HRA</TableHead>
                      <TableHead>Allowances</TableHead>
                      <TableHead>Variable</TableHead>
                      <TableHead>Effective From</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryStructures.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                          No salary structures found. Add salary structures for employees.
                        </TableCell>
                      </TableRow>
                    ) : (
                      salaryStructures.map((salary: SalaryStructure) => (
                        <TableRow key={salary.id}>
                          <TableCell className="font-medium">
                            {users.find(u => u.id === salary.userId)?.displayName || 'Unknown'}
                          </TableCell>
                          <TableCell>{salary.employeeId}</TableCell>
                          <TableCell className="text-right">{formatCurrency(salary.fixedSalary)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(salary.basicSalary)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(salary.hra || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(salary.allowances || 0)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(salary.variableComponent || 0)}</TableCell>
                          <TableCell>{formatDate(salary.effectiveFrom)}</TableCell>
                          <TableCell>
                            <Badge className={cn("font-medium", salary.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800")}>
                              {salary.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditSalaryStructure(salary)}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="outline">
                                <Trash2 className="h-3 w-3" />
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
        </TabsContent>

        {/* Salary Advances Tab */}
        <TabsContent value="advances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Salary Advances</CardTitle>
              <CardDescription>
                Manage salary advance requests and deductions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <p>Salary advances feature will be implemented here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Reports & Analytics</CardTitle>
              <CardDescription>
                Comprehensive payroll analytics and reporting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                <p>Advanced payroll analytics and reports will be available here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Salary Structure Modal */}
      <Dialog open={showSalaryModal} onOpenChange={setShowSalaryModal}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingSalary ? 'Edit Salary Structure' : 'Add Salary Structure'}
            </DialogTitle>
            <DialogDescription>
              Configure salary components for employee
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employee">Employee</Label>
                <Select value={salaryForm.userId} onValueChange={(value) => {
                  const selectedUser = users.find(u => u.id === value);
                  setSalaryForm({ 
                    ...salaryForm, 
                    userId: value,
                    employeeId: selectedUser?.employeeId || ''
                  });
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.displayName} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={salaryForm.employeeId}
                  onChange={(e) => setSalaryForm({ ...salaryForm, employeeId: e.target.value })}
                  placeholder="Enter employee ID"
                />
              </div>
            </div>
            
            <Separator />
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fixedSalary">Fixed Salary</Label>
                <Input
                  id="fixedSalary"
                  type="number"
                  value={salaryForm.fixedSalary}
                  onChange={(e) => setSalaryForm({ ...salaryForm, fixedSalary: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div>
                <Label htmlFor="basicSalary">Basic Salary</Label>
                <Input
                  id="basicSalary"
                  type="number"
                  value={salaryForm.basicSalary}
                  onChange={(e) => setSalaryForm({ ...salaryForm, basicSalary: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="hra">HRA</Label>
                <Input
                  id="hra"
                  type="number"
                  value={salaryForm.hra}
                  onChange={(e) => setSalaryForm({ ...salaryForm, hra: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div>
                <Label htmlFor="allowances">Allowances</Label>
                <Input
                  id="allowances"
                  type="number"
                  value={salaryForm.allowances}
                  onChange={(e) => setSalaryForm({ ...salaryForm, allowances: parseFloat(e.target.value) || 0 })}
                />
              </div>
              
              <div>
                <Label htmlFor="variableComponent">Variable Component</Label>
                <Input
                  id="variableComponent"
                  type="number"
                  value={salaryForm.variableComponent}
                  onChange={(e) => setSalaryForm({ ...salaryForm, variableComponent: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm font-medium">Total Monthly Salary:</p>
              <p className="text-lg font-bold text-green-600">
                {formatCurrency(
                  salaryForm.fixedSalary + 
                  salaryForm.basicSalary + 
                  salaryForm.hra + 
                  salaryForm.allowances + 
                  salaryForm.variableComponent
                )}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowSalaryModal(false);
              resetSalaryForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSalaryStructure}
              disabled={saveSalaryMutation.isPending}
            >
              {saveSalaryMutation.isPending && <Calculator className="mr-2 h-4 w-4 animate-spin" />}
              Save Structure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Payroll Modal */}
      <Dialog open={showProcessModal} onOpenChange={setShowProcessModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payroll</DialogTitle>
            <DialogDescription>
              Process payroll for {new Date(selectedYear, selectedMonth - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Important</h4>
                  <div className="text-sm text-yellow-700 mt-1">
                    <p>This will process payroll for all employees for the selected period.</p>
                    <p>Ensure attendance data is complete before processing.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => processPayrollMutation.mutate({ month: selectedMonth, year: selectedYear })}
              disabled={processPayrollMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {processPayrollMutation.isPending && <Calculator className="mr-2 h-4 w-4 animate-spin" />}
              Process Payroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}