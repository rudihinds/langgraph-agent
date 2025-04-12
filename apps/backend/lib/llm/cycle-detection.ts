/**
 * Cycle detection module for LangGraph workflows
 * 
 * This module provides utilities for detecting cycles in state transitions
 * by creating "fingerprints" of states and comparing them to detect repetition.
 */

import { createHash } from "crypto";
import { NodeReference } from "langchain/graphs/state";

/**
 * Configuration options for state fingerprinting
 */
export interface StateFingerprintOptions {
  /** Fields to include in the fingerprint calculation */
  includeFields?: string[];
  
  /** Fields to exclude from the fingerprint calculation */
  excludeFields?: string[];
  
  /** Number of consecutive identical states to consider as a cycle */
  cycleThreshold?: number;
  
  /** 
   * Function to customize state normalization before fingerprinting 
   * Useful for ignoring timestamp fields or other values that change but don't indicate progress
   */
  normalizeState?: (state: any) => any;
}

/**
 * Structure representing a moment in the state history
 */
export interface StateHistoryEntry {
  /** Name of the node that created this state */
  nodeName: string;
  
  /** Original state object (for debugging and analysis) */
  originalState: any;
  
  /** The fingerprint hash representing this state */
  fingerprint: string;
  
  /** Timestamp when this state was recorded */
  timestamp?: number;
}

/**
 * Creates a fingerprint (hash) of the state to use for cycle detection
 * 
 * @param state The state object to fingerprint
 * @param options Configuration options for fingerprinting
 * @param nodeName Name of the current node (used for history tracking)
 * @returns A state history entry with the fingerprint
 */
export function createStateFingerprint(
  state: any,
  options: StateFingerprintOptions = {},
  nodeName: string
): StateHistoryEntry {
  // Create a copy of the state to normalize
  let stateToFingerprint = { ...state };
  
  // Remove the stateHistory and loopDetection fields to avoid circular references
  delete stateToFingerprint.stateHistory;
  delete stateToFingerprint.loopDetection;
  delete stateToFingerprint._iterationCount;
  
  // Apply custom normalization if provided
  if (options.normalizeState) {
    stateToFingerprint = options.normalizeState(stateToFingerprint);
  }
  
  // Filter fields if specified
  if (options.includeFields?.length) {
    const filteredState: Record<string, any> = {};
    for (const field of options.includeFields) {
      if (field in stateToFingerprint) {
        filteredState[field] = stateToFingerprint[field];
      }
    }
    stateToFingerprint = filteredState;
  } else if (options.excludeFields?.length) {
    for (const field of options.excludeFields) {
      delete stateToFingerprint[field];
    }
  }
  
  // Generate hash from the normalized state
  const hash = createHash("sha256")
    .update(JSON.stringify(stateToFingerprint))
    .digest("hex");
  
  return {
    nodeName,
    originalState: state,
    fingerprint: hash,
    timestamp: Date.now()
  };
}

/**
 * Detects cycles in state history based on fingerprint comparisons
 * 
 * @param stateHistory Array of state history entries
 * @param options Configuration options for cycle detection
 * @returns Object with cycle detection results
 */
export function detectCycle(
  stateHistory: StateHistoryEntry[],
  options: StateFingerprintOptions = {}
): {
  cycleDetected: boolean;
  cycleLength?: number;
  repetitions?: number;
  lastUniqueStateIndex?: number;
} {
  if (!stateHistory || stateHistory.length <= 1) {
    return { cycleDetected: false };
  }
  
  const threshold = options.cycleThreshold || 3;
  const latestFingerprint = stateHistory[stateHistory.length - 1].fingerprint;
  
  // Count occurrences of the latest fingerprint
  let count = 0;
  for (let i = stateHistory.length - 1; i >= 0; i--) {
    if (stateHistory[i].fingerprint === latestFingerprint) {
      count++;
      if (count >= threshold) {
        // Find cycle length by looking for patterns in history
        const cycleLength = detectCycleLength(stateHistory);
        return {
          cycleDetected: true,
          cycleLength,
          repetitions: Math.floor(count / (cycleLength || 1)),
          lastUniqueStateIndex: findLastUniqueStateIndex(stateHistory)
        };
      }
    }
  }
  
  return { cycleDetected: false };
}

/**
 * Analyzes state history to detect if progress is being made
 * 
 * @param stateHistory Array of state history entries
 * @param progressField Field to check for progress (number or array)
 * @returns Whether progress is being made
 */
export function isProgressDetected(
  stateHistory: StateHistoryEntry[],
  progressField: string
): boolean {
  if (!stateHistory || stateHistory.length <= 1) {
    return true; // Not enough history to determine lack of progress
  }
  
  const currentState = stateHistory[stateHistory.length - 1].originalState;
  const previousState = stateHistory[stateHistory.length - 2].originalState;
  
  // Handle nested fields using dot notation (e.g., "research.items")
  const getCurrentValue = (obj: any, path: string) => {
    return path.split('.').reduce((o, key) => (o ? o[key] : undefined), obj);
  };
  
  const currentValue = getCurrentValue(currentState, progressField);
  const previousValue = getCurrentValue(previousState, progressField);
  
  if (currentValue === undefined || previousValue === undefined) {
    return true; // Can't determine progress if field is missing
  }
  
  // For numeric progress
  if (typeof currentValue === 'number' && typeof previousValue === 'number') {
    return currentValue !== previousValue;
  }
  
  // For array length progress
  if (Array.isArray(currentValue) && Array.isArray(previousValue)) {
    return currentValue.length !== previousValue.length;
  }
  
  // For string length progress
  if (typeof currentValue === 'string' && typeof previousValue === 'string') {
    return currentValue.length !== previousValue.length;
  }
  
  // Default case - use JSON.stringify to check for any differences
  return JSON.stringify(currentValue) !== JSON.stringify(previousValue);
}

/**
 * Attempts to detect the length of a cycle in the state history
 * 
 * @param stateHistory Array of state history entries
 * @returns The detected cycle length or undefined if no clear cycle
 */
function detectCycleLength(stateHistory: StateHistoryEntry[]): number | undefined {
  if (stateHistory.length < 2) return undefined;
  
  const fingerprints = stateHistory.map(entry => entry.fingerprint);
  
  // Try cycle lengths from 1 to half the history length
  for (let length = 1; length <= Math.floor(fingerprints.length / 2); length++) {
    let isCycle = true;
    
    // Check if the last 'length' elements repeat the previous 'length' elements
    for (let i = 0; i < length; i++) {
      const lastIndex = fingerprints.length - 1 - i;
      const previousIndex = lastIndex - length;
      
      if (previousIndex < 0 || fingerprints[lastIndex] !== fingerprints[previousIndex]) {
        isCycle = false;
        break;
      }
    }
    
    if (isCycle) {
      return length;
    }
  }
  
  return undefined;
}

/**
 * Finds the index of the last unique state before cycles began
 * 
 * @param stateHistory Array of state history entries
 * @returns Index of the last unique state or 0 if none found
 */
function findLastUniqueStateIndex(stateHistory: StateHistoryEntry[]): number {
  if (stateHistory.length <= 1) return 0;
  
  const lastFingerprint = stateHistory[stateHistory.length - 1].fingerprint;
  
  // Find the first occurrence of the last fingerprint
  for (let i = 0; i < stateHistory.length - 1; i++) {
    if (stateHistory[i].fingerprint === lastFingerprint) {
      // Return the index before the first repetition
      return Math.max(0, i - 1);
    }
  }
  
  return 0;
}

/**
 * Removes cycles from state history to recover from loops
 * 
 * @param stateHistory The original state history
 * @param cycleResults Results from the detectCycle function
 * @returns A new state history with cycles removed
 */
export function pruneStateHistory(
  stateHistory: StateHistoryEntry[],
  cycleResults: ReturnType<typeof detectCycle>
): StateHistoryEntry[] {
  if (!cycleResults.cycleDetected || !cycleResults.lastUniqueStateIndex) {
    return [...stateHistory];
  }
  
  // Keep history up to the last unique state
  return stateHistory.slice(0, cycleResults.lastUniqueStateIndex + 1);
}

/**
 * Type guard to check if a node output includes "next" property
 * This is used to detect if a node is directing the workflow to a specific next node
 */
export function hasNextProperty<T>(obj: T): obj is T & { next: string | NodeReference } {
  return obj !== null && 
         typeof obj === 'object' && 
         'next' in obj && 
         (typeof (obj as any).next === 'string' || 
          typeof (obj as any).next === 'object');
}