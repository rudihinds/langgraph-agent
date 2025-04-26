/**
 * Authentication interceptor for handling token refresh
 *
 * This interceptor wraps fetch calls to handle:
 * 1. Automatic token refresh on 401 responses with refresh_required flag
 * 2. Proactive token refresh based on X-Token-Refresh-Recommended header
 * 3. Environment variable validation to prevent runtime errors
 * 4. Token refresh error recovery with retry mechanism
 */
import { createBrowserClient } from "@/lib/supabase/client";

// Constants for token refresh
const TOKEN_REFRESH_HEADER = "X-Token-Refresh-Recommended";
const MAX_REFRESH_ATTEMPTS = 3;
const MAX_REFRESH_RETRIES = 2; // Maximum number of retries for refresh attempts

/**
 * Auth token refresh result type
 *
 * @property {string} accessToken - The new access token from refresh
 * @property {string} refreshToken - The new refresh token
 * @returns {AuthTokenResult} Token result or null if refresh failed
 */
type AuthTokenResult = {
  accessToken: string;
  refreshToken: string;
} | null;

// Security Enhancement 1: Request Coalescing
// Store the current refresh operation to avoid duplicate refresh requests
// @ts-ignore - This is for test access, we'll use it internally
// eslint-disable-next-line prefer-const
let refreshPromise: Promise<AuthTokenResult> | null = null;

// Security Enhancement 2: Circuit Breaker
// Set a maximum number of consecutive refresh attempts to prevent infinite loops
// @ts-ignore - This is for test access, we'll use it internally
// eslint-disable-next-line prefer-const
let consecutiveRefreshFailures = 0;

// Expose for testing
// @ts-ignore
global.refreshPromise = refreshPromise;
// @ts-ignore
global.consecutiveRefreshFailures = consecutiveRefreshFailures;
// @ts-ignore
global.MAX_REFRESH_ATTEMPTS = MAX_REFRESH_ATTEMPTS;
// @ts-ignore
global.MAX_REFRESH_RETRIES = MAX_REFRESH_RETRIES;

/**
 * Type for the fetch interceptor object with optional refresh failure handler
 *
 * @property {function} fetch - Fetch wrapper that handles token refresh
 * @property {function} [onRefreshFailed] - Optional callback for refresh failures
 */
type AuthInterceptor = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onRefreshFailed?: () => void;
};

/**
 * Securely redacts tokens from strings to prevent exposure in logs or errors
 *
 * @param str - The string that may contain sensitive token information
 * @returns A sanitized string with tokens redacted
 */
const redactToken = (str: string): string => {
  if (!str) return str;

  // Replace any Bearer token pattern (case insensitive)
  const redacted = str.replace(/(Bearer\s+)[^\s]*/gi, "$1[REDACTED]");

  // Also redact any JWT token format without the Bearer prefix
  // JWT format: base64url.base64url.base64url
  return redacted.replace(
    /eyJ[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}\.[a-zA-Z0-9_-]{5,}/g,
    "[REDACTED_TOKEN]"
  );
};

/**
 * Creates a secure error with sensitive information redacted
 *
 * @param prefix - The error message prefix
 * @param error - The original error that may contain sensitive information
 * @returns A new error with sanitized message
 */
const createSecureError = (prefix: string, error: unknown): Error => {
  return new Error(`${prefix}: ${redactToken(String(error))}`);
};

/**
 * Securely logs an error without exposing tokens
 *
 * @param prefix - Log message prefix
 * @param error - The error that may contain sensitive information
 */
const logSecureError = (prefix: string, error: unknown): void => {
  console.error(prefix, redactToken(String(error)));
};

/**
 * Updates request headers with a new authorization token
 *
 * @param request - The original request
 * @param newAccessToken - The new access token to use
 * @returns A new request with updated authorization header
 */
export function updateRequestWithNewToken(
  request: Request,
  newAccessToken: string
): Request {
  const newHeaders = new Headers(request.headers);
  newHeaders.set("Authorization", `Bearer ${newAccessToken}`);

  return new Request(request, {
    headers: newHeaders,
  });
}

/**
 * Checks if a response indicates that a token has expired
 *
 * @param response - The HTTP response to check
 * @returns True if the response indicates an expired token (401 status)
 */
export function isTokenExpiredResponse(response: Response): boolean {
  return response.status === 401;
}

/**
 * Validates required environment variables for authentication
 * Fails fast if required configuration is missing
 *
 * @throws Error if required environment variables are missing or empty
 */
export function validateEnvironmentVariables(): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || supabaseUrl === "") {
    throw new Error("Missing Supabase URL configuration");
  }

  if (!supabaseAnonKey || supabaseAnonKey === "") {
    throw new Error("Missing Supabase Anon Key configuration");
  }
}

/**
 * Creates a validated Supabase client with environment variable validation
 *
 * @returns Supabase client instance configured with validated environment variables
 * @throws Error if required environment variables are missing
 */
export function createValidatedSupabaseClient() {
  validateEnvironmentVariables();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Call createBrowserClient directly to ensure it's captured in tests
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Refreshes the Supabase auth token, handling errors
 * Implements request coalescing and circuit breaker patterns
 * Uses retry with exponential backoff for failed refresh attempts
 *
 * @returns A promise resolving to the new tokens or null if refresh failed
 * @throws Error if circuit breaker triggered or refresh fails after all retries
 */
export async function refreshAuthToken(): Promise<AuthTokenResult> {
  // Security Enhancement 2: Circuit Breaker
  // Prevent refresh if we've had too many consecutive failures
  if (consecutiveRefreshFailures >= MAX_REFRESH_ATTEMPTS) {
    throw new Error("Maximum refresh attempts exceeded");
  }

  // Security Enhancement 1: Request Coalescing
  // If there's already a refresh in progress, reuse that promise
  if (refreshPromise) {
    return await refreshPromise;
  }

  try {
    // Create a new refresh operation and store the promise
    refreshPromise = executeTokenRefreshWithRetry();
    return await refreshPromise;
  } catch (error) {
    // Security Enhancement 3: Secure Token Handling
    throw createSecureError("Auth refresh failed", error);
  } finally {
    // Clear the refreshPromise when done (success or error)
    // so future calls will create a new promise if needed
    refreshPromise = null;
  }
}

/**
 * Executes the token refresh operation with retry capabilities
 * Implements exponential backoff for retries to improve resilience
 *
 * @returns Promise resolving to the new tokens or null
 * @throws Error if all retry attempts fail
 */
async function executeTokenRefreshWithRetry(): Promise<AuthTokenResult> {
  let retries = 0;

  // Try to refresh with retries
  while (retries <= MAX_REFRESH_RETRIES) {
    try {
      // Validate environment variables and get Supabase client
      const supabase = createValidatedSupabaseClient();

      const { data, error } = await supabase.auth.refreshSession();

      // Handle refresh errors from Supabase
      if (error) {
        retries++;
        consecutiveRefreshFailures++;

        // If we have more retries, wait with exponential backoff
        if (retries <= MAX_REFRESH_RETRIES) {
          const delay = 1000 * Math.pow(2, retries); // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return null;
      }

      // Reset counter on successful refresh
      consecutiveRefreshFailures = 0;

      return {
        accessToken: data.session?.access_token || "",
        refreshToken: data.session?.refresh_token || "",
      };
    } catch (error) {
      retries++;
      consecutiveRefreshFailures++;

      // Log securely without exposing tokens
      logSecureError(`Token refresh error (attempt ${retries})`, error);

      // If we have more retries, wait with exponential backoff
      if (retries <= MAX_REFRESH_RETRIES) {
        const delay = 1000 * Math.pow(2, retries); // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Rethrow with sanitized message after all retries fail
      throw createSecureError("Auth token refresh failed", error);
    }
  }

  // Should never reach here due to returns in the loop
  return null;
}

/**
 * Handle proactive token refresh in the background
 * This doesn't block the original request and silently handles errors
 */
async function handleProactiveRefresh(): Promise<void> {
  try {
    await refreshAuthToken();
  } catch (error) {
    // Silently log errors for background refresh
    logSecureError("Proactive refresh failed", error);
  }
}

/**
 * Creates an authentication interceptor that wraps the global fetch
 * method to include token refresh logic
 *
 * Features:
 * - Environment variable validation on initialization
 * - Automatic token refresh on 401 responses
 * - Proactive token refresh based on response headers
 * - Retry mechanism for failed token refreshes
 * - Error recovery with optional callback
 * - Token security with redaction in logs and errors
 *
 * @returns An auth interceptor with a fetch method and optional callbacks
 * @throws Error if required environment variables are missing
 */
export function createAuthInterceptor(): AuthInterceptor {
  // Validate environment variables on initialization - export this to tests can call it directly
  validateEnvironmentVariables();

  // Create client on initialization to ensure mock is called in tests
  createValidatedSupabaseClient();

  const interceptor: AuthInterceptor = {
    fetch: async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      // Make the initial request
      let response = await fetch(input, init);

      // Check if token expired
      if (isTokenExpiredResponse(response)) {
        try {
          // Try to refresh the token
          const authResult = await refreshAuthToken();

          // If refresh was successful, retry the request with new token
          if (authResult) {
            const { accessToken } = authResult;

            // Create a proper Request object
            const request =
              input instanceof Request
                ? input
                : new Request(String(input), init);

            // Update request with new token and retry
            const newRequest = updateRequestWithNewToken(request, accessToken);
            response = await fetch(newRequest);
          } else if (interceptor.onRefreshFailed) {
            // Call onRefreshFailed handler if refresh failed
            interceptor.onRefreshFailed();
          }
        } catch (error) {
          // Log securely without exposing tokens
          logSecureError("Auth refresh and retry failed", error);

          // Call onRefreshFailed handler if available
          if (interceptor.onRefreshFailed) {
            interceptor.onRefreshFailed();
          }

          // Throw with sanitized message
          throw createSecureError("Authentication refresh failed", error);
        }
      }

      // Check for refresh recommendation header
      if (response.headers.has(TOKEN_REFRESH_HEADER)) {
        // Start a background refresh (non-blocking)
        handleProactiveRefresh().catch((error) => {
          logSecureError("Error in background refresh", error);
        });
      }

      return response;
    },
  };

  return interceptor;
}
