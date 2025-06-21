/**
 * Unified Enterprise Attendance Service
 * Single source of truth for all attendance operations with advanced location validation
 */

import { storage } from '../storage';
import { EnterpriseLocationService, LocationRequest, LocationValidationResult } from './enterprise-location-service';
import { CloudinaryService } from './cloudinary-service';
import { AutoCheckoutService } from './auto-checkout-service';

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

      // Calculate timing information
      const timingInfo = this.calculateTimingInfo(user);
      
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
      
      // Create attendance record with early login tracking
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
        
        // Early login fields
        isEarlyLogin: timingInfo.isEarlyLogin,
        earlyLoginMinutes: timingInfo.earlyLoginMinutes,
        ...(timingInfo.isEarlyLogin && request.reason && { earlyLoginReason: request.reason }),
        ...(timingInfo.isEarlyLogin && cloudinaryImageUrl && { earlyLoginImageUrl: cloudinaryImageUrl }),
        
        // Early checkout fields (defaults)
        isEarlyCheckout: false,
        earlyCheckoutMinutes: 0,
        
        // Overtime fields (defaults)
        overtimeRequested: false,
        overtimeRequestedAt: undefined,
        overtimeStartTime: undefined,
        overtimeEndTime: undefined,
        
        // Auto checkout fields (defaults)
        isAutoCheckout: false,
        autoCheckoutTime: undefined,
        autoCheckoutReason: undefined,
        
        // System fields
        checkoutType: undefined,
        
        workingHours: 0,
        breakHours: 0,
        isWithinOfficeRadius: locationValidation.isValid && request.attendanceType === 'office',
        remarks: this.generateRemarks(request, locationValidation),
        
        // System tracking
        lastActivityTime: new Date(),
        
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

      // Schedule auto-checkout (2 hours after department checkout time)
      const departmentTiming = this.getDepartmentTiming(user?.department);
      AutoCheckoutService.scheduleAutoCheckout(request.userId, newAttendance.id, departmentTiming.checkOutTime);

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
          actualCheckInTime: new Date().toLocaleTimeString()
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
      const departmentTiming = this.getDepartmentTiming(user?.department || undefined);

      // Calculate working hours and overtime
      const checkOutTime = new Date();
      const checkInTime = attendance.checkInTime ? new Date(attendance.checkInTime) : new Date();
      const workingMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60));
      const workingHours = workingMinutes / 60;

      // Calculate expected working hours (default 8 hours)
      const expectedHours = 8;
      const overtimeHours = Math.max(0, workingHours - expectedHours);

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
   * Calculate timing information for check-in including early login detection
   */
  private static calculateTimingInfo(user: any): {
    isLate: boolean;
    lateMinutes: number;
    isEarlyLogin: boolean;
    earlyLoginMinutes: number;
    expectedCheckInTime: string;
  } {
    const now = new Date();
    const departmentTiming = this.getDepartmentTiming(user?.department);
    const [checkInHour, checkInMinute] = departmentTiming.checkInTime.split(':').map(Number);
    
    const expectedCheckInTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      checkInHour,
      checkInMinute
    );

    const isLate = now > expectedCheckInTime;
    const lateMinutes = isLate ? Math.floor((now.getTime() - expectedCheckInTime.getTime()) / (1000 * 60)) : 0;
    
    const isEarlyLogin = now < expectedCheckInTime;
    const earlyLoginMinutes = isEarlyLogin ? Math.floor((expectedCheckInTime.getTime() - now.getTime()) / (1000 * 60)) : 0;

    return {
      isLate,
      lateMinutes,
      isEarlyLogin,
      earlyLoginMinutes,
      expectedCheckInTime: departmentTiming.checkInTime
    };
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
   * Request overtime for current attendance
   */
  static async requestOvertime(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const attendance = await storage.getAttendanceByUserAndDate(userId, today);

      if (!attendance) {
        return {
          success: false,
          message: 'No check-in record found for today'
        };
      }

      if (attendance.checkOutTime) {
        return {
          success: false,
          message: 'You have already checked out for today'
        };
      }

      if ((attendance as any).overtimeRequested) {
        return {
          success: false,
          message: 'Overtime already requested for today'
        };
      }

      // Get user and department timing
      const user = await storage.getUser(userId);
      const departmentTiming = this.getDepartmentTiming(user?.department as string || 'operations');
      const [checkOutHour, checkOutMinute] = departmentTiming.checkOutTime.split(':').map(Number);
      
      const expectedCheckOutTime = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        checkOutHour,
        checkOutMinute
      );

      const now = new Date();
      
      // Check if it's after official checkout time
      if (now < expectedCheckOutTime) {
        return {
          success: false,
          message: `Overtime can only be requested after ${departmentTiming.checkOutTime}`
        };
      }

      // Update attendance record with overtime request
      await storage.updateAttendance(attendance.id, {
        overtimeRequested: true,
        overtimeRequestedAt: now,
        overtimeStartTime: expectedCheckOutTime,
        lastActivityTime: now
      });

      // Cancel auto-checkout since overtime is requested
      AutoCheckoutService.cancelAutoCheckoutForOvertime(userId);

      // Log activity
      await storage.createActivityLog({
        type: 'attendance',
        title: 'Overtime Requested',
        description: `${user?.displayName} requested overtime starting from ${departmentTiming.checkOutTime}`,
        entityId: attendance.id,
        entityType: 'attendance',
        userId: userId
      });

      return {
        success: true,
        message: 'Overtime request submitted successfully. Auto-checkout has been disabled.'
      };

    } catch (error) {
      console.error('Error requesting overtime:', error);
      return {
        success: false,
        message: 'Failed to request overtime due to system error'
      };
    }
  }

  /**
   * Enhanced checkout with early checkout detection
   */
  static async processEnhancedCheckOut(request: AttendanceCheckOutRequest & { 
    isEarlyCheckout?: boolean; 
    earlyCheckoutReason?: string; 
  }): Promise<AttendanceCheckOutResponse> {
    try {
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

      const user = await storage.getUser(request.userId);
      const departmentTiming = this.getDepartmentTiming((user?.department as string) || 'operations');
      const [checkOutHour, checkOutMinute] = departmentTiming.checkOutTime.split(':').map(Number);
      
      const expectedCheckOutTime = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        checkOutHour,
        checkOutMinute
      );

      const now = new Date();
      const checkInTime = attendance.checkInTime ? new Date(attendance.checkInTime) : new Date();

      // Calculate working hours
      const workingMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / (1000 * 60));
      const workingHours = workingMinutes / 60;

      // Calculate overtime
      let overtimeHours = 0;
      if ((attendance as any).overtimeRequested && now > expectedCheckOutTime) {
        const overtimeMinutes = Math.floor((now.getTime() - expectedCheckOutTime.getTime()) / (1000 * 60));
        overtimeHours = Math.max(0, overtimeMinutes / 60);
      }

      // Detect early checkout
      const isEarlyCheckout = now < expectedCheckOutTime && !(attendance as any).overtimeRequested;
      const earlyCheckoutMinutes = isEarlyCheckout ? 
        Math.floor((expectedCheckOutTime.getTime() - now.getTime()) / (1000 * 60)) : 0;

      // Update attendance record
      const updateData: any = {
        checkOutTime: now,
        checkOutLatitude: request.latitude?.toString(),
        checkOutLongitude: request.longitude?.toString(),
        workingHours,
        overtimeHours,
        otReason: request.otReason || '',
        remarks: request.reason || '',
        isEarlyCheckout,
        earlyCheckoutMinutes,
        earlyCheckoutReason: request.earlyCheckoutReason || '',
        checkoutType: 'manual' as const,
        lastActivityTime: now
      };

      if ((attendance as any).overtimeRequested) {
        updateData.overtimeEndTime = now;
      }

      await storage.updateAttendance(attendance.id, updateData);

      // Log activity
      const activityDescription = `${user?.displayName} checked out after ${workingHours.toFixed(1)} hours${
        overtimeHours > 0 ? ` (${overtimeHours.toFixed(1)}h overtime)` : ''
      }${isEarlyCheckout ? ` (${earlyCheckoutMinutes} minutes early)` : ''}`;

      await storage.createActivityLog({
        type: 'attendance',
        title: 'Check-out',
        description: activityDescription,
        entityId: attendance.id,
        entityType: 'attendance',
        userId: request.userId
      });

      return {
        success: true,
        message: `Check-out successful. Total working time: ${workingHours.toFixed(1)} hours${
          overtimeHours > 0 ? ` (${overtimeHours.toFixed(1)}h overtime)` : ''
        }${isEarlyCheckout ? ` (Early checkout detected)` : ''}`,
        workingHours: Number(workingHours.toFixed(2)),
        overtimeHours: Number(overtimeHours.toFixed(2)),
        totalHours: Number(workingHours.toFixed(2))
      };

    } catch (error) {
      console.error('Error processing enhanced check-out:', error);
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
   * Generate comprehensive attendance metrics for analytics
   */
  static async generateAttendanceMetrics(userId: string, dateRange?: { start: Date; end: Date }) {
    try {
      const attendanceRecord = await storage.getAttendance(userId);
      if (!attendanceRecord) {
        return {
          totalDays: 0,
          totalWorkingHours: 0,
          totalOvertimeHours: 0,
          lateArrivals: 0,
          averageHoursPerDay: 0,
          overtimeRate: 0
        };
      }

      // For single record, convert to array for processing
      const attendanceRecords = [attendanceRecord];
      
      // Filter by date range if provided
      const filteredRecords = dateRange 
        ? attendanceRecords.filter((record: any) => {
            const checkInDate = new Date(record.checkInTime);
            return checkInDate >= dateRange.start && checkInDate <= dateRange.end;
          })
        : attendanceRecords;

      const totalDays = filteredRecords.length;
      const totalWorkingHours = filteredRecords.reduce((sum: any, record: any) => sum + (record.workingHours || 0), 0);
      const totalOvertimeHours = filteredRecords.reduce((sum: any, record: any) => sum + (record.overtimeHours || 0), 0);
      const lateArrivals = filteredRecords.filter((record: any) => record.isLate).length;
      
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
   * Get department-specific timing configuration
   */
  private static getDepartmentTiming(department?: string): {
    checkInTime: string;
    checkOutTime: string;
    workingHours: number;
  } {
    // Default timing - can be made configurable per department
    return {
      checkInTime: '09:30',
      checkOutTime: '18:30',
      workingHours: 8
    };
  }
}