/**
 * Error handling utilities for LangGraph
 *
 * Implements error handling strategies for LangGraph components
 * as part of Task #14 - Error Handling and Resilience System
 */

import { StateGraph } from "@langchain/langgraph";
import {
  HumanMessage,
  SystemMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { LLMChain } from "langchain/chains";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

/**
 * Wraps a StateGraph with error handling to gracefully handle schema extraction errors
 *
 * @param graph - The StateGraph to wrap with error handling
 * @param onError - Optional error handler callback
 * @returns A function that returns a compiled graph with error handling
 */
export function withErrorHandling<T, S>(
  graph: StateGraph<any>,
  onError?: (err: Error) => void
): () => Runnable<T, S> {
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

        if (attempt < maxRetries) {
          console.warn(
            `LLM call failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}`
          );
          console.warn(`Retrying in ${delay}ms...`);

          // Wait before retrying with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= backoffFactor;
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
function createNodeErrorHandler<T, S>(
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

      // If no fallback or fallback failed, rethrow or return minimal valid state
      throw err;
    }
  };
}
