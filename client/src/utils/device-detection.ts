/**
 * Device Detection Utility for Enterprise Attendance System
 * Detects device type to apply appropriate location validation and UX
 */

export interface DeviceInfo {
  type: 'mobile' | 'tablet' | 'desktop';
  isTouchDevice: boolean;
  platform: string;
  userAgent: string;
  screenWidth: number;
  hasGPS: boolean;
  locationCapability: 'excellent' | 'good' | 'limited' | 'poor';
}

export class DeviceDetection {
  /**
   * Get comprehensive device information
   */
  static getDeviceInfo(): DeviceInfo {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const screenWidth = window.innerWidth;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Detect device type
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad|Android.*Tablet|Windows.*Touch/i.test(userAgent) && screenWidth >= 768;
    
    let deviceType: 'mobile' | 'tablet' | 'desktop';
    if (isMobile && !isTablet && screenWidth < 768) {
      deviceType = 'mobile';
    } else if (isTablet || (isTouchDevice && screenWidth >= 768 && screenWidth <= 1024)) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }
    
    // Determine GPS capability
    const hasGPS = deviceType === 'mobile' || (deviceType === 'tablet' && isMobile);
    
    let locationCapability: 'excellent' | 'good' | 'limited' | 'poor';
    if (deviceType === 'mobile') {
      locationCapability = 'excellent'; // Has GPS hardware
    } else if (deviceType === 'tablet') {
      locationCapability = 'good'; // May have GPS, good WiFi positioning
    } else if (isTouchDevice) {
      locationCapability = 'limited'; // Touch laptop, WiFi positioning
    } else {
      locationCapability = 'poor'; // Desktop, WiFi/IP positioning only
    }
    
    return {
      type: deviceType,
      isTouchDevice,
      platform,
      userAgent,
      screenWidth,
      hasGPS,
      locationCapability
    };
  }
  
  /**
   * Get expected GPS accuracy range for device type
   */
  static getExpectedAccuracy(deviceInfo?: DeviceInfo): { min: number; max: number; typical: number } {
    const device = deviceInfo || this.getDeviceInfo();
    
    switch (device.locationCapability) {
      case 'excellent': // Mobile with GPS
        return { min: 3, max: 20, typical: 10 };
      case 'good': // Tablet with GPS/WiFi
        return { min: 10, max: 50, typical: 25 };
      case 'limited': // Touch laptop with WiFi
        return { min: 50, max: 200, typical: 100 };
      case 'poor': // Desktop with WiFi/IP
        return { min: 100, max: 1000, typical: 300 };
      default:
        return { min: 50, max: 500, typical: 200 };
    }
  }
  
  /**
   * Get appropriate validation radius for device type
   */
  static getValidationRadius(baseRadius: number, deviceInfo?: DeviceInfo): number {
    const device = deviceInfo || this.getDeviceInfo();
    
    switch (device.locationCapability) {
      case 'excellent': // Mobile - strict validation
        return baseRadius;
      case 'good': // Tablet - slightly relaxed
        return baseRadius * 1.5;
      case 'limited': // Touch laptop - relaxed
        return baseRadius * 2.5;
      case 'poor': // Desktop - very relaxed
        return baseRadius * 3.0;
      default:
        return baseRadius * 2.0;
    }
  }
  
  /**
   * Get user-friendly location status message
   */
  static getLocationStatusMessage(accuracy: number, deviceInfo?: DeviceInfo): {
    message: string;
    color: 'success' | 'warning' | 'info' | 'error';
    technical: string;
  } {
    const device = deviceInfo || this.getDeviceInfo();
    const expected = this.getExpectedAccuracy(device);
    
    if (device.type === 'mobile') {
      // Mobile device - show actual GPS accuracy
      if (accuracy <= 10) {
        return {
          message: 'Excellent GPS Signal',
          color: 'success',
          technical: `GPS Accuracy: ${Math.round(accuracy)}m (Excellent)`
        };
      } else if (accuracy <= 50) {
        return {
          message: 'Good GPS Signal',
          color: 'success', 
          technical: `GPS Accuracy: ${Math.round(accuracy)}m (Good)`
        };
      } else if (accuracy <= 200) {
        return {
          message: 'Fair GPS Signal',
          color: 'warning',
          technical: `GPS Accuracy: ${Math.round(accuracy)}m (Fair - Indoor OK)`
        };
      } else {
        return {
          message: 'Poor GPS Signal',
          color: 'error',
          technical: `GPS Accuracy: ${Math.round(accuracy)}m (Poor)`
        };
      }
    } else {
      // Desktop/Laptop - show network-based positioning
      if (accuracy <= expected.typical) {
        return {
          message: 'Office Location Detected',
          color: 'success',
          technical: 'Network Positioning Active'
        };
      } else if (accuracy <= expected.max) {
        return {
          message: 'Location Verified',
          color: 'info',
          technical: 'Using Network Positioning'
        };
      } else {
        return {
          message: 'Location Signal Weak',
          color: 'warning',
          technical: 'Network Positioning Limited'
        };
      }
    }
  }
  
  /**
   * Get device-appropriate recommendations
   */
  static getLocationRecommendations(accuracy: number, deviceInfo?: DeviceInfo): string[] {
    const device = deviceInfo || this.getDeviceInfo();
    const recommendations: string[] = [];
    
    if (device.type === 'mobile') {
      if (accuracy > 100) {
        recommendations.push('Move to an area with better sky visibility');
        recommendations.push('Ensure location services are enabled');
        recommendations.push('Try moving away from tall buildings');
      } else if (accuracy > 50) {
        recommendations.push('GPS signal is fair - move closer to windows if indoors');
      }
    } else {
      // Desktop/Laptop recommendations
      if (accuracy > 500) {
        recommendations.push('Ensure you are connected to office WiFi');
        recommendations.push('Check your network connection');
        recommendations.push('Contact IT support if issues persist');
      } else {
        recommendations.push('Network-based positioning is working normally');
      }
    }
    
    return recommendations;
  }
  
  /**
   * Check if device is likely to have poor GPS indoors
   */
  static isIndoorGPSExpected(deviceInfo?: DeviceInfo): boolean {
    const device = deviceInfo || this.getDeviceInfo();
    return device.type !== 'mobile'; // Non-mobile devices expected to have poor GPS
  }
  
  /**
   * Get validation confidence multiplier based on device
   */
  static getConfidenceMultiplier(accuracy: number, deviceInfo?: DeviceInfo): number {
    const device = deviceInfo || this.getDeviceInfo();
    const expected = this.getExpectedAccuracy(device);
    
    if (accuracy <= expected.typical) {
      return 1.0; // Full confidence
    } else if (accuracy <= expected.max) {
      return 0.8; // Reduced confidence but acceptable
    } else {
      return 0.6; // Low confidence
    }
  }
}

// Export convenience functions
export const getDeviceInfo = () => DeviceDetection.getDeviceInfo();
export const getLocationStatusMessage = (accuracy: number) => DeviceDetection.getLocationStatusMessage(accuracy);
export const getValidationRadius = (baseRadius: number) => DeviceDetection.getValidationRadius(baseRadius);
export const isIndoorGPSExpected = () => DeviceDetection.isIndoorGPSExpected();