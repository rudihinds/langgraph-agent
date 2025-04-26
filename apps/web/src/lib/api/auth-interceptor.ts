/**
 * Authentication interceptor for handling token refresh
 *
 * This interceptor wraps fetch calls to handle:
 * 1. Automatic token refresh on 401 responses with refresh_required flag
 * 2. Proactive token refresh based on X-Token-Refresh-Recommended header
 */
import { createBrowserClient } from "@/lib/supabase/client";

// Constants for token refresh
const TOKEN_REFRESH_HEADER = "X-Token-Refresh-Recommended";
const MAX_REFRESH_ATTEMPTS = 3;

/**
 * Auth token refresh result type
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

/**
 * Type for the fetch interceptor object
 */
type AuthInterceptor = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
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
 * Refreshes the Supabase auth token, handling errors
 * Implements request coalescing and circuit breaker patterns
 *
 * @returns A promise resolving to the new tokens or null if refresh failed
 * @throws Error if circuit breaker triggered or refresh fails
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
    refreshPromise = executeTokenRefresh();
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
 * Executes the actual token refresh operation
 * Extracted to keep the main function cleaner
 *
 * @returns Promise resolving to the new tokens or null
 */
async function executeTokenRefresh(): Promise<AuthTokenResult> {
  try {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.refreshSession();

    // Handle refresh errors from Supabase
    if (error) {
      consecutiveRefreshFailures++;
      return null;
    }

    // Reset counter on successful refresh
    consecutiveRefreshFailures = 0;

    return {
      accessToken: data.session?.access_token || "",
      refreshToken: data.session?.refresh_token || "",
    };
  } catch (error) {
    // Security Enhancement 2: Circuit Breaker
    consecutiveRefreshFailures++;

    // Log securely without exposing tokens
    logSecureError("Token refresh error", error);

    // Rethrow with sanitized message
    throw createSecureError("Auth token refresh failed", error);
  }
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
 * @returns An auth interceptor with a fetch method
 */
export function createAuthInterceptor(): AuthInterceptor {
  return {
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
          }
        } catch (error) {
          // Log securely without exposing tokens
          logSecureError("Auth refresh and retry failed", error);

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
}
