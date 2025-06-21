import { storage } from "../storage";
import { insertAttendanceSchema } from "@shared/schema";
import { z } from "zod";

export class EnhancedAttendanceOvertimeService {
  /**
   * Check if current time is before department check-in time (early login)
   */
  static isEarlyCheckIn(departmentTiming: any): { isEarly: boolean; minutesEarly: number } {
    if (!departmentTiming?.checkInTime) {
      return { isEarly: false, minutesEarly: 0 };
    }

    const now = new Date();
    const [checkInHour, checkInMinute] = departmentTiming.checkInTime.split(':').map(Number);
    
    const expectedCheckInTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      checkInHour,
      checkInMinute
    );

    const isEarly = now < expectedCheckInTime;
    const minutesEarly = isEarly ? Math.floor((expectedCheckInTime.getTime() - now.getTime()) / (1000 * 60)) : 0;

    return { isEarly, minutesEarly };
  }

  /**
   * Check if current time is before department check-out time (early checkout)
   */
  static isEarlyCheckOut(departmentTiming: any): { isEarly: boolean; minutesEarly: number; expectedCheckOutTime: Date } {
    const now = new Date();
    
    if (!departmentTiming?.checkOutTime) {
      const defaultTime = new Date(now);
      defaultTime.setHours(19, 0, 0, 0); // Default 7:00 PM
      return { isEarly: now < defaultTime, minutesEarly: 0, expectedCheckOutTime: defaultTime };
    }

    const [checkOutHour, checkOutMinute] = departmentTiming.checkOutTime.split(':').map(Number);
    
    const expectedCheckOutTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      checkOutHour,
      checkOutMinute
    );

    const isEarly = now < expectedCheckOutTime;
    const minutesEarly = isEarly ? Math.floor((expectedCheckOutTime.getTime() - now.getTime()) / (1000 * 60)) : 0;

    return { isEarly, minutesEarly, expectedCheckOutTime };
  }

  /**
   * Calculate auto checkout time based on department timing (2 hours after dept checkout time)
   */
  private static calculateAutoCheckOutTime(departmentTiming: any): Date {
    const now = new Date();
    const autoCheckOutTime = new Date(now);
    
    if (departmentTiming?.checkOutTime) {
      const [hours, minutes] = departmentTiming.checkOutTime.split(':');
      autoCheckOutTime.setHours(parseInt(hours) + 2, parseInt(minutes), 0, 0);
    } else {
      // Default: 2 hours after 7:00 PM = 9:00 PM
      autoCheckOutTime.setHours(21, 0, 0, 0);
    }
    
    return autoCheckOutTime;
  }

  /**
   * Calculate final auto checkout time (11:55 PM for OT scenarios)
   */
  private static calculateFinalAutoCheckOutTime(): Date {
    const now = new Date();
    const finalCheckOutTime = new Date(now);
    finalCheckOutTime.setHours(23, 55, 0, 0);
    return finalCheckOutTime;
  }

  /**
   * Check if current time allows overtime request (after dept checkout time)
   */
  static canRequestOvertime(departmentTiming: any): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    if (departmentTiming?.checkOutTime) {
      const [hours, minutes] = departmentTiming.checkOutTime.split(':');
      const checkOutTime = parseInt(hours) * 60 + parseInt(minutes);
      return currentTime >= checkOutTime;
    }
    
    // Default check-out time: 7:00 PM (19:00)
    return currentTime >= 19 * 60;
  }

  /**
   * Enhanced check-in with early login detection and reason/image requirement
   */
  static async processEnhancedCheckIn(data: {
    userId: string;
    latitude: string;
    longitude: string;
    attendanceType: string;
    reason?: string;
    imageUrl?: string;
    departmentTiming?: any;
  }): Promise<{ success: boolean; message: string; attendanceId?: string; isEarlyCheckIn?: boolean }> {
    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Check for existing attendance today
      const existingAttendance = await storage.getAttendanceByUserAndDate(data.userId, today);
      if (existingAttendance) {
        return { success: false, message: "You have already checked in today" };
      }

      // Check if this is early check-in
      const { isEarly, minutesEarly } = this.isEarlyCheckIn(data.departmentTiming);

      // For early check-in, reason and image are required
      if (isEarly && (!data.reason || !data.imageUrl)) {
        return { 
          success: false, 
          message: "Early check-in requires both reason and photo",
          isEarlyCheckIn: true 
        };
      }

      // Calculate expected times
      const expectedCheckInTime = new Date(now);
      if (data.departmentTiming?.checkInTime) {
        const [hours, minutes] = data.departmentTiming.checkInTime.split(':');
        expectedCheckInTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        expectedCheckInTime.setHours(9, 0, 0, 0); // Default 9:00 AM
      }

      const expectedCheckOutTime = new Date(now);
      if (data.departmentTiming?.checkOutTime) {
        const [hours, minutes] = data.departmentTiming.checkOutTime.split(':');
        expectedCheckOutTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        expectedCheckOutTime.setHours(19, 0, 0, 0); // Default 7:00 PM
      }

      // Create enhanced attendance record
      const attendanceData = {
        userId: data.userId,
        date: today,
        checkInTime: now,
        attendanceType: data.attendanceType as "office" | "remote" | "field_work",
        reason: data.reason,
        checkInLatitude: data.latitude,
        checkInLongitude: data.longitude,
        checkInImageUrl: data.imageUrl,
        status: "present" as "present" | "absent" | "late" | "leave" | "holiday" | "half_day",
        isLate: false,
        isWithinOfficeRadius: true,
        
        // Enhanced early check-in tracking
        isEarlyCheckIn: isEarly,
        earlyCheckInReason: isEarly ? data.reason : undefined,
        earlyCheckInImageUrl: isEarly ? data.imageUrl : undefined,
        earlyCheckInMinutes: minutesEarly,
        
        // Initialize checkout tracking
        isEarlyCheckOut: false,
        earlyCheckOutMinutes: 0,
        
        // Enhanced overtime management
        overtimeEnabled: false,
        overtimeStartTime: undefined,
        overtimeApprovalStatus: undefined,
        overtimeRequestedByUser: false,
        
        // Auto checkout with 2-hour buffer system
        autoCheckOutEnabled: true,
        autoCheckOutTime: this.calculateAutoCheckOutTime(data.departmentTiming),
        finalAutoCheckOutTime: this.calculateFinalAutoCheckOutTime(),
        isAutoCheckedOut: false,
        autoCheckOutReason: undefined,
        
        // Enhanced working hours calculation
        regularWorkingHours: 0,
        actualOvertimeHours: 0,
        calculatedWorkingHours: 0,
        eligibleOvertimeHours: 0,
        
        // Timing compliance
        expectedCheckInTime,
        expectedCheckOutTime,
        isLateCheckIn: false,
        lateCheckInMinutes: 0,
        
        // Audit trail
        lastModifiedAt: now,
        lastModifiedBy: data.userId
      };

      const attendance = await storage.createAttendance(attendanceData);

      return {
        success: true,
        attendanceId: attendance.id,
        message: isEarly 
          ? `Early check-in successful (${minutesEarly} minutes early)`
          : "Check-in successful",
        isEarlyCheckIn: isEarly
      };
    } catch (error) {
      console.error("Error processing enhanced check-in:", error);
      return { success: false, message: "Failed to process check-in" };
    }
  }

  /**
   * Enhanced check-out with early checkout detection and auto-checkout logic
   */
  static async processEnhancedCheckOut(data: {
    attendanceId: string;
    userId: string;
    latitude: string;
    longitude: string;
    reason?: string;
    imageUrl?: string;
    isOvertimeCheckout?: boolean;
    otReason?: string;
    departmentTiming?: any;
  }): Promise<{ 
    success: boolean; 
    message: string; 
    workingHours?: number; 
    overtimeHours?: number;
    isEarlyCheckOut?: boolean;
  }> {
    try {
      const attendance = await storage.getAttendance(data.attendanceId);
      if (!attendance) {
        return { success: false, message: "Attendance record not found" };
      }

      if (attendance.userId !== data.userId) {
        return { success: false, message: "Unauthorized access" };
      }

      if (attendance.checkOutTime) {
        return { success: false, message: "Already checked out for today" };
      }

      const now = new Date();
      const checkInTime = new Date(attendance.checkInTime!);

      // Check if this is early checkout
      const { isEarly, minutesEarly, expectedCheckOutTime } = this.isEarlyCheckOut(data.departmentTiming);

      // For early checkout, require reason
      if (isEarly && !data.reason) {
        return { 
          success: false, 
          message: "Early check-out requires a reason",
          isEarlyCheckOut: true 
        };
      }

      // Calculate total working time
      const totalWorkingMilliseconds = now.getTime() - checkInTime.getTime();
      const totalWorkingHours = totalWorkingMilliseconds / (1000 * 60 * 60);

      // Calculate regular working hours (till expected checkout time or actual if early)
      const regularEndTime = isEarly ? now : expectedCheckOutTime;
      const regularWorkingMilliseconds = regularEndTime.getTime() - checkInTime.getTime();
      const regularWorkingHours = Math.max(0, regularWorkingMilliseconds / (1000 * 60 * 60));

      // Calculate overtime hours
      let overtimeHours = 0;
      let eligibleOvertimeHours = 0;

      if (!isEarly && data.isOvertimeCheckout && attendance.overtimeRequestedByUser) {
        // Only calculate OT if user explicitly requested it and it's not early checkout
        const expectedWorkingHours = (expectedCheckOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);
        overtimeHours = Math.max(0, totalWorkingHours - expectedWorkingHours);
        eligibleOvertimeHours = overtimeHours;
      }

      // Update attendance record
      const updateData = {
        checkOutTime: now,
        checkOutLatitude: data.latitude,
        checkOutLongitude: data.longitude,
        checkOutImageUrl: data.imageUrl,
        reason: data.reason,
        
        // Early checkout tracking
        isEarlyCheckOut: isEarly,
        earlyCheckOutReason: isEarly ? data.reason : undefined,
        earlyCheckOutMinutes: minutesEarly,
        
        // Enhanced working hours calculation
        calculatedWorkingHours: Math.round(totalWorkingHours * 100) / 100,
        regularWorkingHours: Math.round(regularWorkingHours * 100) / 100,
        actualOvertimeHours: Math.round(overtimeHours * 100) / 100,
        eligibleOvertimeHours: Math.round(eligibleOvertimeHours * 100) / 100,
        overtimeHours: Math.round(eligibleOvertimeHours * 100) / 100,
        
        // OT details
        otReason: data.isOvertimeCheckout ? data.otReason : undefined,
        
        // Audit trail
        lastModifiedAt: now,
        lastModifiedBy: data.userId
      };

      await storage.updateAttendance(data.attendanceId, updateData);

      return {
        success: true,
        message: isEarly 
          ? `Early check-out completed (${minutesEarly} minutes early)`
          : data.isOvertimeCheckout 
            ? `Overtime check-out completed (${Math.round(eligibleOvertimeHours * 100) / 100} OT hours)`
            : "Check-out completed",
        workingHours: Math.round(regularWorkingHours * 100) / 100,
        overtimeHours: Math.round(eligibleOvertimeHours * 100) / 100,
        isEarlyCheckOut: isEarly
      };
    } catch (error) {
      console.error("Error processing enhanced check-out:", error);
      return { success: false, message: "Failed to process check-out" };
    }
  }

  /**
   * Enable overtime for user - disables 2-hour auto checkout, sets final cleanup at 11:55 PM
   */
  static async enableOvertimeForUser(attendanceId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const attendance = await storage.getAttendance(attendanceId);
      if (!attendance) {
        return { success: false, message: "Attendance record not found" };
      }

      if (attendance.userId !== userId) {
        return { success: false, message: "Unauthorized access" };
      }

      if (attendance.checkOutTime) {
        return { success: false, message: "Already checked out for today" };
      }

      const now = new Date();
      
      await storage.updateAttendance(attendanceId, {
        overtimeEnabled: true,
        overtimeStartTime: now,
        overtimeRequestedByUser: true,
        overtimeApprovalStatus: "pending",
        // Keep auto checkout enabled but change to final cleanup time
        autoCheckOutTime: this.calculateFinalAutoCheckOutTime(),
        lastModifiedAt: now,
        lastModifiedBy: userId
      });

      return {
        success: true,
        message: "Overtime enabled. You can now work beyond regular hours. System will auto-checkout at 11:55 PM if you forget."
      };
    } catch (error) {
      console.error("Error enabling overtime:", error);
      return { success: false, message: "Failed to enable overtime" };
    }
  }

  /**
   * Process automatic checkouts - runs via scheduled job
   */
  static async processEnhancedAutoCheckouts(): Promise<{ 
    success: boolean; 
    message: string; 
    processedCount: number; 
    details: any[] 
  }> {
    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Get all attendance records that need auto checkout
      const pendingAttendance = await storage.listAttendanceByDate(today);
      const needsAutoCheckout = pendingAttendance.filter(record => 
        !record.checkOutTime && 
        record.autoCheckOutEnabled &&
        record.autoCheckOutTime &&
        now >= new Date(record.autoCheckOutTime)
      );

      const processedRecords = [];

      for (const attendance of needsAutoCheckout) {
        try {
          const checkInTime = new Date(attendance.checkInTime!);
          
          // Determine auto checkout time based on overtime status
          let autoCheckoutTime: Date;
          let autoCheckoutReason: string;

          if (attendance.overtimeRequestedByUser && attendance.finalAutoCheckOutTime) {
            // User requested OT - use final cleanup time (11:55 PM)
            autoCheckoutTime = new Date(attendance.finalAutoCheckOutTime);
            autoCheckoutReason = "Auto-checkout after OT period - final cleanup";
          } else {
            // Regular 2-hour buffer auto checkout
            autoCheckoutTime = new Date(attendance.autoCheckOutTime!);
            autoCheckoutReason = "Auto-checkout after 2-hour buffer period";
          }

          // Calculate working hours till expected checkout time (not auto checkout time)
          const expectedCheckOutTime = new Date(attendance.expectedCheckOutTime!);
          const regularWorkingMilliseconds = expectedCheckOutTime.getTime() - checkInTime.getTime();
          const regularWorkingHours = Math.max(0, regularWorkingMilliseconds / (1000 * 60 * 60));

          // For auto checkout, working hours are capped at regular hours
          // OT is NOT counted for auto checkouts as per requirement
          await storage.updateAttendance(attendance.id, {
            checkOutTime: autoCheckoutTime,
            isAutoCheckedOut: true,
            autoCheckOutReason: autoCheckoutReason,
            calculatedWorkingHours: Math.round(regularWorkingHours * 100) / 100,
            regularWorkingHours: Math.round(regularWorkingHours * 100) / 100,
            actualOvertimeHours: 0, // No OT for auto checkouts
            eligibleOvertimeHours: 0, // No eligible OT for auto checkouts
            overtimeHours: 0,
            lastModifiedAt: now,
            lastModifiedBy: "system"
          });

          processedRecords.push({
            userId: attendance.userId,
            attendanceId: attendance.id,
            checkoutTime: autoCheckoutTime,
            reason: autoCheckoutReason,
            workingHours: Math.round(regularWorkingHours * 100) / 100
          });

        } catch (error) {
          console.error(`Error auto-checking out attendance ${attendance.id}:`, error);
        }
      }

      return {
        success: true,
        message: `Processed ${processedRecords.length} auto checkouts`,
        processedCount: processedRecords.length,
        details: processedRecords
      };

    } catch (error) {
      console.error("Error processing enhanced auto checkouts:", error);
      return { 
        success: false, 
        message: "Failed to process auto checkouts", 
        processedCount: 0, 
        details: [] 
      };
    }
  }
}