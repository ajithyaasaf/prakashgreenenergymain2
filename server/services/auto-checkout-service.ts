/**
 * Auto-Checkout Service
 * Handles automatic checkout functionality with 2-hour wait and 11:55 PM fallback
 */

import { storage } from '../storage';

export class AutoCheckoutService {
  private static autoCheckoutTimers = new Map<string, NodeJS.Timeout>();
  private static dailyCleanupTimer: NodeJS.Timeout | null = null;

  /**
   * Initialize auto-checkout system
   */
  static initialize() {
    console.log('AUTO-CHECKOUT: Service initialized');
    
    // Set daily cleanup at 11:55 PM
    this.scheduleDailyCleanup();
    
    // Resume any pending auto-checkouts on server restart
    this.resumePendingAutoCheckouts();
  }

  /**
   * Schedule auto-checkout for a user
   */
  static scheduleAutoCheckout(userId: string, attendanceId: string, departmentCheckoutTime: string) {
    // Clear existing timer if any
    this.clearAutoCheckout(userId);

    const [hour, minute] = departmentCheckoutTime.split(':').map(Number);
    const today = new Date();
    const departmentCheckoutDateTime = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      hour,
      minute
    );

    // Schedule auto-checkout 2 hours after department checkout time
    const autoCheckoutTime = new Date(departmentCheckoutDateTime.getTime() + (2 * 60 * 60 * 1000));
    const delay = autoCheckoutTime.getTime() - Date.now();

    if (delay > 0) {
      console.log(`AUTO-CHECKOUT: Scheduled for user ${userId} at ${autoCheckoutTime.toLocaleString()}`);
      
      const timer = setTimeout(() => {
        this.executeAutoCheckout(userId, attendanceId, 'two_hour_wait');
      }, delay);

      this.autoCheckoutTimers.set(userId, timer);
    }
  }

  /**
   * Cancel auto-checkout when user requests overtime
   */
  static cancelAutoCheckoutForOvertime(userId: string) {
    this.clearAutoCheckout(userId);
    console.log(`AUTO-CHECKOUT: Cancelled for user ${userId} due to overtime request`);
  }

  /**
   * Execute automatic checkout
   */
  private static async executeAutoCheckout(userId: string, attendanceId: string, reason: 'two_hour_wait' | 'daily_cleanup') {
    try {
      console.log(`AUTO-CHECKOUT: Executing for user ${userId}, reason: ${reason}`);

      const attendance = await storage.getAttendance(attendanceId);
      if (!attendance || attendance.checkOutTime) {
        console.log(`AUTO-CHECKOUT: Skipped for user ${userId} - already checked out or not found`);
        return;
      }

      // Check if overtime was requested - if so, skip auto-checkout
      if ((attendance as any).overtimeRequested && reason === 'two_hour_wait') {
        console.log(`AUTO-CHECKOUT: Skipped for user ${userId} - overtime active`);
        return;
      }

      const user = await storage.getUser(userId);
      const departmentTiming = this.getDepartmentTiming(user?.department);
      
      // For auto-checkout, use department checkout time as the effective checkout time
      const [checkOutHour, checkOutMinute] = departmentTiming.checkOutTime.split(':').map(Number);
      const today = new Date(attendance.checkInTime);
      const effectiveCheckoutTime = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        checkOutHour,
        checkOutMinute
      );

      // Calculate working hours from check-in to department checkout time (not actual time)
      const checkInTime = new Date(attendance.checkInTime);
      const workingMilliseconds = effectiveCheckoutTime.getTime() - checkInTime.getTime();
      const workingHours = Math.max(0, workingMilliseconds / (1000 * 60 * 60));

      // Update attendance record
      await storage.updateAttendance(attendanceId, {
        checkOutTime: new Date(), // Actual checkout time
        workingHours: Math.round(workingHours * 100) / 100,
        overtimeHours: 0, // No overtime for auto-checkout
        isAutoCheckout: true,
        autoCheckoutTime: new Date(),
        autoCheckoutReason: reason === 'two_hour_wait' 
          ? `Auto-checkout after 2 hours past ${departmentTiming.checkOutTime}`
          : 'Daily cleanup at 11:55 PM',
        lastActivityTime: new Date()
      });

      // Log activity
      await storage.createActivityLog({
        type: 'attendance',
        title: 'Auto Checkout',
        description: `${user?.displayName} was automatically checked out. Working hours calculated until ${departmentTiming.checkOutTime}`,
        entityId: attendanceId,
        entityType: 'attendance',
        userId: userId
      });

      console.log(`AUTO-CHECKOUT: Completed for user ${userId}`);
      
      // Clear timer
      this.clearAutoCheckout(userId);

    } catch (error) {
      console.error(`AUTO-CHECKOUT: Error for user ${userId}:`, error);
    }
  }

  /**
   * Schedule daily cleanup at 11:55 PM
   */
  private static scheduleDailyCleanup() {
    const now = new Date();
    const cleanupTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23, // 11 PM
      55  // 55 minutes
    );

    // If it's already past 11:55 PM today, schedule for tomorrow
    if (now > cleanupTime) {
      cleanupTime.setDate(cleanupTime.getDate() + 1);
    }

    const delay = cleanupTime.getTime() - now.getTime();

    this.dailyCleanupTimer = setTimeout(() => {
      this.executeDailyCleanup();
      // Reschedule for next day
      this.scheduleDailyCleanup();
    }, delay);

    console.log(`AUTO-CHECKOUT: Daily cleanup scheduled for ${cleanupTime.toLocaleString()}`);
  }

  /**
   * Execute daily cleanup at 11:55 PM
   */
  private static async executeDailyCleanup() {
    try {
      console.log('AUTO-CHECKOUT: Executing daily cleanup at 11:55 PM');
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get all attendance records for today that haven't checked out
      const pendingAttendance = await storage.getPendingCheckouts(today);
      
      for (const attendance of pendingAttendance) {
        // Skip if overtime was requested
        if (!(attendance as any).overtimeRequested) {
          await this.executeAutoCheckout(attendance.userId, attendance.id, 'daily_cleanup');
        } else {
          console.log(`AUTO-CHECKOUT: Daily cleanup skipped for user ${attendance.userId} - overtime active`);
        }
      }

      // Clear all timers as we're doing daily cleanup
      this.autoCheckoutTimers.clear();

    } catch (error) {
      console.error('AUTO-CHECKOUT: Daily cleanup error:', error);
    }
  }

  /**
   * Resume pending auto-checkouts on server restart
   */
  private static async resumePendingAutoCheckouts() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const pendingAttendance = await storage.getPendingCheckouts(today);
      
      for (const attendance of pendingAttendance) {
        // Skip if overtime was requested
        if (!(attendance as any).overtimeRequested) {
          const user = await storage.getUser(attendance.userId);
          const departmentTiming = this.getDepartmentTiming(user?.department);
          this.scheduleAutoCheckout(attendance.userId, attendance.id, departmentTiming.checkOutTime);
        }
      }

    } catch (error) {
      console.error('AUTO-CHECKOUT: Resume error:', error);
    }
  }

  /**
   * Clear auto-checkout timer for a user
   */
  private static clearAutoCheckout(userId: string) {
    const timer = this.autoCheckoutTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      this.autoCheckoutTimers.delete(userId);
    }
  }

  /**
   * Get department timing configuration
   */
  private static getDepartmentTiming(department?: string) {
    // Department timing configurations
    const departmentTimings = {
      operations: { checkInTime: "09:00", checkOutTime: "19:00", workingHours: 8, overtimeThresholdMinutes: 30 },
      admin: { checkInTime: "09:00", checkOutTime: "18:00", workingHours: 8, overtimeThresholdMinutes: 30 },
      hr: { checkInTime: "09:30", checkOutTime: "18:30", workingHours: 8, overtimeThresholdMinutes: 30 },
      marketing: { checkInTime: "10:00", checkOutTime: "19:00", workingHours: 8, overtimeThresholdMinutes: 30 },
      sales: { checkInTime: "09:00", checkOutTime: "19:00", workingHours: 8, overtimeThresholdMinutes: 30 },
      technical: { checkInTime: "09:00", checkOutTime: "18:00", workingHours: 8, overtimeThresholdMinutes: 30 },
      housekeeping: { checkInTime: "08:00", checkOutTime: "17:00", workingHours: 8, overtimeThresholdMinutes: 30 }
    };

    return departmentTimings[department as keyof typeof departmentTimings] || departmentTimings.operations;
  }

  /**
   * Cleanup on service shutdown
   */
  static shutdown() {
    console.log('AUTO-CHECKOUT: Service shutting down');
    
    // Clear all timers
    this.autoCheckoutTimers.forEach(timer => clearTimeout(timer));
    this.autoCheckoutTimers.clear();
    
    if (this.dailyCleanupTimer) {
      clearTimeout(this.dailyCleanupTimer);
      this.dailyCleanupTimer = null;
    }
  }
}