/**
 * Error classification for LangGraph
 * 
 * This module provides utilities for classifying errors that occur during LLM
 * interactions, state management, and tool execution. It allows for standardized
 * error handling, appropriate retry strategies, and consistent error reporting.
 */

import { z } from 'zod';

/**
 * Enumeration of error categories for LLM operations
 */
export enum ErrorCategory {
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  CONTEXT_WINDOW_ERROR = 'CONTEXT_WINDOW_ERROR',
  LLM_UNAVAILABLE_ERROR = 'LLM_UNAVAILABLE_ERROR',
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  INVALID_RESPONSE_FORMAT = 'INVALID_RESPONSE_FORMAT',
  CHECKPOINT_ERROR = 'CHECKPOINT_ERROR',
  LLM_SUMMARIZATION_ERROR = 'LLM_SUMMARIZATION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Error event schema for consistent error reporting
 */
export const ErrorEventSchema = z.object({
  category: z.nativeEnum(ErrorCategory),
  message: z.string(),
  error: z.any().optional(),
  timestamp: z.date().optional(),
  nodeId: z.string().optional(),
  retry: z.object({
    count: z.number(),
    maxRetries: z.number(),
    shouldRetry: z.boolean(),
    backoffMs: z.number().optional(),
  }).optional(),
});

type ErrorEvent = z.infer<typeof ErrorEventSchema>;

/**
 * Detect rate limit errors in error messages
 */
function isRateLimitError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message;
  return (
    message.includes('rate limit') ||
    message.includes('ratelimit') ||
    message.includes('too many requests') ||
    message.includes('429') ||
    message.includes('quota exceeded')
  );
}

/**
 * Detect context window exceeded errors in error messages
 */
function isContextWindowError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message;
  return (
    message.includes('context window') ||
    message.includes('token limit') ||
    message.includes('maximum context length') ||
    message.includes('maximum token length') ||
    message.includes('maximum tokens') ||
    message.includes('too many tokens')
  );
}

/**
 * Detect LLM unavailable errors in error messages
 */
function isLLMUnavailableError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message;
  return (
    message.includes('service unavailable') ||
    message.includes('temporarily unavailable') ||
    message.includes('server error') ||
    message.includes('500') ||
    message.includes('503') ||
    message.includes('connection error') ||
    message.includes('timeout')
  );
}

/**
 * Detect tool execution errors in error messages
 */
function isToolExecutionError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message;
  return (
    message.includes('tool execution failed') ||
    message.includes('tool error') ||
    message.includes('failed to execute tool')
  );
}

/**
 * Detect invalid response format errors in error messages
 */
function isInvalidResponseFormatError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message;
  return (
    message.includes('invalid format') ||
    message.includes('parsing error') ||
    message.includes('malformed response') ||
    message.includes('failed to parse') ||
    message.includes('invalid JSON')
  );
}

/**
 * Detect checkpoint errors in error messages
 */
function isCheckpointError(error: Error | string): boolean {
  const message = typeof error === 'string' ? error : error.message;
  return (
    message.includes('checkpoint error') ||
    message.includes('failed to save checkpoint') ||
    message.includes('failed to load checkpoint') ||
    message.includes('checkpoint corrupted')
  );
}

/**
 * Classify an error by examining its message
 */
export function classifyError(error: Error | string): ErrorCategory {
  if (isRateLimitError(error)) {
    return ErrorCategory.RATE_LIMIT_ERROR;
  }
  
  if (isContextWindowError(error)) {
    return ErrorCategory.CONTEXT_WINDOW_ERROR;
  }
  
  if (isLLMUnavailableError(error)) {
    return ErrorCategory.LLM_UNAVAILABLE_ERROR;
  }
  
  if (isToolExecutionError(error)) {
    return ErrorCategory.TOOL_EXECUTION_ERROR;
  }
  
  if (isInvalidResponseFormatError(error)) {
    return ErrorCategory.INVALID_RESPONSE_FORMAT;
  }
  
  if (isCheckpointError(error)) {
    return ErrorCategory.CHECKPOINT_ERROR;
  }
  
  return ErrorCategory.UNKNOWN_ERROR;
}

/**
 * Create a structured error event from an error
 */
export function createErrorEvent(
  error: Error | string,
  nodeId?: string,
  retry?: { count: number; maxRetries: number; shouldRetry: boolean; backoffMs?: number }
): ErrorEvent {
  const category = classifyError(error);
  const message = typeof error === 'string' ? error : error.message;
  
  return {
    category,
    message,
    error: typeof error !== 'string' ? error : undefined,
    timestamp: new Date(),
    nodeId,
    retry,
  };
}

/**
 * Add an error to the state object
 */
export function addErrorToState<T extends { errors?: ErrorEvent[] }>(
  state: T,
  error: ErrorEvent
): T {
  const errors = state.errors || [];
  return {
    ...state,
    errors: [...errors, error],
  };
}

/**
 * Determine if an error should be retried based on its category
 */
export function shouldRetry(
  category: ErrorCategory, 
  retryCount: number,
  maxRetries: number = 3
): boolean {
  if (retryCount >= maxRetries) {
    return false;
  }
  
  switch (category) {
    case ErrorCategory.RATE_LIMIT_ERROR:
    case ErrorCategory.LLM_UNAVAILABLE_ERROR:
    case ErrorCategory.TOOL_EXECUTION_ERROR:
      return true;
    case ErrorCategory.CONTEXT_WINDOW_ERROR:
    case ErrorCategory.INVALID_RESPONSE_FORMAT:
    case ErrorCategory.CHECKPOINT_ERROR:
    case ErrorCategory.LLM_SUMMARIZATION_ERROR:
    case ErrorCategory.UNKNOWN_ERROR:
      return false;
  }
}

/**
 * Calculate exponential backoff time in milliseconds
 */
export function calculateBackoff(
  retryCount: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 60000,
  jitter: boolean = true
): number {
  // Exponential backoff: 2^retryCount * baseDelay
  let delay = Math.min(
    maxDelayMs,
    Math.pow(2, retryCount) * baseDelayMs
  );
  
  // Add jitter if requested (random value between 0 and 0.5 * delay)
  if (jitter) {
    delay += Math.random() * 0.5 * delay;
  }
  
  return delay;
}