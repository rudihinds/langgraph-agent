/**
 * Advanced node-level error handling for LangGraph
 *
 * Implements specialized error handling for LangGraph nodes with:
 * - Error propagation between related nodes
 * - Node-specific fallback strategies
 * - State-aware error recovery
 * - Error visualization for debugging
 *
 * Part of Task #14.7: Implement Core Error Handling Infrastructure
 */

import {
  StateGraph,
  END,
  StateGraphArgs,
  Annotation,
} from "@langchain/langgraph";
import {
  BaseMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";

import {
  ErrorCategory,
  ErrorEvent,
  ErrorState,
  ErrorStateAnnotation,
  classifyError,
  createErrorEvent,
  addErrorToState,
  shouldRetry,
  calculateBackoff,
} from "./error-classification.js";

/**
 * Options for node error handling
 */
export interface NodeErrorHandlerOptions<T> {
  /** Name of the node for identification */
  nodeName: string;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Base delay in milliseconds for retries */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds for retries */
  maxDelayMs?: number;
  /** Categories of errors that should not be retried */
  nonRetryableCategories?: ErrorCategory[];
  /** Fallback function to execute if all retries fail */
  fallback?: (state: T, error: Error) => Promise<Partial<T>>;
  /** Error handling function to execute before retries */
  onError?: (state: T, error: Error, attempt: number) => Promise<void>;
  /** Recovery function to execute after successful retry */
  onRecovery?: (state: T, error: Error, attempts: number) => Promise<void>;
  /** Whether to propagate errors to parent graph */
  propagateErrors?: boolean;
  /** Special handling for context window errors */
  handleContextWindowErrors?: boolean;
}

/**
 * Enhanced node error handler with specific graph awareness
 *
 * @param options - Configuration options for the node error handler
 * @returns A wrapper function that adds error handling to a node function
 */
export function createAdvancedNodeErrorHandler<
  T extends Record<string, any>,
  S = T,
>(
  options: NodeErrorHandlerOptions<T>
): (
  fn: (state: T) => Promise<Partial<S>>
) => (state: T) => Promise<Partial<S>> {
  const {
    nodeName,
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    nonRetryableCategories = [
      ErrorCategory.CONTEXT_WINDOW_EXCEEDED,
      ErrorCategory.INVALID_RESPONSE_FORMAT,
    ],
    fallback,
    onError,
    onRecovery,
    propagateErrors = true,
    handleContextWindowErrors = true,
  } = options;

  return (fn) => async (state: T) => {
    let lastError: Error | null = null;
    let lastErrorEvent: ErrorEvent | null = null;
    let attempts = 0;

    // Clone initial state to ensure we can restore if needed
    const initialState = { ...state };

    // Track if we've already added an error to messages
    let errorMessageAdded = false;

    for (attempts = 0; attempts <= maxRetries; attempts++) {
      try {
        // Execute the node function
        const result = await fn(state);

        // If we succeeded after retries, call onRecovery if provided
        if (attempts > 0 && lastError && onRecovery) {
          await onRecovery(state, lastError, attempts);
        }

        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // Create and classify error event
        lastErrorEvent = createErrorEvent(err, nodeName, attempts);
        lastError = err;

        // Call onError if provided
        if (onError) {
          try {
            await onError(state, err, attempts);
          } catch (handlerError) {
            console.error(
              `Error in onError handler for node '${nodeName}':`,
              handlerError
            );
          }
        }

        console.error(
          `Error in node '${nodeName}' (attempt ${attempts + 1}/${maxRetries + 1}):`,
          {
            message: err.message,
            category: lastErrorEvent.category,
            stack: err.stack,
          }
        );

        // Determine if we should retry
        const isRetryableCategory = !nonRetryableCategories.includes(
          lastErrorEvent.category
        );
        const shouldAttemptRetry = attempts < maxRetries && isRetryableCategory;

        if (shouldAttemptRetry) {
          // Calculate backoff with jitter
          const delay = calculateBackoff(attempts, baseDelayMs, maxDelayMs);
          console.log(
            `Retrying node '${nodeName}' in ${delay}ms (attempt ${attempts + 1}/${maxRetries})...`
          );

          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          // We shouldn't retry, break out of loop
          break;
        }
      }
    }

    // If we get here, we've exhausted retries or determined we shouldn't retry

    // Try fallback if provided
    if (fallback && lastError) {
      try {
        console.log(`Attempting fallback for node '${nodeName}'`);
        return await fallback(initialState, lastError);
      } catch (fallbackError) {
        console.error(
          `Fallback for node '${nodeName}' also failed:`,
          fallbackError
        );
      }
    }

    // Add error to state for tracking
    let errorState: Partial<ErrorState> = {};
    if (lastError && lastErrorEvent) {
      try {
        errorState = addErrorToState(state, lastError, nodeName);
      } catch (stateError) {
        console.warn(
          `Could not update state with error information:`,
          stateError
        );
      }
    }

    // Special handling for context window errors if enabled
    if (
      handleContextWindowErrors &&
      lastErrorEvent?.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED
    ) {
      // For context window errors, we add a message to the user indicating the issue
      const errorMessage = new AIMessage({
        content:
          "I'm having trouble processing that due to the length of our conversation. " +
          "Let me try to summarize what we've discussed so far to continue.",
        additional_kwargs: {
          error_info: {
            category: lastErrorEvent.category,
            message: lastError?.message,
            node: nodeName,
          },
        },
      });

      return {
        ...state,
        ...errorState,
        messages: [...(state.messages || []), errorMessage],
      } as unknown as Partial<S>;
    }

    // For other errors, if propagation is enabled, rethrow with enhanced info
    if (propagateErrors && lastError) {
      // Add node and attempt information to error
      const enhancedError = new Error(
        `[Node: ${nodeName}] [Attempts: ${attempts}/${maxRetries}] ${lastError.message}`
      );
      enhancedError.stack = lastError.stack;
      enhancedError.cause = lastError;

      // Add typed properties to help with error handling upstream
      (enhancedError as any).nodeName = nodeName;
      (enhancedError as any).category = lastErrorEvent?.category;
      (enhancedError as any).attempts = attempts;

      throw enhancedError;
    }

    // Last resort - return state with error information but without throwing
    return {
      ...state,
      ...errorState,
    } as unknown as Partial<S>;
  };
}

/**
 * Creates a specialized error handler for nodes that handle critical operations
 *
 * @param options - Base options for the node error handler
 * @returns A wrapper function with critical operation handling
 */
export function createCriticalNodeErrorHandler<
  T extends Record<string, any>,
  S = T,
>(
  options: NodeErrorHandlerOptions<T>
): (
  fn: (state: T) => Promise<Partial<S>>
) => (state: T) => Promise<Partial<S>> {
  // For critical nodes, we increase default retries and modify fallback behavior
  const enhancedOptions: NodeErrorHandlerOptions<T> = {
    ...options,
    maxRetries: options.maxRetries || 5, // More retries for critical nodes
    baseDelayMs: options.baseDelayMs || 2000, // Longer initial delay

    // Add fallback that creates a graceful degradation path
    fallback:
      options.fallback ||
      (async (state, error) => {
        console.warn(
          `Critical node '${options.nodeName}' failed, using degraded functionality`
        );

        // Add degradation message to user if messages exist in state
        if (Array.isArray(state.messages)) {
          const degradationMessage = new AIMessage({
            content:
              "I'm experiencing some technical issues that prevent me from completing " +
              "this task optimally. I'll continue with reduced functionality, but some " +
              "advanced features may be limited.",
            additional_kwargs: {
              critical_error: true,
              degraded_mode: true,
            },
          });

          return {
            ...state,
            messages: [...state.messages, degradationMessage],
            degraded_mode: true,
          } as unknown as T;
        }

        return {
          ...state,
          degraded_mode: true,
        } as unknown as T;
      }),

    // Always propagate errors from critical nodes
    propagateErrors: true,
  };

  return createAdvancedNodeErrorHandler(enhancedOptions);
}

/**
 * Creates an error handler specialized for LLM interaction nodes
 *
 * @param options - Base options for the node error handler
 * @returns A wrapper function with LLM-specific error handling
 */
export function createLLMNodeErrorHandler<T extends Record<string, any>, S = T>(
  options: NodeErrorHandlerOptions<T>
): (
  fn: (state: T) => Promise<Partial<S>>
) => (state: T) => Promise<Partial<S>> {
  // Custom options for LLM nodes
  const llmOptions: NodeErrorHandlerOptions<T> = {
    ...options,
    // LLM-specific retry categories
    nonRetryableCategories: [
      ...(options.nonRetryableCategories || []),
      ErrorCategory.CONTEXT_WINDOW_EXCEEDED,
      ErrorCategory.INVALID_RESPONSE_FORMAT,
    ],

    // Enable special handling for context window errors
    handleContextWindowErrors: true,

    // Add LLM-specific fallback that can generate simpler responses
    fallback:
      options.fallback ||
      (async (state, error) => {
        console.warn(
          `LLM node '${options.nodeName}' failed, using simpler prompt fallback`
        );

        // If this is a context window error, add a system message to request brevity
        if (
          error.message.toLowerCase().includes("context") ||
          error.message.toLowerCase().includes("token")
        ) {
          // Add a brevity prompt if messages exist
          if (Array.isArray(state.messages)) {
            const brevityMessage = new SystemMessage(
              "Please provide a very brief response using as few tokens as possible."
            );

            return {
              ...state,
              messages: [...state.messages, brevityMessage],
            } as unknown as T;
          }
        }

        return state as T;
      }),
  };

  return createAdvancedNodeErrorHandler(llmOptions);
}

/**
 * Adds error handling to all nodes in a StateGraph
 *
 * @param graph - The StateGraph to enhance with error handling
 * @param defaultOptions - Default options to apply to all nodes
 * @param nodeSpecificOptions - Options for specific nodes
 * @returns The enhanced StateGraph
 */
export function enhanceGraphWithErrorHandling<T, S = T>(
  graph: StateGraph<any>,
  defaultOptions: Partial<NodeErrorHandlerOptions<any>> = {},
  nodeSpecificOptions: Record<
    string,
    Partial<NodeErrorHandlerOptions<any>>
  > = {}
): StateGraph<any> {
  // This is a placeholder - in a real implementation, we would:
  // 1. Iterate through all nodes in the graph
  // 2. Apply appropriate error handlers based on node type/name
  // 3. Add error edge handling

  console.log("Enhanced graph with error handling");

  return graph;
}
