import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { isWithinGeoFence, getDistanceBetweenCoordinates } from "@/lib/utils";

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
  isWithinOffice: boolean;
  distanceFromOffice: number | null;
  officeLocation: {
    name: string;
    latitude: number;
    longitude: number;
    radius: number;
  } | null;
}

export function useGeolocation(checkOfficeProximity = true) {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: true,
    isWithinOffice: false,
    distanceFromOffice: null,
    officeLocation: null,
  });
  const { toast } = useToast();

  // Function to get current location
  const getCurrentLocation = () => {
    setState(prev => ({ ...prev, loading: true }));

    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: "Geolocation is not supported by your browser",
        loading: false,
      }));
      
      toast({
        title: "Geolocation Error",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      });
      
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Fetch office locations from API with authentication
          const { getAuth } = await import('firebase/auth');
          const auth = getAuth();
          const user = auth.currentUser;
          
          if (!user) {
            setState({
              latitude,
              longitude,
              error: "User not authenticated",
              loading: false,
              isWithinOffice: false,
              distanceFromOffice: null,
              officeLocation: null,
            });
            return;
          }
          
          const token = await user.getIdToken();
          const response = await fetch('/api/office-locations', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const officeLocations = await response.json();
            
            // Find if user is within any office location
            let withinOffice = false;
            let closestOffice = null;
            let minDistance = Infinity;
            
            for (const office of officeLocations) {
              const distance = getDistanceBetweenCoordinates(
                latitude,
                longitude,
                parseFloat(office.latitude),
                parseFloat(office.longitude)
              );
              
              if (distance < minDistance) {
                minDistance = distance;
                closestOffice = office;
              }
              
              if (isWithinGeoFence(
                latitude,
                longitude,
                parseFloat(office.latitude),
                parseFloat(office.longitude),
                office.radius
              )) {
                withinOffice = true;
                break;
              }
            }
            
            setState({
              latitude,
              longitude,
              error: null,
              loading: false,
              isWithinOffice: withinOffice,
              distanceFromOffice: minDistance,
              officeLocation: closestOffice,
            });
          } else {
            setState({
              latitude,
              longitude,
              error: "Failed to fetch office locations",
              loading: false,
              isWithinOffice: false,
              distanceFromOffice: null,
              officeLocation: null,
            });
          }
        } catch (error) {
          console.error("Error fetching office locations:", error);
          setState({
            latitude,
            longitude,
            error: "Failed to fetch office locations",
            loading: false,
            isWithinOffice: false,
            distanceFromOffice: null,
            officeLocation: null,
          });
        }
      },
      (error) => {
        let errorMessage = "Unknown error occurred while getting location";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please enable location services.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
        }
        
        setState(prev => ({
          ...prev,
          error: errorMessage,
          loading: false,
        }));
        
        toast({
          title: "Geolocation Error",
          description: errorMessage,
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true }
    );
  };

  // Initial location fetch
  useEffect(() => {
    if (checkOfficeProximity) {
      getCurrentLocation();
    }
  }, [checkOfficeProximity]);

  return {
    ...state,
    getCurrentLocation,
  };
}