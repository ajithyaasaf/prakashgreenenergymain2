/**
 * Enterprise Time Management Service
 * Google-level approach for department-based time tracking and OT calculation
 * Handles all time operations in 12-hour format with real-time synchronization
 */

import { storage } from '../storage';

export interface DepartmentTiming {
  department: string;
  checkInTime: string; // 12-hour format "9:00 AM"
  checkOutTime: string; // 12-hour format "6:00 PM"
  workingHours: number; // Calculated working hours
  lateThresholdMinutes: number;
  overtimeThresholdMinutes: number;
  isFlexibleTiming: boolean;
  weekendDays: number[]; // 0=Sunday, 6=Saturday
  isActive: boolean;
  lastUpdated: Date;
}

export interface TimeCalculationResult {
  isLate: boolean;
  lateMinutes: number;
  workingHours: number;
  overtimeHours: number;
  expectedCheckInTime: string;
  expectedCheckOutTime: string;
  actualCheckInTime: string;
  actualCheckOutTime?: string;
  overtimeStartTime?: string;
}

export class EnterpriseTimeService {
  
  // Cache for department timings to reduce database calls
  private static timingCache = new Map<string, DepartmentTiming>();
  private static cacheExpiry = new Map<string, number>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get department timing with intelligent caching
   */
  static async getDepartmentTiming(department: string): Promise<DepartmentTiming> {
    const cacheKey = department.toLowerCase();
    const now = Date.now();
    
    // Check cache first
    if (this.timingCache.has(cacheKey) && 
        this.cacheExpiry.has(cacheKey) && 
        this.cacheExpiry.get(cacheKey)! > now) {
      return this.timingCache.get(cacheKey)!;
    }

    try {
      // Fetch from database
      const timing = await storage.getDepartmentTiming(department);
      
      if (timing) {
        const departmentTiming: DepartmentTiming = {
          department: timing.department,
          checkInTime: this.convertTo12Hour(timing.checkInTime),
          checkOutTime: this.convertTo12Hour(timing.checkOutTime),
          workingHours: timing.workingHours || 8,
          lateThresholdMinutes: timing.lateThresholdMinutes || 15,
          overtimeThresholdMinutes: timing.overtimeThresholdMinutes || 0,
          isFlexibleTiming: timing.isFlexibleTiming || false,
          weekendDays: timing.weekendDays || [0, 6],
          allowRemoteWork: timing.allowRemoteWork !== undefined ? timing.allowRemoteWork : true,
          allowFieldWork: timing.allowFieldWork !== undefined ? timing.allowFieldWork : true,
          allowEarlyCheckOut: timing.allowEarlyCheckOut !== undefined ? timing.allowEarlyCheckOut : false,
          isActive: timing.isActive !== false,
          lastUpdated: timing.updatedAt || new Date()
        };

        // Cache the result
        this.timingCache.set(cacheKey, departmentTiming);
        this.cacheExpiry.set(cacheKey, now + this.CACHE_DURATION);
        
        return departmentTiming;
      }
    } catch (error) {
      console.error(`Error fetching timing for department ${department}:`, error);
    }

    // Return default timing if not found
    return this.getDefaultTiming(department);
  }

  /**
   * Calculate comprehensive time metrics for attendance
   */
  static async calculateTimeMetrics(
    userId: string,
    department: string,
    checkInTime: Date,
    checkOutTime?: Date
  ): Promise<TimeCalculationResult> {
    const timing = await this.getDepartmentTiming(department);
    const today = new Date(checkInTime);
    
    // Calculate expected times for today
    const expectedCheckIn = this.parseTimeToDate(timing.checkInTime, today);
    const expectedCheckOut = this.parseTimeToDate(timing.checkOutTime, today);
    
    // Calculate if late
    const isLate = checkInTime > expectedCheckIn;
    const lateMinutes = isLate ? 
      Math.floor((checkInTime.getTime() - expectedCheckIn.getTime()) / (1000 * 60)) : 0;

    let workingHours = 0;
    let overtimeHours = 0;
    let overtimeStartTime: string | undefined;

    if (checkOutTime) {
      // Calculate total working time
      const totalMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
      workingHours = totalMinutes / 60;

      // Google-level OT calculation: Any work beyond scheduled checkout time
      if (checkOutTime > expectedCheckOut) {
        const overtimeMinutes = Math.floor((checkOutTime.getTime() - expectedCheckOut.getTime()) / (1000 * 60));
        overtimeHours = overtimeMinutes / 60;
        overtimeStartTime = this.formatTo12Hour(expectedCheckOut);
      }
    }

    return {
      isLate,
      lateMinutes,
      workingHours: Number(workingHours.toFixed(2)),
      overtimeHours: Number(overtimeHours.toFixed(2)),
      expectedCheckInTime: timing.checkInTime,
      expectedCheckOutTime: timing.checkOutTime,
      actualCheckInTime: this.formatTo12Hour(checkInTime),
      actualCheckOutTime: checkOutTime ? this.formatTo12Hour(checkOutTime) : undefined,
      overtimeStartTime
    };
  }

  /**
   * Real-time timing updates - invalidate cache when department timing changes
   */
  static invalidateTimingCache(department?: string): void {
    if (department) {
      // CRITICAL FIX: Use consistent cache key format
      const cacheKey = department.toLowerCase();
      this.timingCache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
      console.log(`Invalidated timing cache for department: ${department}`);
    } else {
      // Clear all cache
      this.timingCache.clear();
      this.cacheExpiry.clear();
      console.log('Invalidated all timing cache');
    }
  }

  /**
   * Clear timing cache for a specific department (alias for invalidateTimingCache)
   */
  static clearDepartmentCache(department: string): void {
    this.invalidateTimingCache(department);
  }

  /**
   * Bulk timing updates for multiple departments
   */
  static async updateDepartmentTimings(timings: Array<{
    department: string;
    checkInTime: string; // 12-hour format
    checkOutTime: string; // 12-hour format
    workingHours?: number;
    lateThresholdMinutes?: number;
    overtimeThresholdMinutes?: number;
    isFlexibleTiming?: boolean;
    allowRemoteWork?: boolean;
    allowFieldWork?: boolean;
    allowEarlyCheckOut?: boolean;
  }>): Promise<void> {
    const updatePromises = timings.map(async (timing) => {
      // Convert 12-hour to 24-hour for database storage
      const checkIn24 = this.convertTo24Hour(timing.checkInTime);
      const checkOut24 = this.convertTo24Hour(timing.checkOutTime);
      
      // Calculate working hours automatically if not provided
      const workingHours = timing.workingHours || this.calculateWorkingHours(checkIn24, checkOut24);

      const timingData = {
        department: timing.department,
        checkInTime: checkIn24,
        checkOutTime: checkOut24,
        workingHours,
        lateThresholdMinutes: timing.lateThresholdMinutes || 15,
        overtimeThresholdMinutes: timing.overtimeThresholdMinutes || 0,
        isFlexibleTiming: timing.isFlexibleTiming || false,
        allowRemoteWork: timing.allowRemoteWork !== undefined ? timing.allowRemoteWork : true,
        allowFieldWork: timing.allowFieldWork !== undefined ? timing.allowFieldWork : true,
        allowEarlyCheckOut: timing.allowEarlyCheckOut !== undefined ? timing.allowEarlyCheckOut : false,
        updatedAt: new Date()
      };

      await storage.updateDepartmentTiming(timing.department, timingData);
      
      // Invalidate cache for this department
      this.invalidateTimingCache(timing.department);
    });

    await Promise.all(updatePromises);
    console.log(`Updated timings for ${timings.length} departments`);
  }

  /**
   * Get all active department timings (for management dashboard)
   */
  static async getAllDepartmentTimings(): Promise<DepartmentTiming[]> {
    const departments = ['operations', 'admin', 'hr', 'marketing', 'sales', 'technical', 'housekeeping'];
    
    const timingPromises = departments.map(dept => this.getDepartmentTiming(dept));
    const timings = await Promise.all(timingPromises);
    
    return timings.filter(timing => timing.isActive);
  }

  /**
   * Convert 24-hour time to 12-hour format
   */
  private static convertTo12Hour(time24: string): string {
    try {
      const [hours, minutes] = time24.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (error) {
      console.error('Error converting to 12-hour format:', time24, error);
      return time24; // Return original if conversion fails
    }
  }

  /**
   * Convert 12-hour time to 24-hour format
   */
  private static convertTo24Hour(time12: string): string {
    try {
      const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
      const match = time12.match(timeRegex);
      
      if (!match) {
        throw new Error(`Invalid 12-hour time format: ${time12}`);
      }

      let [, hourStr, minuteStr, period] = match;
      let hours = parseInt(hourStr);
      const minutes = parseInt(minuteStr);

      if (period.toUpperCase() === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period.toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
      }

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error('Error converting to 24-hour format:', time12, error);
      return time12; // Return original if conversion fails
    }
  }

  /**
   * Parse time string to Date object for today
   */
  private static parseTimeToDate(timeStr: string, baseDate: Date): Date {
    const time24 = timeStr.includes('AM') || timeStr.includes('PM') ? 
      this.convertTo24Hour(timeStr) : timeStr;
    
    const [hours, minutes] = time24.split(':').map(Number);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  /**
   * Format Date to 12-hour time string
   */
  private static formatTo12Hour(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Calculate working hours between two 24-hour times
   */
  private static calculateWorkingHours(checkIn24: string, checkOut24: string): number {
    const [checkInHour, checkInMin] = checkIn24.split(':').map(Number);
    const [checkOutHour, checkOutMin] = checkOut24.split(':').map(Number);
    
    const checkInMinutes = checkInHour * 60 + checkInMin;
    const checkOutMinutes = checkOutHour * 60 + checkOutMin;
    
    return (checkOutMinutes - checkInMinutes) / 60;
  }

  /**
   * Get default timing for department
   */
  private static getDefaultTiming(department: string): DepartmentTiming {
    return {
      department,
      checkInTime: '9:00 AM',
      checkOutTime: '6:00 PM',
      workingHours: 8,
      lateThresholdMinutes: 15,
      overtimeThresholdMinutes: 0,
      isFlexibleTiming: false,
      weekendDays: [0, 6],
      allowRemoteWork: true,
      allowFieldWork: true,
      allowEarlyCheckOut: false,
      isActive: true,
      lastUpdated: new Date()
    };
  }

  /**
   * Validate if time is in business hours
   */
  static async isBusinessHours(department: string, currentTime: Date = new Date()): Promise<boolean> {
    const timing = await this.getDepartmentTiming(department);
    const todayCheckIn = this.parseTimeToDate(timing.checkInTime, currentTime);
    const todayCheckOut = this.parseTimeToDate(timing.checkOutTime, currentTime);
    
    return currentTime >= todayCheckIn && currentTime <= todayCheckOut;
  }

  /**
   * Get next business day timing
   */
  static async getNextBusinessDay(department: string, fromDate: Date = new Date()): Promise<Date> {
    const timing = await this.getDepartmentTiming(department);
    let nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    // Skip weekends
    while (timing.weekendDays.includes(nextDate.getDay())) {
      nextDate.setDate(nextDate.getDate() + 1);
    }
    
    return this.parseTimeToDate(timing.checkInTime, nextDate);
  }
}