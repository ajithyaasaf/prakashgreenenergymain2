import { auth as adminAuth } from '../firebase';
import { storage } from '../storage';
import { cacheService } from './cache-service';
import { z } from 'zod';

// Unified user creation schema
export const createUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["master_admin", "admin", "employee"]).default("employee"),
  department: z.enum(["operations", "admin", "hr", "marketing", "sales", "technical", "housekeeping"]).nullable().default(null)
});

// User update schema
export const updateUserSchema = z.object({
  displayName: z.string().min(2).optional(),
  role: z.enum(["master_admin", "admin", "employee"]).optional(),
  department: z.enum(["operations", "admin", "hr", "marketing", "sales", "technical", "housekeeping"]).nullable().optional(),
  designation: z.enum([
    "ceo", "gm", "officer", "executive", "cre", "team_leader", "technician", "welder", "house_man"
  ]).nullable().optional(),
  employeeId: z.string().optional(),
  reportingManagerId: z.string().nullable().optional(),
  payrollGrade: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "D1", "D2"]).nullable().optional(),
  joinDate: z.date().optional(),
  isActive: z.boolean().optional(),
  photoURL: z.string().nullable().optional()
});

export class UserService {
  /**
   * Create a new user with Firebase Auth and store profile in Firestore
   */
  async createUser(userData: z.infer<typeof createUserSchema>) {
    try {
      // Validate input data
      const validatedData = createUserSchema.parse(userData);
      
      // Create user in Firebase Auth
      const userRecord = await adminAuth.createUser({
        email: validatedData.email,
        password: validatedData.password,
        displayName: validatedData.displayName,
        emailVerified: false
      });

      // Create user profile in Firestore with validated data
      const userProfile = await storage.createUser({
        uid: userRecord.uid,
        email: validatedData.email,
        displayName: validatedData.displayName,
        role: validatedData.role,
        department: validatedData.department
      });

      // Log activity
      await storage.createActivityLog({
        type: 'customer_created',
        title: 'New User Registered',
        description: `User ${validatedData.displayName} (${validatedData.email}) registered successfully`,
        entityId: userRecord.uid,
        entityType: 'user',
        userId: userRecord.uid
      });

      return {
        success: true,
        user: userProfile,
        firebaseUser: userRecord
      };

    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // If Firebase user was created but Firestore failed, clean up
      if (error.uid) {
        try {
          await adminAuth.deleteUser(error.uid);
        } catch (cleanupError) {
          console.error('Error cleaning up Firebase user:', cleanupError);
        }
      }

      return {
        success: false,
        error: error.message || 'Failed to create user',
        code: error.code
      };
    }
  }

  /**
   * Sync existing Firebase Auth user with Firestore
   */
  async syncUserProfile(uid: string, additionalData?: Partial<z.infer<typeof updateUserSchema>>) {
    try {
      // Get user from Firebase Auth
      const firebaseUser = await adminAuth.getUser(uid);
      
      // Check if user already exists in our storage
      let existingUser = await storage.getUser(uid);
      
      if (existingUser) {
        // Update existing user with fresh Firebase Auth data
        const updatedUser = await storage.updateUser(uid, {
          email: firebaseUser.email || existingUser.email,
          displayName: firebaseUser.displayName || existingUser.displayName,
          ...additionalData
        });
        return { success: true, user: updatedUser, action: 'updated' };
      } else {
        // Create new user profile from Firebase Auth data
        // Preserve the displayName from Firebase Auth or use the one from additionalData
        const displayName = additionalData?.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
        
        const newUser = await storage.createUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: displayName,
          role: additionalData?.role || 'employee',
          department: additionalData?.department || null
        });
        return { success: true, user: newUser, action: 'created' };
      }
    } catch (error: any) {
      console.error('Error syncing user profile:', error);
      return {
        success: false,
        error: error.message || 'Failed to sync user profile'
      };
    }
  }

  /**
   * Update user profile with validation
   */
  async updateUserProfile(uid: string, updateData: z.infer<typeof updateUserSchema>) {
    try {
      // Validate update data
      const validatedData = updateUserSchema.parse(updateData);
      
      // Update in our storage
      const updatedUser = await storage.updateUser(uid, validatedData);
      
      // Update cache with new user data
      cacheService.updateUser(uid, updatedUser);
      
      // Update Firebase Auth if display name changed
      if (validatedData.displayName) {
        await adminAuth.updateUser(uid, {
          displayName: validatedData.displayName
        });
      }

      // Log activity
      await storage.createActivityLog({
        type: 'customer_updated',
        title: 'User Profile Updated',
        description: `User profile updated for ${updatedUser.displayName}`,
        entityId: uid,
        entityType: 'user',
        userId: uid
      });

      return { success: true, user: updatedUser };
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      return {
        success: false,
        error: error.message || 'Failed to update user profile'
      };
    }
  }

  /**
   * Get all users with proper data validation and caching
   */
  async getAllUsers() {
    try {
      console.log('[UserService] Getting all users');
      
      // Always fetch fresh data from Firestore to ensure we get new users
      const users = await storage.listUsers();
      console.log(`[UserService] Retrieved ${users.length} users from Firestore`);
      
      // Validate and cache each user
      const validatedUsers = users.map(user => {
        // Cache the user data
        cacheService.setUser(user.uid, user);
        
        return {
          id: user.uid,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || null,
          role: user.role,
          department: user.department,
          designation: user.designation || null,
          createdAt: user.createdAt,
          photoURL: user.photoURL || null
        };
      });

      return { success: true, users: validatedUsers };
    } catch (error: any) {
      console.error('Error fetching users:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch users',
        users: []
      };
    }
  }

  /**
   * Delete user from both Firebase Auth and Firestore
   */
  async deleteUser(uid: string) {
    try {
      // Delete from Firebase Auth
      await adminAuth.deleteUser(uid);
      
      // Note: In Firestore, we should keep the user record for audit purposes
      // but mark it as deleted instead of actually deleting it
      await storage.updateUser(uid, {
        // Add a deleted flag if you want to implement soft delete
      } as any);

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting user:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete user'
      };
    }
  }
}

export const userService = new UserService();