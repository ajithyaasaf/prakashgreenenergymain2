import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertUserSchema,
  insertDepartmentSchema,
  insertOfficeLocationSchema,
  insertCustomerSchema,
  insertProductSchema,
  insertQuotationSchema,
  insertInvoiceSchema,
  insertAttendanceSchema,
  insertLeaveSchema
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Users
  app.get("/api/users", async (req, res) => {
    const users = await storage.listUsers();
    res.json(users);
  });

  // Get user profile by Firebase UID
  app.get("/api/users/profile", async (req, res) => {
    const { uid } = req.query;
    if (!uid) {
      return res.status(400).json({ message: "UID is required" });
    }
    
    const user = await storage.getUserByUid(uid as string);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  });
  
  // Update user role from Firestore
  app.post("/api/users/update-role", async (req, res) => {
    try {
      const { uid, role } = req.body;
      
      if (!uid || !role) {
        return res.status(400).json({ message: "UID and role are required" });
      }
      
      const user = await storage.getUserByUid(uid);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update the user's role
      const updatedUser = await storage.updateUser(user.id, { role });
      
      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  });

  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }
      const user = await storage.createUser(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userData = insertUserSchema.partial().parse(req.body);
      const updatedUser = await storage.updateUser(id, userData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Departments
  app.get("/api/departments", async (req, res) => {
    const departments = await storage.listDepartments();
    res.json(departments);
  });

  app.get("/api/departments/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const department = await storage.getDepartment(id);
    if (!department) {
      return res.status(404).json({ message: "Department not found" });
    }
    res.json(department);
  });

  app.post("/api/departments", async (req, res) => {
    try {
      const departmentData = insertDepartmentSchema.parse(req.body);
      const existingDepartment = await storage.getDepartmentByName(departmentData.name);
      if (existingDepartment) {
        return res.status(400).json({ message: "Department with this name already exists" });
      }
      const department = await storage.createDepartment(departmentData);
      res.status(201).json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/departments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const departmentData = insertDepartmentSchema.partial().parse(req.body);
      const updatedDepartment = await storage.updateDepartment(id, departmentData);
      if (!updatedDepartment) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json(updatedDepartment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/departments/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteDepartment(id);
    if (!success) {
      return res.status(404).json({ message: "Department not found" });
    }
    res.status(204).end();
  });

  // Office Locations
  app.get("/api/office-locations", async (req, res) => {
    const locations = await storage.listOfficeLocations();
    res.json(locations);
  });

  app.get("/api/office-locations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const location = await storage.getOfficeLocation(id);
    if (!location) {
      return res.status(404).json({ message: "Office location not found" });
    }
    res.json(location);
  });

  app.post("/api/office-locations", async (req, res) => {
    try {
      const locationData = insertOfficeLocationSchema.parse(req.body);
      const location = await storage.createOfficeLocation(locationData);
      res.status(201).json(location);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/office-locations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const locationData = insertOfficeLocationSchema.partial().parse(req.body);
      const updatedLocation = await storage.updateOfficeLocation(id, locationData);
      if (!updatedLocation) {
        return res.status(404).json({ message: "Office location not found" });
      }
      res.json(updatedLocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/office-locations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteOfficeLocation(id);
    if (!success) {
      return res.status(404).json({ message: "Office location not found" });
    }
    res.status(204).end();
  });

  // Customers
  app.get("/api/customers", async (req, res) => {
    const customers = await storage.listCustomers();
    res.json(customers);
  });

  app.get("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const customer = await storage.getCustomer(id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.json(customer);
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/customers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const updatedCustomer = await storage.updateCustomer(id, customerData);
      if (!updatedCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(updatedCustomer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteCustomer(id);
    if (!success) {
      return res.status(404).json({ message: "Customer not found" });
    }
    res.status(204).end();
  });

  // Products
  app.get("/api/products", async (req, res) => {
    const products = await storage.listProducts();
    res.json(products);
  });

  app.get("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const product = await storage.getProduct(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  });

  app.post("/api/products", async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const productData = insertProductSchema.partial().parse(req.body);
      const updatedProduct = await storage.updateProduct(id, productData);
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(updatedProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteProduct(id);
    if (!success) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(204).end();
  });

  // Quotations
  app.get("/api/quotations", async (req, res) => {
    const quotations = await storage.listQuotations();
    res.json(quotations);
  });

  app.get("/api/quotations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const quotation = await storage.getQuotation(id);
    if (!quotation) {
      return res.status(404).json({ message: "Quotation not found" });
    }
    res.json(quotation);
  });

  app.post("/api/quotations", async (req, res) => {
    try {
      const quotationData = insertQuotationSchema.parse(req.body);
      const quotation = await storage.createQuotation(quotationData);
      res.status(201).json(quotation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/quotations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const quotationData = insertQuotationSchema.partial().parse(req.body);
      const updatedQuotation = await storage.updateQuotation(id, quotationData);
      if (!updatedQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      res.json(updatedQuotation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/quotations/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteQuotation(id);
    if (!success) {
      return res.status(404).json({ message: "Quotation not found" });
    }
    res.status(204).end();
  });

  // Invoices
  app.get("/api/invoices", async (req, res) => {
    const invoices = await storage.listInvoices();
    res.json(invoices);
  });

  app.get("/api/invoices/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const invoice = await storage.getInvoice(id);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.json(invoice);
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/invoices/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const invoiceData = insertInvoiceSchema.partial().parse(req.body);
      const updatedInvoice = await storage.updateInvoice(id, invoiceData);
      if (!updatedInvoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(updatedInvoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/invoices/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const success = await storage.deleteInvoice(id);
    if (!success) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.status(204).end();
  });

  // Attendance
  app.get("/api/attendance", async (req, res) => {
    const { userId, date } = req.query;
    
    if (userId && date) {
      const attendance = await storage.getAttendanceByUserAndDate(
        parseInt(userId as string),
        new Date(date as string)
      );
      return res.json(attendance || null);
    }
    
    if (userId) {
      const attendance = await storage.listAttendanceByUser(parseInt(userId as string));
      return res.json(attendance);
    }
    
    if (date) {
      const attendance = await storage.listAttendanceByDate(new Date(date as string));
      return res.json(attendance);
    }
    
    res.status(400).json({ message: "Missing required query parameters" });
  });

  app.get("/api/attendance/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const attendance = await storage.getAttendance(id);
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }
    res.json(attendance);
  });

  app.post("/api/attendance", async (req, res) => {
    try {
      const attendanceData = insertAttendanceSchema.parse(req.body);
      const attendance = await storage.createAttendance(attendanceData);
      res.status(201).json(attendance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/attendance/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const attendanceData = insertAttendanceSchema.partial().parse(req.body);
      const updatedAttendance = await storage.updateAttendance(id, attendanceData);
      if (!updatedAttendance) {
        return res.status(404).json({ message: "Attendance record not found" });
      }
      res.json(updatedAttendance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Leave
  app.get("/api/leaves", async (req, res) => {
    const { userId, status } = req.query;
    
    if (userId) {
      const leaves = await storage.listLeavesByUser(parseInt(userId as string));
      return res.json(leaves);
    }
    
    if (status === 'pending') {
      const leaves = await storage.listPendingLeaves();
      return res.json(leaves);
    }
    
    res.status(400).json({ message: "Missing required query parameters" });
  });

  app.get("/api/leaves/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const leave = await storage.getLeave(id);
    if (!leave) {
      return res.status(404).json({ message: "Leave record not found" });
    }
    res.json(leave);
  });

  app.post("/api/leaves", async (req, res) => {
    try {
      const leaveData = insertLeaveSchema.parse(req.body);
      const leave = await storage.createLeave(leaveData);
      res.status(201).json(leave);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/leaves/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const leaveData = insertLeaveSchema.partial().parse(req.body);
      const updatedLeave = await storage.updateLeave(id, leaveData);
      if (!updatedLeave) {
        return res.status(404).json({ message: "Leave record not found" });
      }
      res.json(updatedLeave);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
