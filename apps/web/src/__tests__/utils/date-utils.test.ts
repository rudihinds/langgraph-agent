import {
  formatDateForUI,
  formatDateForAPI,
  parseUIDate,
  parseAPIDate,
  toAPIDate,
  toDateObject,
  DATE_FORMATS
} from '@/lib/utils/date-utils';

describe('Date Utilities', () => {
  // Valid test date: January 15, 2024
  const testDate = new Date(2024, 0, 15);
  const testDateISO = '2024-01-15';
  const testDateUI = '15/01/2024';

  describe('formatDateForUI', () => {
    it('formats a valid date to UI format (DD/MM/YYYY)', () => {
      expect(formatDateForUI(testDate)).toBe(testDateUI);
    });

    it('returns empty string for null/undefined input', () => {
      expect(formatDateForUI(null)).toBe('');
      expect(formatDateForUI(undefined)).toBe('');
    });

    it('returns empty string for invalid date', () => {
      expect(formatDateForUI(new Date('invalid-date'))).toBe('');
    });
  });

  describe('formatDateForAPI', () => {
    it('formats a valid date to API format (YYYY-MM-DD)', () => {
      expect(formatDateForAPI(testDate)).toBe(testDateISO);
    });

    it('returns null for null/undefined input', () => {
      expect(formatDateForAPI(null)).toBeNull();
      expect(formatDateForAPI(undefined)).toBeNull();
    });

    it('returns null for invalid date', () => {
      expect(formatDateForAPI(new Date('invalid-date'))).toBeNull();
    });
  });

  describe('parseUIDate', () => {
    it('parses a valid UI formatted date string to Date object', () => {
      const result = parseUIDate(testDateUI);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0); // January is 0
      expect(result?.getDate()).toBe(15);
    });

    it('returns null for empty/null input', () => {
      expect(parseUIDate('')).toBeNull();
      expect(parseUIDate(null as unknown as string)).toBeNull();
    });

    it('returns null for invalid date format', () => {
      expect(parseUIDate('15-01-2024')).toBeNull();
      expect(parseUIDate('2024/01/15')).toBeNull();
      expect(parseUIDate('abc')).toBeNull();
    });
  });

  describe('parseAPIDate', () => {
    it('parses a valid API formatted date string to Date object', () => {
      const result = parseAPIDate(testDateISO);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0); // January is 0
      expect(result?.getDate()).toBe(15);
    });

    it('returns null for empty/null input', () => {
      expect(parseAPIDate('')).toBeNull();
      expect(parseAPIDate(null as unknown as string)).toBeNull();
    });

    it('returns null for invalid date format', () => {
      expect(parseAPIDate('15/01/2024')).toBeNull();
      expect(parseAPIDate('01-15-2024')).toBeNull();
      expect(parseAPIDate('abc')).toBeNull();
    });
  });

  describe('toAPIDate', () => {
    it('converts Date object to API format', () => {
      expect(toAPIDate(testDate)).toBe(testDateISO);
    });

    it('converts UI format string to API format', () => {
      expect(toAPIDate(testDateUI)).toBe(testDateISO);
    });

    it('keeps API format string as is', () => {
      expect(toAPIDate(testDateISO)).toBe(testDateISO);
    });

    it('returns null for invalid inputs', () => {
      expect(toAPIDate(null)).toBeNull();
      expect(toAPIDate(undefined)).toBeNull();
      expect(toAPIDate('invalid-date')).toBeNull();
    });
  });

  describe('toDateObject', () => {
    it('returns the same Date object if valid', () => {
      expect(toDateObject(testDate)).toEqual(testDate);
    });

    it('converts UI format string to Date object', () => {
      const result = toDateObject(testDateUI);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0);
      expect(result?.getDate()).toBe(15);
    });

    it('converts API format string to Date object', () => {
      const result = toDateObject(testDateISO);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0);
      expect(result?.getDate()).toBe(15);
    });

    it('returns null for invalid inputs', () => {
      expect(toDateObject(null)).toBeNull();
      expect(toDateObject(undefined)).toBeNull();
      expect(toDateObject('invalid-date')).toBeNull();
      expect(toDateObject(new Date('invalid-date'))).toBeNull();
    });
  });
}); 