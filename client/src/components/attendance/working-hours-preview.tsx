import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap, AlertTriangle } from 'lucide-react';
import { TimeDisplay } from '@/components/time/time-display';

interface WorkingHoursPreviewProps {
  checkInTime: string | Date;
  currentTime?: Date;
  departmentTiming: {
    checkInTime: string;
    checkOutTime: string;
    workingHours: number;
    overtimeThresholdMinutes: number;
  };
  className?: string;
}

export function WorkingHoursPreview({ 
  checkInTime, 
  currentTime = new Date(), 
  departmentTiming,
  className = ""
}: WorkingHoursPreviewProps) {
  
  const calculatePreview = () => {
    const checkIn = new Date(checkInTime);
    const now = currentTime;
    
    // FIXED: Proper 12-hour format parsing for department times
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // REMOVED: Custom time parsing - simplified calculation doesn't need department schedule times
    // We only need the department standard working hours for calculation
    
    // FIXED: Simplified overtime calculation - total work time minus department standard hours
    const totalWorkingMinutes = Math.floor((now.getTime() - checkIn.getTime()) / (1000 * 60));
    const departmentStandardMinutes = departmentTiming.workingHours * 60;
    
    // Calculate regular and overtime hours
    const regularMinutes = Math.min(totalWorkingMinutes, departmentStandardMinutes);
    const overtimeMinutes = Math.max(0, totalWorkingMinutes - departmentStandardMinutes);
    
    const isCurrentlyOvertime = overtimeMinutes > 0;
    
    return {
      currentWorkingHours: totalWorkingMinutes / 60,
      currentWorkingMinutes: totalWorkingMinutes,
      currentRegularHours: regularMinutes / 60,
      currentRegularMinutes: regularMinutes,
      isCurrentlyOvertime,
      overtimeMinutes,
      overtimeHours: overtimeMinutes / 60,
      standardEndTime: new Date(), // Not needed for simplified calculation
      departmentStartTime: new Date() // Not needed for simplified calculation
    };
  };

  const preview = calculatePreview();
  
  const formatDuration = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  return (
    <Card className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 ${className}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-blue-700 font-medium">
          <Clock className="h-4 w-4" />
          <span className="text-sm">Working Hours Preview</span>
        </div>
        
        <div className="grid grid-cols-3 gap-3">
          {/* Regular Hours */}
          <div className="bg-white p-3 rounded-lg border">
            <div className="text-xs text-muted-foreground">Regular Hours</div>
            <div className="font-semibold text-green-600">
              {formatDuration(preview.currentRegularHours)}
            </div>
            <div className="text-xs text-muted-foreground">In schedule</div>
          </div>
          
          {/* Overtime Hours */}
          <div className="bg-white p-3 rounded-lg border">
            <div className="text-xs text-muted-foreground">Overtime Hours</div>
            <div className={`font-semibold ${preview.isCurrentlyOvertime ? 'text-orange-600' : 'text-gray-400'}`}>
              {formatDuration(preview.overtimeHours)}
            </div>
            <div className="text-xs text-muted-foreground">Outside schedule</div>
          </div>
          
          {/* Total Time */}
          <div className="bg-white p-3 rounded-lg border">
            <div className="text-xs text-muted-foreground">Total Time</div>
            <div className="font-semibold text-blue-600">
              {formatDuration(preview.currentWorkingHours)}
            </div>
            <div className="text-xs text-muted-foreground">All time</div>
          </div>
        </div>
        
        {/* Overtime Status */}
        {preview.isCurrentlyOvertime && (
          <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
            <Zap className="h-4 w-4 text-orange-600" />
            <div className="flex-1">
              <div className="text-xs font-medium text-orange-700">Currently in Overtime</div>
              <div className="text-xs text-orange-600">
                {formatDuration(preview.overtimeHours)} beyond standard hours
              </div>
            </div>
            <Badge variant="outline" className="text-orange-600 border-orange-300">
              OT: {formatDuration(preview.overtimeHours)}
            </Badge>
          </div>
        )}
        
        {/* Enhanced Information */}
        <div className="text-xs bg-white p-3 rounded border space-y-1">
          <div className="font-medium text-gray-700">Department Schedule:</div>
          <div className="text-muted-foreground">
            <TimeDisplay time={departmentTiming.checkInTime} format12Hour={true} /> - {' '}
            <TimeDisplay time={departmentTiming.checkOutTime} format12Hour={true} />
            {' '}({departmentTiming.workingHours}h standard)
          </div>
          {preview.isCurrentlyOvertime ? (
            <div className="text-orange-600 font-medium">
              ⚠️ Currently working beyond standard {departmentTiming.workingHours}h (overtime)
            </div>
          ) : (
            <div className="text-green-600">
              ✓ Working within standard {departmentTiming.workingHours}h
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}