import { format, parse, isValid, isDate } from 'date-fns';
import { DATE_FORMATS } from '@/lib/utils/date-utils';

/**
 * Hook that provides utilities for consistent date formatting across the application
 */
export function useDateFormatting() {
  /**
   * Format a date for UI display (DD/MM/YYYY)
   */
  const formatForUI = (date?: Date | null): string => {
    if (!date || !isDate(date) || !isValid(date)) return '';
    return format(date, DATE_FORMATS.UI);
  };

  /**
   * Format a date for API submission (YYYY-MM-DD)
   */
  const formatForAPI = (date?: Date | null): string | null => {
    if (!date || !isDate(date) || !isValid(date)) return null;
    return format(date, DATE_FORMATS.API);
  };

  /**
   * Format a date for human-readable display (e.g., "January 15, 2024")
   */
  const formatForHuman = (date?: Date | null): string => {
    if (!date || !isDate(date) || !isValid(date)) return '';
    return format(date, 'MMMM d, yyyy');
  };

  /**
   * Parse a UI-formatted date string (DD/MM/YYYY) into a Date object
   */
  const parseFromUI = (dateString: string): Date | null => {
    if (!dateString) return null;
    try {
      const parsedDate = parse(dateString, DATE_FORMATS.UI, new Date());
      return isValid(parsedDate) ? parsedDate : null;
    } catch (error) {
      return null;
    }
  };

  /**
   * Parse an API-formatted date string (YYYY-MM-DD) into a Date object
   */
  const parseFromAPI = (dateString: string): Date | null => {
    if (!dateString) return null;
    try {
      const parsedDate = parse(dateString, DATE_FORMATS.API, new Date());
      return isValid(parsedDate) ? parsedDate : null;
    } catch (error) {
      return null;
    }
  };

  /**
   * Convert a UI-formatted date string to API format
   */
  const convertUIToAPI = (dateString: string): string | null => {
    const date = parseFromUI(dateString);
    return formatForAPI(date);
  };

  /**
   * Convert an API-formatted date string to UI format
   */
  const convertAPIToUI = (dateString: string): string => {
    const date = parseFromAPI(dateString);
    return formatForUI(date);
  };

  /**
   * Check if a string is a valid UI-formatted date (DD/MM/YYYY)
   */
  const isValidUIFormat = (dateString: string): boolean => {
    if (!dateString) return false;
    if (!dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) return false;

    const date = parseFromUI(dateString);
    if (!date) return false;

    // Additional check to make sure the day and month are valid
    // by comparing with original string (deals with day/month rollover)
    const formattedBack = formatForUI(date);
    return formattedBack === dateString;
  };

  /**
   * Check if a string is a valid API-formatted date (YYYY-MM-DD)
   */
  const isValidAPIFormat = (dateString: string): boolean => {
    if (!dateString) return false;
    if (!dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return false;

    const date = parseFromAPI(dateString);
    if (!date) return false;

    // Additional check to make sure the day and month are valid
    // by comparing with original string (deals with day/month rollover)
    const formattedBack = formatForAPI(date);
    return formattedBack === dateString;
  };

  return {
    formatForUI,
    formatForAPI,
    formatForHuman,
    parseFromUI,
    parseFromAPI,
    convertUIToAPI,
    convertAPIToUI,
    isValidUIFormat,
    isValidAPIFormat,
  };
} 