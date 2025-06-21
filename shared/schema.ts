import { z } from "zod";

// Core enterprise user management schemas - Updated to match organizational chart
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

export const payrollGrades = [
  "A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"
] as const;

// Enterprise-grade granular permission system
export const systemPermissions = [
  // Dashboard access (Department-level feature access)
  "dashboard.view", "dashboard.analytics", "dashboard.full_access",
  
  // Customer Management (Sales & Marketing focus)
  "customers.view", "customers.create", "customers.edit", "customers.delete",
  "customers.export", "customers.import", "customers.archive",
  
  // Product Management (Technical & Sales focus) 
  "products.view", "products.create", "products.edit", "products.delete",
  "products.pricing", "products.specifications", "products.inventory",
  
  // Quotation Management (Sales primary, others view)
  "quotations.view", "quotations.create", "quotations.edit", "quotations.delete",
  "quotations.approve", "quotations.send", "quotations.convert",
  
  // Invoice Management (Accounts primary)
  "invoices.view", "invoices.create", "invoices.edit", "invoices.delete",
  "invoices.approve", "invoices.send", "invoices.payment_tracking",
  
  // Attendance Management (HR primary, self for employees)
  "attendance.view_own", "attendance.view_team", "attendance.view_all",
  "attendance.mark", "attendance.approve", "attendance.reports",
  
  // Leave Management (HR approvals, self requests)
  "leave.view_own", "leave.view_team", "leave.view_all",
  "leave.request", "leave.approve", "leave.reject", "leave.cancel",
  
  // User & Access Management (Admin roles)
  "users.view", "users.create", "users.edit", "users.delete",
  "users.permissions", "users.activate", "users.deactivate",
  
  // Department & Organization (Master Admin)
  "departments.view", "departments.create", "departments.edit", "departments.delete",
  "designations.view", "designations.create", "designations.edit", "designations.delete",
  "permissions.view", "permissions.manage", "permissions.assign",
  
  // Reporting & Analytics (Designation-based access levels)
  "reports.basic", "reports.advanced", "reports.financial", "reports.export",
  "analytics.view", "analytics.departmental", "analytics.enterprise",
  
  // Approval workflows (Designation-based limits)
  "approve.quotations.basic", "approve.quotations.advanced",
  "approve.invoices.basic", "approve.invoices.advanced", 
  "approve.leave.team", "approve.leave.department",
  "approve.expenses.basic", "approve.expenses.advanced",
  "approve.overtime.team", "approve.overtime.department",
  
  // System Administration (Master Admin only)
  "system.settings", "system.backup", "system.audit", "system.integrations"
] as const;

export const insertUserEnhancedSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  role: z.enum(["master_admin", "admin", "employee"]).default("employee"),
  department: z.enum(departments).nullable().optional(),
  designation: z.enum(designations).nullable().optional(),
  employeeId: z.string().optional(),
  reportingManagerId: z.string().nullable().optional(),
  payrollGrade: z.enum(payrollGrades).nullable().optional(),
  joinDate: z.date().optional(),
  isActive: z.boolean().default(true),
  photoURL: z.string().nullable().optional()
});

export const insertDesignationSchema = z.object({
  name: z.string().min(2, "Designation name must be at least 2 characters"),
  level: z.number().min(1).max(10),
  description: z.string().optional(),
  permissions: z.array(z.enum(systemPermissions)).default([])
});

export const insertPermissionGroupSchema = z.object({
  name: z.string().min(2, "Permission group name must be at least 2 characters"),
  department: z.enum(departments),
  designation: z.enum(designations),
  permissions: z.array(z.enum(systemPermissions)),
  canApprove: z.boolean().default(false),
  maxApprovalAmount: z.number().nullable().optional()
});

export const insertAttendanceSchema = z.object({
  userId: z.string(),
  date: z.date().optional(),
  checkInTime: z.date().optional(),
  checkOutTime: z.date().optional(),
  attendanceType: z.enum(["office", "remote", "field_work"]).default("office"),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  reason: z.string().optional(),
  checkInLatitude: z.string().optional(),
  checkInLongitude: z.string().optional(),
  checkInImageUrl: z.string().optional(),
  checkOutLatitude: z.string().optional(),
  checkOutLongitude: z.string().optional(),
  checkOutImageUrl: z.string().optional(),
  status: z.enum(["present", "absent", "late", "leave", "holiday", "half_day"]).default("present"),
  overtimeHours: z.number().optional(),
  otReason: z.string().optional(),
  otImageUrl: z.string().optional(),
  workingHours: z.number().optional(),
  breakHours: z.number().optional(),
  isLate: z.boolean().default(false),
  lateMinutes: z.number().optional(),
  approvedBy: z.string().optional(),
  remarks: z.string().optional(),
  isWithinOfficeRadius: z.boolean().default(false),
  distanceFromOffice: z.number().optional(),
  
  // Enhanced features for early login and auto checkout
  isEarlyCheckIn: z.boolean().default(false),
  earlyCheckInReason: z.string().optional(),
  earlyCheckInImageUrl: z.string().optional(),
  earlyCheckInMinutes: z.number().default(0),
  isEarlyCheckOut: z.boolean().default(false),
  earlyCheckOutReason: z.string().optional(),
  earlyCheckOutMinutes: z.number().default(0),
  
  // Enhanced overtime management with user control
  overtimeEnabled: z.boolean().default(false),
  overtimeStartTime: z.date().optional(),
  overtimeApprovalStatus: z.enum(["pending", "approved", "rejected"]).optional(),
  overtimeRequestedByUser: z.boolean().default(false), // User explicitly requested OT
  
  // Advanced auto checkout functionality with 2-hour buffer
  autoCheckOutEnabled: z.boolean().default(true),
  autoCheckOutTime: z.date().optional(), // Initially 2 hours after dept checkout time
  finalAutoCheckOutTime: z.date().optional(), // 11:55 PM when OT is enabled
  isAutoCheckedOut: z.boolean().default(false),
  autoCheckOutReason: z.string().optional(),
  
  // Enhanced working hours calculation
  regularWorkingHours: z.number().min(0).default(0),
  actualOvertimeHours: z.number().min(0).default(0),
  calculatedWorkingHours: z.number().min(0).default(0), // Total hours worked
  eligibleOvertimeHours: z.number().min(0).default(0), // OT hours that count for payment
  
  // Timing compliance
  expectedCheckInTime: z.date().optional(),
  expectedCheckOutTime: z.date().optional(),
  isLateCheckIn: z.boolean().default(false),
  lateCheckInMinutes: z.number().min(0).default(0),
  
  // Audit trail
  lastModifiedAt: z.date().optional(),
  lastModifiedBy: z.string().optional()
});

export const insertOfficeLocationSchema = z.object({
  name: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  radius: z.number().default(100), // Default 100 meters radius
  address: z.string().optional(),
  isActive: z.boolean().default(true),
});

// Department timing schema for attendance calculations
export const insertDepartmentTimingSchema = z.object({
  departmentId: z.string(),
  department: z.enum(departments),
  workingHours: z.number().min(1).max(24).default(8), // Standard working hours per day
  checkInTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"), // e.g., "09:00"
  checkOutTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Time must be in HH:MM format"), // e.g., "18:00"
  lateThresholdMinutes: z.number().min(0).default(15), // Grace period for late arrivals
  overtimeThresholdMinutes: z.number().min(0).default(30), // Minimum minutes to qualify for OT
  isFlexibleTiming: z.boolean().default(false),
  flexibleCheckInStart: z.string().optional(), // e.g., "08:00"
  flexibleCheckInEnd: z.string().optional(),   // e.g., "10:00"
  breakDurationMinutes: z.number().min(0).default(60), // Lunch break duration
  weeklyOffDays: z.array(z.number().min(0).max(6)).default([0]), // 0=Sunday, 1=Monday, etc.
  isActive: z.boolean().default(true),
  createdBy: z.string(),
  updatedBy: z.string().optional(),
});

export const insertPermissionSchema = z.object({
  userId: z.string(),
  month: z.date(),
  minutesUsed: z.number().default(0),
});

// Phase 2: Enterprise Permission Matrix Schemas
export const insertRoleSchema = z.object({
  name: z.string().min(2, "Role name must be at least 2 characters"),
  description: z.string().optional(),
  isSystemRole: z.boolean().default(false),
  department: z.enum(departments).nullable().optional(),
  designation: z.enum(designations).nullable().optional(),
  permissions: z.array(z.enum(systemPermissions)).default([]),
  approvalLimits: z.object({
    quotations: z.number().nullable().optional(),
    invoices: z.number().nullable().optional(),
    expenses: z.number().nullable().optional(),
    leave: z.boolean().default(false),
    overtime: z.boolean().default(false)
  }).optional()
});

export const insertUserRoleAssignmentSchema = z.object({
  userId: z.string(),
  roleId: z.string(),
  assignedBy: z.string(),
  effectiveFrom: z.date().default(() => new Date()),
  effectiveTo: z.date().nullable().optional(),
  isActive: z.boolean().default(true)
});

export const insertPermissionOverrideSchema = z.object({
  userId: z.string(),
  permission: z.enum(systemPermissions),
  granted: z.boolean(),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  grantedBy: z.string(),
  effectiveFrom: z.date().default(() => new Date()),
  effectiveTo: z.date().nullable().optional()
});

export const insertAuditLogSchema = z.object({
  userId: z.string(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  changes: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  department: z.enum(departments).nullable().optional(),
  designation: z.enum(designations).nullable().optional()
});

// Payroll System Schemas
export const insertSalaryStructureSchema = z.object({
  userId: z.string(),
  employeeId: z.string(),
  fixedSalary: z.number().min(0),
  basicSalary: z.number().min(0),
  hra: z.number().min(0).optional(),
  allowances: z.number().min(0).optional(),
  variableComponent: z.number().min(0).optional(),
  effectiveFrom: z.date(),
  effectiveTo: z.date().nullable().optional(),
  isActive: z.boolean().default(true),
  createdBy: z.string(),
  approvedBy: z.string().optional()
});

export const insertPayrollSchema = z.object({
  userId: z.string(),
  employeeId: z.string(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  workingDays: z.number().min(0),
  presentDays: z.number().min(0),
  absentDays: z.number().min(0),
  overtimeHours: z.number().min(0).default(0),
  leaveDays: z.number().min(0).default(0),
  
  // Salary Components
  fixedSalary: z.number().min(0),
  basicSalary: z.number().min(0),
  hra: z.number().min(0).default(0),
  allowances: z.number().min(0).default(0),
  variableComponent: z.number().min(0).default(0),
  overtimePay: z.number().min(0).default(0),
  
  // Gross Salary
  grossSalary: z.number().min(0),
  
  // Deductions
  pfDeduction: z.number().min(0).default(0),
  esiDeduction: z.number().min(0).default(0),
  tdsDeduction: z.number().min(0).default(0),
  advanceDeduction: z.number().min(0).default(0),
  loanDeduction: z.number().min(0).default(0),
  otherDeductions: z.number().min(0).default(0),
  totalDeductions: z.number().min(0),
  
  // Net Salary
  netSalary: z.number(),
  
  // Status
  status: z.enum(["draft", "pending", "approved", "paid", "cancelled"]).default("draft"),
  
  // Processing
  processedBy: z.string(),
  approvedBy: z.string().optional(),
  paidOn: z.date().optional(),
  paymentReference: z.string().optional(),
  
  // Metadata
  remarks: z.string().optional()
});

export const insertPayrollSettingsSchema = z.object({
  pfRate: z.number().min(0).max(100).default(12), // PF rate percentage
  esiRate: z.number().min(0).max(100).default(0.75), // ESI rate percentage
  tdsRate: z.number().min(0).max(100).default(0), // TDS rate percentage
  overtimeMultiplier: z.number().min(1).default(2), // Overtime pay multiplier
  standardWorkingHours: z.number().min(1).default(8), // Standard working hours per day
  standardWorkingDays: z.number().min(1).default(26), // Standard working days per month
  leaveDeductionRate: z.number().min(0).max(100).default(100), // Percentage deduction for leaves
  
  // Salary calculation rules
  pfApplicableFromSalary: z.number().min(0).default(15000), // PF applicable from this salary amount
  esiApplicableFromSalary: z.number().min(0).default(21000), // ESI applicable from this salary amount
  
  // Company details
  companyName: z.string().default("Prakash Greens Energy"),
  companyAddress: z.string().optional(),
  companyPan: z.string().optional(),
  companyTan: z.string().optional(),
  
  updatedBy: z.string()
});

export const insertSalaryAdvanceSchema = z.object({
  userId: z.string(),
  employeeId: z.string(),
  amount: z.number().min(0),
  reason: z.string(),
  requestDate: z.date().default(() => new Date()),
  approvedDate: z.date().optional(),
  deductionStartMonth: z.number().min(1).max(12),
  deductionStartYear: z.number().min(2020),
  numberOfInstallments: z.number().min(1).default(1),
  monthlyDeduction: z.number().min(0),
  remainingAmount: z.number().min(0),
  status: z.enum(["pending", "approved", "rejected", "completed"]).default("pending"),
  approvedBy: z.string().optional(),
  remarks: z.string().optional()
});

export const insertAttendancePolicySchema = z.object({
  name: z.string(),
  department: z.enum(departments).nullable().optional(),
  designation: z.enum(designations).nullable().optional(),
  
  // Timing policies
  checkInTime: z.string().default("09:30"), // HH:MM format
  checkOutTime: z.string().default("18:30"), // HH:MM format
  flexibleTiming: z.boolean().default(false),
  flexibilityMinutes: z.number().min(0).default(0),
  
  // Overtime policies
  overtimeAllowed: z.boolean().default(true),
  maxOvertimeHours: z.number().min(0).default(4),
  overtimeApprovalRequired: z.boolean().default(true),
  
  // Leave policies
  lateMarkAfterMinutes: z.number().min(0).default(15),
  halfDayMarkAfterMinutes: z.number().min(0).default(240), // 4 hours
  
  // Weekend and holiday policies
  weekendDays: z.array(z.number().min(0).max(6)).default([0, 6]), // 0=Sunday, 6=Saturday
  holidayPolicy: z.enum(["paid", "unpaid", "optional"]).default("paid"),
  
  isActive: z.boolean().default(true),
  createdBy: z.string()
});

// Enhanced Payroll System Schemas
export const insertPayrollFieldConfigSchema = z.object({
  name: z.string().min(1, "Field name is required"),
  displayName: z.string().min(1, "Display name is required"),
  category: z.enum(["earnings", "deductions", "attendance"]),
  dataType: z.enum(["number", "percentage", "boolean", "text"]),
  isRequired: z.boolean().default(false),
  isSystemField: z.boolean().default(false),
  defaultValue: z.number().optional(),
  department: z.enum(departments).optional(),
  sortOrder: z.number().min(1).default(1),
  isActive: z.boolean().default(true)
});

export const insertEnhancedSalaryStructureSchema = z.object({
  userId: z.string(),
  employeeId: z.string(),
  fixedBasic: z.number().min(0),
  fixedHRA: z.number().min(0),
  fixedConveyance: z.number().min(0),
  customEarnings: z.record(z.number()).default({}),
  customDeductions: z.record(z.number()).default({}),
  perDaySalaryBase: z.enum(["basic", "basic_hra", "gross"]).default("basic_hra"),
  overtimeRate: z.number().min(0).default(1.5),
  epfApplicable: z.boolean().default(true),
  esiApplicable: z.boolean().default(true),
  vptAmount: z.number().min(0).default(0),
  templateId: z.string().optional(),
  effectiveFrom: z.date(),
  effectiveTo: z.date().optional(),
  isActive: z.boolean().default(true)
});

export const insertEnhancedPayrollSchema = z.object({
  userId: z.string(),
  employeeId: z.string(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  monthDays: z.number().min(1).max(31),
  presentDays: z.number().min(0),
  paidLeaveDays: z.number().min(0).default(0),
  overtimeHours: z.number().min(0).default(0),
  perDaySalary: z.number().min(0),
  earnedBasic: z.number().min(0),
  earnedHRA: z.number().min(0),
  earnedConveyance: z.number().min(0),
  overtimePay: z.number().min(0).default(0),
  betta: z.number().min(0).default(0), // BETTA allowance from manual system
  dynamicEarnings: z.record(z.number()).default({}),
  grossSalary: z.number().min(0), // Gross before BETTA
  finalGross: z.number().min(0), // Final gross after BETTA
  dynamicDeductions: z.record(z.number()).default({}),
  epfDeduction: z.number().min(0).default(0),
  esiDeduction: z.number().min(0).default(0),
  vptDeduction: z.number().min(0).default(0),
  tdsDeduction: z.number().min(0).default(0),
  fineDeduction: z.number().min(0).default(0), // FINE from manual system
  salaryAdvance: z.number().min(0).default(0), // SALARY ADVANCE from manual system
  creditAdjustment: z.number().min(0).default(0), // CREDIT from manual system
  esiEligible: z.boolean().default(true), // ESI eligibility status
  totalEarnings: z.number().min(0),
  totalDeductions: z.number().min(0),
  netSalary: z.number(),
  status: z.enum(["draft", "processed", "approved", "paid"]).default("draft"),
  processedBy: z.string().optional(),
  processedAt: z.date().optional(),
  approvedBy: z.string().optional(),
  approvedAt: z.date().optional(),
  remarks: z.string().optional()
});

export const insertEnhancedPayrollSettingsSchema = z.object({
  epfEmployeeRate: z.number().min(0).max(100).default(12),
  epfEmployerRate: z.number().min(0).max(100).default(12),
  esiEmployeeRate: z.number().min(0).max(100).default(0.75),
  esiEmployerRate: z.number().min(0).max(100).default(3.25),
  epfCeiling: z.number().min(0).default(15000),
  esiThreshold: z.number().min(0).default(21000),
  tdsThreshold: z.number().min(0).default(250000),
  standardWorkingDays: z.number().min(1).default(26),
  standardWorkingHours: z.number().min(1).default(8),
  overtimeThresholdHours: z.number().min(0).default(8),
  companyName: z.string().default("Prakash Greens Energy"),
  companyAddress: z.string().optional(),
  companyPan: z.string().optional(),
  companyTan: z.string().optional(),
  autoCalculateStatutory: z.boolean().default(true),
  allowManualOverride: z.boolean().default(true),
  requireApprovalForProcessing: z.boolean().default(false)
});

// Enterprise user types
export type Department = typeof departments[number];
export type Designation = typeof designations[number];
export type PayrollGrade = typeof payrollGrades[number];
export type SystemPermission = typeof systemPermissions[number];
export type DesignationLevel = typeof designationLevels[keyof typeof designationLevels];

// Phase 1 types (backward compatible)
export type InsertUserEnhanced = z.infer<typeof insertUserEnhancedSchema>;
export type InsertDesignation = z.infer<typeof insertDesignationSchema>;
export type InsertPermissionGroup = z.infer<typeof insertPermissionGroupSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertOfficeLocation = z.infer<typeof insertOfficeLocationSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

// Phase 2 types (enterprise RBAC)
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type InsertUserRoleAssignment = z.infer<typeof insertUserRoleAssignmentSchema>;
export type InsertPermissionOverride = z.infer<typeof insertPermissionOverrideSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// Payroll System Types
export type InsertSalaryStructure = z.infer<typeof insertSalaryStructureSchema>;
export type InsertPayroll = z.infer<typeof insertPayrollSchema>;
export type InsertPayrollSettings = z.infer<typeof insertPayrollSettingsSchema>;
export type InsertSalaryAdvance = z.infer<typeof insertSalaryAdvanceSchema>;
export type InsertAttendancePolicy = z.infer<typeof insertAttendancePolicySchema>;

// Enterprise permission checking utilities
export const getDesignationLevel = (designation: Designation): number => {
  return designationLevels[designation];
};

export const canApproveForDesignation = (userDesignation: Designation, targetDesignation: Designation): boolean => {
  return getDesignationLevel(userDesignation) > getDesignationLevel(targetDesignation);
};

export const getDepartmentModuleAccess = (department: Department): SystemPermission[] => {
  const baseAccess: SystemPermission[] = ["dashboard.view"];
  
  switch (department) {
    case "operations":
      return [...baseAccess, "dashboard.full_access", "analytics.enterprise", "reports.advanced", "reports.export", "users.view", "departments.view"];
    case "admin":
      return [...baseAccess, "users.view", "users.create", "users.edit", "departments.view", "designations.view", "analytics.departmental", "reports.basic"];
    case "hr":
      return [...baseAccess, "attendance.view_all", "leave.view_all", "leave.approve", "users.view", "users.create", "users.edit", "customers.view", "products.view", "quotations.view", "invoices.view"];
    case "marketing":
      return [...baseAccess, "customers.view", "customers.create", "customers.edit", "products.view", "quotations.view", "reports.basic"];
    case "sales":
      return [...baseAccess, "customers.view", "customers.create", "customers.edit", "quotations.view", "quotations.create", "quotations.edit", "products.view", "reports.basic"];
    case "technical":
      return [...baseAccess, "products.view", "products.create", "products.edit", "products.specifications", "products.inventory"];
    case "housekeeping":
      return [...baseAccess, "attendance.view_own"];
    default:
      return baseAccess;
  }
};

// Designation-based Action Permissions (what actions they can perform within modules)
export const getDesignationActionPermissions = (designation: Designation): SystemPermission[] => {
  const level = getDesignationLevel(designation);
  
  // Higher designation = more action permissions
  const permissions: SystemPermission[] = [];
  
  // Basic permissions for all designations
  permissions.push("dashboard.view", "attendance.view_own", "leave.view_own", "leave.request");
  
  // Level 1 (House Man)
  if (level >= 1) {
    permissions.push("attendance.mark");
  }
  
  // Level 2+ (Welder and above)
  if (level >= 2) {
    permissions.push("products.view");
  }
  
  // Level 3+ (Technician and above)
  if (level >= 3) {
    permissions.push("products.create", "products.edit");
  }
  
  // Level 4+ (CRE and above)
  if (level >= 4) {
    permissions.push("customers.create", "customers.edit", "quotations.create", "quotations.edit");
  }
  
  // Level 5+ (Executive and above)
  if (level >= 5) {
    permissions.push("invoices.create", "approve.quotations.basic", "attendance.view_team");
  }
  
  // Level 6+ (Team Leader and above)
  if (level >= 6) {
    permissions.push("approve.quotations.advanced", "approve.leave.team", "users.view", "reports.advanced");
  }
  
  // Level 7+ (Officer and above)
  if (level >= 7) {
    permissions.push("approve.invoices.basic", "approve.leave.department", "users.create", "users.edit", "analytics.departmental");
  }
  
  // Level 8+ (GM and above)
  if (level >= 8) {
    permissions.push("approve.invoices.advanced", "users.permissions", "analytics.enterprise", "system.settings");
  }
  
  // Level 9 (CEO)
  if (level >= 9) {
    permissions.push("system.backup", "system.audit", "system.integrations", "users.delete", "departments.create", "departments.edit", "departments.delete");
  }
  
  return permissions;
};

// Default permissions for new employees without department/designation
export const getNewEmployeePermissions = (): SystemPermission[] => {
  return [
    "dashboard.view",
    "attendance.view_own",
    "leave.view_own",
    "leave.request"
  ];
};

// Combined Department + Designation permissions
export const getEffectivePermissions = (department: Department | null, designation: Designation | null): SystemPermission[] => {
  // If new employee without department or designation, return basic attendance permissions
  if (!department || !designation) {
    return getNewEmployeePermissions();
  }
  
  const departmentPermissions = getDepartmentModuleAccess(department);
  const designationPermissions = getDesignationActionPermissions(designation);
  
  // Combine and deduplicate permissions
  const combinedPermissions = new Set([...departmentPermissions, ...designationPermissions]);
  return Array.from(combinedPermissions);
};


