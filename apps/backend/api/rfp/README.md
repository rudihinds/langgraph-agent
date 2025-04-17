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
