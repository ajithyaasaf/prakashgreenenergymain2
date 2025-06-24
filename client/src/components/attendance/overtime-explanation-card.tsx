import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import { TimeDisplay } from '@/components/time/time-display';

interface OvertimeExplanationProps {
  departmentTiming: {
    checkInTime: string;
    checkOutTime: string;
    workingHours: number;
  };
  className?: string;
}

export function OvertimeExplanationCard({ departmentTiming, className = "" }: OvertimeExplanationProps) {
  return (
    <Card className={`bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200 ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-blue-800">
          <AlertTriangle className="h-5 w-5" />
          How Overtime is Calculated
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Department Schedule */}
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-sm font-medium text-gray-700 mb-2">Your Department Schedule:</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              <span className="text-sm">Start: <TimeDisplay time={departmentTiming.checkInTime} format12Hour={true} /></span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-600" />
              <span className="text-sm">End: <TimeDisplay time={departmentTiming.checkOutTime} format12Hour={true} /></span>
            </div>
            <Badge variant="outline" className="text-blue-600">
              {departmentTiming.workingHours}h standard
            </Badge>
          </div>
        </div>

        {/* Overtime Examples */}
        <div className="space-y-3">
          <div className="text-sm font-medium text-gray-700">Overtime Examples:</div>
          
          {/* Example 1: Early arrival */}
          <div className="bg-orange-50 p-3 rounded border border-orange-200">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Early Arrival Overtime</span>
            </div>
            <div className="text-xs text-orange-700">
              Work from 11:00 AM - <TimeDisplay time={departmentTiming.checkOutTime} format12Hour={true} /> = 
              {' '}<strong>1h 46m overtime</strong> + 4m regular
            </div>
          </div>
          
          {/* Example 2: Late departure */}
          <div className="bg-orange-50 p-3 rounded border border-orange-200">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800">Late Departure Overtime</span>
            </div>
            <div className="text-xs text-orange-700">
              Work from <TimeDisplay time={departmentTiming.checkInTime} format12Hour={true} /> - 2:00 PM = 
              {' '}4m regular + <strong>1h 10m overtime</strong>
            </div>
          </div>
          
          {/* Example 3: Within schedule */}
          <div className="bg-green-50 p-3 rounded border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Regular Hours</span>
            </div>
            <div className="text-xs text-green-700">
              Work exactly <TimeDisplay time={departmentTiming.checkInTime} format12Hour={true} /> - <TimeDisplay time={departmentTiming.checkOutTime} format12Hour={true} /> = 
              {' '}<strong>4m regular</strong>, 0m overtime
            </div>
          </div>
        </div>

        {/* Key Rule */}
        <div className="bg-blue-50 p-3 rounded border border-blue-200">
          <div className="text-sm font-medium text-blue-800 mb-1">Key Rule:</div>
          <div className="text-xs text-blue-700">
            <strong>Overtime = Any work outside your department schedule</strong> (before start time OR after end time)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}