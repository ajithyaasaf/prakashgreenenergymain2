import { z } from "zod";

// Core enterprise user management schemas
export const departments = [
  "cre", "accounts", "hr", "sales_and_marketing", "technical_team"
] as const;

// Enterprise organizational hierarchy with levels
export const designations = [
  "director", "manager", "assistant_manager", "senior_executive", 
  "executive", "junior_executive", "trainee", "intern"
] as const;

// Designation hierarchy levels (higher number = more authority)
export const designationLevels = {
  "director": 8,
  "manager": 7,
  "assistant_manager": 6,
  "senior_executive": 5,
  "executive": 4,
  "junior_executive": 3,
  "trainee": 2,
  "intern": 1
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
  location: z.string().default("office"),
  customerId: z.number().optional(),
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
  workingHours: z.number().optional(),
  breakHours: z.number().optional(),
  isLate: z.boolean().default(false),
  lateMinutes: z.number().optional(),
  approvedBy: z.string().optional(),
  remarks: z.string().optional(),
});

export const insertOfficeLocationSchema = z.object({
  name: z.string(),
  latitude: z.string(),
  longitude: z.string(),
  radius: z.number(),
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
    case "cre":
      return [...baseAccess, "customers.view", "customers.create", "customers.edit", "customers.export"];
    case "accounts":
      return [...baseAccess, "invoices.view", "invoices.create", "invoices.edit", "invoices.approve", "reports.financial", "reports.export"];
    case "hr":
      return [...baseAccess, "attendance.view_all", "leave.view_all", "leave.approve", "users.view", "users.create", "users.edit", "customers.view", "products.view", "quotations.view", "invoices.view"];
    case "sales_and_marketing":
      return [...baseAccess, "customers.view", "quotations.view", "quotations.create", "quotations.edit", "products.view", "reports.basic"];
    case "technical_team":
      return [...baseAccess, "products.view", "products.create", "products.edit", "products.specifications", "products.inventory"];
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
  
  // Level 3+ (Junior Executive and above)
  if (level >= 3) {
    permissions.push("customers.create", "products.create", "quotations.create");
  }
  
  // Level 4+ (Executive and above)
  if (level >= 4) {
    permissions.push("customers.edit", "products.edit", "quotations.edit", "invoices.create");
  }
  
  // Level 5+ (Senior Executive and above)
  if (level >= 5) {
    permissions.push("approve.quotations.basic", "approve.expenses.basic", "attendance.view_team");
  }
  
  // Level 6+ (Assistant Manager and above)
  if (level >= 6) {
    permissions.push("approve.quotations.advanced", "approve.leave.team", "users.view", "reports.advanced");
  }
  
  // Level 7+ (Manager and above)
  if (level >= 7) {
    permissions.push("approve.invoices.basic", "approve.leave.department", "users.create", "users.edit", "analytics.departmental");
  }
  
  // Level 8 (Director)
  if (level >= 8) {
    permissions.push("approve.invoices.advanced", "users.permissions", "analytics.enterprise", "system.settings");
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


