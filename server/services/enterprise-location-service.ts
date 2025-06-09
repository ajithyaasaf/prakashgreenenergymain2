/**
 * Enterprise Location Recognition Service
 * High-precision geolocation with indoor GPS compensation and smart detection
 */

import { storage } from '../storage';

export interface LocationRequest {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
  userId: string;
}

export interface LocationValidationResult {
  isValid: boolean;
  confidence: number;
  distance: number;
  detectedOffice: {
    id: string;
    name: string;
    distance: number;
  } | null;
  validationType: 'exact' | 'indoor_compensation' | 'proximity_based' | 'failed';
  message: string;
  recommendations: string[];
  metadata: {
    accuracy: number;
    effectiveRadius: number;
    indoorDetection: boolean;
    confidenceFactors: string[];
  };
}

export class EnterpriseLocationService {
  // Precision thresholds for enterprise-grade accuracy
  private static readonly PRECISION_EXCELLENT = 5;   // meters
  private static readonly PRECISION_GOOD = 20;       // meters  
  private static readonly PRECISION_FAIR = 100;      // meters
  private static readonly PRECISION_POOR = 1000;     // meters
  
  // Indoor GPS compensation parameters
  private static readonly INDOOR_ACCURACY_THRESHOLD = 200;     // meters
  private static readonly INDOOR_DISTANCE_MULTIPLIER = 2.5;    // Allow 2.5x base radius indoors
  private static readonly POOR_GPS_THRESHOLD = 1000;          // meters
  private static readonly POOR_GPS_MULTIPLIER = 5.0;          // Allow 5x base radius for very poor GPS

  /**
   * Calculate precise distance between two coordinates using Haversine formula
   */
  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Advanced office detection with smart indoor compensation
   */
  static async validateOfficeLocation(request: LocationRequest): Promise<LocationValidationResult> {
    const officeLocations = await storage.listOfficeLocations();
    
    if (officeLocations.length === 0) {
      return {
        isValid: false,
        confidence: 0,
        distance: 0,
        detectedOffice: null,
        validationType: 'failed',
        message: 'No office locations configured',
        recommendations: ['Contact administrator to configure office locations'],
        metadata: {
          accuracy: request.accuracy,
          effectiveRadius: 0,
          indoorDetection: false,
          confidenceFactors: ['no_office_locations']
        }
      };
    }

    let closestOffice = null;
    let minDistance = Infinity;
    let bestValidation: LocationValidationResult | null = null;

    // Test against all office locations
    for (const office of officeLocations) {
      const distance = this.calculateDistance(
        request.latitude,
        request.longitude,
        parseFloat(office.latitude),
        parseFloat(office.longitude)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestOffice = office;
      }

      // Validate against this specific office
      const validation = this.validateAgainstOffice(request, office, distance);
      if (validation.isValid && (!bestValidation || validation.confidence > bestValidation.confidence)) {
        bestValidation = validation;
      }
    }

    // If we found a valid office, return that validation
    if (bestValidation) {
      return bestValidation;
    }

    // No valid office found, return validation for closest office
    if (closestOffice) {
      return this.validateAgainstOffice(request, closestOffice, minDistance);
    }

    // Fallback case
    return {
      isValid: false,
      confidence: 0,
      distance: minDistance,
      detectedOffice: null,
      validationType: 'failed',
      message: 'Location validation failed',
      recommendations: ['Move closer to office premises', 'Ensure location services are enabled'],
      metadata: {
        accuracy: request.accuracy,
        effectiveRadius: 0,
        indoorDetection: false,
        confidenceFactors: ['no_office_match']
      }
    };
  }

  /**
   * Validate location against a specific office with smart detection
   */
  private static validateAgainstOffice(
    request: LocationRequest, 
    office: any, 
    distance: number
  ): LocationValidationResult {
    const baseRadius = office.radius || 100;
    const confidenceFactors: string[] = [];
    let confidence = 0;
    let validationType: 'exact' | 'indoor_compensation' | 'proximity_based' | 'failed' = 'failed';
    let isValid = false;
    let message = '';
    const recommendations: string[] = [];

    // Determine GPS quality
    const isExcellentGPS = request.accuracy <= this.PRECISION_EXCELLENT;
    const isGoodGPS = request.accuracy <= this.PRECISION_GOOD;
    const isFairGPS = request.accuracy <= this.PRECISION_FAIR;
    const isPoorGPS = request.accuracy <= this.PRECISION_POOR;
    const isVeryPoorGPS = request.accuracy > this.PRECISION_POOR;

    // Base radius validation (exact match)
    if (distance <= baseRadius) {
      isValid = true;
      validationType = 'exact';
      confidence = isExcellentGPS ? 0.95 : isGoodGPS ? 0.9 : isFairGPS ? 0.8 : 0.7;
      message = `Perfect office location match. Distance: ${Math.round(distance)}m`;
      confidenceFactors.push('within_base_radius');
      
      if (isExcellentGPS) confidenceFactors.push('excellent_gps');
      else if (isGoodGPS) confidenceFactors.push('good_gps');
      else if (isFairGPS) confidenceFactors.push('fair_gps');
      else confidenceFactors.push('poor_gps_but_close');
    }
    // Indoor GPS compensation for moderate accuracy
    else if (request.accuracy >= this.INDOOR_ACCURACY_THRESHOLD && distance <= baseRadius * this.INDOOR_DISTANCE_MULTIPLIER) {
      isValid = true;
      validationType = 'indoor_compensation';
      confidence = 0.75;
      message = `Indoor GPS detected. Office location validated with compensation. Distance: ${Math.round(distance)}m`;
      confidenceFactors.push('indoor_gps_compensation');
      recommendations.push('GPS accuracy may be limited indoors - this is normal');
    }
    // Poor GPS compensation for very poor accuracy but reasonable proximity
    else if (isVeryPoorGPS && distance <= baseRadius * this.POOR_GPS_MULTIPLIER) {
      isValid = true;
      validationType = 'proximity_based';
      confidence = 0.6;
      message = `Poor GPS signal detected. Location validated based on proximity. Distance: ${Math.round(distance)}m`;
      confidenceFactors.push('poor_gps_proximity');
      recommendations.push('Try moving to an area with better GPS signal');
      recommendations.push('Consider moving closer to a window if indoors');
    }
    // Close proximity with good GPS (edge case)
    else if (distance <= baseRadius * 1.5 && isGoodGPS) {
      isValid = true;
      validationType = 'proximity_based';
      confidence = 0.65;
      message = `Close proximity to office detected. Distance: ${Math.round(distance)}m`;
      confidenceFactors.push('close_proximity_good_gps');
    }
    // Failed validation
    else {
      isValid = false;
      validationType = 'failed';
      confidence = 0;
      message = `Outside office premises. Distance: ${Math.round(distance)}m (limit: ${baseRadius}m)`;
      
      if (isVeryPoorGPS) {
        recommendations.push('GPS accuracy is very poor - try moving to an open area');
        recommendations.push('Ensure location services are enabled');
        confidenceFactors.push('very_poor_gps');
      } else {
        recommendations.push(`Move closer to office (currently ${Math.round(distance)}m away)`);
        confidenceFactors.push('outside_range');
      }
    }

    // Calculate effective radius used for validation
    let effectiveRadius = baseRadius;
    if (validationType === 'indoor_compensation') {
      effectiveRadius = baseRadius * this.INDOOR_DISTANCE_MULTIPLIER;
    } else if (validationType === 'proximity_based' && isVeryPoorGPS) {
      effectiveRadius = baseRadius * this.POOR_GPS_MULTIPLIER;
    }

    const detectedOffice = isValid ? {
      id: office.id,
      name: office.name,
      distance: Math.round(distance)
    } : null;

    return {
      isValid,
      confidence,
      distance: Math.round(distance),
      detectedOffice,
      validationType,
      message,
      recommendations,
      metadata: {
        accuracy: request.accuracy,
        effectiveRadius: Math.round(effectiveRadius),
        indoorDetection: validationType === 'indoor_compensation',
        confidenceFactors
      }
    };
  }

  /**
   * Log location validation for analytics and security
   */
  static async logLocationValidation(
    userId: string,
    result: LocationValidationResult,
    attendanceType: string
  ): Promise<void> {
    try {
      await storage.createActivityLog({
        type: 'attendance',
        title: `Location Validation - ${result.validationType}`,
        description: `${attendanceType} check-in validation: ${result.message} (Confidence: ${Math.round(result.confidence * 100)}%)`,
        entityId: userId,
        entityType: 'user',
        userId: userId
      });
    } catch (error) {
      console.error('Failed to log location validation:', error);
    }
  }

  /**
   * Get location recommendations based on current GPS state
   */
  static getLocationRecommendations(accuracy: number): string[] {
    const recommendations: string[] = [];
    
    if (accuracy > this.PRECISION_POOR) {
      recommendations.push('GPS accuracy is very poor - try these steps:');
      recommendations.push('• Move to an open area away from buildings');
      recommendations.push('• Restart your location services');
      recommendations.push('• Check if location permissions are granted');
    } else if (accuracy > this.PRECISION_FAIR) {
      recommendations.push('GPS accuracy is limited - try these steps:');
      recommendations.push('• Move closer to a window if indoors');
      recommendations.push('• Wait a moment for GPS to improve');
    } else if (accuracy > this.PRECISION_GOOD) {
      recommendations.push('GPS accuracy is moderate - location detected successfully');
    } else {
      recommendations.push('Excellent GPS accuracy - location precisely detected');
    }
    
    return recommendations;
  }
}