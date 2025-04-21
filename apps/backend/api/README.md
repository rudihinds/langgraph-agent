# Express API for Proposal Generator

This directory contains the Express API implementation for the Proposal Generator backend. The API handles all interactions with the frontend, managing proposal generation, feedback, and state management.

## API Structure

The Express API is organized in a modular structure:

- `express-server.ts` - Main server entry point that configures and exports the Express application (this is the file that should be used)
- `index.ts` - Initializes the base Express app and mounts the RFP router
- `/rfp` - Directory containing all RFP-related endpoints
  - `start.ts` - Start proposal generation endpoint
  - `resume.ts` - Resume proposal generation endpoint
  - `feedback.ts` - Submit feedback endpoint
  - `parse.ts` - Document parsing endpoint
  - `interrupt-status.ts` - Check interrupt status endpoint
  - `index.ts` - Router configuration that imports the individual route handlers

## Available Endpoints

### Proposal Generation

- **POST `/api/rfp/start`** - Start a new proposal generation process
  - Request: RFP content (string or structured object)
  - Response: Thread ID and initial state

### Human-in-the-Loop (HITL) Controls

- **GET `/api/rfp/interrupt-status`** - Check if a proposal is awaiting user input

  - Request: Thread ID
  - Response: Interrupt status and details

- **POST `/api/rfp/feedback`** - Submit user feedback for interrupted proposal

  - Request: Thread ID, feedback type, comments
  - Response: Status update

- **POST `/api/rfp/resume`** - Resume proposal generation after feedback
  - Request: Thread ID
  - Response: Status update

## Authentication

Authentication is handled via Supabase Auth, with the user ID optionally passed to proposal generation.

## State Management

All state is managed by the LangGraph checkpointer, with the Express API acting as a communication layer between the frontend and the orchestrator service.

## Request/Response Examples

### Start Proposal

```typescript
// Request
POST /api/rfp/start
{
  "rfpContent": "RFP content as string...",
  "userId": "user-123" // Optional
}

// OR structured format
{
  "title": "Project Title",
  "description": "Project description...",
  "sections": ["executive_summary", "problem_statement", "..."],
  "requirements": ["Requirement 1", "..."],
  "userId": "user-123" // Optional
}

// Response
{
  "threadId": "proposal-uuid",
  "state": { /* Initial proposal state */ }
}
```

### Check Interrupt Status

```typescript
// Request
GET /api/rfp/interrupt-status?threadId=proposal-uuid

// Response
{
  "interrupted": true,
  "interruptData": {
    "nodeId": "evaluateResearchNode",
    "reason": "Requires human review",
    "contentReference": "research",
    "timestamp": "2023-01-01T12:00:00Z",
    "evaluationResult": { /* ... */ }
  }
}
```

## Migrating from Next.js API Routes

This Express API implementation replaces the previous Next.js API routes. Key differences:

1. Express uses standard request/response objects instead of Next.js's `NextRequest`/`NextResponse`
2. Route handlers are explicitly registered via router methods vs. Next.js's file-based routing
3. Express middleware pattern for auth, validation, and error handling

## Error Handling

The API implements standardized error handling:

1. Validation errors return 400 status with error details
2. Server errors return 500 status with error message
3. All errors are logged via the Logger utility

## TODOs

- [ ] Add comprehensive request validation with Zod
- [ ] Implement rate limiting for production
- [ ] Add OpenAPI/Swagger documentation
- [ ] Add proper authentication middleware
- [ ] Implement more granular error status codes
- [ ] Add health check endpoint
- [ ] Implement API versioning
- [ ] Add telemetry and performance monitoring
