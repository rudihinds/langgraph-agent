# Task 14.3: Configure HITL Interrupt Points and OrchestratorService Integration

## Overview

This plan outlines the implementation of Human-In-The-Loop (HITL) interrupt capabilities for the proposal generation graph and its integration with the OrchestratorService. This follows the architecture specified in AGENT_ARCHITECTURE.md and AGENT_BASESPEC.md.

## Implementation Details

### 1. HITL State Structure and Interface (2 days)

- [x] 1.1. Implement the state tracking for interrupts in `OverallProposalState`
  - Dependencies: None (Foundational task)
  - Status: COMPLETED. Successfully implemented the InterruptStatus interface with isInterrupted, interruptionPoint, feedback, and processingStatus properties.

```typescript
// In proposal.state.ts
type InterruptReason =
  | "EVALUATION_NEEDED"
  | "CONTENT_REVIEW"
  | "ERROR_OCCURRED";
type InterruptStatus =
  | "not_interrupted"
  | "awaiting_input"
  | "processing_feedback";

interface InterruptMetadata {
  reason: InterruptReason;
  nodeId: string;
  timestamp: string;
  contentReference?: string; // Section ID or content type being evaluated
  evaluationResult?: any;
}

interface UserFeedback {
  type: "approve" | "revise" | "regenerate";
  comments?: string;
  specificEdits?: Record<string, any>;
  timestamp: string;
}

// Add to OverallProposalState
export interface OverallProposalState {
  // Existing fields...
  interruptStatus: InterruptStatus;
  interruptMetadata?: InterruptMetadata;
  userFeedback?: UserFeedback;
  // Other existing fields...
}
```

- [x] 1.2. Implement appropriate state annotations and reducers for the new interrupt-related fields
  - Dependencies: 1.1 (Needs state interface defined first)
  - Status: COMPLETED. Successfully implemented interruptStatusReducer and associated annotations.

```typescript
// In modules/reducers.ts
export function interruptStatusReducer<
  T extends {
    isInterrupted: boolean;
    interruptionPoint: string | null;
    feedback: {
      type: any | null;
      content: string | null;
      timestamp: string | null;
    } | null;
    processingStatus: string | null;
  },
>(current: T, newValue: Partial<T> | undefined): T {
  if (!newValue) return current;

  // Handle partial updates to nested feedback object
  let updatedFeedback = current.feedback;
  if (newValue.feedback) {
    updatedFeedback = {
      ...(current.feedback || {
        type: null,
        content: null,
        timestamp: null,
      }),
      ...newValue.feedback,
    };
  }

  return {
    ...current,
    ...newValue,
    feedback: newValue.feedback === null ? null : updatedFeedback,
  } as T;
}

// In annotations.ts
export const OverallProposalStateAnnotation =
  Annotation.Root<OverallProposalState>({
    // Existing annotations...
    interruptStatus: Annotation<InterruptStatus>({
      default: () => ({
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      }),
      value: interruptStatusReducer,
    }),
    // Other annotations...
  });
```

### 2. Graph Configuration for Interrupts (1 day)

- [x] 2.1. Add interrupt points in `ProposalGenerationGraph` after each evaluation node as specified in AGENT_BASESPEC.md:

  - [x] 2.1.1. `evaluateResearchNode`
  - [x] 2.1.2. `evaluateSolutionNode`
  - [x] 2.1.3. `evaluateConnectionsNode`
  - [x] 2.1.4. Each `evaluate<Section>Node`
  - Dependencies: 1.1, 1.2 (State structure must be defined first)

- [x] 2.2. Configure the graph's `interruptAfter` list in `graph.compile()` to include these nodes
  - Dependencies: 2.1 (Interrupt points must be identified first)

### 3. OrchestratorService Integration (3 days)

- [x] 3.1. Extend the OrchestratorService to detect interrupts and manage state:

  - [x] 3.1.1. Detect when the graph has paused at an interrupt point
  - [x] 3.1.2. Retrieve the latest state via the Checkpointer
  - Dependencies: 1.1, 1.2, 2.2 (Requires state structure and graph configuration)
  - Status: COMPLETED. Successfully implemented methods for detecting and handling interrupts in the OrchestratorService, including detecting interrupt status, retrieving detailed interrupt data, and retrieving the relevant content being evaluated. All tests are passing.

- [x] 3.2. Implement user feedback submission and processing:

  - [x] 3.2.1. Provide methods for submitting user feedback
  - [x] 3.2.2. Update state with feedback information
  - Dependencies: 3.1 (Requires interrupt detection)
  - Status: COMPLETED. Successfully implemented `submitFeedback` method in OrchestratorService that validates feedback, updates the state, and prepares the content for processing with the correct status. Private helper method `updateContentStatus` handles different content types (research, solution, connections, and sections) intelligently.

- [x] 3.3. Implement graph resumption after feedback:
  - [x] 3.3.1. Prepare the state for UI presentation
  - [x] 3.3.2. Resume the graph with updated state after feedback
  - Dependencies: 3.2 (Requires feedback submission)
  - Status: COMPLETED. Successfully implemented `resumeAfterFeedback` method in OrchestratorService with proper error handling, which updates the state to indicate feedback processing is happening, then resumes the graph execution. API endpoints have been created for submitting feedback (`rfp/feedback.ts`) and resuming the graph (`rfp/resume.ts`).

### 4. Feedback Processing Nodes (2 days)

- [x] 4.1. Implement `processFeedbackNode` to route based on feedback type

  - Dependencies: 1.1, 1.2, 3.2 (Requires state structure and feedback submission)
  - Status: COMPLETED. Successfully implemented `processFeedbackNode` that processes user feedback and routes based on feedback type (approve, revise, regenerate). The node updates the appropriate content status and clears interrupt flags after feedback is processed. Also implemented the routing function `routeAfterFeedbackProcessing` to direct the flow based on the feedback type.

- [ ] 4.2. Implement node for handling content revisions via EditorAgent

  - Dependencies: 4.1 (Requires feedback processing)

- [ ] 4.3. Implement node for handling regeneration with user guidance
  - Dependencies: 4.1 (Requires feedback processing)

### 5. Graph Conditional Logic (1 day)

- [x] 5.1. Implement conditional edge functions for routing after feedback processing
  - Dependencies: 4.1, 4.2, 4.3 (Requires feedback processing nodes)
  - Status: COMPLETED. Successfully implemented routeAfterStaleContentChoice and other conditional routing functions with tests passing.

```typescript
// In conditionals.ts
export function routeAfterStaleContentChoice(
  state: OverallProposalState
): "regenerateStaleContent" | "useExistingContent" | "handleError" {
  logger.info("Routing after stale content choice");

  if (
    !state.interruptStatus ||
    !state.interruptStatus.feedback ||
    !state.interruptStatus.feedback.type
  ) {
    logger.error("No stale content choice found in state");
    return "handleError";
  }

  const choice = state.interruptStatus.feedback.type;
  logger.info(`User's stale content choice: ${choice}`);

  if (choice === "regenerate") {
    logger.info("User chose to regenerate stale content");
    return "regenerateStaleContent";
  } else if (choice === "approve") {
    logger.info("User chose to use existing content");
    return "useExistingContent";
  } else {
    logger.error(`Invalid stale content choice: ${choice}`);
    return "handleError";
  }
}
```

- [ ] 5.2. Add conditional routing based on feedback type to the graph
  - Dependencies: 5.1 (Requires routing functions)

### 6. API Endpoints (2 days)

- [ ] 6.1. Implement GET endpoint for proposal status
  - Dependencies: 3.1 (Requires OrchestratorService interrupt handling)

```typescript
// In api/proposals.routes.ts
// Get proposal status (including interrupt state)
router.get("/:threadId/status", async (req, res) => {
  try {
    const { threadId } = req.params;
    const state = await orchestratorService.getState(threadId);
    res.json(state);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to get proposal status" });
  }
});
```

- [ ] 6.2. Implement POST endpoint for feedback submission
  - Dependencies: 3.2 (Requires OrchestratorService feedback methods)

```typescript
// Submit feedback during interrupt
router.post("/:threadId/feedback", async (req, res) => {
  try {
    const { threadId } = req.params;
    const feedback = req.body;
    // Validate feedback with Zod schema
    // ...
    const updatedState = await orchestratorService.submitFeedback(
      threadId,
      feedback
    );
    res.json(updatedState);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});
```

- [ ] 6.3. Implement POST endpoint for resuming after feedback
  - Dependencies: 3.3, 6.2 (Requires resumption logic and feedback submission)

```typescript
// Resume after feedback
router.post("/:threadId/resume", async (req, res) => {
  try {
    const { threadId } = req.params;
    await orchestratorService.resumeAfterFeedback(threadId);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to resume processing" });
  }
});
```

### 7. Timeout Handling (1 day)

- [ ] 7.1. Implement timeout configuration in `config/settings.ts`
  - Dependencies: None (Independent configuration)

```typescript
// In config/settings.ts
export const HITL_SETTINGS = {
  interruptTimeoutMinutes: 1440, // 24 hours
  feedbackProcessingTimeoutMinutes: 5,
  // Other timeout settings
};
```

- [ ] 7.2. Add timeout handling for interrupts in OrchestratorService
  - Dependencies: 3.1, 7.1 (Requires interrupt handling and timeout config)

```typescript
// In orchestrator.service.ts
// Timeout checking logic for interrupts
private isInterruptTimedOut(state: OverallProposalState): boolean {
  if (state.interruptStatus !== 'awaiting_input' || !state.interruptMetadata?.timestamp) {
    return false;
  }

  const interruptTime = new Date(state.interruptMetadata.timestamp).getTime();
  const currentTime = Date.now();
  const timeoutMs = HITL_SETTINGS.interruptTimeoutMinutes * 60 * 1000;

  return (currentTime - interruptTime) > timeoutMs;
}
```

## Testing Strategy

### 8. Unit Tests

- [x] 8.1. Test state structure and reducers

  - Dependencies: 1.1, 1.2 (Requires state implementation)
  - Status: COMPLETED. Successfully implemented schema validation tests for interruptStatusSchema. All interruptStatusSchema tests are passing.

- [x] 8.2. Test interrupt-related node functions in isolation

  - Dependencies: 4.1, 4.2, 4.3 (Requires feedback processing implementation)
  - Status: COMPLETED. Successfully implemented tests for routeAfterStaleContentChoice and all tests are passing.

- [ ] 8.3. Test conditional routing functions with various state inputs

  - Dependencies: 5.1 (Requires routing functions)

- [ ] 8.4. Test timeout detection logic
  - Dependencies: 7.2 (Requires timeout implementation)

### 9. Integration Tests

- [ ] 9.1. Test the full interrupt cycle:
  - [ ] 9.1.1. Graph reaches evaluation node
  - [ ] 9.1.2. Interrupt occurs
  - [ ] 9.1.3. Orchestrator saves state correctly
  - [ ] 9.1.4. User feedback is submitted via API
  - [ ] 9.1.5. Graph resumes with updated state
  - [ ] 9.1.6. Appropriate path is taken based on feedback
  - Dependencies: All implementation tasks (1.x through 7.x)

### 10. Error Handling Tests

- [ ] 10.1. Test timeout scenarios

  - Dependencies: 7.2, 9.1 (Requires timeout implementation and integration tests)

- [ ] 10.2. Test invalid feedback submissions

  - Dependencies: 3.2, 6.2 (Requires feedback submission implementation)

- [ ] 10.3. Test improper state transitions
  - Dependencies: 3.1, 3.2, 3.3 (Requires OrchestratorService interrupt handling)

## Project Dependencies

- **Required Tasks Before Starting Implementation:**
  - Task 13: Checkpointer Implementation (Complete)
  - Task 14.1: ProposalGenerationGraph with evaluation nodes (Complete)
  - Task 14.2: OrchestratorService framework (Complete)

## Implementation Order

1. HITL State Structure (1.1 → 1.2) ✅ COMPLETED
2. Graph Configuration (2.1 → 2.2) ⏩ NEXT PRIORITY
3. OrchestratorService Integration (3.1 → 3.2 → 3.3) ⏩ NEXT PRIORITY
4. Feedback Processing Nodes (4.1 → 4.2 → 4.3)
5. Graph Conditional Logic (5.1 ✅ → 5.2)
6. API Endpoints (6.1 → 6.2 → 6.3)
7. Timeout Handling (7.1 → 7.2)
8. Testing (8.1 ✅ → 8.2 ✅ → 8.3 → 8.4 → 9.x → 10.x)

## Progress Summary

### Completed Components

- ✅ InterruptStatus interface and related types
- ✅ Schema validation and state annotations
- ✅ State management and reducers
- ✅ HITL interrupt points in evaluation nodes:
  - ✅ evaluateResearchNode
  - ✅ evaluateSolutionNode
  - ✅ evaluateSectionNode
  - ✅ evaluateConnectionsNode
- ✅ OrchestratorService detection and management:
  - ✅ detectInterrupt
  - ✅ handleInterrupt
  - ✅ getInterruptDetails
  - ✅ submitFeedback
  - ✅ resumeAfterFeedback
- ✅ Feedback processing node
- ✅ API endpoints for UI integration:
  - ✅ GET /api/rfp/interrupt-status (check interrupt status)
  - ✅ POST /api/rfp/feedback (submit feedback)
  - ✅ POST /api/rfp/resume (resume after feedback)

### Remaining Tasks

- [ ] Implement EditorAgent integration for revision handling
- [ ] Implement comprehensive integration tests
- [ ] Integrate with UI components

### Testing Status

- ✅ Schema validation tests
- ✅ Conditional routing tests
- ✅ Error handling tests
- [ ] Additional orchestrator tests for new functionality
- [ ] Edge case tests
- [ ] End-to-end workflow tests

## Next Steps

1. Complete the EditorAgent integration for revision handling
2. Develop comprehensive integration tests
3. Create UI components for interrupt handling and feedback submission
4. Document the HITL workflow for stakeholders

## File Path Mapping

For easy reference, here are the relative paths to all files that will be worked on during the HITL implementation:

### State and Types

- **OverallProposalState & Annotations:** `/apps/backend/state/proposal.state.ts`
- **HITL Type Definitions:** `/apps/backend/lib/types/hitl.types.ts` (create new file and remove this note once created)

### Graph Configuration

- **Proposal Generation Graph:** `/apps/backend/agents/proposal-agent/graph.ts`
- **Evaluation Nodes:** (create new folder and files and remove this note once created)
  - `/apps/backend/agents/proposal-agent/nodes/evaluateResearch.ts`
  - `/apps/backend/agents/proposal-agent/nodes/evaluateSolution.ts`
  - `/apps/backend/agents/proposal-agent/nodes/evaluateConnections.ts`
  - `/apps/backend/agents/proposal-agent/nodes/evaluateSections.ts`

### OrchestratorService

- **Orchestrator Service:** `/apps/backend/services/orchestrator.service.ts` (create new file and remove this note once created)
- **Checkpointer Integration:** `/apps/backend/lib/supabase/checkpointer.ts`

### Nodes and Conditionals

- **Feedback Processing Nodes:** `/apps/backend/agents/proposal-agent/nodes/processFeedback.ts` (create new file and remove this note once created)
- **Content Revision Node:** `/apps/backend/agents/proposal-agent/nodes/reviseContent.ts` (create new file and remove this note once created)
- **Regeneration Node:** `/apps/backend/agents/proposal-agent/nodes/regenerateContent.ts` (create new file and remove this note once created)
- **Conditional Logic:** `/apps/backend/agents/proposal-agent/conditionals.ts` ✅ UPDATED

### API Layer

- **Proposal Routes:** `/apps/backend/api/routes/proposals.routes.ts` (create new file and remove this note once created)
- **Input Validation Schemas:** `/apps/backend/lib/validation/feedback.schema.ts` (create new file and remove this note once created)

### Configuration

- **HITL Settings:** `/apps/backend/config/settings.ts`
