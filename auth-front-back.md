# Authentication and Thread Handoff Integration Plan

This document outlines the steps required to complete the integration between the frontend authentication system and the backend LangGraph API, ensuring proper session management and thread handoff from dashboard to chat interface.

## Overview

The plan consists of five phases:

1. Authentication Integration (Frontend)
2. LangGraph Authentication Handler (Backend)
3. Thread Management
4. User-Thread Relationship
5. Error Handling and Testing

Each phase builds on the previous one and contains specific tasks with file paths that need to be updated.

## Phase 1: Authentication Integration (Frontend)

Focus on connecting our Supabase authentication system to the LangGraph client through the StreamProvider.

### Steps:

- [x] **1.1 Update StreamProvider to use session token**

  - Path: `/apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - Task: Modify StreamProvider to extract the auth token from our session and pass it to the LangGraph client
  - Code changes:
    - Import useSession hook
    - Extract access_token from session
    - Pass token to createClient

- [x] **1.2 Add token refresh handling**

  - Path: `/apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - Task: Implement token refresh detection and handling for long chat sessions
  - Code changes:
    - Add useEffect to monitor token expiration
    - Call refreshSession when token is close to expiration
    - Handle any errors during refresh

- [x] **1.3 Update LangGraph API proxy to forward auth headers**
  - Path: `/apps/web/app/api/langgraph/[...path]/route.ts`
  - Task: Ensure auth headers are properly forwarded to the LangGraph backend
  - Code changes:
    - Modify initApiPassthrough configuration to forward auth headers

### Success Criteria for Phase 1:

- StreamProvider successfully connects to LangGraph API with authentication token
- Token refresh happens automatically when needed
- API proxy correctly forwards authentication headers to backend

## Phase 2: LangGraph Authentication Handler (Backend)

Implement a custom authentication handler for LangGraph based on the official LangGraph.js custom auth pattern.

### Steps:

- [x] **2.1 Create custom auth handler**

  - Path: `/apps/backend/lib/middleware/langraph-auth.ts`
  - Task: Create a middleware that validates JWT tokens from Supabase
  - Code changes:
    - Create validateToken function to verify Supabase JWT
    - Implement getUserFromToken for extracting user information
    - Export handler with authentication logic

- [x] **2.2 Update LangGraph server configuration**

  - Path: `/apps/backend/lib/supabase/langgraph-server.ts`
  - Task: Configure LangGraph server to use custom auth handler
  - Code changes:
    - Import auth handler from middleware
    - Update LangGraphServer configuration with custom auth
    - Configure auth to include userId and owner metadata

- [x] **2.3 Implement token validation utility**
  - Path: `/apps/backend/lib/supabase/auth-utils.ts`
  - Task: Create utility to validate Supabase tokens
  - Code changes:
    - Create function to decode and verify JWT tokens
    - Integrate with Supabase JWT verification
    - Handle token expiration and validation errors

### Success Criteria for Phase 2:

- Custom auth handler correctly validates Supabase tokens
- LangGraph server configuration uses custom auth handler
- All LangGraph requests require valid authentication
- Auth state correctly propagates to the graph execution

## Phase 3: Thread Management

Focus on correctly handling the transition from dashboard to chat interface with proper thread initialization.

### Steps:

- [ ] **3.1 Create thread management API endpoint**

  - Path: `/apps/web/app/api/threads/route.ts`
  - Task: Create an API endpoint to get or create threadId based on rfpId
  - Code changes:
    - Create new GET endpoint that accepts rfpId parameter
    - Implement logic to fetch existing threadId or create new one
    - Return threadId and isNew flag

- [ ] **3.2 Update ChatPage to fetch threadId**

  - Path: `/apps/web/app/dashboard/chat/page.tsx`
  - Task: Modify ChatPage to fetch threadId for the given rfpId before rendering
  - Code changes:
    - Add loading state
    - Fetch threadId from API when rfpId is available
    - Pass threadId to ThreadProvider

- [ ] **3.3 Update ThreadProvider to accept initial threadId**
  - Path: `/apps/web/src/features/chat-ui/providers/ThreadProvider.tsx`
  - Task: Modify ThreadProvider to initialize with the provided threadId
  - Code changes:
    - Update parameter to accept initialThreadId
    - Set active thread based on initialThreadId when provided

### Success Criteria for Phase 3:

- Clicking "Continue in Chat" from a proposal card successfully loads the correct thread
- New threads are created for proposals without existing threads
- Existing threads are reused for proposals with previous conversations

## Phase 4: User-Thread Relationship

Focus on ensuring threads are properly associated with users and access control is enforced.

### Steps:

- [ ] **4.1 Update ThreadProvider to filter threads by user**

  - Path: `/apps/web/src/features/chat-ui/providers/ThreadProvider.tsx`
  - Task: Modify thread listing to only show threads belonging to the current user
  - Code changes:
    - Use userId from session to filter threads
    - Update thread fetching to include user filter

- [ ] **4.2 Add userId to thread creation**

  - Path: `/apps/web/app/api/threads/route.ts`
  - Task: Ensure userId is included when creating new threads
  - Code changes:
    - Extract userId from authentication context
    - Pass userId to thread creation function

- [ ] **4.3 Update OrchestratorService to store userId in thread state**

  - Path: `/apps/backend/services/orchestrator.service.ts`
  - Task: Ensure userId is stored in thread state for access control
  - Code changes:
    - Verify startProposalGeneration includes userId in initialState
    - Add any missing userId assignment

- [ ] **4.4 Implement access control in thread operations**
  - Path: `/apps/backend/services/checkpointer.service.ts`
  - Task: Add user validation to checkpoint operations
  - Code changes:
    - Update get/put methods to verify user ownership
    - Implement filtering based on authContext

### Success Criteria for Phase 4:

- Users only see their own threads in the ThreadHistory component
- All new threads are correctly associated with the creating user
- Thread state includes userId for access control purposes
- Users cannot access threads they do not own

## Phase 5: Error Handling and Testing

Focus on robust error handling and comprehensive testing of the integration.

### Steps:

- [ ] **5.1 Add error handling to ChatPage**

  - Path: `/apps/web/app/dashboard/chat/page.tsx`
  - Task: Implement error handling for thread loading failures
  - Code changes:
    - Add error state
    - Display error message when thread fails to load
    - Provide retry option

- [ ] **5.2 Add loading state to Thread component**

  - Path: `/apps/web/src/features/chat-ui/components/Thread.tsx`
  - Task: Show loading indicator while thread is initializing
  - Code changes:
    - Add loading state based on StreamProvider status
    - Display loading indicator when appropriate

- [ ] **5.3 Add authentication error handling to LangGraph client**

  - Path: `/apps/web/src/features/chat-ui/lib/client.ts`
  - Task: Handle authentication errors from LangGraph API
  - Code changes:
    - Add auth error detection
    - Implement redirect to login on auth failures
    - Add retry with new token logic

- [ ] **5.4 Create integration test for auth flow**

  - Path: `/apps/web/__tests__/chat-ui/auth-integration.test.tsx`
  - Task: Create test for authentication integration
  - Code changes:
    - Test successful authentication
    - Test token refresh
    - Test error handling

- [ ] **5.5 Add backend authentication tests**
  - Path: `/apps/backend/lib/middleware/__tests__/langraph-auth.test.ts`
  - Task: Test custom auth handler
  - Code changes:
    - Test token validation
    - Test user extraction
    - Test error handling

### Success Criteria for Phase 5:

- Error scenarios are handled gracefully with clear user feedback
- Loading states are shown appropriately during initialization
- Unauthenticated users are redirected to login
- Integration tests confirm end-to-end functionality
- Authentication errors are properly handled and communicated to users

## Overall Success Criteria

The integration is considered complete when:

1. Users can seamlessly transition from dashboard to chat with correct authentication
2. RFP ID is properly passed and converted to the correct thread ID
3. Users only see and access their own threads
4. LangGraph executes with proper authentication context
5. Error scenarios are handled gracefully
6. All tests pass consistently

## Implementation Timeline

- Phase 1: 2 days
- Phase 2: 2 days
- Phase 3: 3 days
- Phase 4: 2 days
- Phase 5: 3 days

Total: 12 working days
Target Completion: July 5, 2024
