# Chat UI Integration Plan

## Project Paths

- **Project Root**: `/Users/rudihinds/code/langgraph-agent`
- **Web App Frontend**: `/Users/rudihinds/code/langgraph-agent/apps/web`
- **Backend App**: `/Users/rudihinds/code/langgraph-agent/apps/backend`
- **Chat UI Source**: `../agent-chat-ui`
- **Web API Routes**: `/Users/rudihinds/code/langgraph-agent/apps/web/app/api`
- **Backend API Routes**: `/Users/rudihinds/code/langgraph-agent/apps/backend/api`
- **Integration Target Directory**: `/Users/rudihinds/code/langgraph-agent/apps/web/src/components/chat-ui`
- **Page Route Target**: `/Users/rudihinds/code/langgraph-agent/apps/web/src/app/(dashboard)/chat`

## Overview

This document outlines the complete plan for integrating the LangGraph Agent Chat UI into our application. The integration will provide users with a seamless experience for managing proposal threads, starting new proposals, and continuing existing ones.

## Success Criteria

1. **Navigation Integration**: A new "Chat" button in our web app sidebar that initializes the agent chat UI.
2. **Thread Management**: Users can view and select from a list of their previous conversation threads.
3. **Proposal Continuation**: Clicking "Start a Proposal" on an existing proposal in the dashboard takes the user to the chat UI with that proposal's RFP ID loaded.
4. **Authentication Integration**: The chat UI uses our existing auth system for API access and user identification.
5. **Consistent Design**: The chat UI matches our application's design system and theme.
6. **Responsive Behavior**: The integration works seamlessly on all device sizes.

## Phase 1: Environment Setup and Dependencies

### Steps

1. Install required dependencies:

   ```bash
   cd apps/web
   npm install @langchain/langgraph-sdk @langchain/core framer-motion nuqs use-stick-to-bottom sonner
   ```

2. Ensure necessary configurations are compatible:

   - Compare tailwind.config.js between projects
   - Check for any custom PostCSS configurations
   - Review any needed TypeScript configuration updates

3. Update environment variables:

   ```bash
   # Add to .env.local
   NEXT_PUBLIC_LANGGRAPH_API_URL="http://localhost:2024"
   NEXT_PUBLIC_ASSISTANT_ID="agent"
   ```

4. Set up API proxy for LangGraph in `apps/web/app/api/langgraph/[...path]/route.ts`:

   ```typescript
   import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";

   export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
     initApiPassthrough({
       apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:2024",
       apiKey: process.env.LANGSMITH_API_KEY || "",
       runtime: "edge",
     });
   ```

5. Install the API passthrough package:
   ```bash
   npm install langgraph-nextjs-api-passthrough
   ```

### Potential Challenges

- **Dependency Version Conflicts**: Ensure the LangGraph SDK and React versions are compatible
- **Path Aliasing**: May need to update `tsconfig.json` to support the chat UI import paths
- **Environment Configuration**: Ensuring local development variables are properly set for both projects
- **Next.js App Router Compatibility**: The Chat UI components must be compatible with Next.js App Router patterns

## Phase 2: Core Component Extraction

### Steps

1. Create directory structure:

   ```bash
   mkdir -p apps/web/src/components/chat-ui/{thread,providers,lib,icons}
   mkdir -p apps/web/src/app/(dashboard)/chat
   ```

2. Extract and adapt the core Thread component:

   - Copy `Thread.tsx` from agent-chat-ui and update imports
   - Adapt to use our authentication system
   - Update styles to match our design system

3. Extract message components:

   - Copy and adapt human/AI message components
   - Update styling to match our design system
   - Ensure tool calls render correctly

4. Extract provider components:

   - Adapt StreamProvider to work with our auth system
   - Update ThreadProvider for proper thread management

5. Create a page component in `apps/web/src/app/(dashboard)/chat/page.tsx`:

   ```typescript
   "use client";

   import { Thread } from "@/components/chat-ui/thread";
   import { StreamProvider } from "@/components/chat-ui/providers/Stream";
   import { ThreadProvider } from "@/components/chat-ui/providers/Thread";
   import { Toaster } from "@/components/ui/sonner";
   import React from "react";

   export default function ChatPage(): React.ReactNode {
     return (
       <React.Suspense fallback={<div>Loading...</div>}>
         <Toaster />
         <ThreadProvider>
           <StreamProvider>
             <Thread />
           </StreamProvider>
         </ThreadProvider>
       </React.Suspense>
     );
   }
   ```

### Potential Challenges

- **Import Path Resolution**: Will need to update all relative imports
- **Component Adaptations**: May need to modify components to work with our auth system
- **Design System Integration**: Ensuring consistent styling with our app
- **State Management**: Properly integrating the Stream and Thread providers

## Phase 3: Authentication Integration

### Steps

1. Update the StreamProvider to use our authentication system:

   ```typescript
   // Modify StreamProvider.tsx to use our auth
   const apiKey = useAuth().session?.access_token || null;
   ```

2. Adapt the chat API proxy to pass authentication:

   ```typescript
   // Modify API passthrough to include auth headers
   export const { GET, POST, PUT, PATCH, DELETE, OPTIONS, runtime } =
     initApiPassthrough({
       apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:2024",
       getHeaders: async (req) => {
         // Extract auth token from incoming request
         const token = req.headers.get("authorization");
         return {
           Authorization: token || "",
         };
       },
       runtime: "edge",
     });
   ```

3. Integrate our auth interceptor with fetch requests:

   ```typescript
   // Modify Stream.tsx to use our auth interceptor
   import { createAuthInterceptor } from "@/lib/api/auth-interceptor";

   // Initialize the interceptor
   const authInterceptor = createAuthInterceptor();

   // Use the interceptor for API calls
   const fetchWithAuth = authInterceptor.fetch;
   ```

### Potential Challenges

- **Token Refresh**: Ensuring proper token refresh handling between systems
- **Authorization Headers**: Correct propagation of auth headers through proxies
- **Session Management**: Handling session expiration consistently
- **User Context**: Ensuring user context is available to the Chat UI

## Phase 4: Navigation and Routing Integration

### Steps

1. Add chat navigation to sidebar in `apps/web/src/components/layouts/Sidebar.tsx`:

   ```typescript
   // Add to the navigation items
   const navItems = [
     // ... existing items
     {
       name: "Chat",
       href: "/chat",
       icon: MessageSquare, // Use appropriate icon
     },
   ];
   ```

2. Create a link from the dashboard proposals to the chat UI:

   ```typescript
   // In ProposalCard.tsx or similar component
   <Button
     onClick={() => router.push(`/chat?threadId=${proposal.threadId}`)}
   >
     Continue in Chat
   </Button>
   ```

3. Handle existing proposal navigation in the Chat page:

   ```typescript
   // In chat/page.tsx, add a parameter handler
   "use client";

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

4. Update StreamProvider to accept and process the rfpId:
   ```typescript
   // Modify StreamProvider to accept initialRfpId
   export const StreamProvider: React.FC<{
     children: ReactNode;
     initialRfpId?: string;
   }> = ({ children, initialRfpId }) => {
     // Use the initialRfpId when starting a new thread
     // ...
   };
   ```

### Potential Challenges

- **URL Parameter Handling**: Managing URL parameters between routes
- **Thread Management**: Ensuring threads are properly associated with proposals
- **Navigation State**: Handling the active navigation state in the sidebar
- **Deep Linking**: Supporting deep links to specific proposals or threads

## Phase 5: Backend Integration

### Steps

1. Ensure the LangGraph backend properly handles RFP IDs in new threads:

   ```typescript
   // Update the LangGraph agent to accept rfpId on thread creation
   router.post("/api/rfp/start", async (req, res) => {
     const { rfpId } = req.body;
     // Create a new thread with the rfpId
     // ...
   });
   ```

2. Update the document loading functionality to use the RFP ID from the thread state:

   ```typescript
   // In document_loader.js
   export const documentLoaderNode = async (
     state: OverallProposalState,
     context?: any
   ) => {
     const rfpId = state.rfpDocument?.id || context?.rfpId;
     // Load document with rfpId
     // ...
   };
   ```

3. Ensure the API endpoints support the Chat UI's request formats:
   ```typescript
   // Verify API compatibility
   router.post("/api/chat", async (req, res) => {
     // Handle chat messages in the format expected by Chat UI
     // ...
   });
   ```

### Potential Challenges

- **API Compatibility**: Ensuring our backend API endpoints match what the Chat UI expects
- **Thread State Management**: Properly storing and retrieving rfpId in thread state
- **Document Loading**: Ensuring documents are correctly loaded based on rfpId
- **Error Handling**: Consistent error handling between systems

## Phase 6: Testing and Refinement

### Steps

1. Create test scenarios for the integration:

   - Starting a new chat thread
   - Continuing an existing proposal
   - Authentication flow testing
   - Token refresh testing
   - Mobile responsiveness testing

2. Implement any necessary adjustments based on testing:

   - Fix style inconsistencies
   - Address authentication edge cases
   - Optimize performance issues
   - Improve error handling

3. Conduct user testing with real proposals:
   - Test with various RFP documents
   - Verify thread creation and continuation
   - Test the complete user journey

### Potential Challenges

- **Edge Cases**: Identifying and handling unexpected scenarios
- **Performance**: Ensuring the integration performs well with real data
- **Browser Compatibility**: Testing across different browsers
- **Mobile Experience**: Ensuring a good experience on smaller screens

## Phase 7: Documentation and Deployment

### Steps

1. Update documentation:

   - Add chat UI usage instructions to user documentation
   - Document integration architecture for developers
   - Create troubleshooting guide for common issues

2. Prepare for deployment:

   - Verify environment variables for production
   - Ensure proper build configuration
   - Test production build locally

3. Deploy and monitor:
   - Deploy to staging environment
   - Conduct final testing
   - Monitor for errors or performance issues
   - Deploy to production

### Potential Challenges

- **Environment Configuration**: Ensuring correct production environment variables
- **Build Optimization**: Properly optimizing the build for production
- **Monitoring**: Setting up appropriate monitoring for the integrated system
- **User Adoption**: Ensuring users understand and adopt the new chat interface

## Implementation Timeline

- **Phase 1**: 1 day
- **Phase 2**: 2-3 days
- **Phase 3**: 1-2 days
- **Phase 4**: 1 day
- **Phase 5**: 1-2 days
- **Phase 6**: 2 days
- **Phase 7**: 1 day

Total estimated time: 9-12 days

## Resources

- [LangGraph JavaScript SDK Documentation](https://js.langchain.com/docs/modules/langgraph/)
- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [Supabase Authentication Documentation](https://supabase.com/docs/guides/auth)
