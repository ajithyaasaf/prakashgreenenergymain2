import { db } from "./firebase";
import {
  FieldValue,
  Timestamp
} from "firebase-admin/firestore";
import { z } from "zod";
import {
  insertAttendanceSchema,
  insertOfficeLocationSchema,
  insertPermissionSchema
} from "@shared/schema";

// Define our schemas since we're not using drizzle anymore
const insertUserSchema = z.object({
  uid: z.string(),
  email: z.string().email(),
  displayName: z.string().optional(),
  role: z.enum(["master_admin", "admin", "employee"]).default("employee"),
  department: z.enum(["cre", "accounts", "hr", "sales_and_marketing", "technical_team"]).nullable().optional(),
  photoURL: z.string().optional()
});

const insertDepartmentSchema = z.object({
  name: z.string()
});

const insertCustomerSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  address: z.string()
});

const insertProductSchema = z.object({
  name: z.string(),
  description: z.string(),
  price: z.number()
});

const insertQuotationSchema = z.object({
  customerId: z.string(),
  products: z.array(z.object({
    productId: z.string(),
    quantity: z.number()
  })),
  total: z.number(),
  status: z.string().default("pending")
});

const insertInvoiceSchema = z.object({
  quotationId: z.string(),
  customerId: z.string(),
  total: z.number(),
  status: z.string().default("pending")
});

const insertLeaveSchema = z.object({
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
}

export class FirestoreStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const userDoc = db.collection("users").doc(id);
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
      createdAt: data?.createdAt.toDate(),
      photoURL: data?.photoURL,
    } as User;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const usersRef = db.collection("users");
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
    const usersCollection = db.collection("users");
    const snapshot = await usersCollection.get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        department: data.department,
        createdAt: data.createdAt?.toDate() || new Date(),
        photoURL: data.photoURL,
      } as User;
    });
  }

  async createUser(data: z.infer<typeof insertUserSchema>): Promise<User> {
    const validatedData = insertUserSchema.parse(data);
    const userDoc = db.collection("users").doc(validatedData.uid);
    
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
    const userDoc = db.collection("users").doc(id);
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
    const deptDoc = db.collection("departments").doc(id);
    const docSnap = await deptDoc.get();
    if (!docSnap.exists) return undefined;
    const data = docSnap.data();
    return { id: docSnap.id, name: data?.name } as Department;
  }

  async getDepartmentByName(name: string): Promise<Department | undefined> {
    const departmentsRef = db.collection("departments");
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
    const departmentsRef = db.collection("departments");
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
    const deptDoc = db.collection("departments").doc(id);
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
    const deptDoc = db.collection("departments").doc(id);
    await deptDoc.delete();
    return true;
  }

  async listOfficeLocations(): Promise<OfficeLocation[]> {
    const locationsCollection = db.collection("office_locations");
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
    const locationDoc = db.collection("office_locations").doc(id);
    const docSnap = await locationDoc.get();
    if (!docSnap.exists) return undefined;
    const data = docSnap.data() || {};
    return { id: docSnap.id, ...data } as OfficeLocation;
  }

  async createOfficeLocation(
    data: z.infer<typeof insertOfficeLocationSchema>,
  ): Promise<OfficeLocation> {
    const validatedData = insertOfficeLocationSchema.parse(data);
    const locationsRef = db.collection("office_locations");
    
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
    const locationDoc = db.collection("office_locations").doc(id);
    
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
    const locationDoc = doc(db, "office_locations", id);
    await deleteDoc(locationDoc);
  }

  async listCustomers(): Promise<Customer[]> {
    const customersCollection = collection(db, "customers");
    const snapshot = await getDocs(customersCollection);
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        }) as Customer,
    );
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const customerDoc = doc(db, "customers", id);
    const docSnap = await getDoc(customerDoc);
    if (!docSnap.exists()) return undefined;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
    } as Customer;
  }

  async createCustomer(
    data: z.infer<typeof insertCustomerSchema>,
  ): Promise<Customer> {
    const validatedData = insertCustomerSchema.parse(data);
    const customerDoc = doc(collection(db, "customers"));
    await setDoc(customerDoc, {
      ...validatedData,
      id: customerDoc.id,
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
    const customerDoc = doc(db, "customers", id);
    await updateDoc(customerDoc, {
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    const updatedDoc = await getDoc(customerDoc);
    if (!updatedDoc.exists()) throw new Error("Customer not found");
    const updatedData = updatedDoc.data();
    return {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt.toDate(),
    } as Customer;
  }

  async deleteCustomer(id: string): Promise<void> {
    const customerDoc = doc(db, "customers", id);
    await deleteDoc(customerDoc);
  }

  async listProducts(): Promise<Product[]> {
    const productsCollection = collection(db, "products");
    const snapshot = await getDocs(productsCollection);
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        }) as Product,
    );
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const productDoc = doc(db, "products", id);
    const docSnap = await getDoc(productDoc);
    if (!docSnap.exists()) return undefined;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
    } as Product;
  }

  async createProduct(
    data: z.infer<typeof insertProductSchema>,
  ): Promise<Product> {
    const validatedData = insertProductSchema.parse(data);
    const productDoc = doc(collection(db, "products"));
    await setDoc(productDoc, {
      ...validatedData,
      id: productDoc.id,
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
    const productDoc = doc(db, "products", id);
    await updateDoc(productDoc, {
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    const updatedDoc = await getDoc(productDoc);
    if (!updatedDoc.exists()) throw new Error("Product not found");
    const updatedData = updatedDoc.data();
    return {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt.toDate(),
    } as Product;
  }

  async deleteProduct(id: string): Promise<void> {
    const productDoc = doc(db, "products", id);
    await deleteDoc(productDoc);
  }

  async listQuotations(): Promise<Quotation[]> {
    const quotationsCollection = collection(db, "quotations");
    const snapshot = await getDocs(quotationsCollection);
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        }) as Quotation,
    );
  }

  async getQuotation(id: string): Promise<Quotation | undefined> {
    const quotationDoc = doc(db, "quotations", id);
    const docSnap = await getDoc(quotationDoc);
    if (!docSnap.exists()) return undefined;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
    } as Quotation;
  }

  async createQuotation(
    data: z.infer<typeof insertQuotationSchema>,
  ): Promise<Quotation> {
    const validatedData = insertQuotationSchema.parse(data);
    const quotationDoc = doc(collection(db, "quotations"));
    await setDoc(quotationDoc, {
      ...validatedData,
      id: quotationDoc.id,
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
    const quotationDoc = doc(db, "quotations", id);
    await updateDoc(quotationDoc, {
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    const updatedDoc = await getDoc(quotationDoc);
    if (!updatedDoc.exists()) throw new Error("Quotation not found");
    const updatedData = updatedDoc.data();
    return {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt.toDate(),
    } as Quotation;
  }

  async deleteQuotation(id: string): Promise<void> {
    const quotationDoc = doc(db, "quotations", id);
    await deleteDoc(quotationDoc);
  }

  async listInvoices(): Promise<Invoice[]> {
    const invoicesCollection = collection(db, "invoices");
    const snapshot = await getDocs(invoicesCollection);
    return snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        }) as Invoice,
    );
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const invoiceDoc = doc(db, "invoices", id);
    const docSnap = await getDoc(invoiceDoc);
    if (!docSnap.exists()) return undefined;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
    } as Invoice;
  }

  async createInvoice(
    data: z.infer<typeof insertInvoiceSchema>,
  ): Promise<Invoice> {
    const validatedData = insertInvoiceSchema.parse(data);
    const invoiceDoc = doc(collection(db, "invoices"));
    await setDoc(invoiceDoc, {
      ...validatedData,
      id: invoiceDoc.id,
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
    const invoiceDoc = doc(db, "invoices", id);
    await updateDoc(invoiceDoc, {
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    const updatedDoc = await getDoc(invoiceDoc);
    if (!updatedDoc.exists()) throw new Error("Invoice not found");
    const updatedData = updatedDoc.data();
    return {
      id: updatedDoc.id,
      ...updatedData,
      createdAt: updatedData.createdAt.toDate(),
    } as Invoice;
  }

  async deleteInvoice(id: string): Promise<void> {
    const invoiceDoc = doc(db, "invoices", id);
    await deleteDoc(invoiceDoc);
  }

  async createAttendance(
    data: z.infer<typeof insertAttendanceSchema>,
  ): Promise<Attendance> {
    const userDoc = await getDoc(doc(db, "users", data.userId));
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
    const attendanceDoc = doc(collection(db, "attendance"));
    await setDoc(attendanceDoc, {
      ...validatedData,
      id: attendanceDoc.id,
      userEmail: userDoc.exists() ? userDoc.data().email : "",
      userDepartment: userDoc.exists() ? userDoc.data().department : null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return {
      id: attendanceDoc.id,
      ...validatedData,
      userEmail: userDoc.exists() ? userDoc.data().email : "",
      userDepartment: userDoc.exists() ? userDoc.data().department : null,
      date: validatedData.date.toDate(),
      checkInTime: validatedData.checkInTime?.toDate(),
      checkOutTime: validatedData.checkOutTime?.toDate(),
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
    const attendanceDoc = doc(db, "attendance", id);
    await updateDoc(attendanceDoc, {
      ...validatedData,
      updatedAt: Timestamp.now(),
    });
    const updatedDoc = await getDoc(attendanceDoc);
    if (!updatedDoc.exists()) throw new Error("Attendance not found");
    const updatedData = updatedDoc.data();
    return {
      id: updatedDoc.id,
      ...updatedData,
      date: updatedData.date.toDate(),
      checkInTime: updatedData.checkInTime?.toDate(),
      checkOutTime: updatedData.checkOutTime?.toDate(),
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
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", userId),
      where("date", ">=", startOfDay),
      where("date", "<=", endOfDay),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return undefined;
    const record = snapshot.docs[0];
    const data = record.data();
    return {
      id: record.id,
      ...data,
      date: data.date.toDate(),
      checkInTime: data.checkInTime?.toDate(),
      checkOutTime: data.checkOutTime?.toDate(),
    } as Attendance;
  }

  async listAttendanceByUser(userId: string): Promise<Attendance[]> {
    const q = query(
      collection(db, "attendance"),
      where("userId", "==", userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        checkInTime: data.checkInTime?.toDate(),
        checkOutTime: data.checkOutTime?.toDate(),
      } as Attendance;
    });
  }

  async listAttendanceByDate(date: Date): Promise<Attendance[]> {
    const startOfDay = Timestamp.fromDate(new Date(date.setHours(0, 0, 0, 0)));
    const endOfDay = Timestamp.fromDate(
      new Date(date.setHours(23, 59, 59, 999)),
    );
    const q = query(
      collection(db, "attendance"),
      where("date", ">=", startOfDay),
      where("date", "<=", endOfDay),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        checkInTime: data.checkInTime?.toDate(),
        checkOutTime: data.checkOutTime?.toDate(),
      } as Attendance;
    });
  }

  async listAttendanceBetweenDates(
    startDate: Date,
    endDate: Date,
  ): Promise<Attendance[]> {
    const start = Timestamp.fromDate(startDate);
    const end = Timestamp.fromDate(endDate);
    const q = query(
      collection(db, "attendance"),
      where("date", ">=", start),
      where("date", "<=", end),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date.toDate(),
        checkInTime: data.checkInTime?.toDate(),
        checkOutTime: data.checkOutTime?.toDate(),
      } as Attendance;
    });
  }

  async getLeave(id: string): Promise<Leave | undefined> {
    const leaveDoc = doc(db, "leaves", id);
    const docSnap = await getDoc(leaveDoc);
    if (!docSnap.exists()) return undefined;
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      startDate: data.startDate.toDate(),
      endDate: data.endDate.toDate(),
      createdAt: data.createdAt.toDate(),
    } as Leave;
  }

  async listLeavesByUser(userId: string): Promise<Leave[]> {
    const q = query(collection(db, "leaves"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate(),
        createdAt: data.createdAt.toDate(),
      } as Leave;
    });
  }

  async listPendingLeaves(): Promise<Leave[]> {
    const q = query(collection(db, "leaves"), where("status", "==", "pending"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate(),
        createdAt: data.createdAt.toDate(),
      } as Leave;
    });
  }

  async createLeave(data: z.infer<typeof insertLeaveSchema>): Promise<Leave> {
    const validatedData = insertLeaveSchema.parse({
      ...data,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
    });
    const leaveDoc = doc(collection(db, "leaves"));
    await setDoc(leaveDoc, {
      ...validatedData,
      id: leaveDoc.id,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return {
      id: leaveDoc.id,
      ...validatedData,
      startDate: validatedData.startDate.toDate(),
      endDate: validatedData.endDate.toDate(),
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
    const leaveDoc = doc(db, "leaves", id);
    await updateDoc(leaveDoc, { ...validatedData, updatedAt: Timestamp.now() });
    const updatedDoc = await getDoc(leaveDoc);
    if (!updatedDoc.exists()) throw new Error("Leave not found");
    const updatedData = updatedDoc.data();
    return {
      id: updatedDoc.id,
      ...updatedData,
      startDate: updatedData.startDate.toDate(),
      endDate: updatedData.endDate.toDate(),
      createdAt: updatedData.createdAt.toDate(),
    } as Leave;
  }
}

export const storage = new FirestoreStorage();
