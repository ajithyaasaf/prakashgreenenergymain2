import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
  insertAttendancePolicySchema,
  departments
} from "@shared/schema";
// Import all the necessary schemas from storage.ts since they've been moved there
import { 
  insertUserSchema,
  insertDepartmentSchema,
  insertDesignationSchema,
  insertPermissionGroupSchema,
  insertCustomerSchema,
  insertProductSchema,
  insertQuotationSchema,
  insertInvoiceSchema,
  insertLeaveSchema
} from "./storage";
import { isWithinGeoFence, calculateDistance, performAutomaticLocationCalibration } from "./utils";
import { UnifiedAttendanceService } from "./services/unified-attendance-service";
import { EnterprisePerformanceMonitor } from "./services/performance-monitor";
import { auth } from "./firebase";
import { userService } from "./services/user-service";
import { testFirebaseAdminSDK, testUserManagement } from "./test-firebase-admin";
import { attendanceRateLimiter, generalRateLimiter, createRateLimitMiddleware } from "./utils/rate-limiter";

export async function registerRoutes(app: Express): Promise<Server> {
  // Enhanced middleware to verify Firebase Auth token and load user profile
  const verifyAuth = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    console.log("SERVER AUTH: Headers received:", !!authHeader, authHeader ? "Bearer format: " + authHeader.startsWith("Bearer ") : "no header");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: Missing or invalid token" });
    }
    const token = authHeader.split("Bearer ")[1];
    console.log("SERVER AUTH: Token extracted, length:", token.length);
    try {
      const decodedToken = await auth.verifyIdToken(token);
      req.user = decodedToken;
      
      // Load user profile from storage
      const userProfile = await storage.getUser(decodedToken.uid);
      console.log("SERVER DEBUG: User profile loaded:", userProfile ? { uid: userProfile.uid, role: userProfile.role, department: userProfile.department, designation: userProfile.designation } : "null");
      
      if (userProfile) {
        // Attach enhanced user data for permission checking
        req.authenticatedUser = {
          uid: decodedToken.uid,
          user: userProfile,
          permissions: [],
          canApprove: false,
          maxApprovalAmount: null
        };
        
        // Master admin gets all permissions first - Use dynamic import for consistency
        if (userProfile.role === "master_admin") {
          const { systemPermissions } = await import("@shared/schema");
          req.authenticatedUser.permissions = [...systemPermissions];
          req.authenticatedUser.canApprove = true;
          req.authenticatedUser.maxApprovalAmount = null; // Unlimited
          console.log("SERVER DEBUG: Master admin permissions assigned:", req.authenticatedUser.permissions.length);
        }
        // Calculate permissions if user has department and designation
        else if (userProfile.department && userProfile.designation) {
          try {
            console.log("SERVER DEBUG: About to calculate permissions for dept:", userProfile.department, "designation:", userProfile.designation);
            const { getEffectivePermissions } = await import("@shared/schema");
            const effectivePermissions = getEffectivePermissions(userProfile.department, userProfile.designation);
            req.authenticatedUser.permissions = effectivePermissions;
            console.log("SERVER DEBUG: Calculated permissions for user", userProfile.uid, "with dept:", userProfile.department, "designation:", userProfile.designation, "permissions:", effectivePermissions.length, "list:", effectivePermissions);
            
            // Set approval capabilities based on designation - Fixed duplicate keys
            const designationLevels = {
              "house_man": 1, 
              "welder": 2, 
              "technician": 3, 
              "cre": 4,
              "executive": 5, 
              "team_leader": 6, 
              "officer": 7, 
              "gm": 8, 
              "ceo": 9
            };
            const level = designationLevels[userProfile.designation] || 1;
            req.authenticatedUser.canApprove = level >= 5;
            req.authenticatedUser.maxApprovalAmount = level >= 8 ? null : level >= 7 ? 1000000 : level >= 6 ? 500000 : level >= 5 ? 100000 : null;
          } catch (error) {
            console.error("Error calculating permissions:", error);
            console.error("Error details:", error.stack);
          }
        } else {
          // New employee without department/designation gets default permissions
          console.log("SERVER DEBUG: User missing department or designation:", userProfile.uid, "dept:", userProfile.department, "designation:", userProfile.designation);
          try {
            const { getNewEmployeePermissions } = await import("@shared/schema");
            const defaultPermissions = getNewEmployeePermissions();
            req.authenticatedUser.permissions = defaultPermissions;
            req.authenticatedUser.canApprove = false;
            req.authenticatedUser.maxApprovalAmount = null;
            console.log("SERVER DEBUG: Assigned default permissions for new employee:", userProfile.uid, "permissions:", defaultPermissions);
          } catch (error) {
            console.error("Error loading default permissions:", error);
            req.authenticatedUser.permissions = ["dashboard.view", "attendance.view_own", "leave.view_own", "leave.request"];
          }
        }
        
      }
      
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

  // Users - enterprise permission based access
  app.get("/api/users", verifyAuth, async (req, res) => {
    try {
      // Try to get user first, if not found, sync from Firebase Auth
      let user = await storage.getUser(req.user.uid);
      if (!user) {
        // Sync user from Firebase Auth if not found in storage
        const syncResult = await userService.syncUserProfile(req.user.uid, { role: 'employee' });
        if (syncResult.success) {
          user = syncResult.user;
        }
      }
      
      // Check enterprise permissions instead of hardcoded roles
      if (!user || !(await storage.checkEffectiveUserPermission(user.uid, "users.view"))) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const result = await userService.getAllUsers();
      if (Array.isArray(result)) {
        res.json(result);
      } else if (!result.success) {
        return res.status(500).json({ message: result.error });
      } else {
        res.json(result.users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      // Allow users to view their own profile or check enterprise permissions for viewing others
      const canViewOwnProfile = user && user.id === req.params.id;
      const hasViewPermission = user && await storage.checkEffectiveUserPermission(user.uid, "users.view");
      
      if (!user || (!canViewOwnProfile && !hasViewPermission)) {
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
      // Check enterprise permission for user creation
      if (!user || !(await storage.checkEffectiveUserPermission(user.uid, "users.create"))) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const result = await userService.createUser(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.status(201).json(result.user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      // Check enterprise permissions for user editing
      if (!user || !(await storage.checkEffectiveUserPermission(user.uid, "users.edit"))) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check role assignment permissions using enterprise RBAC
      if (req.body.role === "master_admin" && !(await storage.checkEffectiveUserPermission(user.uid, "permissions.assign"))) {
        return res
          .status(403)
          .json({ message: "Insufficient permissions to assign master_admin role" });
      }
      
      const result = await userService.updateUserProfile(req.params.id, req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json(result.user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Registration endpoint for new users (public - no auth required)
  app.post("/api/auth/register", async (req, res) => {
    try {
      console.log("Registration request received:", req.body);
      
      const result = await userService.createUser({
        ...req.body,
        role: "employee" // Force employee role for public registration
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.status(201).json({ 
        message: "User registered successfully",
        user: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          role: result.user.role
        }
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });

  // Public endpoint for syncing user profile after Firebase Auth registration
  app.post("/api/sync-user", async (req, res) => {
    try {
      console.log("User sync request received:", req.body);
      
      // Get UID from request body or auth token
      let uid = req.body.uid;
      
      if (!uid) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
          const token = authHeader.split("Bearer ")[1];
          try {
            const decodedToken = await auth.verifyIdToken(token);
            uid = decodedToken.uid;
          } catch (error) {
            console.error("Token verification failed during sync:", error);
            return res.status(401).json({ message: "Invalid or missing authentication" });
          }
        } else {
          return res.status(400).json({ message: "UID required for user sync" });
        }
      }
      
      const result = await userService.syncUserProfile(uid, req.body);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({
        message: "User profile synced successfully",
        user: result.user,
        action: result.action
      });
    } catch (error) {
      console.error("Error syncing user:", error);
      res.status(500).json({ message: "Failed to sync user profile" });
    }
  });

  // Sync user endpoint to fix existing user data
  app.post("/api/auth/sync", verifyAuth, async (req, res) => {
    try {
      // Pass any displayName from the request body to preserve user registration data
      const syncData = req.body.displayName ? { displayName: req.body.displayName } : {};
      const result = await userService.syncUserProfile(req.user.uid, syncData);
      
      if (!result.success) {
        return res.status(400).json({ message: result.error });
      }
      
      res.json({
        message: "User profile synced successfully",
        user: result.user,
        action: result.action
      });
    } catch (error) {
      console.error("Error syncing user:", error);
      res.status(500).json({ message: "Failed to sync user profile" });
    }
  });

  // Enterprise-grade user permission routes
  app.get("/api/users/:id/permissions", verifyAuth, async (req, res) => {
    try {
      const requestingUser = await storage.getUser(req.user.uid);
      if (!requestingUser) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Allow users to check their own permissions or admins to check others
      if (req.params.id !== req.user.uid && requestingUser.role !== "master_admin" && requestingUser.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get effective permissions using enterprise RBAC
      const effectivePermissions = await storage.getEffectiveUserPermissions(req.params.id);
      const approvalLimits = await storage.getUserApprovalLimits(req.params.id);
      
      res.json({
        user: {
          uid: targetUser.uid,
          email: targetUser.email,
          displayName: targetUser.displayName,
          role: targetUser.role,
          department: targetUser.department,
          designation: targetUser.designation
        },
        permissions: effectivePermissions,
        canApprove: approvalLimits.canApprove,
        maxApprovalAmount: approvalLimits.maxAmount,
        rbacInfo: {
          departmentAccess: targetUser.department ? `Department: ${targetUser.department} (defines which modules they can access)` : null,
          designationLevel: targetUser.designation ? `Designation: ${targetUser.designation} (defines what actions they can perform)` : null
        }
      });
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // Enterprise RBAC testing endpoint
  app.get("/api/rbac/test", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master admin only" });
      }

      const { getDepartmentModuleAccess, getDesignationActionPermissions, getEffectivePermissions } = await import("@shared/schema");
      
      // Test different department + designation combinations
      const testCases = [
        { department: "operations", designation: "ceo" },
        { department: "admin", designation: "executive" },
        { department: "hr", designation: "executive" },
        { department: "marketing", designation: "executive" },
        { department: "sales", designation: "cre" },
        { department: "technical", designation: "team_leader" },
        { department: "housekeeping", designation: "house_man" }
      ];

      const results = testCases.map(({ department, designation }) => ({
        combination: `${department} + ${designation}`,
        departmentAccess: getDepartmentModuleAccess(department as any),
        designationActions: getDesignationActionPermissions(designation as any),
        effectivePermissions: getEffectivePermissions(department as any, designation as any)
      }));

      res.json({
        message: "Enterprise RBAC Test Results",
        description: "Department = Feature Access (modules), Designation = Action Permissions (what they can do)",
        testResults: results,
        currentUser: {
          department: user.department,
          designation: user.designation,
          effectivePermissions: await storage.getEffectiveUserPermissions(user.uid)
        }
      });
    } catch (error) {
      console.error("Error testing RBAC:", error);
      res.status(500).json({ message: "Failed to test RBAC system" });
    }
  });

  app.get("/api/users/department/:department", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (user.role !== "master_admin" && user.role !== "admin")) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const users = await storage.getUsersByDepartment(req.params.department);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users by department:", error);
      res.status(500).json({ message: "Failed to fetch users by department" });
    }
  });

  app.get("/api/users/designation/:designation", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (user.role !== "master_admin" && user.role !== "admin")) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const users = await storage.getUsersByDesignation(req.params.designation);
      res.json(users);
    } catch (error) {
      console.error("Error fetching users by designation:", error);
      res.status(500).json({ message: "Failed to fetch users by designation" });
    }
  });

  app.get("/api/users/:managerId/subordinates", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Allow users to check their own subordinates or admins to check others
      if (req.params.managerId !== req.user.uid && user.role !== "master_admin" && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const subordinates = await storage.getUsersByReportingManager(req.params.managerId);
      res.json(subordinates);
    } catch (error) {
      console.error("Error fetching subordinates:", error);
      res.status(500).json({ message: "Failed to fetch subordinates" });
    }
  });

  // Designation Management Routes
  app.get("/api/designations", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (user.role !== "master_admin" && user.role !== "admin")) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const designations = await storage.listDesignations();
      res.json(designations);
    } catch (error) {
      console.error("Error fetching designations:", error);
      res.status(500).json({ message: "Failed to fetch designations" });
    }
  });

  app.post("/api/designations", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const designation = await storage.createDesignation(req.body);
      res.status(201).json(designation);
    } catch (error) {
      console.error("Error creating designation:", error);
      res.status(500).json({ message: "Failed to create designation" });
    }
  });

  app.patch("/api/designations/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const designation = await storage.updateDesignation(req.params.id, req.body);
      res.json(designation);
    } catch (error) {
      console.error("Error updating designation:", error);
      res.status(500).json({ message: "Failed to update designation" });
    }
  });

  app.delete("/api/designations/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteDesignation(req.params.id);
      res.json({ message: "Designation deleted successfully" });
    } catch (error) {
      console.error("Error deleting designation:", error);
      res.status(500).json({ message: "Failed to delete designation" });
    }
  });

  // Permission Group Management Routes
  app.get("/api/permission-groups", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const permissionGroups = await storage.listPermissionGroups();
      res.json(permissionGroups);
    } catch (error) {
      console.error("Error fetching permission groups:", error);
      res.status(500).json({ message: "Failed to fetch permission groups" });
    }
  });

  app.post("/api/permission-groups", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const permissionGroup = await storage.createPermissionGroup(req.body);
      res.status(201).json(permissionGroup);
    } catch (error) {
      console.error("Error creating permission group:", error);
      res.status(500).json({ message: "Failed to create permission group" });
    }
  });

  app.patch("/api/permission-groups/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const permissionGroup = await storage.updatePermissionGroup(req.params.id, req.body);
      res.json(permissionGroup);
    } catch (error) {
      console.error("Error updating permission group:", error);
      res.status(500).json({ message: "Failed to update permission group" });
    }
  });

  app.delete("/api/permission-groups/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deletePermissionGroup(req.params.id);
      res.json({ message: "Permission group deleted successfully" });
    } catch (error) {
      console.error("Error deleting permission group:", error);
      res.status(500).json({ message: "Failed to delete permission group" });
    }
  });

  // Migration endpoint for organizational structure
  app.post("/api/admin/migrate-organization", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - master admin only" });
      }
      
      const { migrateOrganizationalStructure } = await import('./migration-organizational-structure');
      const result = await migrateOrganizationalStructure();
      
      if (result.success) {
        res.json({ 
          message: "Migration completed successfully", 
          migratedCount: result.migratedCount 
        });
      } else {
        res.status(500).json({ 
          message: "Migration failed", 
          error: result.error 
        });
      }
    } catch (error) {
      console.error("Error running migration:", error);
      res.status(500).json({ message: "Failed to run migration" });
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
      let officeLocations = await storage.listOfficeLocations();
      
      // If no office locations exist, create default office location
      if (officeLocations.length === 0) {
        const defaultLocation = {
          name: "Head Office - Prakash Greens Energy",
          latitude: "9.966844592415782",
          longitude: "78.1338405791111",
          radius: 100
        };
        
        await storage.createOfficeLocation(defaultLocation);
        officeLocations = await storage.listOfficeLocations();
      }
      
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
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const requestingUser = req.authenticatedUser.user;

      // If specific userId and date requested
      if (userId && date) {
        // Users can only access their own data unless they're admin/master_admin
        if (
          requestingUser.role !== "master_admin" &&
          requestingUser.role !== "admin" &&
          requestingUser.uid !== userId
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const attendance = await storage.getUserAttendanceForDate(userId as string, date as string);
        return res.json(attendance || null);
      }

      // If specific userId requested (all records for that user)
      if (userId) {
        // Users can only access their own data unless they're admin/master_admin
        if (
          requestingUser.role !== "master_admin" &&
          requestingUser.role !== "admin" &&
          requestingUser.uid !== userId
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
        const attendance = await storage.listAttendanceByUser(userId as string);
        return res.json(attendance);
      }

      // If specific date requested (all users for that date - admin only)
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

      // Default case: return current user's own attendance data
      // This allows employees to view their own attendance without specifying userId
      const attendance = await storage.listAttendanceByUser(requestingUser.uid);
      return res.json(attendance);
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
        accuracy = 100,
        attendanceType = "office",
        customerName,
        reason,
        imageUrl
      } = req.body;
      
      if (!userId || userId !== req.user.uid) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Input validation
      if (!latitude || !longitude) {
        return res.status(400).json({ 
          message: "Location coordinates are required",
          recommendations: ["Please enable location services and try again"]
        });
      }

      if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return res.status(400).json({ 
          message: "Invalid location coordinates",
          recommendations: ["Location must be valid GPS coordinates"]
        });
      }

      // Import and use unified attendance service
      const { UnifiedAttendanceService } = await import('./services/unified-attendance-service');
      
      const checkInRequest = {
        userId,
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: Number(accuracy),
        attendanceType: attendanceType as 'office' | 'remote' | 'field_work',
        reason,
        customerName,
        imageUrl
      };

      console.log('ENTERPRISE CHECK-IN: Processing request with advanced location validation');
      console.log('Location:', { latitude, longitude, accuracy, attendanceType });

      const result = await UnifiedAttendanceService.processCheckIn(checkInRequest);

      if (!result.success) {
        console.log('ENTERPRISE CHECK-IN: Validation failed -', result.message);
        return res.status(400).json({
          message: result.message,
          locationValidation: {
            type: result.locationValidation.validationType,
            confidence: Math.round(result.locationValidation.confidence * 100),
            distance: result.locationValidation.distance,
            detectedOffice: result.locationValidation.detectedOffice?.name,
            message: result.locationValidation.message
          },
          recommendations: result.recommendations || result.locationValidation.recommendations
        });
      }

      console.log('ENTERPRISE CHECK-IN: Success -', result.message);
      console.log('Location validation:', result.locationValidation.validationType, 
                  'Confidence:', Math.round(result.locationValidation.confidence * 100) + '%');

      // Success response with comprehensive information
      res.status(201).json({
        message: result.message,
        success: true,
        attendance: {
          id: result.attendanceId,
          type: attendanceType,
          timestamp: new Date().toISOString(),
          ...result.attendanceDetails
        },
        location: {
          validation: {
            type: result.locationValidation.validationType,
            confidence: Math.round(result.locationValidation.confidence * 100),
            distance: result.locationValidation.distance,
            accuracy: result.locationValidation.metadata.accuracy,
            indoorDetection: result.locationValidation.metadata.indoorDetection
          },
          office: result.locationValidation.detectedOffice ? {
            name: result.locationValidation.detectedOffice.name,
            distance: result.locationValidation.detectedOffice.distance
          } : null
        },
        recommendations: result.recommendations,
        enterprise: {
          version: "v2.0-unified",
          locationEngine: "enterprise-grade",
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error("Enterprise check-in error:", error);
      res.status(500).json({ 
        message: "System error during check-in processing",
        error: {
          type: "enterprise_service_error",
          timestamp: new Date().toISOString()
        },
        recommendations: [
          "Please try again in a moment",
          "If the issue persists, contact system administrator"
        ]
      });
    }
  });

  // Photo upload endpoint for attendance
  app.post("/api/attendance/upload-photo", verifyAuth, async (req, res) => {
    try {
      const { imageData, userId, attendanceType } = req.body;

      // Validate request
      if (!imageData || !userId || userId !== req.user.uid) {
        return res.status(400).json({ 
          message: "Invalid request - image data and user ID required" 
        });
      }

      if (!attendanceType) {
        return res.status(400).json({ 
          message: "Attendance type is required for photo upload" 
        });
      }

      // Validate base64 image format
      if (!imageData.startsWith('data:image/')) {
        return res.status(400).json({ 
          message: "Invalid image format - base64 image data required" 
        });
      }

      console.log('SERVER: Processing photo upload for user:', userId, 'type:', attendanceType);
      console.log('SERVER: Image data size:', imageData.length);

      // Import and use Cloudinary service
      const { CloudinaryService } = await import('./services/cloudinary-service');
      
      // Upload to Cloudinary
      const uploadResult = await CloudinaryService.uploadAttendancePhoto(
        imageData, 
        userId, 
        new Date()
      );

      if (!uploadResult.success) {
        console.error('SERVER: Cloudinary upload failed:', uploadResult.error);
        return res.status(500).json({
          message: "Photo upload failed",
          error: uploadResult.error
        });
      }

      console.log('SERVER: Photo uploaded successfully to:', uploadResult.url);

      // Log the photo upload activity
      const user = await storage.getUser(userId);
      if (user) {
        await storage.createActivityLog({
          type: 'attendance',
          title: 'Attendance Photo Uploaded',
          description: `${user.displayName} uploaded photo for ${attendanceType} attendance`,
          entityId: uploadResult.publicId || 'unknown',
          entityType: 'cloudinary_image',
          userId: user.uid
        });
      }

      res.json({
        success: true,
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        message: "Photo uploaded successfully"
      });

    } catch (error) {
      console.error('SERVER: Photo upload error:', error);
      res.status(500).json({
        message: "Internal server error during photo upload",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/attendance/check-out", createRateLimitMiddleware(attendanceRateLimiter), verifyAuth, async (req, res) => {
    try {
      console.log('CHECKOUT DEBUG: Request body:', JSON.stringify(req.body, null, 2));
      
      const { userId, latitude, longitude, imageUrl, reason, otReason } = req.body;
      
      console.log('CHECKOUT DEBUG: Extracted data:', {
        userId, latitude, longitude, 
        hasImageUrl: !!imageUrl, 
        reason, otReason,
        reqUserUid: req.user.uid
      });
      
      if (!userId || userId !== req.user.uid) {
        console.log('CHECKOUT DEBUG: Access denied - userId mismatch');
        return res.status(403).json({ message: "Access denied" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        console.log('CHECKOUT DEBUG: User not found');
        return res.status(404).json({ message: "User not found" });
      }

      console.log('CHECKOUT DEBUG: User found:', user.displayName, user.department);

      // Handle midnight boundary: look for attendance record from today OR yesterday
      // This covers cases where someone checked in late and is checking out after midnight
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // First try to find attendance record for today
      let attendanceRecord = await storage.getAttendanceByUserAndDate(userId, today);
      
      // If not found today and it's early hours (before 6 AM), check yesterday
      // This handles night shift workers who check in late and checkout after midnight
      if (!attendanceRecord && now.getHours() < 6) {
        console.log('CHECKOUT DEBUG: No record found for today, checking yesterday for night shift');
        attendanceRecord = await storage.getAttendanceByUserAndDate(userId, yesterday);
      }
      
      if (!attendanceRecord) {
        console.log('CHECKOUT DEBUG: No attendance record found for today or yesterday');
        return res.status(400).json({ message: "No check-in record found for today" });
      }
      
      // Additional validation: ensure the record doesn't already have checkout
      if (attendanceRecord && !attendanceRecord.checkOutTime) {
        console.log('CHECKOUT DEBUG: Valid attendance record found for checkout');
      }

      console.log('CHECKOUT DEBUG: Attendance record found:', {
        id: attendanceRecord.id,
        hasCheckOut: !!attendanceRecord.checkOutTime,
        checkInTime: attendanceRecord.checkInTime
      });

      if (attendanceRecord.checkOutTime) {
        return res.status(400).json({ message: "You have already checked out today" });
      }

      const checkOutTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
      );

      // Get department timing from database
      const departmentTiming = user.department 
        ? await storage.getDepartmentTiming(user.department)
        : null;

      // Use department-specific timing or defaults
      const expectedCheckOutTime = departmentTiming?.checkOutTime || "6:00 PM";
      
      // Parse 12-hour format time string (e.g., "6:00 PM")
      const timeMatch = expectedCheckOutTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      let checkOutHour, checkOutMinute;
      
      if (timeMatch) {
        let [, hours, minutes, period] = timeMatch;
        checkOutHour = parseInt(hours);
        checkOutMinute = parseInt(minutes);
        
        // Convert to 24-hour format
        if (period.toUpperCase() === 'PM' && checkOutHour !== 12) {
          checkOutHour += 12;
        } else if (period.toUpperCase() === 'AM' && checkOutHour === 12) {
          checkOutHour = 0;
        }
      } else {
        // Fallback: try to parse as 24-hour format
        const timeParts = expectedCheckOutTime.split(":").map(Number);
        checkOutHour = timeParts[0] || 18;
        checkOutMinute = timeParts[1] || 0;
      }
      
      console.log('CHECKOUT TIME PARSING:', {
        originalTime: expectedCheckOutTime,
        parsedHour: checkOutHour,
        parsedMinute: checkOutMinute,
        timeMatch: timeMatch ? 'matched' : 'fallback'
      });
      
      // Handle midnight boundary for expected checkout time
      const checkInTime = new Date(attendanceRecord.checkInTime || new Date());
      const checkInDate = new Date(checkInTime);
      checkInDate.setHours(0, 0, 0, 0); // Get check-in date (midnight)
      
      // Expected checkout should be on the same day as check-in, unless it's a night shift
      let expectedCheckOutTimeObj = new Date(
        checkInDate.getFullYear(),
        checkInDate.getMonth(),
        checkInDate.getDate(),
        checkOutHour,
        checkOutMinute,
        0,
        0
      );
      
      // Validate the date object before proceeding
      if (isNaN(expectedCheckOutTimeObj.getTime())) {
        console.error('Invalid expectedCheckOutTimeObj created:', {
          checkOutHour,
          checkOutMinute,
          expectedCheckOutTime,
          checkInDate: checkInDate.toISOString()
        });
        // Use fallback time (6:00 PM)
        expectedCheckOutTimeObj = new Date(
          checkInDate.getFullYear(),
          checkInDate.getMonth(),
          checkInDate.getDate(),
          18,
          0,
          0,
          0
        );
      }
      
      // If expected checkout is before check-in time, it means it's next day (night shift)
      if (expectedCheckOutTimeObj <= checkInTime) {
        expectedCheckOutTimeObj.setDate(expectedCheckOutTimeObj.getDate() + 1);
      }

      // Calculate working hours with proper midnight boundary handling
      let workingMilliseconds = checkOutTime.getTime() - checkInTime.getTime();
      
      // If working time is negative, it means checkout happened next day
      if (workingMilliseconds < 0) {
        // This shouldn't happen in normal cases, but handle edge cases
        console.warn('CHECKOUT WARNING: Negative working time detected, possible date boundary issue');
        workingMilliseconds = Math.abs(workingMilliseconds);
      }
      
      // Cap maximum working hours to prevent absurd calculations (e.g., 24+ hours)
      const maxWorkingHours = 24; // Maximum 24 hours in a single shift
      const calculatedWorkingHours = workingMilliseconds / (1000 * 60 * 60);
      const workingHours = Math.min(calculatedWorkingHours, maxWorkingHours);
      
      // Log midnight boundary handling for debugging (with safety checks)
      console.log('MIDNIGHT BOUNDARY DEBUG:', {
        checkInTime: checkInTime.toISOString(),
        checkOutTime: checkOutTime.toISOString(),
        calculatedWorkingHours,
        cappedWorkingHours: workingHours,
        expectedCheckOut: isNaN(expectedCheckOutTimeObj.getTime()) ? 'INVALID_DATE' : expectedCheckOutTimeObj.toISOString(),
        crossedMidnight: checkOutTime.getDate() !== checkInTime.getDate(),
        parsedCheckOutHour: checkOutHour,
        parsedCheckOutMinute: checkOutMinute,
        originalTimeString: expectedCheckOutTime
      });
      
      // Use department-specific working hours
      const standardWorkingHours = departmentTiming?.workingHours || 8;
      const overtimeThresholdMinutes = departmentTiming?.overtimeThresholdMinutes || 30;
      const overtimeHours = Math.max(0, workingHours - standardWorkingHours);
      
      // Check if overtime meets the threshold
      const overtimeMinutes = overtimeHours * 60;
      const hasOvertimeThreshold = overtimeMinutes >= overtimeThresholdMinutes;
      
      console.log('OVERTIME THRESHOLD CHECK:', {
        overtimeMinutes,
        overtimeThresholdMinutes,
        hasOvertimeThreshold,
        departmentTiming: departmentTiming ? 'loaded' : 'default'
      });
      
      // Check if overtime requires approval and photo
      if (hasOvertimeThreshold) {
        if (!otReason) {
          return res.status(400).json({
            message: `Overtime exceeds ${overtimeThresholdMinutes} minute threshold. Please provide a reason.`,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            overtimeMinutes: Math.round(overtimeMinutes),
            threshold: overtimeThresholdMinutes,
            requiresOTReason: true
          });
        }
        if (!imageUrl) {
          return res.status(400).json({
            message: `Overtime exceeds ${overtimeThresholdMinutes} minute threshold. Photo verification required.`,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            overtimeMinutes: Math.round(overtimeMinutes),
            threshold: overtimeThresholdMinutes,
            requiresPhoto: true
          });
        }
      }

      // Check for early checkout using department timing
      const earlyCheckout = checkOutTime < expectedCheckOutTimeObj;
      const earlyMinutes = earlyCheckout ? Math.floor((expectedCheckOutTimeObj.getTime() - checkOutTime.getTime()) / (1000 * 60)) : 0;
      
      console.log("CHECKOUT DEBUG:", {
        currentTime: checkOutTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        expectedTime: expectedCheckOutTimeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        earlyCheckout,
        earlyMinutes,
        reason: reason || "no reason provided",
        departmentTiming: departmentTiming ? 'loaded' : 'default',
        allowEarlyCheckOut: departmentTiming?.allowEarlyCheckOut
      });
      
      // Early checkout policy enforcement
      if (earlyCheckout && earlyMinutes > 30) {
        if (!departmentTiming?.allowEarlyCheckOut) {
          return res.status(400).json({
            message: `Early checkout is not allowed for ${user.department || 'your'} department. Current: ${checkOutTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}, Expected: ${expectedCheckOutTimeObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`,
            currentTime: checkOutTime,
            expectedCheckOutTime: expectedCheckOutTimeObj,
            requiresApproval: true,
            isEarlyCheckout: true,
            earlyMinutes
          });
        }
        
        if (!reason || reason.trim().length < 10) {
          return res.status(400).json({
            message: `Early checkout (${earlyMinutes} minutes early) requires a detailed reason (minimum 10 characters)`,
            currentTime: checkOutTime,
            expectedCheckOutTime: expectedCheckOutTimeObj,
            requiresReason: true,
            isEarlyCheckout: true,
            earlyMinutes
          });
        }
      }

      // Update attendance record with checkout details
      const updatedAttendance = await storage.updateAttendance(attendanceRecord.id, {
        checkOutTime,
        checkOutLatitude: String(latitude),
        checkOutLongitude: String(longitude),
        checkOutImageUrl: imageUrl,
        workingHours: Math.round(workingHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        otReason: hasOvertimeThreshold ? otReason : undefined,
        remarks: reason || (hasOvertimeThreshold ? `Overtime: ${otReason}` : undefined)
      });

      // Log activity
      await storage.createActivityLog({
        type: 'attendance',
        title: `Check-out ${hasOvertimeThreshold ? 'with Overtime' : ''}`,
        description: `${user.displayName} checked out${hasOvertimeThreshold ? ` with ${Math.round(overtimeHours * 100) / 100} hours overtime` : ''}${earlyCheckout ? ' (early checkout)' : ''}`,
        entityId: attendanceRecord.id,
        entityType: 'attendance',
        userId: user.uid
      });

      res.json({
        message: `Checked out successfully${hasOvertimeThreshold ? ` with ${Math.round(overtimeHours * 100) / 100} hours overtime` : ''}`,
        attendance: updatedAttendance,
        workingHours: Math.round(workingHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        hasOvertime: hasOvertimeThreshold,
        departmentSettings: {
          expectedCheckOut: expectedCheckOutTime,
          standardHours: standardWorkingHours,
          overtimeThreshold: overtimeThresholdMinutes
        }
      });
    } catch (error: any) {
      console.error("Error checking out:", error);
      res.status(500).json({ message: "Failed to process check-out" });
    }
  });

  // Department Timing Management APIs
  
  // Get all department timings
  app.get("/api/departments/timings", verifyAuth, async (req, res) => {
    try {
      const { user } = req.authenticatedUser;
      
      // Only master_admin can view all department timings
      if (user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Generate department timings dynamically from schema (12-hour format)
      const departmentTimingDefaults = {
        operations: {
          checkInTime: "9:00 AM", checkOutTime: "6:00 PM", workingHours: 9,
          overtimeThresholdMinutes: 30, lateThresholdMinutes: 15,
          allowEarlyCheckOut: false, allowRemoteWork: false, allowFieldWork: true
        },
        admin: {
          checkInTime: "9:30 AM", checkOutTime: "6:30 PM", workingHours: 8,
          overtimeThresholdMinutes: 30, lateThresholdMinutes: 15,
          allowEarlyCheckOut: true, allowRemoteWork: true, allowFieldWork: false
        },
        hr: {
          checkInTime: "9:30 AM", checkOutTime: "6:30 PM", workingHours: 8,
          overtimeThresholdMinutes: 30, lateThresholdMinutes: 15,
          allowEarlyCheckOut: true, allowRemoteWork: true, allowFieldWork: false
        },
        marketing: {
          checkInTime: "9:30 AM", checkOutTime: "6:30 PM", workingHours: 8,
          overtimeThresholdMinutes: 30, lateThresholdMinutes: 15,
          allowEarlyCheckOut: false, allowRemoteWork: true, allowFieldWork: true
        },
        sales: {
          checkInTime: "9:00 AM", checkOutTime: "7:00 PM", workingHours: 9,
          overtimeThresholdMinutes: 30, lateThresholdMinutes: 15,
          allowEarlyCheckOut: false, allowRemoteWork: true, allowFieldWork: true
        },
        technical: {
          checkInTime: "8:30 AM", checkOutTime: "5:30 PM", workingHours: 8,
          overtimeThresholdMinutes: 30, lateThresholdMinutes: 15,
          allowEarlyCheckOut: false, allowRemoteWork: false, allowFieldWork: true
        },
        housekeeping: {
          checkInTime: "8:00 AM", checkOutTime: "4:00 PM", workingHours: 7,
          overtimeThresholdMinutes: 30, lateThresholdMinutes: 15,
          allowEarlyCheckOut: false, allowRemoteWork: false, allowFieldWork: false
        }
      };

      // Build department timings object from schema
      const departmentTimings = Object.fromEntries(
        departments.map(dept => [
          dept, 
          departmentTimingDefaults[dept as keyof typeof departmentTimingDefaults] || {
            checkInTime: "9:00 AM", checkOutTime: "6:00 PM", workingHours: 8,
            overtimeThresholdMinutes: 30, lateThresholdMinutes: 15,
            allowEarlyCheckOut: false, allowRemoteWork: false, allowFieldWork: false
          }
        ])
      );
      
      res.json(departmentTimings);
    } catch (error: any) {
      console.error("Error fetching department timings:", error);
      res.status(500).json({ message: "Failed to fetch department timings" });
    }
  });

  // Get specific department timing
  app.get("/api/departments/:departmentId/timing", verifyAuth, async (req, res) => {
    try {
      const { departmentId } = req.params;
      const { user } = req.authenticatedUser;
      
      // Users can view their own department timing or master_admin can view all
      if (user.role !== "master_admin" && user.department !== departmentId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get timing from database using storage layer
      const timing = await storage.getDepartmentTiming(departmentId);
      
      if (!timing) {
        return res.status(404).json({ message: "Department timing not found" });
      }
      
      res.json(timing);
    } catch (error: any) {
      console.error("Error fetching department timing:", error);
      res.status(500).json({ message: "Failed to fetch department timing" });
    }
  });

  // Update department timing (Master admin only)
  app.post("/api/departments/:departmentId/timing", verifyAuth, async (req, res) => {
    try {
      const { departmentId } = req.params;
      const { user } = req.authenticatedUser;
      
      // Only master_admin can update department timings
      if (user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const {
        checkInTime,
        checkOutTime,
        workingHours,
        overtimeThresholdMinutes,
        lateThresholdMinutes,
        isFlexibleTiming,
        flexibleCheckInStart,
        flexibleCheckInEnd,
        breakDurationMinutes,
        weeklyOffDays
      } = req.body;
      
      // Validate timing data
      if (!checkInTime || !checkOutTime || !workingHours) {
        return res.status(400).json({ message: "Check-in time, check-out time, and working hours are required" });
      }
      
      const timingData = {
        checkInTime,
        checkOutTime,
        workingHours: parseInt(workingHours),
        overtimeThresholdMinutes: parseInt(overtimeThresholdMinutes) || 30,
        lateThresholdMinutes: parseInt(lateThresholdMinutes) || 15,
        isFlexibleTiming: Boolean(isFlexibleTiming),
        ...(flexibleCheckInStart && { flexibleCheckInStart }),
        ...(flexibleCheckInEnd && { flexibleCheckInEnd }),
        breakDurationMinutes: parseInt(breakDurationMinutes) || 60,
        weeklyOffDays: weeklyOffDays || [0],
        updatedBy: user.uid
      };

      // Save to database using storage layer
      const updatedTiming = await storage.updateDepartmentTiming(departmentId, timingData);
      
      // Clear Enterprise Time Service cache for this department
      const { EnterpriseTimeService } = await import("./services/enterprise-time-service");
      EnterpriseTimeService.clearDepartmentCache(departmentId);
      
      // Log activity
      await storage.createActivityLog({
        type: 'department_timing',
        title: 'Department Timing Updated',
        description: `${user.displayName} updated attendance timing for ${departmentId} department`,
        entityId: departmentId,
        entityType: 'department',
        userId: user.uid
      });
      
      res.json({
        message: "Department timing updated successfully",
        timing: updatedTiming
      });
    } catch (error: any) {
      console.error("Error updating department timing:", error);
      res.status(500).json({ message: "Failed to update department timing" });
    }
  });

  // Attendance Reports
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

  // Live attendance tracking API
  app.get("/api/attendance/live", verifyAuth, async (req, res) => {
    try {
      const { user } = req.authenticatedUser;
      
      // Only admin/master_admin can view live attendance
      if (user.role !== "master_admin" && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get all attendance records for today
      const attendanceRecords = await storage.listAttendanceByDate(today);
      
      // Get all users to enrich attendance data
      const allUsers = await storage.listUsers();
      
      // Create live attendance data with user details
      const liveAttendance = attendanceRecords.map((record) => {
        const userDetails = allUsers.find((u) => u.id === record.userId);
        const currentTime = new Date();
        const checkInTime = record.checkInTime ? new Date(record.checkInTime) : null;
        const workingHours = checkInTime 
          ? (currentTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)
          : 0;

        return {
          ...record,
          userName: userDetails?.displayName || `User #${record.userId}`,
          userEmail: userDetails?.email || null,
          userDepartment: userDetails?.department || null,
          userDesignation: userDetails?.designation || null,
          currentWorkingHours: Math.round(workingHours * 100) / 100,
          isOnline: !record.checkOutTime, // Still online if no checkout
          status: record.checkOutTime ? 'checked_out' : 'checked_in',
          location: record.attendanceType || 'office'
        };
      });

      res.json(liveAttendance);
    } catch (error) {
      console.error("Error fetching live attendance:", error);
      res.status(500).json({ message: "Failed to fetch live attendance" });
    }
  });

  // Department statistics API
  app.get("/api/attendance/department-stats", verifyAuth, async (req, res) => {
    try {
      const { user } = req.authenticatedUser;
      const { date } = req.query;
      
      // Only admin/master_admin can view department stats
      if (user.role !== "master_admin" && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const targetDate = date ? new Date(date as string) : new Date();
      targetDate.setHours(0, 0, 0, 0);
      
      // Get attendance records for the date
      const attendanceRecords = await storage.listAttendanceByDate(targetDate);
      
      // Get all users
      const allUsers = await storage.listUsers();
      
      // Group by department
      const departmentStats = {};
      
      allUsers.forEach(user => {
        if (!user.department) return;
        
        const dept = user.department;
        if (!departmentStats[dept]) {
          departmentStats[dept] = {
            department: dept,
            totalEmployees: 0,
            present: 0,
            absent: 0,
            late: 0,
            onTime: 0,
            overtime: 0,
            checkedOut: 0,
            stillWorking: 0
          };
        }
        
        departmentStats[dept].totalEmployees++;
        
        const userAttendance = attendanceRecords.find(record => record.userId === user.id);
        
        if (userAttendance) {
          departmentStats[dept].present++;
          
          if (userAttendance.isLate) {
            departmentStats[dept].late++;
          } else {
            departmentStats[dept].onTime++;
          }
          
          if (userAttendance.overtimeHours && userAttendance.overtimeHours > 0) {
            departmentStats[dept].overtime++;
          }
          
          if (userAttendance.checkOutTime) {
            departmentStats[dept].checkedOut++;
          } else {
            departmentStats[dept].stillWorking++;
          }
        } else {
          departmentStats[dept].absent++;
        }
      });

      res.json(Object.values(departmentStats));
    } catch (error) {
      console.error("Error fetching department stats:", error);
      res.status(500).json({ message: "Failed to fetch department statistics" });
    }
  });

  // Attendance policies API
  app.get("/api/attendance/policies", verifyAuth, async (req, res) => {
    try {
      const { user } = req.authenticatedUser;
      
      // Only admin/master_admin can view policies
      if (user.role !== "master_admin" && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Return attendance policies configuration
      const policies = [
        {
          id: "geofence_policy",
          name: "Geofence Requirement",
          description: "Office attendance requires being within 100 meters of office location",
          enabled: true,
          config: {
            radius: 100,
            strictMode: true,
            allowedOfficeLocations: 1
          }
        },
        {
          id: "overtime_policy", 
          name: "Overtime Approval",
          description: "Overtime work requires photo verification and reason",
          enabled: true,
          config: {
            requiresPhoto: true,
            requiresReason: true,
            autoApprovalThreshold: 0,
            maxOvertimeHours: 4
          }
        },
        {
          id: "late_policy",
          name: "Late Arrival Policy",
          description: "Automatic late marking based on department timing",
          enabled: true,
          config: {
            graceMinutes: 15,
            autoMarkLate: true,
            requiresReason: false
          }
        },
        {
          id: "remote_work_policy",
          name: "Remote Work Policy",
          description: "Remote work requires reason when outside office geofence",
          enabled: true,
          config: {
            requiresReason: true,
            requiresApproval: false,
            maxRemoteDays: 2
          }
        }
      ];

      res.json(policies);
    } catch (error) {
      console.error("Error fetching attendance policies:", error);
      res.status(500).json({ message: "Failed to fetch attendance policies" });
    }
  });

  // Update attendance record API
  app.patch("/api/attendance/:id", verifyAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { user } = req.authenticatedUser;
      const updateData = req.body;
      
      // Only admin/master_admin can update attendance records
      if (user.role !== "master_admin" && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get existing attendance record
      const existingRecord = await storage.getAttendance(id);
      if (!existingRecord) {
        return res.status(404).json({ message: "Attendance record not found" });
      }

      // Prepare update data
      const updates: any = {};
      
      if (updateData.checkInTime) {
        const date = new Date(existingRecord.date);
        const [hours, minutes] = updateData.checkInTime.split(':');
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        updates.checkInTime = date;
      }
      
      if (updateData.checkOutTime) {
        const date = new Date(existingRecord.date);
        const [hours, minutes] = updateData.checkOutTime.split(':');
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        updates.checkOutTime = date;
      }

      if (updateData.status) {
        updates.status = updateData.status;
      }

      if (updateData.overtimeHours !== undefined) {
        updates.overtimeHours = parseFloat(updateData.overtimeHours);
      }

      if (updateData.remarks) {
        updates.remarks = updateData.remarks;
      }

      // Recalculate working hours if both times are updated
      if (updates.checkInTime && updates.checkOutTime) {
        const workingMilliseconds = updates.checkOutTime.getTime() - updates.checkInTime.getTime();
        updates.workingHours = Math.round((workingMilliseconds / (1000 * 60 * 60)) * 100) / 100;
      }

      // Update the record
      const updatedRecord = await storage.updateAttendance(id, updates);

      // Log activity
      await storage.createActivityLog({
        type: 'attendance',
        title: 'Attendance Record Updated',
        description: `${user.displayName} updated attendance record for ${existingRecord.userId}`,
        entityId: id,
        entityType: 'attendance',
        userId: user.uid
      });

      res.json({
        message: "Attendance record updated successfully",
        attendance: updatedRecord
      });
    } catch (error) {
      console.error("Error updating attendance record:", error);
      res.status(500).json({ message: "Failed to update attendance record" });
    }
  });

  // Bulk actions API
  app.post("/api/attendance/bulk-action", verifyAuth, async (req, res) => {
    try {
      const { user } = req.authenticatedUser;
      const { action, attendanceIds, data } = req.body;
      
      // Only admin/master_admin can perform bulk actions
      if (user.role !== "master_admin" && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!action || !attendanceIds || !Array.isArray(attendanceIds)) {
        return res.status(400).json({ message: "Invalid bulk action parameters" });
      }

      let results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const attendanceId of attendanceIds) {
        try {
          let result = null;
          
          switch (action) {
            case 'approve_overtime':
              result = await storage.updateAttendance(attendanceId, {
                overtimeApproved: true,
                overtimeApprovedBy: user.uid,
                overtimeApprovedAt: new Date()
              });
              break;
              
            case 'reject_overtime':
              result = await storage.updateAttendance(attendanceId, {
                overtimeApproved: false,
                overtimeRejectedBy: user.uid,
                overtimeRejectedAt: new Date(),
                overtimeRejectionReason: data?.reason || 'No reason provided'
              });
              break;
              
            case 'mark_present':
              result = await storage.updateAttendance(attendanceId, {
                status: 'present'
              });
              break;
              
            case 'mark_absent':
              result = await storage.updateAttendance(attendanceId, {
                status: 'absent'
              });
              break;
              
            default:
              throw new Error(`Unknown action: ${action}`);
          }
          
          if (result) {
            results.push({ id: attendanceId, success: true, data: result });
            successCount++;
          }
        } catch (error) {
          results.push({ id: attendanceId, success: false, error: error.message });
          errorCount++;
        }
      }

      // Log bulk activity
      await storage.createActivityLog({
        type: 'attendance',
        title: `Bulk Action: ${action}`,
        description: `${user.displayName} performed bulk action '${action}' on ${attendanceIds.length} records (${successCount} succeeded, ${errorCount} failed)`,
        entityId: attendanceIds.join(','),
        entityType: 'attendance',
        userId: user.uid
      });

      res.json({
        message: `Bulk action completed: ${successCount} succeeded, ${errorCount} failed`,
        results,
        summary: {
          total: attendanceIds.length,
          succeeded: successCount,
          failed: errorCount
        }
      });
    } catch (error) {
      console.error("Error performing bulk action:", error);
      res.status(500).json({ message: "Failed to perform bulk action" });
    }
  });

  // Customers with pagination and performance optimizations
  app.get("/api/customers", verifyAuth, async (req, res) => {
    try {
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      console.log("SERVER PERMISSION CHECK:", {
        userPermissions: req.authenticatedUser.permissions,
        hasCustomersView: req.authenticatedUser.permissions.includes("customers.view"),
        hasCustomersCreate: req.authenticatedUser.permissions.includes("customers.create"),
        userRole: req.authenticatedUser.user.role,
        isMasterAdmin: req.authenticatedUser.user.role === "master_admin"
      });
      
      const hasPermission = req.authenticatedUser.permissions.includes("customers.view") || 
                           req.authenticatedUser.permissions.includes("customers.create") ||
                           req.authenticatedUser.user.role === "master_admin";
      
      console.log("SERVER PERMISSION RESULT:", hasPermission);
      
      if (!hasPermission) {
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
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user has permission to view products
      const hasPermission = req.authenticatedUser.permissions.includes("products.view") || 
                           req.authenticatedUser.permissions.includes("products.create") ||
                           req.authenticatedUser.user.role === "master_admin";
      
      if (!hasPermission) {
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
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user has permission to view quotations
      const hasPermission = req.authenticatedUser.permissions.includes("quotations.view") || 
                           req.authenticatedUser.permissions.includes("quotations.create") ||
                           req.authenticatedUser.user.role === "master_admin";
      
      if (!hasPermission) {
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
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check if user has permission to view invoices
      const hasPermission = req.authenticatedUser.permissions.includes("invoices.view") || 
                           req.authenticatedUser.permissions.includes("invoices.create") ||
                           req.authenticatedUser.user.role === "master_admin";
      
      if (!hasPermission) {
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

  // ===================== Phase 2: Enterprise RBAC API Routes =====================

  // Role Management Routes
  app.get("/api/roles", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || !["master_admin", "admin"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const roles = await storage.listRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.get("/api/roles/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || !["master_admin", "admin"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const role = await storage.getRole(req.params.id);
      if (!role) {
        return res.status(404).json({ message: "Role not found" });
      }
      res.json(role);
    } catch (error) {
      console.error("Error fetching role:", error);
      res.status(500).json({ message: "Failed to fetch role" });
    }
  });

  app.post("/api/roles", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      const roleData = insertRoleSchema.parse(req.body);
      const role = await storage.createRole(roleData);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "role_created",
        entityType: "role",
        entityId: role.id,
        changes: { name: role.name, permissions: role.permissions },
        department: user.department,
        designation: user.designation
      });
      
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating role:", error);
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.patch("/api/roles/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      const roleData = insertRoleSchema.partial().parse(req.body);
      const updatedRole = await storage.updateRole(req.params.id, roleData);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "role_updated",
        entityType: "role",
        entityId: req.params.id,
        changes: roleData,
        department: user.department,
        designation: user.designation
      });
      
      res.json(updatedRole);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/roles/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      const success = await storage.deleteRole(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Role not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "role_deleted",
        entityType: "role",
        entityId: req.params.id,
        department: user.department,
        designation: user.designation
      });
      
      res.json({ message: "Role deleted successfully" });
    } catch (error) {
      console.error("Error deleting role:", error);
      res.status(500).json({ message: "Failed to delete role" });
    }
  });

  // User Role Assignment Routes
  app.get("/api/users/:userId/roles", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (!["master_admin", "admin"].includes(user.role) && user.id !== req.params.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const roleAssignments = await storage.getUserRoleAssignments(req.params.userId);
      res.json(roleAssignments);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      res.status(500).json({ message: "Failed to fetch user roles" });
    }
  });

  app.post("/api/users/:userId/roles", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || !["master_admin", "admin"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const assignmentData = insertUserRoleAssignmentSchema.parse({
        ...req.body,
        userId: req.params.userId,
        assignedBy: user.id
      });
      const assignment = await storage.assignUserRole(assignmentData);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "role_assigned",
        entityType: "user_role_assignment",
        entityId: assignment.id,
        changes: { targetUserId: req.params.userId, roleId: req.body.roleId },
        department: user.department,
        designation: user.designation
      });
      
      res.status(201).json(assignment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error assigning role:", error);
      res.status(500).json({ message: "Failed to assign role" });
    }
  });

  app.delete("/api/users/:userId/roles/:roleId", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || !["master_admin", "admin"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const success = await storage.revokeUserRole(req.params.userId, req.params.roleId);
      if (!success) {
        return res.status(404).json({ message: "Role assignment not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "role_revoked",
        entityType: "user_role_assignment",
        entityId: `${req.params.userId}_${req.params.roleId}`,
        changes: { targetUserId: req.params.userId, roleId: req.params.roleId },
        department: user.department,
        designation: user.designation
      });
      
      res.json({ message: "Role revoked successfully" });
    } catch (error) {
      console.error("Error revoking role:", error);
      res.status(500).json({ message: "Failed to revoke role" });
    }
  });

  // Permission Override Routes
  app.get("/api/users/:userId/permission-overrides", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (!["master_admin", "admin"].includes(user.role) && user.id !== req.params.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const overrides = await storage.getUserPermissionOverrides(req.params.userId);
      res.json(overrides);
    } catch (error) {
      console.error("Error fetching permission overrides:", error);
      res.status(500).json({ message: "Failed to fetch permission overrides" });
    }
  });

  app.post("/api/users/:userId/permission-overrides", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      const overrideData = insertPermissionOverrideSchema.parse({
        ...req.body,
        userId: req.params.userId,
        grantedBy: user.id
      });
      const override = await storage.createPermissionOverride(overrideData);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "permission_override_created",
        entityType: "permission_override",
        entityId: override.id,
        changes: { 
          targetUserId: req.params.userId, 
          permission: req.body.permission, 
          granted: req.body.granted 
        },
        department: user.department,
        designation: user.designation
      });
      
      res.status(201).json(override);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error("Error creating permission override:", error);
      res.status(500).json({ message: "Failed to create permission override" });
    }
  });

  app.delete("/api/permission-overrides/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      const success = await storage.revokePermissionOverride(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Permission override not found" });
      }
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "permission_override_revoked",
        entityType: "permission_override",
        entityId: req.params.id,
        department: user.department,
        designation: user.designation
      });
      
      res.json({ message: "Permission override revoked successfully" });
    } catch (error) {
      console.error("Error revoking permission override:", error);
      res.status(500).json({ message: "Failed to revoke permission override" });
    }
  });

  // Enhanced Permission Checking Routes
  app.get("/api/users/:userId/effective-permissions", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (!["master_admin", "admin"].includes(user.role) && user.id !== req.params.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const permissions = await storage.getEffectiveUserPermissions(req.params.userId);
      const approvalLimits = await storage.getEffectiveUserApprovalLimits(req.params.userId);
      res.json({ permissions, approvalLimits });
    } catch (error) {
      console.error("Error fetching effective permissions:", error);
      res.status(500).json({ message: "Failed to fetch effective permissions" });
    }
  });

  app.post("/api/users/:userId/check-permission", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (!["master_admin", "admin"].includes(user.role) && user.id !== req.params.userId)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const { permission } = req.body;
      if (!permission) {
        return res.status(400).json({ message: "Permission parameter required" });
      }
      const hasPermission = await storage.checkEffectiveUserPermission(req.params.userId, permission);
      res.json({ hasPermission, permission });
    } catch (error) {
      console.error("Error checking permission:", error);
      res.status(500).json({ message: "Failed to check permission" });
    }
  });

  // Audit Log Routes
  app.get("/api/audit-logs", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || !["master_admin", "admin"].includes(user.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const filters: any = {};
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.entityType) filters.entityType = req.query.entityType as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      
      const logs = await storage.getAuditLogs(filters);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Firebase Admin SDK Health Check Endpoint
  app.get("/api/firebase/health-check", async (req, res) => {
    try {
      console.log('\n=== Firebase Admin SDK Health Check Started ===');
      
      // Run comprehensive Firebase tests
      const healthResults = await testFirebaseAdminSDK();
      const userManagementResults = await testUserManagement();
      
      const response = {
        timestamp: new Date().toISOString(),
        firebase_admin_sdk: {
          auth: healthResults.auth,
          firestore: healthResults.firestore,
          storage: healthResults.storage,
          overall: healthResults.overall
        },
        user_management: {
          tested: true,
          working: true
        },
        environment_check: {
          project_id: process.env.FIREBASE_PROJECT_ID ? 'Present' : 'Missing',
          client_email: process.env.FIREBASE_CLIENT_EMAIL ? 'Present' : 'Missing',
          private_key: process.env.FIREBASE_PRIVATE_KEY ? 'Present' : 'Missing',
          storage_bucket: process.env.FIREBASE_STORAGE_BUCKET ? 'Present' : 'Missing'
        }
      };
      
      console.log('=== Firebase Admin SDK Health Check Complete ===\n');
      
      if (healthResults.overall) {
        res.json({ status: 'healthy', details: response });
      } else {
        res.status(500).json({ status: 'unhealthy', details: response });
      }
      
    } catch (error: any) {
      console.error('Firebase Health Check Error:', error);
      res.status(500).json({ 
        status: 'error', 
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Firebase User List Endpoint (for admin testing)
  app.get("/api/firebase/list-users", async (req, res) => {
    try {
      const listResult = await auth.listUsers(100); // Get up to 100 users
      
      const users = listResult.users.map(user => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        customClaims: user.customClaims || {},
        creationTime: user.metadata.creationTime,
        lastSignInTime: user.metadata.lastSignInTime
      }));
      
      res.json(users);
    } catch (error: any) {
      console.error('Error listing Firebase users:', error);
      res.status(500).json({ 
        error: 'Failed to list users',
        message: error.message 
      });
    }
  });

  // ===============================================
  // ENTERPRISE PAYROLL MANAGEMENT API ENDPOINTS
  // ===============================================

  // Get payroll records with comprehensive filtering
  app.get("/api/payroll", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const { month, year, department, status } = req.query;
      const filters: any = {};
      
      if (month) filters.month = parseInt(month as string);
      if (year) filters.year = parseInt(year as string);
      if (department && department !== "all") filters.department = department;
      if (status && status !== "all") filters.status = status;

      const payrollRecords = await storage.listPayrolls(filters);
      res.json(payrollRecords);
    } catch (error) {
      console.error("Error fetching payroll records:", error);
      res.status(500).json({ message: "Failed to fetch payroll records" });
    }
  });

  // Process payroll for specified period
  app.post("/api/payroll/process", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const { month, year, userIds } = req.body;
      
      // Process payroll for all users or specific users
      const usersToProcess = userIds || (await storage.listUsers()).map(u => u.id);
      const processedPayrolls = [];

      for (const userId of usersToProcess) {
        try {
          const payrollData = await storage.calculatePayroll(userId, month, year);
          const payroll = await storage.createPayroll({
            ...payrollData,
            processedBy: user.id
          });
          processedPayrolls.push(payroll);
        } catch (error) {
          console.error(`Error processing payroll for user ${userId}:`, error);
        }
      }

      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "payroll_processed",
        entityType: "payroll",
        entityId: `${month}-${year}`,
        changes: { month, year, processedCount: processedPayrolls.length },
        department: user.department,
        designation: user.designation
      });

      res.json({ 
        message: "Payroll processed successfully", 
        processedCount: processedPayrolls.length,
        payrolls: processedPayrolls
      });
    } catch (error) {
      console.error("Error processing payroll:", error);
      res.status(500).json({ message: "Failed to process payroll" });
    }
  });

  // Get payroll statistics
  app.get("/api/payroll/stats", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const { month, year } = req.query;
      const payrolls = await storage.listPayrolls({ 
        month: parseInt(month as string), 
        year: parseInt(year as string) 
      });

      const stats = {
        totalEmployees: payrolls.length,
        totalGrossSalary: payrolls.reduce((sum, p) => sum + p.grossSalary, 0),
        totalDeductions: payrolls.reduce((sum, p) => sum + p.totalDeductions, 0),
        totalNetSalary: payrolls.reduce((sum, p) => sum + p.netSalary, 0),
        departmentBreakdown: payrolls.reduce((acc, p) => {
          const dept = p.userDepartment || 'unknown';
          acc[dept] = (acc[dept] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching payroll statistics:", error);
      res.status(500).json({ message: "Failed to fetch payroll statistics" });
    }
  });

  // Salary Structure Management
  app.get("/api/salary-structures", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const salaryStructures = await storage.listSalaryStructures();
      res.json(salaryStructures);
    } catch (error) {
      console.error("Error fetching salary structures:", error);
      res.status(500).json({ message: "Failed to fetch salary structures" });
    }
  });

  app.post("/api/salary-structures", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const salaryData = {
        ...req.body,
        createdBy: user.id,
        isActive: true,
        effectiveFrom: new Date(req.body.effectiveFrom || new Date())
      };

      const salaryStructure = await storage.createSalaryStructure(salaryData);
      
      await storage.createAuditLog({
        userId: user.id,
        action: "salary_structure_created",
        entityType: "salary_structure",
        entityId: salaryStructure.id,
        changes: salaryData,
        department: user.department,
        designation: user.designation
      });

      res.status(201).json(salaryStructure);
    } catch (error) {
      console.error("Error creating salary structure:", error);
      res.status(500).json({ message: "Failed to create salary structure" });
    }
  });

  // Payroll Settings Management
  app.get("/api/payroll-settings", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const settings = await storage.getPayrollSettings();
      res.json(settings || {
        pfRate: 12,
        esiRate: 1.75,
        tdsRate: 10,
        overtimeMultiplier: 1.5,
        standardWorkingHours: 8,
        standardWorkingDays: 22,
        leaveDeductionRate: 1,
        pfApplicableFromSalary: 15000,
        esiApplicableFromSalary: 21000,
        companyName: "Prakash Greens Energy"
      });
    } catch (error) {
      console.error("Error fetching payroll settings:", error);
      res.status(500).json({ message: "Failed to fetch payroll settings" });
    }
  });

  // ===============================================
  // ENTERPRISE ATTENDANCE MANAGEMENT API ENDPOINTS
  // ===============================================

  // Live attendance tracking
  app.get("/api/attendance/live", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      
      const attendance = await storage.listAttendance({ date: todayString });
      
      // Filter for active/live records (checked in but not checked out)
      const liveAttendance = attendance.filter(record => 
        record.checkInTime && !record.checkOutTime && record.status !== 'absent'
      );

      res.json(liveAttendance);
    } catch (error) {
      console.error("Error fetching live attendance:", error);
      res.status(500).json({ message: "Failed to fetch live attendance" });
    }
  });



  // Attendance policies management
  app.get("/api/attendance/policies", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const policies = await storage.listAttendancePolicies();
      res.json(policies);
    } catch (error) {
      console.error("Error fetching attendance policies:", error);
      res.status(500).json({ message: "Failed to fetch attendance policies" });
    }
  });

  // Add server-side today endpoint to fix timezone issues
  app.get("/api/attendance/today", verifyAuth, async (req, res) => {
    try {
      const { userId } = req.query;
      if (!userId) {
        return res.status(400).json({ message: "User ID required" });
      }

      // Use server timezone for consistent date handling
      const serverDate = new Date();
      const dateString = serverDate.toISOString().split('T')[0];
      
      // Get today's attendance using the correct method
      const todayAttendance = await storage.getUserAttendanceForDate(userId as string, dateString);

      res.json(todayAttendance || null);
    } catch (error) {
      console.error("Error fetching today's attendance:", error);
      res.status(500).json({ message: "Failed to fetch today's attendance" });
    }
  });

  // Enhanced Check-in with geolocation and field work support
  app.post("/api/attendance/check-in", createRateLimitMiddleware(attendanceRateLimiter), verifyAuth, async (req, res) => {
    try {
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const {
        latitude,
        longitude,
        attendanceType = "office",
        customerName,
        reason,
        imageUrl,
        isWithinOfficeRadius = false,
        distanceFromOffice
      } = req.body;

      const userId = req.authenticatedUser.user.uid;
      
      // Enhanced validation with coordinate range checks
      if (!latitude || !longitude) {
        return res.status(400).json({ message: "Location coordinates are required" });
      }
      
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ message: "Invalid coordinate values. Latitude must be between -90 and 90, longitude between -180 and 180" });
      }

      // Use server timezone for consistent date handling to prevent timezone mismatches
      const serverDate = new Date();
      const dateString = serverDate.toISOString().split('T')[0];
      
      // Check for existing attendance with proper date range to handle timezone issues
      const existingAttendance = await storage.listAttendance({
        userId,
        date: {
          start: new Date(dateString + 'T00:00:00.000Z'),
          end: new Date(dateString + 'T23:59:59.999Z')
        }
      });
      
      if (existingAttendance && existingAttendance.length > 0 && existingAttendance[0].checkInTime) {
        return res.status(400).json({ 
          message: "You have already checked in today",
          attendance: existingAttendance[0]
        });
      }

      // Get office locations for validation
      const officeLocations = await storage.listOfficeLocations();
      const primaryOffice = officeLocations[0] || {
        latitude: 9.966844592415782,
        longitude: 78.1338405791111,
        radius: 100
      };

      // Calculate distance from office
      const distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        parseFloat(primaryOffice.latitude.toString()),
        parseFloat(primaryOffice.longitude.toString())
      );

      const isWithinRadius = distance <= (primaryOffice.radius || 100);

      // Validate attendance type and requirements
      if (attendanceType === "office" && !isWithinRadius) {
        return res.status(400).json({ 
          message: `You are ${Math.round(distance)}m away from office. Please select 'Remote' or 'Field Work' and provide a reason.`,
          distance: Math.round(distance),
          allowedRadius: primaryOffice.radius || 100,
          requiresReasonSelection: true
        });
      }

      if (attendanceType === "remote" && !reason) {
        return res.status(400).json({ message: "Please provide a reason for remote work" });
      }

      if (attendanceType === "field_work") {
        if (!customerName) {
          return res.status(400).json({ message: "Customer name is required for field work" });
        }
        if (!imageUrl) {
          return res.status(400).json({ message: "Photo is mandatory for field work attendance" });
        }
      }

      const checkInData = {
        userId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        attendanceType,
        customerName: attendanceType === "field_work" ? customerName : undefined,
        reason: attendanceType !== "office" ? reason : undefined,
        imageUrl: attendanceType === "field_work" ? imageUrl : undefined,
        isWithinOfficeRadius: isWithinRadius,
        distanceFromOffice: Math.round(distance)
      };

      // Create attendance record with all required fields
      const attendanceRecord = await storage.createAttendance({
        ...checkInData,
        status: "present",
        isLate: false,
        checkInTime: new Date(),
        date: new Date(),
        location: `${checkInData.latitude},${checkInData.longitude}`,
        checkInLatitude: checkInData.latitude,
        checkInLongitude: checkInData.longitude,
        checkInImageUrl: checkInData.imageUrl
      });

      // Create audit log
      await storage.createAuditLog({
        userId: req.authenticatedUser.user.uid,
        action: "attendance_check_in",
        entityType: "attendance",
        entityId: attendanceRecord.id,
        changes: { 
          attendanceType: checkInData.attendanceType,
          location: `${checkInData.latitude},${checkInData.longitude}`,
          distance: Math.round(distance),
          withinOfficeRadius: isWithinRadius
        },
        department: req.authenticatedUser.user.department,
        designation: req.authenticatedUser.user.designation
      });

      res.status(201).json({ 
        message: "Check-in successful", 
        attendance: attendanceRecord,
        location: {
          distance: Math.round(distance),
          withinRadius: isWithinRadius,
          attendanceType: checkInData.attendanceType
        }
      });
    } catch (error) {
      console.error("Error during check-in:", error);
      res.status(500).json({ message: "Failed to record check-in" });
    }
  });



  // Department timing management
  app.get("/api/departments/:departmentId/timing", verifyAuth, async (req, res) => {
    try {
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check permission
      const hasPermission = req.authenticatedUser.user.role === "master_admin" ||
                           req.authenticatedUser.permissions.includes("departments.view");
      
      if (!hasPermission) {
        return res.status(403).json({ message: "Access denied" });
      }

      const timing = await storage.getDepartmentTiming(req.params.departmentId);
      res.json(timing);
    } catch (error) {
      console.error("Error fetching department timing:", error);
      res.status(500).json({ message: "Failed to fetch department timing" });
    }
  });

  app.post("/api/departments/:departmentId/timing", verifyAuth, async (req, res) => {
    try {
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Check permission - only master admin can set timing
      if (req.authenticatedUser.user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const timingData = {
        departmentId: req.params.departmentId,
        department: req.body.department,
        workingHours: req.body.workingHours || 8,
        checkInTime: req.body.checkInTime || "9:00 AM",
        checkOutTime: req.body.checkOutTime || "6:00 PM",
        lateThresholdMinutes: req.body.lateThresholdMinutes || 15,
        overtimeThresholdMinutes: req.body.overtimeThresholdMinutes || 30,
        isFlexibleTiming: req.body.isFlexibleTiming || false,
        flexibleCheckInStart: req.body.flexibleCheckInStart,
        flexibleCheckInEnd: req.body.flexibleCheckInEnd,
        breakDurationMinutes: req.body.breakDurationMinutes || 60,
        weeklyOffDays: req.body.weeklyOffDays || [0], // Sunday
        createdBy: req.authenticatedUser.user.uid
      };

      const timing = await storage.createDepartmentTiming(timingData);

      // Create audit log
      await storage.createAuditLog({
        userId: req.authenticatedUser.user.uid,
        action: "department_timing_created",
        entityType: "department_timing",
        entityId: timing.id,
        changes: timingData,
        department: req.authenticatedUser.user.department,
        designation: req.authenticatedUser.user.designation
      });

      res.json({ message: "Department timing created successfully", timing });
    } catch (error) {
      console.error("Error creating department timing:", error);
      res.status(500).json({ message: "Failed to create department timing" });
    }
  });

  // Bulk attendance actions
  app.post("/api/attendance/bulk-action", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const { action, attendanceIds, data } = req.body;
      const results = [];

      for (const attendanceId of attendanceIds) {
        try {
          if (action === 'approve') {
            const updated = await storage.updateAttendance(attendanceId, {
              ...data,
              approvedBy: user.id
            });
            results.push(updated);
          } else if (action === 'update') {
            const updated = await storage.updateAttendance(attendanceId, data);
            results.push(updated);
          }
        } catch (error) {
          console.error(`Error performing ${action} on attendance ${attendanceId}:`, error);
        }
      }

      await storage.createAuditLog({
        userId: user.id,
        action: `attendance_bulk_${action}`,
        entityType: "attendance",
        entityId: attendanceIds.join(','),
        changes: { action, count: results.length },
        department: user.department,
        designation: user.designation
      });

      res.json({ message: `Bulk ${action} completed`, results });
    } catch (error) {
      console.error("Error performing bulk action:", error);
      res.status(500).json({ message: "Failed to perform bulk action" });
    }
  });

  // Enterprise System Health Monitoring API
  app.get("/api/system/health", verifyAuth, async (req, res) => {
    try {
      const { user } = req.authenticatedUser;
      
      // Only admin/master_admin can view system health
      if (user.role !== "master_admin" && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied - Admin privileges required" });
      }

      const systemHealth = EnterprisePerformanceMonitor.getSystemHealth();
      const performanceMetrics = EnterprisePerformanceMonitor.getPerformanceMetrics();

      res.json({
        enterprise: {
          version: "microsoft-grade-v1.0",
          monitoring: "active",
          timestamp: new Date().toISOString()
        },
        system: systemHealth,
        performance: performanceMetrics,
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        }
      });
    } catch (error) {
      console.error("System health check error:", error);
      res.status(500).json({ 
        message: "Failed to retrieve system health",
        error: {
          type: "monitoring_service_error",
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // Enterprise Attendance Analytics API
  app.get("/api/attendance/analytics", verifyAuth, async (req, res) => {
    try {
      const { user } = req.authenticatedUser;
      const { userId, startDate, endDate } = req.query;

      // Only admin/master_admin can view full analytics
      if (user.role !== "master_admin" && user.role !== "admin") {
        return res.status(403).json({ message: "Access denied - Admin privileges required" });
      }

      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;

      const metrics = await UnifiedAttendanceService.generateAttendanceMetrics(
        userId as string,
        dateRange
      );

      res.json({
        enterprise: {
          version: "microsoft-grade-v1.0",
          analytics: "comprehensive",
          timestamp: new Date().toISOString()
        },
        metrics,
        period: dateRange ? {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString()
        } : "all-time"
      });
    } catch (error) {
      console.error("Enterprise analytics error:", error);
      res.status(500).json({ 
        message: "Failed to generate attendance analytics",
        error: {
          type: "analytics_service_error",
          timestamp: new Date().toISOString()
        }
      });
    }
  });

  // ===================== Department Timing Routes with Enterprise Time Service =====================

  // Get all department timings with cache refresh option
  app.get("/api/departments/timings", verifyAuth, async (req, res) => {
    try {
      const { user } = req.authenticatedUser;
      const { refresh } = req.query;
      
      // Only master_admin can view all department timings
      if (user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      console.log('BACKEND: Fetching all department timings');
      
      const { EnterpriseTimeService } = await import("./services/enterprise-time-service");
      
      // Clear cache if refresh requested
      if (refresh === 'true') {
        console.log('BACKEND: Refreshing all department timing cache');
        EnterpriseTimeService.invalidateTimingCache();
      }
      
      const timings = await EnterpriseTimeService.getAllDepartmentTimings();
      
      // Convert to object format for frontend compatibility
      const timingsObject = timings.reduce((acc, timing) => {
        acc[timing.department] = timing;
        return acc;
      }, {} as Record<string, any>);
      
      console.log('BACKEND: Retrieved all department timings:', Object.keys(timingsObject));
      
      res.json(timingsObject);
    } catch (error) {
      console.error("Error fetching department timings:", error);
      res.status(500).json({ message: "Failed to fetch department timings" });
    }
  });

  // Get specific department timing with ultra-fast caching
  app.get("/api/departments/:department/timing", verifyAuth, async (req, res) => {
    try {
      const { department } = req.params;
      const { user } = req.authenticatedUser;
      
      console.log(`BACKEND: Fast-fetching timing for department ${department}`);
      
      // Users can view their own department timing or master_admin can view all
      if (user.role !== "master_admin" && user.department !== department) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { AttendanceCacheService } = await import("./services/attendance-cache-service");
      
      const timing = await AttendanceCacheService.getDepartmentTiming(department, async () => {
        const { EnterpriseTimeService } = await import("./services/enterprise-time-service");
        return await EnterpriseTimeService.getDepartmentTiming(department);
      });
      
      res.json(timing);
    } catch (error) {
      console.error(`Error fetching timing for department ${req.params.department}:`, error);
      res.status(500).json({ message: "Failed to fetch department timing" });
    }
  });

  // Update specific department timing (POST)
  app.post("/api/departments/:department/timing", verifyAuth, async (req, res) => {
    try {
      const { department } = req.params;
      const user = await storage.getUser(req.user.uid);
      
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      console.log(`BACKEND: Updating timing for department ${department}`);
      console.log('BACKEND: Timing data:', req.body);

      const { EnterpriseTimeService } = await import("./services/enterprise-time-service");
      
      // Filter out undefined values before updating
      const cleanData = Object.fromEntries(
        Object.entries(req.body).filter(([_, value]) => value !== undefined)
      );
      
      // Update single department timing
      await EnterpriseTimeService.updateDepartmentTimings([{
        department,
        ...cleanData
      }]);
      
      // Clear cache for this specific department and all cache
      console.log(`BACKEND: Clearing cache for department ${department}`);
      EnterpriseTimeService.clearDepartmentCache(department);
      EnterpriseTimeService.invalidateTimingCache();
      
      // Clear performance optimizer cache
      const { AttendanceCacheService } = await import("./services/attendance-cache-service");
      AttendanceCacheService.invalidateDepartmentCache(department);
      AttendanceCacheService.invalidateAttendanceCache();
      
      // Get fresh data from database (not cache)
      const updatedTiming = await EnterpriseTimeService.getDepartmentTiming(department);
      
      console.log(`BACKEND: Updated timing for ${department}:`, updatedTiming);
      
      res.json({
        success: true,
        department,
        timing: updatedTiming,
        message: `Department timing updated successfully for ${department}`
      });
    } catch (error) {
      console.error(`Error updating timing for department ${req.params.department}:`, error);
      res.status(500).json({ message: "Failed to update department timing" });
    }
  });

  // Update specific department timing (PUT)
  app.put("/api/departments/:department/timing", verifyAuth, async (req, res) => {
    try {
      const { department } = req.params;
      const user = await storage.getUser(req.user.uid);
      
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      console.log(`BACKEND: PUT updating timing for department ${department}`);

      const { EnterpriseTimeService } = await import("./services/enterprise-time-service");
      
      // Filter out undefined values before updating
      const cleanData = Object.fromEntries(
        Object.entries(req.body).filter(([_, value]) => value !== undefined)
      );
      
      // Update single department timing
      await EnterpriseTimeService.updateDepartmentTimings([{
        department,
        ...cleanData
      }]);
      
      // Clear cache for this specific department and all cache
      console.log(`BACKEND: PUT clearing cache for department ${department}`);
      EnterpriseTimeService.clearDepartmentCache(department);
      EnterpriseTimeService.invalidateTimingCache();
      
      // Get fresh data from database
      const updatedTiming = await EnterpriseTimeService.getDepartmentTiming(department);
      
      console.log(`BACKEND: PUT updated timing for ${department}:`, updatedTiming);
      
      res.json({
        success: true,
        department,
        timing: updatedTiming,
        message: `Department timing updated successfully for ${department}`
      });
    } catch (error) {
      console.error(`Error updating timing for department ${req.params.department}:`, error);
      res.status(500).json({ message: "Failed to update department timing" });
    }
  });

  // Bulk update department timings
  app.post("/api/departments/timings/bulk", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const { timings } = req.body;
      const { EnterpriseTimeService } = await import("./services/enterprise-time-service");
      
      await EnterpriseTimeService.updateDepartmentTimings(timings);
      
      res.json({ 
        message: `Successfully updated timings for ${timings.length} departments`,
        updatedCount: timings.length
      });
    } catch (error) {
      console.error("Error bulk updating department timings:", error);
      res.status(500).json({ message: "Failed to bulk update department timings" });
    }
  });

  // Check if current time is business hours for department
  app.get("/api/departments/:department/business-hours", verifyAuth, async (req, res) => {
    try {
      const { department } = req.params;
      const { EnterpriseTimeService } = await import("./services/enterprise-time-service");
      
      const isBusinessHours = await EnterpriseTimeService.isBusinessHours(department);
      const nextBusinessDay = await EnterpriseTimeService.getNextBusinessDay(department);
      
      res.json({
        department,
        isBusinessHours,
        nextBusinessDay: nextBusinessDay.toISOString(),
        currentTime: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
      });
    } catch (error) {
      console.error(`Error checking business hours for department ${req.params.department}:`, error);
      res.status(500).json({ message: "Failed to check business hours" });
    }
  });

  // Performance analytics endpoint
  app.get("/api/performance/stats", verifyAuth, async (req, res) => {
    try {
      const { user } = req.authenticatedUser;
      
      if (user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      
      const { AttendanceCacheService } = await import("./services/attendance-cache-service");
      const stats = AttendanceCacheService.getCacheStats();
      
      res.json({
        ...stats,
        timestamp: new Date().toISOString(),
        message: "Performance analytics retrieved successfully"
      });
    } catch (error) {
      console.error("Error getting performance stats:", error);
      res.status(500).json({ message: "Failed to get performance stats" });
    }
  });

  // Enhanced cache refresh endpoint
  app.post("/api/departments/timings/refresh-cache", verifyAuth, async (req, res) => {
    try {
      const { user } = req.authenticatedUser;
      
      if (user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      
      console.log('BACKEND: Manual cache refresh requested by master admin');
      
      const { EnterpriseTimeService } = await import("./services/enterprise-time-service");
      const { AttendanceCacheService } = await import("./services/attendance-cache-service");
      
      // Clear all caches
      EnterpriseTimeService.invalidateTimingCache();
      AttendanceCacheService.invalidateAttendanceCache();
      
      // Get fresh data for all departments
      const timings = await EnterpriseTimeService.getAllDepartmentTimings();
      
      console.log('BACKEND: All caches refreshed, retrieved timings for departments:', 
        timings.map(t => t.department));
      
      res.json({
        success: true,
        message: "All caches refreshed successfully",
        refreshedDepartments: timings.map(t => t.department),
        performanceStats: AttendanceCacheService.getCacheStats(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error refreshing caches:", error);
      res.status(500).json({ message: "Failed to refresh caches" });
    }
  });

  // ===================== Enhanced Payroll Management API Routes =====================

  // Payroll Field Configuration Routes
  app.get("/api/payroll/field-configs", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      
      const fieldConfigs = await storage.listPayrollFieldConfigs();
      res.json(fieldConfigs);
    } catch (error) {
      console.error("Error fetching field configs:", error);
      res.status(500).json({ message: "Failed to fetch field configurations" });
    }
  });

  app.post("/api/payroll/field-configs", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      
      const fieldData = {
        ...req.body,
        isSystemField: false,
        isActive: true
      };
      
      const newField = await storage.createPayrollFieldConfig(fieldData);
      res.status(201).json(newField);
    } catch (error) {
      console.error("Error creating field config:", error);
      res.status(500).json({ message: "Failed to create field configuration" });
    }
  });

  // Enhanced Salary Structure Routes
  app.get("/api/enhanced-salary-structures", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      
      const structures = await storage.listEnhancedSalaryStructures();
      res.json(structures);
    } catch (error) {
      console.error("Error fetching salary structures:", error);
      res.status(500).json({ message: "Failed to fetch salary structures" });
    }
  });

  app.post("/api/enhanced-salary-structures", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      
      const structureData = {
        ...req.body,
        isActive: true
      };
      
      const newStructure = await storage.createEnhancedSalaryStructure(structureData);
      res.status(201).json(newStructure);
    } catch (error) {
      console.error("Error creating salary structure:", error);
      res.status(500).json({ message: "Failed to create salary structure" });
    }
  });

  // Enhanced Payroll Routes
  app.get("/api/enhanced-payrolls", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      
      const { month, year, department, status } = req.query;
      
      const filters: any = {};
      if (month) filters.month = parseInt(month as string);
      if (year) filters.year = parseInt(year as string);
      if (department && department !== 'all') filters.department = department as string;
      if (status) filters.status = status as string;
      
      const payrolls = await storage.listEnhancedPayrolls(filters);
      res.json(payrolls);
    } catch (error) {
      console.error("Error fetching payrolls:", error);
      res.status(500).json({ message: "Failed to fetch payroll data" });
    }
  });

  // Update enhanced payroll record
  app.put("/api/enhanced-payrolls/:id", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || (user.role !== "master_admin" && user.role !== "admin")) {
        return res.status(403).json({ message: "Access denied - Admin or Master Admin only" });
      }

      const { id } = req.params;
      const updateData = req.body;

      // Remove id from update data if present
      delete updateData.id;

      // Add metadata
      updateData.updatedAt = new Date();
      updateData.updatedBy = user.id;

      const updatedPayroll = await storage.updateEnhancedPayroll(id, updateData);
      
      // Create audit log
      await storage.createAuditLog({
        userId: user.id,
        action: "payroll_updated",
        entityType: "enhanced_payroll",
        entityId: id,
        changes: updateData,
        department: user.department,
        designation: user.designation
      });

      res.json(updatedPayroll);
    } catch (error) {
      console.error("Error updating enhanced payroll:", error);
      res.status(500).json({ message: "Failed to update enhanced payroll" });
    }
  });

  app.post("/api/enhanced-payrolls/bulk-process", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      
      const { month, year, userIds } = req.body;
      console.log("Bulk process request:", { month, year, userIds, type: typeof userIds });
      
      // If no userIds provided, get all users with salary structures
      let targetUserIds = userIds;
      if (!targetUserIds || !Array.isArray(targetUserIds)) {
        const allSalaryStructures = await storage.listEnhancedSalaryStructures();
        targetUserIds = allSalaryStructures.map(s => s.userId);
        console.log("Using all users with salary structures:", targetUserIds);
      }
      
      const processedPayrolls = [];
      const settings = await storage.getEnhancedPayrollSettings();
      
      // Process payroll for each user
      for (const userId of targetUserIds) {
        const existingPayroll = await storage.getEnhancedPayrollByUserAndMonth(userId, month, year);
        if (existingPayroll) {
          continue; // Skip if already processed
        }
        
        const user = await storage.getUser(userId);
        if (!user) continue;
        
        const salaryStructure = await storage.getEnhancedSalaryStructureByUser(userId);
        if (!salaryStructure) continue;
        
        // Calculate payroll with real salary structure data
        const fixedBasic = salaryStructure.fixedBasic || 0;
        const fixedHRA = salaryStructure.fixedHRA || 0;
        const fixedConveyance = salaryStructure.fixedConveyance || 0;
        const totalFixedSalary = fixedBasic + fixedHRA + fixedConveyance;
        
        // Get actual attendance records for the specific month and year
        const allAttendanceRecords = await storage.listAttendanceByUser(userId);
        const attendanceRecords = allAttendanceRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate.getMonth() === (month - 1) && recordDate.getFullYear() === year;
        });
        
        const presentDays = attendanceRecords.filter(record => 
          record.status === 'present' || record.status === 'late'
        ).length;
        
        // Calculate month days and overtime from attendance
        const monthDays = new Date(year, month, 0).getDate(); // Actual days in month
        const totalOvertimeHours = attendanceRecords.reduce((sum, record) => 
          sum + (record.overtimeHours || 0), 0
        );
        
        const perDaySalary = totalFixedSalary / monthDays;
        
        // Calculate earned amounts based on attendance
        const earnedBasic = (fixedBasic / monthDays) * presentDays;
        const earnedHRA = (fixedHRA / monthDays) * presentDays;
        const earnedConveyance = (fixedConveyance / monthDays) * presentDays;
        
        // Calculate statutory deductions
        const grossSalaryAmount = earnedBasic + earnedHRA + earnedConveyance;
        const epfDeduction = salaryStructure.epfApplicable ? Math.min(earnedBasic * 0.12, 1800) : 0;
        const esiDeduction = salaryStructure.esiApplicable && grossSalaryAmount <= 21000 ? grossSalaryAmount * 0.0075 : 0;
        const vptDeduction = salaryStructure.vptAmount || 0;
        
        const finalGrossAmount = grossSalaryAmount; // Initially same as gross, can be modified with BETTA
        
        // Calculate total deductions including new manual system fields
        const totalDeductions = epfDeduction + esiDeduction + vptDeduction;
        
        // NET SALARY = FINAL GROSS + CREDIT - (EPF + VPF + ESI + TDS + FINE + SALARY ADVANCE)
        // Using same formula as manual system
        const netSalary = finalGrossAmount - totalDeductions;
        
        const payrollData = {
          userId,
          employeeId: user.employeeId || user.uid,
          month,
          year,
          monthDays,
          presentDays,
          paidLeaveDays: 0,
          overtimeHours: totalOvertimeHours,
          perDaySalary: Math.round(perDaySalary),
          earnedBasic: Math.round(earnedBasic),
          earnedHRA: Math.round(earnedHRA),
          earnedConveyance: Math.round(earnedConveyance),
          overtimePay: 0,
          betta: 0, // BETTA allowance from manual system
          dynamicEarnings: {},
          grossSalary: Math.round(grossSalaryAmount), // Gross before BETTA
          finalGross: Math.round(finalGrossAmount), // Final gross after BETTA (initially same as gross)
          dynamicDeductions: {},
          epfDeduction: Math.round(epfDeduction),
          esiDeduction: Math.round(esiDeduction),
          vptDeduction: Math.round(vptDeduction),
          tdsDeduction: 0,
          fineDeduction: 0, // FINE from manual system
          salaryAdvance: 0, // SALARY ADVANCE from manual system
          creditAdjustment: 0, // CREDIT from manual system
          esiEligible: grossSalaryAmount <= 21000, // ESI eligibility based on salary
          totalEarnings: Math.round(grossSalaryAmount),
          totalDeductions: Math.round(totalDeductions),
          netSalary: Math.round(netSalary),
          status: 'processed',
          processedBy: user.uid,
          processedAt: new Date()
        };
        
        const newPayroll = await storage.createEnhancedPayroll(payrollData);
        processedPayrolls.push(newPayroll);
      }
      
      res.json({
        message: "Payroll processing completed",
        payrolls: processedPayrolls,
        processedCount: processedPayrolls.length
      });
    } catch (error) {
      console.error("Error processing payroll:", error);
      res.status(500).json({ message: "Failed to process payroll" });
    }
  });

  // Enhanced Payroll Settings Routes
  app.get("/api/enhanced-payroll-settings", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      
      const settings = await storage.getEnhancedPayrollSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching payroll settings:", error);
      res.status(500).json({ message: "Failed to fetch payroll settings" });
    }
  });

  app.patch("/api/enhanced-payroll-settings", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }
      
      const settingsData = {
        ...req.body,
        updatedBy: user.uid
      };
      
      const updatedSettings = await storage.updateEnhancedPayrollSettings(settingsData);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating payroll settings:", error);
      res.status(500).json({ message: "Failed to update payroll settings" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
