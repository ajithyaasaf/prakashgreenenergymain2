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
    this.apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  }

  /**
   * Automatically detect user location with high accuracy
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
   * Get current position with optimized settings
   */
  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000 // Allow cached location up to 30 seconds
        }
      );
    });
  }

  /**
   * Convert coordinates to human-readable address using Google Maps API
   */
  private async reverseGeocode(latitude: number, longitude: number): Promise<{
    address: string;
    formattedAddress: string;
  }> {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      throw new Error(`Geocoding failed: ${data.status}`);
    }

    const result = data.results[0];
    
    // Extract detailed address components
    const addressComponents = result.address_components;
    let streetNumber = '';
    let streetName = '';
    let locality = '';
    let administrativeArea = '';
    let country = '';
    let postalCode = '';

    addressComponents.forEach((component: any) => {
      const types = component.types;
      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      } else if (types.includes('route')) {
        streetName = component.long_name;
      } else if (types.includes('locality')) {
        locality = component.long_name;
      } else if (types.includes('administrative_area_level_1')) {
        administrativeArea = component.short_name;
      } else if (types.includes('country')) {
        country = component.long_name;
      } else if (types.includes('postal_code')) {
        postalCode = component.long_name;
      }
    });

    // Build a clean, readable address
    const addressParts = [];
    if (streetNumber && streetName) {
      addressParts.push(`${streetNumber} ${streetName}`);
    } else if (streetName) {
      addressParts.push(streetName);
    }
    
    if (locality) addressParts.push(locality);
    if (administrativeArea) addressParts.push(administrativeArea);
    if (postalCode) addressParts.push(postalCode);

    const cleanAddress = addressParts.join(', ');

    return {
      address: cleanAddress || result.formatted_address,
      formattedAddress: result.formatted_address
    };
  }

  /**
   * Handle geolocation errors with user-friendly messages
   */
  private handleLocationError(error: GeolocationPositionError): LocationStatus {
    let errorMessage: string;
    let canRetry = true;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied. Please enable location permissions and try again.';
        canRetry = true;
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information is unavailable. Please check your GPS signal.';
        canRetry = true;
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out. Please try again.';
        canRetry = true;
        break;
      default:
        errorMessage = 'An unknown error occurred while detecting location.';
        canRetry = true;
        break;
    }

    return {
      status: 'denied',
      location: null,
      error: errorMessage,
      canRetry
    };
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