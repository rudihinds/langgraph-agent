# Backend Middleware

This directory contains Express.js middleware used throughout the backend application.

## Authentication Middleware

The authentication middleware provides JWT token validation, handling of token expiration, and token refresh functionality for securing API routes in the backend application.

## Overview

The authentication middleware is responsible for ensuring that requests to protected API endpoints have valid authentication tokens. It intercepts requests, validates the JWT token from the `Authorization` header, and attaches user information to the request object for use by downstream route handlers.

## Features

- **JWT Token Validation**: Verifies tokens using Supabase Auth
- **Automatic Token Expiration Detection**: Identifies and handles expired tokens
- **Proactive Token Refresh**: Calculates token lifetime and flags tokens nearing expiration
- **Resilient Edge Case Handling**: Gracefully handles missing session data or expiration timestamps
- **Standardized Error Handling**: Provides consistent error responses for authentication failures
- **Authenticated Supabase Client**: Attaches an authenticated Supabase client to the request

## Usage

### Basic Usage

Apply the middleware to routes that require authentication:

```javascript
import express from "express";
import { authMiddleware } from "../lib/middleware/auth.js";

const router = express.Router();

// Apply to all routes in a router
router.use(authMiddleware);

// Or apply to specific routes
router.get("/protected-resource", authMiddleware, (req, res) => {
  // Access authenticated user
  const user = req.user;
  res.json({ data: "Protected data", user });
});

export default router;
```

### Request Flow

1. Client sends a request with an `Authorization: Bearer <token>` header
2. Middleware extracts and validates the token
3. For valid tokens:
   - User data is attached to `req.user`
   - Authenticated Supabase client is attached to `req.supabase`
   - Token expiration data is calculated and attached to the request
   - Response header is set when refresh is recommended
4. For invalid or expired tokens:
   - Request is rejected with a 401 status code
   - Appropriate error messages are returned

## Token Refresh Handling

### For Valid Tokens

The middleware calculates the time remaining until token expiration and attaches the following properties to the request object:

- `req.tokenExpiresIn`: Number of seconds until the token expires
- `req.tokenRefreshRecommended`: Boolean flag indicating if the token is close to expiration (within 10 minutes)

For tokens that are close to expiration, the middleware will also automatically add a header to the response:

```
X-Token-Refresh-Recommended: true
```

Route handlers can still add additional response headers if needed:

```javascript
app.get("/api/data", authMiddleware, (req, res) => {
  // The middleware already sets the X-Token-Refresh-Recommended header
  // when req.tokenRefreshRecommended is true

  // Additional custom headers can be added
  if (req.tokenExpiresIn < 300) {
    // Less than 5 minutes
    res.set("X-Token-Critical", "true");
  }

  // Proceed with normal request handling
  res.json({ data: "Your data" });
});
```

### Edge Case Handling

The middleware gracefully handles several edge cases:

1. **Missing Session Data**: If the token validation returns a user but no session data, the middleware:

   - Still attaches the user data to the request
   - Logs a warning about the missing session data
   - Does not calculate or attach token expiration data to the request
   - Does not set any refresh recommendation headers

2. **Missing Expiration Timestamp**: If the session data exists but has no expiration timestamp, the middleware:
   - Still attaches the user data to the request
   - Logs a warning about the missing expiration data
   - Does not calculate or attach token expiration data to the request
   - Does not set any refresh recommendation headers

This resilience ensures the middleware doesn't break the request flow when dealing with non-standard token responses.

### For Expired Tokens

When tokens are expired, the middleware returns a 401 response with a special flag:

```json
{
  "error": "Token expired",
  "message": "Token has expired",
  "refresh_required": true
}
```

### Client-Side Implementation

To handle token refresh on the client side:

1. Detect expired tokens by checking for 401 responses with `refresh_required: true`
2. Proactively refresh tokens when receiving responses with the `X-Token-Refresh-Recommended` header
3. Implement a refresh token flow using Supabase Auth's refresh token methods
4. Retry the original request with the new token

Example client-side implementation:

```javascript
async function fetchWithAuth(url, options = {}) {
  try {
    // Add auth token to request
    const token = getAuthToken(); // Your function to get the stored token
    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    };

    const response = await fetch(url, authOptions);

    // Check if token refresh is recommended
    if (response.headers.get("X-Token-Refresh-Recommended")) {
      // Trigger a token refresh in the background
      refreshAuthToken().catch(console.error);
    }

    return response;
  } catch (error) {
    // Handle fetch errors
    console.error("Fetch error:", error);
    throw error;
  }
}

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
```

## Configuration

The middleware uses the following environment variables:

- `SUPABASE_URL`: The URL of your Supabase project
- `SUPABASE_ANON_KEY`: The anon/public key for your Supabase project

These must be set in your environment for the middleware to function properly.

### Constants

The middleware defines a refresh threshold that determines when a token is considered close to expiration:

```javascript
const TOKEN_REFRESH_RECOMMENDATION_THRESHOLD_SECONDS = 600; // 10 minutes
```

This is the window before token expiration when:

- `req.tokenRefreshRecommended` will be set to `true`
- The `X-Token-Refresh-Recommended` header will be automatically added to the response

### Helper Functions

The middleware uses several helper functions to improve code organization and maintainability:

```javascript
// Creates standardized error response objects
function createErrorResponse(status, errorType, message, additionalData = {}) {...}

// Validates required Supabase environment variables
function validateSupabaseConfig(logger, requestId) {...}

// Extracts and validates bearer token from authorization header
function extractBearerToken(req, logger, requestId) {...}

// Calculates token expiration time and sets appropriate request properties
function processTokenExpiration(req, res, session, logger, requestId, userId) {...}

// Handles authentication errors with appropriate responses
function handleAuthenticationError(res, error, logger, requestId) {...}
```

These functions help ensure consistent error handling, response formatting, and logging throughout the authentication process.

## Error Responses

| Scenario                             | Status | Response                                                                                              |
| ------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| Missing/Invalid Authorization header | 401    | `{ "error": "Authentication required", "message": "Authorization header missing or invalid format" }` |
| Empty token                          | 401    | `{ "error": "Invalid token", "message": "Authentication token cannot be empty" }`                     |
| Expired token                        | 401    | `{ "error": "Token expired", "message": "Token has expired", "refresh_required": true }`              |
| Invalid token                        | 401    | `{ "error": "Invalid token", "message": "<error message from Supabase>" }`                            |
| Server configuration error           | 500    | `{ "error": "Server configuration error", "message": "Server configuration error" }`                  |
| Unexpected error                     | 500    | `{ "error": "Authentication error", "message": "Internal server error during authentication" }`       |

## Logging

The middleware logs authentication events and errors using the application logger:

- **Info level**: Successful authentication with user ID and token expiration time
- **Warning level**:
  - Tokens close to expiration
  - Missing/invalid authorization headers
  - Authentication errors and expired tokens
  - Missing session data or expiration timestamps
- **Error level**: Configuration or unexpected errors

Each log entry includes the request ID (from `x-request-id` header) for request tracing.

## Testing

The middleware has comprehensive tests in:

- `lib/middleware/__tests__/auth.test.js`: Unit tests covering:
  - Valid token validation
  - Token expiration detection
  - Refresh recommendation handling
  - Edge cases (missing session data, missing expiration time)

To run the tests:

```bash
npx vitest run lib/middleware/__tests__/auth.test.js
```

## Integration with Other Components

The authentication middleware integrates with:

- **Supabase Auth**: For token validation and user data retrieval
- **Logging System**: For logging authentication events and errors
- **Route Handlers**: Provides user data and Supabase client to route handlers
- **Error Handlers**: Standardized error responses for failed authentication
- **Document Loading**: Authenticated client is used for secure storage access

## Security Considerations

- The middleware never logs the full token, only metadata about token validity and expiration
- Invalid tokens are immediately rejected with a 401 status
- Environment variables for Supabase credentials should be properly secured
- Token refresh should be implemented securely on the client to avoid exposing refresh tokens
- Automatically sets refresh headers without requiring route handler implementation
- Includes detailed error messages for debugging while maintaining security

## Future Improvements

- Add rate limiting for token validation attempts
- Implement token blacklisting for revoked tokens
- Add support for custom authorization schemes beyond Bearer tokens
- Enhance logging with more context for security auditing
