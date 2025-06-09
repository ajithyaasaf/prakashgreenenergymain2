/**
 * Enterprise-grade geolocation service with Microsoft-level reliability
 * Implements advanced GPS accuracy, fallback strategies, and location intelligence
 */

import { calculateDistance } from "../utils";

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
  source: 'gps' | 'network' | 'passive';
  confidence: number;
}

export interface LocationValidationResult {
  isValid: boolean;
  confidence: number;
  accuracy: number;
  source: string;
  distance?: number;
  withinRadius?: boolean;
  recommendations?: string[];
}

export interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive: boolean;
}

export class EnterpriseGeolocationService {
  private static readonly GPS_ACCURACY_EXCELLENT = 5; // meters
  private static readonly GPS_ACCURACY_GOOD = 20; // meters
  private static readonly GPS_ACCURACY_FAIR = 100; // meters
  private static readonly GPS_ACCURACY_POOR = 1000; // meters
  
  private static readonly CONFIDENCE_HIGH = 0.9;
  private static readonly CONFIDENCE_MEDIUM = 0.7;
  private static readonly CONFIDENCE_LOW = 0.5;
  
  private static readonly LOCATION_CACHE = new Map<string, LocationCoordinates>();
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Validates location with enterprise-grade accuracy assessment
   */
  static validateLocation(
    userLocation: LocationCoordinates,
    officeLocations: OfficeLocation[]
  ): LocationValidationResult {
    const recommendations: string[] = [];
    
    // Determine location quality and confidence
    const { quality, confidence } = this.assessLocationQuality(userLocation);
    
    // Find closest office location
    let closestOffice: OfficeLocation | null = null;
    let minDistance = Infinity;
    
    for (const office of officeLocations.filter(o => o.isActive)) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        office.latitude,
        office.longitude
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestOffice = office;
      }
    }
    
    if (!closestOffice) {
      return {
        isValid: false,
        confidence: 0,
        accuracy: userLocation.accuracy,
        source: userLocation.source,
        recommendations: ["No office locations configured"]
      };
    }
    
    // Calculate effective radius based on GPS accuracy
    const effectiveRadius = this.calculateEffectiveRadius(
      closestOffice.radius,
      userLocation.accuracy
    );
    
    const withinRadius = minDistance <= effectiveRadius;
    
    // Special case for indoor office environments with poor GPS
    // If distance is very close to office center, be more lenient with accuracy
    const isVeryCloseToOffice = minDistance <= (closestOffice.radius * 1.5);
    const hasReasonableIndoorAccuracy = userLocation.accuracy <= 10000; // 10km max
    
    // Allow check-in if close to office even with poor GPS (common indoors)
    const isValidForOffice = withinRadius || (isVeryCloseToOffice && hasReasonableIndoorAccuracy);
    
    // Generate recommendations based on accuracy
    if (userLocation.accuracy > this.GPS_ACCURACY_POOR) {
      if (isValidForOffice) {
        recommendations.push("GPS accuracy is poor indoors, but you're detected within office area. Check-in allowed.");
      } else {
        recommendations.push("GPS accuracy is very poor. Try moving to an open area or near a window.");
      }
    } else if (userLocation.accuracy > this.GPS_ACCURACY_FAIR) {
      recommendations.push("GPS accuracy is limited indoors. Location detection is optimized for this environment.");
    }
    
    if (!withinRadius && isValidForOffice) {
      recommendations.push("Indoor GPS detection: You're close to the office area. Smart detection enabled for office check-in.");
    }
    
    return {
      isValid: isValidForOffice,
      confidence: isValidForOffice ? Math.max(confidence, 0.6) : confidence,
      accuracy: userLocation.accuracy,
      source: userLocation.source,
      distance: minDistance,
      withinRadius: isValidForOffice,
      recommendations
    };
  }
  
  /**
   * Calculates effective detection radius based on GPS accuracy
   */
  private static calculateEffectiveRadius(baseRadius: number, gpsAccuracy: number): number {
    // For poor GPS accuracy, expand the radius to compensate
    if (gpsAccuracy > this.GPS_ACCURACY_POOR) {
      return baseRadius + (gpsAccuracy * 0.5);
    } else if (gpsAccuracy > this.GPS_ACCURACY_FAIR) {
      return baseRadius + (gpsAccuracy * 0.3);
    } else if (gpsAccuracy > this.GPS_ACCURACY_GOOD) {
      return baseRadius + (gpsAccuracy * 0.2);
    }
    
    return baseRadius;
  }
  
  /**
   * Assesses location quality and assigns confidence score
   */
  private static assessLocationQuality(location: LocationCoordinates): {
    quality: 'excellent' | 'good' | 'fair' | 'poor';
    confidence: number;
  } {
    const { accuracy, source, timestamp } = location;
    
    // Age penalty (locations older than 30 seconds lose confidence)
    const ageMs = Date.now() - timestamp.getTime();
    const agePenalty = Math.min(ageMs / 30000, 0.3); // Max 30% penalty
    
    let baseConfidence: number;
    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    
    if (accuracy <= this.GPS_ACCURACY_EXCELLENT) {
      quality = 'excellent';
      baseConfidence = this.CONFIDENCE_HIGH;
    } else if (accuracy <= this.GPS_ACCURACY_GOOD) {
      quality = 'good';
      baseConfidence = this.CONFIDENCE_HIGH - 0.1;
    } else if (accuracy <= this.GPS_ACCURACY_FAIR) {
      quality = 'fair';
      baseConfidence = this.CONFIDENCE_MEDIUM;
    } else {
      quality = 'poor';
      baseConfidence = this.CONFIDENCE_LOW;
    }
    
    // Source bonus/penalty
    const sourceBonus = source === 'gps' ? 0 : (source === 'network' ? -0.1 : -0.2);
    
    const finalConfidence = Math.max(0.1, baseConfidence + sourceBonus - agePenalty);
    
    return { quality, confidence: finalConfidence };
  }
  
  /**
   * Intelligent office location detection with multi-criteria analysis
   */
  static detectOfficeLocation(
    userLocation: LocationCoordinates,
    officeLocations: OfficeLocation[]
  ): {
    detectedOffice: OfficeLocation | null;
    confidence: number;
    alternativeOffices: Array<{ office: OfficeLocation; distance: number; probability: number }>;
  } {
    const candidates: Array<{
      office: OfficeLocation;
      distance: number;
      probability: number;
    }> = [];
    
    for (const office of officeLocations.filter(o => o.isActive)) {
      const distance = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        office.latitude,
        office.longitude
      );
      
      const effectiveRadius = this.calculateEffectiveRadius(office.radius, userLocation.accuracy);
      
      // Calculate probability based on distance and radius
      let probability = 0;
      if (distance <= office.radius) {
        probability = 1.0;
      } else if (distance <= effectiveRadius) {
        probability = 1.0 - ((distance - office.radius) / (effectiveRadius - office.radius)) * 0.4;
      } else if (distance <= effectiveRadius + 100) {
        probability = 0.3 - ((distance - effectiveRadius) / 100) * 0.3;
      }
      
      if (probability > 0) {
        candidates.push({ office, distance, probability });
      }
    }
    
    // Sort by probability
    candidates.sort((a, b) => b.probability - a.probability);
    
    const detectedOffice = candidates.length > 0 ? candidates[0].office : null;
    const confidence = candidates.length > 0 ? candidates[0].probability : 0;
    const alternativeOffices = candidates.slice(1, 3); // Top 2 alternatives
    
    return {
      detectedOffice,
      confidence,
      alternativeOffices
    };
  }
  
  /**
   * Location caching for performance optimization
   */
  static cacheLocation(userId: string, location: LocationCoordinates): void {
    this.LOCATION_CACHE.set(userId, location);
    
    // Auto-cleanup old cache entries
    setTimeout(() => {
      this.LOCATION_CACHE.delete(userId);
    }, this.CACHE_DURATION);
  }
  
  static getCachedLocation(userId: string): LocationCoordinates | null {
    const cached = this.LOCATION_CACHE.get(userId);
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.CACHE_DURATION) {
      return cached;
    }
    return null;
  }
  
  /**
   * Advanced anomaly detection for location spoofing
   */
  static detectLocationAnomalies(
    currentLocation: LocationCoordinates,
    previousLocations: LocationCoordinates[]
  ): {
    isAnomalous: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    reasons: string[];
  } {
    const reasons: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    
    if (previousLocations.length === 0) {
      return { isAnomalous: false, riskLevel, reasons };
    }
    
    const lastLocation = previousLocations[previousLocations.length - 1];
    const timeDiff = currentLocation.timestamp.getTime() - lastLocation.timestamp.getTime();
    const distance = calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      lastLocation.latitude,
      lastLocation.longitude
    );
    
    // Check for impossible speed (>300 km/h for ground travel)
    if (timeDiff > 0) {
      const speed = (distance / 1000) / (timeDiff / (1000 * 60 * 60)); // km/h
      if (speed > 300) {
        reasons.push(`Impossible travel speed detected: ${speed.toFixed(1)} km/h`);
        riskLevel = 'high';
      } else if (speed > 150) {
        reasons.push(`High travel speed detected: ${speed.toFixed(1)} km/h`);
        riskLevel = 'medium';
      }
    }
    
    // Check for sudden accuracy improvement (potential spoofing)
    if (lastLocation.accuracy > 500 && currentLocation.accuracy < 10) {
      reasons.push("Sudden GPS accuracy improvement detected");
      riskLevel = riskLevel === 'high' ? 'high' : 'medium';
    }
    
    // Check for location pattern anomalies
    if (previousLocations.length >= 3) {
      const recentDistances = previousLocations.slice(-3).map((loc, i) => {
        if (i === 0) return 0;
        return calculateDistance(
          loc.latitude, loc.longitude,
          previousLocations[previousLocations.length - 3 + i - 1].latitude,
          previousLocations[previousLocations.length - 3 + i - 1].longitude
        );
      }).filter(d => d > 0);
      
      const avgDistance = recentDistances.reduce((a, b) => a + b, 0) / recentDistances.length;
      
      if (distance > avgDistance * 10 && distance > 1000) {
        reasons.push("Location pattern anomaly detected");
        riskLevel = riskLevel === 'high' ? 'high' : 'medium';
      }
    }
    
    return {
      isAnomalous: reasons.length > 0,
      riskLevel,
      reasons
    };
  }
}