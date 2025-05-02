# Chat UI Integration Plan

## Project Paths

- **Project Root**: `/Users/rudihinds/code/langgraph-agent`
- **Web App Frontend**: `/Users/rudihinds/code/langgraph-agent/apps/web`
- **Backend App**: `/Users/rudihinds/code/langgraph-agent/apps/backend`
- **Chat UI Source**: `/Users/rudihinds/code/agent-chat-ui`
- **Web API Routes**: `/Users/rudihinds/code/langgraph-agent/apps/web/app/api`
- **Page Route Target**: `/Users/rudihinds/code/langgraph-agent/apps/web/app/dashboard/chat`

## Overview

This document outlines the complete plan for integrating the LangGraph Agent Chat UI into our application, following our established folder structure. The integration will provide users with a seamless experience for managing proposal threads, starting new proposals, and continuing existing ones.

## Success Criteria

1. **Navigation Integration**: A new "Chat" button in our web app sidebar that initializes the agent chat UI.
2. **Thread Management**: Users can view and select from a list of their previous conversation threads.
3. **Proposal Continuation**: Clicking "Start a Proposal" on an existing proposal in the dashboard takes the user to the chat UI with that proposal's RFP ID loaded.
4. **Authentication Integration**: The chat UI uses our existing Supabase auth system for API access and user identification.
5. **Consistent Design**: The chat UI matches our application's design system and theme.
6. **Responsive Behavior**: The integration works seamlessly on all device sizes.

## Current Progress Status

Based on a thorough assessment of the codebase, the following components of the Chat UI integration have been implemented:

### ✅ Completed

- **Environment Setup**: Dependencies and API proxy have been set up correctly
- **Feature Structure**: Basic directory structure for the chat-ui feature is in place
- **Core Utilities**: Essential utility functions are implemented (`message-utils.ts`, `agent-inbox-utils.ts`)
- **Library Modules**: Core libraries (`ensure-tool-responses.ts`, `agent-inbox-interrupt.ts`, `client.ts`) are implemented
- **Provider Components**: `StreamProvider.tsx`, `ThreadProvider.tsx`, `InterruptProvider.tsx`, and `AgentInboxProvider.tsx` are implemented
- **Type Definitions**: Basic types in `types.ts` have been set up
- **Hooks**: Basic hooks like `useMediaQuery` exist
- **UI Components (Phase 2)**: All UI components have been implemented correctly:
  - `components/icons/github.tsx` - GitHub SVG icon
  - `components/icons/langgraph.tsx` - LangGraph logo SVG
  - `components/tooltip-icon-button.tsx` - TooltipIconButton component
  - `components/markdown-styles.css` - Markdown styling CSS
  - `components/markdown-text.tsx` - MarkdownText component
  - `components/syntax-highlighter.tsx` - SyntaxHighlighter component
  - `components/messages/shared.tsx` - Shared message utilities (copy, branch switcher, command bar)
  - `components/messages/human.tsx` - HumanMessage component
  - `components/messages/ai.tsx` - AIMessage component
  - `components/messages/tool-calls.tsx` - ToolCalls component
  - `components/messages/generic-interrupt.tsx` - GenericInterruptView component
- **Agent Inbox Components (Phase 3)**: All Agent Inbox components have been implemented correctly:
  - `components/agent-inbox/state-view.tsx` - StateView component for displaying state
  - `components/agent-inbox/thread-actions-view.tsx` - ThreadActionsView component
  - `components/agent-inbox/thread-id.tsx` - ThreadId component
  - `components/agent-inbox/tool-call-table.tsx` - ToolCallTable component
  - `components/agent-inbox/inbox-item-input.tsx` - InboxItemInput component
  - `components/agent-inbox/index.tsx` - Main AgentInbox component
- **Main Thread Component**: The main Thread component (`components/Thread.tsx`) has been implemented

### 🚧 In Progress (Current Focus)

- **Thread History Component (Phase 4)**:
  - Setting up thread history and navigation
  - Implementing thread list UI
  - Implementing thread selection functionality

### ❌ Not Started

- **Dashboard/Chat Page**: The `/app/dashboard/chat` route doesn't exist yet
- **Navigation Integration**: Chat link in sidebar navigation hasn't been added
- **Proposal Card Integration**: "Continue in Chat" button for proposal cards hasn't been added
- **Testing**: No tests have been created yet
- **UI Polish**: Consistency, accessibility, and mobile responsiveness improvements

## Consolidated Implementation Plan

Based on the current state and original plan, here is the consolidated implementation plan with all required steps:

### Phase 1: Core Utilities and Providers (✅ Completed)

1. ✅ Install required dependencies:

   ```bash
   cd apps/web
   npm install @langchain/langgraph-sdk @langchain/core @langchain/langgraph framer-motion nuqs use-stick-to-bottom sonner date-fns lodash uuid react-syntax-highlighter rehype-katex remark-gfm remark-math katex
   ```

2. ✅ Set up API proxy for LangGraph:

   ```typescript
   // Target: /apps/web/app/api/langgraph/[...path]/route.ts
   import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";

   export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
     initApiPassthrough({
       apiUrl:
         process.env.NEXT_PUBLIC_LANGGRAPH_API_URL ?? "http://localhost:2024",
       apiKey: process.env.LANGSMITH_API_KEY ?? "",
       runtime: "edge",
     });
   ```

3. ✅ Update environment variables (.env.local):

   ```
   NEXT_PUBLIC_LANGGRAPH_API_URL="http://localhost:2024"
   NEXT_PUBLIC_ASSISTANT_ID="agent"
   LANGSMITH_API_KEY="your-key-here" # For server-side API calls
   ```

4. ✅ Create the chat-ui feature directory structure:

   ```bash
   mkdir -p apps/web/src/features/chat-ui/{components,hooks,types,lib,providers,utils}
   mkdir -p apps/web/src/features/chat-ui/components/{messages,agent-inbox,icons}
   mkdir -p apps/web/app/dashboard/chat
   mkdir -p apps/web/src/__tests__/chat-ui
   ```

5. ✅ Create feature's public API exports file:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/index.ts

   // Export main components
   export { Thread } from "./components/Thread";

   // Export providers
   export { StreamProvider } from "./providers/StreamProvider";
   export { ThreadProvider } from "./providers/ThreadProvider";

   // Export types
   export * from "./types";
   ```

6. ✅ Define feature-specific types:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/types/index.ts
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/agent-inbox/types.ts

   import { BaseMessage } from "@langchain/core/messages";
   import { Thread, ThreadStatus } from "@langchain/langgraph-sdk";
   import { HumanInterrupt, HumanResponse } from "@langchain/langgraph/prebuilt";

   // Copy and adapt all types from the source file
   export type HumanResponseWithEdits = HumanResponse & /* ... */;
   export type Email = { /* ... */ };
   export interface ThreadValues { /* ... */ }
   export type ThreadData<ThreadValues extends Record<string, any> = Record<string, any>> = { /* ... */ };
   export type ThreadStatusWithAll = ThreadStatus | "all";
   export type SubmitType = "accept" | "response" | "edit";
   export interface AgentInbox { /* ... */ }
   ```

7. ✅ Create message utility functions:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/utils/message-utils.ts
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/utils.ts

   import type { Message } from "@langchain/langgraph-sdk";

   export function getContentString(content: Message["content"]): string {
     if (typeof content === "string") return content;
     const texts = content
       .filter((c): c is { type: "text"; text: string } => c.type === "text")
       .map((c) => c.text);
     return texts.join(" ");
   }
   ```

8. ✅ Create agent inbox utilities:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/utils/agent-inbox-utils.ts
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/agent-inbox/utils.ts

   export function prettifyText(action: string) {
     /* ... */
   }
   export function isArrayOfMessages(value: Record<string, any>[]): boolean {
     /* ... */
   }
   // Other utility functions from source file
   ```

9. ✅ Create tool response handling library:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/lib/ensure-tool-responses.ts
   // Source: /Users/rudihinds/code/agent-chat-ui/src/lib/ensure-tool-responses.ts

   import { v4 as uuidv4 } from "uuid";
   import { Message, ToolMessage } from "@langchain/langgraph-sdk";

   export const DO_NOT_RENDER_ID_PREFIX = "do-not-render-";

   export function ensureToolCallsHaveResponses(
     messages: Message[]
   ): Message[] {
     // Copy and adapt the function from the source file
   }
   ```

10. ✅ Create agent interrupt detection library:

    ```typescript
    // Target: /apps/web/src/features/chat-ui/lib/agent-inbox-interrupt.ts
    // Source: /Users/rudihinds/code/agent-chat-ui/src/lib/agent-inbox-interrupt.ts

    import { HumanInterrupt } from "@langchain/langgraph/prebuilt";

    export function isAgentInboxInterruptSchema(
      value: unknown
    ): value is HumanInterrupt | HumanInterrupt[] {
      // Copy and adapt the function from the source file
    }
    ```

11. ✅ Create LangGraph client utility:

    ```typescript
    // Target: /apps/web/src/features/chat-ui/lib/client.ts
    // Source: /Users/rudihinds/code/agent-chat-ui/src/providers/client.ts

    import { Client } from "@langchain/langgraph-sdk";

    export function createClient(apiUrl: string, apiKey: string | undefined) {
      return new Client({
        apiKey,
        apiUrl,
      });
    }
    ```

12. ✅ Create media query hook:

    ```typescript
    // Target: /apps/web/src/features/chat-ui/hooks/useMediaQuery.ts
    // Source: /Users/rudihinds/code/agent-chat-ui/src/hooks/useMediaQuery.tsx

    import { useEffect, useState } from "react";

    export function useMediaQuery(query: string) {
      // Copy and adapt the hook from the source file
    }
    ```

13. ✅ Create interrupted actions hook:

    ```typescript
    // Target: /apps/web/src/features/chat-ui/hooks/useInterruptedActions.ts
    // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/agent-inbox/hooks/use-interrupted-actions.tsx

    import {
      HumanInterrupt,
      HumanResponse,
    } from "@langchain/langgraph/prebuilt";
    import { END } from "@langchain/langgraph/web";
    import { useState, useRef } from "react";
    import { toast } from "sonner";
    // Other imports

    // Copy and adapt the hook from the source file
    ```

14. ✅ Create authentication hook:

    ```typescript
    // Target: /apps/web/src/features/auth/hooks/useAuth.ts

    import { useEffect, useState } from "react";
    import { User } from "@supabase/supabase-js";
    import { createClient } from "@/lib/supabase/client";

    export interface AuthSession {
      access_token: string;
      refresh_token: string;
      expires_at?: number;
    }

    interface UseAuthReturn {
      user: User | null;
      session: AuthSession | null;
      loading: boolean;
      error: Error | null;
    }

    /**
     * React hook for accessing the current authentication state
     * Integrates with Supabase Auth
     */
    export function useAuth(): UseAuthReturn {
      // Implementation...
    }
    ```

15. ✅ Create StreamProvider with authentication integration:

    ```typescript
    // Target: /apps/web/src/features/chat-ui/providers/StreamProvider.tsx
    // Source: /Users/rudihinds/code/agent-chat-ui/src/providers/Stream.tsx

    import React, {
      createContext,
      useContext,
      ReactNode,
      useState,
      useEffect,
    } from "react";
    import { useStream } from "@langchain/langgraph-sdk/react";
    import { type Message } from "@langchain/langgraph-sdk";
    // Other imports

    // Copy and adapt from source file, integrating with our auth system
    ```

16. ✅ Create ThreadProvider:

    ```typescript
    // Target: /apps/web/src/features/chat-ui/providers/ThreadProvider.tsx
    // Source: /Users/rudihinds/code/agent-chat-ui/src/providers/Thread.tsx

    import { validate } from "uuid";
    import { Thread } from "@langchain/langgraph-sdk";
    import { useQueryState } from "nuqs";
    // Other imports

    // Copy and adapt from source file, integrating with our auth system
    ```

### Phase 2: UI Components (✅ Completed)

1. ✅ Create icon components:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/icons/LangGraphLogo.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/icons/langgraph.tsx

   export function LangGraphLogo({
     className,
     width,
     height,
   }: {
     width?: number;
     height?: number;
     className?: string;
   }) {
     // Copy and adapt from source
   }
   ```

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/icons/GitHubLogo.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/icons/github.tsx

   export function GitHubLogo({ width = "100%", height = "100%" }) {
     // Copy and adapt from source
   }
   ```

2. ✅ Create tooltip icon button component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/TooltipIconButton.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/tooltip-icon-button.tsx

   import { forwardRef } from "react";
   import {
     Tooltip,
     TooltipContent,
     TooltipProvider,
     TooltipTrigger,
   } from "@/components/ui/tooltip";
   import { Button, ButtonProps } from "@/components/ui/button";
   import { cn } from "@/lib/utils";

   // Copy and adapt from source
   ```

3. ✅ Create markdown rendering components:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/MarkdownText.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/markdown-text.tsx

   // Add the CSS file
   // Target: /apps/web/src/features/chat-ui/components/markdown-styles.css
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/markdown-styles.css

   import "./markdown-styles.css";
   // Copy and adapt from source
   ```

4. ✅ Create syntax highlighter component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/SyntaxHighlighter.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/syntax-highlighter.tsx

   // Copy and adapt from source
   ```

5. ✅ Create shared message utilities:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/messages/shared.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/messages/shared.tsx

   // Copy and adapt from source
   ```

6. ✅ Create human message component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/messages/HumanMessage.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/messages/human.tsx

   // Copy and adapt from source
   ```

7. ✅ Create AI message component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/messages/AIMessage.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/messages/ai.tsx

   // Copy and adapt from source
   ```

8. ✅ Create tool calls components:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/messages/ToolCalls.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/messages/tool-calls.tsx

   // Copy and adapt from source
   ```

9. ✅ Create generic interrupt component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/messages/GenericInterrupt.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/messages/generic-interrupt.tsx

   // Copy and adapt from source
   ```

### Phase 3: Agent Inbox Components (✅ Completed)

1. ✅ Create state view component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/agent-inbox/state-view.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/agent-inbox/components/state-view.tsx

   // Copy and adapt from source
   ```

2. ✅ Create thread actions view component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/agent-inbox/thread-actions-view.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/agent-inbox/components/thread-actions-view.tsx

   // Copy and adapt from source
   ```

3. ✅ Create thread ID component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/agent-inbox/thread-id.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/agent-inbox/components/thread-id.tsx

   // Copy and adapt from source
   ```

4. ✅ Create tool call table component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/agent-inbox/tool-call-table.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/agent-inbox/components/tool-call-table.tsx

   // Copy and adapt from source
   ```

5. ✅ Create inbox item input component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/agent-inbox/inbox-item-input.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/agent-inbox/components/inbox-item-input.tsx

   // Copy and adapt from source
   ```

6. ✅ Create main agent inbox component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/agent-inbox/index.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/agent-inbox/index.tsx

   // Copy and adapt from source
   ```

### Phase 4: Thread Components (🚧 In Progress)

1. Create Thread History component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/ThreadHistory.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/history/index.tsx

   // Copy and adapt from source
   ```

2. ✅ Complete Main Thread component:

   ```typescript
   // Target: /apps/web/src/features/chat-ui/components/Thread.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/components/thread/index.tsx

   import { v4 as uuidv4 } from "uuid";
   import { ReactNode, useEffect, useRef } from "react";
   import { motion } from "framer-motion";
   import { cn } from "@/lib/utils";
   import { useStreamContext } from "../providers/StreamProvider";
   import { useState, FormEvent } from "react";
   import { Button } from "@/components/ui/button";
   import { Checkpoint, Message } from "@langchain/langgraph-sdk";
   import { AIMessage, AssistantMessageLoading } from "./messages/AIMessage";
   import { HumanMessage } from "./messages/HumanMessage";
   // Other imports

   // Implement a complete Thread component, adapting from source
   ```

### Phase 5: Chat Page & Navigation (❌ Not Started)

1. Create the Chat page component:

   ```typescript
   // Target: /apps/web/app/dashboard/chat/page.tsx
   // Source: /Users/rudihinds/code/agent-chat-ui/src/app/page.tsx

   "use client";

   import { Thread, StreamProvider, ThreadProvider } from "@/features/chat-ui";
   import { Toaster } from "@/components/ui/sonner";
   import React from "react";
   import { useSearchParams } from "next/navigation";

   export default function ChatPage(): React.ReactNode {
     const searchParams = useSearchParams();
     const rfpId = searchParams.get('rfpId');

     return (
       <React.Suspense fallback={<div>Loading...</div>}>
         <Toaster />
         <ThreadProvider>
           <StreamProvider initialRfpId={rfpId}>
             <Thread />
           </StreamProvider>
         </ThreadProvider>
       </React.Suspense>
     );
   }
   ```

2. Update sidebar navigation in the layouts component:

   ```typescript
   // Target: /apps/web/src/components/layouts/Sidebar.tsx

   import { MessageSquare } from "lucide-react"; // Or appropriate icon

   // Add to navigation items array
   const navItems = [
     // ... existing items
     {
       name: "Chat",
       href: "/dashboard/chat",
       icon: MessageSquare,
     },
   ];
   ```

3. Add "Continue in Chat" button to proposal cards:

   ```typescript
   // Target: /apps/web/src/features/proposals/components/display/ProposalCard.tsx

   import { useRouter } from "next/navigation";
   import { Button } from "@/components/ui/button";

   // Inside component
   const router = useRouter();

   // Add button
   <Button
     onClick={() => router.push(`/dashboard/chat?rfpId=${proposal.id}`)}
     variant="outline"
   >
     Continue in Chat
   </Button>
   ```

### Phase 6: Testing (❌ Not Started)

1. Create tests for utility functions:

   ```typescript
   // Target: /apps/web/src/__tests__/chat-ui/utils/message-utils.test.ts
   // Test basic utility functions like getContentString

   // Target: /apps/web/src/__tests__/chat-ui/utils/agent-inbox-utils.test.ts
   // Test agent inbox utilities

   // Target: /apps/web/src/__tests__/chat-ui/lib/ensure-tool-responses.test.ts
   // Test tool response handling

   // Target: /apps/web/src/__tests__/chat-ui/lib/agent-inbox-interrupt.test.ts
   // Test interrupt detection
   ```

2. Create tests for hooks:

   ```typescript
   // Target: /apps/web/src/__tests__/chat-ui/hooks/useMediaQuery.test.ts
   // Test media query hook

   // Target: /apps/web/src/__tests__/chat-ui/hooks/useInterruptedActions.test.ts
   // Test with mocked StreamContext
   ```

3. Create tests for providers:

   ```typescript
   // Target: /apps/web/src/__tests__/chat-ui/providers/ThreadProvider.test.tsx
   // Test thread provider with mocked client

   // Target: /apps/web/src/__tests__/chat-ui/providers/StreamProvider.test.tsx
   // Test stream provider with mocked useStream hook
   ```

4. Create tests for UI components:

   ```typescript
   // Target: /apps/web/src/__tests__/chat-ui/components/Thread.test.tsx
   // Test main thread component with mocked providers

   // Target: /apps/web/src/__tests__/chat-ui/components/messages/HumanMessage.test.tsx
   // Test human message component

   // Target: /apps/web/src/__tests__/chat-ui/components/messages/AIMessage.test.tsx
   // Test AI message component
   ```

5. Create integration tests:

   ```typescript
   // Target: /apps/web/src/__tests__/chat-ui/integration/auth-integration.test.tsx
   // Test integration with our auth system

   // Target: /apps/web/src/__tests__/chat-ui/integration/page-routing.test.tsx
   // Test page component and URL parameter handling
   ```

## Implementation Priority

1. Complete core message components (Phase 2)
2. Implement agent inbox components (Phase 3)
3. Complete thread components (Phase 4)
4. Create chat page and update navigation (Phase 5)
5. Add comprehensive tests (Phase 6)

## Next Immediate Steps

1. **Complete Phase 3: Backend Integration & Tool Call Handling**

   - Resolve linter errors by ensuring all required dependencies and UI primitives are present
   - Complete the Agent Inbox components:
     - `components/agent-inbox/StateView.tsx`
     - `components/agent-inbox/ThreadActionsView.tsx`
     - `components/agent-inbox/ThreadId.tsx`
     - `components/agent-inbox/ToolCallTable.tsx`
     - `components/agent-inbox/InboxItemInput.tsx`
     - `components/agent-inbox/index.tsx`
   - Implement real-time chat connection to LangGraph backend
   - Create thread history component for navigation between conversations

2. **Complete Phase 4: Thread Components**

   - Create the Thread History component
   - Complete the main Thread component with all functionality

3. **Start Phase 5: Chat Page & Navigation**

   - Create the `/app/dashboard/chat` route and page component
   - Update sidebar navigation to include Chat link
   - Add "Continue in Chat" button to proposal cards

4. **Plan for Phase 6: Testing**
   - Set up test infrastructure
   - Create tests for core components

## Deadline

Target completion date: June 30, 2024 (assuming implementation begins immediately)
