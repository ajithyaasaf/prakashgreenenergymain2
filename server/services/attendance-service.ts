/**
 * Enterprise Attendance Service - Microsoft-grade reliability and performance
 * Implements advanced attendance tracking with intelligent geolocation validation
 */

import { EnterpriseGeolocationService, LocationCoordinates } from './geolocation-service';
import { storage } from '../storage';
import { performAutomaticLocationCalibration } from '../utils';

export interface AttendanceCheckInRequest {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  attendanceType: 'office' | 'remote' | 'field';
  reason?: string;
  customerName?: string;
  imageUrl?: string;
}

export interface AttendanceValidationResult {
  isValid: boolean;
  confidence: number;
  message: string;
  recommendations: string[];
  locationDetails: {
    detectedOffice?: string;
    distance?: number;
    accuracy: number;
    source: string;
  };
  securityFlags: {
    isAnomalous: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    reasons: string[];
  };
}

export interface AttendanceMetrics {
  totalCheckIns: number;
  officeCheckIns: number;
  remoteCheckIns: number;
  fieldCheckIns: number;
  averageAccuracy: number;
  anomalousCheckins: number;
  reliabilityScore: number;
}

export class EnterpriseAttendanceService {
  private static readonly SECURITY_AUDIT_THRESHOLD = 3; // Max anomalous check-ins before audit
  private static readonly PERFORMANCE_CACHE_SIZE = 1000; // Cache recent validations
  private static readonly ANALYTICS_BUFFER_SIZE = 100; // Analytics batch size
  
  private static validationCache = new Map<string, AttendanceValidationResult>();
  private static analyticsBuffer: Array<{
    userId: string;
    timestamp: Date;
    result: AttendanceValidationResult;
  }> = [];

  /**
   * Comprehensive attendance validation with enterprise security
   */
  static async validateAttendance(request: AttendanceCheckInRequest): Promise<AttendanceValidationResult> {
    const cacheKey = `${request.userId}-${request.latitude}-${request.longitude}-${Date.now()}`;
    
    // Check cache for recent validation
    const cached = this.validationCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const userLocation: LocationCoordinates = {
      latitude: request.latitude,
      longitude: request.longitude,
      accuracy: request.accuracy,
      timestamp: new Date(),
      source: request.accuracy < 20 ? 'gps' : 'network',
      confidence: 0.8
    };

    // Get office locations
    const officeLocations = await storage.listOfficeLocations();
    const activeOffices = officeLocations.map(office => ({
      id: office.id,
      name: office.name,
      latitude: parseFloat(office.latitude),
      longitude: parseFloat(office.longitude),
      radius: office.radius || 100,
      isActive: true // Assume all office locations are active
    }));

    // Validate location with enterprise geolocation service
    const locationValidation = EnterpriseGeolocationService.validateLocation(
      userLocation,
      activeOffices
    );

    // Detect specific office location
    const officeDetection = EnterpriseGeolocationService.detectOfficeLocation(
      userLocation,
      activeOffices
    );

    // Security anomaly detection
    const userHistory = await this.getUserLocationHistory(request.userId);
    const securityAnalysis = EnterpriseGeolocationService.detectLocationAnomalies(
      userLocation,
      userHistory
    );

    // Generate comprehensive validation result
    const result: AttendanceValidationResult = {
      isValid: this.determineValidation(request, locationValidation, securityAnalysis),
      confidence: Math.min(locationValidation.confidence, 1 - (securityAnalysis.riskLevel === 'high' ? 0.7 : securityAnalysis.riskLevel === 'medium' ? 0.3 : 0)),
      message: this.generateValidationMessage(request, locationValidation, officeDetection, securityAnalysis),
      recommendations: this.generateRecommendations(locationValidation, securityAnalysis),
      locationDetails: {
        detectedOffice: officeDetection.detectedOffice?.name,
        distance: locationValidation.distance,
        accuracy: userLocation.accuracy,
        source: userLocation.source
      },
      securityFlags: {
        isAnomalous: securityAnalysis.isAnomalous,
        riskLevel: securityAnalysis.riskLevel,
        reasons: securityAnalysis.reasons
      }
    };

    // Cache result for performance
    this.validationCache.set(cacheKey, result);
    
    // Add to analytics buffer
    this.analyticsBuffer.push({
      userId: request.userId,
      timestamp: new Date(),
      result
    });

    // Process analytics if buffer is full
    if (this.analyticsBuffer.length >= this.ANALYTICS_BUFFER_SIZE) {
      this.processAnalyticsBatch().catch(console.error);
    }

    return result;
  }

  /**
   * Process attendance check-in with enhanced validation
   */
  static async processCheckIn(request: AttendanceCheckInRequest): Promise<{
    success: boolean;
    attendanceId?: string;
    validation: AttendanceValidationResult;
    autoCalibrationTriggered?: boolean;
  }> {
    // Validate attendance
    const validation = await this.validateAttendance(request);

    // Security check - block high-risk check-ins
    if (validation.securityFlags.riskLevel === 'high') {
      await this.logSecurityEvent(request.userId, validation);
      return {
        success: false,
        validation
      };
    }

    // Check for duplicate check-in
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingAttendance = await storage.getAttendanceByUserAndDate(request.userId, today);
    
    if (existingAttendance) {
      validation.message = "You have already checked in today";
      validation.isValid = false;
      return { success: false, validation };
    }

    // Process based on attendance type
    let autoCalibrationTriggered = false;
    
    if (request.attendanceType === 'office') {
      // Be more lenient for office check-ins with poor indoor GPS
      const isCloseToOffice = validation.locationDetails.distance && validation.locationDetails.distance <= 150;
      const hasReasonableAccuracy = validation.locationDetails.accuracy <= 10000; // 10km max
      
      if (!validation.isValid && validation.confidence < 0.3 && !(isCloseToOffice && hasReasonableAccuracy)) {
        validation.message = "Location verification failed. Please ensure you are within the office premises or try moving closer to a window for better GPS signal.";
        return { success: false, validation };
      }
      
      // Allow check-in with warning for poor GPS but close proximity
      if (!validation.isValid && isCloseToOffice && hasReasonableAccuracy) {
        validation.isValid = true;
        validation.confidence = Math.max(validation.confidence, 0.6);
        validation.message = "Check-in allowed with indoor GPS detection. You appear to be within office premises.";
      }
      
      // Trigger automatic calibration for office check-ins
      if (validation.locationDetails.detectedOffice) {
        const office = await storage.getOfficeLocation(validation.locationDetails.detectedOffice);
        if (office) {
          performAutomaticLocationCalibration(
            request.latitude,
            request.longitude,
            office,
            storage
          ).catch(console.error);
          autoCalibrationTriggered = true;
        }
      }
    }

    // Calculate timing information
    const user = await storage.getUser(request.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const departmentTiming = this.getDepartmentTiming(user.department ?? 'general');
    const checkInTime = new Date();
    const [checkInHour, checkInMinute] = departmentTiming.checkInTime.split(':').map(Number);
    const expectedCheckInTime = new Date(
      checkInTime.getFullYear(),
      checkInTime.getMonth(),
      checkInTime.getDate(),
      checkInHour,
      checkInMinute
    );

    const isLate = checkInTime > expectedCheckInTime;
    const lateMinutes = isLate ? Math.floor((checkInTime.getTime() - expectedCheckInTime.getTime()) / (1000 * 60)) : 0;

    // Create attendance record
    const attendanceData = {
      userId: request.userId,
      date: today,
      checkInTime,
      attendanceType: request.attendanceType,
      reason: request.reason || "",
      checkInLatitude: request.latitude.toString(),
      checkInLongitude: request.longitude.toString(),
      status: isLate ? "late" : "present",
      isLate,
      lateMinutes: isLate ? lateMinutes : 0,
      workingHours: 0,
      breakHours: 0,
      isWithinOfficeRadius: validation.isValid && request.attendanceType === 'office',
      remarks: request.attendanceType === "field" ? `Field work at ${request.customerName || "Unknown"}` : (request.reason || ""),
      // Enhanced metadata
      locationAccuracy: request.accuracy,
      locationSource: validation.locationDetails.source,
      locationConfidence: validation.confidence,
      detectedOffice: validation.locationDetails.detectedOffice,
      securityRiskLevel: validation.securityFlags.riskLevel,
      validationVersion: "enterprise-v1.0"
    };

    // Add optional fields
    if (request.attendanceType === "field" && request.customerName) {
      attendanceData.customerName = request.customerName;
    }
    if (request.imageUrl) {
      attendanceData.checkInImageUrl = request.imageUrl;
    }
    if (validation.locationDetails.distance !== undefined) {
      attendanceData.distanceFromOffice = validation.locationDetails.distance;
    }

    const newAttendance = await storage.createAttendance(attendanceData);

    // Store user location for security analysis
    await this.storeUserLocation(request.userId, {
      latitude: request.latitude,
      longitude: request.longitude,
      accuracy: request.accuracy,
      timestamp: new Date(),
      source: validation.locationDetails.source,
      confidence: validation.confidence
    });

    // Log activity with enhanced metadata
    await storage.createActivityLog({
      type: 'attendance',
      title: `${request.attendanceType === "field" ? "Field Work" : request.attendanceType === "remote" ? "Remote Work" : "Office"} Check-in`,
      description: `${user.displayName} checked in for ${request.attendanceType} work${isLate ? ` (${lateMinutes} minutes late)` : ""} - Confidence: ${Math.round(validation.confidence * 100)}%`,
      entityId: newAttendance.id,
      entityType: 'attendance',
      userId: request.userId
    });

    return {
      success: true,
      attendanceId: newAttendance.id,
      validation,
      autoCalibrationTriggered
    };
  }

  /**
   * Generate comprehensive attendance analytics
   */
  static async generateAttendanceMetrics(userId?: string, dateRange?: { start: Date; end: Date }): Promise<AttendanceMetrics> {
    // Implementation would fetch attendance data and calculate metrics
    // This is a placeholder for the comprehensive analytics system
    return {
      totalCheckIns: 0,
      officeCheckIns: 0,
      remoteCheckIns: 0,
      fieldCheckIns: 0,
      averageAccuracy: 0,
      anomalousCheckins: 0,
      reliabilityScore: 0
    };
  }

  // Private helper methods

  private static determineValidation(
    request: AttendanceCheckInRequest,
    locationValidation: any,
    securityAnalysis: any
  ): boolean {
    if (request.attendanceType === 'office') {
      return locationValidation.isValid && securityAnalysis.riskLevel !== 'high';
    }
    return securityAnalysis.riskLevel !== 'high';
  }

  private static generateValidationMessage(
    request: AttendanceCheckInRequest,
    locationValidation: any,
    officeDetection: any,
    securityAnalysis: any
  ): string {
    if (securityAnalysis.riskLevel === 'high') {
      return "Security validation failed. Please contact your administrator.";
    }

    if (request.attendanceType === 'office') {
      if (officeDetection.detectedOffice) {
        return `Check-in validated at ${officeDetection.detectedOffice.name} - Confidence: ${Math.round(officeDetection.confidence * 100)}%`;
      }
      if (locationValidation.isValid) {
        return "Office location verified successfully";
      }
      return "Unable to verify office location. Please ensure you are within the office premises.";
    }

    return `${request.attendanceType} work check-in validated`;
  }

  private static generateRecommendations(locationValidation: any, securityAnalysis: any): string[] {
    const recommendations = [...(locationValidation.recommendations || [])];
    
    if (securityAnalysis.isAnomalous) {
      recommendations.push("Location pattern unusual - additional verification may be required");
    }
    
    return recommendations;
  }

  private static async getUserLocationHistory(userId: string): Promise<LocationCoordinates[]> {
    // Implementation would fetch recent location history for security analysis
    // This is a placeholder - would integrate with location storage system
    return [];
  }

  private static async storeUserLocation(userId: string, location: LocationCoordinates): Promise<void> {
    // Implementation would store location for security analysis
    // This is a placeholder - would integrate with secure location storage
    EnterpriseGeolocationService.cacheLocation(userId, location);
  }

  private static async logSecurityEvent(userId: string, validation: AttendanceValidationResult): Promise<void> {
    await storage.createActivityLog({
      type: 'attendance',
      title: 'Security Alert - High Risk Check-in Attempt',
      description: `User ${userId} attempted check-in with high security risk: ${validation.securityFlags.reasons.join(', ')}`,
      entityId: userId,
      entityType: 'security',
      userId: userId
    });
  }

  private static async processAnalyticsBatch(): Promise<void> {
    // Process analytics batch for performance monitoring and insights
    const batch = this.analyticsBuffer.splice(0, this.ANALYTICS_BUFFER_SIZE);
    
    // Implementation would send analytics to monitoring system
    console.log(`ENTERPRISE-ANALYTICS: Processed ${batch.length} attendance validations`);
  }

  private static getDepartmentTiming(department: string) {
    const defaultTiming = {
      checkInTime: "09:30",
      checkOutTime: "18:30",
      workingHours: 9,
      overtimeThresholdMinutes: 0,
      lateThresholdMinutes: 15
    };

    const departmentTimings: Record<string, any> = {
      'hr': defaultTiming,
      'cre': defaultTiming,
      'accounts': defaultTiming,
      'sales_and_marketing': defaultTiming,
      'technical_team': defaultTiming
    };

    return departmentTimings[department] || defaultTiming;
  }
}