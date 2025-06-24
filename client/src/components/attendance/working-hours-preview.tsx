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
    
    // Calculate current working time
    const workingMilliseconds = now.getTime() - checkIn.getTime();
    const workingMinutes = Math.floor(workingMilliseconds / (1000 * 60));
    const workingHours = workingMinutes / 60;
    
    // Parse department times
    const [departCheckInHour, departCheckInMin] = departmentTiming.checkInTime.split(':').map(Number);
    const [departCheckOutHour, departCheckOutMin] = departmentTiming.checkOutTime.split(':').map(Number);
    
    // Create department checkout time for today
    const departCheckOut = new Date();
    departCheckOut.setHours(departCheckOutHour, departCheckOutMin, 0, 0);
    
    // Calculate if currently overtime
    const isCurrentlyOvertime = now > departCheckOut;
    const overtimeMinutes = isCurrentlyOvertime 
      ? Math.floor((now.getTime() - departCheckOut.getTime()) / (1000 * 60))
      : 0;
    
    // Calculate projected end time if they work standard hours
    const projectedEndTime = new Date(checkIn);
    projectedEndTime.setHours(projectedEndTime.getHours() + departmentTiming.workingHours);
    
    return {
      currentWorkingHours: Math.max(0, workingHours),
      currentWorkingMinutes: Math.max(0, workingMinutes),
      isCurrentlyOvertime,
      overtimeMinutes,
      overtimeHours: overtimeMinutes / 60,
      projectedEndTime,
      standardEndTime: departCheckOut
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
        
        <div className="grid grid-cols-2 gap-3">
          {/* Current Working Time */}
          <div className="bg-white p-3 rounded-lg border">
            <div className="text-xs text-muted-foreground">Currently Worked</div>
            <div className="font-semibold text-blue-600">
              {formatDuration(preview.currentWorkingHours)}
            </div>
          </div>
          
          {/* Standard End Time */}
          <div className="bg-white p-3 rounded-lg border">
            <div className="text-xs text-muted-foreground">Standard End</div>
            <div className="font-semibold text-green-600">
              <TimeDisplay time={preview.standardEndTime.toISOString()} format12Hour={true} />
            </div>
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
        
        {/* Helpful Information */}
        <div className="text-xs text-muted-foreground bg-white p-2 rounded border">
          {preview.isCurrentlyOvertime ? (
            <span>You are currently working overtime. Consider checking out soon if your work is complete.</span>
          ) : (
            <span>
              Complete your standard {departmentTiming.workingHours}h day by{' '}
              <TimeDisplay time={preview.standardEndTime.toISOString()} format12Hour={true} />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}