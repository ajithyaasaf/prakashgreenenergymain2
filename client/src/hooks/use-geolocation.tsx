import { useState, useEffect } from 'react';

interface GeolocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

interface GeolocationError {
  code: number;
  message: string;
}

interface UseGeolocationReturn {
  location: GeolocationData | null;
  error: GeolocationError | null;
  isLoading: boolean;
  getCurrentLocation: () => void;
  calculateDistance: (lat1: number, lon1: number, lat2: number, lon2: number) => number;
  isWithinRadius: (targetLat: number, targetLon: number, radiusInMeters: number) => boolean;
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<GeolocationData | null>(null);
  const [error, setError] = useState<GeolocationError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Check if current location is within specified radius of target location
  const isWithinRadius = (targetLat: number, targetLon: number, radiusInMeters: number): boolean => {
    if (!location) return false;
    const distance = calculateDistance(location.latitude, location.longitude, targetLat, targetLon);
    return distance <= radiusInMeters;
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError({
        code: 0,
        message: 'Geolocation is not supported by this browser'
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
        setIsLoading(false);
      },
      (error) => {
        setError({
          code: error.code,
          message: error.message
        });
        setIsLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  };

  return {
    location,
    error,
    isLoading,
    getCurrentLocation,
    calculateDistance,
    isWithinRadius
  };
}