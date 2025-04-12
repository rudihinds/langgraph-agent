/**
 * Loop prevention module for LangGraph workflows.
 *
 * This module provides mechanisms to prevent infinite loops and detect cycles
 * in StateGraph executions through state tracking and iteration control.
 */

import { StateGraph } from "@langchain/langgraph";
import {
  createStateFingerprint,
  detectCycles,
  prepareStateForTracking,
  FingerprintOptions,
} from "./state-fingerprinting";

/**
 * Configuration options for loop prevention.
 */
export interface LoopPreventionOptions {
  /**
   * Maximum allowed iterations before throwing an error (default: 10).
   */
  maxIterations?: number;

  /**
   * Field name in state to track for progress (default: none).
   */
  progressField?: string;

  /**
   * Maximum iterations without progress in the progress field (default: 3).
   */
  maxIterationsWithoutProgress?: number;

  /**
   * Minimum required iterations before enforcing checks (default: 0).
   */
  minRequiredIterations?: number;

  /**
   * State fingerprinting options for cycle detection.
   */
  fingerprintOptions?: FingerprintOptions;

  /**
   * Custom function to determine if the workflow is complete.
   */
  isComplete?: (state: Record<string, any>) => boolean;

  /**
   * Callback function invoked when loop prevention terminates a workflow.
   */
  onTermination?: (state: Record<string, any>, reason: string) => void;

  /**
   * Whether to automatically add a progress tracking field to the state (default: false).
   */
  autoTrackProgress?: boolean;

  /**
   * Custom function to normalize state before fingerprinting.
   */
  normalizeFn?: (state: any) => Record<string, any>;
}

/**
 * Default options for loop prevention.
 */
const DEFAULT_LOOP_PREVENTION_OPTIONS: LoopPreventionOptions = {
  maxIterations: 10,
  maxIterationsWithoutProgress: 3,
  minRequiredIterations: 0,
  autoTrackProgress: false,
};

/**
 * Loop detection state that gets added to the graph state.
 */
export interface LoopDetectionState {
  /**
   * Current iteration count.
   */
  iterations: number;

  /**
   * Array of fingerprints from previous states.
   */
  stateHistory: string[];

  /**
   * Value of the progress field in the previous iteration.
   */
  previousProgress?: any;

  /**
   * Number of iterations since progress was last detected.
   */
  iterationsWithoutProgress: number;

  /**
   * Whether the workflow should terminate due to a loop.
   */
  shouldTerminate: boolean;

  /**
   * Reason for termination, if applicable.
   */
  terminationReason?: string;
}

/**
 * Error thrown when a loop is detected.
 */
export class LoopDetectionError extends Error {
  state: Record<string, any>;
  reason: string;

  constructor(state: Record<string, any>, reason: string) {
    super(`Loop detection terminated workflow: ${reason}`);
    this.name = "LoopDetectionError";
    this.state = state;
    this.reason = reason;
  }
}

/**
 * Configures loop prevention for a StateGraph.
 *
 * @param graph - The StateGraph to configure
 * @param options - Configuration options for loop prevention
 * @returns The configured StateGraph
 */
export function configureLoopPrevention<T extends Record<string, any>>(
  graph: StateGraph<T>,
  options: LoopPreventionOptions = {}
): StateGraph<T> {
  const mergedOptions = { ...DEFAULT_LOOP_PREVENTION_OPTIONS, ...options };

  // Add beforeCall hook to initialize and update loop detection state
  graph.addBeforeCallHook((state) => {
    // Initialize loop detection state if not present
    if (!state.loopDetection) {
      state.loopDetection = {
        iterations: 0,
        stateHistory: [],
        iterationsWithoutProgress: 0,
        shouldTerminate: false,
      };
    }

    // Update the iteration count
    state.loopDetection.iterations += 1;

    // Generate state fingerprint and add to history
    const stateWithoutLoop = { ...state };
    delete stateWithoutLoop.loopDetection;

    const fingerprint = createStateFingerprint(
      stateWithoutLoop,
      mergedOptions.fingerprintOptions
    );

    state.loopDetection.stateHistory = [
      ...(state.loopDetection.stateHistory || []),
      fingerprint,
    ];

    // Check for cycle repetition
    const { cycleDetected, cycleLength, repetitions } = detectCycles(
      state.loopDetection.stateHistory,
      mergedOptions.fingerprintOptions
    );

    // Track progress if a progress field is specified
    if (mergedOptions.progressField) {
      const currentProgress = state[mergedOptions.progressField];
      const previousProgress = state.loopDetection.previousProgress;

      // Check if progress has been made
      let progressMade = false;

      if (previousProgress === undefined) {
        progressMade = true;
      } else if (
        typeof currentProgress === "object" &&
        currentProgress !== null
      ) {
        progressMade =
          JSON.stringify(currentProgress) !== JSON.stringify(previousProgress);
      } else {
        progressMade = currentProgress !== previousProgress;
      }

      // Update progress tracking
      state.loopDetection.previousProgress = currentProgress;

      if (progressMade) {
        state.loopDetection.iterationsWithoutProgress = 0;
      } else {
        state.loopDetection.iterationsWithoutProgress += 1;
      }
    }

    // Check termination conditions
    const { iterations, iterationsWithoutProgress } = state.loopDetection;

    // Skip checks if minimum required iterations not reached
    if (iterations < (mergedOptions.minRequiredIterations || 0)) {
      return state;
    }

    // Check max iterations
    if (
      mergedOptions.maxIterations &&
      iterations >= mergedOptions.maxIterations
    ) {
      state.loopDetection.shouldTerminate = true;
      state.loopDetection.terminationReason = "Maximum iterations exceeded";
    }

    // Check progress stagnation
    if (
      mergedOptions.progressField &&
      mergedOptions.maxIterationsWithoutProgress &&
      iterationsWithoutProgress >= mergedOptions.maxIterationsWithoutProgress
    ) {
      state.loopDetection.shouldTerminate = true;
      state.loopDetection.terminationReason =
        "No progress detected in specified field";
    }

    // Check cycle detection
    if (cycleDetected && repetitions && cycleLength) {
      state.loopDetection.shouldTerminate = true;
      state.loopDetection.terminationReason = `Cycle detected: pattern of length ${cycleLength} repeated ${repetitions} times`;
    }

    // Check custom completion
    if (mergedOptions.isComplete && mergedOptions.isComplete(state)) {
      state.loopDetection.shouldTerminate = true;
      state.loopDetection.terminationReason = "Workflow completed";
    }

    // Handle termination
    if (state.loopDetection.shouldTerminate) {
      const reason = state.loopDetection.terminationReason || "Unknown reason";

      // Call termination callback if provided
      if (mergedOptions.onTermination) {
        mergedOptions.onTermination(state, reason);
      }

      throw new LoopDetectionError(state, reason);
    }

    return state;
  });

  return graph;
}

/**
 * Creates a node that checks if the workflow should terminate due to loop detection.
 *
 * @param options - Loop prevention options
 * @returns A node function that checks loop conditions
 */
export function createLoopDetectionNode(options: LoopPreventionOptions = {}) {
  const mergedOptions = { ...DEFAULT_LOOP_PREVENTION_OPTIONS, ...options };

  return function loopDetectionNode(
    state: Record<string, any>
  ): Record<string, any> {
    // Initialize loop detection if not present
    if (!state.loopDetection) {
      return {
        ...state,
        loopDetection: {
          iterations: 0,
          stateHistory: [],
          iterationsWithoutProgress: 0,
          shouldTerminate: false,
        },
      };
    }

    // Check termination conditions
    const { iterations, iterationsWithoutProgress, stateHistory } =
      state.loopDetection;
    let shouldTerminate = false;
    let terminationReason = "";

    // Check max iterations
    if (
      mergedOptions.maxIterations &&
      iterations >= mergedOptions.maxIterations
    ) {
      shouldTerminate = true;
      terminationReason = "Maximum iterations exceeded";
    }

    // Check progress stagnation
    if (
      mergedOptions.progressField &&
      mergedOptions.maxIterationsWithoutProgress &&
      iterationsWithoutProgress >= mergedOptions.maxIterationsWithoutProgress
    ) {
      shouldTerminate = true;
      terminationReason = "No progress detected in specified field";
    }

    // Check cycle detection
    const { cycleDetected, cycleLength, repetitions } = detectCycles(
      stateHistory,
      mergedOptions.fingerprintOptions
    );

    if (cycleDetected && repetitions && cycleLength) {
      shouldTerminate = true;
      terminationReason = `Cycle detected: pattern of length ${cycleLength} repeated ${repetitions} times`;
    }

    // Custom completion check
    if (mergedOptions.isComplete && mergedOptions.isComplete(state)) {
      shouldTerminate = true;
      terminationReason = "Workflow completed";
    }

    // Update loop detection state
    return {
      ...state,
      loopDetection: {
        ...state.loopDetection,
        shouldTerminate,
        terminationReason: shouldTerminate ? terminationReason : undefined,
      },
    };
  };
}

/**
 * Creates a node that increments the iteration counter.
 *
 * @returns A node function that increments the iteration counter
 */
export function createIterationCounterNode() {
  return function iterationCounterNode(
    state: Record<string, any>
  ): Record<string, any> {
    // Initialize loop detection if not present
    const loopDetection = state.loopDetection || {
      iterations: 0,
      stateHistory: [],
      iterationsWithoutProgress: 0,
      shouldTerminate: false,
    };

    return {
      ...state,
      loopDetection: {
        ...loopDetection,
        iterations: loopDetection.iterations + 1,
      },
    };
  };
}

/**
 * Creates a node that tracks progress in a specific field.
 *
 * @param progressField - Field to track for progress
 * @returns A node function that updates progress tracking
 */
export function createProgressTrackingNode(progressField: string) {
  return function progressTrackingNode(
    state: Record<string, any>
  ): Record<string, any> {
    // Initialize loop detection if not present
    const loopDetection = state.loopDetection || {
      iterations: 0,
      stateHistory: [],
      iterationsWithoutProgress: 0,
      previousProgress: undefined,
      shouldTerminate: false,
    };

    // Get current progress value
    const currentProgress = state[progressField];
    const previousProgress = loopDetection.previousProgress;

    // Check if progress has been made
    let progressMade = false;

    if (previousProgress === undefined) {
      progressMade = true;
    } else if (
      typeof currentProgress === "object" &&
      currentProgress !== null
    ) {
      progressMade =
        JSON.stringify(currentProgress) !== JSON.stringify(previousProgress);
    } else {
      progressMade = currentProgress !== previousProgress;
    }

    // Update progress tracking
    return {
      ...state,
      loopDetection: {
        ...loopDetection,
        previousProgress: currentProgress,
        iterationsWithoutProgress: progressMade
          ? 0
          : loopDetection.iterationsWithoutProgress + 1,
      },
    };
  };
}
