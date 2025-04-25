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
4. For invalid or expired tokens:
   - Request is rejected with a 401 status code
   - Appropriate error messages are returned

## Token Refresh Handling

### For Valid Tokens

The middleware calculates the time remaining until token expiration and attaches the following properties to the request object:

- `req.tokenExpiresIn`: Number of seconds until the token expires
- `req.tokenRefreshRecommended`: Boolean flag indicating if the token is close to expiration (within 10 minutes)

Route handlers can use these properties to notify clients that a token refresh is recommended:

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
const TOKEN_REFRESH_THRESHOLD_SECONDS = 600; // 10 minutes
```

This is the window before token expiration when `req.tokenRefreshRecommended` will be set to `true`.

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
- **Error level**: Configuration or unexpected errors

Each log entry includes the request ID (from `x-request-id` header) for request tracing.

## Testing

The middleware has comprehensive tests in:

- `lib/middleware/__tests__/auth.test.js`: Unit tests for general functionality
- `lib/middleware/__tests__/auth-refresh.test.js`: Tests specific to token refresh functionality
- `__tests__/integration/auth-document-flow.test.js`: Integration tests with the rest of the application

To run the tests:

```bash
npx vitest run lib/middleware/__tests__/auth.test.js lib/middleware/__tests__/auth-refresh.test.js __tests__/integration/auth-document-flow.test.js
```

## Integration with Other Components

The authentication middleware integrates with:

- **Supabase Auth**: For token validation and user data retrieval
- **Logging System**: For logging authentication events and errors
- **Route Handlers**: Provides user data and Supabase client to route handlers
- **Error Handlers**: Standardized error responses for failed authentication

## Security Considerations

- The middleware never logs the full token, only metadata about token validity and expiration
- Invalid tokens are immediately rejected with a 401 status
- Environment variables for Supabase credentials should be properly secured
- Token refresh should be implemented securely on the client to avoid exposing refresh tokens
