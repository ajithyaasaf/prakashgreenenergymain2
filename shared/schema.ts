import { z } from "zod";

// Core enterprise user management schemas
export const departments = [
  "cre", "accounts", "hr", "sales_and_marketing", "technical_team"
] as const;

export const designations = [
  "director", "manager", "assistant_manager", "senior_executive", 
  "executive", "junior_executive", "trainee", "intern"
] as const;

export const payrollGrades = [
  "A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"
] as const;

export const systemPermissions = [
  // Core module access
  "dashboard.view", "dashboard.full_access",
  "customers.view", "customers.create", "customers.edit", "customers.delete",
  "products.view", "products.create", "products.edit", "products.delete",
  "quotations.view", "quotations.create", "quotations.edit", "quotations.delete",
  "invoices.view", "invoices.create", "invoices.edit", "invoices.delete",
  "attendance.view", "attendance.manage", "attendance.view_others",
  "leave.view", "leave.request", "leave.approve", "leave.reject",
  "users.view", "users.create", "users.edit", "users.delete",
  "departments.view", "departments.manage",
  "reports.view", "reports.advanced",
  // Approval permissions
  "approve.quotations", "approve.invoices", "approve.leave",
  "approve.expenses", "approve.overtime"
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
  status: z.string().default("pending"),
  overtimeHours: z.number().optional(),
  otReason: z.string().optional(),
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

// Enterprise user types
export type Department = typeof departments[number];
export type Designation = typeof designations[number];
export type PayrollGrade = typeof payrollGrades[number];
export type SystemPermission = typeof systemPermissions[number];

export type InsertUserEnhanced = z.infer<typeof insertUserEnhancedSchema>;
export type InsertDesignation = z.infer<typeof insertDesignationSchema>;
export type InsertPermissionGroup = z.infer<typeof insertPermissionGroupSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type InsertOfficeLocation = z.infer<typeof insertOfficeLocationSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
