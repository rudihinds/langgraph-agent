# Chat UI Integration Test Cases

## Project Paths

- **Project Root**: `/Users/rudihinds/code/langgraph-agent`
- **Web App Frontend**: `/Users/rudihinds/code/langgraph-agent/apps/web`
- **Backend App**: `/Users/rudihinds/code/langgraph-agent/apps/backend`
- **Chat UI Source**: `../agent-chat-ui`
- **Web API Routes**: `/Users/rudihinds/code/langgraph-agent/apps/web/app/api`
- **Backend API Routes**: `/Users/rudihinds/code/langgraph-agent/apps/backend/api`
- **Integration Target Directory**: `/Users/rudihinds/code/langgraph-agent/apps/web/src/components/chat-ui`
- **Page Route Target**: `/Users/rudihinds/code/langgraph-agent/apps/web/src/app/(dashboard)/chat`
- **Test Directory**: `/Users/rudihinds/code/langgraph-agent/apps/web/src/__tests__/chat-ui`
- **API Proxy Path**: `/Users/rudihinds/code/langgraph-agent/apps/web/app/api/langgraph/[...path]/route.ts`

## Implementation Progress

**Overall Progress: Phase 2 Completed**

We've successfully implemented the core Chat UI components extracted from the agent-chat-ui template. The components include the Thread display, message rendering (human and AI messages), and state management providers (Stream and Thread). All tests for the implemented components are passing. Next steps include authentication integration and backend connectivity.

### Phase 1: Environment Setup and Dependencies

- [ ] Install required dependencies
- [x] Create test infrastructure
- [ ] Update environment variables
- [x] Set up API proxy for LangGraph

### Phase 2: Core Component Extraction

- [x] Create directory structure
- [x] Extract and adapt Thread component
- [x] Extract message components
  - [x] Human message component
  - [x] AI message component
  - [x] Loading state component
- [x] Extract provider components
  - [x] Stream provider
  - [x] Thread provider
- [x] Create Chat page component

### Phase 3: Authentication Integration

- [ ] Update StreamProvider to use our auth system
- [ ] Adapt chat API proxy for auth
- [ ] Integrate auth interceptor with fetch requests

### Phase 4: Navigation and Routing Integration

- [ ] Add chat navigation to sidebar
- [ ] Create link from dashboard proposals to chat
- [ ] Handle existing proposal navigation in Chat page
- [ ] Update StreamProvider to accept RFP ID

### Phase 5: Backend Integration

- [ ] Update LangGraph backend to handle RFP IDs
- [ ] Update document loading to use RFP ID
- [ ] Ensure API endpoints support Chat UI request formats

### Phase 6: Testing and Refinement

- [ ] Test starting a new chat thread
- [ ] Test continuing an existing proposal
- [ ] Test authentication flow
- [ ] Test token refresh
- [ ] Test mobile responsiveness

## 1. Test Strategy Overview

### Core Functionality to be Tested

- Chat UI component rendering and behavior
- Thread management and persistence
- Authentication integration with existing auth system
- Navigation and routing between dashboard and Chat UI
- API communication with LangGraph backend
- RFP document integration with Chat UI
- User interaction patterns and workflows
- Error handling and recovery

### Components/Modules Requiring Coverage

- Stream and Thread providers
- Thread component and message rendering
- API proxy for LangGraph
- Authentication interceptor integration
- Navigation components and routing
- Backend API endpoints for thread/RFP handling
- State management for chat sessions

### Testing Approach

| Test Type             | Purpose                                               | Tools                          |
| --------------------- | ----------------------------------------------------- | ------------------------------ |
| **Manual Testing**    | Verify UI appearance and interactions                 | Browser inspection, checklists |
| **Unit Tests**        | Test individual components and functions in isolation | Vitest, React Testing Library  |
| **Integration Tests** | Test interaction between components                   | Vitest, React Testing Library  |
| **API Tests**         | Verify API endpoints and communication                | Simple HTTP requests, console  |
| **Smoke Tests**       | Quick verification of critical paths                  | Manual browser testing         |

## 2. Test Cases by Implementation Phase

### Phase 1: Environment Setup and Dependencies

#### ENV-001: Environment Variable Configuration

- **Preconditions**: Fresh Next.js application setup
- **Test Steps**:
  1. Set required environment variables for LangGraph integration
  2. Initialize the application
- **Expected Outcome**: Application loads without environment-related errors
- **Test Data**: Sample environment variables for testing

#### ENV-002: API Proxy Configuration

- **Preconditions**: Next.js API routes configured
- **Test Steps**:
  1. Set up API proxy route for LangGraph
  2. Make a sample request to a LangGraph endpoint
- **Expected Outcome**: Request is properly forwarded to LangGraph backend
- **Test Data/Mocks**: Mock LangGraph response

#### ENV-003: Dependency Integration

- **Preconditions**: All required dependencies installed
- **Test Steps**:
  1. Import key components from dependencies
  2. Initialize components with minimal configuration
- **Expected Outcome**: Components render without errors
- **Test Data/Mocks**: Minimal configuration for each component

### Phase 2: Core Component Extraction

#### COMP-001: Thread Component Initialization

- **Status**: ✅ Completed
- **Preconditions**: Chat UI Thread component copied and adapted
- **Test Steps**:
  1. Render the Thread component with minimal props
  2. Verify all subcomponents are properly rendered
- **Expected Outcome**: Thread component renders without errors
- **Test Data/Mocks**: Empty thread state

#### COMP-002: Human Message Component Rendering

- **Status**: ✅ Completed
- **Preconditions**: Human Message component implemented
- **Test Steps**:
  1. Render the component with a sample message
  2. Verify message content is displayed correctly
- **Expected Outcome**: Message renders correctly with proper styling
- **Test Data/Mocks**: Sample human message object

#### COMP-003: AI Message Component Rendering

- **Status**: ✅ Completed
- **Preconditions**: AI Message component implemented
- **Test Steps**:
  1. Render the component with a sample message
  2. Verify message content is displayed correctly
  3. Test with different message types (text, tool calls)
- **Expected Outcome**: All message types render correctly
- **Test Data/Mocks**: Sample AI messages with different content types

#### COMP-004: Tool Calls Rendering

- **Status**: ⏳ Pending
- **Preconditions**: Tool Calls components implemented
- **Test Steps**:
  1. Render tool call component with sample tool call data
  2. Verify tool call visualization is correct
- **Expected Outcome**: Tool call is properly displayed with request and response
- **Test Data/Mocks**: Sample tool call data

#### COMP-005: Thread Provider State Management

- **Status**: ✅ Completed
- **Preconditions**: ThreadProvider component implemented
- **Test Steps**:
  1. Initialize ThreadProvider with mock state
  2. Access thread state via context hook
  3. Perform operations that modify thread state
- **Expected Outcome**: State is properly managed and updated
- **Test Data/Mocks**: Mock thread state data

#### COMP-006: Stream Provider Initialization

- **Status**: ✅ Completed
- **Preconditions**: StreamProvider component implemented
- **Test Steps**:
  1. Initialize StreamProvider with mock configuration
  2. Test access to stream methods via context hook
- **Expected Outcome**: Stream provider initializes with correct configuration
- **Test Data/Mocks**: Mock stream configuration

### Phase 3: Authentication Integration

#### AUTH-001: Authentication Token Passing

- **Preconditions**: Auth interceptor integrated with Chat UI
- **Test Steps**:
  1. Initialize Chat UI with authenticated session
  2. Make request to LangGraph backend
  3. Inspect request headers in browser dev tools
- **Expected Outcome**: Authentication token is properly included in request
- **Test Data/Mocks**: Valid authentication token

#### AUTH-002: Token Refresh Handling

- **Preconditions**: Auth interceptor with token refresh capability
- **Test Steps**:
  1. Simulate expired token scenario
  2. Trigger a request to LangGraph backend
  3. Verify token refresh is attempted (via console logs)
  4. Verify original request is retried with new token
- **Expected Outcome**: Token is refreshed and request succeeds
- **Test Data/Mocks**: Expired token and refresh token responses

#### AUTH-003: API Proxy Authentication Forwarding

- **Preconditions**: API proxy route configured with auth handling
- **Test Steps**:
  1. Make authenticated request to proxy endpoint
  2. Verify token is forwarded to backend using console logs
- **Expected Outcome**: Authentication headers correctly passed to backend
- **Test Data/Mocks**: Valid authentication token

#### AUTH-004: Unauthenticated Access Handling

- **Preconditions**: Authentication integration complete
- **Test Steps**:
  1. Attempt to access Chat UI without authentication
  2. Verify appropriate redirect or error
- **Expected Outcome**: User is redirected to login or shown appropriate error
- **Test Data/Mocks**: None

### Phase 4: Navigation and Routing Integration

#### NAV-001: Sidebar Navigation Item

- **Preconditions**: Sidebar component with navigation items
- **Test Steps**:
  1. Render sidebar component
  2. Verify Chat navigation item exists
  3. Click on Chat navigation item
- **Expected Outcome**: Navigation item is visible and clicking navigates to Chat page
- **Test Data/Mocks**: Mock router

#### NAV-002: Proposal to Chat Navigation

- **Preconditions**: Proposal card with "Continue in Chat" button
- **Test Steps**:
  1. Render proposal card for existing proposal
  2. Click "Continue in Chat" button
  3. Verify navigation to Chat UI with correct parameters
- **Expected Outcome**: Navigation occurs with proposal ID in query parameters
- **Test Data/Mocks**: Sample proposal with ID

#### NAV-003: URL Parameter Handling

- **Preconditions**: Chat page component with URL parameter handling
- **Test Steps**:
  1. Navigate to Chat page with rfpId parameter
  2. Verify parameter is extracted and passed to StreamProvider
- **Expected Outcome**: URL parameter correctly extracted and used
- **Test Data/Mocks**: Sample rfpId

#### NAV-004: Deep Linking

- **Preconditions**: Chat UI with thread selection capability
- **Test Steps**:
  1. Navigate directly to a specific thread URL
  2. Verify correct thread is loaded
- **Expected Outcome**: Deep link loads the specified thread
- **Test Data/Mocks**: Valid thread ID

### Phase 5: Backend Integration

#### BACK-001: Thread Creation with RFP ID

- **Preconditions**: Backend API for thread creation
- **Test Steps**:
  1. Call API to create new thread with rfpId
  2. Verify thread is created with rfpId in its state
- **Expected Outcome**: New thread created with proper rfpId association
- **Test Data/Mocks**: Sample rfpId

#### BACK-002: Document Loading with RFP ID

- **Preconditions**: Document loader node implemented
- **Test Steps**:
  1. Initialize agent with rfpId
  2. Verify document loader correctly uses rfpId
  3. Check if document is properly loaded
- **Expected Outcome**: Document loaded using the provided rfpId
- **Test Data/Mocks**: Valid rfpId and corresponding document

#### BACK-003: API Format Compatibility

- **Preconditions**: Backend API endpoints implemented
- **Test Steps**:
  1. Send requests in the format expected by Chat UI
  2. Verify responses match Chat UI expectations
- **Expected Outcome**: API communication functions correctly
- **Test Data/Mocks**: Sample requests and responses

#### BACK-004: Thread State Persistence

- **Preconditions**: Checkpointing functionality implemented
- **Test Steps**:
  1. Create a thread and send messages
  2. Close and reopen the thread
  3. Verify message history is preserved
- **Expected Outcome**: Thread state persists between sessions
- **Test Data/Mocks**: Sample messages

### Phase 6: User Journeys and Interactions

#### JOUR-001: New Chat Thread Creation

- **Preconditions**: Chat UI fully integrated
- **Test Steps**:
  1. Navigate to Chat page
  2. Start a new conversation
  3. Send initial message
  4. Verify response and thread creation
- **Expected Outcome**: New thread created and conversation functions properly
- **Test Data/Mocks**: Sample user message

#### JOUR-002: Existing Proposal Continuation

- **Preconditions**: Chat UI with proposal continuation capability
- **Test Steps**:
  1. Navigate to existing proposal in dashboard
  2. Click "Continue in Chat" button
  3. Verify thread loads with proposal context
  4. Send a message and verify contextual response
- **Expected Outcome**: Existing proposal context is loaded and used for chat
- **Test Data/Mocks**: Existing proposal with rfpId

#### JOUR-003: Thread Switching

- **Preconditions**: Multiple existing threads
- **Test Steps**:
  1. Navigate to Chat UI
  2. Select a thread from the history panel
  3. Verify thread contents load correctly
  4. Switch to a different thread
  5. Verify the second thread loads correctly
- **Expected Outcome**: Thread switching works correctly
- **Test Data/Mocks**: Multiple sample threads

#### JOUR-004: Tool Call Interaction

- **Preconditions**: Agent with tool call capability
- **Test Steps**:
  1. Send a message that triggers a tool call
  2. Verify tool call visualization
  3. Verify tool execution and response
- **Expected Outcome**: Tool calls render and execute correctly
- **Test Data/Mocks**: Message that triggers tool call

### Phase 7: Error Handling and Edge Cases

#### ERR-001: Network Error Recovery

- **Preconditions**: Chat UI with network error handling
- **Test Steps**:
  1. Simulate network failure during message sending (using browser dev tools)
  2. Verify error is displayed to user
  3. Retry sending message after connection is restored
- **Expected Outcome**: Error is handled gracefully with recovery option
- **Test Data/Mocks**: Simulated network failure

#### ERR-002: Invalid RFP ID Handling

- **Preconditions**: Chat UI with rfpId validation
- **Test Steps**:
  1. Navigate to Chat UI with invalid rfpId
  2. Verify appropriate error is shown
- **Expected Outcome**: Clear error message explaining the issue
- **Test Data/Mocks**: Invalid rfpId

#### ERR-003: Authentication Error Handling

- **Preconditions**: Authentication integration complete
- **Test Steps**:
  1. Simulate authentication token expiration
  2. Attempt to send a message
  3. Verify token refresh attempt
  4. Simulate refresh failure
  5. Verify user is informed and prompted to log in again
- **Expected Outcome**: Authentication errors handled gracefully
- **Test Data/Mocks**: Expired token scenario

#### ERR-004: Empty or Long Messages

- **Preconditions**: Chat UI with message validation
- **Test Steps**:
  1. Try to send an empty message
  2. Try to send an extremely long message
- **Expected Outcome**: Appropriate validation feedback
- **Test Data/Mocks**: Empty and very long sample messages

#### ERR-005: Thread History Loading Failure

- **Preconditions**: Thread history feature implemented
- **Test Steps**:
  1. Simulate failure in loading thread history
  2. Verify error handling and user feedback
- **Expected Outcome**: Graceful error handling with retry option
- **Test Data/Mocks**: Simulated thread loading failure

## 3. Security and Performance Test Cases

### Security Test Cases

#### SEC-001: Authentication Token Protection

- **Preconditions**: Authentication integration complete
- **Test Steps**:
  1. Inspect network requests using browser dev tools to verify tokens are not leaked
  2. Check console logs for token exposure
- **Expected Outcome**: No tokens visible in network requests or logs
- **Test Data/Mocks**: Valid authentication tokens

#### SEC-002: API Access Control

- **Preconditions**: API proxy with authentication
- **Test Steps**:
  1. Attempt to access API endpoints without authentication
  2. Attempt to access another user's threads
- **Expected Outcome**: Proper 401/403 responses for unauthorized access
- **Test Data/Mocks**: Multiple user accounts

### Performance Test Cases

#### PERF-001: Basic Response Time Check

- **Preconditions**: Chat UI fully integrated
- **Test Steps**:
  1. Send a message and measure time until response appears
  2. Check that UI remains responsive during processing
- **Expected Outcome**: Response times are reasonable for a good user experience
- **Test Data/Mocks**: Simple test messages

## 4. Accessibility and Responsiveness

#### RESP-001: Basic Responsive Layout Check

- **Preconditions**: Chat UI with responsive design
- **Test Steps**:
  1. Manually resize browser window to different sizes
  2. Use browser dev tools to check mobile layouts
  3. Verify all functionality remains accessible
- **Expected Outcome**: UI adapts appropriately to different screen sizes
- **Test Data/Mocks**: None

## 5. Integration Test Matrix

| Component          | Authentication     | Navigation                | Backend            | Error Handling   |
| ------------------ | ------------------ | ------------------------- | ------------------ | ---------------- |
| Thread Component   | AUTH-001, AUTH-002 | NAV-001, NAV-002          | BACK-003           | ERR-001, ERR-004 |
| Stream Provider    | AUTH-001, AUTH-003 | NAV-003                   | BACK-001, BACK-004 | ERR-003          |
| Thread Provider    | -                  | NAV-004                   | BACK-004           | ERR-005          |
| API Proxy          | AUTH-003           | -                         | BACK-003           | ERR-001          |
| Chat Page          | AUTH-004           | NAV-001, NAV-002, NAV-003 | -                  | -                |
| Document Loader    | -                  | -                         | BACK-002           | ERR-002          |
| Message Components | -                  | -                         | -                  | ERR-004          |

## 6. Implementation Order Recommendation

Based on dependencies and component relationships, we recommend implementing tests in the following order:

1. Environment and dependency setup (ENV-001 to ENV-003)
2. Core UI components (COMP-001 to COMP-006)
3. Authentication integration (AUTH-001 to AUTH-004)
4. Navigation and routing (NAV-001 to NAV-004)
5. Backend integration (BACK-001 to BACK-004)
6. User journeys (JOUR-001 to JOUR-004)
7. Error handling (ERR-001 to ERR-005)
8. Security and performance checks (SEC-001 to PERF-001)

This order ensures that fundamental components are tested before more complex integrations, allowing for incremental development following TDD principles.
