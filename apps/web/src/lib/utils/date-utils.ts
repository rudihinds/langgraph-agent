import { format, parse, isValid, isDate } from "date-fns";

/**
 * Standard date format constants
 */
export const DATE_FORMATS = {
  /**
   * British date format (DD/MM/YYYY)
   */
  UI: "dd/MM/yyyy",

  /**
   * ISO date format (YYYY-MM-DD)
   */
  API: "yyyy-MM-dd",
};

/**
 * Format a Date object to UI format (DD/MM/YYYY)
 */
export function formatDateForUI(date?: Date | null): string {
  if (!date || !isDate(date) || !isValid(date)) return "";
  return format(date, DATE_FORMATS.UI);
}

/**
 * Format a Date object to API format (YYYY-MM-DD)
 */
export function formatDateForAPI(date?: Date | null): string | null {
  if (!date || !isDate(date) || !isValid(date)) return null;
  return format(date, DATE_FORMATS.API);
}

/**
 * Parse a date string in UI format (DD/MM/YYYY) to a Date object
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
 * Parse a date string in API format (YYYY-MM-DD) to a Date object
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
 * Converts any valid date input to an API format string (YYYY-MM-DD)
 */
export function toAPIDate(
  input: Date | string | null | undefined
): string | null {
  if (!input) return null;

  // If already a Date object
  if (input instanceof Date) {
    return formatDateForAPI(input);
  }

  // If it's a string, try parsing as UI format first
  const uiDate = parseUIDate(input);
  if (uiDate) return formatDateForAPI(uiDate);

  // Then try parsing as API format
  const apiDate = parseAPIDate(input);
  if (apiDate) return formatDateForAPI(apiDate);

  // If all parsing fails
  return null;
}

/**
 * Converts any valid date input to a Date object
 */
export function toDateObject(
  input: Date | string | null | undefined
): Date | null {
  if (!input) return null;

  // If already a Date object
  if (input instanceof Date) {
    return isValid(input) ? input : null;
  }

  // If it's a string, try parsing as UI format first
  const uiDate = parseUIDate(input);
  if (uiDate) return uiDate;

  // Then try parsing as API format
  const apiDate = parseAPIDate(input);
  if (apiDate) return apiDate;

  // If all parsing fails
  return null;
}
