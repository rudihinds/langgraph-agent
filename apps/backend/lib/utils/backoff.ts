/**
 * Backoff utility
 *
 * Provides retry functionality with exponential backoff for database operations
 * and other external API calls that may need retries.
 */

/**
 * Retry options for the withRetry function
 */
export interface RetryOptions {
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Backoff factor for exponential backoff */
  backoffFactor?: number;
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  /** Whether to add jitter to the delay */
  jitter?: boolean;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  initialDelayMs: 100,
  maxRetries: 3,
  backoffFactor: 2,
  maxDelayMs: 5000,
  jitter: true,
};

/**
 * Retry a function with exponential backoff
 *
 * @param fn Function to retry
 * @param options Retry options
 * @returns Result of the function
 * @throws Error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;

      if (attempt > (opts.maxRetries || DEFAULT_RETRY_OPTIONS.maxRetries!)) {
        console.error(`All ${opts.maxRetries} retry attempts failed`, {
          error,
          maxRetries: opts.maxRetries,
        });
        throw error;
      }

      // Calculate delay with exponential backoff
      let delayMs =
        opts.initialDelayMs! * Math.pow(opts.backoffFactor!, attempt - 1);

      // Apply maximum delay
      delayMs = Math.min(delayMs, opts.maxDelayMs!);

      // Add jitter if enabled (±20%)
      if (opts.jitter) {
        const jitterFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
        delayMs = Math.floor(delayMs * jitterFactor);
      }

      console.log(`Attempt ${attempt} failed, retrying in ${delayMs}ms`, {
        error,
        attempt,
        maxRetries: opts.maxRetries,
      });

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * A decorator factory for retry functionality
 * @param options Retry options
 * @returns A decorator that adds retry functionality to a method
 */
function withRetryDecorator(options: RetryOptions = {}) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Create a retry-enabled version of a function
 * @param fn Function to wrap with retry logic
 * @param options Retry options
 * @returns A new function with retry capability
 */
function createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: any[]) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}
