# API Client Module

This module contains utilities for making API requests from the frontend to the backend services.

## Authentication Interceptor

The `auth-interceptor.ts` file provides a secure token refresh mechanism that wraps the standard `fetch` API. This interceptor implements several security features:

- **Request Coalescing:** Prevents duplicate refresh requests when multiple API calls fail with auth errors
- **Circuit Breaker:** Prevents infinite refresh loops by limiting consecutive failed refresh attempts
- **Secure Token Handling:** Ensures tokens are never exposed in logs or error messages

### Basic Usage

```typescript
import { createAuthInterceptor } from "@/lib/api/auth-interceptor";

// Create the interceptor once in your application
const authInterceptor = createAuthInterceptor();

// Use it instead of fetch for all API calls
const response = await authInterceptor.fetch("/api/protected-resource", {
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${currentToken}`,
  },
});
```

The interceptor will automatically handle:

1. Refreshing expired tokens when API calls return 401 responses
2. Proactively refreshing tokens when servers suggest refresh via the `X-Token-Refresh-Recommended` header
3. Retrying failed requests with the new token
4. Sanitizing error messages to prevent token exposure

### How It Works

1. **Request Interception**: The interceptor wraps the standard `fetch` API
2. **Response Analysis**: Examines responses for authentication-related status codes and headers
3. **Token Refresh Logic**:
   - On 401 responses with `refresh_required` flag: Refreshes token and retries the request
   - On responses with `X-Token-Refresh-Recommended` header: Refreshes token in the background
4. **Error Handling**: Provides descriptive errors when token refresh fails

### Authentication Flow

```
┌─────────────┐     ┌────────────────┐     ┌────────────┐     ┌────────────────┐
│ Application │     │ Auth Interceptor│     │ API Server │     │ Supabase Auth  │
└──────┬──────┘     └────────┬───────┘     └─────┬──────┘     └────────┬───────┘
       │                     │                    │                     │
       │ API Request         │                    │                     │
       │ with Token          │                    │                     │
       │────────────────────>│                    │                     │
       │                     │                    │                     │
       │                     │ Forward Request    │                     │
       │                     │───────────────────>│                     │
       │                     │                    │                     │
       │                     │                    │ 401 Unauthorized    │
       │                     │                    │ refresh_required    │
       │                     │<───────────────────│                     │
       │                     │                    │                     │
       │                     │ Refresh Token      │                     │
       │                     │───────────────────────────────────────>  │
       │                     │                    │                     │
       │                     │ New Token          │                     │
       │                     │<───────────────────────────────────────  │
       │                     │                    │                     │
       │                     │ Retry Request with │                     │
       │                     │ New Token          │                     │
       │                     │───────────────────>│                     │
       │                     │                    │                     │
       │                     │ 200 OK Response    │                     │
       │                     │<───────────────────│                     │
       │ API Response        │                    │                     │
       │<────────────────────│                    │                     │
       │                     │                    │                     │
```

### Error Handling

The interceptor handles the following error scenarios:

1. **Token Refresh Failure**: When Supabase cannot refresh the token
2. **Network Errors**: When requests fail due to network issues
3. **Response Parsing Errors**: When responses cannot be parsed correctly
4. **Maximum Refresh Attempts Exceeded**: When the circuit breaker is triggered

In all cases, specific error messages help identify the root cause of authentication problems, while ensuring tokens are never exposed in logs or error messages.

### Implementation Notes

- Uses Supabase's authentication system for token management
- Works with both browser and server-side environments
- Handles different types of response headers (Headers object, plain object, none)
- Preserves all original request parameters when retrying
- Implements secure token redaction to prevent token exposure in logs and errors

### Limitations

- Currently optimized for use with Supabase authentication
- Requires that backend follows the defined token refresh protocol
- Requires proper environment configuration for Supabase URL and anon key

### Documentation

For more detailed information on how to use the authentication interceptor, including implementation details, configuration options, and testing patterns, please refer to:

- [Token Refresh Guide](./docs/token-refresh-guide.md): Comprehensive documentation on token refresh flow and patterns
- [Backend Authentication Documentation](../../docs/backend-auth.md): Details on how token refresh works on the backend

### Environment Variables

The auth interceptor requires the following environment variables to be set:

- `NEXT_PUBLIC_SUPABASE_URL`: The URL of your Supabase project
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: The public/anonymous API key for your Supabase project

Make sure these variables are properly configured in your `.env` file.

## Contents

- [Authentication Interceptor](#authentication-interceptor)
- [API Clients](#api-clients)
- [Route Handlers](#route-handlers)

## API Clients

The API client modules provide typed interfaces for interacting with specific backend services:

- `proposals.ts`: Client for proposal-related API endpoints
- `proposal-repository.ts`: Repository pattern implementation for proposal data

## Route Handlers

The route handler utilities help simplify the creation of API route handlers:

- `route-handler.ts`: Utilities for creating standardized API route handlers with error handling
