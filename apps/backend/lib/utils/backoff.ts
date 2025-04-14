import { Logger } from "../logger.js";

const logger = Logger.getInstance();

/**
 * Options for exponential backoff
 */
export interface BackoffOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Execute a function with exponential backoff retry logic
 *
 * @param fn - Function to execute with retries
 * @param options - Backoff configuration
 * @returns Result of the function
 */
export async function exponentialBackoff<T>(
  fn: () => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 100,
    maxDelayMs = 10000,
    factor = 2,
    // Default retry condition: retry on any error except specific non-retriable HTTP status codes
    shouldRetry = (error: any) => {
      // Check if error has a status property (common in HTTP errors)
      const status = error?.status || error?.code || error?.name;
      if (status) {
        // Do not retry client errors (4xx) except for potential rate limits (429)
        if (status >= 400 && status < 500 && status !== 429) {
          return false;
        }
      }
      // Retry all other errors (including network errors, 5xx server errors, rate limits)
      return true;
    },
  } = options;

  let retries = 0;
  let delay = baseDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      logger.warn("Operation failed, evaluating retry", { retry: retries + 1, maxRetries, error: error?.message || error });
      if (retries >= maxRetries || !shouldRetry(error)) {
        logger.error("Max retries reached or error not retriable, throwing error", { error: error?.message || error });
        throw error;
      }

      // Calculate next delay with jitter
      const jitter = Math.random() * 0.2 - 0.1; // \u00b110% jitter
      delay = Math.min(delay * factor * (1 + jitter), maxDelayMs);

      logger.info(`Retrying operation in ${delay.toFixed(0)}ms`, { retry: retries + 1 });
      // Wait before next retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      retries++;
    }
  }
}
