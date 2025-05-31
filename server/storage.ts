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
  insertPermissionSchema
} from "@shared/schema";

// Define our schemas since we're not using drizzle anymore
export const insertUserSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable().optional().transform(val => val || "User"),
  role: z.enum(["master_admin", "admin", "employee"]).default("employee"),
  department: z.enum(["cre", "accounts", "hr", "sales_and_marketing", "technical_team"]).nullable().optional(),
  photoURL: z.string().nullable().optional()
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
  createdAt: Date;
  photoURL?: string;
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

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  listUsers(): Promise<User[]>;
  createUser(data: z.infer<typeof insertUserSchema>): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
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
      createdAt: new Date() 
    } as User;
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
    const validatedData = insertAttendanceSchema.parse({
      ...data,
      date: data.date ? Timestamp.fromDate(data.date) : Timestamp.now(),
      checkInTime: data.checkInTime
        ? Timestamp.fromDate(data.checkInTime)
        : undefined,
      checkOutTime: data.checkOutTime
        ? Timestamp.fromDate(data.checkOutTime)
        : undefined,
    });
    
    const attendanceRef = this.db.collection("attendance");
    const attendanceDoc = await attendanceRef.add({
      ...validatedData,
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
    const validatedData = insertAttendanceSchema.partial().parse({
      ...data,
      date: data.date ? Timestamp.fromDate(data.date) : undefined,
      checkInTime: data.checkInTime
        ? Timestamp.fromDate(data.checkInTime)
        : undefined,
      checkOutTime: data.checkOutTime
        ? Timestamp.fromDate(data.checkOutTime)
        : undefined,
    });
    
    const attendanceDoc = this.db.collection("attendance").doc(id);
    
    await attendanceDoc.update({
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    
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
    const startOfDay = Timestamp.fromDate(new Date(date.setHours(0, 0, 0, 0)));
    const endOfDay = Timestamp.fromDate(
      new Date(date.setHours(23, 59, 59, 999)),
    );
    
    const attendanceRef = this.db.collection("attendance");
    const snapshot = await attendanceRef
      .where("userId", "==", userId)
      .where("date", ">=", startOfDay)
      .where("date", "<=", endOfDay)
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
}

export const storage = new FirestoreStorage();
