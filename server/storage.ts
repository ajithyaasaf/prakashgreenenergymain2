import { db } from "./firebase";
import {
  FieldValue,
  Timestamp,
  Firestore,
  CollectionReference,
  DocumentReference,
  DocumentData,
  Query
} from "firebase-admin/firestore";
import { z } from "zod";
import {
  insertAttendanceSchema,
  insertOfficeLocationSchema,
  insertPermissionSchema,
  insertRoleSchema,
  insertUserRoleAssignmentSchema,
  insertPermissionOverrideSchema,
  insertAuditLogSchema,
  insertSalaryStructureSchema,
  insertPayrollSchema,
  insertPayrollSettingsSchema,
  insertSalaryAdvanceSchema,
  insertAttendancePolicySchema
} from "@shared/schema";

// Define our schemas since we're not using drizzle anymore
export const insertUserSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable().optional().transform(val => val || "User"),
  role: z.enum(["master_admin", "admin", "employee"]).default("employee"),
  department: z.enum(["cre", "accounts", "hr", "sales_and_marketing", "technical_team"]).nullable().optional(),
  designation: z.enum([
    "director", "manager", "assistant_manager", "senior_executive", 
    "executive", "junior_executive", "trainee", "intern"
  ]).nullable().optional(),
  employeeId: z.string().optional(),
  reportingManagerId: z.string().nullable().optional(),
  payrollGrade: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"]).nullable().optional(),
  joinDate: z.date().optional(),
  isActive: z.boolean().default(true),
  photoURL: z.string().nullable().optional()
});

export const insertDesignationSchema = z.object({
  name: z.string(),
  level: z.number(),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([])
});

export const insertPermissionGroupSchema = z.object({
  name: z.string(),
  department: z.enum(["cre", "accounts", "hr", "sales_and_marketing", "technical_team"]),
  designation: z.enum([
    "director", "manager", "assistant_manager", "senior_executive", 
    "executive", "junior_executive", "trainee", "intern"
  ]),
  permissions: z.array(z.string()),
  canApprove: z.boolean().default(false),
  maxApprovalAmount: z.number().nullable().optional()
});

export const insertDepartmentSchema = z.object({
  name: z.string()
});

export const insertCustomerSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  address: z.string()
});

export const insertProductSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.number()
});

export const insertQuotationSchema = z.object({
  customerId: z.string(),
  products: z.array(z.object({
    productId: z.string(),
    quantity: z.number()
  })),
  total: z.number(),
  status: z.string().default("pending")
});

export const insertInvoiceSchema = z.object({
  quotationId: z.string(),
  customerId: z.string(),
  total: z.number(),
  status: z.string().default("pending")
});

export const insertLeaveSchema = z.object({
  userId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  reason: z.string(),
  status: z.enum(["pending", "approved", "rejected"]).default("pending")
});

export interface User {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: "master_admin" | "admin" | "employee";
  department:
    | "cre"
    | "accounts"
    | "hr"
    | "sales_and_marketing"
    | "technical_team"
    | null;
  designation:
    | "director"
    | "manager"
    | "assistant_manager"
    | "senior_executive"
    | "executive"
    | "junior_executive"
    | "trainee"
    | "intern"
    | null;
  employeeId?: string;
  reportingManagerId?: string | null;
  payrollGrade?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "D1" | "D2" | null;
  joinDate?: Date;
  isActive: boolean;
  createdAt: Date;
  photoURL?: string;
}

export interface Designation {
  id: string;
  name: string;
  level: number;
  description?: string;
  permissions: string[];
  createdAt: Date;
}

export interface PermissionGroup {
  id: string;
  name: string;
  department: "cre" | "accounts" | "hr" | "sales_and_marketing" | "technical_team";
  designation: "director" | "manager" | "assistant_manager" | "senior_executive" | "executive" | "junior_executive" | "trainee" | "intern";
  permissions: string[];
  canApprove: boolean;
  maxApprovalAmount?: number | null;
  createdAt: Date;
}

export interface Department {
  id: string;
  name: string;
}

export interface OfficeLocation {
  id: string;
  name: string;
  latitude: string;
  longitude: string;
  radius: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  createdAt: Date;
}

export interface Quotation {
  id: string;
  customerId: string;
  products: { productId: string; quantity: number }[];
  total: number;
  status: string;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  quotationId: string;
  customerId: string;
  total: number;
  status: string;
  createdAt: Date;
}

export interface Attendance {
  id: string;
  userId: string;
  userEmail: string;
  userDepartment: string | null;
  date: Date;
  checkInTime?: Date;
  checkOutTime?: Date;
  location: string;
  customerId?: number;
  reason?: string;
  checkInLatitude?: string;
  checkInLongitude?: string;
  checkInImageUrl?: string;
  checkOutLatitude?: string;
  checkOutLongitude?: string;
  checkOutImageUrl?: string;
  status: string;
  overtimeHours?: number;
  otReason?: string;
}

export interface Leave {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
}

// Activity Log interface
export interface ActivityLog {
  id: string;
  type: 'customer_created' | 'customer_updated' | 'quotation_created' | 'invoice_paid' | 'product_created' | 'attendance' | 'leave_requested';
  title: string;
  description: string;
  createdAt: Date;
  entityId: string;
  entityType: string;
  userId: string;
}

export const insertActivityLogSchema = z.object({
  type: z.enum(['customer_created', 'customer_updated', 'quotation_created', 'invoice_paid', 'product_created', 'attendance', 'leave_requested']),
  title: z.string(),
  description: z.string(),
  entityId: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string(),
});

// Phase 2: Enterprise RBAC Interfaces
export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  department?: string | null;
  designation?: string | null;
  permissions: string[];
  approvalLimits?: {
    quotations?: number | null;
    invoices?: number | null;
    expenses?: number | null;
    leave?: boolean;
    overtime?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  assignedBy: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface PermissionOverride {
  id: string;
  userId: string;
  permission: string;
  granted: boolean;
  reason: string;
  grantedBy: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  department?: string | null;
  designation?: string | null;
  createdAt: Date;
}

// Payroll System Interfaces
export interface SalaryStructure {
  id: string;
  userId: string;
  employeeId: string;
  fixedSalary: number;
  basicSalary: number;
  hra?: number;
  allowances?: number;
  variableComponent?: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  isActive: boolean;
  createdBy: string;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface PayrollSettings {
  id: string;
  pfRate: number;
  esiRate: number;
  tdsRate: number;
  overtimeMultiplier: number;
  standardWorkingHours: number;
  standardWorkingDays: number;
  leaveDeductionRate: number;
  pfApplicableFromSalary: number;
  esiApplicableFromSalary: number;
  companyName: string;
  companyAddress?: string;
  companyPan?: string;
  companyTan?: string;
  updatedBy: string;
  updatedAt: Date;
}

export interface SalaryAdvance {
  id: string;
  userId: string;
  employeeId: string;
  amount: number;
  reason: string;
  requestDate: Date;
  approvedDate?: Date;
  deductionStartMonth: number;
  deductionStartYear: number;
  numberOfInstallments: number;
  monthlyDeduction: number;
  remainingAmount: number;
  status: "pending" | "approved" | "rejected" | "completed";
  approvedBy?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendancePolicy {
  id: string;
  name: string;
  department?: string | null;
  designation?: string | null;
  checkInTime: string;
  checkOutTime: string;
  flexibleTiming: boolean;
  flexibilityMinutes: number;
  overtimeAllowed: boolean;
  maxOvertimeHours: number;
  overtimeApprovalRequired: boolean;
  lateMarkAfterMinutes: number;
  halfDayMarkAfterMinutes: number;
  weekendDays: number[];
  holidayPolicy: "paid" | "unpaid" | "optional";
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByDepartment(department: string): Promise<User[]>;
  getUsersByDesignation(designation: string): Promise<User[]>;
  getUsersByReportingManager(managerId: string): Promise<User[]>;
  listUsers(): Promise<User[]>;
  createUser(data: z.infer<typeof insertUserSchema>): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  
  // Department management
  getDepartment(id: string): Promise<Department | undefined>;
  getDepartmentByName(name: string): Promise<Department | undefined>;
  listDepartments(): Promise<string[]>;
  createDepartment(
    data: z.infer<typeof insertDepartmentSchema>,
  ): Promise<Department>;
  updateDepartment(
    id: string,
    data: Partial<z.infer<typeof insertDepartmentSchema>>,
  ): Promise<Department>;
  deleteDepartment(id: string): Promise<boolean>;
  
  // Designation management
  getDesignation(id: string): Promise<Designation | undefined>;
  getDesignationByName(name: string): Promise<Designation | undefined>;
  listDesignations(): Promise<Designation[]>;
  createDesignation(data: z.infer<typeof insertDesignationSchema>): Promise<Designation>;
  updateDesignation(id: string, data: Partial<z.infer<typeof insertDesignationSchema>>): Promise<Designation>;
  deleteDesignation(id: string): Promise<boolean>;
  
  // Permission management
  getPermissionGroup(id: string): Promise<PermissionGroup | undefined>;
  getPermissionsByDepartmentAndDesignation(department: string, designation: string): Promise<PermissionGroup | undefined>;
  listPermissionGroups(): Promise<PermissionGroup[]>;
  createPermissionGroup(data: z.infer<typeof insertPermissionGroupSchema>): Promise<PermissionGroup>;
  updatePermissionGroup(id: string, data: Partial<z.infer<typeof insertPermissionGroupSchema>>): Promise<PermissionGroup>;
  deletePermissionGroup(id: string): Promise<boolean>;
  
  // User permission utilities (Phase 1 - backward compatible)
  getUserPermissions(userId: string): Promise<string[]>;
  checkUserPermission(userId: string, permission: string): Promise<boolean>;
  getUserApprovalLimits(userId: string): Promise<{ canApprove: boolean; maxAmount: number | null }>;
  
  // Phase 2: Enterprise RBAC methods
  // Role management
  getRole(id: string): Promise<Role | undefined>;
  getRoleByName(name: string): Promise<Role | undefined>;
  listRoles(): Promise<Role[]>;
  createRole(data: z.infer<typeof insertRoleSchema>): Promise<Role>;
  updateRole(id: string, data: Partial<z.infer<typeof insertRoleSchema>>): Promise<Role>;
  deleteRole(id: string): Promise<boolean>;
  
  // User role assignments
  getUserRoleAssignments(userId: string): Promise<UserRoleAssignment[]>;
  getRoleAssignment(id: string): Promise<UserRoleAssignment | undefined>;
  assignUserRole(data: z.infer<typeof insertUserRoleAssignmentSchema>): Promise<UserRoleAssignment>;
  revokeUserRole(userId: string, roleId: string): Promise<boolean>;
  
  // Permission overrides
  getUserPermissionOverrides(userId: string): Promise<PermissionOverride[]>;
  createPermissionOverride(data: z.infer<typeof insertPermissionOverrideSchema>): Promise<PermissionOverride>;
  revokePermissionOverride(id: string): Promise<boolean>;
  
  // Enterprise permission resolution
  getEffectiveUserPermissions(userId: string): Promise<string[]>;
  checkEffectiveUserPermission(userId: string, permission: string): Promise<boolean>;
  getEffectiveUserApprovalLimits(userId: string): Promise<{ canApprove: boolean; maxAmount: Record<string, number | null> }>;
  
  // Audit logging
  createAuditLog(data: z.infer<typeof insertAuditLogSchema>): Promise<AuditLog>;
  getAuditLogs(filters?: { userId?: string; entityType?: string; startDate?: Date; endDate?: Date }): Promise<AuditLog[]>;
  
  // Payroll System Methods
  // Salary Structure Management
  getSalaryStructure(id: string): Promise<SalaryStructure | undefined>;
  getSalaryStructureByUser(userId: string): Promise<SalaryStructure | undefined>;
  createSalaryStructure(data: z.infer<typeof insertSalaryStructureSchema>): Promise<SalaryStructure>;
  updateSalaryStructure(id: string, data: Partial<z.infer<typeof insertSalaryStructureSchema>>): Promise<SalaryStructure>;
  listSalaryStructures(): Promise<SalaryStructure[]>;
  
  // Payroll Management
  getPayroll(id: string): Promise<Payroll | undefined>;
  getPayrollByUserAndMonth(userId: string, month: number, year: number): Promise<Payroll | undefined>;
  createPayroll(data: z.infer<typeof insertPayrollSchema>): Promise<Payroll>;
  updatePayroll(id: string, data: Partial<z.infer<typeof insertPayrollSchema>>): Promise<Payroll>;
  listPayrolls(filters?: { month?: number; year?: number; department?: string; status?: string }): Promise<Payroll[]>;
  listPayrollsByUser(userId: string): Promise<Payroll[]>;
  
  // Payroll Settings
  getPayrollSettings(): Promise<PayrollSettings | undefined>;
  updatePayrollSettings(data: z.infer<typeof insertPayrollSettingsSchema>): Promise<PayrollSettings>;
  
  // Salary Advances
  getSalaryAdvance(id: string): Promise<SalaryAdvance | undefined>;
  createSalaryAdvance(data: z.infer<typeof insertSalaryAdvanceSchema>): Promise<SalaryAdvance>;
  updateSalaryAdvance(id: string, data: Partial<z.infer<typeof insertSalaryAdvanceSchema>>): Promise<SalaryAdvance>;
  listSalaryAdvances(filters?: { userId?: string; status?: string }): Promise<SalaryAdvance[]>;
  
  // Attendance Policies
  getAttendancePolicy(id: string): Promise<AttendancePolicy | undefined>;
  getAttendancePolicyByDepartment(department: string, designation?: string): Promise<AttendancePolicy | undefined>;
  createAttendancePolicy(data: z.infer<typeof insertAttendancePolicySchema>): Promise<AttendancePolicy>;
  updateAttendancePolicy(id: string, data: Partial<z.infer<typeof insertAttendancePolicySchema>>): Promise<AttendancePolicy>;
  listAttendancePolicies(): Promise<AttendancePolicy[]>;
  
  // Payroll Calculation Utilities
  calculatePayroll(userId: string, month: number, year: number): Promise<z.infer<typeof insertPayrollSchema>>;
  getMonthlyAttendanceSummary(userId: string, month: number, year: number): Promise<{
    workingDays: number;
    presentDays: number;
    absentDays: number;
    overtimeHours: number;
    leaveDays: number;
  }>;
  
  listOfficeLocations(): Promise<OfficeLocation[]>;
  getOfficeLocation(id: string): Promise<OfficeLocation | undefined>;
  createOfficeLocation(
    data: z.infer<typeof insertOfficeLocationSchema>,
  ): Promise<OfficeLocation>;
  updateOfficeLocation(
    id: string,
    data: Partial<z.infer<typeof insertOfficeLocationSchema>>,
  ): Promise<OfficeLocation>;
  deleteOfficeLocation(id: string): Promise<void>;
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(data: z.infer<typeof insertCustomerSchema>): Promise<Customer>;
  updateCustomer(
    id: string,
    data: Partial<z.infer<typeof insertCustomerSchema>>,
  ): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(data: z.infer<typeof insertProductSchema>): Promise<Product>;
  updateProduct(
    id: string,
    data: Partial<z.infer<typeof insertProductSchema>>,
  ): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  listQuotations(): Promise<Quotation[]>;
  getQuotation(id: string): Promise<Quotation | undefined>;
  createQuotation(
    data: z.infer<typeof insertQuotationSchema>,
  ): Promise<Quotation>;
  updateQuotation(
    id: string,
    data: Partial<z.infer<typeof insertQuotationSchema>>,
  ): Promise<Quotation>;
  deleteQuotation(id: string): Promise<void>;
  listInvoices(): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(data: z.infer<typeof insertInvoiceSchema>): Promise<Invoice>;
  updateInvoice(
    id: string,
    data: Partial<z.infer<typeof insertInvoiceSchema>>,
  ): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;
  createAttendance(
    data: z.infer<typeof insertAttendanceSchema>,
  ): Promise<Attendance>;
  updateAttendance(
    id: string,
    data: Partial<z.infer<typeof insertAttendanceSchema>>,
  ): Promise<Attendance>;
  getAttendanceByUserAndDate(
    userId: string,
    date: Date,
  ): Promise<Attendance | undefined>;
  listAttendanceByUser(userId: string): Promise<Attendance[]>;
  listAttendanceByDate(date: Date): Promise<Attendance[]>;
  listAttendanceBetweenDates(
    startDate: Date,
    endDate: Date,
  ): Promise<Attendance[]>;
  listAttendanceByUserBetweenDates(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Attendance[]>;
  getAttendance(id: string): Promise<Attendance | undefined>;
  getUserAttendanceForDate(userId: string, date: string): Promise<Attendance | undefined>;
  getLeave(id: string): Promise<Leave | undefined>;
  listLeavesByUser(userId: string): Promise<Leave[]>;
  listPendingLeaves(): Promise<Leave[]>;
  createLeave(data: z.infer<typeof insertLeaveSchema>): Promise<Leave>;
  updateLeave(
    id: string,
    data: Partial<z.infer<typeof insertLeaveSchema>>,
  ): Promise<Leave>;
  // Activity logs
  createActivityLog(data: z.infer<typeof insertActivityLogSchema>): Promise<ActivityLog>;
  listActivityLogs(limit?: number): Promise<ActivityLog[]>;
}

export class FirestoreStorage implements IStorage {
  private db: Firestore;
  
  constructor() {
    // Use the db imported at the top of the file
    this.db = db;
  }
  
  // Activity logs implementation
  async createActivityLog(data: z.infer<typeof insertActivityLogSchema>): Promise<ActivityLog> {
    const id = this.db.collection("activity_logs").doc().id;
    const activityLog: ActivityLog = {
      id,
      type: data.type,
      title: data.title,
      description: data.description,
      entityId: data.entityId || '',
      entityType: data.entityType || '',
      userId: data.userId,
      createdAt: new Date()
    };
    
    await this.db.collection("activity_logs").doc(id).set({
      ...activityLog,
      createdAt: Timestamp.fromDate(activityLog.createdAt)
    });
    
    return activityLog;
  }
  
  async listActivityLogs(limit = 10): Promise<ActivityLog[]> {
    const snapshot = await this.db.collection("activity_logs")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    
    if (snapshot.empty) {
      return [];
    }
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())
      } as ActivityLog;
    });
  }
  async getUser(id: string): Promise<User | undefined> {
    const userDoc = this.db.collection("users").doc(id);
    const docSnap = await userDoc.get();
    if (!docSnap.exists) return undefined;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      uid: data?.uid,
      email: data?.email,
      displayName: data?.displayName,
      role: data?.role,
      department: data?.department,
      designation: data?.designation,
      employeeId: data?.employeeId,
      reportingManagerId: data?.reportingManagerId,
      payrollGrade: data?.payrollGrade,
      joinDate: data?.joinDate?.toDate ? data.joinDate.toDate() : undefined,
      isActive: data?.isActive !== false,
      createdAt: data?.createdAt?.toDate ? data.createdAt.toDate() : new Date(data?.createdAt || Date.now()),
      photoURL: data?.photoURL,
    } as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const usersRef = this.db.collection("users");
    const snapshot = await usersRef.where("email", "==", email).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      uid: data.uid,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      department: data.department,
      createdAt: data.createdAt.toDate(),
      photoURL: data.photoURL,
    } as User;
  }

  async listUsers(): Promise<User[]> {
    const usersCollection = this.db.collection("users");
    const snapshot = await usersCollection.get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      // Handle different date formats safely
      let createdAt: Date;
      if (data.createdAt?.toDate) {
        // Firestore Timestamp
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt) {
        // ISO string or similar
        createdAt = new Date(data.createdAt);
      } else {
        // Fallback
        createdAt = new Date();
      }
      
      return {
        id: doc.id,
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        department: data.department,
        designation: data.designation || null,
        employeeId: data.employeeId,
        reportingManagerId: data.reportingManagerId || null,
        payrollGrade: data.payrollGrade || null,
        joinDate: data.joinDate ? (data.joinDate.toDate ? data.joinDate.toDate() : new Date(data.joinDate)) : undefined,
        isActive: data.isActive !== false,
        createdAt: createdAt,
        photoURL: data.photoURL,
      } as User;
    });
  }

  async createUser(data: z.infer<typeof insertUserSchema>): Promise<User> {
    const validatedData = insertUserSchema.parse(data);
    const userDoc = this.db.collection("users").doc(validatedData.uid);
    
    await userDoc.set({
      ...validatedData,
      id: validatedData.uid,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return { 
      id: validatedData.uid,
      ...validatedData, 
      createdAt: new Date(),
      isActive: validatedData.isActive || true
    } as User;
  }

  async getUsersByDepartment(department: string): Promise<User[]> {
    const usersCollection = this.db.collection("users");
    const snapshot = await usersCollection.where("department", "==", department).get();
    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        department: data.department,
        designation: data.designation || null,
        employeeId: data.employeeId,
        reportingManagerId: data.reportingManagerId || null,
        payrollGrade: data.payrollGrade || null,
        joinDate: data.joinDate ? (data.joinDate.toDate ? data.joinDate.toDate() : new Date(data.joinDate)) : undefined,
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        photoURL: data.photoURL,
      } as User;
    });
  }

  async getUsersByDesignation(designation: string): Promise<User[]> {
    const usersCollection = this.db.collection("users");
    const snapshot = await usersCollection.where("designation", "==", designation).get();
    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        department: data.department,
        designation: data.designation || null,
        employeeId: data.employeeId,
        reportingManagerId: data.reportingManagerId || null,
        payrollGrade: data.payrollGrade || null,
        joinDate: data.joinDate ? (data.joinDate.toDate ? data.joinDate.toDate() : new Date(data.joinDate)) : undefined,
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        photoURL: data.photoURL,
      } as User;
    });
  }

  async getUsersByReportingManager(managerId: string): Promise<User[]> {
    const usersCollection = this.db.collection("users");
    const snapshot = await usersCollection.where("reportingManagerId", "==", managerId).get();
    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        department: data.department,
        designation: data.designation || null,
        employeeId: data.employeeId,
        reportingManagerId: data.reportingManagerId || null,
        payrollGrade: data.payrollGrade || null,
        joinDate: data.joinDate ? (data.joinDate.toDate ? data.joinDate.toDate() : new Date(data.joinDate)) : undefined,
        isActive: data.isActive !== false,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        photoURL: data.photoURL,
      } as User;
    });
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const userDoc = this.db.collection("users").doc(id);
    const updateData: any = { ...data, updatedAt: Timestamp.now() };
    
    if (data.createdAt) {
      updateData.createdAt = Timestamp.fromDate(data.createdAt);
    }
    
    await userDoc.update(updateData);
    const updatedDoc = await userDoc.get();
    
    if (!updatedDoc.exists) throw new Error("User not found");
    const updatedData = updatedDoc.data() || {};
    
    return {
      id: updatedDoc.id,
      uid: updatedData.uid,
      email: updatedData.email,
      displayName: updatedData.displayName,
      role: updatedData.role,
      department: updatedData.department,
      designation: updatedData.designation || null,
      employeeId: updatedData.employeeId,
      reportingManagerId: updatedData.reportingManagerId || null,
      payrollGrade: updatedData.payrollGrade || null,
      joinDate: updatedData.joinDate ? (updatedData.joinDate.toDate ? updatedData.joinDate.toDate() : new Date(updatedData.joinDate)) : undefined,
      isActive: updatedData.isActive !== false,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
      photoURL: updatedData.photoURL,
    } as User;
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const deptDoc = this.db.collection("departments").doc(id);
    const docSnap = await deptDoc.get();
    if (!docSnap.exists) return undefined;
    const data = docSnap.data();
    return { id: docSnap.id, name: data?.name } as Department;
  }

  async getDepartmentByName(name: string): Promise<Department | undefined> {
    const departmentsRef = this.db.collection("departments");
    const snapshot = await departmentsRef.where("name", "==", name).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    const data = doc.data();
    return { id: doc.id, name: data.name } as Department;
  }

  async listDepartments(): Promise<string[]> {
    return ["cre", "accounts", "hr", "sales_and_marketing", "technical_team"];
  }

  async createDepartment(
    data: z.infer<typeof insertDepartmentSchema>,
  ): Promise<Department> {
    const validatedData = insertDepartmentSchema.parse(data);
    const departmentsRef = this.db.collection("departments");
    const deptDoc = await departmentsRef.add({
      ...validatedData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return { id: deptDoc.id, ...validatedData } as Department;
  }

  async updateDepartment(
    id: string,
    data: Partial<z.infer<typeof insertDepartmentSchema>>,
  ): Promise<Department> {
    const deptDoc = this.db.collection("departments").doc(id);
    const validatedData = insertDepartmentSchema.partial().parse(data);
    
    await deptDoc.update({ 
      ...validatedData, 
      updatedAt: Timestamp.now() 
    });
    
    const updatedDoc = await deptDoc.get();
    if (!updatedDoc.exists) throw new Error("Department not found");
    
    const docData = updatedDoc.data() || {};
    return { id: updatedDoc.id, name: docData.name } as Department;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const deptDoc = this.db.collection("departments").doc(id);
    await deptDoc.delete();
    return true;
  }

  // Designation management methods
  async getDesignation(id: string): Promise<Designation | undefined> {
    const designationDoc = this.db.collection("designations").doc(id);
    const docSnap = await designationDoc.get();
    if (!docSnap.exists) return undefined;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data?.name,
      level: data?.level || 1,
      description: data?.description,
      permissions: data?.permissions || [],
      createdAt: data?.createdAt?.toDate() || new Date()
    } as Designation;
  }

  async getDesignationByName(name: string): Promise<Designation | undefined> {
    const designationsRef = this.db.collection("designations");
    const snapshot = await designationsRef.where("name", "==", name).get();
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      level: data.level || 1,
      description: data.description,
      permissions: data.permissions || [],
      createdAt: data.createdAt?.toDate() || new Date()
    } as Designation;
  }

  async listDesignations(): Promise<Designation[]> {
    const designationsCollection = this.db.collection("designations");
    const snapshot = await designationsCollection.orderBy("level", "desc").get();
    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        level: data.level || 1,
        description: data.description,
        permissions: data.permissions || [],
        createdAt: data.createdAt?.toDate() || new Date()
      } as Designation;
    });
  }

  async createDesignation(data: z.infer<typeof insertDesignationSchema>): Promise<Designation> {
    const validatedData = insertDesignationSchema.parse(data);
    const designationRef = this.db.collection("designations").doc();
    
    const designationData = {
      ...validatedData,
      createdAt: Timestamp.now()
    };
    
    await designationRef.set(designationData);
    
    return {
      id: designationRef.id,
      ...validatedData,
      createdAt: new Date()
    } as Designation;
  }

  async updateDesignation(id: string, data: Partial<z.infer<typeof insertDesignationSchema>>): Promise<Designation> {
    const designationDoc = this.db.collection("designations").doc(id);
    const updateData = { ...data, updatedAt: Timestamp.now() };
    
    await designationDoc.update(updateData);
    const updatedDoc = await designationDoc.get();
    
    if (!updatedDoc.exists) throw new Error("Designation not found");
    const updatedData = updatedDoc.data() || {};
    
    return {
      id: updatedDoc.id,
      name: updatedData.name,
      level: updatedData.level || 1,
      description: updatedData.description,
      permissions: updatedData.permissions || [],
      createdAt: updatedData.createdAt?.toDate() || new Date()
    } as Designation;
  }

  async deleteDesignation(id: string): Promise<boolean> {
    const designationDoc = this.db.collection("designations").doc(id);
    await designationDoc.delete();
    return true;
  }

  // Permission management methods
  async getPermissionGroup(id: string): Promise<PermissionGroup | undefined> {
    const permissionDoc = this.db.collection("permission_groups").doc(id);
    const docSnap = await permissionDoc.get();
    if (!docSnap.exists) return undefined;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data?.name,
      department: data?.department,
      designation: data?.designation,
      permissions: data?.permissions || [],
      canApprove: data?.canApprove || false,
      maxApprovalAmount: data?.maxApprovalAmount || null,
      createdAt: data?.createdAt?.toDate() || new Date()
    } as PermissionGroup;
  }

  async getPermissionsByDepartmentAndDesignation(department: string, designation: string): Promise<PermissionGroup | undefined> {
    const permissionsRef = this.db.collection("permission_groups");
    const snapshot = await permissionsRef
      .where("department", "==", department)
      .where("designation", "==", designation)
      .get();
    
    if (snapshot.empty) return undefined;
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    return {
      id: doc.id,
      name: data.name,
      department: data.department,
      designation: data.designation,
      permissions: data.permissions || [],
      canApprove: data.canApprove || false,
      maxApprovalAmount: data.maxApprovalAmount || null,
      createdAt: data.createdAt?.toDate() || new Date()
    } as PermissionGroup;
  }

  async listPermissionGroups(): Promise<PermissionGroup[]> {
    const permissionsCollection = this.db.collection("permission_groups");
    const snapshot = await permissionsCollection.get();
    return snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        department: data.department,
        designation: data.designation,
        permissions: data.permissions || [],
        canApprove: data.canApprove || false,
        maxApprovalAmount: data.maxApprovalAmount || null,
        createdAt: data.createdAt?.toDate() || new Date()
      } as PermissionGroup;
    });
  }

  async createPermissionGroup(data: z.infer<typeof insertPermissionGroupSchema>): Promise<PermissionGroup> {
    const validatedData = insertPermissionGroupSchema.parse(data);
    const permissionRef = this.db.collection("permission_groups").doc();
    
    const permissionData = {
      ...validatedData,
      createdAt: Timestamp.now()
    };
    
    await permissionRef.set(permissionData);
    
    return {
      id: permissionRef.id,
      ...validatedData,
      createdAt: new Date()
    } as PermissionGroup;
  }

  async updatePermissionGroup(id: string, data: Partial<z.infer<typeof insertPermissionGroupSchema>>): Promise<PermissionGroup> {
    const permissionDoc = this.db.collection("permission_groups").doc(id);
    const updateData = { ...data, updatedAt: Timestamp.now() };
    
    await permissionDoc.update(updateData);
    const updatedDoc = await permissionDoc.get();
    
    if (!updatedDoc.exists) throw new Error("Permission group not found");
    const updatedData = updatedDoc.data() || {};
    
    return {
      id: updatedDoc.id,
      name: updatedData.name,
      department: updatedData.department,
      designation: updatedData.designation,
      permissions: updatedData.permissions || [],
      canApprove: updatedData.canApprove || false,
      maxApprovalAmount: updatedData.maxApprovalAmount || null,
      createdAt: updatedData.createdAt?.toDate() || new Date()
    } as PermissionGroup;
  }

  async deletePermissionGroup(id: string): Promise<boolean> {
    const permissionDoc = this.db.collection("permission_groups").doc(id);
    await permissionDoc.delete();
    return true;
  }

  // User permission utility methods
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.getUser(userId);
    if (!user || !user.department || !user.designation) return [];
    
    const permissionGroup = await this.getPermissionsByDepartmentAndDesignation(user.department, user.designation);
    return permissionGroup?.permissions || [];
  }

  async checkUserPermission(userId: string, permission: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return userPermissions.includes(permission);
  }

  async getUserApprovalLimits(userId: string): Promise<{ canApprove: boolean; maxAmount: number | null }> {
    const user = await this.getUser(userId);
    if (!user || !user.department || !user.designation) {
      return { canApprove: false, maxAmount: null };
    }
    
    const permissionGroup = await this.getPermissionsByDepartmentAndDesignation(user.department, user.designation);
    return {
      canApprove: permissionGroup?.canApprove || false,
      maxAmount: permissionGroup?.maxApprovalAmount || null
    };
  }

  // Check effective user permission based on department + designation
  async checkEffectiveUserPermission(userId: string, permission: string): Promise<boolean> {
    try {
      console.log(`SERVER PERMISSION CHECK: Checking permission '${permission}' for user '${userId}'`);
      const user = await this.getUser(userId);
      if (!user) {
        console.log(`SERVER PERMISSION CHECK: User '${userId}' not found`);
        return false;
      }
      
      console.log(`SERVER PERMISSION CHECK: User found - role: ${user.role}, department: ${user.department}, designation: ${user.designation}`);
      
      // Master admin has all permissions
      if (user.role === "master_admin") {
        console.log(`SERVER PERMISSION CHECK: Master admin detected, granting permission '${permission}'`);
        return true;
      }
      
      // If user doesn't have department or designation, deny access
      if (!user.department || !user.designation) {
        console.log(`SERVER PERMISSION CHECK: User missing department or designation, denying access`);
        return false;
      }
      
      // Import permission calculation logic from shared schema
      const { getEffectivePermissions } = await import("@shared/schema");
      const effectivePermissions = getEffectivePermissions(user.department, user.designation);
      
      const hasPermission = effectivePermissions.includes(permission);
      console.log(`SERVER PERMISSION CHECK: Effective permissions check result: ${hasPermission} for permission '${permission}'`);
      
      return hasPermission;
    } catch (error) {
      console.error("SERVER PERMISSION CHECK ERROR:", error);
      return false;
    }
  }

  // Audit logging implementation
  async createAuditLog(data: z.infer<typeof insertAuditLogSchema>): Promise<AuditLog> {
    const auditDoc = this.db.collection("audit_logs").doc();
    const auditLog = {
      id: auditDoc.id,
      ...data,
      timestamp: new Date(),
      createdAt: new Date()
    };
    
    await auditDoc.set({
      ...auditLog,
      timestamp: Timestamp.fromDate(auditLog.timestamp),
      createdAt: Timestamp.fromDate(auditLog.createdAt)
    });
    
    return auditLog as AuditLog;
  }

  async getAuditLogs(filters?: { userId?: string; entityType?: string; startDate?: Date; endDate?: Date }): Promise<AuditLog[]> {
    let query: Query = this.db.collection("audit_logs");
    
    if (filters?.userId) {
      query = query.where("userId", "==", filters.userId);
    }
    if (filters?.entityType) {
      query = query.where("entityType", "==", filters.entityType);
    }
    if (filters?.startDate) {
      query = query.where("timestamp", ">=", Timestamp.fromDate(filters.startDate));
    }
    if (filters?.endDate) {
      query = query.where("timestamp", "<=", Timestamp.fromDate(filters.endDate));
    }
    
    const snapshot = await query.orderBy("timestamp", "desc").limit(100).get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date()
      } as AuditLog;
    });
  }

  async listOfficeLocations(): Promise<OfficeLocation[]> {
    const locationsCollection = this.db.collection("office_locations");
    const snapshot = await locationsCollection.get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        radius: data.radius,
        createdAt: data.createdAt?.toDate() || new Date()
      } as OfficeLocation;
    });
  }

  async getOfficeLocation(id: string): Promise<OfficeLocation | undefined> {
    const locationDoc = this.db.collection("office_locations").doc(id);
    const docSnap = await locationDoc.get();
    if (!docSnap.exists) return undefined;
    const data = docSnap.data() || {};
    return { id: docSnap.id, ...data } as OfficeLocation;
  }

  async createOfficeLocation(
    data: z.infer<typeof insertOfficeLocationSchema>,
  ): Promise<OfficeLocation> {
    const validatedData = insertOfficeLocationSchema.parse(data);
    const locationsRef = this.db.collection("office_locations");
    
    const locationDoc = await locationsRef.add({
      ...validatedData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return { 
      id: locationDoc.id,
      ...validatedData 
    } as OfficeLocation;
  }

  async updateOfficeLocation(
    id: string,
    data: Partial<z.infer<typeof insertOfficeLocationSchema>>,
  ): Promise<OfficeLocation> {
    const validatedData = insertOfficeLocationSchema.partial().parse(data);
    const locationDoc = this.db.collection("office_locations").doc(id);
    
    await locationDoc.update({
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    
    const updatedDoc = await locationDoc.get();
    if (!updatedDoc.exists) throw new Error("Office location not found");
    
    const docData = updatedDoc.data() || {};
    return { 
      id: updatedDoc.id, 
      name: docData.name,
      latitude: docData.latitude,
      longitude: docData.longitude,
      radius: docData.radius
    } as OfficeLocation;
  }

  async deleteOfficeLocation(id: string): Promise<void> {
    const locationDoc = this.db.collection("office_locations").doc(id);
    await locationDoc.delete();
  }

  async listCustomers(): Promise<Customer[]> {
    const customersCollection = this.db.collection("customers");
    const snapshot = await customersCollection.get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Customer;
    });
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const customerDoc = this.db.collection("customers").doc(id);
    const docSnap = await customerDoc.get();
    
    if (!docSnap.exists) return undefined;
    
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address,
      createdAt: data.createdAt?.toDate() || new Date()
    } as Customer;
  }

  async createCustomer(
    data: z.infer<typeof insertCustomerSchema>,
  ): Promise<Customer> {
    const validatedData = insertCustomerSchema.parse(data);
    const customersRef = this.db.collection("customers");
    
    const customerDoc = await customersRef.add({
      ...validatedData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return {
      id: customerDoc.id,
      ...validatedData,
      createdAt: new Date(),
    } as Customer;
  }

  async updateCustomer(
    id: string,
    data: Partial<z.infer<typeof insertCustomerSchema>>,
  ): Promise<Customer> {
    const validatedData = insertCustomerSchema.partial().parse(data);
    const customerDoc = this.db.collection("customers").doc(id);
    
    await customerDoc.update({
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    
    const updatedDoc = await customerDoc.get();
    if (!updatedDoc.exists) throw new Error("Customer not found");
    
    const updatedData = updatedDoc.data() || {};
    return {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
    } as Customer;
  }

  async deleteCustomer(id: string): Promise<void> {
    const customerDoc = this.db.collection("customers").doc(id);
    await customerDoc.delete();
  }

  async listProducts(): Promise<Product[]> {
    const productsCollection = this.db.collection("products");
    const snapshot = await productsCollection.get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        name: data.name,
        description: data.description,
        price: data.price,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Product;
    });
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const productDoc = this.db.collection("products").doc(id);
    const docSnap = await productDoc.get();
    
    if (!docSnap.exists) return undefined;
    
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      name: data.name,
      description: data.description,
      price: data.price,
      createdAt: data.createdAt?.toDate() || new Date()
    } as Product;
  }

  async createProduct(
    data: z.infer<typeof insertProductSchema>,
  ): Promise<Product> {
    const validatedData = insertProductSchema.parse(data);
    const productsRef = this.db.collection("products");
    
    const productDoc = await productsRef.add({
      ...validatedData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return {
      id: productDoc.id,
      ...validatedData,
      createdAt: new Date(),
    } as Product;
  }

  async updateProduct(
    id: string,
    data: Partial<z.infer<typeof insertProductSchema>>,
  ): Promise<Product> {
    const validatedData = insertProductSchema.partial().parse(data);
    const productDoc = this.db.collection("products").doc(id);
    
    await productDoc.update({
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    
    const updatedDoc = await productDoc.get();
    if (!updatedDoc.exists) throw new Error("Product not found");
    
    const updatedData = updatedDoc.data() || {};
    return {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
    } as Product;
  }

  async deleteProduct(id: string): Promise<void> {
    const productDoc = this.db.collection("products").doc(id);
    await productDoc.delete();
  }

  async listQuotations(): Promise<Quotation[]> {
    const quotationsCollection = this.db.collection("quotations");
    const snapshot = await quotationsCollection.get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        customerId: data.customerId,
        products: data.products,
        total: data.total,
        status: data.status,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Quotation;
    });
  }

  async getQuotation(id: string): Promise<Quotation | undefined> {
    const quotationDoc = this.db.collection("quotations").doc(id);
    const docSnap = await quotationDoc.get();
    
    if (!docSnap.exists) return undefined;
    
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      customerId: data.customerId,
      products: data.products,
      total: data.total,
      status: data.status,
      createdAt: data.createdAt?.toDate() || new Date()
    } as Quotation;
  }

  async createQuotation(
    data: z.infer<typeof insertQuotationSchema>,
  ): Promise<Quotation> {
    const validatedData = insertQuotationSchema.parse(data);
    const quotationsRef = this.db.collection("quotations");
    
    const quotationDoc = await quotationsRef.add({
      ...validatedData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return {
      id: quotationDoc.id,
      ...validatedData,
      createdAt: new Date(),
    } as Quotation;
  }

  async updateQuotation(
    id: string,
    data: Partial<z.infer<typeof insertQuotationSchema>>,
  ): Promise<Quotation> {
    const validatedData = insertQuotationSchema.partial().parse(data);
    const quotationDoc = this.db.collection("quotations").doc(id);
    
    await quotationDoc.update({
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    
    const updatedDoc = await quotationDoc.get();
    if (!updatedDoc.exists) throw new Error("Quotation not found");
    
    const updatedData = updatedDoc.data() || {};
    return {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
    } as Quotation;
  }

  async deleteQuotation(id: string): Promise<void> {
    const quotationDoc = this.db.collection("quotations").doc(id);
    await quotationDoc.delete();
  }

  async listInvoices(): Promise<Invoice[]> {
    const invoicesCollection = this.db.collection("invoices");
    const snapshot = await invoicesCollection.get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        quotationId: data.quotationId,
        customerId: data.customerId,
        total: data.total,
        status: data.status,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Invoice;
    });
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const invoiceDoc = this.db.collection("invoices").doc(id);
    const docSnap = await invoiceDoc.get();
    
    if (!docSnap.exists) return undefined;
    
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      quotationId: data.quotationId,
      customerId: data.customerId,
      total: data.total,
      status: data.status,
      createdAt: data.createdAt?.toDate() || new Date()
    } as Invoice;
  }

  async createInvoice(
    data: z.infer<typeof insertInvoiceSchema>,
  ): Promise<Invoice> {
    const validatedData = insertInvoiceSchema.parse(data);
    const invoicesRef = this.db.collection("invoices");
    
    const invoiceDoc = await invoicesRef.add({
      ...validatedData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return {
      id: invoiceDoc.id,
      ...validatedData,
      createdAt: new Date(),
    } as Invoice;
  }

  async updateInvoice(
    id: string,
    data: Partial<z.infer<typeof insertInvoiceSchema>>,
  ): Promise<Invoice> {
    const validatedData = insertInvoiceSchema.partial().parse(data);
    const invoiceDoc = this.db.collection("invoices").doc(id);
    
    await invoiceDoc.update({
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    
    const updatedDoc = await invoiceDoc.get();
    if (!updatedDoc.exists) throw new Error("Invoice not found");
    
    const updatedData = updatedDoc.data() || {};
    return {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
    } as Invoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    const invoiceDoc = this.db.collection("invoices").doc(id);
    await invoiceDoc.delete();
  }

  async createAttendance(
    data: z.infer<typeof insertAttendanceSchema>,
  ): Promise<Attendance> {
    const userDoc = await this.db.collection("users").doc(data.userId).get();
    const attendanceDate = data.date ? new Date(data.date) : new Date();
    const dateString = attendanceDate.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const validatedData = insertAttendanceSchema.parse({
      ...data,
      date: data.date || new Date(),
      checkInTime: data.checkInTime || new Date(),
      checkOutTime: data.checkOutTime,
    });
    
    // Filter out undefined values to prevent Firestore errors
    const cleanData = Object.fromEntries(
      Object.entries(validatedData).filter(([_, value]) => value !== undefined)
    );

    const attendanceRef = this.db.collection("attendance");
    const attendanceDoc = await attendanceRef.add({
      ...cleanData,
      date: Timestamp.fromDate(validatedData.date),
      checkInTime: validatedData.checkInTime ? Timestamp.fromDate(validatedData.checkInTime) : Timestamp.now(),
      checkOutTime: validatedData.checkOutTime ? Timestamp.fromDate(validatedData.checkOutTime) : null,
      location: validatedData.attendanceType || "office",
      dateString: dateString,
      userEmail: userDoc.exists ? userDoc.data()?.email || "" : "",
      userDepartment: userDoc.exists ? userDoc.data()?.department || null : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return {
      id: attendanceDoc.id,
      ...validatedData,
      userEmail: userDoc.exists ? userDoc.data()?.email || "" : "",
      userDepartment: userDoc.exists ? userDoc.data()?.department || null : null,
      date: new Date(),
      checkInTime: validatedData.checkInTime instanceof Timestamp ? validatedData.checkInTime.toDate() : undefined,
      checkOutTime: validatedData.checkOutTime instanceof Timestamp ? validatedData.checkOutTime.toDate() : undefined,
    } as Attendance;
  }

  async updateAttendance(
    id: string,
    data: Partial<z.infer<typeof insertAttendanceSchema>>,
  ): Promise<Attendance> {
    // First validate the data without timestamp conversion
    const validatedData = insertAttendanceSchema.partial().parse(data);
    
    // Then prepare for Firestore with timestamp conversion
    const firestoreData: any = {
      ...validatedData,
      updatedAt: Timestamp.now(),
    };
    
    // Convert dates to Firestore timestamps, only if they exist
    if (validatedData.date) {
      firestoreData.date = Timestamp.fromDate(validatedData.date);
    }
    if (validatedData.checkInTime) {
      firestoreData.checkInTime = Timestamp.fromDate(validatedData.checkInTime);
    }
    if (validatedData.checkOutTime) {
      firestoreData.checkOutTime = Timestamp.fromDate(validatedData.checkOutTime);
    }
    
    // Remove undefined values to avoid Firestore errors
    Object.keys(firestoreData).forEach(key => {
      if (firestoreData[key] === undefined) {
        delete firestoreData[key];
      }
    });
    
    const attendanceDoc = this.db.collection("attendance").doc(id);
    
    await attendanceDoc.update(firestoreData);
    
    const updatedDoc = await attendanceDoc.get();
    if (!updatedDoc.exists) throw new Error("Attendance not found");
    
    const updatedData = updatedDoc.data() || {};
    return {
      id: updatedDoc.id,
      ...updatedData,
      date: updatedData.date?.toDate() || new Date(),
      checkInTime: updatedData.checkInTime?.toDate() || null,
      checkOutTime: updatedData.checkOutTime?.toDate() || null,
    } as Attendance;
  }

  async getAttendanceByUserAndDate(
    userId: string,
    date: Date,
  ): Promise<Attendance | undefined> {
    const dateStr = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    const attendanceRef = this.db.collection("attendance");
    const snapshot = await attendanceRef
      .where("userId", "==", userId)
      .where("dateString", "==", dateStr)
      .limit(1)
      .get();
    
    if (snapshot.empty) return undefined;
    
    const record = snapshot.docs[0];
    const data = record.data() || {};
    
    return {
      id: record.id,
      ...data,
      date: data.date?.toDate() || new Date(),
      checkInTime: data.checkInTime?.toDate() || null,
      checkOutTime: data.checkOutTime?.toDate() || null,
    } as Attendance;
  }

  async listAttendanceByUser(userId: string): Promise<Attendance[]> {
    const attendanceRef = this.db.collection("attendance");
    const snapshot = await attendanceRef
      .where("userId", "==", userId)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate() || new Date(),
        checkInTime: data.checkInTime?.toDate() || null,
        checkOutTime: data.checkOutTime?.toDate() || null,
      } as Attendance;
    });
  }

  async listAttendanceByDate(date: Date): Promise<Attendance[]> {
    const startOfDay = Timestamp.fromDate(new Date(date.setHours(0, 0, 0, 0)));
    const endOfDay = Timestamp.fromDate(
      new Date(date.setHours(23, 59, 59, 999)),
    );
    
    const attendanceRef = this.db.collection("attendance");
    const snapshot = await attendanceRef
      .where("date", ">=", startOfDay)
      .where("date", "<=", endOfDay)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate() || new Date(),
        checkInTime: data.checkInTime?.toDate() || null,
        checkOutTime: data.checkOutTime?.toDate() || null,
      } as Attendance;
    });
  }

  async listAttendanceBetweenDates(
    startDate: Date,
    endDate: Date,
  ): Promise<Attendance[]> {
    const startTimestamp = Timestamp.fromDate(new Date(startDate.setHours(0, 0, 0, 0)));
    const endTimestamp = Timestamp.fromDate(
      new Date(endDate.setHours(23, 59, 59, 999)),
    );
    
    const attendanceRef = this.db.collection("attendance");
    const snapshot = await attendanceRef
      .where("date", ">=", startTimestamp)
      .where("date", "<=", endTimestamp)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate() || new Date(),
        checkInTime: data.checkInTime?.toDate() || null,
        checkOutTime: data.checkOutTime?.toDate() || null,
      } as Attendance;
    });
  }

  async listAttendanceByUserBetweenDates(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Attendance[]> {
    const startTimestamp = Timestamp.fromDate(new Date(startDate.setHours(0, 0, 0, 0)));
    const endTimestamp = Timestamp.fromDate(
      new Date(endDate.setHours(23, 59, 59, 999)),
    );
    
    const attendanceRef = this.db.collection("attendance");
    const snapshot = await attendanceRef
      .where("userId", "==", userId)
      .where("date", ">=", startTimestamp)
      .where("date", "<=", endTimestamp)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate() || new Date(),
        checkInTime: data.checkInTime?.toDate() || null,
        checkOutTime: data.checkOutTime?.toDate() || null,
      } as Attendance;
    });
  }

  async getAttendance(id: string): Promise<Attendance | undefined> {
    const attendanceDoc = this.db.collection("attendance").doc(id);
    const docSnap = await attendanceDoc.get();
    if (!docSnap.exists) return undefined;
    
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      ...data,
      date: data.date?.toDate() || new Date(),
      checkInTime: data.checkInTime?.toDate() || null,
      checkOutTime: data.checkOutTime?.toDate() || null,
    } as Attendance;
  }

  async getUserAttendanceForDate(userId: string, date: string): Promise<Attendance | undefined> {
    const targetDate = new Date(date);
    return this.getAttendanceByUserAndDate(userId, targetDate);
  }

  async listAttendanceBetweenDates(
    startDate: Date,
    endDate: Date,
  ): Promise<Attendance[]> {
    const start = Timestamp.fromDate(startDate);
    const end = Timestamp.fromDate(endDate);
    
    const attendanceRef = this.db.collection("attendance");
    const snapshot = await attendanceRef
      .where("date", ">=", start)
      .where("date", "<=", end)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate() || new Date(),
        checkInTime: data.checkInTime?.toDate() || null,
        checkOutTime: data.checkOutTime?.toDate() || null,
      } as Attendance;
    });
  }

  async getLeave(id: string): Promise<Leave | undefined> {
    const leaveDoc = this.db.collection("leaves").doc(id);
    const docSnap = await leaveDoc.get();
    
    if (!docSnap.exists) return undefined;
    
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      ...data,
      startDate: data.startDate?.toDate() || new Date(),
      endDate: data.endDate?.toDate() || new Date(),
      createdAt: data.createdAt?.toDate() || new Date(),
    } as Leave;
  }

  async listLeavesByUser(userId: string): Promise<Leave[]> {
    const leavesRef = this.db.collection("leaves");
    const snapshot = await leavesRef
      .where("userId", "==", userId)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        startDate: data.startDate?.toDate() || new Date(),
        endDate: data.endDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Leave;
    });
  }

  async listPendingLeaves(): Promise<Leave[]> {
    const leavesRef = this.db.collection("leaves");
    const snapshot = await leavesRef
      .where("status", "==", "pending")
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        startDate: data.startDate?.toDate() || new Date(),
        endDate: data.endDate?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Leave;
    });
  }

  async createLeave(data: z.infer<typeof insertLeaveSchema>): Promise<Leave> {
    const validatedData = insertLeaveSchema.parse({
      ...data,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
    });
    
    const leavesRef = this.db.collection("leaves");
    const leaveDoc = await leavesRef.add({
      ...validatedData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    
    return {
      id: leaveDoc.id,
      ...validatedData,
      startDate: new Date(),
      endDate: new Date(),
      createdAt: new Date(),
    } as Leave;
  }

  async updateLeave(
    id: string,
    data: Partial<z.infer<typeof insertLeaveSchema>>,
  ): Promise<Leave> {
    const validatedData = insertLeaveSchema.partial().parse({
      ...data,
      startDate: data.startDate
        ? Timestamp.fromDate(data.startDate)
        : undefined,
      endDate: data.endDate ? Timestamp.fromDate(data.endDate) : undefined,
    });
    
    const leaveDoc = this.db.collection("leaves").doc(id);
    
    await leaveDoc.update({ 
      ...validatedData, 
      updatedAt: Timestamp.now() 
    });
    
    const updatedDoc = await leaveDoc.get();
    if (!updatedDoc.exists) throw new Error("Leave not found");
    
    const updatedData = updatedDoc.data() || {};
    return {
      id: updatedDoc.id,
      ...updatedData,
      startDate: updatedData.startDate?.toDate() || new Date(),
      endDate: updatedData.endDate?.toDate() || new Date(),
      createdAt: updatedData.createdAt?.toDate() || new Date(),
    } as Leave;
  }

  // ===================== Phase 2: Enterprise RBAC Implementation =====================

  // Role management
  async getRole(id: string): Promise<Role | undefined> {
    const roleDoc = this.db.collection("roles").doc(id);
    const docSnap = await roleDoc.get();
    if (!docSnap.exists) return undefined;
    
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Role;
  }

  async getRoleByName(name: string): Promise<Role | undefined> {
    const rolesRef = this.db.collection("roles");
    const snapshot = await rolesRef.where("name", "==", name).get();
    if (snapshot.empty) return undefined;
    
    const doc = snapshot.docs[0];
    const data = doc.data() || {};
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Role;
  }

  async listRoles(): Promise<Role[]> {
    const rolesRef = this.db.collection("roles");
    const snapshot = await rolesRef.get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Role;
    });
  }

  async createRole(data: z.infer<typeof insertRoleSchema>): Promise<Role> {
    const validatedData = insertRoleSchema.parse(data);
    const roleDoc = this.db.collection("roles").doc();
    
    const roleData = {
      ...validatedData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
    
    await roleDoc.set(roleData);
    
    return {
      id: roleDoc.id,
      ...validatedData,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Role;
  }

  async updateRole(id: string, data: Partial<z.infer<typeof insertRoleSchema>>): Promise<Role> {
    const validatedData = insertRoleSchema.partial().parse(data);
    const roleDoc = this.db.collection("roles").doc(id);
    
    await roleDoc.update({ 
      ...validatedData, 
      updatedAt: Timestamp.now() 
    });
    
    const updatedDoc = await roleDoc.get();
    if (!updatedDoc.exists) throw new Error("Role not found");
    
    const updatedData = updatedDoc.data() || {};
    return {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
      updatedAt: updatedData.updatedAt?.toDate() || new Date(),
    } as Role;
  }

  async deleteRole(id: string): Promise<boolean> {
    try {
      await this.db.collection("roles").doc(id).delete();
      return true;
    } catch (error) {
      console.error("Error deleting role:", error);
      return false;
    }
  }

  // User role assignments
  async getUserRoleAssignments(userId: string): Promise<UserRoleAssignment[]> {
    const assignmentsRef = this.db.collection("user_role_assignments");
    const snapshot = await assignmentsRef
      .where("userId", "==", userId)
      .where("isActive", "==", true)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        effectiveFrom: data.effectiveFrom?.toDate() || new Date(),
        effectiveTo: data.effectiveTo?.toDate() || null,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as UserRoleAssignment;
    });
  }

  async getRoleAssignment(id: string): Promise<UserRoleAssignment | undefined> {
    const assignmentDoc = this.db.collection("user_role_assignments").doc(id);
    const docSnap = await assignmentDoc.get();
    if (!docSnap.exists) return undefined;
    
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      ...data,
      effectiveFrom: data.effectiveFrom?.toDate() || new Date(),
      effectiveTo: data.effectiveTo?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
    } as UserRoleAssignment;
  }

  async assignUserRole(data: z.infer<typeof insertUserRoleAssignmentSchema>): Promise<UserRoleAssignment> {
    const validatedData = insertUserRoleAssignmentSchema.parse(data);
    const assignmentDoc = this.db.collection("user_role_assignments").doc();
    
    const assignmentData = {
      ...validatedData,
      effectiveFrom: Timestamp.fromDate(validatedData.effectiveFrom),
      effectiveTo: validatedData.effectiveTo ? Timestamp.fromDate(validatedData.effectiveTo) : null,
      createdAt: Timestamp.now(),
    };
    
    await assignmentDoc.set(assignmentData);
    
    return {
      id: assignmentDoc.id,
      ...validatedData,
    } as UserRoleAssignment;
  }

  async revokeUserRole(userId: string, roleId: string): Promise<boolean> {
    try {
      const assignmentsRef = this.db.collection("user_role_assignments");
      const snapshot = await assignmentsRef
        .where("userId", "==", userId)
        .where("roleId", "==", roleId)
        .where("isActive", "==", true)
        .get();
      
      const batch = this.db.batch();
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { isActive: false, updatedAt: Timestamp.now() });
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error("Error revoking user role:", error);
      return false;
    }
  }

  // Permission overrides
  async getUserPermissionOverrides(userId: string): Promise<PermissionOverride[]> {
    const overridesRef = this.db.collection("permission_overrides");
    const snapshot = await overridesRef
      .where("userId", "==", userId)
      .get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        effectiveFrom: data.effectiveFrom?.toDate() || new Date(),
        effectiveTo: data.effectiveTo?.toDate() || null,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as PermissionOverride;
    });
  }

  async createPermissionOverride(data: z.infer<typeof insertPermissionOverrideSchema>): Promise<PermissionOverride> {
    const validatedData = insertPermissionOverrideSchema.parse(data);
    const overrideDoc = this.db.collection("permission_overrides").doc();
    
    const overrideData = {
      ...validatedData,
      effectiveFrom: Timestamp.fromDate(validatedData.effectiveFrom),
      effectiveTo: validatedData.effectiveTo ? Timestamp.fromDate(validatedData.effectiveTo) : null,
      createdAt: Timestamp.now(),
    };
    
    await overrideDoc.set(overrideData);
    
    return {
      id: overrideDoc.id,
      ...validatedData,
    } as PermissionOverride;
  }

  async revokePermissionOverride(id: string): Promise<boolean> {
    try {
      await this.db.collection("permission_overrides").doc(id).delete();
      return true;
    } catch (error) {
      console.error("Error revoking permission override:", error);
      return false;
    }
  }

  // Enterprise permission resolution
  async getEffectiveUserPermissions(userId: string): Promise<string[]> {
    const user = await this.getUser(userId);
    if (!user) return [];

    let permissions: Set<string> = new Set();

    // Master admin gets all permissions
    if (user.role === "master_admin") {
      // Import the required functions
      const { getEffectivePermissions } = await import("@shared/schema");
      const allPermissions = getEffectivePermissions(user.department || "cre", user.designation || "director");
      // Add system-level permissions for master admin
      allPermissions.forEach(p => permissions.add(p));
      permissions.add("system.settings");
      permissions.add("system.backup");
      permissions.add("system.audit");
      permissions.add("users.delete");
      permissions.add("permissions.assign");
      return Array.from(permissions);
    }

    // Enterprise RBAC: Department + Designation based permissions
    if (user.department && user.designation) {
      try {
        const { getEffectivePermissions } = await import("@shared/schema");
        const departmentDesignationPermissions = getEffectivePermissions(user.department, user.designation);
        departmentDesignationPermissions.forEach(p => permissions.add(p));
      } catch (error) {
        console.error("Error loading schema functions:", error);
        // Fallback to permission groups
        const permissionGroup = await this.getPermissionsByDepartmentAndDesignation(
          user.department, 
          user.designation
        );
        if (permissionGroup) {
          permissionGroup.permissions.forEach(p => permissions.add(p));
        }
      }
    }

    // Phase 2: Additional Role-based permissions
    const roleAssignments = await this.getUserRoleAssignments(userId);
    for (const assignment of roleAssignments) {
      const role = await this.getRole(assignment.roleId);
      if (role) {
        role.permissions.forEach(p => permissions.add(p));
      }
    }

    // Permission overrides (can grant or revoke specific permissions)
    const overrides = await this.getUserPermissionOverrides(userId);
    const currentDate = new Date();
    
    for (const override of overrides) {
      const isActive = (!override.effectiveTo || override.effectiveTo > currentDate) &&
                      override.effectiveFrom <= currentDate;
      
      if (isActive) {
        if (override.granted) {
          permissions.add(override.permission);
        } else {
          permissions.delete(override.permission);
        }
      }
    }

    return Array.from(permissions);
  }



  async getEffectiveUserApprovalLimits(userId: string): Promise<{ canApprove: boolean; maxAmount: Record<string, number | null> }> {
    const user = await this.getUser(userId);
    if (!user) return { canApprove: false, maxAmount: {} };

    let maxAmount: Record<string, number | null> = {
      quotations: null,
      invoices: null,
      expenses: null,
    };
    let canApprove = false;

    // Phase 1: Legacy approval limits
    const legacyLimits = await this.getUserApprovalLimits(userId);
    if (legacyLimits.canApprove) {
      canApprove = true;
      if (legacyLimits.maxAmount !== null) {
        maxAmount.quotations = legacyLimits.maxAmount;
        maxAmount.invoices = legacyLimits.maxAmount;
        maxAmount.expenses = legacyLimits.maxAmount;
      }
    }

    // Phase 2: Role-based approval limits
    const roleAssignments = await this.getUserRoleAssignments(userId);
    for (const assignment of roleAssignments) {
      const role = await this.getRole(assignment.roleId);
      if (role?.approvalLimits) {
        canApprove = true;
        
        if (role.approvalLimits.quotations !== undefined) {
          maxAmount.quotations = Math.max(maxAmount.quotations || 0, role.approvalLimits.quotations || 0);
        }
        if (role.approvalLimits.invoices !== undefined) {
          maxAmount.invoices = Math.max(maxAmount.invoices || 0, role.approvalLimits.invoices || 0);
        }
        if (role.approvalLimits.expenses !== undefined) {
          maxAmount.expenses = Math.max(maxAmount.expenses || 0, role.approvalLimits.expenses || 0);
        }
      }
    }

    return { canApprove, maxAmount };
  }

  // Audit logging
  async createAuditLog(data: z.infer<typeof insertAuditLogSchema>): Promise<AuditLog> {
    const validatedData = insertAuditLogSchema.parse(data);
    const auditDoc = this.db.collection("audit_logs").doc();
    
    const auditData = {
      ...validatedData,
      createdAt: Timestamp.now(),
    };
    
    await auditDoc.set(auditData);
    
    return {
      id: auditDoc.id,
      ...validatedData,
      createdAt: new Date(),
    } as AuditLog;
  }

  async getAuditLogs(filters?: { userId?: string; entityType?: string; startDate?: Date; endDate?: Date }): Promise<AuditLog[]> {
    let query = this.db.collection("audit_logs").orderBy("createdAt", "desc");
    
    if (filters?.userId) {
      query = query.where("userId", "==", filters.userId);
    }
    if (filters?.entityType) {
      query = query.where("entityType", "==", filters.entityType);
    }
    if (filters?.startDate) {
      query = query.where("createdAt", ">=", Timestamp.fromDate(filters.startDate));
    }
    if (filters?.endDate) {
      query = query.where("createdAt", "<=", Timestamp.fromDate(filters.endDate));
    }
    
    const snapshot = await query.limit(1000).get();
    
    return snapshot.docs.map(doc => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as AuditLog;
    });
  }

  // ============================================
  // PAYROLL SYSTEM STORAGE METHODS
  // ============================================

  // Salary Structure Management
  async getSalaryStructure(id: string): Promise<SalaryStructure | undefined> {
    const doc = await this.db.collection('salaryStructures').doc(id).get();
    if (!doc.exists) return undefined;
    
    const data = doc.data()!;
    return {
      id: doc.id,
      ...data,
      effectiveFrom: data.effectiveFrom?.toDate() || new Date(),
      effectiveTo: data.effectiveTo?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as SalaryStructure;
  }

  async getSalaryStructureByUser(userId: string): Promise<SalaryStructure | undefined> {
    const querySnapshot = await this.db.collection('salaryStructures')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .orderBy('effectiveFrom', 'desc')
      .limit(1)
      .get();
    
    if (querySnapshot.empty) return undefined;
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      effectiveFrom: data.effectiveFrom?.toDate() || new Date(),
      effectiveTo: data.effectiveTo?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as SalaryStructure;
  }

  async createSalaryStructure(data: z.infer<typeof insertSalaryStructureSchema>): Promise<SalaryStructure> {
    const doc = this.db.collection('salaryStructures').doc();
    const salaryData = {
      ...data,
      id: doc.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await doc.set(salaryData);
    return salaryData as SalaryStructure;
  }

  async updateSalaryStructure(id: string, data: Partial<z.infer<typeof insertSalaryStructureSchema>>): Promise<SalaryStructure> {
    const doc = this.db.collection('salaryStructures').doc(id);
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    
    await doc.update(updateData);
    
    const updated = await doc.get();
    const updatedData = updated.data()!;
    return {
      id: updated.id,
      ...updatedData,
      effectiveFrom: updatedData.effectiveFrom?.toDate() || new Date(),
      effectiveTo: updatedData.effectiveTo?.toDate() || null,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
      updatedAt: updatedData.updatedAt?.toDate() || new Date(),
    } as SalaryStructure;
  }

  async listSalaryStructures(): Promise<SalaryStructure[]> {
    const querySnapshot = await this.db.collection('salaryStructures')
      .orderBy('createdAt', 'desc')
      .get();
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        effectiveFrom: data.effectiveFrom?.toDate() || new Date(),
        effectiveTo: data.effectiveTo?.toDate() || null,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as SalaryStructure;
    });
  }

  // Payroll Management
  async getPayroll(id: string): Promise<Payroll | undefined> {
    const doc = await this.db.collection('payrolls').doc(id).get();
    if (!doc.exists) return undefined;
    
    const data = doc.data()!;
    return {
      id: doc.id,
      ...data,
      paidOn: data.paidOn?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Payroll;
  }

  async getPayrollByUserAndMonth(userId: string, month: number, year: number): Promise<Payroll | undefined> {
    const querySnapshot = await this.db.collection('payrolls')
      .where('userId', '==', userId)
      .where('month', '==', month)
      .where('year', '==', year)
      .limit(1)
      .get();
    
    if (querySnapshot.empty) return undefined;
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      paidOn: data.paidOn?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Payroll;
  }

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

  async updatePayroll(id: string, data: Partial<z.infer<typeof insertPayrollSchema>>): Promise<Payroll> {
    const doc = this.db.collection('payrolls').doc(id);
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    
    await doc.update(updateData);
    
    const updated = await doc.get();
    const updatedData = updated.data()!;
    return {
      id: updated.id,
      ...updatedData,
      paidOn: updatedData.paidOn?.toDate() || null,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
      updatedAt: updatedData.updatedAt?.toDate() || new Date(),
    } as Payroll;
  }

  async listPayrolls(filters?: { month?: number; year?: number; department?: string; status?: string }): Promise<Payroll[]> {
    let query = this.db.collection('payrolls').orderBy('createdAt', 'desc') as any;
    
    if (filters?.month) {
      query = query.where('month', '==', filters.month);
    }
    if (filters?.year) {
      query = query.where('year', '==', filters.year);
    }
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    
    const querySnapshot = await query.get();
    
    return querySnapshot.docs.map((doc: any) => {
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

  async listPayrollsByUser(userId: string): Promise<Payroll[]> {
    const querySnapshot = await this.db.collection('payrolls')
      .where('userId', '==', userId)
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

  // Payroll Settings
  async getPayrollSettings(): Promise<PayrollSettings | undefined> {
    const querySnapshot = await this.db.collection('payrollSettings')
      .orderBy('updatedAt', 'desc')
      .limit(1)
      .get();
    
    if (querySnapshot.empty) return undefined;
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as PayrollSettings;
  }

  async updatePayrollSettings(data: z.infer<typeof insertPayrollSettingsSchema>): Promise<PayrollSettings> {
    const settingsData = {
      ...data,
      updatedAt: new Date(),
    };
    
    // Check if settings exist
    const existing = await this.getPayrollSettings();
    if (existing) {
      const doc = this.db.collection('payrollSettings').doc(existing.id);
      await doc.update(settingsData);
      return { ...existing, ...settingsData } as PayrollSettings;
    } else {
      const doc = this.db.collection('payrollSettings').doc();
      const newSettings = {
        ...settingsData,
        id: doc.id,
      };
      await doc.set(newSettings);
      return newSettings as PayrollSettings;
    }
  }

  // Salary Advances
  async getSalaryAdvance(id: string): Promise<SalaryAdvance | undefined> {
    const doc = await this.db.collection('salaryAdvances').doc(id).get();
    if (!doc.exists) return undefined;
    
    const data = doc.data()!;
    return {
      id: doc.id,
      ...data,
      requestDate: data.requestDate?.toDate() || new Date(),
      approvedDate: data.approvedDate?.toDate() || null,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as SalaryAdvance;
  }

  async createSalaryAdvance(data: z.infer<typeof insertSalaryAdvanceSchema>): Promise<SalaryAdvance> {
    const doc = this.db.collection('salaryAdvances').doc();
    const advanceData = {
      ...data,
      id: doc.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await doc.set(advanceData);
    return advanceData as SalaryAdvance;
  }

  async updateSalaryAdvance(id: string, data: Partial<z.infer<typeof insertSalaryAdvanceSchema>>): Promise<SalaryAdvance> {
    const doc = this.db.collection('salaryAdvances').doc(id);
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    
    await doc.update(updateData);
    
    const updated = await doc.get();
    const updatedData = updated.data()!;
    return {
      id: updated.id,
      ...updatedData,
      requestDate: updatedData.requestDate?.toDate() || new Date(),
      approvedDate: updatedData.approvedDate?.toDate() || null,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
      updatedAt: updatedData.updatedAt?.toDate() || new Date(),
    } as SalaryAdvance;
  }

  async listSalaryAdvances(filters?: { userId?: string; status?: string }): Promise<SalaryAdvance[]> {
    let query = this.db.collection('salaryAdvances').orderBy('requestDate', 'desc') as any;
    
    if (filters?.userId) {
      query = query.where('userId', '==', filters.userId);
    }
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    
    const querySnapshot = await query.get();
    
    return querySnapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        requestDate: data.requestDate?.toDate() || new Date(),
        approvedDate: data.approvedDate?.toDate() || null,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as SalaryAdvance;
    });
  }

  // Attendance Policies
  async getAttendancePolicy(id: string): Promise<AttendancePolicy | undefined> {
    const doc = await this.db.collection('attendancePolicies').doc(id).get();
    if (!doc.exists) return undefined;
    
    const data = doc.data()!;
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as AttendancePolicy;
  }

  async getAttendancePolicyByDepartment(department: string, designation?: string): Promise<AttendancePolicy | undefined> {
    let query = this.db.collection('attendancePolicies')
      .where('department', '==', department)
      .where('isActive', '==', true) as any;
    
    if (designation) {
      query = query.where('designation', '==', designation);
    }
    
    const querySnapshot = await query.limit(1).get();
    
    if (querySnapshot.empty) return undefined;
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as AttendancePolicy;
  }

  async createAttendancePolicy(data: z.infer<typeof insertAttendancePolicySchema>): Promise<AttendancePolicy> {
    const doc = this.db.collection('attendancePolicies').doc();
    const policyData = {
      ...data,
      id: doc.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await doc.set(policyData);
    return policyData as AttendancePolicy;
  }

  async updateAttendancePolicy(id: string, data: Partial<z.infer<typeof insertAttendancePolicySchema>>): Promise<AttendancePolicy> {
    const doc = this.db.collection('attendancePolicies').doc(id);
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    
    await doc.update(updateData);
    
    const updated = await doc.get();
    const updatedData = updated.data()!;
    return {
      id: updated.id,
      ...updatedData,
      createdAt: updatedData.createdAt?.toDate() || new Date(),
      updatedAt: updatedData.updatedAt?.toDate() || new Date(),
    } as AttendancePolicy;
  }

  async listAttendancePolicies(): Promise<AttendancePolicy[]> {
    const querySnapshot = await this.db.collection('attendancePolicies')
      .orderBy('createdAt', 'desc')
      .get();
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as AttendancePolicy;
    });
  }

  // Payroll Calculation Utilities
  async calculatePayroll(userId: string, month: number, year: number): Promise<z.infer<typeof insertPayrollSchema>> {
    // Get user's salary structure
    const salaryStructure = await this.getSalaryStructureByUser(userId);
    if (!salaryStructure) {
      throw new Error('No salary structure found for user');
    }

    // Get attendance summary for the month
    const attendanceSummary = await this.getMonthlyAttendanceSummary(userId, month, year);
    
    // Get payroll settings
    const settings = await this.getPayrollSettings();
    const defaultSettings = {
      pfRate: 12,
      esiRate: 1.75,
      tdsRate: 10,
      overtimeMultiplier: 1.5,
      standardWorkingHours: 8,
      standardWorkingDays: 22,
      leaveDeductionRate: 1,
      pfApplicableFromSalary: 15000,
      esiApplicableFromSalary: 21000,
    };
    const payrollSettings = settings || defaultSettings;

    // Calculate salary components
    const { workingDays, presentDays, absentDays, overtimeHours, leaveDays } = attendanceSummary;
    
    // Base salary calculations
    const dailySalary = salaryStructure.fixedSalary / payrollSettings.standardWorkingDays;
    const adjustedSalary = dailySalary * presentDays;
    
    // Overtime calculation
    const overtimePay = (salaryStructure.fixedSalary / (payrollSettings.standardWorkingDays * payrollSettings.standardWorkingHours)) * 
                       overtimeHours * payrollSettings.overtimeMultiplier;
    
    // Gross salary
    const grossSalary = adjustedSalary + (salaryStructure.hra || 0) + (salaryStructure.allowances || 0) + 
                       (salaryStructure.variableComponent || 0) + overtimePay;
    
    // Deductions
    const pfDeduction = grossSalary >= payrollSettings.pfApplicableFromSalary ? 
                       (salaryStructure.basicSalary * payrollSettings.pfRate) / 100 : 0;
    
    const esiDeduction = grossSalary >= payrollSettings.esiApplicableFromSalary ? 0 :
                        (grossSalary * payrollSettings.esiRate) / 100;
    
    const tdsDeduction = (grossSalary * payrollSettings.tdsRate) / 100;
    
    // Get salary advances
    const advances = await this.listSalaryAdvances({ 
      userId, 
      status: 'approved' 
    });
    
    const advanceDeduction = advances
      .filter(advance => {
        const startDate = new Date(advance.deductionStartYear, advance.deductionStartMonth - 1);
        const currentDate = new Date(year, month - 1);
        return startDate <= currentDate && advance.remainingAmount > 0;
      })
      .reduce((total, advance) => total + advance.monthlyDeduction, 0);
    
    const totalDeductions = pfDeduction + esiDeduction + tdsDeduction + advanceDeduction;
    const netSalary = grossSalary - totalDeductions;

    return {
      userId,
      employeeId: salaryStructure.employeeId,
      month,
      year,
      workingDays,
      presentDays,
      absentDays,
      overtimeHours,
      leaveDays,
      fixedSalary: salaryStructure.fixedSalary,
      basicSalary: salaryStructure.basicSalary,
      hra: salaryStructure.hra || 0,
      allowances: salaryStructure.allowances || 0,
      variableComponent: salaryStructure.variableComponent || 0,
      overtimePay,
      grossSalary,
      pfDeduction,
      esiDeduction,
      tdsDeduction,
      advanceDeduction,
      loanDeduction: 0,
      otherDeductions: 0,
      totalDeductions,
      netSalary,
      status: 'draft' as const,
      processedBy: '',
      remarks: ''
    };
  }

  async getMonthlyAttendanceSummary(userId: string, month: number, year: number): Promise<{
    workingDays: number;
    presentDays: number;
    absentDays: number;
    overtimeHours: number;
    leaveDays: number;
  }> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    // Get attendance records for the month
    const attendanceRecords = await this.listAttendance({
      userId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });
    
    // Calculate working days (excluding weekends)
    let workingDays = 0;
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
        workingDays++;
      }
    }
    
    const presentDays = attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length;
    const absentDays = workingDays - presentDays;
    const overtimeHours = attendanceRecords.reduce((total, r) => total + (r.overtimeHours || 0), 0);
    const leaveDays = attendanceRecords.filter(r => r.status === 'leave').length;
    
    return {
      workingDays,
      presentDays,
      absentDays,
      overtimeHours,
      leaveDays
    };
  }

  // Department timing management
  async getDepartmentTiming(departmentId: string): Promise<any | null> {
    try {
      const querySnapshot = await this.db.collection('departmentTimings')
        .where('departmentId', '==', departmentId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        // Return default timing if none exists
        return {
          departmentId,
          workingHours: 8,
          checkInTime: "09:00",
          checkOutTime: "18:00",
          lateThresholdMinutes: 15,
          overtimeThresholdMinutes: 30,
          isFlexibleTiming: false,
          breakDurationMinutes: 60,
          weeklyOffDays: [0], // Sunday
          isActive: true
        };
      }

      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error("Error getting department timing:", error);
      return null;
    }
  }

  async createDepartmentTiming(timingData: any): Promise<any> {
    try {
      // Deactivate existing timing for this department
      const existingQuery = await this.db.collection('departmentTimings')
        .where('departmentId', '==', timingData.departmentId)
        .get();

      const batch = this.db.batch();
      existingQuery.docs.forEach(doc => {
        batch.update(doc.ref, { isActive: false, updatedAt: new Date() });
      });

      // Create new timing
      const newTimingRef = this.db.collection('departmentTimings').doc();
      const newTiming = {
        ...timingData,
        id: newTimingRef.id,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      batch.set(newTimingRef, newTiming);
      await batch.commit();

      return newTiming;
    } catch (error) {
      console.error("Error creating department timing:", error);
      throw error;
    }
  }

  async getUserAttendanceForDate(userId: string, date: string): Promise<any | null> {
    try {
      const querySnapshot = await this.db.collection('attendance')
        .where('userId', '==', userId)
        .where('dateString', '==', date)
        .limit(1)
        .get();

      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        checkInTime: data.checkInTime?.toDate() || null,
        checkOutTime: data.checkOutTime?.toDate() || null,
        date: data.date?.toDate() || new Date()
      };
    } catch (error) {
      console.error("Error getting user attendance for date:", error);
      return null;
    }
  }
}

export const storage = new FirestoreStorage();
