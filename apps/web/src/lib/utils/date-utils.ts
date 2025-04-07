import { format, parse, isValid } from "date-fns";

/**
 * Constants for date formats used in the application
 */
export const DATE_FORMATS = {
  /** Format used in UI display (British format) */
  UI: "dd/MM/yyyy",
  /** Format required by API (ISO-like) */
  API: "yyyy-MM-dd",
};

/**
 * Formats a Date object for display in the UI (DD/MM/YYYY)
 * @param date The date to format
 * @returns Formatted date string or empty string if date is invalid/undefined
 */
export function formatDateForUI(date?: Date | null): string {
  if (!date || !isValid(date)) return "";
  return format(date, DATE_FORMATS.UI);
}

/**
 * Formats a Date object for API submission (YYYY-MM-DD)
 * @param date The date to format
 * @returns Formatted date string or null if date is invalid/undefined
 */
export function formatDateForAPI(date?: Date | null): string | null {
  if (!date || !isValid(date)) return null;
  return format(date, DATE_FORMATS.API);
}

/**
 * Parses a UI-formatted string (DD/MM/YYYY) into a Date object
 * @param dateString The date string to parse
 * @returns Date object or null if invalid
 */
export function parseUIDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  try {
    const parsedDate = parse(dateString, DATE_FORMATS.UI, new Date());
    return isValid(parsedDate) ? parsedDate : null;
  } catch (error) {
    return null;
  }
}

/**
 * Parses an API-formatted string (YYYY-MM-DD) into a Date object
 * @param dateString The date string to parse
 * @returns Date object or null if invalid
 */
export function parseAPIDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  try {
    const parsedDate = parse(dateString, DATE_FORMATS.API, new Date());
    return isValid(parsedDate) ? parsedDate : null;
  } catch (error) {
    return null;
  }
}

/**
 * Safely converts any date format to API format
 * @param date Date object, UI formatted string, or API formatted string
 * @returns API formatted date string or null
 */
export function toAPIDate(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  
  if (date instanceof Date) {
    return formatDateForAPI(date);
  }
  
  // Try parsing as UI format first
  let parsed = parseUIDate(date);
  
  // If that fails, try parsing as API format
  if (!parsed) {
    parsed = parseAPIDate(date);
  }
  
  return formatDateForAPI(parsed);
}

/**
 * Safely converts any date format to a Date object
 * @param date Date object, UI formatted string, or API formatted string 
 * @returns Date object or null
 */
export function toDateObject(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  
  if (date instanceof Date) {
    return isValid(date) ? date : null;
  }
  
  // Try parsing as UI format first
  const parsedUI = parseUIDate(date);
  if (parsedUI) return parsedUI;
  
  // Try parsing as API format
  const parsedAPI = parseAPIDate(date);
  return parsedAPI;
} 