import { Logger } from "../logger.js";

const logger = Logger.getInstance();

/**
 * Utilities for implementing exponential backoff and retry logic.
 */

/**
 * Options for configuring exponential backoff behavior
 */
export interface BackoffOptions {
  /**
   * Maximum number of retry attempts before giving up
   */
  maxRetries: number;

  /**
   * Base delay in milliseconds between retries
   */
  baseDelayMs: number;

  /**
   * Maximum delay in milliseconds (caps exponential growth)
   */
  maxDelayMs?: number;

  /**
   * Optional function to determine if a particular error should trigger a retry
   */
  shouldRetry?: (error: any) => boolean;

  /**
   * Optional callback to log retry attempts
   */
  onRetry?: (attempt: number, error: any, delayMs: number) => void;
}

/**
 * Implements exponential backoff retry logic for async functions.
 *
 * @param fn - The asynchronous function to retry
 * @param options - Backoff configuration options
 * @returns The result of the function if successful
 * @throws The last error encountered if all retries fail
 */
export async function exponentialBackoff<T>(
  fn: () => Promise<T>,
  options: BackoffOptions
): Promise<T> {
  const {
    maxRetries,
    baseDelayMs,
    maxDelayMs = 30000, // Default 30 second cap
    shouldRetry = () => true, // Default to retry all errors
    onRetry = () => {}, // Default no-op
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on the last attempt or if shouldRetry returns false
      if (attempt >= maxRetries || !shouldRetry(error)) {
        break;
      }

      // Calculate delay with exponential backoff: base * 2^attempt + some jitter
      const jitter = Math.random() * 100;
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + jitter,
        maxDelayMs
      );

      // Call the onRetry callback if provided
      onRetry(attempt + 1, error, delay);

      // Wait before the next attempt
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // If we get here, all retries failed
  throw lastError;
}
