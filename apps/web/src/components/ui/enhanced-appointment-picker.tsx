"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { parseUIDate, formatDateForUI } from "@/lib/utils/date-utils";

export interface EnhancedAppointmentPickerProps {
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
  placeholder = "Select a date",
  disabled = false,
  error,
  className,
}: EnhancedAppointmentPickerProps) {
  const [month, setMonth] = React.useState<Date | undefined>(
    date ? new Date(date) : undefined
  );
  const [inputValue, setInputValue] = React.useState<string>(
    date ? formatDateForUI(date) : ""
  );

  const handleSelect = React.useCallback(
    (date: Date | undefined) => {
      onDateChange(date);
      if (date) {
        setInputValue(formatDateForUI(date));
      }
    },
    [onDateChange]
  );

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      // Try to parse the input as a date
      const parsedDate = parseUIDate(value);
      if (parsedDate) {
        onDateChange(parsedDate);
        setMonth(parsedDate);
      } else if (value === "") {
        onDateChange(undefined);
      }
    },
    [onDateChange]
  );

  // Update input value when date prop changes from outside
  React.useEffect(() => {
    if (date) {
      setInputValue(formatDateForUI(date));
      setMonth(date);
    } else {
      setInputValue("");
    }
  }, [date]);

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <Popover>
        <PopoverTrigger asChild>
          <div className="relative w-full">
            <Input
              value={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              disabled={disabled}
              className={cn(
                "w-full pl-10",
                error && "border-destructive focus-visible:ring-destructive"
              )}
            />
            <CalendarIcon className="absolute w-4 h-4 -translate-y-1/2 pointer-events-none left-3 top-1/2 text-muted-foreground" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={month}
            onSelect={handleSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
