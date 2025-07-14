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
  allowRemoteWork: boolean; // Policy: Allow remote work attendance
  allowFieldWork: boolean; // Policy: Allow field work attendance
  allowEarlyCheckOut: boolean; // Policy: Allow early checkout
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
          checkInTime: this.normalize12HourFormat(timing.checkInTime),
          checkOutTime: this.normalize12HourFormat(timing.checkOutTime),
          workingHours: timing.workingHours || 8,
          lateThresholdMinutes: timing.lateThresholdMinutes || 15,
          overtimeThresholdMinutes: timing.overtimeThresholdMinutes || 0,
          isFlexibleTiming: timing.isFlexibleTiming || false,
          weekendDays: timing.weekendDays || [0, 6],
          allowRemoteWork: timing.allowRemoteWork !== undefined ? timing.allowRemoteWork : true,
          allowFieldWork: timing.allowFieldWork !== undefined ? timing.allowFieldWork : true,
          allowEarlyCheckOut: timing.allowEarlyCheckOut !== undefined ? timing.allowEarlyCheckOut : (department === 'sales'),
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
      // FIXED: Unified overtime calculation - total work time minus department standard hours
      const totalMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
      const departmentStandardMinutes = timing.workingHours * 60;
      
      // Calculate working and overtime hours
      workingHours = Math.max(0, totalMinutes / 60);
      const overtimeMinutes = Math.max(0, totalMinutes - departmentStandardMinutes);
      overtimeHours = Math.max(0, overtimeMinutes / 60);
      
      if (overtimeHours > 0) {
        overtimeStartTime = this.formatTo12Hour(expectedCheckOut);
        console.log(`ENTERPRISE_TIME: OT detected - ${overtimeMinutes} minutes = ${overtimeHours} hours (total work: ${totalMinutes}min, standard: ${departmentStandardMinutes}min)`);
      } else {
        console.log(`ENTERPRISE_TIME: No OT - total work within standard hours`);
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
      console.log(`ENTERPRISE_TIME_SERVICE: Processing timing update for ${timing.department}`);
      console.log('ENTERPRISE_TIME_SERVICE: Input timing object:', timing);
      
      // Normalize 12-hour format for consistent storage
      const checkIn12 = this.normalize12HourFormat(timing.checkInTime);
      const checkOut12 = this.normalize12HourFormat(timing.checkOutTime);
      
      // Calculate working hours automatically if not provided
      const workingHours = timing.workingHours || this.calculate12HourWorkingHours(checkIn12, checkOut12);

      const timingData = {
        department: timing.department,
        checkInTime: checkIn12,
        checkOutTime: checkOut12,
        workingHours,
        lateThresholdMinutes: timing.lateThresholdMinutes || 15,
        overtimeThresholdMinutes: timing.overtimeThresholdMinutes || 0,
        isFlexibleTiming: timing.isFlexibleTiming || false,
        // Always use explicitly provided values, no defaults when updating
        ...(timing.allowRemoteWork !== undefined && { allowRemoteWork: Boolean(timing.allowRemoteWork) }),
        ...(timing.allowFieldWork !== undefined && { allowFieldWork: Boolean(timing.allowFieldWork) }),
        ...(timing.allowEarlyCheckOut !== undefined && { allowEarlyCheckOut: Boolean(timing.allowEarlyCheckOut) }),
        updatedAt: new Date()
      };
      
      console.log('ENTERPRISE_TIME_SERVICE: Policy values being saved:', {
        allowRemoteWork: timingData.allowRemoteWork,
        allowFieldWork: timingData.allowFieldWork, 
        allowEarlyCheckOut: timingData.allowEarlyCheckOut
      });
      console.log('ENTERPRISE_TIME_SERVICE: Final timing data for storage:', timingData);

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
   * REMOVED: 24-hour format conversion (system now uses 12-hour format exclusively)
   * This method is deprecated as all time data is now stored in 12-hour format
   */

  /**
   * Validate and normalize 12-hour time format
   */
  private static normalize12HourFormat(time12: string): string {
    try {
      // Clean and validate input
      if (!time12 || typeof time12 !== 'string') {
        throw new Error(`Invalid input: ${time12}`);
      }
      
      const cleanTime = time12.trim();
      const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
      const match = cleanTime.match(timeRegex);
      
      if (!match) {
        console.error('ENTERPRISE_TIME: Failed to match 12-hour format:', cleanTime);
        throw new Error(`Invalid 12-hour time format: ${cleanTime}`);
      }

      let [, hourStr, minuteStr, period] = match;
      let hours = parseInt(hourStr);
      const minutes = parseInt(minuteStr);

      // Validate parsed values
      if (isNaN(hours) || isNaN(minutes)) {
        throw new Error(`Failed to parse hours/minutes: ${hourStr}/${minuteStr}`);
      }

      if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
        throw new Error(`Invalid time values: hours=${hours}, minutes=${minutes}`);
      }

      // Return normalized 12-hour format
      return `${hours}:${minutes.toString().padStart(2, '0')} ${period.toUpperCase()}`;
    } catch (error) {
      console.error('ENTERPRISE_TIME: Error normalizing 12-hour format:', time12, error);
      // Return a safe fallback
      return "9:00 AM"; // Default to 9:00 AM
    }
  }

  /**
   * Parse 12-hour time string to Date object for today
   */
  private static parseTimeToDate(timeStr: string, baseDate: Date): Date {
    try {
      // Validate and clean the time string first
      if (!timeStr || typeof timeStr !== 'string') {
        console.error('ENTERPRISE_TIME: Invalid timeStr provided:', timeStr);
        throw new Error(`Invalid time string: ${timeStr}`);
      }

      // Handle 12-hour format directly
      const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
      const match = timeStr.trim().match(timeRegex);
      
      if (!match) {
        console.error('ENTERPRISE_TIME: Invalid 12-hour format:', timeStr);
        throw new Error(`Invalid 12-hour time format: ${timeStr}`);
      }
      
      let [, hourStr, minuteStr, period] = match;
      let hours = parseInt(hourStr);
      const minutes = parseInt(minuteStr);
      
      // Validate parsed values
      if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
        throw new Error(`Invalid time values: hours=${hours}, minutes=${minutes}`);
      }
      
      // Convert to 24-hour for Date object
      if (period.toUpperCase() === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period.toUpperCase() === 'AM' && hours === 12) {
        hours = 0;
      }
      
      const date = new Date(baseDate);
      date.setHours(hours, minutes, 0, 0);
      return date;
    } catch (error) {
      console.error('ENTERPRISE_TIME: Error parsing 12-hour time:', timeStr, error);
      // Return reasonable business hours as fallback
      const fallbackDate = new Date(baseDate);
      if (timeStr && (timeStr.toLowerCase().includes('pm') || timeStr.includes('out'))) {
        fallbackDate.setHours(18, 0, 0, 0); // 6:00 PM default checkout
      } else {
        fallbackDate.setHours(9, 0, 0, 0); // 9:00 AM default checkin
      }
      console.log(`ENTERPRISE_TIME: Using fallback time for corrupted data: ${fallbackDate.toISOString()}`);
      return fallbackDate;
    }
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
   * Calculate working hours between two 12-hour times
   */
  private static calculate12HourWorkingHours(checkIn12: string, checkOut12: string): number {
    try {
      const checkInDate = this.parseTimeToDate(checkIn12, new Date());
      const checkOutDate = this.parseTimeToDate(checkOut12, new Date());
      
      // Handle overnight shifts
      if (checkOutDate < checkInDate) {
        checkOutDate.setDate(checkOutDate.getDate() + 1);
      }
      
      const diffMs = checkOutDate.getTime() - checkInDate.getTime();
      return Math.max(0, diffMs / (1000 * 60 * 60)); // Convert to hours
    } catch (error) {
      console.error('Error calculating 12-hour working hours:', error);
      return 8; // Default to 8 hours
    }
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
      allowEarlyCheckOut: department === 'sales' ? true : false,
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

  /**
   * Clear timing cache - useful for forcing fresh data reload
   */
  static clearTimingCache(): void {
    this.timingCache.clear();
    this.cacheExpiry.clear();
    console.log('Enterprise Time Service cache cleared successfully');
  }
}

/**
 * Standalone function for cache clearing (for routes.ts import)
 */
export function clearTimingCache(): void {
  EnterpriseTimeService.clearTimingCache();
}