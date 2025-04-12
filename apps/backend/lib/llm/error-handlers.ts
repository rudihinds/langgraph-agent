/**
 * Error handling utilities for LangGraph
 *
 * Implements error handling strategies for LangGraph components
 * as part of Task #14 - Error Handling and Resilience System
 */

import { StateGraph, CompiledStateGraph } from "@langchain/langgraph";
import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { LLMChain } from "langchain/chains";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  ErrorCategory,
  ErrorEvent,
  createErrorEvent,
  shouldRetry,
  calculateBackoff,
  createErrorResponseMessage,
  addErrorToState,
  classifyError,
} from "./error-classification.js";

// Import MonitoringService properly
let MonitoringService = {
  trackError: (data: any) => {
    console.log("Error tracked:", data);
  },
  trackNodeExecution: (data: any) => {
    console.log("Node execution tracked:", data);
  },
};

try {
  // Attempt to dynamically import MonitoringService
  import("./monitoring.js")
    .then((module) => {
      if (module.MonitoringService) {
        MonitoringService = module.MonitoringService;
      }
    })
    .catch((err) => {
      console.warn(
        "Monitoring service not available, using stub implementation"
      );
    });
} catch (e) {
  console.warn("Monitoring service not available, using stub implementation");
}

/**
 * Wraps a StateGraph with error handling to gracefully handle schema extraction errors
 *
 * @param graph - The StateGraph to wrap with error handling
 * @param onError - Optional error handler callback
 * @returns A function that returns a compiled graph with error handling
 */
export function withErrorHandling(
  graph: StateGraph<any>,
  onError?: (err: Error) => void
): () => CompiledStateGraph<any, any, string, any, any, any> {
  return () => {
    try {
      return graph.compile();
    } catch (err) {
      console.error("Error compiling LangGraph:", err);

      // If a schema extraction error, provide specific guidance
      if (
        err instanceof Error &&
        (err.message.includes("extract schema") ||
          err.message.includes("reading 'flags'"))
      ) {
        console.error(`
Schema extraction error detected.
This is likely due to:
1. Invalid state annotation format
2. Incompatible TypeScript patterns
3. Missing .js extensions in imports

Check your graph state definition and imports.
        `);
      }

      // Call custom error handler if provided
      if (onError && err instanceof Error) {
        onError(err);
      }

      // Rethrow a more helpful error
      throw new Error(
        `LangGraph compilation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };
}

/**
 * Creates a retry wrapper for LLM calls
 *
 * @param llm - The base LLM to wrap with retry logic
 * @param maxRetries - Maximum number of retry attempts
 * @param backoffFactor - Exponential backoff factor (default: 2)
 * @returns A wrapped LLM with retry logic
 */
export function createRetryingLLM(
  llm: BaseChatModel,
  maxRetries: number = 3,
  backoffFactor: number = 2
): BaseChatModel {
  const originalInvoke = llm.invoke.bind(llm);

  // Override the invoke method with retry logic
  llm.invoke = async function (
    messages: BaseMessage[] | string,
    options?: RunnableConfig
  ) {
    let lastError: Error | null = null;
    let delay = 1000; // Start with 1s delay

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await originalInvoke(messages, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Create an error event for better classification
        const errorEvent = createErrorEvent(lastError, "llm-invoke", attempt);

        // Check if we should retry based on error type
        if (
          attempt < maxRetries &&
          shouldRetry(errorEvent, attempt, maxRetries)
        ) {
          console.warn(
            `LLM call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`
          );
          console.warn(`Error category: ${errorEvent.category}`);
          console.warn(`Retrying in ${delay}ms...`);

          // Wait before retrying with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= backoffFactor;
        } else {
          // If we shouldn't retry, break out of the loop
          break;
        }
      }
    }

    // If we've exhausted all retries, throw the last error
    throw new Error(
      `Failed after ${maxRetries + 1} attempts: ${lastError?.message}`
    );
  };

  return llm;
}

/**
 * Options for node error handler
 */
export interface NodeErrorHandlerOptions<T extends Record<string, any>, S> {
  /**
   * Fallback behavior when error occurs
   */
  fallbackBehavior?: (state: T, error: Error) => Promise<Partial<S>>;

  /**
   * Custom error classifier function
   */
  errorClassifier?: (error: Error) => ErrorCategory;

  /**
   * Whether to propagate errors up to the graph
   * When true, errors will bubble up after fallback behavior
   * When false (default), errors are handled completely at the node level
   */
  bubbleErrors?: boolean;

  /**
   * Whether to add error information to state
   */
  addErrorToState?: boolean;

  /**
   * Whether to track error metrics
   */
  trackMetrics?: boolean;

  /**
   * Custom retry filter - determines if a specific error should be retried
   */
  shouldRetry?: (
    error: ErrorEvent,
    attempt: number,
    maxRetries: number
  ) => boolean;
}

/**
 * Creates a function to handle node-level errors in LangGraph
 *
 * @param nodeName - Name of the node for identification in logs
 * @param options - Options for error handling behavior
 * @returns A wrapper function that handles errors for the node
 */
export function createNodeErrorHandler<T extends Record<string, any>, S>(
  nodeName: string,
  options: NodeErrorHandlerOptions<T, S> = {}
): (
  fn: (state: T) => Promise<Partial<S>>
) => (state: T) => Promise<Partial<S>> {
  // Extract options with defaults
  const {
    fallbackBehavior,
    errorClassifier = classifyError,
    bubbleErrors = false,
    addErrorToState: shouldAddErrorToState = true,
    trackMetrics = true,
    shouldRetry: customShouldRetry,
  } = options;

  return (fn) => async (state: T) => {
    const startTime = performance.now();

    try {
      // Execute the original node function
      const result = await fn(state);

      // Track successful execution if metrics are enabled
      if (trackMetrics) {
        MonitoringService.trackNodeExecution({
          nodeName,
          durationMs: performance.now() - startTime,
          success: true,
        });
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`Error in LangGraph node '${nodeName}':`, err);

      // Create error event and classify (using custom classifier if provided)
      const errorEvent = createErrorEvent({
        error: err,
        nodeName,
        category: errorClassifier(err),
      });

      console.error(`Error category: ${errorEvent.category}`);

      // Track error metrics if enabled
      if (trackMetrics) {
        MonitoringService.trackError({
          errorType: errorEvent.category,
          component: nodeName,
          message: err.message,
          durationMs: performance.now() - startTime,
        });
      }

      // Update state with error information if requested
      let updatedState = { ...state };
      if (shouldAddErrorToState) {
        try {
          const stateWithError = addErrorToState(state, err, nodeName);
          updatedState = { ...state, ...stateWithError } as T;
        } catch (stateError) {
          console.warn(
            `Could not update state with error information:`,
            stateError
          );
        }
      }

      // Try to use fallback behavior if provided
      if (fallbackBehavior) {
        console.warn(`Attempting fallback behavior for node '${nodeName}'`);
        try {
          const fallbackResult = await fallbackBehavior(updatedState, err);

          // Track fallback success
          if (trackMetrics) {
            MonitoringService.trackNodeExecution({
              nodeName: `${nodeName}:fallback`,
              durationMs: performance.now() - startTime,
              success: true,
            });
          }

          return fallbackResult;
        } catch (fallbackError) {
          console.error(
            `Fallback for node '${nodeName}' also failed:`,
            fallbackError
          );

          // Track fallback failure
          if (trackMetrics) {
            MonitoringService.trackError({
              errorType: "fallback_failure",
              component: `${nodeName}:fallback`,
              message:
                fallbackError instanceof Error
                  ? fallbackError.message
                  : String(fallbackError),
            });
          }
        }
      }

      // For specific error categories, provide appropriate user-facing messages
      if (errorEvent.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED) {
        // Context window exceeded requires special handling
        return {
          ...updatedState,
          messages: [
            ...(updatedState.messages || []),
            createErrorResponseMessage(errorEvent),
          ],
        } as unknown as Partial<S>;
      }

      // For LLM availability errors, add a user-facing message
      if (errorEvent.category === ErrorCategory.LLM_UNAVAILABLE) {
        return {
          ...updatedState,
          messages: [
            ...(updatedState.messages || []),
            createErrorResponseMessage(errorEvent),
          ],
        } as unknown as Partial<S>;
      }

      // Propagate errors up to the graph level if requested
      if (bubbleErrors) {
        // Add extra properties to the error for graph-level handling
        const enhancedError = new Error(
          `Error in node '${nodeName}': ${err.message}`
        );
        (enhancedError as any).errorEvent = errorEvent;
        (enhancedError as any).nodeName = nodeName;
        (enhancedError as any).isNodeError = true;

        throw enhancedError;
      }

      // If no special handling applied and not bubbling errors,
      // return a generic error message response
      return {
        ...updatedState,
        messages: [
          ...(updatedState.messages || []),
          createErrorResponseMessage(errorEvent),
        ],
      } as unknown as Partial<S>;
    }
  };
}

/**
 * Options for node retry wrapper
 */
export interface RetryNodeOptions {
  /**
   * Maximum number of retry attempts
   */
  maxRetries?: number;

  /**
   * Base delay between retries in milliseconds
   */
  baseDelayMs?: number;

  /**
   * Maximum delay between retries in milliseconds
   */
  maxDelayMs?: number;

  /**
   * Custom function to determine if retry should be attempted
   */
  shouldRetry?: (
    error: ErrorEvent,
    attempt: number,
    maxRetries: number
  ) => boolean;
}

/**
 * Creates a node wrapper that handles retries within the LangGraph
 *
 * @param fn - Original node function to wrap
 * @param nodeName - Name of the node for identification
 * @param options - Retry options
 * @returns A wrapper function that adds retry capabilities
 */
export function createRetryingNode<T extends Record<string, any>, S>(
  fn: (state: T) => Promise<Partial<S>>,
  nodeName: string,
  options: RetryNodeOptions = {}
): (state: T) => Promise<Partial<S>> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    shouldRetry: customShouldRetry,
  } = options;

  return async (state: T) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(state);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Create error event
        const errorEvent = createErrorEvent(err, nodeName, attempt);
        console.error(
          `Error in node '${nodeName}' (attempt ${attempt + 1}/${maxRetries + 1}):`,
          err
        );
        console.error(`Error category: ${errorEvent.category}`);

        // Store the error for potential later throw
        lastError = err;

        // Check if we should retry based on error characteristics
        const shouldRetryThis = customShouldRetry
          ? customShouldRetry(errorEvent, attempt, maxRetries)
          : shouldRetry(errorEvent, attempt, maxRetries);

        if (attempt < maxRetries && shouldRetryThis) {
          // Calculate backoff time with jitter
          const delay = calculateBackoff(attempt, baseDelayMs, maxDelayMs);
          console.warn(`Retrying node '${nodeName}' in ${delay}ms...`);

          // Implement backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // We shouldn't retry, break out of loop
          break;
        }
      }
    }

    // If we get here, we've exhausted retries or determined we shouldn't retry
    throw lastError || new Error(`Unknown error in node '${nodeName}'`);
  };
}

/**
 * Combines error handling and retry logic for nodes
 *
 * @param nodeName - Name of the node for identification
 * @param options - Configuration options for both retry and error handling
 * @returns A wrapper function with both error handling and retry logic
 */
export function withNodeResilience<T extends Record<string, any>, S>(
  nodeName: string,
  options: RetryNodeOptions & NodeErrorHandlerOptions<T, S> = {}
): (
  fn: (state: T) => Promise<Partial<S>>
) => (state: T) => Promise<Partial<S>> {
  // Extract options
  const {
    maxRetries = 3,
    baseDelayMs,
    maxDelayMs,
    shouldRetry: customShouldRetry,
    ...errorHandlerOptions
  } = options;

  // Apply both wrappers - retrying first, then error handling
  return (fn) => {
    // Create retry wrapper with specific options
    const retryOptions: RetryNodeOptions = {
      maxRetries,
      baseDelayMs,
      maxDelayMs,
      shouldRetry: customShouldRetry,
    };

    const withRetry = createRetryingNode(fn, nodeName, retryOptions);
    const withErrorHandler = createNodeErrorHandler(
      nodeName,
      errorHandlerOptions
    );

    // Apply error handler to retry wrapper
    return withErrorHandler(withRetry);
  };
}
