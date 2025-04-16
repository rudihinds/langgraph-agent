/**
 * Utility functions for loop prevention in LangGraph workflows.
 * 
 * This module provides higher-level utility functions for implementing
 * loop prevention in LangGraph applications, building on the core
 * fingerprinting and cycle detection functionality.
 */

import { StateGraph, END } from "@langchain/langgraph";
import { createStateFingerprint, detectCycles, FingerprintOptions } from "./state-fingerprinting";
import { StateHistoryTracking, StateTrackingOptions } from "./state-tracking";

/**
 * Interface for a state that includes loop prevention fields.
 */
interface WithLoopPrevention {
  /**
   * Loop prevention metadata and tracking information.
   */
  loopPrevention?: {
    /**
     * Current iteration count of the workflow.
     */
    iterations: number;
    
    /**
     * Whether a loop has been detected.
     */
    loopDetected: boolean;
    
    /**
     * The length of the detected cycle, if any.
     */
    cycleLength?: number;
    
    /**
     * Number of times the cycle has repeated.
     */
    repetitions?: number;
    
    /**
     * A message explaining why the loop was detected.
     */
    loopDetectionReason?: string;
    
    /**
     * The next node to transition to when a loop is detected.
     */
    recoveryNode?: string;
    
    /**
     * Whether the workflow should terminate due to a loop.
     */
    shouldTerminate?: boolean;
    
    /**
     * Number of iterations without detected progress.
     */
    iterationsWithoutProgress?: number;
    
    /**
     * Maximum iterations before forced termination.
     */
    maxIterations?: number;
  };
}

/**
 * Creates a node function that terminates workflow execution when a loop is detected.
 * 
 * @param options - Configuration options for termination
 * @returns A node function that can be added to a StateGraph
 */
function terminateOnLoop<T extends WithLoopPrevention>(options: {
  message?: string;
  shouldTerminate?: (state: T) => boolean;
  nextNode?: string;
}) {
  const { 
    message = "Loop detected in workflow execution",
    shouldTerminate = (state) => !!(state.loopPrevention?.loopDetected), 
    nextNode 
  } = options;
  
  return function terminateOnLoopNode(state: T): T | { next: string } {
    // If termination condition is met
    if (shouldTerminate(state)) {
      // If next node is specified, redirect workflow
      if (nextNode) {
        return { next: nextNode };
      }
      
      // Otherwise terminate by returning END
      return { next: END };
    }
    
    // If no termination needed, pass state through
    return state;
  };
}

/**
 * Creates a node function that checks for progress in a specific state field.
 * 
 * @param progressField - Field to monitor for changes to detect progress
 * @param options - Configuration options for progress detection
 * @returns A node function that can be added to a StateGraph
 */
function createProgressDetectionNode<T extends WithLoopPrevention & Record<string, any>>(
  progressField: string,
  options: {
    maxNoProgressIterations?: number;
    message?: string;
    onNoProgress?: (state: T) => { next: string, reason?: string } | T;
  } = {}
) {
  const {
    maxNoProgressIterations = 3,
    message = `No progress detected in field '${progressField}' for ${maxNoProgressIterations} iterations`,
    onNoProgress
  } = options;
  
  return function progressDetectionNode(state: T): T | { next: string, reason?: string } {
    // Initialize loop prevention if not present
    if (!state.loopPrevention) {
      return {
        ...state,
        loopPrevention: {
          iterations: 0,
          loopDetected: false,
          iterationsWithoutProgress: 0
        }
      };
    }
    
    // Get previous value from state (via closure)
    const prevValue = state[`_prev_${progressField}`];
    const currentValue = state[progressField];
    
    // Check if value has changed
    let progressDetected = false;
    if (prevValue === undefined) {
      progressDetected = true;
    } else if (typeof currentValue === 'object' && currentValue !== null) {
      progressDetected = JSON.stringify(currentValue) !== JSON.stringify(prevValue);
    } else {
      progressDetected = currentValue !== prevValue;
    }
    
    // Update iterations without progress
    const iterationsWithoutProgress = progressDetected
      ? 0
      : (state.loopPrevention.iterationsWithoutProgress || 0) + 1;
    
    // Check if max iterations without progress exceeded
    const noProgressDetected = iterationsWithoutProgress >= maxNoProgressIterations;
    
    // Store current value for next comparison
    const updatedState = {
      ...state,
      [`_prev_${progressField}`]: currentValue,
      loopPrevention: {
        ...state.loopPrevention,
        iterationsWithoutProgress,
        loopDetected: noProgressDetected,
        loopDetectionReason: noProgressDetected ? message : undefined
      }
    };
    
    // If no progress for too many iterations, take action
    if (noProgressDetected && onNoProgress) {
      return onNoProgress(updatedState);
    }
    
    return updatedState;
  };
}

/**
 * Creates a node function that enforces maximum iteration limits.
 * 
 * @param options - Configuration options for iteration limits
 * @returns A node function that can be added to a StateGraph
 */
function createIterationLimitNode<T extends WithLoopPrevention>(
  options: {
    maxIterations?: number;
    message?: string;
    onLimitReached?: (state: T) => { next: string, reason?: string } | T;
  } = {}
) {
  const {
    maxIterations = 10,
    message = `Maximum iterations (${maxIterations}) exceeded`,
    onLimitReached
  } = options;
  
  return function iterationLimitNode(state: T): T | { next: string, reason?: string } {
    // Initialize loop prevention if not present
    if (!state.loopPrevention) {
      return {
        ...state,
        loopPrevention: {
          iterations: 1,
          loopDetected: false,
          maxIterations
        }
      };
    }
    
    // Increment iteration count
    const iterations = (state.loopPrevention.iterations || 0) + 1;
    
    // Check if max iterations exceeded
    const maxIterationsExceeded = iterations >= maxIterations;
    
    // Update state with new iteration count
    const updatedState = {
      ...state,
      loopPrevention: {
        ...state.loopPrevention,
        iterations,
        loopDetected: maxIterationsExceeded,
        loopDetectionReason: maxIterationsExceeded ? message : undefined,
        maxIterations
      }
    };
    
    // If max iterations exceeded, take action
    if (maxIterationsExceeded && onLimitReached) {
      return onLimitReached(updatedState);
    }
    
    return updatedState;
  };
}

/**
 * Creates a node function that checks if a workflow meets completion criteria.
 * 
 * @param completionCheck - Function that determines if the workflow is complete
 * @param options - Configuration options for completion checking
 * @returns A node function that can be added to a StateGraph
 */
function createCompletionCheckNode<T extends Record<string, any>>(
  completionCheck: (state: T) => boolean,
  options: {
    message?: string;
    nextNodeOnComplete?: string;
  } = {}
) {
  const {
    message = "Workflow completion criteria met",
    nextNodeOnComplete = END
  } = options;
  
  return function completionCheckNode(state: T): T | { next: string, reason?: string } {
    // Check if workflow is complete
    const isComplete = completionCheck(state);
    
    // If complete, redirect to next node
    if (isComplete) {
      return {
        next: nextNodeOnComplete,
        reason: message
      };
    }
    
    // Otherwise continue normal flow
    return state;
  };
}

/**
 * Creates a composite node that implements multiple loop prevention techniques.
 * 
 * @param options - Configuration options for integrated loop prevention
 * @returns A node function that can be added to a StateGraph
 */
function createSafetyCheckNode<T extends WithLoopPrevention & Record<string, any>>(
  options: {
    maxIterations?: number;
    progressField?: string;
    maxNoProgressIterations?: number;
    completionCheck?: (state: T) => boolean;
    recoveryNode?: string;
    onLoopDetected?: (state: T) => { next: string, reason?: string } | T;
  } = {}
) {
  const {
    maxIterations = 15,
    progressField,
    maxNoProgressIterations = 3,
    completionCheck,
    recoveryNode,
    onLoopDetected
  } = options;
  
  return function safetyCheckNode(state: T): T | { next: string, reason?: string } {
    // Initialize loop prevention if not present
    if (!state.loopPrevention) {
      return {
        ...state,
        loopPrevention: {
          iterations: 1,
          loopDetected: false,
          maxIterations,
          recoveryNode
        }
      };
    }
    
    // Increment iteration count
    const iterations = (state.loopPrevention.iterations || 0) + 1;
    let loopDetected = false;
    let loopDetectionReason = "";
    
    // Check iteration limit
    if (iterations >= maxIterations) {
      loopDetected = true;
      loopDetectionReason = `Maximum iterations (${maxIterations}) exceeded`;
    }
    
    // Check progress if field is specified
    if (progressField && !loopDetected) {
      const prevValue = state[`_prev_${progressField}`];
      const currentValue = state[progressField];
      
      // Check if value has changed
      let progressDetected = false;
      if (prevValue === undefined) {
        progressDetected = true;
      } else if (typeof currentValue === 'object' && currentValue !== null) {
        progressDetected = JSON.stringify(currentValue) !== JSON.stringify(prevValue);
      } else {
        progressDetected = currentValue !== prevValue;
      }
      
      // Update iterations without progress
      const iterationsWithoutProgress = progressDetected
        ? 0
        : (state.loopPrevention.iterationsWithoutProgress || 0) + 1;
      
      // Check if max iterations without progress exceeded
      if (iterationsWithoutProgress >= maxNoProgressIterations) {
        loopDetected = true;
        loopDetectionReason = `No progress detected in field '${progressField}' for ${iterationsWithoutProgress} iterations`;
      }
      
      // Store updated value for next comparison
      state = {
        ...state,
        [`_prev_${progressField}`]: currentValue,
        loopPrevention: {
          ...state.loopPrevention,
          iterationsWithoutProgress
        }
      };
    }
    
    // Check completion if function is provided
    if (completionCheck && completionCheck(state)) {
      return {
        next: END,
        reason: "Workflow completion criteria met"
      };
    }
    
    // Update state with new tracking information
    const updatedState = {
      ...state,
      loopPrevention: {
        ...state.loopPrevention,
        iterations,
        loopDetected,
        loopDetectionReason: loopDetected ? loopDetectionReason : undefined
      }
    };
    
    // If loop detected, take action
    if (loopDetected) {
      if (onLoopDetected) {
        return onLoopDetected(updatedState);
      }
      
      if (recoveryNode) {
        return {
          next: recoveryNode,
          reason: loopDetectionReason
        };
      }
      
      return {
        next: END,
        reason: loopDetectionReason
      };
    }
    
    return updatedState;
  };
}

/**
 * Export type definition for compatibility with cycle-detection.ts
 * This matches the StateHistoryEntry interface used by the orchestrator
 */
export interface StateFingerprint {
  /**
   * Hash fingerprint of the state
   */
  hash: string;
  
  /**
   * Original state object for reference
   */
  originalState: any;
  
  /**
   * Timestamp when fingerprint was created
   */
  timestamp: number;
  
  /**
   * Name of the node that created this state
   */
  sourceNode?: string;
}

/**
 * Creates a StateFingerprint compatible with the existing cycle-detection system
 * 
 * @param state The state to fingerprint
 * @param options Configuration options
 * @param sourceNode Name of the current node
 * @returns A StateFingerprint object
 */
function createCompatibleFingerprint(
  state: Record<string, any>,
  options: FingerprintOptions = {},
  sourceNode?: string
): StateFingerprint {
  const fingerprint = createStateFingerprint(state, options);
  
  return {
    hash: fingerprint,
    originalState: state,
    timestamp: Date.now(),
    sourceNode
  };
}