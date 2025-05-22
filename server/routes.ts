import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertAttendanceSchema, insertOfficeLocationSchema, insertPermissionSchema } from "@shared/schema";
// Import all the necessary schemas from storage.ts since they've been moved there
import { 
  insertUserSchema,
  insertDepartmentSchema,
  insertCustomerSchema,
  insertProductSchema,
  insertQuotationSchema,
  insertInvoiceSchema,
  insertLeaveSchema
} from "./storage";
import { isWithinGeoFence } from "./utils";
import { auth } from "./firebase";

export async function registerRoutes(app: Express): Promise<Server> {
  // Middleware to verify Firebase Auth token
  const verifyAuth = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = decodedToken;
      next();
    } catch (error) {
      console.error("Auth verification error:", error);
      res.status(401).json({ message: "Unauthorized: Invalid token" });
    }
  };

  // Activity Logs with optimized performance
  app.get("/api/activity-logs", verifyAuth, async (req, res) => {
    try {
      // Check if user is authenticated
      const user = await storage.getUser(req.user.uid);
      if (!user) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get limit parameter with fallback and validation
      const limitParam = req.query.limit;
      const limit = limitParam ? Math.min(Math.max(parseInt(limitParam as string, 10) || 10, 1), 50) : 10;
      
      // Try to fetch stored activity logs first
      try {
        const storedLogs = await storage.listActivityLogs(limit);
        
        // If we have enough stored logs, return them directly
        if (storedLogs.length >= limit) {
          return res.json(storedLogs);
        }
        
        // If we have some logs but not enough, supplement with generated logs
        const activities = [...storedLogs];
        const remainingCount = limit - storedLogs.length;
        
        // Get supplementary data and generate activities
        const [customers, quotations, invoices] = await Promise.all([
          storage.listCustomers(),
          storage.listQuotations(),
          storage.listInvoices()
        ]);
        
        // Generate from customers if needed
        if (customers.length > 0 && activities.length < limit) {
          const existingCustomerIds = new Set(
            activities
              .filter(a => a.entityType === 'customer')
              .map(a => a.entityId)
          );
          
          const newCustomerActivities = customers
            .filter(c => !existingCustomerIds.has(c.id))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, remainingCount)
            .map(customer => ({
              id: `customer-${customer.id}`,
              type: 'customer_created' as const,
              title: "New customer added",
              description: `${customer.name}, ${customer.address || 'Location unknown'}`,
              createdAt: customer.createdAt,
              entityId: customer.id,
              entityType: 'customer',
              userId: user.id
            }));
            
          activities.push(...newCustomerActivities);
        }
        
        // Generate from quotations if needed
        if (quotations.length > 0 && activities.length < limit) {
          const existingQuotationIds = new Set(
            activities
              .filter(a => a.entityType === 'quotation')
              .map(a => a.entityId)
          );
          
          const newQuotationActivities = quotations
            .filter(q => !existingQuotationIds.has(q.id))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit - activities.length)
            .map(quotation => ({
              id: `quotation-${quotation.id}`,
              type: 'quotation_created' as const,
              title: "Quotation created",
              description: `${quotation.quotationNumber || 'New quotation'} for ₹${quotation.total || 0}`,
              createdAt: quotation.createdAt,
              entityId: quotation.id,
              entityType: 'quotation',
              userId: user.id
            }));
            
          activities.push(...newQuotationActivities);
        }
        
        // Generate from invoices if needed
        if (invoices.length > 0 && activities.length < limit) {
          const existingInvoiceIds = new Set(
            activities
              .filter(a => a.entityType === 'invoice')
              .map(a => a.entityId)
          );
          
          const newInvoiceActivities = invoices
            .filter(i => !existingInvoiceIds.has(i.id))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, limit - activities.length)
            .map(invoice => ({
              id: `invoice-${invoice.id}`,
              type: 'invoice_paid' as const,
              title: "Invoice paid",
              description: `${invoice.invoiceNumber || 'Invoice'} for ₹${invoice.total || 0}`,
              createdAt: invoice.createdAt,
              entityId: invoice.id,
              entityType: 'invoice',
              userId: user.id
            }));
            
          activities.push(...newInvoiceActivities);
        }
        
        // Sort all activities by date (newest first)
        activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Try to store generated activities for future use
        try {
          for (const activity of activities) {
            if (!storedLogs.some(log => log.id === activity.id)) {
              await storage.createActivityLog({
                type: activity.type,
                title: activity.title,
                description: activity.description,
                entityId: activity.entityId,
                entityType: activity.entityType,
                userId: activity.userId
              });
            }
          }
        } catch (storeError) {
          console.error("Error storing activity logs:", storeError);
          // Continue to return the activities even if storing fails
        }
        
        return res.json(activities.slice(0, limit));
      } catch (error) {
        console.error("Error with stored logs, falling back to generated logs:", error);
        
        // Fallback to fully generated logs
        const activities = [];
        
        const [customers, quotations, invoices] = await Promise.all([
          storage.listCustomers(),
          storage.listQuotations(),
          storage.listInvoices()
        ]);
        
        // Generate from customers (up to 2)
        if (customers.length > 0) {
          const recentCustomers = [...customers]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 2);
            
          recentCustomers.forEach(customer => {
            activities.push({
              id: `customer-${customer.id}`,
              type: 'customer_created' as const,
              title: "New customer added",
              description: `${customer.name}, ${customer.address || 'Location unknown'}`,
              createdAt: customer.createdAt,
              entityId: customer.id,
              entityType: 'customer',
              userId: user.id
            });
          });
        }
        
        // Generate from most recent quotation
        if (quotations.length > 0) {
          const recentQuotation = quotations
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            
          activities.push({
            id: `quotation-${recentQuotation.id}`,
            type: 'quotation_created' as const,
            title: "Quotation created",
            description: `${recentQuotation.quotationNumber || 'New quotation'} for ₹${recentQuotation.total || 0}`,
            createdAt: recentQuotation.createdAt,
            entityId: recentQuotation.id,
            entityType: 'quotation',
            userId: user.id
          });
        }
        
        // Generate from most recent invoice
        if (invoices.length > 0) {
          const recentInvoice = invoices
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
            
          activities.push({
            id: `invoice-${recentInvoice.id}`,
            type: 'invoice_paid' as const,
            title: "Invoice paid", 
            description: `${recentInvoice.invoiceNumber || 'Invoice'} for ₹${recentInvoice.total || 0}`,
            createdAt: recentInvoice.createdAt,
            entityId: recentInvoice.id,
            entityType: 'invoice',
            userId: user.id
          });
        }
        
        // Sort by creation date (newest first)
        activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        return res.json(activities.slice(0, limit));
      }
    } catch (error) {
      console.error("Error generating activity logs:", error);
      res.status(500).json({ 
        message: "Failed to fetch activity logs",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Users
  app.get("/api/users", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (user.role !== "master_admin" && user.role !== "admin")) {
        return res.status(403).json({ message: "Access denied" });
      }
      const users = await storage.listUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        (user.role !== "master_admin" &&
          user.role !== "admin" &&
          user.id !== req.params.id)
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(targetUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/users", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res
          .status(400)
          .json({ message: "User with this email already exists" });
      }
      const newUser = await storage.createUser(userData);
      res.status(201).json(newUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (user.role !== "master_admin" && user.role !== "admin")) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (req.body.role === "master_admin" && user.role !== "master_admin") {
        return res
          .status(403)
          .json({ message: "Only master admins can assign master_admin role" });
      }
      const userData = insertUserSchema.partial().parse(req.body);
      const updatedUser = await storage.updateUser(req.params.id, userData);
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Departments
  app.get("/api/departments", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (user.role !== "master_admin" && user.role !== "admin")) {
        return res.status(403).json({ message: "Access denied" });
      }
      const departments = await storage.listDepartments();
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  // Office Locations
  app.get("/api/office-locations", verifyAuth, async (req, res) => {
    try {
      const officeLocations = await storage.listOfficeLocations();
      res.json(officeLocations);
    } catch (error) {
      console.error("Error fetching office locations:", error);
      res.status(500).json({ message: "Failed to fetch office locations" });
    }
  });

  app.get("/api/office-locations/:id", verifyAuth, async (req, res) => {
    try {
      const officeLocation = await storage.getOfficeLocation(req.params.id);
      if (!officeLocation) {
        return res.status(404).json({ message: "Office location not found" });
      }
      res.json(officeLocation);
    } catch (error) {
      console.error("Error fetching office location:", error);
      res.status(500).json({ message: "Failed to fetch office location" });
    }
  });

  app.post("/api/office-locations", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const locationData = insertOfficeLocationSchema.parse(req.body);
      const officeLocation = await storage.createOfficeLocation(locationData);
      res.status(201).json(officeLocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating office location:", error);
      res.status(500).json({ message: "Failed to create office location" });
    }
  });

  app.patch("/api/office-locations/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      const locationData = insertOfficeLocationSchema.partial().parse(req.body);
      const updatedLocation = await storage.updateOfficeLocation(
        req.params.id,
        locationData,
      );
      if (!updatedLocation) {
        return res.status(404).json({ message: "Office location not found" });
      }
      res.json(updatedLocation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating office location:", error);
      res.status(500).json({ message: "Failed to update office location" });
    }
  });

  app.delete("/api/office-locations/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteOfficeLocation(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting office location:", error);
      res.status(500).json({ message: "Failed to delete office location" });
    }
  });

  // Attendance
  app.get("/api/attendance", verifyAuth, async (req, res) => {
    try {
      const { userId, date } = req.query;
      const requestingUser = await storage.getUser(req.user.uid);
      if (!requestingUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (userId && date) {
        if (
          requestingUser.role !== "master_admin" &&
          requestingUser.role !== "admin" &&
          requestingUser.id !== userId
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const attendance = await storage.getAttendanceByUserAndDate(
          userId as string,
          new Date(date as string),
        );
        return res.json(attendance || null);
      }

      if (userId) {
        if (
          requestingUser.role !== "master_admin" &&
          requestingUser.role !== "admin" &&
          requestingUser.id !== userId
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const attendance = await storage.listAttendanceByUser(userId as string);
        return res.json(attendance);
      }

      if (date) {
        if (
          requestingUser.role !== "master_admin" &&
          requestingUser.role !== "admin"
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const attendance = await storage.listAttendanceByDate(
          new Date(date as string),
        );
        return res.json(attendance);
      }

      res.status(400).json({ message: "Missing required query parameters" });
    } catch (error) {
      console.error("Error fetching attendance:", error);
      res.status(500).json({ message: "Failed to fetch attendance" });
    }
  });

  app.post("/api/attendance/check-in", verifyAuth, async (req, res) => {
    try {
      const {
        userId,
        latitude,
        longitude,
        location = "office",
        customerId,
        reason,
        imageUrl,
      } = req.body;
      if (!userId || userId !== req.user.uid) {
        return res.status(403).json({ message: "Access denied" });
      }

      const now = new Date();
      const checkInTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
      );
      const minCheckInTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        9,
        30,
      );

      if (checkInTime < minCheckInTime) {
        return res.status(400).json({
          message: "Check-in is only available after 9:30 AM",
          currentTime: checkInTime,
          minCheckInTime,
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingAttendance = await storage.getAttendanceByUserAndDate(
        userId,
        today,
      );
      if (existingAttendance) {
        return res.status(400).json({
          message: "You have already checked in today",
          attendance: existingAttendance,
        });
      }

      const locations = await storage.listOfficeLocations();
      const isValidLocation = locations.some((loc) =>
        isWithinGeoFence(latitude, longitude, loc),
      );
      if (!isValidLocation) {
        return res.status(400).json({ message: "Outside geofence" });
      }

      const newAttendance = await storage.createAttendance({
        userId,
        date: today,
        checkInTime,
        location,
        customerId: customerId ? parseInt(customerId) : undefined,
        reason,
        checkInLatitude: latitude,
        checkInLongitude: longitude,
        checkInImageUrl: imageUrl,
        status: "present",
      });

      res.status(201).json(newAttendance);
    } catch (error) {
      console.error("Error checking in:", error);
      res.status(500).json({ message: "Failed to process check-in" });
    }
  });

  app.post("/api/attendance/check-out", verifyAuth, async (req, res) => {
    try {
      const { userId, latitude, longitude, photoUrl, reason } = req.body;
      if (!userId || userId !== req.user.uid) {
        return res.status(403).json({ message: "Access denied" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attendanceRecord = await storage.getAttendanceByUserAndDate(
        userId,
        today,
      );
      if (!attendanceRecord) {
        return res
          .status(400)
          .json({ message: "No check-in record found for today" });
      }

      const now = new Date();
      const checkOutTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
      );
      const isFieldStaff =
        user.department === "sales_and_marketing" ||
        user.department === "technical_team";
      const minCheckOutHour = isFieldStaff ? 19 : 18;
      const minCheckOutMinute = isFieldStaff ? 30 : 30;
      const minCheckOutTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        minCheckOutHour,
        minCheckOutMinute,
      );

      const earlyCheckout = checkOutTime < minCheckOutTime;
      if (earlyCheckout && !reason) {
        return res.status(400).json({
          message: "Early checkout requires a reason",
          currentTime: checkOutTime,
          requiredCheckOutTime: minCheckOutTime,
        });
      }

      const isRemoteCheckout =
        attendanceRecord.location === "field" ||
        (attendanceRecord.checkInLatitude &&
          attendanceRecord.checkInLongitude &&
          latitude &&
          longitude &&
          (attendanceRecord.checkInLatitude !== latitude ||
            attendanceRecord.checkInLongitude !== longitude));
      if (isRemoteCheckout && !photoUrl) {
        return res.status(400).json({
          message: "Photo is required for checkout outside of office location",
        });
      }

      let overtimeHours = 0;
      if (user.department === "technical_team" && !earlyCheckout) {
        const standardEndTime = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          19,
          30,
        );
        if (checkOutTime > standardEndTime) {
          overtimeHours =
            (checkOutTime.getTime() - standardEndTime.getTime()) /
            (1000 * 60 * 60);
        }
      }

      const updatedAttendance = await storage.updateAttendance(
        attendanceRecord.id,
        {
          checkOutTime,
          checkOutLatitude: latitude,
          checkOutLongitude: longitude,
          checkOutImageUrl: photoUrl,
          reason: earlyCheckout ? reason : attendanceRecord.reason,
          overtimeHours: overtimeHours > 0 ? overtimeHours : undefined,
        },
      );

      res.json({
        ...updatedAttendance,
        overtimeHours,
        earlyCheckout,
        minCheckOutTime,
      });
    } catch (error) {
      console.error("Error checking out:", error);
      res.status(500).json({ message: "Failed to process check-out" });
    }
  });

  app.get("/api/attendance/report", verifyAuth, async (req, res) => {
    try {
      const { userId, from, to } = req.query;
      const requestingUser = await storage.getUser(req.user.uid);
      if (
        !requestingUser ||
        (requestingUser.role !== "master_admin" &&
          requestingUser.role !== "admin")
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!from || !to) {
        return res
          .status(400)
          .json({ message: "Missing required parameters: from and to dates" });
      }

      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);

      let attendanceRecords = [];
      if (userId) {
        const userAttendance = await storage.listAttendanceByUserBetweenDates(
          userId as string,
          fromDate,
          toDate,
        );
        const user = await storage.getUser(userId as string);
        if (user && userAttendance) {
          attendanceRecords = userAttendance.map((record) => ({
            ...record,
            userName: user.displayName,
            userDepartment: user.department,
            overtimeHours: record.overtimeHours || 0,
          }));
        }
      } else {
        const allUsers = await storage.listUsers();
        const attendancesByDate = await storage.listAttendanceBetweenDates(
          fromDate,
          toDate,
        );
        if (attendancesByDate && allUsers) {
          attendanceRecords = attendancesByDate.map((record) => {
            const matchedUser = allUsers.find((u) => u.id === record.userId);
            return {
              ...record,
              userName: matchedUser ? matchedUser.displayName : "Unknown User",
              userDepartment: matchedUser ? matchedUser.department : null,
              overtimeHours: record.overtimeHours || 0,
            };
          });
        }
      }

      res.json(attendanceRecords);
    } catch (error) {
      console.error("Error generating attendance report:", error);
      res.status(500).json({ message: "Failed to generate attendance report" });
    }
  });

  app.get("/api/attendance/range", verifyAuth, async (req, res) => {
    try {
      const { from, to, department, userId } = req.query;
      const requestingUser = await storage.getUser(req.user.uid);
      if (
        !requestingUser ||
        (requestingUser.role !== "master_admin" &&
          requestingUser.role !== "admin")
      ) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!from || !to) {
        return res
          .status(400)
          .json({ message: "Missing required parameters: from and to dates" });
      }

      const fromDate = new Date(from as string);
      const toDate = new Date(to as string);
      fromDate.setHours(0, 0, 0, 0);
      toDate.setHours(23, 59, 59, 999);

      const allUsers = await storage.listUsers();
      let filteredUsers = allUsers;
      if (department) {
        filteredUsers = allUsers.filter(
          (user) =>
            user.department?.toLowerCase() ===
            (department as string).toLowerCase(),
        );
      }
      if (userId) {
        filteredUsers = filteredUsers.filter((user) => user.id === userId);
      }

      const attendancesByDate = await storage.listAttendanceBetweenDates(
        fromDate,
        toDate,
      );
      let filteredAttendanceRecords = attendancesByDate;
      if (department || userId) {
        const filteredUserIds = filteredUsers.map((user) => user.id);
        filteredAttendanceRecords = attendancesByDate.filter((record) =>
          filteredUserIds.includes(record.userId),
        );
      }

      const enrichedRecords = filteredAttendanceRecords.map((record) => {
        const matchedUser = allUsers.find((u) => u.id === record.userId);
        return {
          ...record,
          userName: matchedUser ? matchedUser.displayName : "Unknown User",
          userDepartment: matchedUser ? matchedUser.department : null,
          overtimeHours: record.overtimeHours || 0,
        };
      });

      res.json(enrichedRecords);
    } catch (error) {
      console.error("Error generating attendance range report:", error);
      res
        .status(500)
        .json({ message: "Failed to generate attendance range report" });
    }
  });

  // Customers with pagination and performance optimizations
  app.get("/api/customers", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "sales_and_marketing"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string) || '';
      const sortBy = (req.query.sortBy as string) || 'name';
      const sortOrder = (req.query.sortOrder as string) || 'asc';
      
      // Get customers
      const customers = await storage.listCustomers();
      
      // Apply search filter if provided
      let filteredCustomers = customers;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredCustomers = customers.filter((customer: any) => 
          customer.name?.toLowerCase().includes(searchLower) ||
          customer.email?.toLowerCase().includes(searchLower) ||
          customer.phone?.toLowerCase().includes(searchLower) ||
          customer.address?.toLowerCase().includes(searchLower)
        );
      }
      
      // Sort customers
      filteredCustomers.sort((a: any, b: any) => {
        const aValue = a[sortBy] || '';
        const bValue = b[sortBy] || '';
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortOrder === 'asc'
            ? (aValue > bValue ? 1 : -1)
            : (bValue > aValue ? 1 : -1);
        }
      });
      
      // Calculate pagination values
      const totalItems = filteredCustomers.length;
      const totalPages = Math.ceil(totalItems / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = Math.min(startIndex + limit, totalItems);
      
      // Get paginated subset
      const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);
      
      // Return with pagination metadata
      res.json({
        data: paginatedCustomers,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  app.get("/api/customers/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "sales_and_marketing"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error fetching customer:", error);
      res.status(500).json({ message: "Failed to fetch customer" });
    }
  });

  app.post("/api/customers", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "sales_and_marketing"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating customer:", error);
      res.status(500).json({ message: "Failed to create customer" });
    }
  });

  app.patch("/api/customers/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "sales_and_marketing"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const updatedCustomer = await storage.updateCustomer(
        req.params.id,
        customerData,
      );
      if (!updatedCustomer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(updatedCustomer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating customer:", error);
      res.status(500).json({ message: "Failed to update customer" });
    }
  });

  app.delete("/api/customers/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || !["master_admin", "admin"].includes(user.role || "")) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteCustomer(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ message: "Failed to delete customer" });
    }
  });

  // Products with pagination and performance optimizations
  app.get("/api/products", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "technical_team"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string) || '';
      const sortBy = (req.query.sortBy as string) || 'name';
      const sortOrder = (req.query.sortOrder as string) || 'asc';
      
      // Get products with pagination
      const products = await storage.listProducts();
      
      // Apply search filter if provided
      let filteredProducts = products;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredProducts = products.filter((product: any) => 
          product.name?.toLowerCase().includes(searchLower) ||
          product.type?.toLowerCase().includes(searchLower) ||
          product.make?.toLowerCase().includes(searchLower)
        );
      }
      
      // Sort products
      filteredProducts.sort((a: any, b: any) => {
        const aValue = a[sortBy] || '';
        const bValue = b[sortBy] || '';
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortOrder === 'asc'
            ? (aValue > bValue ? 1 : -1)
            : (bValue > aValue ? 1 : -1);
        }
      });
      
      // Calculate pagination values
      const totalItems = filteredProducts.length;
      const totalPages = Math.ceil(totalItems / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = Math.min(startIndex + limit, totalItems);
      
      // Get paginated subset
      const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
      
      // Return with pagination metadata
      res.json({
        data: paginatedProducts,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "technical_team"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "technical_team"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.patch("/api/products/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "technical_team"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const productData = insertProductSchema.partial().parse(req.body);
      const updatedProduct = await storage.updateProduct(
        req.params.id,
        productData,
      );
      if (!updatedProduct) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(updatedProduct);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || !["master_admin", "admin"].includes(user.role || "")) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteProduct(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Quotations with pagination and performance optimizations
  app.get("/api/quotations", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "sales_and_marketing"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string) || '';
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) || 'desc'; // Default newest first
      const status = (req.query.status as string) || '';
      
      // Get quotations
      const quotations = await storage.listQuotations();
      
      // Apply search & status filter if provided
      let filteredQuotations = quotations;
      
      if (status) {
        filteredQuotations = filteredQuotations.filter((quotation: any) => 
          quotation.status?.toLowerCase() === status.toLowerCase()
        );
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        // Get customer details for better search
        const customers = await storage.listCustomers();
        const customerMap = new Map();
        customers.forEach((customer: any) => {
          customerMap.set(customer.id, customer);
        });
        
        filteredQuotations = filteredQuotations.filter((quotation: any) => {
          const customer = customerMap.get(quotation.customerId);
          // Search by quotation ID, amount, status, or customer name
          return (
            quotation.id?.toLowerCase().includes(searchLower) ||
            quotation.status?.toLowerCase().includes(searchLower) ||
            (customer && customer.name?.toLowerCase().includes(searchLower))
          );
        });
      }
      
      // Sort quotations
      filteredQuotations.sort((a: any, b: any) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];
        
        // Handle dates for proper sorting
        if (sortBy === 'createdAt') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortOrder === 'asc'
            ? (aValue > bValue ? 1 : -1)
            : (bValue > aValue ? 1 : -1);
        }
      });
      
      // Calculate pagination values
      const totalItems = filteredQuotations.length;
      const totalPages = Math.ceil(totalItems / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = Math.min(startIndex + limit, totalItems);
      
      // Get paginated subset
      const paginatedQuotations = filteredQuotations.slice(startIndex, endIndex);
      
      // Enhance with customer data
      const enhancedQuotations = await Promise.all(
        paginatedQuotations.map(async (quotation: any) => {
          let customerName = "Unknown Customer";
          try {
            const customer = await storage.getCustomer(quotation.customerId);
            if (customer) {
              customerName = customer.name;
            }
          } catch (error) {
            console.error("Error fetching customer for quotation:", error);
          }
          
          return {
            ...quotation,
            customerName
          };
        })
      );
      
      // Return with pagination metadata
      res.json({
        data: enhancedQuotations,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error("Error fetching quotations:", error);
      res.status(500).json({ message: "Failed to fetch quotations" });
    }
  });

  app.get("/api/quotations/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "sales_and_marketing"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const quotation = await storage.getQuotation(req.params.id);
      if (!quotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      res.json(quotation);
    } catch (error) {
      console.error("Error fetching quotation:", error);
      res.status(500).json({ message: "Failed to fetch quotation" });
    }
  });

  app.post("/api/quotations", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "sales_and_marketing"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const quotationData = insertQuotationSchema.parse(req.body);
      const quotation = await storage.createQuotation(quotationData);
      res.status(201).json(quotation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating quotation:", error);
      res.status(500).json({ message: "Failed to create quotation" });
    }
  });

  app.patch("/api/quotations/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "sales_and_marketing"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const quotationData = insertQuotationSchema.partial().parse(req.body);
      const updatedQuotation = await storage.updateQuotation(
        req.params.id,
        quotationData,
      );
      if (!updatedQuotation) {
        return res.status(404).json({ message: "Quotation not found" });
      }
      res.json(updatedQuotation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating quotation:", error);
      res.status(500).json({ message: "Failed to update quotation" });
    }
  });

  app.delete("/api/quotations/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || !["master_admin", "admin"].includes(user.role || "")) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteQuotation(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting quotation:", error);
      res.status(500).json({ message: "Failed to delete quotation" });
    }
  });

  // Invoices with pagination and performance optimizations
  app.get("/api/invoices", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "accounts"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Parse pagination parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = (req.query.search as string) || '';
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) || 'desc'; // Default newest first
      const status = (req.query.status as string) || '';
      
      // Get invoices
      const invoices = await storage.listInvoices();
      
      // Apply search & status filter if provided
      let filteredInvoices = invoices;
      
      if (status) {
        filteredInvoices = filteredInvoices.filter((invoice: any) => 
          invoice.status?.toLowerCase() === status.toLowerCase()
        );
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        // Get customer details for better search
        const customers = await storage.listCustomers();
        const customerMap = new Map();
        customers.forEach((customer: any) => {
          customerMap.set(customer.id, customer);
        });
        
        filteredInvoices = filteredInvoices.filter((invoice: any) => {
          const customer = customerMap.get(invoice.customerId);
          // Search by invoice ID, amount, status, or customer name
          return (
            invoice.id?.toLowerCase().includes(searchLower) ||
            invoice.status?.toLowerCase().includes(searchLower) ||
            (customer && customer.name?.toLowerCase().includes(searchLower))
          );
        });
      }
      
      // Sort invoices
      filteredInvoices.sort((a: any, b: any) => {
        let aValue = a[sortBy];
        let bValue = b[sortBy];
        
        // Handle dates for proper sorting
        if (sortBy === 'createdAt') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue);
        } else {
          return sortOrder === 'asc'
            ? (aValue > bValue ? 1 : -1)
            : (bValue > aValue ? 1 : -1);
        }
      });
      
      // Calculate pagination values
      const totalItems = filteredInvoices.length;
      const totalPages = Math.ceil(totalItems / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = Math.min(startIndex + limit, totalItems);
      
      // Get paginated subset
      const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);
      
      // Enhance with customer data
      const enhancedInvoices = await Promise.all(
        paginatedInvoices.map(async (invoice: any) => {
          let customerName = "Unknown Customer";
          try {
            const customer = await storage.getCustomer(invoice.customerId);
            if (customer) {
              customerName = customer.name;
            }
          } catch (error) {
            console.error("Error fetching customer for invoice:", error);
          }
          
          return {
            ...invoice,
            customerName
          };
        })
      );
      
      // Return with pagination metadata
      res.json({
        data: enhancedInvoices,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/invoices/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "accounts"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  app.post("/api/invoices", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "accounts"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const invoiceData = insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  app.patch("/api/invoices/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (
        !user ||
        !["master_admin", "admin", "accounts"].includes(
          user.role || user.department || "",
        )
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const invoiceData = insertInvoiceSchema.partial().parse(req.body);
      const updatedInvoice = await storage.updateInvoice(
        req.params.id,
        invoiceData,
      );
      if (!updatedInvoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(updatedInvoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  app.delete("/api/invoices/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || !["master_admin", "admin"].includes(user.role || "")) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deleteInvoice(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Leaves
  app.get("/api/leaves", verifyAuth, async (req, res) => {
    try {
      const { userId, status } = req.query;
      const requestingUser = await storage.getUser(req.user.uid);
      if (!requestingUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (userId) {
        if (
          requestingUser.role !== "master_admin" &&
          requestingUser.role !== "admin" &&
          requestingUser.id !== userId
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const leaves = await storage.listLeavesByUser(userId as string);
        return res.json(leaves);
      }

      if (status === "pending") {
        if (
          requestingUser.role !== "master_admin" &&
          requestingUser.role !== "admin" &&
          requestingUser.department !== "hr"
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const leaves = await storage.listPendingLeaves();
        return res.json(leaves);
      }

      res.status(400).json({ message: "Missing required query parameters" });
    } catch (error) {
      console.error("Error fetching leaves:", error);
      res.status(500).json({ message: "Failed to fetch leaves" });
    }
  });

  app.get("/api/leaves/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      const leave = await storage.getLeave(req.params.id);
      if (!leave) {
        return res.status(404).json({ message: "Leave record not found" });
      }
      if (
        !user ||
        (user.role !== "master_admin" &&
          user.role !== "admin" &&
          user.department !== "hr" &&
          leave.userId !== user.id)
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(leave);
    } catch (error) {
      console.error("Error fetching leave:", error);
      res.status(500).json({ message: "Failed to fetch leave" });
    }
  });

  app.post("/api/leaves", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user) {
        return res.status(403).json({ message: "Access denied" });
      }
      const leaveData = insertLeaveSchema.parse({
        ...req.body,
        userId: user.id,
      });
      const leave = await storage.createLeave(leaveData);
      res.status(201).json(leave);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating leave:", error);
      res.status(500).json({ message: "Failed to create leave" });
    }
  });

  app.patch("/api/leaves/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      const leave = await storage.getLeave(req.params.id);
      if (!leave) {
        return res.status(404).json({ message: "Leave record not found" });
      }
      if (
        !user ||
        (user.role !== "master_admin" &&
          user.role !== "admin" &&
          user.department !== "hr" &&
          leave.userId !== user.id)
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
      const leaveData = insertLeaveSchema.partial().parse(req.body);
      const updatedLeave = await storage.updateLeave(req.params.id, leaveData);
      if (!updatedLeave) {
        return res.status(404).json({ message: "Leave record not found" });
      }
      res.json(updatedLeave);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating leave:", error);
      res.status(500).json({ message: "Failed to update leave" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
