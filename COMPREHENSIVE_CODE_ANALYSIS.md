# Comprehensive Line-by-Line Code Analysis
## Attendance, Department, Attendance Management & Payroll Management Systems

### Table of Contents
1. [Attendance System](#attendance-system)
2. [Department System](#department-system)
3. [Attendance Management System](#attendance-management-system)
4. [Payroll Management System](#payroll-management-system)

---

## Attendance System

### Frontend Components (`client/src/pages/attendance.tsx`)

#### Lines 1-35: Imports and Dependencies
```typescript
import { useState, useEffect } from "react";              // React state management hooks
import { useQuery, useQueryClient } from "@tanstack/react-query";  // Data fetching and caching
import { useAuthContext } from "@/contexts/auth-context";  // User authentication context
import { useToast } from "@/hooks/use-toast";             // Toast notifications
import { formatDate, formatTime, formatTimeString } from "@/lib/utils";  // Date/time utilities
```
- **Purpose**: Essential imports for React state, authentication, data fetching, and UI utilities
- **Dependencies**: Tanstack Query for server state, custom auth context, and utility functions

#### Lines 36-62: Data Fetching Logic
```typescript
const { data: attendanceRecords = [], isLoading, refetch } = useQuery({
  queryKey: ["/api/attendance", { userId: user?.uid }],
  queryFn: async () => {
    if (!user?.uid) return [];
    
    const attendanceResponse = await apiRequest('GET', `/api/attendance?userId=${user.uid}`);
    
    if (!attendanceResponse.ok) {
      throw new Error('Failed to fetch attendance records');
    }
    
    const attendanceData = await attendanceResponse.json();
    
    return attendanceData.map((record: any) => ({
      ...record,
      userName: user.displayName || user.email?.split('@')[0] || "You",
      userDepartment: user.department,
      userEmail: user.email
    }));
  },
  enabled: !!user?.uid,
  refetchInterval: 30000, // Real-time updates every 30 seconds
});
```
- **Line 37**: React Query hook for fetching attendance records
- **Line 38**: Query key includes user ID for cache invalidation
- **Line 40**: Guard clause prevents execution without user
- **Line 44**: API request to backend attendance endpoint
- **Line 46-48**: Error handling for failed requests
- **Line 52-57**: Data enrichment with user information
- **Line 60**: Real-time updates every 30 seconds

#### Lines 64-77: Today's Attendance Query
```typescript
const { data: todayAttendance } = useQuery({
  queryKey: ["/api/attendance/today", user?.uid],
  queryFn: async () => {
    if (!user?.uid) return null;
    const today = new Date().toISOString().split('T')[0];
    const response = await apiRequest('GET', `/api/attendance?userId=${user.uid}&date=${today}`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  },
  enabled: !!user?.uid,
});
```
- **Line 65**: Separate query for today's attendance data
- **Line 69**: Date formatting to YYYY-MM-DD format
- **Line 70**: API call with date parameter for today's record

#### Lines 79-103: Supporting Data Queries
```typescript
const { data: officeLocations = [] } = useQuery({
  queryKey: ["/api/office-locations"],
  queryFn: async () => {
    const response = await apiRequest('GET', '/api/office-locations');
    if (response.ok) {
      return await response.json();
    }
    return [];
  },
});

const { data: departmentTiming } = useQuery({
  queryKey: ["/api/departments/timing", user?.department],
  queryFn: async () => {
    if (!user?.department) return null;
    const response = await apiRequest('GET', `/api/departments/${user.department}/timing`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  },
  enabled: !!user?.department,
});
```
- **Lines 79-89**: Office locations query for geofencing
- **Lines 91-103**: Department timing settings query

#### Lines 132-134: Check-in/out Logic
```typescript
const canCheckIn = !todayAttendance?.checkInTime;
const canCheckOut = todayAttendance?.checkInTime && !todayAttendance?.checkOutTime;
```
- **Line 132**: User can check in if no check-in time exists
- **Line 133**: User can check out if checked in but not checked out

### Backend Routes (`server/routes.ts`)

#### Lines 1016-1060: Attendance GET Endpoint
```typescript
app.get("/api/attendance", verifyAuth, async (req, res) => {
  try {
    const { userId, date } = req.query;
    if (!req.authenticatedUser) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const requestingUser = req.authenticatedUser.user;

    // If specific userId and date requested
    if (userId && date) {
      // Users can only access their own data unless they're admin/master_admin
      if (
        requestingUser.role !== "master_admin" &&
        requestingUser.role !== "admin" &&
        requestingUser.uid !== userId
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const attendance = await storage.getUserAttendanceForDate(userId as string, date as string);
      return res.json(attendance || null);
    }
```
- **Line 1016**: GET endpoint with authentication middleware
- **Line 1018-1021**: Authentication validation
- **Line 1025-1035**: Permission check for data access
- **Line 1036**: Database query for specific user and date

#### Lines 1095-1140: Check-in Endpoint
```typescript
app.post("/api/attendance/check-in", verifyAuth, async (req, res) => {
  try {
    if (!req.authenticatedUser) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const {
      latitude,
      longitude,
      attendanceType = "office",
      customerName,
      reason,
      imageUrl,
      isWithinOfficeRadius = false,
      distanceFromOffice
    } = req.body;

    const userId = req.authenticatedUser.user.uid;
    
    // Validation
    if (!latitude || !longitude) {
      return res.status(400).json({ message: "Location coordinates are required" });
    }
```
- **Line 1095**: POST endpoint for check-in
- **Line 1106-1115**: Request body destructuring with defaults
- **Line 1119-1121**: Location validation

### Database Layer (`server/storage.ts`)

#### Lines 1700-1850: Attendance Storage Methods
```typescript
async listAttendanceByUser(userId: string): Promise<Attendance[]> {
  const attendanceCollection = this.db.collection("attendance");
  const snapshot = await attendanceCollection
    .where("userId", "==", userId)
    .orderBy("date", "desc")
    .get();
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      userEmail: data.userEmail,
      userDepartment: data.userDepartment,
      date: data.date?.toDate() || new Date(),
      checkInTime: data.checkInTime?.toDate() || null,
      checkOutTime: data.checkOutTime?.toDate() || null,
      // ... other fields
    } as Attendance;
  });
}
```
- **Line 1700**: Method to fetch user's attendance records
- **Line 1703**: Firestore query with user filter
- **Line 1704**: Ordering by date descending
- **Line 1707-1719**: Data transformation from Firestore format

---

## Department System

### Frontend Components

#### Department Display Logic
```typescript
{departmentTiming && (
  <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg">
        <Clock className="h-5 w-5 text-purple-600" />
        Department Timing Settings
        <Badge variant="outline" className="ml-2">{user?.department?.toUpperCase()}</Badge>
      </CardTitle>
      <CardDescription>Your department's configured working hours and policies</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 bg-white rounded-lg border">
          <div className="text-sm text-muted-foreground mb-1">Check In Time</div>
          <div className="text-lg font-semibold text-green-600">{formatTimeString(departmentTiming.checkInTime)}</div>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```
- **Lines 297-334**: Department timing display component
- **Purpose**: Shows department-specific working hours and policies

### Backend Routes

#### Lines 1400-1422: Department Timing GET
```typescript
app.get("/api/departments/:departmentId/timing", verifyAuth, async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { user } = req.authenticatedUser;
    
    // Users can view their own department timing or master_admin can view all
    if (user.role !== "master_admin" && user.department !== departmentId) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    // Get timing from database using storage layer
    const timing = await storage.getDepartmentTiming(departmentId);
    
    if (!timing) {
      return res.status(404).json({ message: "Department timing not found" });
    }
    
    res.json(timing);
  } catch (error: any) {
    console.error("Error fetching department timing:", error);
    res.status(500).json({ message: "Failed to fetch department timing" });
  }
});
```
- **Line 1400**: GET endpoint for department timing
- **Line 1406-1408**: Permission validation
- **Line 1411**: Database query through storage layer

#### Lines 1425-1488: Department Timing POST
```typescript
app.post("/api/departments/:departmentId/timing", verifyAuth, async (req, res) => {
  try {
    const { departmentId } = req.params;
    const { user } = req.authenticatedUser;
    
    // Only master_admin can update department timings
    if (user.role !== "master_admin") {
      return res.status(403).json({ message: "Access denied" });
    }
    
    const {
      checkInTime,
      checkOutTime,
      workingHours,
      overtimeThresholdMinutes,
      lateThresholdMinutes,
      isFlexibleTiming,
      flexibleCheckInStart,
      flexibleCheckInEnd,
      breakDurationMinutes,
      weeklyOffDays
    } = req.body;
    
    // Validate timing data
    if (!checkInTime || !checkOutTime || !workingHours) {
      return res.status(400).json({ message: "Check-in time, check-out time, and working hours are required" });
    }
    
    const timingData = {
      checkInTime,
      checkOutTime,
      workingHours: parseInt(workingHours),
      overtimeThresholdMinutes: parseInt(overtimeThresholdMinutes) || 30,
      lateThresholdMinutes: parseInt(lateThresholdMinutes) || 15,
      isFlexibleTiming: Boolean(isFlexibleTiming),
      flexibleCheckInStart,
      flexibleCheckInEnd,
      breakDurationMinutes: parseInt(breakDurationMinutes) || 60,
      weeklyOffDays: weeklyOffDays || [0],
      updatedBy: user.uid
    };

    // Save to database using storage layer
    const updatedTiming = await storage.updateDepartmentTiming(departmentId, timingData);
    
    res.json({
      message: "Department timing updated successfully",
      timing: updatedTiming
    });
  } catch (error: any) {
    console.error("Error updating department timing:", error);
    res.status(500).json({ message: "Failed to update department timing" });
  }
});
```
- **Line 1425**: POST endpoint for updating department timing
- **Line 1431-1433**: Master admin permission check
- **Line 1435-1446**: Request body destructuring
- **Line 1449-1451**: Required field validation
- **Line 1453-1465**: Data transformation and defaults

### Database Schema (`shared/schema.ts`)

#### Lines 4-24: Department and Designation Definitions
```typescript
export const departments = [
  "operations", "admin", "hr", "marketing", "sales", "technical", "housekeeping"
] as const;

// Enterprise organizational hierarchy with levels - Updated to match organizational chart
export const designations = [
  "ceo", "gm", "officer", "executive", "cre", "team_leader", "technician", "welder", "house_man"
] as const;

// Designation hierarchy levels (higher number = more authority) - Updated to match organizational chart
export const designationLevels = {
  "ceo": 9,
  "gm": 8,
  "officer": 7,
  "team_leader": 6,
  "executive": 5,
  "cre": 4,
  "technician": 3,
  "welder": 2,
  "house_man": 1
} as const;
```
- **Lines 4-6**: Department enum definition
- **Lines 9-11**: Designation enum with organizational hierarchy
- **Lines 14-24**: Designation levels for permission calculation

---

## Attendance Management System

### Frontend Components (`client/src/pages/attendance-management.tsx`)

#### Lines 27-59: Component State Management
```typescript
export default function AttendanceManagement() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("live");
  
  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    url: string;
    employeeName: string;
    date: string;
    time: string;
    attendanceType: string;
    customerName?: string;
    location?: string;
  } | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    status: '',
    overtimeHours: 0,
    remarks: ''
  });
```
- **Lines 32-36**: Filter and tab state management
- **Lines 38-50**: Modal state management for different operations
- **Lines 52-59**: Edit form state for attendance modifications

#### Lines 62-66: Real-time Data Fetching
```typescript
const { data: liveAttendance = [], isLoading: isLoadingLive, refetch: refetchLive } = useQuery({
  queryKey: ['/api/attendance/live'],
  enabled: !!user,
  refetchInterval: 30000, // Refresh every 30 seconds
});
```
- **Line 62**: Live attendance tracking query
- **Line 65**: 30-second auto-refresh for real-time updates

#### Lines 68-92: Daily Attendance with User Enrichment
```typescript
const { data: dailyAttendance = [], isLoading: isLoadingDaily, refetch: refetchDaily } = useQuery({
  queryKey: ['/api/attendance', { date: selectedDate.toISOString().split('T')[0] }],
  enabled: !!user,
  queryFn: async () => {
    const dateParam = selectedDate.toISOString().split('T')[0];
    const attendanceResponse = await apiRequest('GET', `/api/attendance?date=${dateParam}`);
    const attendanceData = await attendanceResponse.json();
    
    // Enrich with user details
    const usersResponse = await apiRequest('GET', '/api/users');
    const users = await usersResponse.json();
    
    return attendanceData.map((record: any) => {
      const userDetails = users.find((u: any) => u.id === record.userId);
      return {
        ...record,
        userName: userDetails?.displayName || `User #${record.userId}`,
        userDepartment: userDetails?.department || null,
        userDesignation: userDetails?.designation || null,
        userEmail: userDetails?.email || null
      };
    });
  },
});
```
- **Line 69**: Query key includes selected date for caching
- **Line 73**: Date parameter formatting
- **Line 77-78**: Parallel user data fetching for enrichment
- **Line 80-89**: Data join operation between attendance and users

#### Lines 111-134: Update Mutation Logic
```typescript
const updateAttendanceMutation = useMutation({
  mutationFn: async ({ id, data }: { id: string; data: any }) => {
    const response = await apiRequest('PATCH', `/api/attendance/${id}`, data);
    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/attendance'] });
    refetchLive();
    refetchDaily();
    setShowEditModal(false);
    toast({
      title: "Success",
      description: "Attendance record updated successfully",
    });
  },
  onError: (error: any) => {
    toast({
      title: "Error",
      description: error.message || "Failed to update attendance record",
      variant: "destructive",
    });
  },
});
```
- **Line 111**: Mutation for updating attendance records
- **Line 117-120**: Cache invalidation and UI updates on success
- **Line 124-130**: Error handling with user feedback

#### Lines 189-232: Edit Attendance Handler
```typescript
const handleEditAttendance = (record: any) => {
  setEditingAttendance(record);
  setEditForm({
    checkInTime: record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5) : '',
    checkOutTime: record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5) : '',
    status: record.status || 'present',
    overtimeHours: record.overtimeHours || 0,
    remarks: record.remarks || ''
  });
  setShowEditModal(true);
};

const handleSaveEdit = () => {
  if (!editingAttendance) return;
  
  const updateData: any = {
    status: editForm.status,
    overtimeHours: editForm.overtimeHours,
    remarks: editForm.remarks,
    approvedBy: user?.uid
  };

  // Convert times to full datetime if provided
  if (editForm.checkInTime) {
    const checkInDate = new Date(editingAttendance.date);
    const [hours, minutes] = editForm.checkInTime.split(':');
    checkInDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    updateData.checkInTime = checkInDate.toISOString();
  }

  if (editForm.checkOutTime) {
    const checkOutDate = new Date(editingAttendance.date);
    const [hours, minutes] = editForm.checkOutTime.split(':');
    checkOutDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    updateData.checkOutTime = checkOutDate.toISOString();
  }

  updateAttendanceMutation.mutate({
    id: editingAttendance.id,
    data: updateData
  });
};
```
- **Line 189**: Edit handler initialization
- **Line 192-196**: Time formatting for form display
- **Line 203**: Save handler with validation
- **Line 213-227**: Time conversion to full datetime objects

### Backend Routes (Attendance Management)

#### Lines 1200-1250: Live Attendance Endpoint
```typescript
app.get("/api/attendance/live", verifyAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.user.uid);
    if (!user || user.role !== "master_admin") {
      return res.status(403).json({ message: "Access denied - Master Admin only" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const liveAttendance = await storage.listAttendance({
      date: today.toISOString().split('T')[0],
      includeCheckouts: false
    });

    // Enrich with user details
    const users = await storage.listUsers();
    const enrichedAttendance = liveAttendance.map(record => {
      const userDetails = users.find(u => u.id === record.userId);
      return {
        ...record,
        userName: userDetails?.displayName || 'Unknown User',
        userDepartment: userDetails?.department || null,
        userDesignation: userDetails?.designation || null
      };
    });

    res.json(enrichedAttendance);
  } catch (error) {
    console.error("Error fetching live attendance:", error);
    res.status(500).json({ message: "Failed to fetch live attendance" });
  }
});
```
- **Line 1200**: Live attendance endpoint
- **Line 1202-1205**: Master admin permission check
- **Line 1207-1213**: Today's attendance filtering
- **Line 1215-1224**: User data enrichment

#### Lines 1300-1350: Update Attendance Endpoint
```typescript
app.patch("/api/attendance/:id", verifyAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req.authenticatedUser;
    const updateData = req.body;
    
    // Only admin/master_admin can update attendance records
    if (user.role !== "master_admin" && user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get existing attendance record
    const existingRecord = await storage.getAttendance(id);
    if (!existingRecord) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    // Prepare update data
    const updates: any = {};
    
    if (updateData.checkInTime) {
      const date = new Date(existingRecord.date);
      const [hours, minutes] = updateData.checkInTime.split(':');
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      updates.checkInTime = date;
    }
    
    if (updateData.checkOutTime) {
      const date = new Date(existingRecord.date);
      const [hours, minutes] = updateData.checkOutTime.split(':');
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      updates.checkOutTime = date;
    }

    // Update other fields
    if (updateData.status) updates.status = updateData.status;
    if (updateData.overtimeHours !== undefined) updates.overtimeHours = updateData.overtimeHours;
    if (updateData.remarks) updates.remarks = updateData.remarks;
    if (updateData.approvedBy) updates.approvedBy = updateData.approvedBy;

    // Save to database
    const updatedRecord = await storage.updateAttendance(id, updates);
    
    // Log the update
    await storage.createAuditLog({
      userId: user.uid,
      action: "attendance_updated",
      entityType: "attendance",
      entityId: id,
      changes: updates,
      department: user.department,
      designation: user.designation
    });

    res.json(updatedRecord);
  } catch (error) {
    console.error("Error updating attendance:", error);
    res.status(500).json({ message: "Failed to update attendance record" });
  }
});
```
- **Line 1300**: PATCH endpoint for attendance updates
- **Line 1306-1309**: Permission validation
- **Line 1311-1315**: Existing record validation
- **Line 1318-1331**: Time field processing
- **Line 1333-1338**: Other field updates
- **Line 1340-1349**: Audit logging

---

## Payroll Management System

### Frontend Components (`client/src/pages/payroll-management.tsx`)

#### Lines 35-131: Type Definitions
```typescript
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
```
- **Lines 35-47**: Field configuration interface for dynamic payroll fields
- **Lines 49-67**: Salary structure interface with custom earnings/deductions
- **Lines 69-99**: Enhanced payroll interface with detailed calculations

#### Lines 133-148: Component State
```typescript
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
```
- **Lines 137-139**: Filter state for month, year, and department
- **Lines 140-142**: Modal state management
- **Lines 143-146**: Selection and processing states

#### Lines 150-200: Data Queries
```typescript
// API Queries
const { data: users = [] } = useQuery({
  queryKey: ['/api/users'],
  enabled: !!user && user.role === 'master_admin',
});

const { data: payrollRecords = [] } = useQuery({
  queryKey: ['/api/payroll', { month: selectedMonth, year: selectedYear, department: selectedDepartment }],
  enabled: !!user && user.role === 'master_admin',
  queryFn: async () => {
    const params = new URLSearchParams({
      month: selectedMonth.toString(),
      year: selectedYear.toString(),
    });
    
    if (selectedDepartment !== 'all') {
      params.append('department', selectedDepartment);
    }
    
    const response = await apiRequest('GET', `/api/payroll?${params}`);
    return response.json();
  },
});

const { data: fieldConfigs = [] } = useQuery({
  queryKey: ['/api/payroll/field-configs'],
  enabled: !!user && user.role === 'master_admin',
});

const { data: salaryStructures = [] } = useQuery({
  queryKey: ['/api/enhanced-salary-structures'],
  enabled: !!user && user.role === 'master_admin',
});

const { data: payrollSettings } = useQuery({
  queryKey: ['/api/enhanced-payroll-settings'],
  enabled: !!user && user.role === 'master_admin',
});
```
- **Lines 150-153**: Users query with master admin restriction
- **Lines 155-169**: Payroll records query with filtering
- **Lines 171-174**: Field configurations query
- **Lines 176-179**: Salary structures query
- **Lines 181-184**: Payroll settings query

### Backend Routes (Payroll Management)

#### Lines 300-350: Payroll GET Endpoint
```typescript
app.get("/api/payroll", verifyAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.user.uid);
    if (!user || user.role !== "master_admin") {
      return res.status(403).json({ message: "Access denied - Master Admin only" });
    }

    const { month, year, department, status } = req.query;
    const filters: any = {};
    
    if (month) filters.month = parseInt(month as string);
    if (year) filters.year = parseInt(year as string);
    if (department && department !== "all") filters.department = department;
    if (status && status !== "all") filters.status = status;

    const payrollRecords = await storage.listPayrolls(filters);
    res.json(payrollRecords);
  } catch (error) {
    console.error("Error fetching payroll records:", error);
    res.status(500).json({ message: "Failed to fetch payroll records" });
  }
});
```
- **Line 300**: GET endpoint for payroll records
- **Line 302-305**: Master admin permission check
- **Line 307-313**: Query parameter filtering
- **Line 315**: Database query with filters

#### Lines 400-500: Payroll Processing Endpoint
```typescript
app.post("/api/payroll/process", verifyAuth, async (req, res) => {
  try {
    const user = await storage.getUser(req.user.uid);
    if (!user || user.role !== "master_admin") {
      return res.status(403).json({ message: "Access denied - Master Admin only" });
    }

    const { month, year, userIds } = req.body;
    
    // Process payroll for all users or specific users
    const usersToProcess = userIds || (await storage.listUsers()).map(u => u.id);
    const processedPayrolls = [];
    
    for (const userId of usersToProcess) {
      try {
        const userDetails = await storage.getUser(userId);
        if (!userDetails || !userDetails.isActive) continue;
        
        // Get salary structure
        const salaryStructure = await storage.getActiveSalaryStructure(userId);
        if (!salaryStructure) {
          console.log(`No active salary structure for user ${userId}`);
          continue;
        }
        
        // Get attendance data for the month
        const attendanceData = await storage.getMonthlyAttendanceForUser(userId, month, year);
        
        // Calculate payroll
        const payrollData = await calculateEnhancedPayroll(
          userDetails,
          salaryStructure,
          attendanceData,
          month,
          year
        );
        
        // Save payroll record
        const savedPayroll = await storage.createEnhancedPayroll({
          ...payrollData,
          processedBy: user.uid,
          processedAt: new Date(),
          status: 'processed'
        });
        
        processedPayrolls.push(savedPayroll);
        
        // Log the processing
        await storage.createAuditLog({
          userId: user.uid,
          action: "payroll_processed",
          entityType: "payroll",
          entityId: savedPayroll.id,
          changes: { month, year, processedFor: userId },
          department: user.department,
          designation: user.designation
        });
        
      } catch (error) {
        console.error(`Error processing payroll for user ${userId}:`, error);
      }
    }

    res.json({
      message: `Processed ${processedPayrolls.length} payroll records`,
      processedCount: processedPayrolls.length,
      payrolls: processedPayrolls
    });
  } catch (error) {
    console.error("Error processing payroll:", error);
    res.status(500).json({ message: "Failed to process payroll" });
  }
});
```
- **Line 400**: POST endpoint for payroll processing
- **Line 402-405**: Permission validation
- **Line 407-412**: User selection logic
- **Line 414-454**: Payroll calculation loop
- **Line 420-426**: Salary structure validation
- **Line 428-436**: Payroll calculation and creation
- **Line 442-450**: Audit logging

### Database Schema (Payroll)

#### Lines 318-380: Payroll Interface
```typescript
export interface Payroll {
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
  
  // Salary Components
  fixedSalary: number;
  basicSalary: number;
  hra: number;
  allowances: number;
  variableComponent: number;
  overtimePay: number;
  grossSalary: number;
  
  // Deductions
  pfDeduction: number;
  esiDeduction: number;
  tdsDeduction: number;
  advanceDeduction: number;
  loanDeduction: number;
  otherDeductions: number;
  totalDeductions: number;
  
  // Net Salary
  netSalary: number;
  
  // Status and Processing
  status: "draft" | "pending" | "approved" | "paid" | "cancelled";
  processedBy: string;
  approvedBy?: string;
  paidOn?: Date;
  paymentReference?: string;
  remarks?: string;
  
  createdAt: Date;
  updatedAt: Date;
}
```
- **Lines 318-327**: Basic payroll information
- **Lines 329-336**: Salary component breakdown
- **Lines 338-345**: Deduction categories
- **Lines 347-349**: Net salary calculation
- **Lines 351-360**: Processing workflow fields

#### Lines 444-483: Enhanced Payroll Interface
```typescript
export interface EnhancedPayroll {
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
  betta: number; // BETTA allowance from manual system
  dynamicEarnings: Record<string, number>;
  grossSalary: number; // Gross before BETTA
  finalGross: number; // Final gross after BETTA
  dynamicDeductions: Record<string, number>;
  epfDeduction: number;
  esiDeduction: number;
  vptDeduction: number;
  tdsDeduction: number;
  fineDeduction: number; // FINE from manual system
  salaryAdvance: number; // SALARY ADVANCE from manual system
  creditAdjustment: number; // CREDIT from manual system
  esiEligible: boolean; // ESI eligibility status
  totalEarnings: number;
  totalDeductions: number;
  netSalary: number;
  status: "draft" | "processed" | "approved" | "paid";
  processedBy?: string;
  processedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}
```
- **Lines 459-460**: Dynamic earnings and deductions support
- **Lines 465-467**: Manual system compatibility fields
- **Lines 469**: ESI eligibility calculation

### Storage Layer Implementation

#### Lines 2100-2200: Payroll Storage Methods
```typescript
async createPayroll(data: z.infer<typeof insertPayrollSchema>): Promise<Payroll> {
  const doc = this.db.collection('payrolls').doc();
  const payrollData = {
    ...data,
    id: doc.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await doc.set(payrollData);
  return payrollData as Payroll;
}

async listPayrolls(filters?: {
  month?: number;
  year?: number;
  department?: string;
  status?: string;
}): Promise<Payroll[]> {
  let query: Query = this.db.collection('payrolls');
  
  if (filters?.month) {
    query = query.where('month', '==', filters.month);
  }
  if (filters?.year) {
    query = query.where('year', '==', filters.year);
  }
  if (filters?.status) {
    query = query.where('status', '==', filters.status);
  }
  
  const querySnapshot = await query
    .orderBy('year', 'desc')
    .orderBy('month', 'desc')
    .get();
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      paidOn: data.paidOn?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Payroll;
  });
}
```
- **Line 2100**: Payroll creation method
- **Line 2112**: Payroll listing with filtering
- **Line 2115-2125**: Dynamic query building
- **Line 2127-2140**: Data transformation and mapping

## Summary

This comprehensive analysis covers all four systems with detailed line-by-line explanations:

1. **Attendance System**: Employee self-service attendance tracking with geolocation
2. **Department System**: Department timing configuration and management
3. **Attendance Management**: Administrative attendance oversight and corrections
4. **Payroll Management**: Complete payroll processing with dynamic fields

Each system demonstrates enterprise-grade architecture with:
- Frontend: React components with TypeScript, state management, and real-time updates
- Backend: Express.js API routes with authentication, authorization, and validation
- Database: Firestore NoSQL with proper data modeling and relationships
- Security: Role-based access control with granular permissions

The systems integrate seamlessly through shared schemas, consistent API patterns, and unified authentication context.