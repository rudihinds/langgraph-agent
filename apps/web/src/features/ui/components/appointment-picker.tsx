"use client";

import * as React from "react";
import { Calendar } from "@/features/ui/components/calendar";
import { AlertCircle, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { Button } from "@/features/ui/components/button";
import { Input } from "@/features/ui/components/input";
import { Label } from "@/features/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/features/ui/components/popover";
import { formatDateForUI, parseUIDate } from "@/lib/utils/date-utils";

/**
 * AppointmentPicker component for selecting dates with both calendar UI and manual input.
 * Uses DD/MM/YYYY format for display and input.
 *
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * const [date, setDate] = useState<Date | undefined>(undefined);
 *
 * <AppointmentPicker
 *   date={date}
 *   onDateChange={setDate}
 *   label="Select Date"
 * />
 *
 * // With manual input disabled (button-only)
 * <AppointmentPicker
 *   date={date}
 *   onDateChange={setDate}
 *   allowManualInput={false}
 * />
 *
 * // With error handling
 * <AppointmentPicker
 *   date={date}
 *   onDateChange={setDate}
 *   error={errors.date}
 * />
 * ```
 */
interface AppointmentPickerProps {
  /**
   * The currently selected date
   */
  date: Date | undefined;

  /**
   * Callback function that is called when the date changes
   * @param date - The new date or undefined if cleared
   */
  onDateChange: (date: Date | undefined) => void;

  /**
   * Label text displayed above the input
   */
  label?: string;

  /**
   * Placeholder text displayed when no date is selected
   */
  placeholder?: string;

  /**
   * Whether the input is disabled
   */
  disabled?: boolean;

  /**
   * Error message to display below the input
   */
  error?: string;

  /**
   * Additional CSS classes to apply to the component
   */
  className?: string;

  /**
   * Whether to allow manual input of dates via text input
   * If false, only the calendar button will be shown
   */
  allowManualInput?: boolean;
}

/**
 * Date picker component that supports both calendar selection and manual input.
 * Consistently formats dates in DD/MM/YYYY format for display and handles
 * conversion between string representations and Date objects.
 */
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

  /**
   * Handle date selection from the calendar component
   */
  const handleSelect = (selectedDate: Date | undefined) => {
    onDateChange(selectedDate);
    if (selectedDate) {
      setInputValue(formatDateForUI(selectedDate));
    }
    setOpen(false);
  };

  /**
   * Handle manual text input changes
   * Parses input in DD/MM/YYYY format and updates the date if valid
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    if (value === "") {
      onDateChange(undefined);
    } else {
      // Only attempt to parse and validate if we have a full input
      // (otherwise, we"d be showing validation errors while the user is still typing)
      if (value.length === 10) {
        // DD/MM/YYYY = 10 characters
        const parsedDate = parseUIDate(value);
        if (parsedDate) {
          onDateChange(parsedDate);
          setMonth(parsedDate);
        } else {
          // If the format matches DD/MM/YYYY but parsing failed, it's likely an invalid date
          if (value.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            onDateChange(undefined);
            // Let the validation show the error - don't set it directly here
          }
        }
      }
    }
  };

  /**
   * Handle popover open/close events
   * Resets the calendar view to the current month when opening
   */
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
          <p className="text-xs font-medium text-destructive mt-1.5 flex items-center">
            <AlertCircle className="w-3 h-3 mr-1.5 flex-shrink-0" />
            {error}
          </p>
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
      {error && (
        <p className="text-xs font-medium text-destructive mt-1.5 flex items-center">
          <AlertCircle className="w-3 h-3 mr-1.5 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
