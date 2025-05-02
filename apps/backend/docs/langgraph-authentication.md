# Backend Authentication with LangGraph

## Overview

This document explains how Supabase JWT authentication is integrated with the LangGraph backend, enabling user-specific contexts, thread isolation, and secure API access.

## Architecture

The authentication flow follows these key steps:

1. Frontend sends requests to LangGraph with Supabase JWT token in Authorization header
2. Backend validates the token using Supabase JWT verification
3. User context is extracted and attached to the LangGraph request
4. LangGraph uses this context to filter threads and manage user-specific state
5. Responses include token refresh recommendations when needed

## Key Components

### Custom Authentication Handler

The `langraph-auth.ts` module in `apps/backend/lib/middleware/langraph-auth.ts` implements a custom authentication handler for LangGraph:

```typescript
export const createLangGraphAuth = () => {
  return new Auth()
    .authenticate(async (request: Request) => {
      try {
        // Extract and validate token
        const authorization = request.headers.get("authorization");
        const token = extractBearerToken(authorization || "");

        if (!token) {
          throw new HTTPException(401, { message: "Missing token" });
        }

        const validationResult = await validateToken(token);

        if (!validationResult.valid) {
          throw new HTTPException(401, { message: validationResult.error });
        }

        // User context will be available in graph nodes
        return {
          userId: validationResult.user?.id,
          email: validationResult.user?.email,
          metadata: validationResult.user?.metadata,
        };
      } catch (error) {
        // Error handling
      }
    })
    .threads((user) => {
      // Thread filtering logic based on user context
      return {
        userId: user.userId,
      };
    });
};
```

### Token Validation Utility

The `auth-utils.ts` module in `apps/backend/lib/supabase/auth-utils.ts` provides utilities for validating Supabase JWT tokens:

```typescript
export async function validateToken(
  token: string
): Promise<TokenValidationResult> {
  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return {
        valid: false,
        error: error?.message || "Invalid token",
      };
    }

    // Add token refresh recommendation if token is close to expiring
    const shouldRefresh = checkTokenShouldRefresh(token);

    return {
      valid: true,
      user: {
        id: data.user.id,
        email: data.user.email || "",
        metadata: data.user.user_metadata,
      },
      refreshRecommended: shouldRefresh,
    };
  } catch (error) {
    // Error handling
  }
}
```

### Custom LangGraph Server

The `langgraph-server.ts` module in `apps/backend/lib/supabase/langgraph-server.ts` creates a properly configured LangGraph server with authentication:

```typescript
export function authenticatedLangGraphServer(options?: {
  port?: number;
  host?: string;
  verbose?: boolean;
}) {
  const port = options?.port || 2024;
  const host = options?.host || "localhost";
  const verbose = options?.verbose || false;

  // Use require for compatibility
  const { LangGraphServer } = require("@langchain/langgraph-sdk/server");

  // Create server with auth handler
  const server = new LangGraphServer({
    port,
    host,
    verbose,
    auth: langGraphAuth(),
  });

  logger.info(`Initialized authenticated LangGraph server on ${host}:${port}`);

  return server;
}
```

## Implementation Details

### User Context in Graph Nodes

LangGraph nodes can access the authenticated user context:

```typescript
export async function userSpecificNode(state: State, context: any) {
  const { userId, email } = context.user;

  // Use user context to customize responses or access user-specific resources
  const userData = await getUserData(userId);

  return {
    ...state,
    userData,
  };
}
```

### Thread Isolation

The authentication handler ensures threads are isolated by user:

```typescript
.threads((user) => {
  // Only allow access to threads created by this user
  return {
    userId: user.userId
  };
})
```

### Token Refresh Recommendations

The backend adds headers to recommend token refresh when needed:

```typescript
if (validationResult.refreshRecommended) {
  response.headers.set("X-Token-Refresh-Recommended", "true");
}
```

## Running with Authentication

To start the LangGraph server with authentication:

```bash
npm run dev:agents:auth
```

Or programmatically:

```typescript
import { authenticatedLangGraphServer } from "./lib/supabase/langgraph-server.js";
import { registerAgentGraphs } from "./register-agent-graphs.js";

const server = authenticatedLangGraphServer({
  port: 2024,
  verbose: true,
});

// Register your graphs
await registerAgentGraphs(server, {
  "proposal-generator": "./agents/proposal-generation/index.js",
});

// Start the server
await server.start();
```

## Environment Configuration

Required environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Security Considerations

- Always validate tokens on every request
- Use HTTPS for all API communications
- Check for token expiration and tampering
- Set appropriate CORS policy
- Implement rate limiting
- Log authentication failures for monitoring

## Debugging Authentication

Debug-level logging is available for authentication issues:

```
DEBUG=true npm run dev:agents:auth
```

Common authentication issues and solutions:

1. **Invalid Token Format**: Check that frontend is sending token with correct Bearer prefix
2. **Expired Token**: Implement and test token refresh mechanism
3. **Invalid Signature**: Verify Supabase URL and keys are correct
4. **Missing User ID**: Ensure user context is properly extracted during validation

## Testing Authentication

To test authenticated endpoints:

1. Obtain a valid token from the frontend or Supabase directly
2. Use a tool like Postman to send requests with the Authorization header
3. Verify correct thread filtering by attempting to access threads created by other users

## Advanced Features

### Custom Claims

Extend the authentication handler to extract and validate custom JWT claims:

```typescript
if (validationResult.claims.role !== "admin") {
  throw new HTTPException(403, { message: "Insufficient permissions" });
}
```

### Role-Based Access Control

Implement more granular permissions for different graph operations:

```typescript
.permissions((user) => {
  // Return permissions based on user role
  return {
    canReadThreads: true,
    canWriteThreads: user.role === "admin",
    canDeleteThreads: user.role === "admin"
  };
})
```

## Additional Resources

- [LangGraph Authentication Documentation](https://langchain-ai.github.io/langgraphjs/how-tos/auth/custom_auth/)
- [Supabase JWT Documentation](https://supabase.com/docs/learn/auth-deep-dive/auth-deep-dive-jwts)
- [JSON Web Token Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
