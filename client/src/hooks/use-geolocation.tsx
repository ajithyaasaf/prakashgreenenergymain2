import { useState, useEffect, useCallback } from 'react';

interface GeolocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

interface GeolocationError {
  code: number;
  message: string;
}

interface UseGeolocationReturn {
  location: GeolocationCoordinates | null;
  error: GeolocationError | null;
  isLoading: boolean;
  getCurrentLocation: () => Promise<GeolocationCoordinates>;
  calculateDistance: (lat1: number, lng1: number, lat2: number, lng2: number) => number;
  isWithinRadius: (lat1: number, lng1: number, lat2: number, lng2: number, radius: number) => boolean;
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<GeolocationCoordinates | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const earthRadiusInMeters = 6371000; // Earth's radius in meters
    
    // Convert degrees to radians
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    
    const latRad1 = toRadians(lat1);
    const latRad2 = toRadians(lat2);
    const lonRad1 = toRadians(lng1);
    const lonRad2 = toRadians(lng2);
    
    // Differences
    const dLat = latRad2 - latRad1;
    const dLon = lonRad2 - lonRad1;
    
    // Haversine formula
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(latRad1) * Math.cos(latRad2) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadiusInMeters * c;
    
    return distance;
  }, []);

  // Check if coordinates are within a radius
  const isWithinRadius = useCallback((lat1: number, lng1: number, lat2: number, lng2: number, radius: number): boolean => {
    const distance = calculateDistance(lat1, lng1, lat2, lng2);
    return distance <= radius;
  }, [calculateDistance]);

  // Get current location
  const getCurrentLocation = useCallback((): Promise<GeolocationCoordinates> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error: GeolocationError = {
          code: 0,
          message: 'Geolocation is not supported by this browser'
        };
        setError(error);
        reject(error);
        return;
      }

      setIsLoading(true);
      setError(null);

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // Cache for 1 minute
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: GeolocationCoordinates = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed
          };
          
          setLocation(coords);
          setIsLoading(false);
          resolve(coords);
        },
        (err) => {
          let message: string;
          switch (err.code) {
            case err.PERMISSION_DENIED:
              message = 'Location access denied by user. Please enable location permissions.';
              break;
            case err.POSITION_UNAVAILABLE:
              message = 'Location information is unavailable. Please check your GPS settings.';
              break;
            case err.TIMEOUT:
              message = 'Location request timed out. Please try again.';
              break;
            default:
              message = 'An unknown error occurred while retrieving location.';
              break;
          }

          const error: GeolocationError = {
            code: err.code,
            message
          };
          
          setError(error);
          setIsLoading(false);
          reject(error);
        },
        options
      );
    });
  }, []);

  // Watch position for real-time updates (optional)
  const watchPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError({
        code: 0,
        message: 'Geolocation is not supported by this browser'
      });
      return null;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000 // Cache for 30 seconds for real-time updates
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords: GeolocationCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          altitudeAccuracy: position.coords.altitudeAccuracy,
          heading: position.coords.heading,
          speed: position.coords.speed
        };
        
        setLocation(coords);
        setError(null);
      },
      (err) => {
        let message: string;
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message = 'Location access denied by user';
            break;
          case err.POSITION_UNAVAILABLE:
            message = 'Location information is unavailable';
            break;
          case err.TIMEOUT:
            message = 'Location request timed out';
            break;
          default:
            message = 'An unknown error occurred';
            break;
        }

        setError({
          code: err.code,
          message
        });
      },
      options
    );

    return watchId;
  }, []);

  // Clear watch on unmount
  useEffect(() => {
    return () => {
      // Cleanup any ongoing watch if needed
    };
  }, []);

  return {
    location,
    error,
    isLoading,
    getCurrentLocation,
    calculateDistance,
    isWithinRadius
  };
}