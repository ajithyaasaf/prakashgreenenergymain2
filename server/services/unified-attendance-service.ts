/**
 * Unified Enterprise Attendance Service
 * Single source of truth for all attendance operations with advanced location validation
 */

import { storage } from '../storage';
import { EnterpriseLocationService, LocationRequest, LocationValidationResult } from './enterprise-location-service';
import { CloudinaryService } from './cloudinary-service';

export interface AttendanceCheckInRequest {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  attendanceType: 'office' | 'remote' | 'field_work';
  reason?: string;
  customerName?: string;
  imageUrl?: string;
  deviceInfo?: {
    type: 'mobile' | 'tablet' | 'desktop';
    userAgent?: string;
    locationCapability: 'excellent' | 'good' | 'limited' | 'poor';
  };
}

export interface AttendanceCheckInResponse {
  success: boolean;
  attendanceId?: string;
  message: string;
  locationValidation: LocationValidationResult;
  attendanceDetails?: {
    isLate: boolean;
    lateMinutes: number;
    expectedCheckInTime: string;
    actualCheckInTime: string;
  };
  recommendations?: string[];
}

export interface AttendanceCheckOutRequest {
  userId: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  reason?: string;
  otReason?: string;
  imageUrl?: string;
}

export interface AttendanceCheckOutResponse {
  success: boolean;
  message: string;
  workingHours: number;
  overtimeHours: number;
  totalHours: number;
}

export class UnifiedAttendanceService {
  
  /**
   * Process attendance check-in with enterprise location validation
   */
  static async processCheckIn(request: AttendanceCheckInRequest): Promise<AttendanceCheckInResponse> {
    try {
      // Validate user exists
      const user = await storage.getUser(request.userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
          locationValidation: {
            isValid: false,
            confidence: 0,
            distance: 0,
            detectedOffice: null,
            validationType: 'failed',
            message: 'User validation failed',
            recommendations: ['Contact system administrator'],
            metadata: {
              accuracy: request.accuracy,
              effectiveRadius: 0,
              indoorDetection: false,
              confidenceFactors: ['user_not_found']
            }
          }
        };
      }

      // Check for duplicate check-in
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const existingAttendance = await storage.getAttendanceByUserAndDate(request.userId, today);
      
      if (existingAttendance) {
        return {
          success: false,
          message: 'You have already checked in today',
          locationValidation: {
            isValid: false,
            confidence: 0,
            distance: 0,
            detectedOffice: null,
            validationType: 'failed',
            message: 'Duplicate check-in attempt',
            recommendations: ['You can only check in once per day'],
            metadata: {
              accuracy: request.accuracy,
              effectiveRadius: 0,
              indoorDetection: false,
              confidenceFactors: ['duplicate_checkin']
            }
          }
        };
      }

      // Validate location using enterprise location service with device-aware validation
      const locationRequest: LocationRequest = {
        latitude: request.latitude,
        longitude: request.longitude,
        accuracy: request.accuracy,
        timestamp: new Date(),
        userId: request.userId,
        deviceInfo: request.deviceInfo
      };

      const locationValidation = await EnterpriseLocationService.validateOfficeLocation(locationRequest);

      // Apply business rules based on attendance type
      const businessValidation = this.validateBusinessRules(request, locationValidation);
      if (!businessValidation.isValid) {
        return {
          success: false,
          message: businessValidation.message,
          locationValidation,
          recommendations: businessValidation.recommendations
        };
      }

      // Calculate timing information using Enterprise Time Service
      const timingInfo = await this.calculateTimingInfo(user, new Date());
      
      // Handle photo upload to Cloudinary if provided
      let cloudinaryImageUrl = request.imageUrl;
      if (request.imageUrl && request.imageUrl.startsWith('data:')) {
        console.log('ATTENDANCE: Uploading photo to Cloudinary for user:', request.userId);
        const uploadResult = await CloudinaryService.uploadAttendancePhoto(
          request.imageUrl,
          request.userId,
          new Date()
        );
        
        if (uploadResult.success) {
          cloudinaryImageUrl = uploadResult.url;
          console.log('ATTENDANCE: Photo uploaded successfully:', uploadResult.url);
        } else {
          console.error('ATTENDANCE: Photo upload failed:', uploadResult.error);
          // Continue without failing the check-in - photo upload is not critical
        }
      }
      
      // Create attendance record
      const attendanceData = {
        userId: request.userId,
        date: today,
        checkInTime: new Date(),
        attendanceType: request.attendanceType,
        reason: request.reason || '',
        checkInLatitude: request.latitude.toString(),
        checkInLongitude: request.longitude.toString(),
        status: (timingInfo.isLate ? 'late' : 'present') as 'late' | 'present',
        isLate: timingInfo.isLate,
        lateMinutes: timingInfo.lateMinutes,
        workingHours: 0,
        breakHours: 0,
        isWithinOfficeRadius: locationValidation.isValid && request.attendanceType === 'office',
        remarks: this.generateRemarks(request, locationValidation),
        
        // Enhanced metadata for enterprise tracking
        locationAccuracy: request.accuracy,
        locationValidationType: locationValidation.validationType,
        locationConfidence: locationValidation.confidence,
        detectedOfficeId: locationValidation.detectedOffice?.id,
        distanceFromOffice: locationValidation.distance,
        
        // Optional fields
        ...(request.customerName && { customerName: request.customerName }),
        ...(cloudinaryImageUrl && { checkInImageUrl: cloudinaryImageUrl })
      };

      const newAttendance = await storage.createAttendance(attendanceData);

      // Log location validation for security and analytics
      await EnterpriseLocationService.logLocationValidation(
        request.userId,
        locationValidation,
        request.attendanceType
      );

      // Create activity log
      await storage.createActivityLog({
        type: 'attendance',
        title: `${this.getAttendanceTypeDisplay(request.attendanceType)} Check-in`,
        description: `${user.displayName} checked in for ${request.attendanceType} work${timingInfo.isLate ? ` (${timingInfo.lateMinutes} minutes late)` : ''} - Location confidence: ${Math.round(locationValidation.confidence * 100)}%`,
        entityId: newAttendance.id,
        entityType: 'attendance',
        userId: request.userId
      });

      return {
        success: true,
        attendanceId: newAttendance.id,
        message: `Check-in successful for ${this.getAttendanceTypeDisplay(request.attendanceType)} work${timingInfo.isLate ? ` (${timingInfo.lateMinutes} minutes late)` : ''}`,
        locationValidation,
        attendanceDetails: {
          isLate: timingInfo.isLate,
          lateMinutes: timingInfo.lateMinutes,
          expectedCheckInTime: timingInfo.expectedCheckInTime,
          actualCheckInTime: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        },
        recommendations: locationValidation.recommendations
      };

    } catch (error) {
      console.error('Error processing check-in:', error);
      return {
        success: false,
        message: 'Failed to process check-in due to system error',
        locationValidation: {
          isValid: false,
          confidence: 0,
          distance: 0,
          detectedOffice: null,
          validationType: 'failed',
          message: 'System error during validation',
          recommendations: ['Please try again or contact support'],
          metadata: {
            accuracy: request.accuracy,
            effectiveRadius: 0,
            indoorDetection: false,
            confidenceFactors: ['system_error']
          }
        }
      };
    }
  }

  /**
   * Process attendance check-out with overtime calculation
   */
  static async processCheckOut(request: AttendanceCheckOutRequest): Promise<AttendanceCheckOutResponse> {
    try {
      // Find today's attendance record
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attendance = await storage.getAttendanceByUserAndDate(request.userId, today);

      if (!attendance) {
        return {
          success: false,
          message: 'No check-in record found for today',
          workingHours: 0,
          overtimeHours: 0,
          totalHours: 0
        };
      }

      if (attendance.checkOutTime) {
        return {
          success: false,
          message: 'You have already checked out for today',
          workingHours: 0,
          overtimeHours: 0,
          totalHours: 0
        };
      }

      // Get user for department timing
      const user = await storage.getUser(request.userId);
      const { EnterpriseTimeService } = await import('./enterprise-time-service');
      
      // Calculate comprehensive time metrics using Enterprise Time Service
      const checkOutTime = new Date();
      const checkInTime = attendance.checkInTime ? new Date(attendance.checkInTime) : new Date();
      
      const timeMetrics = await EnterpriseTimeService.calculateTimeMetrics(
        request.userId,
        user?.department || 'operations',
        checkInTime,
        checkOutTime
      );
      
      const { workingHours, overtimeHours } = timeMetrics;

      // Update attendance record
      const updatedAttendance = await storage.updateAttendance(attendance.id, {
        checkOutTime,
        checkOutLatitude: request.latitude?.toString(),
        checkOutLongitude: request.longitude?.toString(),
        workingHours,
        overtimeHours,
        otReason: request.otReason || '',
        remarks: request.reason || ''
      });

      // Log activity
      await storage.createActivityLog({
        type: 'attendance',
        title: 'Check-out',
        description: `${user?.displayName} checked out after ${workingHours.toFixed(1)} hours${overtimeHours > 0 ? ` (${overtimeHours.toFixed(1)}h overtime)` : ''}`,
        entityId: attendance.id,
        entityType: 'attendance',
        userId: request.userId
      });

      return {
        success: true,
        message: `Check-out successful. Total working time: ${workingHours.toFixed(1)} hours${overtimeHours > 0 ? ` (${overtimeHours.toFixed(1)}h overtime)` : ''}`,
        workingHours: Number(workingHours.toFixed(2)),
        overtimeHours: Number(overtimeHours.toFixed(2)),
        totalHours: Number(workingHours.toFixed(2))
      };

    } catch (error) {
      console.error('Error processing check-out:', error);
      return {
        success: false,
        message: 'Failed to process check-out due to system error',
        workingHours: 0,
        overtimeHours: 0,
        totalHours: 0
      };
    }
  }

  /**
   * Validate business rules for attendance check-in
   */
  private static validateBusinessRules(
    request: AttendanceCheckInRequest,
    locationValidation: LocationValidationResult
  ): { isValid: boolean; message: string; recommendations: string[] } {
    const recommendations: string[] = [];

    // Office attendance validation
    if (request.attendanceType === 'office') {
      if (!locationValidation.isValid) {
        return {
          isValid: false,
          message: `Office check-in failed: ${locationValidation.message}`,
          recommendations: [
            ...locationValidation.recommendations,
            'Consider using "Remote Work" if you are working from outside office'
          ]
        };
      }
    }

    // Field work validation
    if (request.attendanceType === 'field_work') {
      if (!request.customerName) {
        return {
          isValid: false,
          message: 'Customer name is required for field work',
          recommendations: ['Please enter the customer name you are visiting']
        };
      }
      if (!request.imageUrl) {
        return {
          isValid: false,
          message: 'Photo is mandatory for field work check-in',
          recommendations: ['Please capture a photo to verify your field work location']
        };
      }
    }

    // Remote work validation
    if (request.attendanceType === 'remote') {
      if (!request.reason) {
        return {
          isValid: false,
          message: 'Reason is required for remote work',
          recommendations: ['Please provide a reason for working remotely today']
        };
      }
    }

    return { isValid: true, message: 'Validation successful', recommendations };
  }

  /**
   * Calculate timing information for check-in using Enterprise Time Service
   */
  private static async calculateTimingInfo(user: any, checkInTime: Date = new Date()): Promise<{
    isLate: boolean;
    lateMinutes: number;
    expectedCheckInTime: string;
  }> {
    const { EnterpriseTimeService } = await import('./enterprise-time-service');
    
    const department = user?.department || 'operations';
    const timing = await EnterpriseTimeService.getDepartmentTiming(department);
    
    // Parse expected check-in time for today
    const today = new Date(checkInTime);
    const expectedTime = this.parseTime12ToDate(timing.checkInTime, today);
    
    const isLate = checkInTime > expectedTime;
    const lateMinutes = isLate ? 
      Math.floor((checkInTime.getTime() - expectedTime.getTime()) / (1000 * 60)) : 0;

    return {
      isLate,
      lateMinutes,
      expectedCheckInTime: timing.checkInTime
    };
  }

  /**
   * Parse 12-hour time string to Date object
   */
  private static parseTime12ToDate(timeStr: string, baseDate: Date): Date {
    const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    const match = timeStr.match(timeRegex);
    
    if (!match) {
      console.error('Invalid time format:', timeStr);
      return baseDate;
    }

    let [, hourStr, minuteStr, period] = match;
    let hours = parseInt(hourStr);
    const minutes = parseInt(minuteStr);

    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }

    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  /**
   * Generate appropriate remarks for attendance record
   */
  private static generateRemarks(
    request: AttendanceCheckInRequest,
    locationValidation: LocationValidationResult
  ): string {
    const parts: string[] = [];

    if (request.attendanceType === 'field_work' && request.customerName) {
      parts.push(`Field work at ${request.customerName}`);
    }

    if (request.reason) {
      parts.push(request.reason);
    }

    if (locationValidation.validationType === 'indoor_compensation') {
      parts.push('Indoor GPS detection');
    } else if (locationValidation.validationType === 'proximity_based') {
      parts.push('Proximity-based location validation');
    }

    if (locationValidation.detectedOffice) {
      parts.push(`Office: ${locationValidation.detectedOffice.name}`);
    }

    return parts.join(' | ') || 'Standard check-in';
  }

  /**
   * Get display name for attendance type
   */
  private static getAttendanceTypeDisplay(type: string): string {
    switch (type) {
      case 'office': return 'Office';
      case 'remote': return 'Remote Work';
      case 'field_work': return 'Field Work';
      default: return 'Unknown';
    }
  }

  /**
   * Generate comprehensive attendance metrics for analytics with Enterprise Time Service
   */
  static async generateAttendanceMetrics(userId: string, dateRange?: { start: Date; end: Date }) {
    try {
      const attendanceRecords = await storage.getAttendance(userId);
      
      // Filter by date range if provided
      const filteredRecords = dateRange 
        ? attendanceRecords.filter(record => {
            const checkInDate = new Date(record.checkInTime);
            return checkInDate >= dateRange.start && checkInDate <= dateRange.end;
          })
        : attendanceRecords;

      const totalDays = filteredRecords.length;
      const totalWorkingHours = filteredRecords.reduce((sum, record) => sum + (record.workingHours || 0), 0);
      const totalOvertimeHours = filteredRecords.reduce((sum, record) => sum + (record.overtimeHours || 0), 0);
      const lateArrivals = filteredRecords.filter(record => record.isLate).length;
      
      return {
        totalDays,
        totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
        totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
        averageWorkingHours: totalDays > 0 ? Math.round((totalWorkingHours / totalDays) * 100) / 100 : 0,
        lateArrivals,
        punctualityRate: totalDays > 0 ? Math.round(((totalDays - lateArrivals) / totalDays) * 100) : 100,
        records: filteredRecords
      };
    } catch (error) {
      console.error('Error generating attendance metrics:', error);
      return {
        totalDays: 0,
        totalWorkingHours: 0,
        totalOvertimeHours: 0,
        averageWorkingHours: 0,
        lateArrivals: 0,
        punctualityRate: 100,
        records: []
      };
    }
  }

  /**
   * Get department-specific timing configuration (DEPRECATED)
   * @deprecated Use EnterpriseTimeService.getDepartmentTiming() instead
   */
  private static getDepartmentTiming(department?: string): {
    checkInTime: string;
    checkOutTime: string;
    workingHours: number;
  } {
    console.warn('DEPRECATED: Using legacy getDepartmentTiming - migrate to EnterpriseTimeService');
    
    // Legacy fallback with 12-hour format
    const defaultTimings = {
      'operations': { checkInTime: '9:00 AM', checkOutTime: '6:00 PM', workingHours: 8 },
      'admin': { checkInTime: '9:30 AM', checkOutTime: '6:30 PM', workingHours: 8 },
      'hr': { checkInTime: '9:30 AM', checkOutTime: '6:30 PM', workingHours: 8 },
      'marketing': { checkInTime: '10:00 AM', checkOutTime: '7:00 PM', workingHours: 8 },
      'sales': { checkInTime: '9:00 AM', checkOutTime: '6:00 PM', workingHours: 8 },
      'technical': { checkInTime: '9:00 AM', checkOutTime: '6:00 PM', workingHours: 8 },
      'housekeeping': { checkInTime: '8:00 AM', checkOutTime: '5:00 PM', workingHours: 8 }
    };

    return defaultTimings[department as keyof typeof defaultTimings] || defaultTimings.operations;
  }
}