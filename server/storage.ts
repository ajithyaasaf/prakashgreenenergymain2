import { 
  users, type User, type InsertUser,
  departments, type Department, type InsertDepartment,
  officeLocations, type OfficeLocation, type InsertOfficeLocation,
  customers, type Customer, type InsertCustomer,
  products, type Product, type InsertProduct,
  quotations, type Quotation, type InsertQuotation,
  invoices, type Invoice, type InsertInvoice,
  attendance, type Attendance, type InsertAttendance,
  leaves, type Leave, type InsertLeave
} from "@shared/schema";

export interface IStorage {
  // User Management
  getUser(id: number): Promise<User | undefined>;
  getUserByUid(uid: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User | undefined>;
  listUsers(): Promise<User[]>;
  
  // Department Management
  getDepartment(id: number): Promise<Department | undefined>;
  getDepartmentByName(name: string): Promise<Department | undefined>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, department: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: number): Promise<boolean>;
  listDepartments(): Promise<Department[]>;
  
  // Office Location Management
  getOfficeLocation(id: number): Promise<OfficeLocation | undefined>;
  createOfficeLocation(location: InsertOfficeLocation): Promise<OfficeLocation>;
  updateOfficeLocation(id: number, location: Partial<InsertOfficeLocation>): Promise<OfficeLocation | undefined>;
  deleteOfficeLocation(id: number): Promise<boolean>;
  listOfficeLocations(): Promise<OfficeLocation[]>;
  
  // Customer Management
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<boolean>;
  listCustomers(): Promise<Customer[]>;
  
  // Product Management
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  listProducts(): Promise<Product[]>;
  
  // Quotation Management
  getQuotation(id: number): Promise<Quotation | undefined>;
  createQuotation(quotation: InsertQuotation): Promise<Quotation>;
  updateQuotation(id: number, quotation: Partial<InsertQuotation>): Promise<Quotation | undefined>;
  deleteQuotation(id: number): Promise<boolean>;
  listQuotations(): Promise<Quotation[]>;
  
  // Invoice Management
  getInvoice(id: number): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: number, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: number): Promise<boolean>;
  listInvoices(): Promise<Invoice[]>;
  
  // Attendance Management
  getAttendance(id: number): Promise<Attendance | undefined>;
  getAttendanceByUserAndDate(userId: number, date: Date): Promise<Attendance | undefined>;
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: number, attendance: Partial<InsertAttendance>): Promise<Attendance | undefined>;
  listAttendanceByUser(userId: number): Promise<Attendance[]>;
  listAttendanceByDate(date: Date): Promise<Attendance[]>;
  listAttendanceByUserBetweenDates(userId: number, fromDate: Date, toDate: Date): Promise<Attendance[]>;
  listAttendanceBetweenDates(fromDate: Date, toDate: Date): Promise<Attendance[]>;
  
  // Leave Management
  getLeave(id: number): Promise<Leave | undefined>;
  createLeave(leave: InsertLeave): Promise<Leave>;
  updateLeave(id: number, leave: Partial<InsertLeave>): Promise<Leave | undefined>;
  listLeavesByUser(userId: number): Promise<Leave[]>;
  listPendingLeaves(): Promise<Leave[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private departments: Map<number, Department>;
  private officeLocations: Map<number, OfficeLocation>;
  private customers: Map<number, Customer>;
  private products: Map<number, Product>;
  private quotations: Map<number, Quotation>;
  private invoices: Map<number, Invoice>;
  private attendance: Map<number, Attendance>;
  private leaves: Map<number, Leave>;
  
  private nextUserId = 1;
  private nextDepartmentId = 1;
  private nextOfficeLocationId = 1;
  private nextCustomerId = 1;
  private nextProductId = 1;
  private nextQuotationId = 1;
  private nextInvoiceId = 1;
  private nextAttendanceId = 1;
  private nextLeaveId = 1;

  constructor() {
    this.users = new Map();
    this.departments = new Map();
    this.officeLocations = new Map();
    this.customers = new Map();
    this.products = new Map();
    this.quotations = new Map();
    this.invoices = new Map();
    this.attendance = new Map();
    this.leaves = new Map();
    
    // Initialize with sample data
    this.initSampleData();
  }

  private initSampleData() {
    // Add sample departments
    const departments = [
      { name: "CRE", description: "Customer Relations" },
      { name: "Accounts", description: "Financial Management" },
      { name: "HR", description: "Human Resources" },
      { name: "Sales and Marketing", description: "Business Development" },
      { name: "Technical Team", description: "Product Support" }
    ];
    
    departments.forEach(dept => {
      this.createDepartment(dept);
    });
    
    // Add sample products
    const products = [
      { name: "Solar Panel 500W", type: "Panel", voltage: "24V", rating: "500W", make: "Monocrystalline", quantity: 5, unit: "Piece", price: 1850000 },
      { name: "Inverter 2KVA", type: "Inverter", voltage: "220V", rating: "2KVA", make: "Pure Sine Wave", quantity: 8, unit: "Piece", price: 1520000 },
      { name: "Charge Controller", type: "Controller", voltage: "48V", rating: "60A", make: "MPPT", quantity: 7, unit: "Piece", price: 1280000 },
      { name: "Battery 200Ah", type: "Battery", voltage: "12V", rating: "200Ah", make: "Lithium Ion", quantity: 15, unit: "Piece", price: 950000 }
    ];
    
    products.forEach(product => {
      this.createProduct(product);
    });
    
    // Add sample customers
    const customers = [
      { name: "Sundar Designs", address: "123 Main St, Chennai", email: "info@sundardesigns.com", phone: "9876543210", location: "Chennai", scope: "Solar installation for office building" },
      { name: "Vijay Tech Solutions", address: "456 Tech Park, Bangalore", email: "contact@vijaytech.in", phone: "8765432109", location: "Bangalore", scope: "Backup power solution for data center" },
      { name: "Ramesh Properties", address: "789 Hillside, Hyderabad", email: "ramesh@properties.co.in", phone: "7654321098", location: "Hyderabad", scope: "Residential solar setup for apartment complex" }
    ];
    
    customers.forEach(customer => {
      this.createCustomer(customer);
    });
    
    // Add sample quotations
    const quotations = [
      { 
        quotationNumber: "QT-2023-051", 
        customerId: 1, 
        totalAmount: 12450000, 
        status: "sent", 
        items: [
          { productId: 1, quantity: 5, unitPrice: 1850000, totalPrice: 9250000 },
          { productId: 2, quantity: 2, unitPrice: 1520000, totalPrice: 3040000 }
        ],
        warranty: "1 year parts, 5 years service",
        termsAndConditions: "Standard terms apply"
      },
      {
        quotationNumber: "QT-2023-050", 
        customerId: 2, 
        totalAmount: 8520000, 
        status: "accepted", 
        items: [
          { productId: 2, quantity: 3, unitPrice: 1520000, totalPrice: 4560000 },
          { productId: 3, quantity: 3, unitPrice: 1280000, totalPrice: 3840000 }
        ],
        warranty: "1 year parts, 5 years service",
        termsAndConditions: "Standard terms apply"
      }
    ];
    
    quotations.forEach(quotation => {
      this.createQuotation(quotation);
    });
    
    // Add sample invoices
    const invoices = [
      {
        invoiceNumber: "INV-2023-073",
        customerId: 1,
        quotationId: 1,
        totalAmount: 11520000,
        status: "paid",
        dueDate: new Date(2023, 7, 30),
        items: [
          { productId: 1, quantity: 5, unitPrice: 1850000, totalPrice: 9250000 },
          { productId: 2, quantity: 1.5, unitPrice: 1520000, totalPrice: 2280000 }
        ],
        paymentDetails: {
          method: "Bank Transfer",
          transactionId: "TRX123456",
          paidOn: new Date(2023, 7, 25)
        }
      },
      {
        invoiceNumber: "INV-2023-072",
        customerId: 2,
        quotationId: 2,
        totalAmount: 7500000,
        status: "pending",
        dueDate: new Date(2023, 8, 15),
        items: [
          { productId: 2, quantity: 3, unitPrice: 1520000, totalPrice: 4560000 },
          { productId: 3, quantity: 2.3, unitPrice: 1280000, totalPrice: 2944000 }
        ],
        paymentDetails: null
      }
    ];
    
    invoices.forEach(invoice => {
      this.createInvoice(invoice);
    });
  }

  // User Management
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUid(uid: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.uid === uid);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.nextUserId++;
    const now = new Date();
    const user = { ...insertUser, id, createdAt: now, updatedAt: now };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...userData, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async listUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Department Management
  async getDepartment(id: number): Promise<Department | undefined> {
    return this.departments.get(id);
  }

  async getDepartmentByName(name: string): Promise<Department | undefined> {
    return Array.from(this.departments.values()).find(
      dept => dept.name.toLowerCase() === name.toLowerCase()
    );
  }

  async createDepartment(insertDepartment: InsertDepartment): Promise<Department> {
    const id = this.nextDepartmentId++;
    const now = new Date();
    const department = { ...insertDepartment, id, createdAt: now, updatedAt: now };
    this.departments.set(id, department);
    return department;
  }

  async updateDepartment(id: number, departmentData: Partial<InsertDepartment>): Promise<Department | undefined> {
    const department = this.departments.get(id);
    if (!department) return undefined;
    
    const updatedDepartment = { ...department, ...departmentData, updatedAt: new Date() };
    this.departments.set(id, updatedDepartment);
    return updatedDepartment;
  }

  async deleteDepartment(id: number): Promise<boolean> {
    return this.departments.delete(id);
  }

  async listDepartments(): Promise<Department[]> {
    return Array.from(this.departments.values());
  }

  // Office Location Management
  async getOfficeLocation(id: number): Promise<OfficeLocation | undefined> {
    return this.officeLocations.get(id);
  }

  async createOfficeLocation(insertLocation: InsertOfficeLocation): Promise<OfficeLocation> {
    const id = this.nextOfficeLocationId++;
    const now = new Date();
    const location = { ...insertLocation, id, createdAt: now, updatedAt: now };
    this.officeLocations.set(id, location);
    return location;
  }

  async updateOfficeLocation(id: number, locationData: Partial<InsertOfficeLocation>): Promise<OfficeLocation | undefined> {
    const location = this.officeLocations.get(id);
    if (!location) return undefined;
    
    const updatedLocation = { ...location, ...locationData, updatedAt: new Date() };
    this.officeLocations.set(id, updatedLocation);
    return updatedLocation;
  }

  async deleteOfficeLocation(id: number): Promise<boolean> {
    return this.officeLocations.delete(id);
  }

  async listOfficeLocations(): Promise<OfficeLocation[]> {
    return Array.from(this.officeLocations.values());
  }

  // Customer Management
  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = this.nextCustomerId++;
    const now = new Date();
    const customer = { ...insertCustomer, id, createdAt: now, updatedAt: now };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: number, customerData: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    
    const updatedCustomer = { ...customer, ...customerData, updatedAt: new Date() };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  async deleteCustomer(id: number): Promise<boolean> {
    return this.customers.delete(id);
  }

  async listCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  // Product Management
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = this.nextProductId++;
    const now = new Date();
    const product = { ...insertProduct, id, createdAt: now, updatedAt: now };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: number, productData: Partial<InsertProduct>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const updatedProduct = { ...product, ...productData, updatedAt: new Date() };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: number): Promise<boolean> {
    return this.products.delete(id);
  }

  async listProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  // Quotation Management
  async getQuotation(id: number): Promise<Quotation | undefined> {
    return this.quotations.get(id);
  }

  async createQuotation(insertQuotation: InsertQuotation): Promise<Quotation> {
    const id = this.nextQuotationId++;
    const now = new Date();
    const quotation = { ...insertQuotation, id, createdAt: now, updatedAt: now };
    this.quotations.set(id, quotation);
    return quotation;
  }

  async updateQuotation(id: number, quotationData: Partial<InsertQuotation>): Promise<Quotation | undefined> {
    const quotation = this.quotations.get(id);
    if (!quotation) return undefined;
    
    const updatedQuotation = { ...quotation, ...quotationData, updatedAt: new Date() };
    this.quotations.set(id, updatedQuotation);
    return updatedQuotation;
  }

  async deleteQuotation(id: number): Promise<boolean> {
    return this.quotations.delete(id);
  }

  async listQuotations(): Promise<Quotation[]> {
    return Array.from(this.quotations.values());
  }

  // Invoice Management
  async getInvoice(id: number): Promise<Invoice | undefined> {
    return this.invoices.get(id);
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const id = this.nextInvoiceId++;
    const now = new Date();
    const invoice = { ...insertInvoice, id, createdAt: now, updatedAt: now };
    this.invoices.set(id, invoice);
    return invoice;
  }

  async updateInvoice(id: number, invoiceData: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const invoice = this.invoices.get(id);
    if (!invoice) return undefined;
    
    const updatedInvoice = { ...invoice, ...invoiceData, updatedAt: new Date() };
    this.invoices.set(id, updatedInvoice);
    return updatedInvoice;
  }

  async deleteInvoice(id: number): Promise<boolean> {
    return this.invoices.delete(id);
  }

  async listInvoices(): Promise<Invoice[]> {
    return Array.from(this.invoices.values());
  }

  // Attendance Management
  async getAttendance(id: number): Promise<Attendance | undefined> {
    return this.attendance.get(id);
  }

  async getAttendanceByUserAndDate(userId: number, date: Date): Promise<Attendance | undefined> {
    const dateString = date.toISOString().split('T')[0];
    return Array.from(this.attendance.values()).find(att => {
      const attDateString = att.date.toISOString().split('T')[0];
      return att.userId === userId && attDateString === dateString;
    });
  }

  async createAttendance(insertAttendance: InsertAttendance): Promise<Attendance> {
    const id = this.nextAttendanceId++;
    const now = new Date();
    const attendance = { ...insertAttendance, id, createdAt: now, updatedAt: now };
    this.attendance.set(id, attendance);
    return attendance;
  }

  async updateAttendance(id: number, attendanceData: Partial<InsertAttendance>): Promise<Attendance | undefined> {
    const attendance = this.attendance.get(id);
    if (!attendance) return undefined;
    
    const updatedAttendance = { ...attendance, ...attendanceData, updatedAt: new Date() };
    this.attendance.set(id, updatedAttendance);
    return updatedAttendance;
  }

  async listAttendanceByUser(userId: number): Promise<Attendance[]> {
    return Array.from(this.attendance.values()).filter(att => att.userId === userId);
  }

  async listAttendanceByDate(date: Date): Promise<Attendance[]> {
    const dateString = date.toISOString().split('T')[0];
    return Array.from(this.attendance.values()).filter(att => {
      const attDateString = att.date.toISOString().split('T')[0];
      return attDateString === dateString;
    });
  }

  // Leave Management
  async getLeave(id: number): Promise<Leave | undefined> {
    return this.leaves.get(id);
  }

  async createLeave(insertLeave: InsertLeave): Promise<Leave> {
    const id = this.nextLeaveId++;
    const now = new Date();
    const leave = { ...insertLeave, id, createdAt: now, updatedAt: now };
    this.leaves.set(id, leave);
    return leave;
  }

  async updateLeave(id: number, leaveData: Partial<InsertLeave>): Promise<Leave | undefined> {
    const leave = this.leaves.get(id);
    if (!leave) return undefined;
    
    const updatedLeave = { ...leave, ...leaveData, updatedAt: new Date() };
    this.leaves.set(id, updatedLeave);
    return updatedLeave;
  }

  async listLeavesByUser(userId: number): Promise<Leave[]> {
    return Array.from(this.leaves.values()).filter(leave => leave.userId === userId);
  }

  async listPendingLeaves(): Promise<Leave[]> {
    return Array.from(this.leaves.values()).filter(leave => leave.status === 'pending' || leave.status === 'escalated');
  }
}

export const storage = new MemStorage();
