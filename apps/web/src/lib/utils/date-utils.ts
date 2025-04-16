/**
 * Date utilities for consistent date handling across the application.
 * 
 * These functions provide a standardized way to convert between:
 * - UI dates (DD/MM/YYYY) - Used in the user interface
 * - API dates (YYYY-MM-DD) - Used when communicating with the backend
 * - JavaScript Date objects - Used in application logic
 */

import { format, parse, isValid } from "date-fns";

/**
 * Format a Date object for display in the UI
 * @param date - The Date object to format
 * @returns The formatted date string in DD/MM/YYYY format
 */
export function formatDateForUI(date: Date | null | undefined): string {
  if (!date || !isValid(date)) return "";
  return format(date, "dd/MM/yyyy");
}

/**
 * Format a Date object for sending to the API
 * @param date - The Date object to format
 * @returns The formatted date string in YYYY-MM-DD format
 */
export function formatDateForAPI(date: Date | null | undefined): string {
  if (!date || !isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}

/**
 * Parse a date string from the UI format into a Date object
 * @param input - The date string in DD/MM/YYYY format
 * @returns A Date object, or null if parsing fails
 */
export function parseUIDate(input: string): Date | null {
  if (!input) return null;
  
  try {
    // Validate date format with regex
    if (!input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)) {
      return null;
    }
    
    const parsedDate = parse(input, "dd/MM/yyyy", new Date());
    return isValid(parsedDate) ? parsedDate : null;
  } catch (error) {
    console.error("Failed to parse UI date:", error);
    return null;
  }
}

/**
 * Parse a date string from the API format into a Date object
 * @param input - The date string in YYYY-MM-DD format
 * @returns A Date object, or null if parsing fails
 */
function parseAPIDate(input: string): Date | null {
  if (!input) return null;
  
  try {
    // Validate date format with regex
    if (!input.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return null;
    }
    
    const parsedDate = parse(input, "yyyy-MM-dd", new Date());
    return isValid(parsedDate) ? parsedDate : null;
  } catch (error) {
    console.error("Failed to parse API date:", error);
    return null;
  }
}

/**
 * Check if a string is a valid date in UI format (DD/MM/YYYY)
 * @param input - The date string to validate
 * @returns True if the date is valid
 */
function isValidUIDate(input: string): boolean {
  return !!parseUIDate(input);
}

/**
 * Check if a string is a valid date in API format (YYYY-MM-DD)
 * @param input - The date string to validate
 * @returns True if the date is valid
 */
function isValidAPIDate(input: string): boolean {
  return !!parseAPIDate(input);
}