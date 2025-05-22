/**
 * Determines if coordinates are within a geofence
 * @param lat Latitude to check
 * @param lng Longitude to check
 * @param fenceLat Fence center latitude
 * @param fenceLng Fence center longitude
 * @param radiusInMeters Fence radius in meters
 * @returns boolean indicating if point is within fence
 */
export function isWithinGeoFence(
  lat: number,
  lng: number,
  fenceLat: number,
  fenceLng: number,
  radiusInMeters: number
): boolean {
  // If any parameter is missing, return false
  if (!lat || !lng || !fenceLat || !fenceLng || !radiusInMeters) {
    return false;
  }
  
  // Calculate distance using Haversine formula
  const distance = getDistanceBetweenCoordinates(
    lat,
    lng,
    fenceLat,
    fenceLng
  );
  
  // Check if within radius
  return distance <= radiusInMeters;
}

/**
 * Calculates distance between two coordinates in meters
 * @param lat1 First latitude
 * @param lon1 First longitude
 * @param lat2 Second latitude
 * @param lon2 Second longitude
 * @returns Distance in meters
 */
export function getDistanceBetweenCoordinates(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const earthRadiusInMeters = 6371000; // Earth's radius in meters
  
  // Convert degrees to radians
  const latRad1 = toRadians(lat1);
  const latRad2 = toRadians(lat2);
  const lonRad1 = toRadians(lon1);
  const lonRad2 = toRadians(lon2);
  
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
}

/**
 * Converts degrees to radians
 * @param degrees Angle in degrees
 * @returns Angle in radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}