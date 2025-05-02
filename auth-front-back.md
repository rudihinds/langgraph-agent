# Authentication and Thread Handoff Integration Plan

This document outlines the steps required to complete the integration between the frontend authentication system and the backend LangGraph API, ensuring proper session management and thread handoff from dashboard to chat interface.

## Overview

The plan consists of four phases:

1. Authentication Integration
2. Thread Management
3. User-Thread Relationship
4. Error Handling and Testing

Each phase builds on the previous one and contains specific tasks with file paths that need to be updated.

## Phase 1: Authentication Integration

Focus on connecting our Supabase authentication system to the LangGraph client through the StreamProvider.

### Steps:

- [ ] **1.1 Update StreamProvider to use session token**

  - Path: `/apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - Task: Modify StreamProvider to extract the auth token from our session and pass it to the LangGraph client
  - Code changes:
    - Import useSession hook
    - Extract access_token from session
    - Pass token to createClient

- [ ] **1.2 Add token refresh handling**

  - Path: `/apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - Task: Implement token refresh detection and handling for long chat sessions
  - Code changes:
    - Add useEffect to monitor token expiration
    - Call refreshSession when token is close to expiration
    - Handle any errors during refresh

- [ ] **1.3 Update LangGraph API proxy to forward auth headers**
  - Path: `/apps/web/app/api/langgraph/[...path]/route.ts`
  - Task: Ensure auth headers are properly forwarded to the LangGraph backend
  - Code changes:
    - Modify initApiPassthrough configuration to forward auth headers

### Success Criteria for Phase 1:

- StreamProvider successfully connects to LangGraph API with authentication token
- Token refresh happens automatically when needed
- API proxy correctly forwards authentication headers to backend

## Phase 2: Thread Management

Focus on correctly handling the transition from dashboard to chat interface with proper thread initialization.

### Steps:

- [ ] **2.1 Create thread management API endpoint**

  - Path: `/apps/web/app/api/threads/route.ts`
  - Task: Create an API endpoint to get or create threadId based on rfpId
  - Code changes:
    - Create new GET endpoint that accepts rfpId parameter
    - Implement logic to fetch existing threadId or create new one
    - Return threadId and isNew flag

- [ ] **2.2 Update ChatPage to fetch threadId**

  - Path: `/apps/web/app/dashboard/chat/page.tsx`
  - Task: Modify ChatPage to fetch threadId for the given rfpId before rendering
  - Code changes:
    - Add loading state
    - Fetch threadId from API when rfpId is available
    - Pass threadId to ThreadProvider

- [ ] **2.3 Update ThreadProvider to accept initial threadId**
  - Path: `/apps/web/src/features/chat-ui/providers/ThreadProvider.tsx`
  - Task: Modify ThreadProvider to initialize with the provided threadId
  - Code changes:
    - Update parameter to accept initialThreadId
    - Set active thread based on initialThreadId when provided

### Success Criteria for Phase 2:

- Clicking "Continue in Chat" from a proposal card successfully loads the correct thread
- New threads are created for proposals without existing threads
- Existing threads are reused for proposals with previous conversations

## Phase 3: User-Thread Relationship

Focus on ensuring threads are properly associated with users and access control is enforced.

### Steps:

- [ ] **3.1 Update ThreadProvider to filter threads by user**

  - Path: `/apps/web/src/features/chat-ui/providers/ThreadProvider.tsx`
  - Task: Modify thread listing to only show threads belonging to the current user
  - Code changes:
    - Use userId from session to filter threads
    - Update thread fetching to include user filter

- [ ] **3.2 Add userId to thread creation**

  - Path: `/apps/web/app/api/threads/route.ts`
  - Task: Ensure userId is included when creating new threads
  - Code changes:
    - Extract userId from authentication context
    - Pass userId to thread creation function

- [ ] **3.3 Update OrchestratorService to store userId in thread state**
  - Path: `/apps/backend/services/OrchestratorService.ts`
  - Task: Ensure userId is stored in thread state for access control
  - Code changes:
    - Verify startProposalGeneration includes userId in initialState
    - Add any missing userId assignment

### Success Criteria for Phase 3:

- Users only see their own threads in the ThreadHistory component
- All new threads are correctly associated with the creating user
- Thread state includes userId for access control purposes

## Phase 4: Error Handling and Testing

Focus on robust error handling and comprehensive testing of the integration.

### Steps:

- [ ] **4.1 Add error handling to ChatPage**

  - Path: `/apps/web/app/dashboard/chat/page.tsx`
  - Task: Implement error handling for thread loading failures
  - Code changes:
    - Add error state
    - Display error message when thread fails to load
    - Provide retry option

- [ ] **4.2 Add loading state to Thread component**

  - Path: `/apps/web/src/features/chat-ui/components/Thread.tsx`
  - Task: Show loading indicator while thread is initializing
  - Code changes:
    - Add loading state based on StreamProvider status
    - Display loading indicator when appropriate

- [ ] **4.3 Add authentication check to ChatPage**

  - Path: `/apps/web/app/dashboard/chat/page.tsx`
  - Task: Redirect unauthenticated users to login page
  - Code changes:
    - Add authentication check
    - Redirect to login if user is not authenticated

- [ ] **4.4 Create integration test for auth flow**
  - Path: `/apps/web/src/__tests__/chat-ui/auth-integration.test.tsx`
  - Task: Create test for authentication integration
  - Code changes:
    - Test successful authentication
    - Test token refresh
    - Test error handling

### Success Criteria for Phase 4:

- Error scenarios are handled gracefully with clear user feedback
- Loading states are shown appropriately during initialization
- Unauthenticated users are redirected to login
- Integration tests confirm end-to-end functionality

## Overall Success Criteria

The integration is considered complete when:

1. Users can seamlessly transition from dashboard to chat with correct authentication
2. RFP ID is properly passed and converted to the correct thread ID
3. Users only see and access their own threads
4. Error scenarios are handled gracefully
5. All tests pass consistently

## Implementation Timeline

- Phase 1: 2 days
- Phase 2: 3 days
- Phase 3: 2 days
- Phase 4: 3 days

Total: 10 working days
Target Completion: June 30, 2024
