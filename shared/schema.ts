import { pgTable, text, serial, integer, boolean, timestamp, json, jsonb, uuid, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Role Enum
export const userRoleEnum = pgEnum('user_role', ['master_admin', 'admin', 'employee']);

// Department Enum
export const departmentEnum = pgEnum('department', ['cre', 'accounts', 'hr', 'sales_and_marketing', 'technical_team']);

// User Schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(), // Firebase UID
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: userRoleEnum("role").notNull().default('employee'),
  department: departmentEnum("department"),
  phoneNumber: text("phone_number"),
  profileImageUrl: text("profile_image_url"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Department Schema
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Office Location Schema (for geo-fencing)
export const officeLocations = pgTable("office_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  radius: integer("radius").notNull(), // in meters
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Customer Schema
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  email: text("email"),
  phone: text("phone"),
  location: text("location"),
  scope: text("scope"), // Customer scope
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product Schema
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type"),
  voltage: text("voltage"),
  rating: text("rating"),
  make: text("make"),
  quantity: integer("quantity").notNull().default(0),
  unit: text("unit"),
  price: integer("price").notNull(), // Stored in paise/cents
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Quotation Schema
export const quotations = pgTable("quotations", {
  id: serial("id").primaryKey(),
  quotationNumber: text("quotation_number").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  totalAmount: integer("total_amount").notNull(), // Stored in paise/cents
  status: text("status").notNull().default('draft'), // draft, sent, accepted, rejected
  items: jsonb("items").notNull(), // Array of product items
  warranty: text("warranty"),
  termsAndConditions: text("terms_and_conditions"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoice Schema
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  quotationId: integer("quotation_id"),
  totalAmount: integer("total_amount").notNull(), // Stored in paise/cents
  status: text("status").notNull().default('pending'), // pending, paid, overdue
  dueDate: timestamp("due_date"),
  items: jsonb("items").notNull(), // Array of product items
  paymentDetails: jsonb("payment_details"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Attendance Schema
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  checkInTime: timestamp("check_in_time"),
  checkOutTime: timestamp("check_out_time"),
  location: text("location").notNull().default('office'), // office, field
  customerId: integer("customer_id"), // If location is field
  reason: text("reason"), // For field visits or late checkout
  checkInLatitude: text("check_in_latitude"),
  checkInLongitude: text("check_in_longitude"),
  checkOutLatitude: text("check_out_latitude"),
  checkOutLongitude: text("check_out_longitude"),
  checkOutImageUrl: text("check_out_image_url"), // For outside office checkout
  status: text("status").notNull().default('pending'), // pending, present, absent, late
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leave Schema
export const leaves = pgTable("leaves", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  reason: text("reason").notNull(),
  documentUrl: text("document_url"), // Supporting document
  status: text("status").notNull().default('pending'), // pending, approved, rejected, escalated
  approvalFlow: jsonb("approval_flow").notNull(), // Array of approval steps with status
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOfficeLocationSchema = createInsertSchema(officeLocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuotationSchema = createInsertSchema(quotations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeaveSchema = createInsertSchema(leaves).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

export type OfficeLocation = typeof officeLocations.$inferSelect;
export type InsertOfficeLocation = z.infer<typeof insertOfficeLocationSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type Quotation = typeof quotations.$inferSelect;
export type InsertQuotation = z.infer<typeof insertQuotationSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

export type Leave = typeof leaves.$inferSelect;
export type InsertLeave = z.infer<typeof insertLeaveSchema>;
