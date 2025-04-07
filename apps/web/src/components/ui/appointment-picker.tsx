"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Props for the AppointmentPicker component
 * @interface AppointmentPickerProps
 */
interface AppointmentPickerProps {
  /**
   * The currently selected date
   */
  date: Date | undefined;

  /**
   * Callback function triggered when a date is selected or cleared
   * @param date - The selected date or undefined if cleared
   */
  onDateChange: (date: Date | undefined) => void;

  /** Optional label to display above the picker */
  label?: string;

  /** Placeholder text to display when no date is selected */
  placeholder?: string;

  /** Whether the picker is disabled */
  disabled?: boolean;

  /** Error message to display below the picker */
  error?: string;

  /** Additional CSS classes to apply to the container */
  className?: string;
}

/**
 * A date picker component that displays a calendar popover.
 *
 * Allows users to select a date from a calendar interface and displays
 * the selected date in a formatted, human-readable string.
 *
 * @example
 * ```tsx
 * <AppointmentPicker
 *   date={selectedDate}
 *   onDateChange={setSelectedDate}
 *   label="Appointment Date"
 *   placeholder="Select a date"
 *   error={errors.date}
 * />
 * ```
 */
export function AppointmentPicker({
  date,
  onDateChange,
  label,
  placeholder = "Select a date",
  disabled = false,
  error,
  className,
}: AppointmentPickerProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <Popover>
        <PopoverTrigger asChild>
          <div className="w-full cursor-pointer hover:opacity-90 transition-opacity">
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground",
                error && "border-destructive"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "PPP") : placeholder}
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
