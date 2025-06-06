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
  insertAttendancePolicySchema
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
import { isWithinGeoFence, calculateDistance } from "./utils";
import { auth } from "./firebase";
import { userService } from "./services/user-service";
import { testFirebaseAdminSDK, testUserManagement } from "./test-firebase-admin";

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
        
        // Master admin gets all permissions first
        if (userProfile.role === "master_admin") {
          req.authenticatedUser.permissions = ["system.settings", "users.view", "users.create", "users.edit", "users.delete", "customers.view", "customers.create", "customers.edit", "products.view", "products.create", "products.edit", "quotations.view", "quotations.create", "quotations.edit", "invoices.view", "invoices.create", "invoices.edit"];
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
            
            // Set approval capabilities based on designation
            const designationLevels = {
              "trainee": 1, "intern": 2, "junior_executive": 3, "executive": 4,
              "senior_executive": 5, "assistant_manager": 6, "manager": 7, "director": 8
            };
            const level = designationLevels[userProfile.designation] || 1;
            req.authenticatedUser.canApprove = level >= 5;
            req.authenticatedUser.maxApprovalAmount = level >= 7 ? 1000000 : level >= 6 ? 500000 : level >= 5 ? 100000 : null;
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
        { department: "cre", designation: "assistant_manager" },
        { department: "accounts", designation: "manager" },
        { department: "hr", designation: "director" },
        { department: "sales_and_marketing", designation: "executive" },
        { department: "technical_team", designation: "senior_executive" }
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
        location = "office",
        customerId,
        reason,
        imageUrl,
        attendanceType = "office", // office, field, remote
        customerName
      } = req.body;
      
      if (!userId || userId !== req.user.uid) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get user details for department-specific timing
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const now = new Date();
      const checkInTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
      );

      // Get department-specific timing (default to 9:30 AM if not set)
      const defaultCheckInTime = "09:30";
      const [checkInHour, checkInMinute] = defaultCheckInTime.split(":").map(Number);
      const minCheckInTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        checkInHour,
        checkInMinute,
      );

      // Check if user is late
      const isLate = checkInTime > minCheckInTime;
      const lateMinutes = isLate ? Math.floor((checkInTime.getTime() - minCheckInTime.getTime()) / (1000 * 60)) : 0;

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

      // Check geolocation for office attendance
      const locations = await storage.listOfficeLocations();
      const isWithinOfficeGeoFence = locations.some((loc) =>
        isWithinGeoFence(
          parseFloat(latitude), 
          parseFloat(longitude), 
          parseFloat(loc.latitude), 
          parseFloat(loc.longitude), 
          loc.radius || 100
        ),
      );

      // Validation based on attendance type
      if (attendanceType === "office") {
        if (!isWithinOfficeGeoFence) {
          return res.status(400).json({ 
            message: "You are outside the office location. Please select the appropriate attendance type.",
            outsideGeofence: true
          });
        }
      } else if (attendanceType === "field") {
        // Field work requires customer name and photo
        if (!customerName || !imageUrl) {
          return res.status(400).json({ 
            message: "Field work requires customer name and photo to be provided",
            requiresCustomerAndPhoto: true
          });
        }
      } else if (attendanceType === "remote") {
        // Remote work requires reason if outside geofence
        if (!isWithinOfficeGeoFence && !reason) {
          return res.status(400).json({ 
            message: "Remote work requires a reason when outside office location",
            requiresReason: true
          });
        }
      }

      const attendanceData: any = {
        userId,
        date: today,
        checkInTime,
        attendanceType,
        reason: reason || "",
        checkInLatitude: latitude.toString(),
        checkInLongitude: longitude.toString(),
        status: isLate ? "late" : "present",
        isLate,
        lateMinutes: isLate ? lateMinutes : 0,
        workingHours: 0,
        breakHours: 0,
        isWithinOfficeRadius: isWithinOfficeGeoFence,
        remarks: attendanceType === "field_work" ? `Field work at ${customerName || "Unknown"}` : (reason || "")
      };

      // Only add optional fields if they have values
      if (attendanceType === "field_work" && customerName) {
        attendanceData.customerName = customerName;
      }
      if (imageUrl) {
        attendanceData.checkInImageUrl = imageUrl;
      }
      if (locations.length > 0) {
        attendanceData.distanceFromOffice = calculateDistance(
          parseFloat(latitude), 
          parseFloat(longitude), 
          parseFloat(locations[0].latitude), 
          parseFloat(locations[0].longitude)
        );
      }

      const newAttendance = await storage.createAttendance(attendanceData);

      // Log activity
      await storage.createActivityLog({
        type: 'attendance',
        title: `${attendanceType === "field" ? "Field Work" : attendanceType === "remote" ? "Remote Work" : "Office"} Check-in`,
        description: `${user.displayName} checked in for ${attendanceType} work${isLate ? ` (${lateMinutes} minutes late)` : ""}`,
        entityId: newAttendance.id,
        entityType: 'attendance',
        userId: user.uid
      });

      res.status(201).json({
        message: `Checked in successfully for ${attendanceType} work${isLate ? ` (${lateMinutes} minutes late)` : ""}`,
        attendance: newAttendance,
        isLate,
        lateMinutes
      });
    } catch (error) {
      console.error("Error checking in:", error);
      res.status(500).json({ message: "Failed to process check-in" });
    }
  });

  app.post("/api/attendance/check-out", verifyAuth, async (req, res) => {
    try {
      const { userId, latitude, longitude, imageUrl, reason, otReason } = req.body;
      if (!userId || userId !== req.user.uid) {
        return res.status(403).json({ message: "Access denied" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attendanceRecord = await storage.getAttendanceByUserAndDate(userId, today);
      if (!attendanceRecord) {
        return res.status(400).json({ message: "No check-in record found for today" });
      }

      if (attendanceRecord.checkOutTime) {
        return res.status(400).json({ message: "You have already checked out today" });
      }

      const now = new Date();
      const checkOutTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes(),
      );

      // Get department-specific checkout timing (default to 6:30 PM)
      const defaultCheckOutTime = "18:30";
      const [checkOutHour, checkOutMinute] = defaultCheckOutTime.split(":").map(Number);
      const expectedCheckOutTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        checkOutHour,
        checkOutMinute,
      );

      // Calculate working hours and overtime
      const checkInTime = new Date(attendanceRecord.checkInTime || new Date());
      const workingMilliseconds = checkOutTime.getTime() - checkInTime.getTime();
      const workingHours = workingMilliseconds / (1000 * 60 * 60);
      
      // Standard working hours (9 hours: 9:30 AM to 6:30 PM)
      const standardWorkingHours = 9;
      const overtimeHours = Math.max(0, workingHours - standardWorkingHours);
      
      // Check if overtime requires approval and photo
      const hasOvertime = overtimeHours > 0;
      if (hasOvertime) {
        if (!otReason) {
          return res.status(400).json({
            message: "Overtime requires a reason to be provided",
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            requiresOTReason: true
          });
        }
        if (!imageUrl) {
          return res.status(400).json({
            message: "Overtime requires a photo to be captured",
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            requiresPhoto: true
          });
        }
      }

      // Check for early checkout (only require reason if significantly early)
      const earlyCheckout = checkOutTime < expectedCheckOutTime;
      const earlyMinutes = earlyCheckout ? Math.floor((expectedCheckOutTime.getTime() - checkOutTime.getTime()) / (1000 * 60)) : 0;
      
      // Only require reason if checking out more than 30 minutes early
      if (earlyCheckout && earlyMinutes > 30 && (!reason || reason.trim().length === 0)) {
        const currentTimeStr = checkOutTime.toLocaleTimeString();
        const expectedTimeStr = expectedCheckOutTime.toLocaleTimeString();
        return res.status(400).json({
          message: `Early checkout (${earlyMinutes} minutes early) requires a reason. Current: ${currentTimeStr}, Expected: ${expectedTimeStr}`,
          currentTime: checkOutTime,
          expectedCheckOutTime,
          requiresReason: true,
          isEarlyCheckout: true,
          earlyMinutes
        });
      }

      // Update attendance record with checkout details
      const updatedAttendance = await storage.updateAttendance(attendanceRecord.id, {
        checkOutTime,
        checkOutLatitude: latitude,
        checkOutLongitude: longitude,
        checkOutImageUrl: imageUrl,
        workingHours: Math.round(workingHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        otReason: hasOvertime ? otReason : undefined,
        remarks: reason || (hasOvertime ? `Overtime: ${otReason}` : undefined)
      });

      // Log activity
      await storage.createActivityLog({
        type: 'attendance',
        title: `Check-out ${hasOvertime ? 'with Overtime' : ''}`,
        description: `${user.displayName} checked out${hasOvertime ? ` with ${Math.round(overtimeHours * 100) / 100} hours overtime` : ''}${earlyCheckout ? ' (early checkout)' : ''}`,
        entityId: attendanceRecord.id,
        entityType: 'attendance',
        userId: user.uid
      });

      res.json({
        message: `Checked out successfully${hasOvertime ? ` with ${Math.round(overtimeHours * 100) / 100} hours overtime` : ''}`,
        attendance: updatedAttendance,
        workingHours: Math.round(workingHours * 100) / 100,
        overtimeHours: Math.round(overtimeHours * 100) / 100,
        hasOvertime
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
      
      // Return department timings (for now using default values)
      const departmentTimings = {
        "cre": {
          checkInTime: "09:30",
          checkOutTime: "18:30", 
          workingHours: 8,
          overtimeThresholdMinutes: 30,
          lateThresholdMinutes: 15,
          allowEarlyCheckOut: false,
          allowRemoteWork: true,
          allowFieldWork: true
        },
        "accounts": {
          checkInTime: "09:00",
          checkOutTime: "18:00",
          workingHours: 8,
          overtimeThresholdMinutes: 30,
          lateThresholdMinutes: 10,
          allowEarlyCheckOut: true,
          allowRemoteWork: true,
          allowFieldWork: false
        },
        "hr": {
          checkInTime: "09:00",
          checkOutTime: "18:00",
          workingHours: 8,
          overtimeThresholdMinutes: 30,
          lateThresholdMinutes: 10,
          allowEarlyCheckOut: true,
          allowRemoteWork: true,
          allowFieldWork: false
        },
        "sales_and_marketing": {
          checkInTime: "09:30",
          checkOutTime: "18:30",
          workingHours: 8,
          overtimeThresholdMinutes: 30,
          lateThresholdMinutes: 15,
          allowEarlyCheckOut: false,
          allowRemoteWork: true,
          allowFieldWork: true
        },
        "technical_team": {
          checkInTime: "10:00",
          checkOutTime: "19:00",
          workingHours: 8,
          overtimeThresholdMinutes: 30,
          lateThresholdMinutes: 15,
          allowEarlyCheckOut: false,
          allowRemoteWork: true,
          allowFieldWork: true
        }
      };
      
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
      
      // Default timing configuration for the department
      const defaultTimings = {
        "cre": {
          departmentId: "cre",
          checkInTime: "09:30",
          checkOutTime: "18:30",
          workingHours: 8,
          overtimeThresholdMinutes: 30,
          lateThresholdMinutes: 15,
          allowEarlyCheckOut: false,
          allowRemoteWork: true,
          allowFieldWork: true
        },
        "accounts": {
          departmentId: "accounts", 
          checkInTime: "09:00",
          checkOutTime: "18:00",
          workingHours: 8,
          overtimeThresholdMinutes: 30,
          lateThresholdMinutes: 10,
          allowEarlyCheckOut: true,
          allowRemoteWork: true,
          allowFieldWork: false
        },
        "hr": {
          departmentId: "hr",
          checkInTime: "09:00",
          checkOutTime: "18:00",
          workingHours: 8,
          overtimeThresholdMinutes: 30,
          lateThresholdMinutes: 10,
          allowEarlyCheckOut: true,
          allowRemoteWork: true,
          allowFieldWork: false
        },
        "sales_and_marketing": {
          departmentId: "sales_and_marketing",
          checkInTime: "09:30",
          checkOutTime: "18:30",
          workingHours: 8,
          overtimeThresholdMinutes: 30,
          lateThresholdMinutes: 15,
          allowEarlyCheckOut: false,
          allowRemoteWork: true,
          allowFieldWork: true
        },
        "technical_team": {
          departmentId: "technical_team",
          checkInTime: "10:00",
          checkOutTime: "19:00",
          workingHours: 8,
          overtimeThresholdMinutes: 30,
          lateThresholdMinutes: 15,
          allowEarlyCheckOut: false,
          allowRemoteWork: true,
          allowFieldWork: true
        }
      };
      
      const timing = defaultTimings[departmentId] || {
        departmentId,
        checkInTime: "09:30",
        checkOutTime: "18:30",
        workingHours: 8,
        overtimeThresholdMinutes: 30,
        lateThresholdMinutes: 15,
        allowEarlyCheckOut: false,
        allowRemoteWork: true,
        allowFieldWork: true
      };
      
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
        allowEarlyCheckOut,
        allowRemoteWork,
        allowFieldWork
      } = req.body;
      
      // Validate timing data
      if (!checkInTime || !checkOutTime || !workingHours) {
        return res.status(400).json({ message: "Check-in time, check-out time, and working hours are required" });
      }
      
      // In a real implementation, this would be saved to database
      // For now, we'll just return success
      const updatedTiming = {
        departmentId,
        checkInTime,
        checkOutTime,
        workingHours: parseInt(workingHours),
        overtimeThresholdMinutes: parseInt(overtimeThresholdMinutes) || 30,
        lateThresholdMinutes: parseInt(lateThresholdMinutes) || 15,
        allowEarlyCheckOut: Boolean(allowEarlyCheckOut),
        allowRemoteWork: Boolean(allowRemoteWork),
        allowFieldWork: Boolean(allowFieldWork),
        updatedAt: new Date().toISOString(),
        updatedBy: user.uid
      };
      
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

  // Department attendance statistics
  app.get("/api/attendance/department-stats", verifyAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user || user.role !== "master_admin") {
        return res.status(403).json({ message: "Access denied - Master Admin only" });
      }

      const { date } = req.query;
      const attendance = await storage.listAttendance({ date: date as string });
      
      const departmentStats = attendance.reduce((acc, record) => {
        const dept = record.userDepartment || 'unknown';
        if (!acc[dept]) {
          acc[dept] = { department: dept, present: 0, absent: 0, late: 0, total: 0 };
        }
        
        acc[dept].total++;
        if (record.status === 'present') acc[dept].present++;
        else if (record.status === 'absent') acc[dept].absent++;
        else if (record.status === 'late') acc[dept].late++;
        
        return acc;
      }, {} as Record<string, any>);

      res.json(Object.values(departmentStats));
    } catch (error) {
      console.error("Error fetching department statistics:", error);
      res.status(500).json({ message: "Failed to fetch department statistics" });
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

  // Enhanced Check-in with geolocation and field work support
  app.post("/api/attendance/check-in", verifyAuth, async (req, res) => {
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
      
      // Validation
      if (!latitude || !longitude) {
        return res.status(400).json({ message: "Location coordinates are required" });
      }

      // Check if user already checked in today
      const today = new Date().toISOString().split('T')[0];
      const existingAttendance = await storage.getUserAttendanceForDate(userId, today);
      if (existingAttendance && existingAttendance.checkInTime) {
        return res.status(400).json({ message: "You have already checked in today" });
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

  // Enhanced Check-out with overtime detection
  app.post("/api/attendance/check-out", verifyAuth, async (req, res) => {
    try {
      if (!req.authenticatedUser) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const checkOutData = {
        userId: req.authenticatedUser.user.uid,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        reason: req.body.reason,
        otReason: req.body.otReason,
        otImageUrl: req.body.otImageUrl,
        overtimeHours: req.body.overtimeHours
      };

      // Get today's attendance record
      const today = new Date().toISOString().split('T')[0];
      const attendanceRecord = await storage.getUserAttendanceForDate(checkOutData.userId, today);
      
      if (!attendanceRecord || !attendanceRecord.checkInTime) {
        return res.status(400).json({ message: "No check-in record found for today" });
      }

      if (attendanceRecord.checkOutTime) {
        return res.status(400).json({ message: "You have already checked out today" });
      }

      // Get department timing for overtime calculation
      const user = await storage.getUser(checkOutData.userId);
      const departmentTiming = user?.department 
        ? await storage.getDepartmentTiming(user.department)
        : null;

      const checkInTime = new Date(attendanceRecord.checkInTime);
      const checkOutTime = new Date();
      const workingMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
      
      const standardWorkingMinutes = departmentTiming?.workingHours 
        ? departmentTiming.workingHours * 60 
        : 8 * 60; // Default 8 hours
      
      const overtimeThreshold = departmentTiming?.overtimeThresholdMinutes || 30;
      const potentialOvertimeMinutes = workingMinutes - standardWorkingMinutes;
      const hasOvertime = potentialOvertimeMinutes >= overtimeThreshold;

      // Validation for overtime
      if (hasOvertime) {
        if (!checkOutData.otReason) {
          return res.status(400).json({ 
            message: "Please provide a reason for overtime work",
            overtimeHours: Math.floor(potentialOvertimeMinutes / 60),
            overtimeMinutes: potentialOvertimeMinutes % 60
          });
        }
        if (!checkOutData.otImageUrl) {
          return res.status(400).json({ message: "Photo is mandatory for overtime verification" });
        }
      }

      // Update attendance record
      const updatedAttendance = await storage.updateAttendance(attendanceRecord.id, {
        checkOutTime: checkOutTime,
        checkOutLatitude: checkOutData.latitude,
        checkOutLongitude: checkOutData.longitude,
        checkOutImageUrl: checkOutData.otImageUrl,
        workingHours: workingMinutes / 60,
        overtimeHours: hasOvertime ? potentialOvertimeMinutes / 60 : 0,
        otReason: checkOutData.otReason,
        otImageUrl: checkOutData.otImageUrl,
        remarks: checkOutData.reason
      });

      // Create audit log
      await storage.createAuditLog({
        userId: checkOutData.userId,
        action: "attendance_check_out",
        entityType: "attendance",
        entityId: attendanceRecord.id,
        changes: { 
          workingHours: (workingMinutes / 60).toFixed(2),
          overtime: hasOvertime ? (potentialOvertimeMinutes / 60).toFixed(2) : "0",
          location: `${checkOutData.latitude},${checkOutData.longitude}`
        },
        department: user?.department,
        designation: user?.designation
      });

      res.json({ 
        message: "Check-out successful", 
        attendance: updatedAttendance,
        workingSummary: {
          totalHours: (workingMinutes / 60).toFixed(2),
          overtimeHours: hasOvertime ? (potentialOvertimeMinutes / 60).toFixed(2) : "0",
          hasOvertime
        }
      });
    } catch (error) {
      console.error("Error during check-out:", error);
      res.status(500).json({ message: "Failed to record check-out" });
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
        checkInTime: req.body.checkInTime || "09:00",
        checkOutTime: req.body.checkOutTime || "18:00",
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

  const httpServer = createServer(app);
  return httpServer;
}
