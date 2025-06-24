import React, { useState, useEffect } from 'react';
import { Input } from './input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { formatTimeString, convertTo24Hour } from '@/lib/utils';

interface TimeInputProps {
  value: string; // 24-hour format (HH:MM)
  onChange: (value: string) => void; // Returns 24-hour format
  className?: string;
  placeholder?: string;
}

export function TimeInput({ value, onChange, className, placeholder }: TimeInputProps) {
  const [hour, setHour] = useState('9');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState('AM');

  // Parse 24-hour value to 12-hour components
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(':');
      const hour24 = parseInt(h);
      const displayHour = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const displayPeriod = hour24 >= 12 ? 'PM' : 'AM';
      
      setHour(displayHour.toString());
      setMinute(m);
      setPeriod(displayPeriod);
    }
  }, [value]);

  // Update parent with 24-hour format when components change
  const updateTime = (newHour: string, newMinute: string, newPeriod: string) => {
    let hour24 = parseInt(newHour);
    
    if (newPeriod === 'AM' && hour24 === 12) {
      hour24 = 0;
    } else if (newPeriod === 'PM' && hour24 !== 12) {
      hour24 += 12;
    }
    
    const time24 = `${hour24.toString().padStart(2, '0')}:${newMinute}`;
    onChange(time24);
  };

  const handleHourChange = (newHour: string) => {
    setHour(newHour);
    updateTime(newHour, minute, period);
  };

  const handleMinuteChange = (newMinute: string) => {
    setMinute(newMinute);
    updateTime(hour, newMinute, period);
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    updateTime(hour, minute, newPeriod);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Select value={hour} onValueChange={handleHourChange}>
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }, (_, i) => (
            <SelectItem key={i + 1} value={(i + 1).toString()}>
              {i + 1}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <span className="text-lg font-mono">:</span>
      
      <Select value={minute} onValueChange={handleMinuteChange}>
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {['00', '15', '30', '45'].map((min) => (
            <SelectItem key={min} value={min}>
              {min}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Select value={period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="w-16">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AM">AM</SelectItem>
          <SelectItem value="PM">PM</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}