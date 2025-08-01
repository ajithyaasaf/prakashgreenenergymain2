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
    // Try multiple environment variable sources, including the backend endpoint
    this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
                  import.meta.env.GOOGLE_MAPS_API_KEY || 
                  '';
    console.log('Google Maps API Key configured:', this.apiKey ? 'Yes' : 'No');
    if (!this.apiKey) {
      console.warn('⚠️ Google Maps API key not found - will try to fetch from backend');
    }
  }

  /**
   * Check if location services are supported
   */
  isLocationSupported(): boolean {
    return 'geolocation' in navigator;
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

    if (!this.apiKey) {
      console.warn('Google Maps API key not configured - using basic location without address');
      // Continue with basic location detection without address lookup
    }

    try {
      const position = await this.getCurrentPosition();
      
      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      // Get human-readable address using reverse geocoding
      try {
        const address = await this.reverseGeocode(locationData.latitude, locationData.longitude);
        locationData.address = address.address;
        locationData.formattedAddress = address.formattedAddress;
        
        console.log('✅ Location detected successfully with address:', {
          coords: `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`,
          accuracy: `${Math.round(locationData.accuracy)}m`,
          address: locationData.address
        });
      } catch (error) {
        console.warn('Address lookup failed, using coordinates only:', error);
        locationData.address = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`;
        locationData.formattedAddress = locationData.address;
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
          timeout: 20000,            // 20 second timeout for better GPS lock
          maximumAge: 0              // Never use cached location
        }
      );
    });
  }

  /**
   * Convert coordinates to address using Google Maps Geocoding API
   */
  private async reverseGeocode(latitude: number, longitude: number): Promise<{
    address: string;
    formattedAddress: string;
  }> {
    // Try to get API key from backend endpoint if not available locally
    let apiKey = this.apiKey;
    if (!apiKey) {
      try {
        // Get fresh token from Firebase Auth
        const { getAuth } = await import('firebase/auth');
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        if (currentUser) {
          const token = await currentUser.getIdToken(true); // Force refresh
          
          const response = await fetch('/api/google-maps-key', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          if (response.ok) {
            const data = await response.json();
            apiKey = data.apiKey;
            console.log('✅ Google Maps API key fetched from backend');
          }
        }
      } catch (error) {
        console.warn('Could not fetch API key from backend:', error);
      }
    }

    if (!apiKey) {
      throw new Error("Google Maps API key not available");
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.status === "OK" && data.results && data.results.length > 0) {
        const result = data.results[0];
        const fullAddress = result.formatted_address || "Unknown location";
        
        console.log('✅ Google Maps Geocoding API Response:', {
          status: data.status,
          fullAddress: fullAddress,
          coordinates: `${latitude}, ${longitude}`
        });
        
        // Extract shorter, more readable address for display
        const shortAddress = this.extractShortAddress(result.address_components || []);
        
        return {
          address: shortAddress || fullAddress,
          formattedAddress: fullAddress
        };
      } else {
        console.warn('Google Maps API response:', data);
        throw new Error(`Geocoding failed: ${data.status || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error fetching address from Google Maps:', err);
      throw new Error("Unable to fetch address from Google Maps");
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
   * Handle location detection errors with appropriate messaging
   */
  private handleLocationError(error: any): LocationStatus {
    console.error('Location detection error:', error);
    
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (error.code) {
      switch (error.code) {
        case 1: // PERMISSION_DENIED
          return {
            status: 'denied',
            location: null,
            error: isMobile 
              ? 'Location access denied. Please enable Location Services in Settings and allow access for this app.'
              : 'Location access denied. Please click the location icon in your browser and allow access.',
            canRetry: true
          };
        case 2: // POSITION_UNAVAILABLE
          return {
            status: 'error',
            location: null,
            error: isMobile 
              ? 'GPS unavailable. Please ensure GPS is enabled and you have a clear view of the sky.'
              : 'Location unavailable. Please check your internet connection.',
            canRetry: true
          };
        case 3: // TIMEOUT
          return {
            status: 'error',
            location: null,
            error: 'Location request timed out. Please try again.',
            canRetry: true
          };
        default:
          return {
            status: 'error',
            location: null,
            error: 'Unable to detect location. Please try again.',
            canRetry: true
          };
      }
    }
    
    return {
      status: 'error',
      location: null,
      error: error.message || 'Location detection failed. Please try again.',
      canRetry: true
    };
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