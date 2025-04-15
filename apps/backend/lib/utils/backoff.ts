/**
 * Utility for implementing exponential backoff and retry logic
 */

/**
 * Configuration for the retry operation
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  
  /** Initial delay in milliseconds */
  initialDelayMs?: number;
  
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  
  /** Exponential backoff factor (typically 2) */
  backoffFactor?: number;
  
  /** Whether to add jitter to the delay */
  addJitter?: boolean;
  
  /** Predicate to determine if an error should trigger a retry */
  shouldRetry?: (error: any) => boolean;
  
  /** Optional logger */
  logger?: Console | null;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 30000,
  backoffFactor: 2,
  addJitter: true,
  shouldRetry: () => true,
  logger: console,
};

/**
 * Calculate the backoff delay for the current retry attempt
 * @param attempt Current retry attempt number (starting at 1)
 * @param options Retry options
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(
  attempt: number,
  options: Required<RetryOptions>
): number {
  const { initialDelayMs, maxDelayMs, backoffFactor, addJitter } = options;
  
  // Calculate exponential delay
  let delay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
  
  // Apply jitter if enabled (±20%)
  if (addJitter) {
    const jitterFactor = 0.8 + Math.random() * 0.4; // Random between 0.8 and 1.2
    delay = delay * jitterFactor;
  }
  
  // Cap at max delay
  return Math.min(delay, maxDelayMs);
}

/**
 * Execute a function with exponential backoff and retry
 * @param fn The async function to execute with retry
 * @param options Retry options
 * @returns Result of the function
 * @throws Last error encountered if max retries exceeded
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // Merge provided options with defaults
  const mergedOptions: Required<RetryOptions> = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options,
  };
  
  const {
    maxRetries,
    shouldRetry,
    logger,
  } = mergedOptions;
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry based on the error
      if (attempt <= maxRetries && shouldRetry(error)) {
        const delay = calculateBackoffDelay(attempt, mergedOptions);
        
        if (logger) {
          logger.warn(`Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`, {
            error: error instanceof Error ? error.message : String(error),
            attempt,
            maxRetries,
          });
        }
        
        // Wait for the calculated delay
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // If we're here, we've exhausted our retries or shouldn't retry
      break;
    }
  }
  
  // If we got here, we failed after all retries
  if (logger) {
    logger.error(`All ${maxRetries} retry attempts failed`, {
      error: lastError instanceof Error ? lastError.message : String(lastError),
      maxRetries,
    });
  }
  
  throw lastError;
}

/**
 * A decorator factory for retry functionality
 * @param options Retry options
 * @returns A decorator that adds retry functionality to a method
 */
export function withRetryDecorator(options: RetryOptions = {}) {
  return function(
    _target: any,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
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
export function createRetryableFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: any[]) => {
    return withRetry(() => fn(...args), options);
  }) as T;
}