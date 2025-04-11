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
} from "./error-classification.js";

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
 * Creates a function to handle node-level errors in LangGraph
 *
 * @param nodeName - Name of the node for identification in logs
 * @param fallbackBehavior - Optional fallback behavior when error occurs
 * @returns A wrapper function that handles errors for the node
 */
export function createNodeErrorHandler<T extends Record<string, any>, S>(
  nodeName: string,
  fallbackBehavior?: (state: T, error: Error) => Promise<Partial<S>>
): (
  fn: (state: T) => Promise<Partial<S>>
) => (state: T) => Promise<Partial<S>> {
  return (fn) => async (state: T) => {
    try {
      return await fn(state);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`Error in LangGraph node '${nodeName}':`, err);

      // Create error event and classify
      const errorEvent = createErrorEvent(err, nodeName);
      console.error(`Error category: ${errorEvent.category}`);

      // Try to use fallback behavior if provided
      if (fallbackBehavior) {
        console.warn(`Attempting fallback behavior for node '${nodeName}'`);
        try {
          return await fallbackBehavior(state, err);
        } catch (fallbackError) {
          console.error(
            `Fallback for node '${nodeName}' also failed:`,
            fallbackError
          );
        }
      }

      // Update state with error information
      let updatedState = { ...state };
      try {
        // Add error to state if possible - don't crash if state can't accept it
        const stateWithError = addErrorToState(state, err, nodeName);
        updatedState = { ...state, ...stateWithError } as T;
      } catch (stateError) {
        console.warn(
          `Could not update state with error information:`,
          stateError
        );
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

      // Rethrow the error
      throw err;
    }
  };
}

/**
 * Creates a node wrapper that handles retries within the LangGraph
 *
 * @param nodeName - Name of the node for identification
 * @param maxRetries - Maximum retry attempts
 * @returns A wrapper function that adds retry capabilities
 */
export function createRetryingNode<T extends Record<string, any>, S>(
  nodeName: string,
  maxRetries: number = 3
): (
  fn: (state: T) => Promise<Partial<S>>
) => (state: T) => Promise<Partial<S>> {
  return (fn) => async (state: T) => {
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
        if (
          attempt < maxRetries &&
          shouldRetry(errorEvent, attempt, maxRetries)
        ) {
          // Calculate backoff time with jitter
          const delay = calculateBackoff(attempt);
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
 * @param maxRetries - Maximum retry attempts
 * @param fallbackBehavior - Optional fallback if all retries fail
 * @returns A wrapper function with both error handling and retry logic
 */
export function withNodeResilience<T extends Record<string, any>, S>(
  nodeName: string,
  maxRetries: number = 3,
  fallbackBehavior?: (state: T, error: Error) => Promise<Partial<S>>
): (
  fn: (state: T) => Promise<Partial<S>>
) => (state: T) => Promise<Partial<S>> {
  // Compose the retry wrapper with the error handler
  const retryWrapper = createRetryingNode<T, S>(nodeName, maxRetries);
  const errorHandler = createNodeErrorHandler<T, S>(nodeName, fallbackBehavior);

  // Apply both wrappers
  return (fn) => errorHandler(retryWrapper(fn));
}
