import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Date formatting
export function formatDate(date: Date | string): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format time from Date object to 12-hour format (DEPRECATED)
 * @deprecated Use TimeDisplay component with format12Hour={true} instead
 * @param date - Date object or string
 * @returns Time in 12-hour format (h:mm AM/PM)
 */
export function formatTime(date: Date | string): string {
  console.warn('DEPRECATED: formatTime - Use TimeDisplay component instead');
  
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Enhanced time formatting for 12-hour consistency
export function formatTime12Hour(time: string | Date): string {
  if (!time) return "";
  
  const date = typeof time === 'string' ? new Date(time) : time;
  
  if (isNaN(date.getTime())) return "";
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Currency formatting for Indian Rupees
export function formatCurrency(amount: number): string {
  // Convert paise/cents to rupees
  const amountInRupees = amount / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountInRupees);
}

// Get initials from name
export function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Check if a time is between two times
export function isTimeBetween(time: Date, start: string, end: string): boolean {
  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);
  
  const startTime = new Date(time);
  startTime.setHours(startHours, startMinutes, 0);
  
  const endTime = new Date(time);
  endTime.setHours(endHours, endMinutes, 0);
  
  return time >= startTime && time <= endTime;
}

// Calculate distance between two coordinates in meters
export function getDistanceBetweenCoordinates(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;

  return d; // Distance in meters
}

// Generate a random ID
export function generateId(prefix: string = ""): string {
  return `${prefix}${Math.random().toString(36).substring(2, 9)}`;
}

// Check if user is within office geo-fence
export function isWithinGeoFence(
  userLat: number,
  userLng: number,
  officeLat: number,
  officeLng: number,
  radiusInMeters: number
): boolean {
  const distance = getDistanceBetweenCoordinates(
    userLat,
    userLng,
    officeLat,
    officeLng
  );
  return distance <= radiusInMeters;
}

// Convert a file to a data URL
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Format time string to 12-hour format (DEPRECATED)
 * @deprecated Use TimeDisplay component with format12Hour={true} instead
 * @param timeString - Time in HH:MM format or 12-hour format
 * @returns Time in 12-hour format (h:mm AM/PM)
 */
export function formatTimeString(timeString: string): string {
  console.warn('DEPRECATED: formatTimeString - Use TimeDisplay component instead');
  
  if (!timeString) return "";
  
  try {
    // If it's already in 12-hour format, return as is
    if (timeString.includes("AM") || timeString.includes("PM")) {
      return timeString;
    }
    
    // Handle both HH:MM and HH:MM:SS formats
    const [hours, minutes] = timeString.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) return timeString;
    
    const date = new Date();
    date.setHours(hours, minutes, 0);
    
    return date.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch (error) {
    console.error('Error formatting time string:', error);
    return timeString;
  }
}
