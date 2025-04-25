# Backend Authentication Documentation

## Overview

This document outlines the authentication flow between the frontend and backend for secure access to user resources, particularly Supabase storage.

## Problem Statement

The current implementation uses the Supabase service role key for backend operations, which bypasses Row Level Security (RLS) policies. However, when accessing user-specific resources like RFP documents in storage:

1. Without proper user context, the backend cannot access files protected by RLS
2. Using service role keys for all operations is a security risk in production
3. There's no mechanism to validate that users only access their own resources

## Solution Architecture

We implement a token-based authentication flow that:

1. Passes the user's JWT token from frontend to backend
2. Validates the token and creates an authenticated Supabase client
3. Uses this client for storage operations, respecting RLS policies
4. Rejects unauthorized access attempts with appropriate status codes
5. Adds token refresh functionality to handle token expiration gracefully

## Implementation Details

### 1. Authentication Middleware

The middleware intercepts incoming requests, validates auth tokens, and attaches authenticated Supabase clients to the request object.

```javascript
export async function authMiddleware(req, res, next) {
  const logger = Logger.getInstance();
  const requestId = req.headers["x-request-id"] || "unknown";

  // Extract and validate token from authorization header
  const { token, error: extractError } = extractAuthToken(
    req,
    logger,
    requestId
  );

  if (extractError) {
    return res.status(extractError.status).json({
      error: extractError.error,
      message: extractError.message,
    });
  }

  try {
    // Check for required environment variables
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.error("Missing Supabase environment variables", { requestId });
      return res.status(500).json({
        error: "Server configuration error",
        message: "Server configuration error",
      });
    }

    // Initialize Supabase client with proper configuration
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Validate the token and get the user
    const { data, error } = await supabase.auth.getUser();

    // Handle authentication errors
    if (error) {
      // Special handling for expired tokens
      if (error.message && error.message.includes("expired")) {
        logger.warn("Auth error: expired token", { requestId, error });
        return res.status(401).json({
          error: "Token expired",
          message: "Token has expired",
          refresh_required: true,
        });
      }

      // Handle other authentication errors
      logger.warn("Auth error", { requestId, error });
      return res.status(401).json({
        error: "Invalid token",
        message: error.message,
      });
    }

    // Authentication successful - attach user and supabase client to request
    req.user = data.user;
    req.supabase = supabase;

    // Process token expiration information
    processTokenExpiration(req, data.session, logger, requestId, data.user.id);

    // Continue to next middleware or route handler
    next();
  } catch (err) {
    // Handle unexpected errors
    logger.error("Unexpected auth error", {
      requestId,
      error: err,
      stack: err.stack,
    });

    return res.status(500).json({
      error: "Authentication error",
      message: "Internal server error during authentication",
    });
  }
}
```

### 2. Token Expiration Processing

A dedicated function calculates token expiration time and flags tokens that are close to expiring:

```javascript
// Number of seconds before token expiration when refresh should be recommended (10 minutes)
const TOKEN_REFRESH_THRESHOLD_SECONDS = 600;

/**
 * Calculates token expiration information and attaches it to the request
 *
 * @param {Object} req - Express request object
 * @param {Object} session - User session containing expiration timestamp
 * @param {Object} logger - Logger instance
 * @param {string} requestId - Request identifier for logging
 * @param {string} userId - User ID for logging
 */
function processTokenExpiration(req, session, logger, requestId, userId) {
  if (!session || !session.expires_at) return;

  const currentTimeSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = session.expires_at;
  const timeRemainingSeconds = expiresAtSeconds - currentTimeSeconds;

  // Attach expiration metadata to request for downstream handlers
  req.tokenExpiresIn = timeRemainingSeconds;
  req.tokenRefreshRecommended =
    timeRemainingSeconds <= TOKEN_REFRESH_THRESHOLD_SECONDS;

  // Log appropriate message based on expiration proximity
  if (req.tokenRefreshRecommended) {
    logger.warn("Token close to expiration", {
      requestId,
      timeRemaining: timeRemainingSeconds,
      expiresAt: expiresAtSeconds,
      userId,
    });
  } else {
    logger.info("Valid authentication", {
      requestId,
      userId,
      tokenExpiresIn: timeRemainingSeconds,
    });
  }
}
```

### 3. Frontend Token Passing

The frontend retrieves the session token from Supabase Auth and includes it in API requests to the backend.

```typescript
// In the frontend API client
async function apiRequest(endpoint, options = {}) {
  // Get current session from Supabase
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  // Add token to request headers if available
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  // Make the API request
  return fetch(`/api/${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      ...headers,
    },
  });
}
```

### 4. Token Refresh Handling in Frontend

The frontend client can handle token refresh based on response status or headers:

```javascript
// Handle 401 errors with refresh
async function handleApiResponse(response) {
  if (response.ok) {
    return await response.json();
  }

  if (response.status === 401) {
    const data = await response.json();

    // Check if token needs refresh
    if (data.refresh_required) {
      try {
        // Refresh the token
        await refreshAuthToken();

        // Retry the original request with new token
        return await retry(originalRequest);
      } catch (refreshError) {
        // If refresh fails, redirect to login
        redirectToLogin();
      }
    }

    // Other auth errors
    handleAuthError(data);
  }

  // Handle other error responses
  throw new Error(`API error: ${response.status}`);
}

// Proactive token refresh
function setupRefreshInterceptor() {
  // Check for X-Token-Refresh-Recommended header
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch(...args);

    if (response.headers.get("X-Token-Refresh-Recommended") === "true") {
      // Trigger a token refresh in the background
      refreshAuthToken().catch(console.error);
    }

    return response;
  };
}
```

### 5. Protected Routes

All sensitive routes are protected by the authentication middleware.

```javascript
// In the router configuration
import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import chatRouter from "./chat.js";

const router = express.Router();

// Apply auth middleware to all routes in this router
router.use(authMiddleware);

// Mount sub-routers
router.use("/chat", chatRouter);

export default router;
```

### 6. Route Handlers with Token Refresh Awareness

Route handlers can use the token expiration information to notify clients:

```javascript
app.get("/api/data", authMiddleware, (req, res) => {
  // If token is close to expiration, suggest a refresh
  if (req.tokenRefreshRecommended) {
    res.set("X-Token-Refresh-Recommended", "true");
  }

  // Proceed with normal request handling
  res.json({ data: "Your data" });
});
```

### 7. Authenticated Storage Access

Storage operations use the authenticated client to respect RLS policies.

```typescript
// In the document loader node
export const documentLoaderNode = async (state, context) => {
  // Extract RFP ID
  const rfpId = state.rfpDocument?.id;

  // Get authenticated client from context, or fall back to server client
  const supabase = context?.supabase || serverSupabase;

  try {
    // Use the client to download the document
    const { data, error } = await supabase.storage
      .from("proposal-documents")
      .download(`${rfpId}/document.pdf`);

    if (error) throw error;

    // Process the document...
  } catch (error) {
    // Handle error...
  }
};
```

## Security Considerations

- No service role keys are used for regular operations
- JWT tokens are validated before processing requests
- RLS policies in Supabase enforce data access boundaries
- Clear error messages without exposing sensitive information
- Token expiration is handled properly with refresh recommendations
- Expired tokens receive special handling with explicit refresh flags
- Comprehensive logging of authentication events with request IDs

## Test Plan

### 1. Authentication Middleware Tests

#### Test Case: Valid Authentication

- **Setup**: Create a mock request with a valid JWT token
- **Action**: Pass the request through the auth middleware
- **Expected Result**:
  - Middleware calls `next()`
  - Request has `req.supabase` and `req.user` properties set
  - Token expiration info attached to request
  - No error response

```javascript
it("should authenticate a request with valid token", async () => {
  // Mock valid JWT token
  const mockReq = {
    headers: {
      authorization: "Bearer valid-token-here",
    },
  };
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const mockNext = jest.fn();

  // Mock Supabase getUser response
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: {
      user: { id: "test-user-id", email: "test@example.com" },
      session: { expires_at: Math.floor(Date.now() / 1000) + 3600 }, // 1 hour in future
    },
    error: null,
  });

  // Call middleware
  await authMiddleware(mockReq, mockRes, mockNext);

  // Expectations
  expect(mockNext).toHaveBeenCalled();
  expect(mockReq.supabase).toBeDefined();
  expect(mockReq.user).toEqual({
    id: "test-user-id",
    email: "test@example.com",
  });
  expect(mockReq.tokenExpiresIn).toBeDefined();
  expect(mockReq.tokenRefreshRecommended).toBeDefined();
  expect(mockRes.status).not.toHaveBeenCalled();
});
```

#### Test Case: Token Nearing Expiration

- **Setup**: Create a mock request with a token close to expiration (< 10 minutes)
- **Action**: Pass the request through the auth middleware
- **Expected Result**:
  - Middleware calls `next()`
  - `req.tokenRefreshRecommended` is `true`
  - Warning is logged

```javascript
it("should flag tokens nearing expiration", async () => {
  // Mock token close to expiration
  const mockReq = {
    headers: {
      authorization: "Bearer near-expiration-token",
    },
  };
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const mockNext = jest.fn();

  // Mock Supabase getUser response with token expiring in 5 minutes
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: {
      user: { id: "test-user-id", email: "test@example.com" },
      session: { expires_at: Math.floor(Date.now() / 1000) + 300 }, // 5 minutes in future
    },
    error: null,
  });

  // Call middleware
  await authMiddleware(mockReq, mockRes, mockNext);

  // Expectations
  expect(mockNext).toHaveBeenCalled();
  expect(mockReq.tokenExpiresIn).toBeLessThanOrEqual(300);
  expect(mockReq.tokenRefreshRecommended).toBe(true);
  expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
    "Token close to expiration",
    expect.any(Object)
  );
});
```

#### Test Case: Expired Token

- **Setup**: Create a mock request with an expired JWT token
- **Action**: Pass the request through the auth middleware
- **Expected Result**:
  - Response status 401
  - Error message about expired token with refresh_required flag
  - `next()` not called

```javascript
it("should handle expired tokens with refresh_required flag", async () => {
  // Mock expired JWT token
  const mockReq = {
    headers: {
      authorization: "Bearer expired-token",
    },
  };
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const mockNext = jest.fn();

  // Mock Supabase getUser response for expired token
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: null,
    error: { message: "JWT token has expired" },
  });

  // Call middleware
  await authMiddleware(mockReq, mockRes, mockNext);

  // Expectations
  expect(mockNext).not.toHaveBeenCalled();
  expect(mockRes.status).toHaveBeenCalledWith(401);
  expect(mockRes.json).toHaveBeenCalledWith(
    expect.objectContaining({
      error: "Token expired",
      refresh_required: true,
    })
  );
});
```

#### Test Case: Invalid Token

- **Setup**: Create a mock request with an invalid JWT token
- **Action**: Pass the request through the auth middleware
- **Expected Result**:
  - Response status 401
  - Error message about invalid token
  - `next()` not called

```javascript
it("should reject a request with invalid token", async () => {
  // Mock invalid JWT token
  const mockReq = {
    headers: {
      authorization: "Bearer invalid-token",
    },
  };
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const mockNext = jest.fn();

  // Mock Supabase getUser response for invalid token
  mockSupabaseAuth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "Invalid JWT" },
  });

  // Call middleware
  await authMiddleware(mockReq, mockRes, mockNext);

  // Expectations
  expect(mockNext).not.toHaveBeenCalled();
  expect(mockRes.status).toHaveBeenCalledWith(401);
  expect(mockRes.json).toHaveBeenCalledWith(
    expect.objectContaining({
      error: "Invalid token",
    })
  );
});
```

#### Test Case: Missing Authorization Header

- **Setup**: Create a mock request with no Authorization header
- **Action**: Pass the request through the auth middleware
- **Expected Result**:
  - Response status 401
  - Error message about missing authentication
  - `next()` not called

```javascript
it("should reject a request with missing Authorization header", async () => {
  // Mock request with no auth header
  const mockReq = { headers: {} };
  const mockRes = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const mockNext = jest.fn();

  // Call middleware
  await authMiddleware(mockReq, mockRes, mockNext);

  // Expectations
  expect(mockNext).not.toHaveBeenCalled();
  expect(mockRes.status).toHaveBeenCalledWith(401);
  expect(mockRes.json).toHaveBeenCalledWith(
    expect.objectContaining({
      error: "Authentication required",
    })
  );
});
```

### 2. Document Loader Node Tests

#### Test Case: Successful Document Loading

- **Setup**: Create a mock state and context with authenticated Supabase client
- **Action**: Call the documentLoaderNode
- **Expected Result**:
  - Function returns document content
  - Supabase storage download method called with correct parameters

```javascript
it("should load a document using the authenticated client", async () => {
  // Mock state
  const mockState = {
    rfpDocument: {
      id: "test-rfp-id",
    },
  };

  // Mock authenticated Supabase client
  const mockSupabaseClient = {
    storage: {
      from: jest.fn().mockReturnValue({
        download: jest.fn().mockResolvedValue({
          data: new Blob(["test document content"]),
          error: null,
        }),
      }),
    },
  };

  // Mock context with the client
  const mockContext = {
    supabase: mockSupabaseClient,
  };

  // Call the function
  const result = await documentLoaderNode(mockState, mockContext);

  // Expectations
  expect(mockSupabaseClient.storage.from).toHaveBeenCalledWith(
    "proposal-documents"
  );
  expect(mockSupabaseClient.storage.from().download).toHaveBeenCalledWith(
    "test-rfp-id/document.pdf"
  );
  expect(result.rfpDocument.status).toBe("loaded");
  expect(result.rfpDocument.text).toBeDefined();
});
```

#### Test Case: Storage Access Denied

- **Setup**: Create mock state and context where download returns a permission error
- **Action**: Call the documentLoaderNode
- **Expected Result**:
  - Function returns error status
  - Error message about permissions/access

```javascript
it("should handle storage access denied errors", async () => {
  // Mock state
  const mockState = {
    rfpDocument: {
      id: "test-rfp-id",
    },
  };

  // Mock authenticated Supabase client with permission error
  const mockSupabaseClient = {
    storage: {
      from: jest.fn().mockReturnValue({
        download: jest.fn().mockResolvedValue({
          data: null,
          error: { message: "Access denied due to RLS policy" },
        }),
      }),
    },
  };

  // Mock context with the client
  const mockContext = {
    supabase: mockSupabaseClient,
  };

  // Call the function
  const result = await documentLoaderNode(mockState, mockContext);

  // Expectations
  expect(result.rfpDocument.status).toBe("error");
  expect(result.rfpDocument.metadata.error).toContain("Access denied");
  expect(result.rfpDocument.metadata.errorType).toBe("authorization");
});
```

### 3. End-to-End Integration Tests

#### Test Case: Authenticated User Accesses Their Document

- **Setup**:
  - Create a document in Supabase storage for a specific user
  - Obtain a valid JWT token for that user
- **Action**:
  - Make a request to the chat endpoint with the JWT token
  - Reference the user's document
- **Expected Result**:
  - Request succeeds
  - Document is loaded
  - Response contains information from the document

#### Test Case: User Attempts to Access Another User's Document

- **Setup**:
  - Create documents for two different users in Supabase storage
  - Obtain a valid JWT token for user A
- **Action**:
  - Make a request using user A's token but referencing user B's document
- **Expected Result**:
  - Request fails with an authorization error
  - RLS policies prevent access
  - Error message explaining access denied

#### Test Case: Token Refresh Flow

- **Setup**:
  - Create a document in Supabase storage
  - Obtain a token close to expiration
- **Action**:
  - Make a request to an endpoint with the token
  - Check for X-Token-Refresh-Recommended header
  - Simulate refresh token flow
  - Make another request with the new token
- **Expected Result**:
  - First request succeeds and includes X-Token-Refresh-Recommended header
  - Token refresh succeeds
  - Second request succeeds with new token

## Future Improvements

1. **Token Refresh Flow**: ✅ Implemented token expiration detection and refresh flags
2. **Rate Limiting**: Add rate limiting to prevent abuse of authenticated endpoints
3. **Enhanced Logging**: ✅ Added structured logging for authentication events with request IDs
4. **2FA Integration**: Add support for two-factor authentication for sensitive operations
5. **Role-Based Access**: Extend authentication to support role-based access control

## Test Plan Organization

Below is a structured plan for testing the backend authentication system in dependency order. Tests are organized into phases, with checkboxes to track completion.

### Phase 1: Auth Middleware Unit Tests

These tests verify the core authentication middleware functionality in isolation.

- [x] **1.1 Valid Authentication**: Test authenticating a request with a valid JWT token

  - `apps/backend/lib/middleware/__tests__/auth.test.js`

- [x] **1.2 Invalid Token**: Test rejecting a request with an invalid JWT token

  - `apps/backend/lib/middleware/__tests__/auth.test.js`

- [x] **1.3 Expired Token**: Test handling of expired JWT tokens

  - `apps/backend/lib/middleware/__tests__/auth.test.js`

- [x] **1.4 Missing Authorization Header**: Test rejection of requests with no Authorization header

  - `apps/backend/lib/middleware/__tests__/auth.test.js`

- [x] **1.5 Malformed Authorization Header**: Test rejection of requests with incorrectly formatted headers

  - `apps/backend/lib/middleware/__tests__/auth.test.js`

- [x] **1.6 Empty Token**: Test handling of empty token values

  - `apps/backend/lib/middleware/__tests__/auth.test.js`

- [x] **1.7 Unexpected Errors**: Test handling of unexpected errors during authentication

  - `apps/backend/lib/middleware/__tests__/auth.test.js`

- [x] **1.8 Missing Supabase Configuration**: Test handling of missing environment variables

  - `apps/backend/lib/middleware/__tests__/auth.test.js`

- [x] **1.9 Token Refresh Handling**: Test middleware detection of expired tokens and 401 responses with refresh flag

  - `apps/backend/lib/middleware/__tests__/auth-refresh.test.js`

- [x] **1.10 Standardized Error Structure**: Test consistent error response structure from auth middleware
  - `apps/backend/lib/middleware/__tests__/auth-errors.test.js`

### Phase 2: Document Loader Authentication Tests

These tests verify that the document loader node correctly uses authenticated clients.

- [x] **2.1 Use Authenticated Client**: Test that the loader uses the authenticated client from context when available

  - `apps/backend/agents/proposal-generation/nodes/__tests__/document-loader-auth.test.ts`

- [x] **2.2 Server Client Fallback**: Test fallback to server client when authenticated client is unavailable

  - `apps/backend/agents/proposal-generation/nodes/__tests__/document-loader-auth.test.ts`

- [x] **2.3 Authorization Errors**: Test proper handling of authorization errors from the authenticated client

  - `apps/backend/agents/proposal-generation/nodes/__tests__/document-loader-auth.test.ts`

- [x] **2.4 Client Metadata**: Test that the authenticated client type is properly recorded in document metadata

  - `apps/backend/agents/proposal-generation/nodes/__tests__/document-loader-auth.test.ts`

- [x] **2.5 Timeout Handling**: Test handling of timeouts during document loading operations
  - `apps/backend/agents/proposal-generation/nodes/__tests__/document-loader-timeout.test.ts`

### Phase 3: Integration Tests

These tests verify that the entire authentication flow works properly across components.

- [x] **3.1 Auth Client Propagation**: Test passing the authenticated Supabase client through API and orchestrator

  - `apps/backend/__tests__/integration/auth-document-flow.test.js`

- [x] **3.2 Reject Unauthenticated Requests**: Test that the API rejects requests without authentication

  - `apps/backend/__tests__/integration/auth-document-flow.test.js`

- [x] **3.3 Reject Invalid Auth**: Test that the API rejects requests with invalid authentication

  - `apps/backend/__tests__/integration/auth-document-flow.test.js`

- [ ] **3.4 Error Type Handling**: Test that different error types (auth, validation, server) are properly categorized

  - `apps/backend/__tests__/integration/error-handling.test.js`

- [ ] **3.5 Request Timeout Integration**: Test that request timeouts are properly handled across the entire flow
  - `apps/backend/__tests__/integration/request-timeout.test.js`

### Phase 4: End-to-End User Scenarios

These tests should be implemented to test complete user workflows.

- [ ] **4.1 Authenticated User Accesses Their Document**: Test successful document access by authorized user

  - _Test to be implemented_

- [ ] **4.2 User Attempts to Access Another User's Document**: Test RLS policies prevent unauthorized access

  - _Test to be implemented_

- [ ] **4.3 Session Expiration Handling**: Test proper handling of expired sessions

  - _Test to be implemented_

- [ ] **4.4 Token Refresh Flow**: Test end-to-end token refresh process when a token expires
  - _Test to be implemented_

### Phase 5: Frontend Authentication Tests

These tests focus on the frontend-specific authentication components.

- [ ] **5.1 Token Refresh Interceptor**: Test proactive token refresh before expiration

  - `apps/frontend/__tests__/lib/auth/refresh-interceptor.test.ts`

- [ ] **5.2 Failed Request Retry**: Test automatic retry of failed requests after token refresh

  - `apps/frontend/__tests__/lib/auth/refresh-interceptor.test.ts`

- [ ] **5.3 Concurrent Request Handling**: Test proper handling of multiple concurrent requests during refresh

  - `apps/frontend/__tests__/lib/auth/refresh-interceptor.test.ts`

- [ ] **5.4 Max Retry Protection**: Test protection against infinite retry loops
  - `apps/frontend/__tests__/lib/auth/refresh-interceptor.test.ts`

### Phase 6: Rate Limiting Tests

These tests verify rate limiting functionality for authentication endpoints.

- [ ] **6.1 IP-Based Rate Limiting**: Test that requests are limited by IP address

  - `apps/backend/__tests__/middleware/rate-limit.test.js`

- [ ] **6.2 User-Based Rate Limiting**: Test that requests are limited by user ID after authentication

  - `apps/backend/__tests__/middleware/rate-limit.test.js`

- [ ] **6.3 Retry-After Headers**: Test that appropriate retry-after headers are included in rate limit responses

  - `apps/backend/__tests__/middleware/rate-limit.test.js`

- [ ] **6.4 Rate Limit Logging**: Test that excessive authentication attempts are properly logged

  - `apps/backend/__tests__/middleware/rate-limit.test.js`

- [ ] **6.5 Different Endpoint Configurations**: Test that different endpoints can have different rate limit configurations
  - `apps/backend/__tests__/middleware/rate-limit.test.js`

### Phase 7: NextJS API Route Authentication Tests

These tests verify the NextJS-specific authentication helpers.

- [ ] **7.1 withAuth Higher-Order Function**: Test that the HOF properly wraps API handlers with authentication

  - `apps/frontend/__tests__/lib/api/with-auth.test.ts`

- [ ] **7.2 TypeScript Type Safety**: Test that the withAuth HOF maintains proper typing for req/res objects

  - `apps/frontend/__tests__/lib/api/with-auth.test.ts`

- [ ] **7.3 Error Handling**: Test that authentication errors are handled consistently in wrapped API routes

  - `apps/frontend/__tests__/lib/api/with-auth.test.ts`

- [ ] **7.4 Configuration Options**: Test that the HOF accepts configuration options for different auth requirements

  - `apps/frontend/__tests__/lib/api/with-auth.test.ts`

- [ ] **7.5 Role-Based Authentication**: Test that the HOF supports role-based access control
  - `apps/frontend/__tests__/lib/api/with-auth.test.ts`

## Implementation Tasks

Based on the test plan, here are the key implementation tasks:

### Backend Authentication Enhancements

1. **Token Refresh Handling**

   - [x] Extend auth middleware to detect expired tokens and return standardized 401 responses with refresh flag
   - [x] Add token expiration calculation for valid tokens
   - [x] Implement token validation and lifetime management
   - [x] Add `tokenExpiresIn` and `tokenRefreshRecommended` properties to request object
   - [x] Create comprehensive documentation in README.md

2. **Standardized Error Handling**

   - [x] Create consistent error response structure for authentication failures
   - [x] Implement proper logging for different authentication scenarios
   - [x] Add error sanitization to prevent exposure of sensitive information
   - [ ] Create centralized error handling middleware

3. **Rate Limiting**

   - [ ] Implement IP-based rate limiting for authentication endpoints
   - [ ] Add user-based rate limiting after authentication
   - [ ] Configure retry-after headers for rate limit responses
   - [ ] Set up logging for excessive authentication attempts
   - [ ] Create configurable rate limit rules for different endpoints

4. **Request Timeouts**
   - [ ] Configure reasonable timeouts for authenticated API calls
   - [ ] Implement timeout detection and handling
   - [ ] Add timeout status to error responses
   - [ ] Create retry strategies for timeout scenarios

### Frontend Authentication Enhancements

1. **Token Refresh Interceptor**

   - [ ] Create HTTP client interceptor to detect and handle expired tokens
   - [ ] Implement proactive token refresh before expiration
   - [ ] Build request queue for retrying failed requests after refresh
   - [ ] Add protection against infinite retry loops

2. **NextJS Authentication HOF**
   - [ ] Create withAuth higher-order function to wrap API route handlers
   - [ ] Implement proper TypeScript typing for req/res objects
   - [ ] Add support for role-based access control
   - [ ] Create configuration options for different auth requirements
   - [ ] Ensure consistent error handling across all API routes
