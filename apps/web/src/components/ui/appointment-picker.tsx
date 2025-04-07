"use client";

import * as React from "react";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateForUI, parseUIDate } from "@/lib/utils/date-utils";

/**
 * AppointmentPicker component for selecting dates with both calendar UI and manual input.
 * Uses DD/MM/YYYY format for display and input.
 */
interface AppointmentPickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  allowManualInput?: boolean;
}

export function AppointmentPicker({
  date,
  onDateChange,
  label,
  placeholder = "DD/MM/YYYY",
  disabled = false,
  error,
  className,
  allowManualInput = true,
}: AppointmentPickerProps) {
  const today = React.useMemo(() => new Date(), []);
  const [month, setMonth] = React.useState<Date>(date || today);
  const [inputValue, setInputValue] = React.useState<string>(
    date ? formatDateForUI(date) : ""
  );
  const [open, setOpen] = React.useState(false);

  // Reset the month view when component mounts
  React.useEffect(() => {
    setMonth(date || today);
  }, [date, today]);

  const handleSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    if (selectedDate) {
      setInputValue(formatDateForUI(selectedDate));
    }
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value === "") {
      onDateChange(undefined);
    } else {
      const parsedDate = parseUIDate(value);
      if (parsedDate) {
        onDateChange(parsedDate);
        setMonth(parsedDate);
      }
    }
  };

  // When opening the popover, always reset to today's month if no date is selected
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setMonth(date || today);
    }
  };

  // Update input value when date prop changes
  React.useEffect(() => {
    if (date) {
      setInputValue(formatDateForUI(date));
      setMonth(date);
    } else {
      setInputValue("");
    }
  }, [date]);

  // Render different UI based on allowManualInput prop
  if (allowManualInput) {
    return (
      <div className={cn("space-y-2", className)}>
        {label && <Label>{label}</Label>}
        <Popover open={open} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <div className="relative w-full">
              <Input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onClick={() => setOpen(true)}
                placeholder={placeholder}
                disabled={disabled}
                className={cn(error && "border-destructive", "pr-10")}
              />
              <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleSelect}
              disabled={disabled}
              month={month}
              onMonthChange={setMonth}
              defaultMonth={today}
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

  // Simple button-only version (original style)
  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <Popover onOpenChange={handleOpenChange}>
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
              {date ? formatDateForUI(date) : placeholder}
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={onDateChange}
            initialFocus
            defaultMonth={today}
            month={month}
            onMonthChange={setMonth}
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
