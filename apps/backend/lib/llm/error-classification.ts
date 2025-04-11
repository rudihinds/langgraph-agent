/**
 * Error classification system for LangGraph agents
 *
 * Part of Task #14.4: Implement Base Error Classification and Retry Mechanisms
 */

import { Annotation } from "@langchain/langgraph";
import {
  BaseMessage,
  AIMessage,
  FunctionMessage,
} from "@langchain/core/messages";

/**
 * Error categories for agent operations
 */
export enum ErrorCategory {
  LLM_UNAVAILABLE = "llm_unavailable",
  CONTEXT_WINDOW_EXCEEDED = "context_window_exceeded",
  RATE_LIMIT_EXCEEDED = "rate_limit_exceeded",
  TOOL_EXECUTION_ERROR = "tool_execution_error",
  INVALID_RESPONSE_FORMAT = "invalid_response_format",
  CHECKPOINT_ERROR = "checkpoint_error",
  UNKNOWN = "unknown",
}

/**
 * Error event for tracking agent errors
 */
export interface ErrorEvent {
  timestamp: string;
  category: ErrorCategory;
  message: string;
  node?: string;
  retryCount?: number;
  fatal?: boolean;
}

/**
 * Defines error entry in state
 */
export interface ErrorState {
  errors: ErrorEvent[];
  lastError?: ErrorEvent;
  recoveryAttempts: number;
}

/**
 * State annotation for error tracking
 */
export const ErrorStateAnnotation = Annotation.Root({
  errors: Annotation<ErrorEvent[]>({
    // Append new errors to existing array
    reducer: (curr: ErrorEvent[] = [], value: ErrorEvent[] = []) => [
      ...curr,
      ...value,
    ],
    default: () => [],
  }),
  lastError: Annotation<ErrorEvent | undefined>({
    // Always use the newest error
    reducer: (_, value) => value,
    default: () => undefined,
  }),
  recoveryAttempts: Annotation<number>({
    // Increment counter or use provided value
    reducer: (curr = 0, value) =>
      typeof value === "number" ? value : curr + 1,
    default: () => 0,
  }),
});

/**
 * Classifies an error into a specific category
 *
 * @param error - The error to classify
 * @returns Classified error category
 */
export function classifyError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();

  // LLM provider errors
  if (message.includes("rate limit") || message.includes("ratelimit")) {
    return ErrorCategory.RATE_LIMIT_EXCEEDED;
  }

  if (
    message.includes("context length") ||
    message.includes("maximum context") ||
    message.includes("token limit") ||
    message.includes("too long")
  ) {
    return ErrorCategory.CONTEXT_WINDOW_EXCEEDED;
  }

  if (
    message.includes("service unavailable") ||
    message.includes("server error") ||
    message.includes("timeout") ||
    message.includes("connection")
  ) {
    return ErrorCategory.LLM_UNAVAILABLE;
  }

  // Tool-specific errors
  if (
    message.includes("tool") &&
    (message.includes("execution") || message.includes("failed"))
  ) {
    return ErrorCategory.TOOL_EXECUTION_ERROR;
  }

  // Response formatting errors
  if (
    message.includes("invalid") ||
    message.includes("format") ||
    message.includes("parse")
  ) {
    return ErrorCategory.INVALID_RESPONSE_FORMAT;
  }

  // Checkpoint errors
  if (message.includes("checkpoint") || message.includes("state")) {
    return ErrorCategory.CHECKPOINT_ERROR;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Creates an error event from an error
 *
 * @param error - The error to convert
 * @param nodeName - Optional node name where error occurred
 * @param retryCount - Optional retry count for this error
 * @param fatal - Whether the error is fatal (default: false)
 * @returns Structured error event
 */
export function createErrorEvent(
  error: Error,
  nodeName?: string,
  retryCount?: number,
  fatal: boolean = false
): ErrorEvent {
  return {
    timestamp: new Date().toISOString(),
    category: classifyError(error),
    message: error.message,
    node: nodeName,
    retryCount,
    fatal,
  };
}

/**
 * Creates a response message indicating an error occurred
 *
 * @param error - The error event
 * @returns An AI message explaining the error
 */
export function createErrorResponseMessage(error: ErrorEvent): AIMessage {
  let content = "I encountered an error while processing your request. ";

  switch (error.category) {
    case ErrorCategory.LLM_UNAVAILABLE:
      content +=
        "The AI service is temporarily unavailable. Please try again in a few moments.";
      break;
    case ErrorCategory.CONTEXT_WINDOW_EXCEEDED:
      content +=
        "The conversation has become too long for me to process. Let's start a new conversation or focus on smaller pieces of information.";
      break;
    case ErrorCategory.RATE_LIMIT_EXCEEDED:
      content +=
        "We've reached the usage limit. Please try again in a few moments.";
      break;
    case ErrorCategory.TOOL_EXECUTION_ERROR:
      content +=
        "I had trouble executing a tool or accessing external data. Please check the information provided and try again.";
      break;
    case ErrorCategory.INVALID_RESPONSE_FORMAT:
      content +=
        "I encountered a problem formatting my response. Let's approach this differently.";
      break;
    default:
      content +=
        "Something unexpected happened. Let's try a different approach.";
  }

  return new AIMessage({ content });
}

/**
 * Updates state with error information
 *
 * @param state - Current state object
 * @param error - Error that occurred
 * @param nodeName - Optional node name where error occurred
 * @returns Object with error information to merge into state
 */
export function addErrorToState<T extends Record<string, any>>(
  state: T,
  error: Error,
  nodeName?: string
): { errors: ErrorEvent[]; lastError: ErrorEvent } {
  const errorEvent = createErrorEvent(error, nodeName);

  return {
    errors: [...(state.errors || []), errorEvent],
    lastError: errorEvent,
  };
}

/**
 * Determines if a retry should be attempted based on error category
 *
 * @param error - Error event to analyze
 * @param currentRetries - Current retry attempt count
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Whether to retry
 */
export function shouldRetry(
  error: ErrorEvent,
  currentRetries: number,
  maxRetries: number = 3
): boolean {
  // Don't retry if we've hit the maximum
  if (currentRetries >= maxRetries || error.fatal) {
    return false;
  }

  // Always retry these types of errors
  if (
    error.category === ErrorCategory.LLM_UNAVAILABLE ||
    error.category === ErrorCategory.RATE_LIMIT_EXCEEDED
  ) {
    return true;
  }

  // Don't retry context window errors unless explicitly configured
  if (error.category === ErrorCategory.CONTEXT_WINDOW_EXCEEDED) {
    return false;
  }

  // Optionally retry tool errors once
  if (error.category === ErrorCategory.TOOL_EXECUTION_ERROR) {
    return currentRetries < 1;
  }

  // For unknown errors, retry once
  return currentRetries < 1;
}

/**
 * Calculates exponential backoff time
 *
 * @param retryCount - Current retry attempt (0-based)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @param maxDelayMs - Maximum delay in milliseconds (default: 30000)
 * @returns Delay time in milliseconds
 */
export function calculateBackoff(
  retryCount: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): number {
  // Exponential backoff: baseDelay * 2^retryCount with jitter
  const delay = baseDelayMs * Math.pow(2, retryCount);

  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);

  // Cap at max delay
  return Math.min(delay + jitter, maxDelayMs);
}
