"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface EnhancedAppointmentPickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function EnhancedAppointmentPicker({
  date,
  onDateChange,
  label,
  placeholder = "Select date",
  disabled,
  error,
  className,
}: EnhancedAppointmentPickerProps) {
  const [month, setMonth] = React.useState<Date>(date || new Date());
  const [inputValue, setInputValue] = React.useState<string>(
    date ? format(date, "yyyy-MM-dd") : ""
  );

  const handleSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    if (selectedDate) {
      setInputValue(format(selectedDate, "yyyy-MM-dd"));
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Try to parse the date from the input
    const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const newDate = new Date(
        parseInt(dateMatch[1]), 
        parseInt(dateMatch[2]) - 1, 
        parseInt(dateMatch[3])
      );
      
      if (!isNaN(newDate.getTime())) {
        onDateChange(newDate);
        setMonth(newDate);
      }
    } else if (value === "") {
      onDateChange(undefined);
    }
  };

  // Update input value when date prop changes
  React.useEffect(() => {
    if (date) {
      setInputValue(format(date, "yyyy-MM-dd"));
    } else {
      setInputValue("");
    }
  }, [date]);

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <div className="flex flex-col space-y-2 rounded-md border p-3">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          disabled={disabled}
          month={month}
          onMonthChange={setMonth}
          className="mx-auto"
        />
        <Input
          type="date"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("mt-2", error && "border-destructive")}
        />
      </div>
      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}
    </div>
  );
} 