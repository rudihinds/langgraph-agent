# Error Handling Guidelines

This document outlines the standardized error handling patterns used in the application.

## Core Principles

1. **Consistency**: All errors follow a standard format
2. **Informative**: Error messages are clear and actionable
3. **Secure**: Error details are sanitized for client use
4. **Traceable**: Errors are properly logged for debugging

## Standard Error Response Format

All API responses follow this format:

```json
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "details": { ... } // Optional additional context
  }
}
```

## Error Types

The application uses these standard error types:

- `AuthenticationError`: For authentication and session issues
- `ValidationError`: For invalid input or request validation failures
- `DatabaseError`: For database operation failures
- `NotFoundError`: For requested resources that don't exist
- `ForbiddenError`: For permission and authorization issues

## Client-Side Error Handling

Use the `useApi` hook for consistent API calls:

```tsx
const { data, error, isLoading, execute } = useApi('/api/some-endpoint');

// When ready to make the call:
const result = await execute(payload);
if (result.success) {
  // Handle success
} else {
  // Handle error
}
```

## Server-Side Error Handling

Use the error utilities in API routes:

```tsx
import { createRouteHandler } from "@/lib/api/route-handler";
import { createSuccessResponse } from "@/lib/errors";
import { ValidationError } from "@/lib/errors/custom-errors";

export const POST = createRouteHandler(async (req: Request) => {
  const data = await req.json();
  
  if (!isValid(data)) {
    throw new ValidationError("Invalid data format");
  }
  
  // Process request...
  
  return createSuccessResponse({ result: "success" });
});
```

## Error Boundaries

Wrap complex components with ErrorBoundary:

```tsx
<ErrorBoundary>
  <ComplexComponent />
</ErrorBoundary>
```

## Supabase Error Handling

Use the specialized utilities for Supabase operations:

```ts
import { handleSupabaseError } from "@/lib/supabase/errors";

const result = await supabase.from('users').select('*');
const users = handleSupabaseError(result, 'get users list');
```

## Logging Best Practices

Use the logger utility for consistent logging:

```ts
import { logger } from "@/lib/logger";

// Informational logs
logger.info("Processing request", { requestId });

// Warning logs
logger.warn("Rate limit approaching", { userIp, requestsCount });

// Error logs
try {
  // Some operation
} catch (error) {
  logger.error("Failed to process request", { requestId }, error);
}
```