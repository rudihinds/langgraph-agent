# Token Refresh Best Practices and Implementation Guide

This document outlines strategies and best practices for implementing token refresh in frontend applications, with specific reference to our auth interceptor implementation.

## Table of Contents

1. [Understanding Token Refresh](#understanding-token-refresh)
2. [Implemented Refresh Strategies](#implemented-refresh-strategies)
3. [Security Considerations](#security-considerations)
4. [Edge Cases and Handling](#edge-cases-and-handling)
5. [Performance Optimizations](#performance-optimizations)
6. [Implementation Roadmap](#implementation-roadmap)
7. [Using the Authentication Interceptor](#using-the-authentication-interceptor)

## Understanding Token Refresh

### The Need for Token Refresh

Access tokens provide a secure way for clients to access protected resources. However, they come with a tradeoff:

- **Short-lived tokens**: More secure, but require frequent re-authentication
- **Long-lived tokens**: Better user experience, but higher security risk if compromised

Token refresh provides the best of both worlds:

- Short-lived access tokens for secure resource access
- Long-lived refresh tokens for seamless token renewal without user interruption

### How Token Refresh Works

1. **Initial Authentication**: User logs in and receives an access token and refresh token
2. **Resource Access**: Client uses access token to access protected resources
3. **Token Expiration**: When access token expires, client uses refresh token to get a new access token
4. **Seamless Experience**: This happens without user awareness or interruption

## Implemented Refresh Strategies

Our implementation uses two complementary strategies:

### 1. Reactive Refresh (Response-based)

Triggered when an API request fails with a 401 status and contains a specific refresh flag:

```typescript
function isTokenExpiredResponse(response: Response): boolean {
  return (
    response.status === 401 &&
    response.headers.get("X-Error-Code") === "refresh_required"
  );
}
```

**Benefits**:

- Only triggers when absolutely necessary
- Handles genuine token expiration scenarios correctly

**Drawbacks**:

- User experiences a failed request before refresh happens
- Requires backend coordinated error response format

### 2. Proactive Refresh (Header-based Recommendation)

Triggered when a response contains the `X-Token-Refresh-Recommended` header:

```typescript
async function handleProactiveRefresh(response: Response): Promise<void> {
  if (response.headers.get("X-Token-Refresh-Recommended") === "true") {
    try {
      await refreshAuthToken();
    } catch (error) {
      // Silent fail - proactive refresh is optional
      console.warn("Proactive token refresh failed:", error);
    }
  }
}
```

**Benefits**:

- Prevents token expiration errors before they occur
- Improves user experience by avoiding failed requests
- Non-blocking implementation doesn't delay response processing

**Drawbacks**:

- Requires backend support for the recommendation header
- May trigger unnecessary refreshes in some scenarios

## Security Considerations

### Token Storage

Our implementation relies on Supabase's built-in token management which:

- Stores tokens securely in memory and/or persistent storage
- Handles token encryption and secure storage
- Manages refresh token lifecycle

### Preventing Refresh Token Leakage

We implement several safeguards:

1. **HTTPS Only**: All token operations should be performed over HTTPS
2. **No Token Exposure**: Refresh tokens are never exposed in code or network requests outside of the auth flow
3. **Silent Failure**: Errors during proactive refresh are not exposed to protect implementation details

### Handling Compromised Tokens

If a refresh token is compromised:

1. Backend JWT validation ensures tokens are valid and not revoked
2. Refresh tokens should have a reasonable expiration (typically 2 weeks)
3. Users can explicitly logout to invalidate all active tokens
4. Critical security actions (password change, etc.) should invalidate all refresh tokens

## Edge Cases and Handling

### Concurrent Refresh Requests

Future improvement area - currently, multiple components could trigger token refresh simultaneously. Options:

1. **Request Coalescing**: Implement a shared promise pattern to ensure only one refresh happens
2. **Refresh Queue**: Queue requests during token refresh and retry them when complete

### Network Failures During Refresh

The interceptor handles network failures during refresh:

```typescript
try {
  // Attempt token refresh
  await refreshAuthToken();
  // Update request with new token and retry
  request = await updateRequestWithNewToken(request);
  return fetch(request);
} catch (error) {
  // If refresh fails, throw a specific error
  throw new Error(`Session refresh failed: ${error}`);
}
```

### Non-JSON Responses

The interceptor is designed to work with both JSON and non-JSON responses by:

1. Using `response.clone()` before reading the body
2. Not assuming response format for token refresh determination
3. Using headers rather than body content for refresh decisions

## Performance Optimizations

### Future Implementation: Token Refresh Caching

A performance enhancement we should consider implementing:

```typescript
// Example concept for token caching
let refreshPromise: Promise<void> | null = null;
let lastRefreshTime = 0;
const MIN_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

async function refreshAuthToken(): Promise<void> {
  const now = Date.now();

  // If a refresh is already in progress, reuse that promise
  if (refreshPromise) {
    return refreshPromise;
  }

  // If we refreshed recently, don't do it again
  if (now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
    return Promise.resolve();
  }

  // Create a new refresh promise and store it
  refreshPromise = supabase.auth
    .refreshSession()
    .then(() => {
      lastRefreshTime = Date.now();
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}
```

### Optimized Response Handling

Our implementation optimizes response handling by:

1. Early determination of refresh requirements before reading response body
2. Only cloning responses when necessary
3. Using headers for refresh decisions instead of parsing response bodies

## Implementation Roadmap

### Current Implementation

✅ Basic reactive token refresh  
✅ Proactive refresh based on headers  
✅ Error handling and retries  
✅ TypeScript type safety

### Planned Enhancements

⬜ Request coalescing for concurrent refresh requests  
⬜ Token refresh caching  
⬜ Request queueing during refresh  
⬜ Refresh timeout and circuit breaking  
⬜ Configurable refresh behavior  
⬜ Refresh event notifications  
⬜ Targeted application reloading after auth failures

### Integration with Backend

For this system to work optimally, the backend should:

1. Return 401 status with `X-Error-Code: refresh_required` for expired tokens
2. Include `X-Token-Refresh-Recommended: true` when token is near expiration
3. Provide consistent JWT token formatting
4. Implement proper security for refresh token validation

---

## Related Documentation

- [Auth Interceptor Implementation](../auth-interceptor.ts)
- [Example Usage Patterns](../examples/auth-interceptor-usage.ts)
- [Backend Authentication Flow](../../../docs/backend-auth.md)

## Using the Authentication Interceptor

The auth interceptor provides a secure way to handle token refresh in client applications. It wraps the standard `fetch` API and implements three key security enhancements:

1. **Request Coalescing** - Prevents duplicate refresh requests when multiple API calls fail simultaneously
2. **Circuit Breaker** - Prevents infinite refresh loops by limiting consecutive refresh attempts
3. **Secure Token Handling** - Ensures tokens are never exposed in logs or error messages

### Basic Usage

```typescript
import { createAuthInterceptor } from "@/lib/api/auth-interceptor";

// Create the interceptor once in your application
const authInterceptor = createAuthInterceptor();

// Use it instead of fetch for all API calls
async function fetchData() {
  try {
    const response = await authInterceptor.fetch("/api/protected-resource", {
      headers: {
        "Content-Type": "application/json",
        // The interceptor will handle token refresh automatically,
        // you just need to include your current token
        Authorization: `Bearer ${currentToken}`,
      },
    });

    return await response.json();
  } catch (error) {
    // Errors from the interceptor are sanitized to prevent token exposure
    console.error("API request failed:", error);
    throw error;
  }
}
```

### Token Refresh Mechanisms

The interceptor implements two refresh mechanisms:

1. **Reactive Refresh** - Automatically refreshes expired tokens when a 401 response is received with the `refresh_required` flag
2. **Proactive Refresh** - Refreshes tokens in the background when the `X-Token-Refresh-Recommended` header is present in a response

### Implementation Details

#### Request Coalescing

The interceptor uses a shared `refreshPromise` to ensure that multiple concurrent requests that trigger a token refresh will all use the same refresh operation. This prevents unnecessary API calls and potential race conditions.

```typescript
// If there's already a refresh in progress, reuse that promise
if (refreshPromise) {
  return await refreshPromise;
}

// Create a new refresh operation and store the promise
refreshPromise = executeTokenRefresh();
```

The actual refresh logic is extracted into a separate `executeTokenRefresh` function for better maintainability and separation of concerns.

#### Circuit Breaker

To prevent infinite refresh loops, the interceptor implements a circuit breaker pattern that tracks consecutive refresh failures and stops attempting refreshes after reaching `MAX_REFRESH_ATTEMPTS` (default: 3):

```typescript
// Prevent refresh if we've had too many consecutive failures
if (consecutiveRefreshFailures >= MAX_REFRESH_ATTEMPTS) {
  throw new Error("Maximum refresh attempts exceeded");
}
```

The counter is incremented on failures and reset to zero on successful refreshes.

#### Secure Token Handling

All errors and logs are sanitized to prevent token exposure using utility functions:

```typescript
// Creating sanitized errors
const createSecureError = (prefix: string, error: unknown): Error => {
  return new Error(`${prefix}: ${redactToken(String(error))}`);
};

// Safely logging errors
const logSecureError = (prefix: string, error: unknown): void => {
  console.error(prefix, redactToken(String(error)));
};
```

The `redactToken` function handles the actual token redaction:

```typescript
// Redact tokens from error messages
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
```

#### Proactive Token Refresh

The interceptor handles proactive token refresh through the `handleProactiveRefresh` function, which performs refresh operations in the background without blocking the original request:

```typescript
// Check for refresh recommendation header
if (response.headers.has(TOKEN_REFRESH_HEADER)) {
  // Start a background refresh (non-blocking)
  handleProactiveRefresh().catch((error) => {
    logSecureError("Error in background refresh", error);
  });
}

// The extracted function for clarity
async function handleProactiveRefresh(): Promise<void> {
  try {
    await refreshAuthToken();
  } catch (error) {
    // Silently log errors for background refresh
    logSecureError("Proactive refresh failed", error);
  }
}
```

### Core Architecture Components

The auth interceptor is built with several key components:

1. **Types and Constants**

   - `AuthTokenResult` - Type for the token refresh result
   - `AuthInterceptor` - Interface for the interceptor object
   - `TOKEN_REFRESH_HEADER` - Constants for header names
   - `MAX_REFRESH_ATTEMPTS` - Configuration for the circuit breaker

2. **Utility Functions**

   - `redactToken` - Sanitizes strings to remove sensitive token data
   - `createSecureError` - Creates error objects with sanitized messages
   - `logSecureError` - Safely logs errors without exposing tokens

3. **Token Management**

   - `refreshAuthToken` - Main token refresh function with safeguards
   - `executeTokenRefresh` - Performs the actual refresh operation
   - `updateRequestWithNewToken` - Creates new requests with refreshed tokens

4. **Request Processing**
   - `isTokenExpiredResponse` - Identifies expired token responses
   - `handleProactiveRefresh` - Background token refresh handling
   - `createAuthInterceptor` - Factory function for the interceptor

This modular architecture ensures clean separation of concerns while maintaining high security standards.

### Configuration

The interceptor has two configurable constants:

- `TOKEN_REFRESH_HEADER` - The header to check for proactive refresh recommendation (default: `X-Token-Refresh-Recommended`)
- `MAX_REFRESH_ATTEMPTS` - Maximum number of consecutive refresh attempts before giving up (default: 3)

You can modify these constants in the auth-interceptor.ts file if needed.

### Error Handling

All errors thrown by the interceptor are sanitized to prevent token exposure. However, you should still implement proper error handling in your application to provide a good user experience.

Common error scenarios:

1. **Authentication Failed** - The token couldn't be refreshed (e.g., user is no longer authenticated)
2. **Maximum Refresh Attempts Exceeded** - The circuit breaker has been triggered
3. **Network Errors** - Connection issues during token refresh or API requests

### Testing

When testing components that use the auth interceptor, you can mock it using Vitest:

```typescript
// Mock the auth interceptor
vi.mock("@/lib/api/auth-interceptor", () => ({
  createAuthInterceptor: () => ({
    fetch: vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: "test" }))),
  }),
}));
```

### Important Note for Developers

When working with the Supabase client in the refresh function, make sure to provide the necessary arguments:

```typescript
// Correct way to call createBrowserClient with URL and anon key
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

If you're using the default implementation, ensure that these environment variables are properly set.
