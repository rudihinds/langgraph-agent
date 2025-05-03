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

## Frontend Interaction

- The frontend uses Supabase client-side libraries (`@supabase/supabase-js`) to manage login, signup, and session state.
- Authenticated requests from the frontend should automatically include the necessary cookies (`sb-*-auth-token`) managed by the Supabase client library.

## Backend API (Express)

### Token Verification & User ID Extraction

- The backend Express server needs to read the auth token cookie sent by the frontend.
- **Crucially, the `cookie-parser` middleware must be used in `server.ts` _before_ any routes that require authentication.**
  ```typescript
  // server.ts
  import cookieParser from "cookie-parser";
  // ... other imports
  const app = express();
  app.use(cookieParser()); // Use BEFORE your API routes
  // ... mount routes ...
  ```
- The `@supabase/ssr` package provides `createServerClient` to handle cookie-based auth verification on the server.
- In route handlers (e.g., `apps/backend/api/langgraph/index.ts`), create a server client instance, passing helper functions to access cookies from the Express `req` and `res` objects:

  ```typescript
  // Example in an Express route handler
  import { createServerClient } from "@supabase/ssr";
  import { Request, Response } from "express";
  import { ENV } from "@/lib/config/env.js"; // Assuming ENV setup

  async function handleRequest(req: Request, res: Response) {
    let userId = "anonymous"; // Default
    try {
      const supabase = createServerClient(
        ENV.SUPABASE_URL!,
        ENV.SUPABASE_ANON_KEY!, // Use anon key for server client
        {
          cookies: {
            get(key: string) {
              return req.cookies[key];
            },
            set(key: string, value: string, options: any) {
              res.cookie(key, value, options);
            },
            remove(key: string, options: any) {
              res.clearCookie(key, options);
            },
          },
        }
      );

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        console.warn("Auth error getting user:", authError.message);
      } else if (user?.id) {
        userId = user.id; // Successfully retrieved the authenticated user's UUID
        console.info(`Authenticated user ID found: ${userId}`);
      } else {
        console.warn("No authenticated user found.");
      }
    } catch (error: any) {
      console.error(
        "Error initializing Supabase client or getting user:",
        error.message
      );
    }

    // Now use the retrieved 'userId' (which is a UUID) for subsequent operations
    // like creating checkpointers...
    // const checkpointer = await createCheckpointer({ userId, ... });

    // ... rest of route logic ...
  }
  ```

### Protecting Routes

- Implement middleware to verify authentication before allowing access to protected API endpoints.
- This middleware would use the same `createServerClient` pattern to check for a valid user session.

## Checkpointer Integration

- The `SupabaseCheckpointer` (accessed via the `checkpointer-factory.ts`) requires the authenticated user's UUID.
- The `userIdGetter` function passed during checkpointer creation should provide this UUID.
- The factory and the API routes (like `POST /threads`) must correctly retrieve the UUID using the server-side auth flow described above before creating/using the checkpointer.
- **Row Level Security (RLS)** policies are configured on the `proposal_checkpoints` table in Supabase (`create_persistence_tables.sql`) to ensure users can only access their own checkpoint data based on the `user_id` column matching `auth.uid()`.

## Important Notes

- Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables are correctly set for the backend.
- The `SUPABASE_SERVICE_ROLE_KEY` is used by the checkpointer factory _internally_ when creating its own client for database writes, but the API routes should use the `ANON_KEY` for user session verification.
- Mismatched or missing `cookie-parser` middleware will lead to errors when `createServerClient` tries to read cookies.
