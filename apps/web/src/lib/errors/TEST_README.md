// needs updating after refactor on 27/4/25

# Error Handling Test Documentation

This document explains the testing strategy for the error handling system in our application.

## Test Structure

The tests are organized to mirror the codebase structure:

```
apps/web/
├── src/
│   ├── lib/
│   │   ├── errors/
│   │   │   ├── __tests__/
│   │   │   │   ├── error-handling.test.ts  # Core error utilities
│   │   │   │   └── test-helpers.ts         # Test helpers
│   │   ├── api/
│   │   │   ├── __tests__/
│   │   │   │   └── route-handler.test.ts   # API route handler
│   │   ├── supabase/
│   │   │   ├── __tests__/
│   │   │   │   └── errors.test.ts          # Supabase error handling
│   ├── components/
│   │   ├── __tests__/
│   │   │   └── error-boundary.test.tsx     # Error boundary component
│   ├── hooks/
│   │   ├── __tests__/
│   │   │   └── use-api.test.tsx            # useApi hook
```

## Running Tests

The following npm scripts are available for running tests:

```bash
# Run all tests
npm test

# Run all unit tests
npm run test:unit

# Run specific test groups
npm run test:errors      # Core error handling tests
npm run test:api         # API route handler tests
npm run test:supabase    # Supabase error handling tests
npm run test:components  # Component tests (including ErrorBoundary)
npm run test:hooks       # Hook tests (including useApi)

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (for development)
npm run test:watch
```

## Test Coverage

Our tests cover the following aspects of the error handling system:

### 1. Core Error Utilities
- `createErrorResponse` and `createSuccessResponse` functions
- Error class inheritance and properties
- Error code constants
- Error handling middleware

### 2. Route Handler
- Successful request handling
- Error propagation and formatting
- Different error types and status codes
- Request context logging

### 3. Supabase Error Handling
- Database error conversion to application errors
- Authentication error handling
- Specific error code mappings

### 4. Error Boundary Component
- Error catching and display
- Recovery mechanism
- Custom fallback UI
- Error logging

### 5. API Hook
- Loading state management
- Error handling and formatting
- Success callback execution
- Request configuration

## Adding New Tests

When adding new error handling features, follow these guidelines for testing:

1. Create tests for both success and failure scenarios
2. Test error propagation across component boundaries
3. Verify error messages and status codes
4. Test with both expected and unexpected error types
5. Ensure error logging works correctly

## Mocking Strategy

The tests use the following mocking approach:

- API responses are mocked using Jest's `mockResolvedValue`
- Error objects are created directly in tests
- The logger is mocked to prevent console output and verify logging calls
- React components use Testing Library for rendering and interaction