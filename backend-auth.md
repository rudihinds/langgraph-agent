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

The middleware intercepts incoming requests, validates auth tokens, and attaches authenticated Supabase clients to the request object. Key functionality includes:

- Token extraction from Authorization header
- Validation using Supabase Auth
- Token expiration detection and handling
- Attaching user data and Supabase client to request
- Standardized error responses

### 2. Token Expiration Processing

The middleware includes a dedicated function that:

- Calculates time remaining until token expiration
- Flags tokens that are close to expiring (within 10 minutes)
- Attaches expiration metadata to the request object:
  - `req.tokenExpiresIn`: Seconds until token expires
  - `req.tokenRefreshRecommended`: Boolean flag for tokens nearing expiration
- Provides appropriate logging based on token status

### 3. Frontend Token Passing

The frontend retrieves the session token from Supabase Auth and includes it in API requests to the backend, setting the Authorization header with the Bearer token.

### 4. Token Refresh Handling in Frontend

The frontend client handles token refresh based on response status or headers by:

- Detecting 401 responses with the `refresh_required` flag
- Initiating token refresh through Supabase Auth
- Retrying the original request with the new token
- Setting up proactive refresh for tokens flagged as nearing expiration

### 5. Protected Routes

All sensitive routes are protected by the authentication middleware, which is applied at the router level to ensure consistent authentication across endpoints.

### 6. Route Handlers with Token Refresh Awareness

Route handlers use the token expiration information attached to the request to notify clients when tokens are nearing expiration through the `X-Token-Refresh-Recommended` header.

### 7. Authenticated Storage Access

Storage operations use the authenticated client passed through the request context to respect RLS policies, ensuring users can only access their own resources.

## Security Considerations

- No service role keys are used for regular operations
- JWT tokens are validated before processing requests
- RLS policies in Supabase enforce data access boundaries
- Clear error messages without exposing sensitive information
- Token expiration is handled properly with refresh recommendations
- Expired tokens receive special handling with explicit refresh flags
- Comprehensive logging of authentication events with request IDs

## Test Plan

The test suite for the authentication system is organized into phases, with coverage for:

### Phase 1: Auth Middleware Unit Tests

- Valid/invalid/expired token scenarios
- Missing authorization headers
- Token refresh handling
- Standardized error structures

### Phase 2: Document Loader Authentication Tests

- Authenticated client usage for storage operations
- Authorization error handling
- Client type metadata verification

### Phase 3: Integration Tests

- Authentication client propagation through API layers
- Rejection of unauthenticated/invalid requests
- Error type categorization

### Phase 4: End-to-End User Scenarios

- Authenticated resource access
- Unauthorized access prevention
- Session expiration handling
- Token refresh flows

### Phase 5-7: Frontend Auth, Rate Limiting, and API Route Tests

- Frontend token interceptors and refresh logic
- Rate limiting implementation
- NextJS API route authentication helpers

## Implementation Status

### Completed

- ✅ Token Refresh Handling

  - Extended auth middleware to detect expired tokens and return standardized 401 responses with refresh flag
  - Added token expiration calculation for valid tokens
  - Implemented token validation and lifetime management
  - Added `tokenExpiresIn` and `tokenRefreshRecommended` properties to request object
  - Created comprehensive documentation in README.md

- ✅ Standardized Error Handling

  - Created consistent error response structure for authentication failures
  - Implemented proper logging for different authentication scenarios
  - Added error sanitization to prevent exposure of sensitive information

- ✅ Rate Limiting implementation

  - Created IP-based rate limiting middleware for API protection
  - Implemented configurable time window and request limits
  - Added automatic cleanup to prevent memory leaks
  - Created clear error responses for rate-limited requests
  - Documented improvement roadmap in TASK.md

- ✅ Request Timeout handling

  - Implemented timeout middleware for long-running operations
  - Added configurable timeout thresholds for different request types
  - Created graceful termination of stalled requests
  - Implemented clear error responses for timed-out operations
  - Added detailed logging for request timeouts

- ✅ Route Handler Token Refresh Awareness

  - Implemented token refresh header functionality in API routes
  - Added `X-Token-Refresh-Recommended` header when tokens are nearing expiration
  - Created TypeScript interfaces for authenticated requests
  - Added detailed logging for token refresh recommendations
  - Implemented complete end-to-end testing covering various scenarios
  - Used Test-Driven Development approach for clean implementation

- ✅ Document Loader Authentication
  - Implemented authentication-aware document loading in `documentLoaderNode`
  - Created client type tracking for distinguishing between authenticated and server access
  - Added proper error handling with client-specific context
  - Implemented clear error classification (authorization vs. not found vs. parsing errors)
  - Added timestamp and metadata tracking for document operations
  - Created comprehensive test suite for authenticated document access
  - All document loader authentication tests passing with high coverage

### Pending

- Frontend Token Refresh Interceptor
- NextJS Authentication Higher-Order Functions

## Document Loader Authentication Best Practices

The document loader implementation provides a secure pattern for authenticated document access:

### Authentication Pattern

1. **Context-Based Authentication**

   - The document loader accepts an optional `context` parameter with authenticated client
   - Falls back to server client only when authenticated client is unavailable
   - Tracks which client type was used in the response metadata

2. **Error Classification**

   - Distinguishes between authentication/authorization errors and other failures
   - Uses error status codes (403) to identify permission issues
   - Provides clear error types to inform client response strategies

3. **Metadata Tracking**
   - Records which client was used for each operation
   - Timestamps all operations for audit trails
   - Includes user context when available

### Security Considerations

- Always prefer authenticated client over server client
- Perform proper error classification to avoid exposing sensitive information
- Track and log all document access including client type
- Include appropriate RLS policies in Supabase for document buckets
- Validate document ownership before allowing access

### Future Security Enhancements

- Implement document size validation to prevent DoS attacks
- Add path sanitization for document IDs to prevent path traversal
- Implement streaming for large documents to prevent memory issues
- Consider implementing document access auditing
- Add document versioning and change tracking for sensitive RFPs

## Future Improvements

1. **Role-Based Access**: Extend authentication to support role-based access control
2. **2FA Integration**: Add support for two-factor authentication for sensitive operations
3. **Enhanced Monitoring**: Implement comprehensive monitoring and alerting for authentication patterns
