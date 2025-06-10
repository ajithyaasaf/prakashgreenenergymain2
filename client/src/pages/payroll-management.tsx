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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { 
  Calculator, FileText, Download, Upload, Settings, 
  Users, Plus, Edit, Trash2, Eye, CheckCircle, XCircle, 
  AlertCircle, TrendingUp, PieChart, BarChart3, Calendar,
  IndianRupee, Clock, UserCheck, FileSpreadsheet, Save,
  RefreshCw, Filter, Search, ChevronDown, ChevronUp,
  Briefcase, MapPin, DollarSign
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// Interface matching the salary sheet structure from the image
interface EmployeePayrollData {
  id: string;
  userId: string;
  employeeId: string;
  designation: string;
  department: string;
  dateOfJoining: string;
  
  // Fixed Salary Components
  fixedBasic: number;
  fixedHra: number;
  
  // Days/Hours Data
  monthDays: number;
  presentDays: number;
  paidDays: number;
  perDaySalary: number;
  otHours: number;
  perDayOt: number;
  
  // Variable Components
  betta: number;
  
  // Earned Salary
  earnedBasic: number;
  earnedHra: number;
  grossSalary: number;
  overtimeAmount: number;
  finalGross: number;
  
  // Deductions
  epf: number;
  vpf: number;
  esi: number;
  fine: number;
  credit: number;
  salaryAdvance: number;
  totalDeduction: number;
  
  // Final Amount
  netSalary: number;
  remarks: string;
  
  // Status and Metadata
  month: number;
  year: number;
  status: "draft" | "pending" | "approved" | "paid" | "cancelled";
  processedBy?: string;
  approvedBy?: string;
  userName?: string;
  userEmail?: string;
}

interface SalaryStructure {
  id: string;
  userId: string;
  employeeId: string;
  userName: string;
  designation: string;
  department: string;
  dateOfJoining: string;
  fixedBasic: number;
  fixedHra: number;
  isActive: boolean;
  effectiveFrom: Date;
  createdBy: string;
}

interface PayrollSettings {
  id: string;
  pfRate: number;
  esiRate: number;
  tdsRate: number;
  overtimeMultiplier: number;
  standardWorkingHours: number;
  standardWorkingDays: number;
  pfApplicableFromSalary: number;
  esiApplicableFromSalary: number;
  companyName: string;
  updatedBy: string;
}

export default function PayrollManagement() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Period Selection States
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  
  // View and Filter States
  const [activeTab, setActiveTab] = useState("payroll-sheet");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  
  // Modal States
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [editingSalary, setEditingSalary] = useState<SalaryStructure | null>(null);
  
  // Form States
  const [salaryForm, setSalaryForm] = useState({
    userId: '',
    employeeId: '',
    designation: '',
    department: '',
    dateOfJoining: '',
    fixedBasic: 0,
    fixedHra: 0
  });

  // Processing States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Fetch payroll data for selected month/year
  const { data: payrollData = [], isLoading: isLoadingPayroll, refetch: refetchPayroll } = useQuery({
    queryKey: ['/api/payroll', { month: selectedMonth, year: selectedYear, department: selectedDepartment }],
    queryFn: async () => {
      const params = new URLSearchParams({
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
        ...(selectedDepartment !== "all" && { department: selectedDepartment })
      });
      
      const token = await user?.firebaseUser?.getIdToken();
      const response = await fetch(`/api/payroll?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (!response.ok) throw new Error('Failed to fetch payroll data');
      return response.json();
    },
    enabled: !!user?.firebaseUser
  });

  // Fetch salary structures
  const { data: salaryStructures = [] } = useQuery({
    queryKey: ['/api/salary-structures'],
    queryFn: async () => {
      const token = await user?.firebaseUser?.getIdToken();
      const response = await fetch('/api/salary-structures', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (!response.ok) throw new Error('Failed to fetch salary structures');
      return response.json();
    },
    enabled: !!user?.firebaseUser
  });

  // Fetch payroll settings
  const { data: payrollSettings } = useQuery({
    queryKey: ['/api/payroll-settings'],
    queryFn: async () => {
      const token = await user?.firebaseUser?.getIdToken();
      const response = await fetch('/api/payroll-settings', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (!response.ok) throw new Error('Failed to fetch payroll settings');
      return response.json();
    },
    enabled: !!user?.firebaseUser
  });

  // Fetch payroll statistics
  const { data: payrollStats } = useQuery({
    queryKey: ['/api/payroll/stats', { month: selectedMonth, year: selectedYear }],
    queryFn: async () => {
      const token = await user?.firebaseUser?.getIdToken();
      const response = await fetch(`/api/payroll/stats?month=${selectedMonth}&year=${selectedYear}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (!response.ok) throw new Error('Failed to fetch payroll statistics');
      return response.json();
    },
    enabled: !!user?.firebaseUser
  });

  // Fetch users for salary structure assignment
  const { data: users = [] } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const token = await user?.firebaseUser?.getIdToken();
      const response = await fetch('/api/users', {
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
    enabled: !!user?.firebaseUser
  });

  // Process payroll mutation
  const processPayrollMutation = useMutation({
    mutationFn: async ({ month, year, userIds }: { month: number; year: number; userIds?: string[] }) => {
      const token = await user?.firebaseUser?.getIdToken();
      const response = await fetch('/api/payroll/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ month, year, userIds })
      });
      if (!response.ok) throw new Error('Failed to process payroll');
      return response.json();
    },
    onSuccess: () => {
      refetchPayroll();
      setShowProcessModal(false);
      setIsProcessing(false);
      toast({
        title: "Success",
        description: "Payroll processed successfully",
      });
    },
    onError: (error: any) => {
      setIsProcessing(false);
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
      const token = await user?.firebaseUser?.getIdToken();
      const url = editingSalary ? `/api/salary-structures/${editingSalary.id}` : '/api/salary-structures';
      const method = editingSalary ? 'PATCH' : 'POST';
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to save salary structure');
      return response.json();
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

  const resetSalaryForm = () => {
    setSalaryForm({
      userId: '',
      employeeId: '',
      designation: '',
      department: '',
      dateOfJoining: '',
      fixedBasic: 0,
      fixedHra: 0
    });
    setEditingSalary(null);
  };

  const handleEditSalaryStructure = (salary: SalaryStructure) => {
    setEditingSalary(salary);
    setSalaryForm({
      userId: salary.userId,
      employeeId: salary.employeeId,
      designation: salary.designation,
      department: salary.department,
      dateOfJoining: salary.dateOfJoining,
      fixedBasic: salary.fixedBasic,
      fixedHra: salary.fixedHra
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

  const getDepartmentColor = (department: string) => {
    const colors = {
      'cre': 'bg-blue-100 text-blue-800',
      'accounts': 'bg-green-100 text-green-800',
      'hr': 'bg-purple-100 text-purple-800',
      'sales_and_marketing': 'bg-orange-100 text-orange-800',
      'technical_team': 'bg-indigo-100 text-indigo-800'
    };
    return colors[department as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getDesignationLevel = (designation: string) => {
    const levels = {
      'director': 8,
      'manager': 7,
      'assistant_manager': 6,
      'senior_executive': 5,
      'executive': 4,
      'junior_executive': 3,
      'trainee': 2,
      'intern': 1
    };
    return levels[designation as keyof typeof levels] || 1;
  };

  const handleSelectEmployee = (employeeId: string, checked: boolean) => {
    const newSelected = new Set(selectedEmployees);
    if (checked) {
      newSelected.add(employeeId);
    } else {
      newSelected.delete(employeeId);
    }
    setSelectedEmployees(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = payrollData.map((emp: EmployeePayrollData) => emp.id);
      setSelectedEmployees(new Set(allIds));
    } else {
      setSelectedEmployees(new Set());
    }
  };

  const filteredPayrollData = payrollData.filter((emp: EmployeePayrollData) => {
    const matchesSearch = emp.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === "all" || emp.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

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
    <div className="space-y-6 p-6">
      {/* Header Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payroll Management</h1>
          <p className="text-gray-500 mt-1">
            Manage employee salaries based on attendance and performance - April 2025 Format
          </p>
          <div className="flex items-center mt-2 text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-1" />
            {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { 
              month: 'long', 
              year: 'numeric' 
            })}
          </div>
        </div>
        <div className="flex space-x-3">
          <Button 
            onClick={() => setShowSettingsModal(true)}
            variant="outline"
            className="flex items-center"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button 
            onClick={() => setShowSalaryModal(true)}
            className="bg-blue-600 hover:bg-blue-700 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Employee Salary
          </Button>
          <Button 
            onClick={() => setShowProcessModal(true)}
            className="bg-green-600 hover:bg-green-700 flex items-center"
          >
            <Calculator className="h-4 w-4 mr-2" />
            Process Payroll
          </Button>
        </div>
      </div>

      {/* Period and Department Selection */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4">
              <div>
                <Label htmlFor="month" className="text-sm font-medium">Month</Label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger className="w-36">
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
                <Label htmlFor="year" className="text-sm font-medium">Year</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger className="w-28">
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
                <Label htmlFor="department" className="text-sm font-medium">Department</Label>
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

              <div>
                <Label htmlFor="search" className="text-sm font-medium">Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="search"
                    placeholder="Search employees..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-48"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex space-x-2">
              {selectedEmployees.size > 0 && (
                <Button 
                  variant="outline"
                  onClick={() => setShowBulkActionsModal(true)}
                  className="flex items-center"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Bulk Actions ({selectedEmployees.size})
                </Button>
              )}
              <Button variant="outline" className="flex items-center">
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
              <Button variant="outline" className="flex items-center">
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
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Total Employees</p>
                  <p className="text-2xl font-bold text-gray-900">{payrollStats.totalEmployees || 0}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Total Gross Salary</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(payrollStats.totalGrossSalary || 0)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Total Deductions</p>
                  <p className="text-2xl font-bold text-orange-600">{formatCurrency(payrollStats.totalDeductions || 0)}</p>
                </div>
                <PieChart className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">Net Salary</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(payrollStats.totalNetSalary || 0)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="payroll-sheet" className="flex items-center">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Payroll Sheet
          </TabsTrigger>
          <TabsTrigger value="salary-structures" className="flex items-center">
            <Briefcase className="h-4 w-4 mr-2" />
            Salary Structures
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center">
            <BarChart3 className="h-4 w-4 mr-2" />
            Reports & Analytics
          </TabsTrigger>
        </TabsList>

        {/* Payroll Sheet Tab - Main salary sheet like the image */}
        <TabsContent value="payroll-sheet" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl">Employee Payroll Sheet</CardTitle>
                  <CardDescription>
                    Monthly salary calculation based on attendance, overtime, and deductions
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedEmployees.size === filteredPayrollData.length && filteredPayrollData.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-gray-500">Select All</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px] w-full">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-green-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead className="min-w-[120px] font-semibold text-green-800">DESIGNATION</TableHead>
                        <TableHead className="min-w-[120px] font-semibold text-green-800">DEPARTMENT</TableHead>
                        <TableHead className="min-w-[100px] font-semibold text-green-800">DATE OF JOINING</TableHead>
                        
                        {/* Fixed Salary Section */}
                        <TableHead className="bg-blue-50 min-w-[100px] font-semibold text-blue-800 border-l-2 border-blue-200">
                          FIXED BASIC
                        </TableHead>
                        <TableHead className="bg-blue-50 min-w-[100px] font-semibold text-blue-800">FIXED HRA</TableHead>
                        
                        {/* Days/Hours Section */}
                        <TableHead className="bg-yellow-50 min-w-[80px] font-semibold text-yellow-800 border-l-2 border-yellow-200">
                          MONTH DAYS
                        </TableHead>
                        <TableHead className="bg-yellow-50 min-w-[80px] font-semibold text-yellow-800">PRESENT DAYS</TableHead>
                        <TableHead className="bg-yellow-50 min-w-[80px] font-semibold text-yellow-800">PAID DAYS</TableHead>
                        <TableHead className="bg-yellow-50 min-w-[100px] font-semibold text-yellow-800">PER DAY SALARY</TableHead>
                        <TableHead className="bg-yellow-50 min-w-[80px] font-semibold text-yellow-800">OT HOURS</TableHead>
                        <TableHead className="bg-yellow-50 min-w-[80px] font-semibold text-yellow-800">PER DAY OT</TableHead>
                        
                        {/* Variable Section */}
                        <TableHead className="bg-purple-50 min-w-[80px] font-semibold text-purple-800 border-l-2 border-purple-200">
                          BETTA
                        </TableHead>
                        
                        {/* Earned Salary Section */}
                        <TableHead className="bg-green-50 min-w-[100px] font-semibold text-green-800 border-l-2 border-green-200">
                          EARNED BASIC
                        </TableHead>
                        <TableHead className="bg-green-50 min-w-[100px] font-semibold text-green-800">EARNED HRA</TableHead>
                        <TableHead className="bg-green-50 min-w-[100px] font-semibold text-green-800">GROSS SALARY</TableHead>
                        <TableHead className="bg-green-50 min-w-[80px] font-semibold text-green-800">OT</TableHead>
                        <TableHead className="bg-green-50 min-w-[80px] font-semibold text-green-800">BETTA</TableHead>
                        <TableHead className="bg-green-50 min-w-[120px] font-semibold text-green-800">FINAL GROSS</TableHead>
                        
                        {/* Deductions Section */}
                        <TableHead className="bg-red-50 min-w-[80px] font-semibold text-red-800 border-l-2 border-red-200">
                          EPF
                        </TableHead>
                        <TableHead className="bg-red-50 min-w-[80px] font-semibold text-red-800">VPF</TableHead>
                        <TableHead className="bg-red-50 min-w-[80px] font-semibold text-red-800">ESI</TableHead>
                        <TableHead className="bg-red-50 min-w-[80px] font-semibold text-red-800">FINE</TableHead>
                        <TableHead className="bg-red-50 min-w-[80px] font-semibold text-red-800">CREDIT</TableHead>
                        <TableHead className="bg-red-50 min-w-[120px] font-semibold text-red-800">SALARY ADVANCE</TableHead>
                        <TableHead className="bg-red-50 min-w-[120px] font-semibold text-red-800">TOTAL DEDUCTION</TableHead>
                        
                        {/* Final Section */}
                        <TableHead className="bg-gray-50 min-w-[120px] font-semibold text-gray-800 border-l-2 border-gray-200">
                          NET SALARY
                        </TableHead>
                        <TableHead className="bg-gray-50 min-w-[150px] font-semibold text-gray-800">REMARKS</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayrollData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={25} className="text-center py-8 text-gray-500">
                            {isLoadingPayroll ? (
                              <div className="flex items-center justify-center">
                                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                                Loading payroll data...
                              </div>
                            ) : (
                              <div>
                                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                                <p>No payroll data found for the selected period.</p>
                                <p className="text-sm">Click "Process Payroll" to generate salary calculations.</p>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPayrollData.map((employee: EmployeePayrollData) => (
                          <TableRow key={employee.id} className="hover:bg-gray-50">
                            <TableCell>
                              <Checkbox
                                checked={selectedEmployees.has(employee.id)}
                                onCheckedChange={(checked) => handleSelectEmployee(employee.id, checked as boolean)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              <div>
                                <div className="font-semibold text-gray-900">{employee.designation}</div>
                                <div className="text-sm text-gray-500">{employee.userName}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("text-xs", getDepartmentColor(employee.department))}>
                                {employee.department.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{employee.dateOfJoining}</TableCell>
                            
                            {/* Fixed Salary */}
                            <TableCell className="bg-blue-50/50 text-right font-mono">
                              {employee.fixedBasic?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-blue-50/50 text-right font-mono">
                              {employee.fixedHra?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            
                            {/* Days/Hours */}
                            <TableCell className="bg-yellow-50/50 text-center font-mono">
                              {employee.monthDays || 30}
                            </TableCell>
                            <TableCell className="bg-yellow-50/50 text-center font-mono">
                              {employee.presentDays || 0}
                            </TableCell>
                            <TableCell className="bg-yellow-50/50 text-center font-mono">
                              {employee.paidDays || 0}
                            </TableCell>
                            <TableCell className="bg-yellow-50/50 text-right font-mono">
                              {employee.perDaySalary?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-yellow-50/50 text-center font-mono">
                              {employee.otHours || 0}
                            </TableCell>
                            <TableCell className="bg-yellow-50/50 text-right font-mono">
                              {employee.perDayOt?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            
                            {/* Variable */}
                            <TableCell className="bg-purple-50/50 text-right font-mono">
                              {employee.betta?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            
                            {/* Earned Salary */}
                            <TableCell className="bg-green-50/50 text-right font-mono font-medium">
                              {employee.earnedBasic?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-green-50/50 text-right font-mono font-medium">
                              {employee.earnedHra?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-green-50/50 text-right font-mono font-medium">
                              {employee.grossSalary?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-green-50/50 text-right font-mono">
                              {employee.overtimeAmount?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-green-50/50 text-right font-mono">
                              {employee.betta?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-green-50/50 text-right font-mono font-bold text-green-700">
                              {employee.finalGross?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            
                            {/* Deductions */}
                            <TableCell className="bg-red-50/50 text-right font-mono">
                              {employee.epf?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-red-50/50 text-right font-mono">
                              {employee.vpf?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-red-50/50 text-right font-mono">
                              {employee.esi?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-red-50/50 text-right font-mono">
                              {employee.fine?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-red-50/50 text-right font-mono">
                              {employee.credit?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-red-50/50 text-right font-mono">
                              {employee.salaryAdvance?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-red-50/50 text-right font-mono font-bold text-red-700">
                              {employee.totalDeduction?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            
                            {/* Final */}
                            <TableCell className="bg-gray-50/50 text-right font-mono font-bold text-lg text-blue-700">
                              {employee.netSalary?.toLocaleString('en-IN') || '0'}
                            </TableCell>
                            <TableCell className="bg-gray-50/50 text-sm">
                              {employee.remarks || '-'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Salary Structures Tab */}
        <TabsContent value="salary-structures" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Employee Salary Structures</CardTitle>
              <CardDescription>
                Manage fixed salary components for all employees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {salaryStructures.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No salary structures found.</p>
                    <p className="text-sm">Create salary structures for employees to start payroll processing.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {salaryStructures.map((structure: SalaryStructure) => (
                      <div key={structure.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <h3 className="font-semibold text-lg">{structure.userName}</h3>
                              <Badge className={cn("text-xs", getDepartmentColor(structure.department))}>
                                {structure.department.replace('_', ' ').toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {structure.designation.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p>Employee ID: {structure.employeeId}</p>
                              <p>Date of Joining: {structure.dateOfJoining}</p>
                              <p>Fixed Basic: ₹{structure.fixedBasic.toLocaleString('en-IN')}</p>
                              <p>Fixed HRA: ₹{structure.fixedHra.toLocaleString('en-IN')}</p>
                              <p className="font-medium">
                                Total Fixed: ₹{(structure.fixedBasic + structure.fixedHra).toLocaleString('en-IN')}
                              </p>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditSalaryStructure(structure)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Department-wise Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center py-8 text-gray-500">
                    <PieChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Department analytics will be displayed here</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  Salary Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center py-8 text-gray-500">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Salary trend analysis will be displayed here</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Salary Structure Modal */}
      <Dialog open={showSalaryModal} onOpenChange={setShowSalaryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSalary ? 'Edit Salary Structure' : 'Add Salary Structure'}
            </DialogTitle>
            <DialogDescription>
              Set up fixed salary components for the employee
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="user">Employee</Label>
              <Select 
                value={salaryForm.userId} 
                onValueChange={(value) => {
                  const selectedUser = users.find((u: any) => u.id === value);
                  setSalaryForm(prev => ({
                    ...prev,
                    userId: value,
                    employeeId: selectedUser?.employeeId || '',
                    designation: selectedUser?.designation || '',
                    department: selectedUser?.department || '',
                    dateOfJoining: selectedUser?.joinDate ? new Date(selectedUser.joinDate).toISOString().split('T')[0] : ''
                  }));
                }}
                disabled={!!editingSalary}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.displayName} - {user.designation}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="employeeId">Employee ID</Label>
                <Input
                  id="employeeId"
                  value={salaryForm.employeeId}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, employeeId: e.target.value }))}
                  placeholder="EMP001"
                />
              </div>
              <div>
                <Label htmlFor="dateOfJoining">Date of Joining</Label>
                <Input
                  id="dateOfJoining"
                  type="date"
                  value={salaryForm.dateOfJoining}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, dateOfJoining: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fixedBasic">Fixed Basic Salary</Label>
                <Input
                  id="fixedBasic"
                  type="number"
                  value={salaryForm.fixedBasic}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, fixedBasic: parseFloat(e.target.value) || 0 }))}
                  placeholder="25000"
                />
              </div>
              <div>
                <Label htmlFor="fixedHra">Fixed HRA</Label>
                <Input
                  id="fixedHra"
                  type="number"
                  value={salaryForm.fixedHra}
                  onChange={(e) => setSalaryForm(prev => ({ ...prev, fixedHra: parseFloat(e.target.value) || 0 }))}
                  placeholder="7500"
                />
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded">
              <p className="text-sm text-gray-600">
                Total Fixed Salary: ₹{(salaryForm.fixedBasic + salaryForm.fixedHra).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSalaryModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSalaryStructure} disabled={saveSalaryMutation.isPending}>
              {saveSalaryMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingSalary ? 'Update' : 'Save'}
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
              Generate salary calculations for {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                <div>
                  <h4 className="font-medium text-yellow-800">Important Notes:</h4>
                  <ul className="text-sm text-yellow-700 mt-2 space-y-1">
                    <li>• Payroll will be calculated based on attendance records</li>
                    <li>• Overtime hours will be considered if available</li>
                    <li>• EPF, ESI, and other deductions will be auto-calculated</li>
                    <li>• This action will overwrite existing draft payroll data</li>
                  </ul>
                </div>
              </div>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing payroll...</span>
                  <span>{processingProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${processingProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessModal(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setIsProcessing(true);
                setProcessingProgress(0);
                
                // Simulate processing progress
                const interval = setInterval(() => {
                  setProcessingProgress(prev => {
                    if (prev >= 90) {
                      clearInterval(interval);
                      return prev;
                    }
                    return prev + 10;
                  });
                }, 200);

                processPayrollMutation.mutate({
                  month: selectedMonth,
                  year: selectedYear
                });
              }}
              disabled={isProcessing || processPayrollMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Calculator className="h-4 w-4 mr-2" />
              )}
              Process Payroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}