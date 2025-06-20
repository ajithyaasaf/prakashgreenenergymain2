import { storage } from "../storage";
import { insertAttendanceSchema } from "@shared/schema";
import { z } from "zod";

export class AttendanceOvertimeService {
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
      return { isEarly: false, minutesEarly: 0, expectedCheckOutTime: now };
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
   * Check if user should show overtime button (after expected checkout time)
   */
  static shouldShowOvertimeButton(departmentTiming: any): { showButton: boolean; minutesLate: number } {
    const { isEarly, expectedCheckOutTime } = this.isEarlyCheckOut(departmentTiming);
    
    if (isEarly) {
      return { showButton: false, minutesLate: 0 };
    }

    const now = new Date();
    const minutesLate = Math.floor((now.getTime() - expectedCheckOutTime.getTime()) / (1000 * 60));

    return { showButton: true, minutesLate };
  }

  /**
   * Calculate auto check-out time based on OT status
   * - If OT enabled: 11:55 PM same day (final cleanup)
   * - If no OT: 2 hours after expected checkout time
   */
  static calculateAutoCheckOutTime(departmentTiming: any, overtimeEnabled: boolean = false): Date {
    const now = new Date();
    
    if (overtimeEnabled) {
      // If OT is enabled, auto checkout at 11:55 PM for final cleanup
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        55,
        0,
        0
      );
    }
    
    if (!departmentTiming?.checkOutTime) {
      // Default: 2 hours from now if no department timing
      return new Date(now.getTime() + (2 * 60 * 60 * 1000));
    }

    const [checkOutHour, checkOutMinute] = departmentTiming.checkOutTime.split(':').map(Number);
    
    const expectedCheckOutTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      checkOutHour,
      checkOutMinute
    );

    // Auto checkout 2 hours after expected checkout time (only if no OT)
    return new Date(expectedCheckOutTime.getTime() + (2 * 60 * 60 * 1000));
  }

  /**
   * Enable overtime for an attendance record
   * This disables the 2-hour auto checkout and sets final cleanup at 11:55 PM
   */
  static async enableOvertime(attendanceId: string, userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const attendance = await storage.getAttendance(attendanceId);
      if (!attendance) {
        return { success: false, message: "Attendance record not found" };
      }

      if (attendance.userId !== userId) {
        return { success: false, message: "Unauthorized to modify this attendance record" };
      }

      const now = new Date();
      
      // Calculate new auto checkout time for final cleanup at 11:55 PM
      const finalCleanupTime = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        55,
        0,
        0
      );
      
      await storage.updateAttendance(attendanceId, {
        overtimeEnabled: true,
        overtimeStartTime: now,
        overtimeApprovalStatus: "pending",
        autoCheckOutEnabled: true, // Keep enabled but change time to 11:55 PM
        autoCheckOutTime: finalCleanupTime, // Final cleanup time
        lastModifiedAt: now,
        lastModifiedBy: userId
      });

      // Log activity
      await storage.createActivityLog({
        type: 'attendance',
        title: 'Overtime Enabled',
        description: `User enabled overtime mode at ${now.toLocaleTimeString()}. Auto checkout disabled until 11:55 PM.`,
        entityId: attendanceId,
        entityType: 'attendance',
        userId: userId
      });

      return { success: true, message: "Overtime mode enabled successfully. Auto checkout disabled until 11:55 PM." };
    } catch (error) {
      console.error("Error enabling overtime:", error);
      return { success: false, message: "Failed to enable overtime mode" };
    }
  }

  /**
   * Process check-in with early detection
   */
  static async processCheckIn(data: {
    userId: string;
    latitude: string;
    longitude: string;
    attendanceType: string;
    reason?: string;
    imageUrl?: string;
    departmentTiming?: any;
  }): Promise<{ success: boolean; attendanceId?: string; message: string; requiresEarlyVerification?: boolean }> {
    try {
      const { isEarly, minutesEarly } = this.isEarlyCheckIn(data.departmentTiming);
      
      // Check if early check-in requires verification
      if (isEarly && (!data.reason || !data.imageUrl)) {
        return {
          success: false,
          message: `Early check-in detected (${minutesEarly} minutes early). Please provide reason and photo.`,
          requiresEarlyVerification: true
        };
      }

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Check for existing attendance
      const existingAttendance = await storage.getAttendanceByUserAndDate(data.userId, today);
      if (existingAttendance && existingAttendance.checkInTime) {
        return { success: false, message: "Already checked in today" };
      }

      // Calculate expected times
      let expectedCheckInTime: Date | undefined;
      let expectedCheckOutTime: Date | undefined;
      
      if (data.departmentTiming) {
        const [inHour, inMinute] = data.departmentTiming.checkInTime.split(':').map(Number);
        const [outHour, outMinute] = data.departmentTiming.checkOutTime.split(':').map(Number);
        
        expectedCheckInTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), inHour, inMinute);
        expectedCheckOutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), outHour, outMinute);
      }

      // Create attendance record
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
        isEarlyCheckIn: isEarly,
        earlyCheckInReason: isEarly ? data.reason : undefined,
        earlyCheckInImageUrl: isEarly ? data.imageUrl : undefined,
        isEarlyCheckOut: false,
        overtimeEnabled: false,
        overtimeStartTime: undefined,
        overtimeApprovalStatus: undefined,
        autoCheckOutEnabled: true,
        autoCheckOutTime: this.calculateAutoCheckOutTime(data.departmentTiming),
        isAutoCheckedOut: false,
        autoCheckOutReason: undefined,
        regularWorkingHours: 0,
        actualOvertimeHours: 0,
        expectedCheckInTime,
        expectedCheckOutTime,
        isLateCheckIn: false,
        lateCheckInMinutes: 0,
        lastModifiedAt: now,
        lastModifiedBy: data.userId
      };

      const attendance = await storage.createAttendance(attendanceData);

      return {
        success: true,
        attendanceId: attendance.id,
        message: isEarly 
          ? `Early check-in successful (${minutesEarly} minutes early)`
          : "Check-in successful"
      };
    } catch (error) {
      console.error("Error processing check-in:", error);
      return { success: false, message: "Failed to process check-in" };
    }
  }

  /**
   * Process check-out with overtime and auto-checkout logic
   */
  static async processCheckOut(data: {
    attendanceId: string;
    userId: string;
    latitude: string;
    longitude: string;
    reason?: string;
    imageUrl?: string;
    isOvertimeCheckout?: boolean;
    otReason?: string;
    departmentTiming?: any;
  }): Promise<{ success: boolean; message: string; overtimeHours?: number }> {
    try {
      const attendance = await storage.getAttendance(data.attendanceId);
      if (!attendance) {
        return { success: false, message: "Attendance record not found" };
      }

      if (attendance.userId !== data.userId) {
        return { success: false, message: "Unauthorized to modify this attendance record" };
      }

      const now = new Date();
      const checkInTime = attendance.checkInTime;
      
      if (!checkInTime) {
        return { success: false, message: "No check-in time found" };
      }

      // Calculate working hours
      const totalWorkingMilliseconds = now.getTime() - checkInTime.getTime();
      const totalWorkingHours = totalWorkingMilliseconds / (1000 * 60 * 60);

      // Determine regular and overtime hours
      let regularWorkingHours = totalWorkingHours;
      let actualOvertimeHours = 0;

      if (data.departmentTiming && attendance.expectedCheckOutTime) {
        const expectedCheckOutTime = attendance.expectedCheckOutTime;
        
        if (data.isOvertimeCheckout && attendance.overtimeEnabled) {
          // Calculate overtime from expected checkout time
          const regularMilliseconds = expectedCheckOutTime.getTime() - checkInTime.getTime();
          regularWorkingHours = Math.max(0, regularMilliseconds / (1000 * 60 * 60));
          
          const overtimeMilliseconds = now.getTime() - expectedCheckOutTime.getTime();
          actualOvertimeHours = Math.max(0, overtimeMilliseconds / (1000 * 60 * 60));
        } else {
          // Normal checkout or auto checkout - cap at expected checkout time
          const maxAllowedTime = Math.min(now.getTime(), expectedCheckOutTime.getTime());
          const allowedMilliseconds = maxAllowedTime - checkInTime.getTime();
          regularWorkingHours = Math.max(0, allowedMilliseconds / (1000 * 60 * 60));
          actualOvertimeHours = 0;
        }
      }

      // Update attendance record
      const updateData = {
        checkOutTime: now,
        checkOutLatitude: data.latitude,
        checkOutLongitude: data.longitude,
        checkOutImageUrl: data.imageUrl,
        reason: data.reason,
        regularWorkingHours: Math.round(regularWorkingHours * 100) / 100,
        actualOvertimeHours: Math.round(actualOvertimeHours * 100) / 100,
        overtimeHours: Math.round(actualOvertimeHours * 100) / 100,
        otReason: data.otReason,
        lastModifiedAt: now,
        lastModifiedBy: data.userId
      };

      await storage.updateAttendance(data.attendanceId, updateData);

      // Log activity
      await storage.createActivityLog({
        type: 'attendance',
        title: data.isOvertimeCheckout ? 'Overtime Check-out' : 'Check-out',
        description: `User checked out after ${Math.round(totalWorkingHours * 100) / 100} hours${actualOvertimeHours > 0 ? ` (${Math.round(actualOvertimeHours * 100) / 100} overtime hours)` : ''}`,
        entityId: data.attendanceId,
        entityType: 'attendance',
        userId: data.userId
      });

      return {
        success: true,
        message: data.isOvertimeCheckout 
          ? `Overtime check-out successful (${Math.round(actualOvertimeHours * 100) / 100} OT hours)`
          : "Check-out successful",
        overtimeHours: actualOvertimeHours
      };
    } catch (error) {
      console.error("Error processing check-out:", error);
      return { success: false, message: "Failed to process check-out" };
    }
  }

  /**
   * Auto check-out users who forgot to check out
   * Handles two scenarios:
   * 1. Normal auto checkout after 2 hours (records working time up to expected checkout)
   * 2. Final cleanup at 11:55 PM for OT users (records working time up to expected checkout)
   */
  static async processAutoCheckOuts(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get all attendance records for today that are not checked out
      const attendanceRecords = await storage.listAttendanceByDate(today);
      const uncheckedOutRecords = attendanceRecords.filter(record => 
        record.checkInTime && 
        !record.checkOutTime && 
        record.autoCheckOutEnabled &&
        record.autoCheckOutTime &&
        new Date() >= record.autoCheckOutTime
      );

      for (const record of uncheckedOutRecords) {
        try {
          const autoCheckOutTime = record.autoCheckOutTime!;
          const checkInTime = record.checkInTime!;
          const now = new Date();
          
          // Calculate working hours up to EXPECTED checkout time only
          // Never count the grace period or time after expected checkout as working time
          let regularWorkingHours = 0;
          let effectiveCheckOutTime: Date;
          
          if (record.expectedCheckOutTime) {
            const expectedCheckOutTime = record.expectedCheckOutTime;
            const workingMilliseconds = expectedCheckOutTime.getTime() - checkInTime.getTime();
            regularWorkingHours = Math.max(0, workingMilliseconds / (1000 * 60 * 60));
            effectiveCheckOutTime = expectedCheckOutTime; // Always use expected checkout time
          } else {
            // Fallback: 8 hours from check-in
            regularWorkingHours = 8;
            effectiveCheckOutTime = new Date(checkInTime.getTime() + (8 * 60 * 60 * 1000));
          }

          // Determine the reason based on overtime status
          let autoCheckOutReason: string;
          if (record.overtimeEnabled) {
            autoCheckOutReason = "Final automatic checkout at day end (11:55 PM) - OT user forgot to check out";
          } else {
            autoCheckOutReason = "Automatic checkout after 2-hour grace period - user forgot to check out";
          }

          await storage.updateAttendance(record.id, {
            checkOutTime: effectiveCheckOutTime, // CRITICAL: Always use expected checkout time (7:00 PM), never the actual auto-checkout time
            isAutoCheckedOut: true,
            autoCheckOutReason,
            regularWorkingHours: Math.round(regularWorkingHours * 100) / 100,
            actualOvertimeHours: 0, // No overtime for auto checkout (as per requirements)
            overtimeHours: 0, // No overtime for auto checkout
            lastModifiedAt: now,
            lastModifiedBy: "system"
          });

          // Log activity
          await storage.createActivityLog({
            type: 'attendance',
            title: record.overtimeEnabled ? 'Final Auto Check-out (OT)' : 'Auto Check-out',
            description: `${autoCheckOutReason}. Working hours recorded: ${Math.round(regularWorkingHours * 100) / 100} (up to expected checkout time only)`,
            entityId: record.id,
            entityType: 'attendance',
            userId: record.userId
          });

          processed++;
        } catch (error) {
          console.error(`Error auto-checking out user ${record.userId}:`, error);
          errors++;
        }
      }
    } catch (error) {
      console.error("Error in processAutoCheckOuts:", error);
      errors++;
    }

    return { processed, errors };
  }

  /**
   * Schedule auto checkout processing (should be called periodically)
   */
  static startAutoCheckOutScheduler(): void {
    // Run every 15 minutes
    setInterval(async () => {
      const result = await this.processAutoCheckOuts();
      if (result.processed > 0 || result.errors > 0) {
        console.log(`Auto checkout processed: ${result.processed} users, ${result.errors} errors`);
      }
    }, 15 * 60 * 1000);

    // Also run at 11:55 PM daily for final cleanup
    const scheduleEndOfDayCleanup = () => {
      const now = new Date();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 55, 0, 0);
      
      if (now > endOfDay) {
        endOfDay.setDate(endOfDay.getDate() + 1);
      }

      const timeUntilEndOfDay = endOfDay.getTime() - now.getTime();
      
      setTimeout(async () => {
        await this.processAutoCheckOuts();
        scheduleEndOfDayCleanup(); // Schedule for next day
      }, timeUntilEndOfDay);
    };

    scheduleEndOfDayCleanup();
  }
}