"use client";

import * as React from "react";
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
import {
  formatDateForUI,
  parseUIDate,
  DATE_FORMATS,
} from "@/lib/utils/date-utils";

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
  const today = React.useMemo(() => new Date(), []);
  const [month, setMonth] = React.useState<Date>(date || today);
  const [inputValue, setInputValue] = React.useState<string>(
    date ? formatDateForUI(date) : ""
  );
  const [open, setOpen] = React.useState(false);

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

    // Try to parse the date from the input in UK format (dd/mm/yyyy)
    const newDate = parseUIDate(value);

    if (newDate) {
      onDateChange(newDate);
      setMonth(newDate);
    } else if (value === "") {
      onDateChange(undefined);
    }
  };

  // When opening the popover, reset to today's month if no date is selected
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !date) {
      setMonth(today);
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
              placeholder={placeholder || DATE_FORMATS.UI.toUpperCase()}
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
      {error && <p className="text-sm font-medium text-destructive">{error}</p>}
    </div>
  );
}
