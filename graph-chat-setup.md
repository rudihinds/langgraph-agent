# LangGraph Chat UI Integration Plan

## Current Architecture Assessment

Our codebase already has the necessary architecture to support a chat interface for our LangGraph agent:

1. **Backend Graph Setup**: Our `langgraph.json` configuration [1] already exposes our proposal generation graph through three aliases:

   ```json
   {
     "graphs": {
       "proposal-generation": "apps/backend/agents/proposal-generation/graph.ts:createProposalGenerationGraph",
       "proposal-agent": "apps/backend/agents/proposal-generation/graph.ts:createProposalGenerationGraph",
       "agent": "apps/backend/agents/proposal-generation/graph.ts:createProposalGenerationGraph"
     }
   }
   ```

   This means our graph is accessible via the LangGraph server API as the "agent" endpoint.

2. **Chat UI Components**: We have already implemented the required components for the chat UI in our frontend under `apps/web/src/features/chat-ui/components/Thread.tsx` [2]. This component includes:

   - Message rendering for both AI and Human messages
   - Input field for user messages
   - Send button that's controlled by the `addMessage` function availability

3. **StreamProvider Implementation**: We have a StreamProvider component in `apps/web/src/features/chat-ui/providers/StreamProvider.tsx` [3] that handles:
   - Connection to the LangGraph backend
   - Thread initialization
   - Authentication
   - State management for the chat

## Issue Diagnosis

Based on the logs provided and the implementation review, the issue appears to be a disconnection between our chat UI and the LangGraph backend server. The specific issues are:

1. **Send Button Disabled**: The button remains disabled because the `addMessage` function isn't being properly passed or initialized [4], as seen in the Thread component's button implementation:

   ```typescript
   <Button
     type="submit"
     size="sm"
     disabled={
       !inputValue.trim() ||
       isStreaming ||
       isInterrupted ||
       !addMessage  // Button disabled when addMessage is undefined
     }
   >
     Send
   </Button>
   ```

2. **API Connection Configuration**: Our StreamProvider is initializing, but the API URL configuration may not be correctly pointing to our LangGraph server.

## Solution Plan

### 1. Add LangGraph API Passthrough

_Evidence_: According to the LangGraph documentation [5], the recommended approach for Next.js applications is to use the API passthrough pattern for authentication and routing.

```typescript
// file exists. may need updating or not: apps/web/app/api/langgraph/[...path]/route.ts
import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";

export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
  initApiPassthrough({
    apiUrl:
      process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ?? "http://localhost:2024",
    apiKey: process.env.LANGSMITH_API_KEY ?? "",
    runtime: "edge",
  });
```

_Citation_: This approach is based on the [agent-chat-ui](https://github.com/langchain-ai/agent-chat-ui) repository which we have cloned locally for reference (/Users/rudihinds/code/agent-chat-ui) and documentation which recommends this pattern for authentication and routing when connecting to a LangGraph server.

### 2. Update Environment Configuration

_Evidence_: The official LangGraph documentation [6] specifies the environment variables needed to connect to a LangGraph server:

```
# .env file
NEXT_PUBLIC_LANGGRAPH_API_URL="http://localhost:2024"
NEXT_PUBLIC_ASSISTANT_ID="agent"
NEXT_PUBLIC_API_URL="/api/langgraph"
```

_Citation_: This is based on the environment variable documentation in the LangGraph.js SDK, which requires these specific variable names for API configuration.

### 3. Update StreamProvider Configuration

_Evidence_: From the current StreamProvider implementation, we need to update the `apiUrl` to use our API proxy:

```typescript
// In apps/web/src/features/chat-ui/providers/StreamProvider.tsx
const stream = useTypedStream({
  apiUrl: apiUrl ?? process.env.NEXT_PUBLIC_API_URL ?? "/api/langgraph", // Point to our API proxy
  assistantId: assistantId ?? "proposal-agent",
  apiKey: apiKey,
  threadId: threadId || null,
  onThreadId: (id) => {
    if (id !== threadId) {
      console.log(`[StreamProvider] Setting thread ID to ${id}`);
      setThreadId(id);
    }
  },
});
```

_Citation_: This follows the usage pattern from the `useStream` hook in the LangGraph SDK [7], which requires the correct API endpoint to communicate with the LangGraph server.

### 4. Create a proper layout for the Chat page

_Evidence_: Based on the frontend file structure [8] and Next.js App Router conventions, we need a layout component to wrap our chat page:

```typescript
// New file: apps/web/app/dashboard/chat/layout.tsx
"use client";

import { StreamProvider } from "@/features/chat-ui/providers/StreamProvider";
import { ReactNode } from "react";

export default function ChatLayout({ children }: { children: ReactNode }) {
  return (
    <StreamProvider>
      {children}
    </StreamProvider>
  );
}
```

_Citation_: This follows the Next.js App Router pattern for layouts and the StreamProvider usage pattern shown in the agent-chat-ui examples [9].

### 5. Install Required Dependencies

_Evidence_: The LangGraph documentation specifies required packages [10]:

```bash
npm install @langchain/langgraph-sdk langgraph-nextjs-api-passthrough
```

_Citation_: These are the official packages needed for LangGraph JS SDK integration with Next.js applications, as documented in the LangGraph.js getting started guide.

## Implementation Steps

1. **Add API Passthrough Route**:

   - Create `apps/web/app/api/langgraph/[...path]/route.ts`
   - Implement the API passthrough as shown above

2. **Update Environment Variables**:

   - Add the required environment variables to `.env.local`
   - Ensure the backend LangGraph server is running on port 2024

3. **Create Chat Layout Component**:

   - Create `apps/web/app/dashboard/chat/layout.tsx`
   - Implement the StreamProvider wrapper as shown above

4. **Update StreamProvider Configuration**:

   - Modify the `apiUrl` in `apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
   - Ensure the `addMessage` function is properly exposed

5. **Install Dependencies**:

   - Run `npm install @langchain/langgraph-sdk langgraph-nextjs-api-passthrough`

6. **Test the Integration**:
   - Start the backend server
   - Start the frontend application
   - Navigate to the chat page
   - Verify the send button is enabled and messages can be sent

## How This Integrates with Our Existing Graph

The proposed solution connects to our proposal generation graph through the following flow:

1. **Frontend to Next.js API Proxy**: The StreamProvider component from our chat UI communicates with the Next.js API route at `/api/langgraph/[...path]` using the `useStream` hook.

2. **API Proxy to LangGraph Server**: The Next.js API route forwards requests to our LangGraph server running on port 2024 (locally) with appropriate authentication.

3. **LangGraph Server to Graph**: The LangGraph server routes the requests to the appropriate graph - in our case, the "agent" graph alias which points to our proposal generation graph.

4. **State Management**: Our existing graph state is preserved via the LangGraph checkpointer that we've already implemented, ensuring conversation history and context is maintained.

## References

[1] `langgraph.json` configuration in our codebase
[2] `apps/web/src/features/chat-ui/components/Thread.tsx` implementation
[3] `apps/web/src/features/chat-ui/providers/StreamProvider.tsx` implementation
[4] Thread.tsx button implementation that checks for `addMessage`
[5] LangGraph Next.js integration documentation: https://langchain-ai.github.io/langgraphjs/cloud/how-tos/nextjs_integration/
[6] LangGraph environment configuration: https://langchain-ai.github.io/langgraphjs/cloud/how-tos/deployment/
[7] `useStream` hook documentation: https://langchain-ai.github.io/langgraphjs/reference/functions/langgraph_react.useStream.html
[8] Frontend file structure in `apps/web/docs/frontend-file-structure.md`
[9] agent-chat-ui repository: https://github.com/langchain-ai/agent-chat-ui
[10] LangGraph installation guide: https://langchain-ai.github.io/langgraphjs/cloud/how-tos/nextjs_integration/#prerequisites
