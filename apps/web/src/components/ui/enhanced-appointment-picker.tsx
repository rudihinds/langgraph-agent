"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

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
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    if (selectedDate) {
      setInputValue(format(selectedDate, "yyyy-MM-dd"));
    }
    setOpen(false);
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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative w-full">
            <Input
              type="date"
              value={inputValue}
              onChange={handleInputChange}
              onClick={() => setOpen(true)}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(error && "border-destructive", "pr-10")}
            />
            <CalendarIcon 
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" 
            />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            disabled={disabled}
            month={month}
            onMonthChange={setMonth}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-sm font-medium text-destructive">{error}</p>
      )}
    </div>
  );
} 