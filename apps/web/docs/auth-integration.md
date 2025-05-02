# Frontend Authentication Integration Guide

## Overview

This document explains how the frontend authenticates with the LangGraph backend, handling session tokens, token refresh, and API communication.

## Architecture

The authentication flow follows these key steps:

1. User logs in through Supabase Auth
2. Frontend obtains session token from Supabase
3. Token is sent to LangGraph backend via the StreamProvider
4. Backend validates the token and attaches user context to request
5. Responses include token refresh recommendations when needed
6. Frontend handles token refresh automatically

## Key Components

### StreamProvider

The `StreamProvider` in `apps/web/src/features/chat-ui/providers/StreamProvider.tsx` manages authentication with the LangGraph backend:

```typescript
const streamValue = useTypedStream({
  apiUrl,
  assistantId,
  threadId: threadId ?? null,
  defaultHeaders: session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : undefined,
  // other configuration...
});
```

### Token Refresh Handling

The provider implements automatic token refresh for long-running chat sessions:

```typescript
// Handle token refresh for long sessions
useEffect(() => {
  if (!session) return;

  // ... token expiration check logic

  const handleRefresh = async () => {
    try {
      await refreshSession();
      // ... success handling
    } catch (error) {
      // ... error handling
    }
  };

  // ... setup refresh timer
}, [session, refreshSession]);
```

### API Proxy

The API proxy in `apps/web/app/api/langgraph/[...path]/route.ts` forwards requests to the LangGraph backend, including authentication headers.

## Implementation Details

### Token Refresh Buffer

The frontend proactively refreshes tokens before they expire:

```typescript
// Token refresh buffer in seconds (refresh if less than 5 minutes left)
const TOKEN_REFRESH_BUFFER = 300;
```

### Authentication Hook

The application uses a custom `useAuth` hook that provides:

- Current session information
- Authentication status
- Sign-in and sign-out methods
- Token refresh functionality

### Adding Authentication to New Components

When building components that need to interact with authenticated backend services:

1. Import and use the `useAuth` hook:

   ```typescript
   import { useAuth } from "@/features/auth/hooks/useAuth";

   function MyComponent() {
     const { session, isAuthenticated } = useAuth();
     // ...
   }
   ```

2. Include the token in API requests:

   ```typescript
   const headers = {
     "Content-Type": "application/json",
   };

   if (session?.access_token) {
     headers["Authorization"] = `Bearer ${session.access_token}`;
   }

   const response = await fetch("/api/your-endpoint", { headers });
   ```

3. Check for token refresh recommendations:
   ```typescript
   if (response.headers.get("X-Token-Refresh-Recommended")) {
     await refreshSession();
   }
   ```

## Thread Management

When using the chat interface with a specific RFP:

1. The RFP ID is passed as `initialRfpId` to the StreamProvider
2. The provider stores this in localStorage as the initial input
3. When creating a new thread, this information is used to load the RFP

## Error Handling

The StreamProvider implements error handling for:

- Connection failures to the LangGraph server
- Token refresh failures
- Server status checks

## Testing Authentication

To test authenticated requests:

1. Ensure you're signed in through Supabase Auth
2. Check the browser console for authentication-related messages
3. Use browser dev tools to verify Authorization headers are being sent
4. Verify token refresh is working by checking network requests during long sessions

## Debugging Tips

- Use browser storage tools to inspect the Supabase session
- Check network requests for Authentication headers
- Look for `X-Token-Refresh-Recommended` headers in responses
- Examine console logs for token refresh events

## Security Best Practices

- Never store access tokens in localStorage
- Use HttpOnly cookies for token storage when possible
- Implement proper CSP headers to prevent XSS attacks
- Always validate tokens on the backend
- Use HTTPS for all API communications
