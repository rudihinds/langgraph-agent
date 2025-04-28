"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerProps {
  date: Date | undefined;
  setDate: (date: Date | undefined) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
  formatString?: string;
}

export function DatePicker({
  date,
  setDate,
  label,
  placeholder = "Pick a date",
  disabled = false,
  error,
  className,
  formatString = "PPP",
}: DatePickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <Popover>
        <PopoverTrigger asChild>
          <div className="cursor-pointer hover:opacity-90 transition-opacity w-full">
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground",
                error && "border-destructive",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              disabled={disabled}
            >
              <div className="flex w-full items-center">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, formatString) : placeholder}
              </div>
            </Button>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
            className="border rounded-md shadow-sm"
            classNames={{
              day_selected:
                "bg-primary text-primary-foreground font-medium hover:bg-primary hover:text-primary-foreground focus:ring-2 focus:ring-primary focus:ring-offset-2",
              head_row: "flex",
              head_cell:
                "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] py-1.5",
              day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 data-[state=inactive]:opacity-50 cursor-pointer hover:bg-accent transition-colors",
              caption: "flex justify-center pt-1 relative items-center mb-2",
              caption_label: "text-sm font-medium",
              nav: "space-x-1 flex items-center",
              nav_button:
                "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 transition-opacity",
              table: "w-full border-collapse space-y-1",
            }}
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
