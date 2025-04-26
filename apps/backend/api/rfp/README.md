# RFP API Services

## Overview

This directory contains the API endpoints for the Request for Proposal (RFP) processing system. It provides routes for starting proposal generation, checking interrupt status, submitting user feedback, and resuming generation after feedback.

## Services Architecture

The API follows a factory pattern with three main components:

1. **Express Routers**: Handle HTTP requests/responses and input validation
2. **Orchestrator Service**: Central coordinator that manages the proposal generation workflow
3. **LangGraph Integration**: Stateful workflows using a persistent checkpointer

## API Endpoints

### GET /rfp/interrupt-status

Checks if a proposal generation process has been interrupted and needs user feedback.

**Query Parameters:**

- `proposalId` (required): ID of the proposal to check

**Response:**

```json
{
  "success": true,
  "interrupted": true,
  "interruptData": {
    "nodeId": "evaluateResearchNode",
    "reason": "Research evaluation requires user review",
    "contentReference": "research",
    "timestamp": "2023-06-15T14:30:00.000Z",
    "evaluationResult": {
      /* evaluation details */
    }
  }
}
```

### POST /rfp/chat

Handles chat messages for a proposal, processes them through the orchestrator, and returns AI responses.

**Request Body:**

```json
{
  "threadId": "abc123", // Required: The thread ID of the proposal
  "message": "How can I improve the methodology section?" // Required: The user message
}
```

**Response:**

```json
{
  "response": "The methodology section would benefit from more detail on data collection methods...",
  "commandExecuted": false
}
```

**Response Headers:**

The endpoint may include the following authentication-related headers:

- `X-Token-Refresh-Recommended`: Set to `"true"` when the JWT token is nearing expiration (typically within 10 minutes)

This header allows clients to proactively refresh tokens before they expire, preventing disruption to user sessions.

### POST /rfp/feedback

Submits user feedback during an interrupt for content review.

**Request Body:**

```json
{
  "proposalId": "abc123",
  "feedbackType": "approve", // One of: "approve", "revise", "regenerate"
  "contentRef": "research", // Optional: Specific content being referenced
  "comment": "The research looks good, proceed with the next step." // Optional
}
```

**Response:**

```json
{
  "success": true
}
```

### POST /rfp/resume

Resumes proposal generation after feedback has been processed.

**Request Body:**

```json
{
  "proposalId": "abc123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Proposal generation resumed",
  "resumeStatus": {
    "success": true,
    "message": "Graph execution resumed successfully",
    "status": "running"
  }
}
```

## Developer Guide

### Instantiating the Orchestrator

Always use the `getOrchestrator` factory function to obtain an instance of the Orchestrator service:

```typescript
import { getOrchestrator } from "../../../services/orchestrator-factory.js";

// Later in your code:
const orchestrator = getOrchestrator(proposalId);
```

### HITL Workflow

Human-in-the-Loop workflow follows this sequence:

1. **Interrupt Detection**:
   - Call `orchestrator.getInterruptStatus(proposalId)` to check if user input is needed
2. **Feedback Submission**:
   - Call `orchestrator.submitFeedback({ proposalId, feedbackType, contentRef, comment })`
   - `feedbackType` can be "approve", "revise", or "regenerate"
3. **Resume Generation**:
   - Call `orchestrator.resumeAfterFeedback(proposalId)` to continue processing

### Token Refresh Handling

Our API endpoints support token refresh detection and notification through response headers:

#### Server-side (Route Handlers)

Route handlers check for token expiration information from the auth middleware:

```typescript
// Example route handler implementation
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    // If token is nearing expiration (set by auth middleware)
    if (req.tokenRefreshRecommended === true) {
      // Set header to inform client to refresh token
      res.setHeader("X-Token-Refresh-Recommended", "true");
      logger.info(`Token refresh recommended for user ${req.user?.id}`);
    }

    // Process the request...
  } catch (error) {
    // Error handling...
  }
});
```

#### Client-side (Frontend)

Clients should implement interceptors to handle token refresh:

```typescript
// Example Axios interceptor for handling token refresh
axios.interceptors.response.use(
  (response) => {
    // Check for token refresh recommendation
    if (response.headers["x-token-refresh-recommended"] === "true") {
      // Refresh token proactively
      refreshToken().catch(console.error);
    }
    return response;
  },
  async (error) => {
    // Handle 401 with refresh_required flag
    if (
      error.response?.status === 401 &&
      error.response?.data?.refresh_required
    ) {
      try {
        // Refresh token
        await refreshToken();

        // Retry the original request with new token
        const originalRequest = error.config;
        return axios(originalRequest);
      } catch (refreshError) {
        // Handle refresh failure (e.g., redirect to login)
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  }
);

// Function to refresh token using Supabase
async function refreshToken() {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return data;
}
```

### Error Handling

All service methods should be wrapped in try/catch blocks. Standard error responses:

```typescript
try {
  // Service calls
} catch (error) {
  logger.error("Error message:", error);
  return res.status(500).json({ error: "Descriptive error message" });
}
```

### Validation

All endpoints use Zod for request validation:

```typescript
const validationResult = mySchema.safeParse(req.body);

if (!validationResult.success) {
  logger.warn("Invalid request:", validationResult.error);
  return res.status(400).json({
    error: "Invalid request",
    details: validationResult.error.format(),
  });
}
```

## Testing

API endpoints can be tested using Supertest. See the `__tests__` directory for examples.

### Testing Token Refresh

To test token refresh functionality:

1. Create a middleware that simulates the auth middleware's token expiration properties
2. Test that routes correctly set the `X-Token-Refresh-Recommended` header when appropriate
3. Verify headers are not set when token refresh is not needed

Example test:

```typescript
it("should include X-Token-Refresh-Recommended header when token refresh is recommended", async () => {
  // Create test server with middleware that sets refresh flag
  const testApp = express();
  testApp.use(express.json());

  testApp.use((req, res, next) => {
    // Simulate auth middleware setting token expiration metadata
    req.user = { id: "test-user-123" };
    req.tokenExpiresIn = 300; // 5 minutes left
    req.tokenRefreshRecommended = true;
    next();
  });

  // Mount router under test
  testApp.use("/api/rfp/chat", chatRouter);

  // Send test request
  const response = await request(testApp).post("/api/rfp/chat").send({
    threadId: "test-thread-id",
    message: "Test message",
  });

  // Verify header is present
  expect(response.status).toBe(200);
  expect(response.headers).toHaveProperty("x-token-refresh-recommended");
  expect(response.headers["x-token-refresh-recommended"]).toBe("true");
});
```
