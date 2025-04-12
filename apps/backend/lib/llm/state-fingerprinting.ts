/**
 * State fingerprinting utilities for LangGraph workflows.
 * 
 * This module provides functions to create hashable representations of states
 * to detect cycles and prevent infinite loops during workflow execution.
 */

import { createHash } from 'crypto';

/**
 * Options for fingerprinting state objects.
 */
export interface FingerprintOptions {
  /**
   * Fields to include in the fingerprint. If empty, all fields are included.
   */
  includeFields?: string[];
  
  /**
   * Fields to exclude from the fingerprint.
   */
  excludeFields?: string[];
  
  /**
   * Whether to sort object keys for consistent output.
   */
  sortKeys?: boolean;
  
  /**
   * Function to normalize values before fingerprinting.
   */
  normalizeValue?: (value: any, path: string) => any;
  
  /**
   * Hash algorithm to use (default: 'sha256').
   */
  hashAlgorithm?: string;
  
  /**
   * Maximum length of state history to maintain.
   */
  maxHistoryLength?: number;
  
  /**
   * Field name where state history is stored.
   */
  historyField?: string;
  
  /**
   * Number of repetitions required to consider a pattern a cycle.
   */
  cycleDetectionThreshold?: number;
  
  /**
   * Minimum length of a cycle to detect.
   */
  minCycleLength?: number;
  
  /**
   * Maximum length of a cycle to detect.
   */
  maxCycleLength?: number;
}

/**
 * Default fingerprinting options.
 */
export const DEFAULT_FINGERPRINT_OPTIONS: FingerprintOptions = {
  sortKeys: true,
  hashAlgorithm: 'sha256',
  maxHistoryLength: 50,
  historyField: 'stateHistory',
  cycleDetectionThreshold: 2,
  minCycleLength: 2,
  maxCycleLength: 10,
};

/**
 * Creates a fingerprint for a state object.
 * 
 * @param state - State object to fingerprint
 * @param options - Fingerprinting options
 * @returns Fingerprint string
 */
export function createStateFingerprint(
  state: Record<string, any>,
  options: FingerprintOptions = {}
): string {
  const mergedOptions = { ...DEFAULT_FINGERPRINT_OPTIONS, ...options };
  
  // Create a copy of the state to work with
  let stateToFingerprint = { ...state };
  
  // Remove history field itself from fingerprinting to avoid recursion
  if (mergedOptions.historyField) {
    delete stateToFingerprint[mergedOptions.historyField];
  }
  
  // Filter fields if specified
  if (mergedOptions.includeFields && mergedOptions.includeFields.length > 0) {
    const filteredState: Record<string, any> = {};
    for (const field of mergedOptions.includeFields) {
      if (field.includes('.')) {
        // Handle nested fields
        const parts = field.split('.');
        let current = stateToFingerprint;
        let target = filteredState;
        
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!(part in current)) break;
          
          if (!(part in target)) {
            target[part] = {};
          }
          
          current = current[part];
          target = target[part];
        }
        
        const lastPart = parts[parts.length - 1];
        if (lastPart in current) {
          target[lastPart] = current[lastPart];
        }
      } else if (field in stateToFingerprint) {
        filteredState[field] = stateToFingerprint[field];
      }
    }
    stateToFingerprint = filteredState;
  }
  
  // Exclude specified fields
  if (mergedOptions.excludeFields && mergedOptions.excludeFields.length > 0) {
    for (const field of mergedOptions.excludeFields) {
      if (field.includes('.')) {
        // Handle nested fields
        const parts = field.split('.');
        let current = stateToFingerprint;
        
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!(part in current)) break;
          current = current[part];
        }
        
        const lastPart = parts[parts.length - 1];
        if (lastPart in current) {
          delete current[lastPart];
        }
      } else {
        delete stateToFingerprint[field];
      }
    }
  }
  
  // Apply normalization if specified
  if (mergedOptions.normalizeValue) {
    stateToFingerprint = deepMap(stateToFingerprint, mergedOptions.normalizeValue);
  }
  
  // Create string representation
  let stateString: string;
  if (mergedOptions.sortKeys) {
    stateString = JSON.stringify(stateToFingerprint, getSortedReplacer());
  } else {
    stateString = JSON.stringify(stateToFingerprint);
  }
  
  // Create hash
  const algorithm = mergedOptions.hashAlgorithm || 'sha256';
  const hash = createHash(algorithm).update(stateString).digest('hex');
  
  return hash;
}

/**
 * Applies a transformation function to all values in a nested object.
 * 
 * @param obj - Object to transform
 * @param fn - Function to apply to each value
 * @param path - Current path (for nested objects)
 * @returns Transformed object
 */
export function deepMap(
  obj: any,
  fn: (value: any, path: string) => any,
  path: string = ''
): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map((item, index) => {
      const itemPath = path ? `${path}.${index}` : `${index}`;
      return deepMap(item, fn, itemPath);
    });
  }
  
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(obj)) {
      const valuePath = path ? `${path}.${key}` : key;
      result[key] = deepMap(value, fn, valuePath);
    }
    
    return result;
  }
  
  // Apply function to leaf values
  return fn(obj, path);
}

/**
 * Creates a replacer function for sorting object keys during JSON stringification.
 * 
 * @returns Replacer function for JSON.stringify
 */
export function getSortedReplacer(): (key: string, value: any) => any {
  return (key: string, value: any) => {
    if (value === null || value === undefined) {
      return value;
    }
    
    if (typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }
    
    return Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((result, key) => {
        result[key] = value[key];
        return result;
      }, {});
  };
}

/**
 * Compares two states for equivalence using fingerprints.
 * 
 * @param state1 - First state
 * @param state2 - Second state
 * @param options - Fingerprinting options
 * @returns True if states are equivalent
 */
export function areStatesEquivalent(
  state1: Record<string, any>,
  state2: Record<string, any>,
  options: FingerprintOptions = {}
): boolean {
  const fingerprint1 = createStateFingerprint(state1, options);
  const fingerprint2 = createStateFingerprint(state2, options);
  
  return fingerprint1 === fingerprint2;
}

/**
 * Detects cycles in an array of state fingerprints.
 * 
 * @param fingerprints - Array of state fingerprints
 * @param options - Detection options
 * @returns Object with cycle information
 */
export function detectCycles(
  fingerprints: string[],
  options: FingerprintOptions = {}
): {
  cycleDetected: boolean;
  cycleLength?: number;
  repetitions?: number;
  cycleStartIndex?: number;
} {
  const mergedOptions = { ...DEFAULT_FINGERPRINT_OPTIONS, ...options };
  const minLength = mergedOptions.minCycleLength || 2;
  const maxLength = mergedOptions.maxCycleLength || 10;
  const threshold = mergedOptions.cycleDetectionThreshold || 2;
  
  // Check for cycles of different lengths
  for (let length = minLength; length <= maxLength; length++) {
    // Need at least 2*length items to detect a cycle of length 'length'
    if (fingerprints.length < length * threshold) {
      continue;
    }
    
    // Check for cycle at the end of the history
    const potentialCycle = fingerprints.slice(-length);
    const previousSection = fingerprints.slice(-(length * 2), -length);
    
    if (areSectionsEqual(potentialCycle, previousSection)) {
      // Count how many times this cycle repeats
      let repetitions = 2; // We already found 2 occurrences
      let cycleStartIndex = fingerprints.length - (length * 2);
      
      // Count additional repetitions going backwards
      while (cycleStartIndex >= length) {
        const earlierSection = fingerprints.slice(
          cycleStartIndex - length,
          cycleStartIndex
        );
        
        if (areSectionsEqual(potentialCycle, earlierSection)) {
          repetitions++;
          cycleStartIndex -= length;
        } else {
          break;
        }
      }
      
      if (repetitions >= threshold) {
        return {
          cycleDetected: true,
          cycleLength: length,
          repetitions,
          cycleStartIndex,
        };
      }
    }
  }
  
  return { cycleDetected: false };
}

/**
 * Compares two arrays of fingerprints for equality.
 * 
 * @param section1 - First array of fingerprints
 * @param section2 - Second array of fingerprints
 * @returns True if sections are equal
 */
function areSectionsEqual(section1: string[], section2: string[]): boolean {
  if (section1.length !== section2.length) {
    return false;
  }
  
  for (let i = 0; i < section1.length; i++) {
    if (section1[i] !== section2[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Ensures that the state history does not exceed a specified maximum length.
 * 
 * @param fingerprints - Array of state fingerprints
 * @param maxLength - Maximum history length
 * @returns Pruned array of fingerprints
 */
export function pruneStateHistory(
  fingerprints: string[],
  maxLength: number
): string[] {
  if (fingerprints.length <= maxLength) {
    return fingerprints;
  }
  
  return fingerprints.slice(-maxLength);
}

/**
 * Updates a state with a new fingerprint and prunes history if necessary.
 * 
 * @param state - State object
 * @param options - Fingerprinting options
 * @returns Updated state
 */
export function prepareStateForTracking(
  state: Record<string, any>,
  options: FingerprintOptions = {}
): Record<string, any> {
  const mergedOptions = { ...DEFAULT_FINGERPRINT_OPTIONS, ...options };
  const historyField = mergedOptions.historyField || 'stateHistory';
  const maxLength = mergedOptions.maxHistoryLength || 50;
  
  // Generate fingerprint for current state
  const fingerprint = createStateFingerprint(state, mergedOptions);
  
  // Get existing history or initialize
  const existingHistory = Array.isArray(state[historyField])
    ? state[historyField]
    : [];
  
  // Add new fingerprint and prune if necessary
  const updatedHistory = pruneStateHistory(
    [...existingHistory, fingerprint],
    maxLength
  );
  
  // Return updated state
  return {
    ...state,
    [historyField]: updatedHistory,
  };
}

/**
 * Checks if a specific field has changed between two states.
 * 
 * @param prevState - Previous state
 * @param currentState - Current state
 * @param field - Field to check (supports dot notation)
 * @returns True if field has changed
 */
export function hasFieldChanged(
  prevState: Record<string, any>,
  currentState: Record<string, any>,
  field: string
): boolean {
  const prevValue = getNestedValue(prevState, field);
  const currentValue = getNestedValue(currentState, field);
  
  return !isDeepEqual(prevValue, currentValue);
}

/**
 * Gets a nested value from an object using dot notation.
 * 
 * @param obj - Object to get value from
 * @param path - Path to the value using dot notation
 * @returns The value at the specified path or undefined
 */
export function getNestedValue(obj: Record<string, any>, path: string): any {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    
    current = current[key];
  }
  
  return current;
}

/**
 * Performs a deep equality check between two values.
 * 
 * @param a - First value
 * @param b - Second value
 * @returns True if values are deeply equal
 */
export function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!isDeepEqual(a[key], b[key])) return false;
    }
    
    return true;
  }
  
  return false;
}