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

Focus on correctly handling the transition from dashboard to chat interface with proper thread initialization and management, aligned with LangGraph's authentication model.

### Steps:

- [x] **3.1 Enhance auth handler with thread-specific filtering**

  - Path: `/apps/backend/lib/middleware/langraph-auth.ts`
  - Task: Update the existing auth handler to add thread management-specific filters
  - Code changes:
    - Add a specific handler for the new thread-to-RFP mapping resource
    - Configure proper filtering and access control for thread mappings
    - Ensure proper owner metadata is added to resources
    - Implement resource filtering based on thread ownership

- [x] **3.2 Create thread-to-RFP mapping table in Supabase**

  - Path: `/apps/backend/lib/supabase/migrations/thread-rfp-mapping.sql`
  - Task: Create a migration SQL file that properly maps RFP IDs to thread IDs
  - Code changes:
    - Create `proposal_thread_mappings` table with indexing
    - Implement RLS policies for tenant isolation and authentication
    - Add database functions for thread management operations
    - Store user ID and RFP ID and thread ID relationships

- [x] **3.3 Create thread management service**

  - Path: `/apps/backend/services/thread.service.ts`
  - Task: Create service to handle all thread operations
  - Code changes:
    - Implement functions to get, create and delete thread mappings
    - Ensure all operations include owner metadata for auth filtering
    - Integrate with Supabase client using the authenticated user context
    - Follow LangGraph authentication patterns

- [x] **3.4 Create thread management API**

  - Path: `/apps/backend/api/rfp/thread.ts`
  - Task: Create API endpoints for thread management
  - Code changes:
    - Create endpoints for getting, creating and deleting thread mappings
    - Ensure all operations are properly authenticated
    - Return thread ID and is_new flag for client handling
    - Implement proper error handling and validation

- [x] **3.5 Create frontend thread management hook**

  - Path: `/apps/web/src/features/rfp/hooks/useRfpThread.ts`
  - Task: Create a hook to manage threads from the frontend
  - Code changes:
    - Implement functions to get or create threads for an RFP
    - Add helper for thread initialization during chat interaction
    - Integrate with authentication and API error handling
    - Add caching to prevent unnecessary API calls

- [x] **3.6 Enhance chat UI to use thread management**

  - Path: `/apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - Task: Update the stream provider to use thread management
  - Code changes:
    - Initialize a thread ID before starting the chat
    - Pass the thread ID to the API
    - Handle new vs. existing thread scenarios differently
    - Update UI states based on thread status

- [x] **3.7 Implement frontend-backend resilience**

  - Path: Multiple files
  - Task: Enhance error handling and add fallback mechanisms when backend is unavailable
  - Code changes:
    - Create mock implementation of auth-client.ts
    - Add simplified useSession hook
    - Implement API proxy routes with fallback data
    - Add retry mechanisms with limits to prevent infinite loops
    - Add proper error boundaries in API routes
    - Improve StreamProvider to handle errors gracefully
    - Add timeout handling to prevent hanging requests

- [ ] **3.8 Update LangGraph server integration**

  - Path: `/apps/backend/lib/supabase/langgraph-server.ts`
  - Task: Ensure thread creation, state management, and proposal mapping work together
  - Code changes:
    - Use the thread ID for consistent authentication handling
    - Use the thread ID for state persistence
    - Add proper error handling for invalid or missing thread IDs
    - Implement interrupts and resume functionality correctly

### Authentication Flow:

1. **Client obtains thread ID via API:**

   - Frontend gets or creates thread via `/api/rfp/thread/:rfpId`
   - API authenticates the request via JWT token and user ID
   - API returns a thread ID and isNew flag

2. **Client uses thread ID with LangGraph:**

   - Frontend passes thread ID to LangGraph client
   - LangGraph server uses custom Auth class to validate the thread ID
   - Custom LangGraph Auth implementation filters resources by owner

3. **Resource-level permissions:**
   - Owner field added to all checkpoints and threads
   - LangGraph Auth validator returns proper filtering predicates
   - Resources filtered at runtime by the LangGraph server

### Resilience Mechanisms:

1. **API Fallback Strategy**:

   - All API routes include fallback mechanisms when backend is unavailable
   - Timeout parameters prevent hanging requests
   - Mock data returned when backend is unreachable
   - Clear error messages shown to users with retry options

2. **Client-Side Error Handling**:

   - Reference-based approach to prevent re-render loops
   - Exponential backoff for failed requests
   - Maximum retry limits to prevent infinite loops
   - Caching to prevent redundant API calls
   - State tracking to prevent redundant initializations

3. **Token Handling**:

   - Mock authentication for development/testing
   - Graceful handling of authentication errors
   - Timeout detection to prevent hanging on auth requests
   - Proper token refresh mechanics

4. **User Experience**:
   - Loading indicators for asynchronous operations
   - Clear error messages with retry options
   - Visual feedback for fallback mode
   - Graceful degradation when backend components are unavailable

### Security Considerations:

- Thread IDs are tightly controlled by the authentication system
- Database-level RLS ensures users can only access their own threads
- All operations are properly logged for audit purposes
- Error handling prevents invalid access to resources

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

- [x] **5.1 Add error handling to StreamProvider**

  - Path: `/apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - Task: Implement error handling for thread loading failures
  - Code changes:
    - Add error state
    - Display error message when thread fails to load
    - Provide retry option
    - Add maximum retry limit with exponential backoff

- [ ] **5.2 Add loading state to Thread component**

  - Path: `/apps/web/src/features/chat-ui/components/Thread.tsx`
  - Task: Show loading indicator while thread is initializing
  - Code changes:
    - Add loading state based on StreamProvider status
    - Display loading indicator when appropriate

- [x] **5.3 Add authentication error handling to API routes**

  - Path: `/apps/web/src/app/api/rfp/*`
  - Task: Handle authentication errors from backend API
  - Code changes:
    - Add proper error boundaries
    - Add timeout handling to prevent hanging requests
    - Implement fallback mechanisms when backend is unavailable
    - Add clear error responses with retry information

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
- Application functions in development mode even with limited backend availability

## Overall Success Criteria

The integration is considered complete when:

1. Users can seamlessly transition from dashboard to chat with correct authentication
2. RFP ID is properly passed and converted to the correct thread ID
3. Users only see and access their own threads
4. LangGraph executes with proper authentication context
5. Error scenarios are handled gracefully
6. Application is resilient to backend availability issues
7. All tests pass consistently

## Implementation Timeline

- Phase 1: 2 days
- Phase 2: 2 days
- Phase 3: 4 days (1 extra day for resilience implementation)
- Phase 4: 2 days
- Phase 5: 3 days

Total: 13 working days
Target Completion: July 6, 2024
