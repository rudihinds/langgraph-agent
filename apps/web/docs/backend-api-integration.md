# Frontend Integration with Backend API

## 1. Overview

This document explains how the `apps/web` frontend, specifically the chat UI feature, interacts with the refactored `apps/backend` API. The backend now exposes LangGraph-compatible endpoints at its root, simplifying frontend integration.

## 2. Core Component: `StreamProvider.tsx`

- **Location:** `apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
- **Purpose:** Manages the connection to the backend, handles thread creation, state management, and message streaming for the chat interface.
- **Key Hook:** Uses the `@langchain/langgraph-sdk`'s `useStream` hook (or similar logic) to interact with the backend streaming endpoint.

## 3. API Interaction Flow

### 3.1. API URL Configuration

- `StreamProvider` determines the backend API URL using the following priority:
  1.  `propApiUrl` (if passed as a prop)
  2.  `process.env.NEXT_PUBLIC_API_URL` (environment variable)
  3.  Default: `/api/langgraph`
- **Default Behavior:** Typically, it uses `/api/langgraph`. This path is handled by a Next.js API route (`apps/web/src/app/api/langgraph/[...slug]/route.ts` - _assuming this standard passthrough setup exists or needs creation_) which proxies requests to the actual backend URL specified by the `LANGGRAPH_API_URL` environment variable on the Next.js server.

```typescript
// From StreamProvider.tsx
const apiUrl =
  propApiUrl || process.env.NEXT_PUBLIC_API_URL || "/api/langgraph";
```

### 3.2. Initialization and Status Check

- When the provider mounts or `rfpId` changes:
  - It attempts to get the `threadId` (potentially from session storage or URL state).
  - It performs a status check by calling `GET ${apiUrl}/info`.
    - This confirms the backend service is running before attempting other operations.

```typescript
// Simplified logic from StreamProvider.tsx useEffect
useEffect(() => {
  const checkGraphStatus = async () => {
    try {
      const response = await fetch(`${apiUrl}/info`);
      // ... handle response ...
    } catch (error) {
      /* ... handle error ... */
    }
  };
  checkGraphStatus();
  // ... other initialization logic ...
}, [apiUrl, rfpId]);
```

### 3.3. Thread Creation

- If no `threadId` is available for the current `rfpId`, the provider initiates thread creation.
- It calls `POST ${apiUrl}/threads` with the required body:
  ```json
  {
    "assistant_id": "proposal-agent",
    "metadata": { "rfpId": "current-rfp-id" }
  }
  ```
- On success (201 Created), it receives the new `thread_id` and stores it (e.g., in state or session storage) for subsequent requests.

```typescript
// Simplified logic from StreamProvider.tsx initializeThread
const initializeThread = async (rfpId: string) => {
  try {
    const response = await fetch(`${apiUrl}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistant_id: "proposal-agent",
        metadata: { rfpId },
      }),
    });
    const data = await response.json();
    if (response.ok) {
      setThreadId(data.thread_id);
      // ... store threadId ...
    } else {
      /* ... handle error ... */
    }
  } catch (error) {
    /* ... handle error ... */
  }
};
```

### 3.4. Streaming Messages

- Once a `threadId` is established, the `useStream` hook (or equivalent logic within `StreamProvider`) connects to the streaming endpoint.
- It makes a `POST ${apiUrl}/threads/${threadId}/stream` request.
  - The request body contains the input for the graph (e.g., the user's message). This body can be empty/null when resuming an interrupted stream.
- The provider listens for Server-Sent Events (SSE) on this connection.
- As data chunks arrive (representing graph state updates, messages, tool calls, etc.), the provider processes them and updates the chat UI state accordingly.

```typescript
// Conceptual usage based on LangGraph SDK patterns
// (Actual implementation might differ slightly in StreamProvider)

const { stream /* other values */ } = useStream({
  apiUrl: apiUrl,
  threadId: currentThreadId,
  // Input is provided when sending a message
});

// When sending a message:
// stream({ messages: [{ role: 'user', content: 'User message' }] });

// Logic within StreamProvider listens to the stream events
// and updates message lists, status indicators, etc.
```

### 3.5. State Updates (Manual)

- While less common for typical chat flow, the frontend _could_ potentially call `POST ${apiUrl}/threads/${threadId}/update` if manual state manipulation is needed (e.g., providing feedback on a tool call), although this logic might reside more within the backend graph itself.

## 4. Summary

The frontend relies on the backend exposing a standard set of LangGraph API endpoints, accessed via the `apiUrl` (usually `/api/langgraph` proxied by Next.js). `StreamProvider.tsx` orchestrates the status checks, thread creation, and SSE streaming connection necessary for the chat UI.
