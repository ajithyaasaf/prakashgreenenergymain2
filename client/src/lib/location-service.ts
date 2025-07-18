/**
 * Enhanced Location Service
 * Provides automatic location detection with reverse geocoding using Google Maps API
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  formattedAddress?: string;
}

export interface LocationStatus {
  status: 'detecting' | 'granted' | 'denied' | 'error';
  location: LocationData | null;
  error?: string;
  canRetry?: boolean;
}

class LocationService {
  private apiKey: string;

  constructor() {
    // Try multiple environment variable sources
    this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
                  import.meta.env.GOOGLE_MAPS_API_KEY || 
                  '';
    console.log('Google Maps API Key configured:', this.apiKey ? 'Yes' : 'No');
  }

  /**
   * Automatically detect user location with maximum precision
   */
  async detectLocation(): Promise<LocationStatus> {
    if (!navigator.geolocation) {
      return {
        status: 'error',
        location: null,
        error: 'Geolocation is not supported by this device',
        canRetry: false
      };
    }

    try {
      const position = await this.getCurrentPosition();
      
      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      // Get human-readable address
      if (this.apiKey) {
        try {
          const address = await this.reverseGeocode(locationData.latitude, locationData.longitude);
          locationData.address = address.address;
          locationData.formattedAddress = address.formattedAddress;
        } catch (error) {
          console.warn('Reverse geocoding failed:', error);
          // Location detection still successful even if geocoding fails
        }
      }

      return {
        status: 'granted',
        location: locationData
      };
    } catch (error: any) {
      return this.handleLocationError(error);
    }
  }

  /**
   * Get current position using the same approach as the working example
   */
  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Location detected:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
          });
          resolve(position);
        },
        (error) => {
          console.error('Location error:', error.code, error.message);
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              if (isMobile) {
                reject(new Error('Please turn on Location Services in your device settings and allow location access'));
              } else {
                reject(new Error('Please enable location permissions in your browser and try again'));
              }
              break;
            case error.POSITION_UNAVAILABLE:
              if (isMobile) {
                reject(new Error('Please turn on GPS in your device settings'));
              } else {
                reject(new Error('Location unavailable. Please ensure WiFi or mobile data is enabled'));
              }
              break;
            case error.TIMEOUT:
              reject(new Error('Location request timed out. Please try again'));
              break;
            default:
              if (isMobile) {
                reject(new Error('Please turn on GPS and Location Services'));
              } else {
                reject(new Error('Please enable location services and try again'));
              }
              break;
          }
        },
        {
          enableHighAccuracy: true,  // Force GPS usage when available
          timeout: 15000,            // 15 second timeout
          maximumAge: 0              // Never use cached location
        }
      );
    });
  }

  /**
   * Convert coordinates to address using the exact same approach as working example
   */
  private async reverseGeocode(latitude: number, longitude: number): Promise<{
    address: string;
    formattedAddress: string;
  }> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.apiKey}`
      );
      const data = await response.json();
      
      if (data.status === "OK") {
        const address = data.results[0]?.formatted_address || "Unknown location";
        console.log('Address fetched successfully:', address);
        
        // Extract shorter address for display
        const shortAddress = this.extractShortAddress(data.results[0]?.address_components || []);
        
        return {
          address: shortAddress || address,
          formattedAddress: address
        };
      } else {
        throw new Error("Unable to fetch address");
      }
    } catch (err) {
      console.error('Error fetching address:', err);
      throw new Error("Error fetching address");
    }
  }

  /**
   * Extract a short, readable address from components
   */
  private extractShortAddress(components: any[]): string {
    const addressParts = [];
    let streetNumber = '';
    let streetName = '';
    let locality = '';
    let administrativeArea = '';

    components.forEach((component: any) => {
      const types = component.types;
      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (types.includes('route')) {
        streetName = component.long_name;
      } else if (types.includes('locality')) {
        locality = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        administrativeArea = component.short_name;
      }
    });

    if (streetNumber && streetName) {
      addressParts.push(`${streetNumber} ${streetName}`);
    } else if (streetName) {
      addressParts.push(streetName);
    }
    
    if (locality) addressParts.push(locality);
    if (administrativeArea) addressParts.push(administrativeArea);

    return addressParts.join(', ');
  }

  /**
   * Check if location services are available
   */
  isLocationSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Validate location data
   */
  isValidLocation(location: LocationData | null): boolean {
    if (!location) return false;
    return (
      typeof location.latitude === 'number' &&
      typeof location.longitude === 'number' &&
      location.latitude >= -90 && location.latitude <= 90 &&
      location.longitude >= -180 && location.longitude <= 180
    );
  }
}

// Export singleton instance
export const locationService = new LocationService();