/**
 * Enterprise Time Display Component
 * Standardized 12-hour format display throughout the application
 */

import React from 'react';
import { formatDistanceToNow, format } from 'date-fns';

interface TimeDisplayProps {
  time: string | Date;
  format12Hour?: boolean;
  showSeconds?: boolean;
  showDate?: boolean;
  relative?: boolean;
  className?: string;
}

export function TimeDisplay({ 
  time, 
  format12Hour = true, 
  showSeconds = false, 
  showDate = false,
  relative = false,
  className = ""
}: TimeDisplayProps) {
  if (!time) return <span className={className}>--</span>;
  
  // Handle time-only strings from database (e.g., "12:46", "9:30", "09:00", "19:00")
  if (typeof time === 'string') {
    // Check if it's already in 12-hour format (with AM/PM)
    const time12HourRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    const time12Match = time.match(time12HourRegex);
    
    if (time12Match) {
      // Already in 12-hour format, return as-is
      return (
        <span className={className}>
          {time}
        </span>
      );
    }
    
    // Check if it's a time-only format in 24-hour (HH:MM or H:MM)
    const timeOnlyRegex = /^(\d{1,2}):(\d{2})$/;
    const match = time.match(timeOnlyRegex);
    
    if (match) {
      const [, hours, minutes] = match;
      const hour24 = parseInt(hours);
      const min = parseInt(minutes);
      
      // Convert to 12-hour format display
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const period = hour24 >= 12 ? 'PM' : 'AM';
      
      return (
        <span className={className}>
          {hour12}:{minutes} {period}
        </span>
      );
    }
    
    // Try to parse as full date string
    const date = new Date(time);
    if (!isNaN(date.getTime())) {
      if (relative) {
        return (
          <span className={className} title={formatTime(date, format12Hour, showSeconds, showDate)}>
            {formatDistanceToNow(date, { addSuffix: true })}
          </span>
        );
      }
      return (
        <span className={className}>
          {formatTime(date, format12Hour, showSeconds, showDate)}
        </span>
      );
    }
    
    return <span className={className}>Invalid time</span>;
  }
  
  // Handle Date objects
  const date = time;
  if (isNaN(date.getTime())) {
    return <span className={className}>Invalid time</span>;
  }

  if (relative) {
    return (
      <span className={className} title={formatTime(date, format12Hour, showSeconds, showDate)}>
        {formatDistanceToNow(date, { addSuffix: true })}
      </span>
    );
  }

  return (
    <span className={className}>
      {formatTime(date, format12Hour, showSeconds, showDate)}
    </span>
  );
}

function formatTime(date: Date, format12Hour: boolean, showSeconds: boolean, showDate: boolean): string {
  let formatString = '';
  
  if (showDate) {
    formatString += 'MMM dd, yyyy ';
  }
  
  if (format12Hour) {
    formatString += showSeconds ? 'h:mm:ss a' : 'h:mm a';
  } else {
    // Use 24-hour format internally for consistency with date-fns
    formatString += showSeconds ? 'HH:mm:ss' : 'HH:mm';
  }
  
  return format(date, formatString);
}

// Utility function to format time consistently across the app
export function formatTimeFor12Hour(time: string | Date): string {
  if (!time) return '--';
  
  const date = typeof time === 'string' ? new Date(time) : time;
  
  if (isNaN(date.getTime())) return 'Invalid time';
  
  return format(date, 'h:mm a');
}

// Utility function to format time with date
export function formatDateTimeFor12Hour(time: string | Date): string {
  if (!time) return '--';
  
  const date = typeof time === 'string' ? new Date(time) : time;
  
  if (isNaN(date.getTime())) return 'Invalid date/time';
  
  return format(date, 'MMM dd, yyyy h:mm a');
}

// Utility to check if time string is in 12-hour format
export function is12HourFormat(timeString: string): boolean {
  return /\d{1,2}:\d{2}\s*(AM|PM)/i.test(timeString);
}

// Convert 24-hour to 12-hour format
export function convert24To12Hour(time24: string): string {
  try {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch (error) {
    return time24; // Return original if conversion fails
  }
}

// Convert 12-hour to 24-hour format (for backend compatibility)
export function convert12To24Hour(time12: string): string {
  try {
    const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
    const match = time12.match(timeRegex);
    
    if (!match) {
      throw new Error(`Invalid 12-hour time format: ${time12}`);
    }

    let [, hourStr, minuteStr, period] = match;
    let hours = parseInt(hourStr);
    const minutes = parseInt(minuteStr);

    if (period.toUpperCase() === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period.toUpperCase() === 'AM' && hours === 12) {
      hours = 0;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  } catch (error) {
    return time12; // Return original if conversion fails
  }
}