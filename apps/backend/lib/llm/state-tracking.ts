/**
 * State tracking utilities for LangGraph workflows.
 * 
 * This module provides functions to track state history, detect cycles,
 * and analyze state transitions to prevent infinite loops.
 */

import { createStateFingerprint, detectCycles, FingerprintOptions, prepareStateForTracking } from './state-fingerprinting';

/**
 * Interface to track state history in workflows.
 */
export interface StateHistoryTracking {
  /**
   * Array of state fingerprints.
   */
  stateHistory: string[];
  
  /**
   * Timestamp when tracking was started.
   */
  trackingStartedAt: number;
  
  /**
   * Count of state transitions.
   */
  stateTransitionCount: number;
  
  /**
   * Record of field changes by field name.
   */
  fieldChanges?: Record<string, number>;
}

/**
 * Configuration options for state tracking.
 */
export interface StateTrackingOptions extends FingerprintOptions {
  /**
   * Fields to track for changes.
   */
  trackedFields?: string[];
  
  /**
   * Fields that indicate progress in the workflow.
   */
  progressIndicatorFields?: string[];
  
  /**
   * Maximum number of iterations before throwing an error.
   */
  maxIterations?: number;
  
  /**
   * Whether to enable verbose logging.
   */
  verbose?: boolean;
  
  /**
   * Interval (in iterations) for checking progress.
   */
  progressCheckInterval?: number;
  
  /**
   * Custom function to check if workflow is making progress.
   */
  progressDetector?: (
    current: Record<string, any>,
    previous: Record<string, any>,
    history: string[],
    options: StateTrackingOptions
  ) => boolean;
  
  /**
   * How the state tracking data is stored in the state object.
   */
  trackingField?: string;
}

/**
 * Default state tracking options.
 */
export const DEFAULT_STATE_TRACKING_OPTIONS: StateTrackingOptions = {
  trackedFields: [],
  progressIndicatorFields: [],
  maxIterations: 20,
  verbose: false,
  progressCheckInterval: 3,
  trackingField: '_stateTracking',
};

/**
 * Error thrown when a loop is detected in the state.
 */
export class StateLoopDetectedError extends Error {
  public cycleInfo: any;
  
  constructor(message: string, cycleInfo: any) {
    super(message);
    this.name = 'StateLoopDetectedError';
    this.cycleInfo = cycleInfo;
  }
}

/**
 * Error thrown when max iterations is exceeded.
 */
export class MaxIterationsExceededError extends Error {
  public stateInfo: any;
  
  constructor(message: string, stateInfo: any) {
    super(message);
    this.name = 'MaxIterationsExceededError';
    this.stateInfo = stateInfo;
  }
}

/**
 * Initializes state tracking in a state object.
 * 
 * @param state - State object to initialize tracking in
 * @param options - State tracking options
 * @returns State with tracking initialized
 */
export function initializeStateTracking(
  state: Record<string, any>,
  options: StateTrackingOptions = {}
): Record<string, any> {
  const mergedOptions = { ...DEFAULT_STATE_TRACKING_OPTIONS, ...options };
  const trackingField = mergedOptions.trackingField || '_stateTracking';
  
  // Check if tracking is already initialized
  if (state[trackingField] && typeof state[trackingField] === 'object') {
    return state;
  }
  
  // Initialize fingerprint history
  const stateWithFingerprint = prepareStateForTracking(state, mergedOptions);
  const stateHistory = stateWithFingerprint[mergedOptions.historyField || 'stateHistory'] || [];
  
  // Create tracking object
  const stateTracking: StateHistoryTracking = {
    stateHistory,
    trackingStartedAt: Date.now(),
    stateTransitionCount: 0,
    fieldChanges: {},
  };
  
  // Add tracking to state
  return {
    ...state,
    [trackingField]: stateTracking,
  };
}

/**
 * Updates state tracking information.
 * 
 * @param prevState - Previous state
 * @param currentState - Current state
 * @param options - State tracking options
 * @returns Updated state with tracking information
 */
export function updateStateTracking(
  prevState: Record<string, any>,
  currentState: Record<string, any>,
  options: StateTrackingOptions = {}
): Record<string, any> {
  const mergedOptions = { ...DEFAULT_STATE_TRACKING_OPTIONS, ...options };
  const trackingField = mergedOptions.trackingField || '_stateTracking';
  
  // Ensure tracking is initialized in both states
  const prevStateWithTracking = prevState[trackingField]
    ? prevState
    : initializeStateTracking(prevState, mergedOptions);
    
  let currentStateWithTracking = currentState[trackingField]
    ? currentState
    : initializeStateTracking(currentState, mergedOptions);
  
  // Get previous tracking information
  const prevTracking = prevStateWithTracking[trackingField] as StateHistoryTracking;
  
  // Generate fingerprint for current state
  currentStateWithTracking = prepareStateForTracking(
    currentStateWithTracking,
    mergedOptions
  );
  
  // Get current history
  const historyField = mergedOptions.historyField || 'stateHistory';
  const stateHistory = currentStateWithTracking[historyField] || [];
  
  // Update tracking count
  const stateTransitionCount = prevTracking.stateTransitionCount + 1;
  
  // Track field changes
  const fieldChanges = { ...prevTracking.fieldChanges } || {};
  const trackedFields = mergedOptions.trackedFields || [];
  
  for (const field of trackedFields) {
    if (hasFieldChanged(prevStateWithTracking, currentStateWithTracking, field)) {
      fieldChanges[field] = (fieldChanges[field] || 0) + 1;
    }
  }
  
  // Create updated tracking object
  const updatedTracking: StateHistoryTracking = {
    stateHistory,
    trackingStartedAt: prevTracking.trackingStartedAt,
    stateTransitionCount,
    fieldChanges,
  };
  
  // Check for max iterations
  if (
    mergedOptions.maxIterations &&
    updatedTracking.stateTransitionCount >= mergedOptions.maxIterations
  ) {
    throw new MaxIterationsExceededError(
      `Maximum iterations (${mergedOptions.maxIterations}) exceeded`,
      {
        stateTransitionCount: updatedTracking.stateTransitionCount,
        fieldChanges: updatedTracking.fieldChanges,
      }
    );
  }
  
  // Check for cycles
  if (stateHistory.length >= 4) {
    const cycleInfo = detectCycles(stateHistory, mergedOptions);
    
    if (
      cycleInfo.cycleDetected &&
      cycleInfo.repetitions &&
      cycleInfo.repetitions >= (mergedOptions.cycleDetectionThreshold || 2)
    ) {
      // Check for progress if cycle detected
      const isMakingProgress = isWorkflowMakingProgress(
        prevStateWithTracking,
        currentStateWithTracking,
        stateHistory,
        mergedOptions
      );
      
      if (!isMakingProgress) {
        throw new StateLoopDetectedError(
          `State loop detected: cycle of length ${cycleInfo.cycleLength} repeated ${cycleInfo.repetitions} times`,
          cycleInfo
        );
      }
    }
  }
  
  // Log if verbose
  if (mergedOptions.verbose) {
    console.log(
      `[StateTracking] Iteration ${stateTransitionCount}, history length: ${stateHistory.length}`
    );
  }
  
  // Return updated state
  return {
    ...currentStateWithTracking,
    [trackingField]: updatedTracking,
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
  const getNestedValue = (obj: any, path: string): any => {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      current = current[key];
    }
    
    return current;
  };
  
  const prevValue = getNestedValue(prevState, field);
  const currentValue = getNestedValue(currentState, field);
  
  // Simple comparison, could be enhanced for deep equality
  return JSON.stringify(prevValue) !== JSON.stringify(currentValue);
}

/**
 * Determines if a workflow is making progress despite detected cycles.
 * 
 * @param prevState - Previous state
 * @param currentState - Current state
 * @param history - State history
 * @param options - Tracking options
 * @returns True if workflow is making progress
 */
export function isWorkflowMakingProgress(
  prevState: Record<string, any>,
  currentState: Record<string, any>,
  history: string[],
  options: StateTrackingOptions
): boolean {
  const mergedOptions = { ...DEFAULT_STATE_TRACKING_OPTIONS, ...options };
  
  // Use custom progress detector if provided
  if (mergedOptions.progressDetector) {
    return mergedOptions.progressDetector(prevState, currentState, history, mergedOptions);
  }
  
  // Check progress indicator fields
  const progressFields = mergedOptions.progressIndicatorFields || [];
  if (progressFields.length > 0) {
    for (const field of progressFields) {
      if (hasFieldChanged(prevState, currentState, field)) {
        if (mergedOptions.verbose) {
          console.log(`[StateTracking] Progress detected: ${field} changed`);
        }
        return true;
      }
    }
  }
  
  // Default to false if no progress detected
  return false;
}

/**
 * Higher-order function that adds state tracking to a node function.
 * 
 * @param nodeFunction - Original node function
 * @param options - State tracking options
 * @returns Node function with state tracking
 */
export function withStateTracking(
  nodeFunction: (state: Record<string, any>) => Record<string, any> | Promise<Record<string, any>>,
  options: StateTrackingOptions = {}
): (state: Record<string, any>) => Promise<Record<string, any>> {
  const mergedOptions = { ...DEFAULT_STATE_TRACKING_OPTIONS, ...options };
  
  return async (state: Record<string, any>): Promise<Record<string, any>> => {
    // Initialize tracking if not already initialized
    const stateWithTracking = initializeStateTracking(state, mergedOptions);
    
    // Run the original node function
    const result = await nodeFunction(stateWithTracking);
    
    // Update tracking with new state
    return updateStateTracking(stateWithTracking, result, mergedOptions);
  };
}

/**
 * Analyzes state transitions to create a report.
 * 
 * @param state - State with tracking information
 * @param options - Tracking options
 * @returns Analysis report
 */
export function analyzeStateTransitions(
  state: Record<string, any>,
  options: StateTrackingOptions = {}
): {
  totalTransitions: number;
  elapsedTime: number;
  fieldChanges: Record<string, number>;
  possibleCycles: any[];
  riskAssessment: {
    cycleRisk: 'low' | 'medium' | 'high';
    iterationRisk: 'low' | 'medium' | 'high';
  };
} {
  const mergedOptions = { ...DEFAULT_STATE_TRACKING_OPTIONS, ...options };
  const trackingField = mergedOptions.trackingField || '_stateTracking';
  
  // Ensure tracking exists
  if (!state[trackingField]) {
    return {
      totalTransitions: 0,
      elapsedTime: 0,
      fieldChanges: {},
      possibleCycles: [],
      riskAssessment: {
        cycleRisk: 'low',
        iterationRisk: 'low',
      },
    };
  }
  
  const tracking = state[trackingField] as StateHistoryTracking;
  const elapsedTime = Date.now() - tracking.trackingStartedAt;
  const historyField = mergedOptions.historyField || 'stateHistory';
  const stateHistory = state[historyField] || [];
  
  // Look for possible cycles
  let possibleCycles: any[] = [];
  for (let length = 2; length <= 10 && length * 2 <= stateHistory.length; length++) {
    const cycleInfo = detectCycles(stateHistory, {
      ...mergedOptions,
      minCycleLength: length,
      maxCycleLength: length,
      cycleDetectionThreshold: 1, // Lower threshold for analysis
    });
    
    if (cycleInfo.cycleDetected) {
      possibleCycles.push(cycleInfo);
    }
  }
  
  // Assess risks
  const maxIterations = mergedOptions.maxIterations || 20;
  const iterationRatio = tracking.stateTransitionCount / maxIterations;
  let iterationRisk: 'low' | 'medium' | 'high' = 'low';
  
  if (iterationRatio > 0.8) {
    iterationRisk = 'high';
  } else if (iterationRatio > 0.5) {
    iterationRisk = 'medium';
  }
  
  const cycleRisk = possibleCycles.length === 0
    ? 'low'
    : possibleCycles.some(c => c.repetitions && c.repetitions > 1)
      ? 'high'
      : 'medium';
  
  return {
    totalTransitions: tracking.stateTransitionCount,
    elapsedTime,
    fieldChanges: tracking.fieldChanges || {},
    possibleCycles,
    riskAssessment: {
      cycleRisk,
      iterationRisk,
    },
  };
}