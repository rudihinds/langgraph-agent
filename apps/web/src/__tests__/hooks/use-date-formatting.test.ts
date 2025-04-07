import { renderHook } from '@testing-library/react';
import { useDateFormatting } from '@/hooks/use-date-formatting';

// Create custom hook file if it doesn't exist
// Assuming we'll add this hook at apps/web/src/hooks/use-date-formatting.ts

describe('useDateFormatting', () => {
  // Test date: January 15, 2024
  const testDate = new Date(2024, 0, 15);
  const testDateISO = '2024-01-15';
  const testDateUI = '15/01/2024';
  const testDateHuman = 'January 15, 2024';

  it('provides formatting utilities for UI display', () => {
    const { result } = renderHook(() => useDateFormatting());

    // Format a date for UI display (DD/MM/YYYY)
    expect(result.current.formatForUI(testDate)).toBe(testDateUI);
    
    // Format a date for human-readable display
    expect(result.current.formatForHuman(testDate)).toBe(testDateHuman);
  });

  it('provides formatting utilities for API submission', () => {
    const { result } = renderHook(() => useDateFormatting());

    // Format a date for API submission (YYYY-MM-DD)
    expect(result.current.formatForAPI(testDate)).toBe(testDateISO);
  });

  it('provides parsing utilities for different date formats', () => {
    const { result } = renderHook(() => useDateFormatting());

    // Parse a UI-formatted date string
    const parsedFromUI = result.current.parseFromUI(testDateUI);
    expect(parsedFromUI).toBeInstanceOf(Date);
    expect(parsedFromUI?.getFullYear()).toBe(2024);
    expect(parsedFromUI?.getMonth()).toBe(0);
    expect(parsedFromUI?.getDate()).toBe(15);

    // Parse an API-formatted date string
    const parsedFromAPI = result.current.parseFromAPI(testDateISO);
    expect(parsedFromAPI).toBeInstanceOf(Date);
    expect(parsedFromAPI?.getFullYear()).toBe(2024);
    expect(parsedFromAPI?.getMonth()).toBe(0);
    expect(parsedFromAPI?.getDate()).toBe(15);
  });

  it('provides converter utilities for switching between formats', () => {
    const { result } = renderHook(() => useDateFormatting());

    // Convert UI format to API format
    expect(result.current.convertUIToAPI(testDateUI)).toBe(testDateISO);

    // Convert API format to UI format
    expect(result.current.convertAPIToUI(testDateISO)).toBe(testDateUI);
  });

  it('handles invalid date inputs gracefully', () => {
    const { result } = renderHook(() => useDateFormatting());

    // Test with invalid inputs
    expect(result.current.formatForUI(undefined)).toBe('');
    expect(result.current.formatForAPI(null)).toBeNull();
    expect(result.current.parseFromUI('invalid')).toBeNull();
    expect(result.current.parseFromAPI('invalid')).toBeNull();
    expect(result.current.convertUIToAPI('invalid')).toBeNull();
    expect(result.current.convertAPIToUI('invalid')).toBe('');
  });

  it('provides a validator for date strings', () => {
    const { result } = renderHook(() => useDateFormatting());

    // Valid dates
    expect(result.current.isValidUIFormat(testDateUI)).toBe(true);
    expect(result.current.isValidAPIFormat(testDateISO)).toBe(true);

    // Invalid dates
    expect(result.current.isValidUIFormat('2024-01-15')).toBe(false);
    expect(result.current.isValidAPIFormat('15/01/2024')).toBe(false);
    expect(result.current.isValidUIFormat('35/01/2024')).toBe(false); // Invalid day
    expect(result.current.isValidAPIFormat('2024-13-15')).toBe(false); // Invalid month
  });
}); 