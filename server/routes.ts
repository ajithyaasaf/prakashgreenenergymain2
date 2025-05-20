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
  // Office location endpoints
  app.get('/api/office-locations', async (req, res) => {
    try {
      const officeLocations = await storage.listOfficeLocations();
      res.json(officeLocations);
    } catch (error) {
      console.error('Error fetching office locations:', error);
      res.status(500).json({ message: 'Failed to fetch office locations' });
    }
  });

  app.get('/api/office-locations/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const officeLocation = await storage.getOfficeLocation(id);
      
      if (!officeLocation) {
        return res.status(404).json({ message: 'Office location not found' });
      }
      
      res.json(officeLocation);
    } catch (error) {
      console.error('Error fetching office location:', error);
      res.status(500).json({ message: 'Failed to fetch office location' });
    }
  });

  app.post('/api/office-locations', async (req, res) => {
    try {
      const newLocation = req.body;
      const officeLocation = await storage.createOfficeLocation(newLocation);
      res.status(201).json(officeLocation);
    } catch (error) {
      console.error('Error creating office location:', error);
      res.status(500).json({ message: 'Failed to create office location' });
    }
  });

  app.patch('/api/office-locations/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updateData = req.body;
      const updatedLocation = await storage.updateOfficeLocation(id, updateData);
      
      if (!updatedLocation) {
        return res.status(404).json({ message: 'Office location not found' });
      }
      
      res.json(updatedLocation);
    } catch (error) {
      console.error('Error updating office location:', error);
      res.status(500).json({ message: 'Failed to update office location' });
    }
  });

  app.delete('/api/office-locations/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteOfficeLocation(id);
      
      if (!result) {
        return res.status(404).json({ message: 'Office location not found' });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error('Error deleting office location:', error);
      res.status(500).json({ message: 'Failed to delete office location' });
    }
  });
  
  // Attendance endpoints
  app.get('/api/attendance', async (req, res) => {
    try {
      let attendanceRecords;
      const { userId, date } = req.query;
      
      if (userId && date) {
        // Get attendance for specific user and date
        const parsedDate = new Date(date as string);
        attendanceRecords = await storage.getAttendanceByUserAndDate(
          parseInt(userId as string), 
          parsedDate
        );
      } else if (userId) {
        // Get all attendance records for a user
        attendanceRecords = await storage.listAttendanceByUser(parseInt(userId as string));
      } else if (date) {
        // Get all attendance records for a specific date
        const parsedDate = new Date(date as string);
        attendanceRecords = await storage.listAttendanceByDate(parsedDate);
      } else {
        // Return error if no parameters provided
        return res.status(400).json({ message: 'Missing required parameters (userId or date)' });
      }
      
      res.json(attendanceRecords || []);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      res.status(500).json({ message: 'Failed to fetch attendance records' });
    }
  });

  app.post('/api/attendance/check-in', async (req, res) => {
    try {
      const { userId, latitude, longitude, location = 'office', customerId, reason } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'Missing required parameter: userId' });
      }
      
      // Validate check-in time (only after 9:30 AM)
      const now = new Date();
      const checkInTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes()
      );
      
      const minCheckInTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        9, // 9 hours
        30 // 30 minutes
      );
      
      // Check if current time is before 9:30 AM
      if (checkInTime < minCheckInTime) {
        return res.status(400).json({ 
          message: 'Check-in is only available after 9:30 AM',
          currentTime: checkInTime,
          minCheckInTime: minCheckInTime
        });
      }
      
      // Check if user already checked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const existingAttendance = await storage.getAttendanceByUserAndDate(
        parseInt(userId), 
        today
      );
      
      if (existingAttendance) {
        return res.status(400).json({ 
          message: 'You have already checked in today',
          attendance: existingAttendance
        });
      }
      
      // Create attendance record
      const newAttendance = await storage.createAttendance({
        userId: parseInt(userId),
        date: today,
        checkInTime,
        location,
        customerId: customerId ? parseInt(customerId) : undefined,
        reason,
        checkInLatitude: latitude,
        checkInLongitude: longitude,
        status: 'present'
      });
      
      res.status(201).json(newAttendance);
    } catch (error) {
      console.error('Error checking in:', error);
      res.status(500).json({ message: 'Failed to process check-in' });
    }
  });

  app.post('/api/attendance/check-out', async (req, res) => {
    try {
      const { 
        userId, 
        latitude, 
        longitude, 
        photoUrl,
        reason 
      } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'Missing required parameter: userId' });
      }
      
      // Find user to determine department
      const user = await storage.getUser(parseInt(userId));
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if user has checked in today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const attendanceRecord = await storage.getAttendanceByUserAndDate(
        parseInt(userId), 
        today
      );
      
      if (!attendanceRecord) {
        return res.status(400).json({ message: 'No check-in record found for today' });
      }
      
      // Calculate checkout time restrictions based on department
      const now = new Date();
      const checkOutTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes()
      );
      
      // Determine minimum checkout time based on department
      // Field staff (Sales & Marketing, Technical) can leave at 7:30 PM
      // Office staff (CRE, Accounts, HR) can leave at 6:30 PM
      const isFieldStaff = user.department === 'sales_and_marketing' || 
                          user.department === 'technical_team';
      
      const minCheckOutHour = isFieldStaff ? 19 : 18; // 7:30 PM or 6:30 PM
      const minCheckOutMinute = isFieldStaff ? 30 : 30;
      
      const minCheckOutTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        minCheckOutHour,
        minCheckOutMinute
      );
      
      // Determine if the user is checking out before the allowed time
      const earlyCheckout = checkOutTime < minCheckOutTime;
      
      // If user is checking out early and no reason is provided
      if (earlyCheckout && !reason) {
        return res.status(400).json({ 
          message: 'Early checkout requires a reason',
          currentTime: checkOutTime,
          requiredCheckOutTime: minCheckOutTime
        });
      }
      
      // If out of office checkout, require a photo
      const isRemoteCheckout = 
        attendanceRecord.location === 'field' || 
        (attendanceRecord.checkInLatitude && attendanceRecord.checkInLongitude && 
        latitude && longitude && 
        (attendanceRecord.checkInLatitude !== latitude || 
         attendanceRecord.checkInLongitude !== longitude));
      
      if (isRemoteCheckout && !photoUrl) {
        return res.status(400).json({ 
          message: 'Photo is required for checkout outside of office location'
        });
      }
      
      // Calculate overtime for Technical team members
      let overtimeMinutes = 0;
      if (user.department === 'technical_team' && !earlyCheckout) {
        // Calculate overtime (time after 7:30 PM)
        const standardEndTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          19, // 7 PM
          30 // 30 minutes
        );
        
        if (checkOutTime > standardEndTime) {
          // Calculate overtime in minutes
          overtimeMinutes = Math.round((checkOutTime.getTime() - standardEndTime.getTime()) / (1000 * 60));
        }
      }
      
      // Update attendance record with checkout info and overtime
      const updatedAttendance = await storage.updateAttendance(attendanceRecord.id, {
        checkOutTime,
        checkOutLatitude: latitude,
        checkOutLongitude: longitude,
        checkOutImageUrl: photoUrl,
        reason: earlyCheckout ? reason : attendanceRecord.reason,
        overtimeHours: overtimeMinutes > 0 ? overtimeMinutes : undefined
      });
      
      // Calculate overtime hours for response
      const overtimeHours = overtimeMinutes / 60;
      
      res.json({
        ...updatedAttendance,
        overtimeHours,
        earlyCheckout,
        minCheckOutTime
      });
    } catch (error) {
      console.error('Error checking out:', error);
      res.status(500).json({ message: 'Failed to process check-out' });
    }
  });
  
  // Attendance report endpoint
  app.get('/api/attendance/report', async (req, res) => {
    try {
      const { userId, from, to } = req.query;
      
      if (!from || !to) {
        return res.status(400).json({ message: 'Missing required parameters: from and to dates' });
      }
      
      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);
      
      // Set time to beginning/end of day
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      
      let attendanceRecords = [];
      
      if (userId) {
        // Get attendance for specific user
        const userAttendance = await storage.listAttendanceByUserBetweenDates(
          parseInt(userId as string),
          fromDate,
          toDate
        );
        
        // Get user info to add to records
        const user = await storage.getUser(parseInt(userId as string));
        
        if (user && userAttendance) {
          attendanceRecords = userAttendance.map(record => ({
            ...record,
            userName: user.displayName,
            userDepartment: user.department,
            // Convert overtime from minutes to hours
            overtimeHours: record.overtimeHours ? record.overtimeHours / 60 : 0
          }));
        }
      } else {
        // Get attendance for all users
        const allUsers = await storage.listUsers();
        const attendancesByDate = await storage.listAttendanceBetweenDates(fromDate, toDate);
        
        if (attendancesByDate && allUsers) {
          attendanceRecords = attendancesByDate.map(record => {
            const matchedUser = allUsers.find(u => u.id === record.userId);
            return {
              ...record,
              userName: matchedUser ? matchedUser.displayName : 'Unknown User',
              userDepartment: matchedUser ? matchedUser.department : null,
              // Convert overtime from minutes to hours
              overtimeHours: record.overtimeHours ? record.overtimeHours / 60 : 0
            };
          });
        }
      }
      
      res.json(attendanceRecords);
    } catch (error) {
      console.error('Error generating attendance report:', error);
      res.status(500).json({ message: 'Failed to generate attendance report' });
    }
  });
  
  // Enhanced attendance range endpoint for reporting dashboards
  app.get('/api/attendance/range', async (req, res) => {
    try {
      const { from, to, department, userId } = req.query;
      
      if (!from || !to) {
        return res.status(400).json({ message: 'Missing required parameters: from and to dates' });
      }
      
      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);
      
      // Set time to beginning/end of day
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);
      
      // Get all users
      const allUsers = await storage.listUsers();
      
      // Filter users by department if specified
      let filteredUsers = allUsers;
      if (department) {
        filteredUsers = allUsers.filter(user => 
          user.department?.toLowerCase() === (department as string).toLowerCase()
        );
      }
      
      // Filter by specific user if provided
      if (userId) {
        const userIdNum = parseInt(userId as string);
        filteredUsers = filteredUsers.filter(user => user.id === userIdNum);
      }
      
      // Get all attendance records in the date range
      const attendancesByDate = await storage.listAttendanceBetweenDates(fromDate, toDate);
      
      // Filter attendance records by the filtered users
      let filteredAttendanceRecords = attendancesByDate;
      if (department || userId) {
        const filteredUserIds = filteredUsers.map(user => user.id);
        filteredAttendanceRecords = attendancesByDate.filter(record => 
          filteredUserIds.includes(record.userId)
        );
      }
      
      // Enrich attendance records with user data
      const enrichedRecords = filteredAttendanceRecords.map(record => {
        const matchedUser = allUsers.find(u => u.id === record.userId);
        return {
          ...record,
          userName: matchedUser ? matchedUser.displayName : 'Unknown User',
          userDepartment: matchedUser ? matchedUser.department : null,
          // Ensure overtime is in hours (not minutes)
          overtimeHours: record.overtimeHours ? record.overtimeHours / 60 : 0
        };
      });
      
      res.json(enrichedRecords);
    } catch (error) {
      console.error('Error generating attendance range report:', error);
      res.status(500).json({ message: 'Failed to generate attendance range report' });
    }
  });
  
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
