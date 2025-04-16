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

```typescript
// In orchestrator.service.ts
/**
 * Detects if the graph has paused at an interrupt point
 */
async detectInterrupt(threadId: string): Promise<boolean> {
  // Get the latest state from the checkpointer
  const state = await this.checkpointer.get(threadId) as OverallProposalState;

  // Check if state is interrupted
  return state?.interruptStatus?.isInterrupted === true;
}

/**
 * Handles an interrupt from the proposal generation graph
 */
async handleInterrupt(threadId: string): Promise<OverallProposalState> {
  // Get the latest state via checkpointer
  const state = await this.checkpointer.get(threadId) as OverallProposalState;

  // Verify interrupt status
  if (!state?.interruptStatus?.isInterrupted) {
    throw new Error('No interrupt detected in the current state');
  }

  // Log the interrupt for debugging/auditing
  this.logger.info(`Interrupt detected at ${state.interruptStatus.interruptionPoint}`);

  return state;
}

/**
 * Gets interrupt details and content for UI presentation
 */
async getInterruptDetails(threadId: string): Promise<InterruptDetails | null> {
  const state = await this.checkpointer.get(threadId) as OverallProposalState;

  if (!state?.interruptStatus?.isInterrupted || !state.interruptMetadata) {
    return null;
  }

  return {
    nodeId: state.interruptMetadata.nodeId,
    reason: state.interruptMetadata.reason,
    contentReference: state.interruptMetadata.contentReference || '',
    timestamp: state.interruptMetadata.timestamp,
    evaluationResult: state.interruptMetadata.evaluationResult
  };
}
```

- [ ] 3.2. Implement user feedback submission and processing:
  - [ ] 3.2.1. Provide methods for submitting user feedback
  - [ ] 3.2.2. Update state with feedback information
  - Dependencies: 3.1 (Requires interrupt detection)

```typescript
/**
 * Submit user feedback during an interrupt
 */
async submitFeedback(threadId: string, feedback: UserFeedback): Promise<OverallProposalState> {
  // Get the latest state
  const state = await this.checkpointer.get(threadId);

  // Validate the interrupt is still active
  if (state.interruptStatus !== 'awaiting_input') {
    throw new Error('Cannot submit feedback: state is not awaiting input');
  }

  // Update state with user feedback
  const updatedState = {
    ...state,
    userFeedback: feedback,
    interruptStatus: 'processing_feedback'
  };

  // Persist the updated state
  await this.checkpointer.put(threadId, updatedState);

  return updatedState;
}
```

- [ ] 3.3. Implement graph resumption after feedback:
  - [ ] 3.3.1. Prepare the state for UI presentation
  - [ ] 3.3.2. Resume the graph with updated state after feedback
  - Dependencies: 3.2 (Requires feedback submission)

```typescript
/**
 * Resume graph execution after feedback processing
 */
async resumeAfterFeedback(threadId: string): Promise<void> {
  const state = await this.checkpointer.get(threadId);

  // Validate state is ready to resume
  if (state.interruptStatus !== 'processing_feedback' || !state.userFeedback) {
    throw new Error('Cannot resume: feedback not processed or missing');
  }

  // Resume graph execution with updated state
  await this.graph.resume(threadId);
}
```

### 4. Feedback Processing Nodes (2 days)

- [ ] 4.1. Implement `processFeedbackNode` to route based on feedback type
  - Dependencies: 1.1, 1.2, 3.2 (Requires state structure and feedback submission)

```typescript
// In nodes.ts
export async function processFeedbackNode(
  state: OverallProposalState
): Promise<OverallProposalState> {
  const logger = createLogger("processFeedbackNode");
  logger.info("Processing user feedback");

  if (!state.userFeedback) {
    logger.error("No user feedback found in state");
    return {
      ...state,
      errors: [...state.errors, "Missing user feedback for processing"],
      interruptStatus: "not_interrupted", // Reset interrupt status
    };
  }

  const { type, comments, specificEdits } = state.userFeedback;

  // Process based on feedback type
  switch (type) {
    case "approve":
      // Mark content as approved
      return updateApprovalStatus(state);

    case "revise":
      // Content needs revision - will be handled by a separate node
      return {
        ...state,
        currentStep: "revision",
        // Additional fields for revision context
      };

    case "regenerate":
      // Content needs regeneration - will be handled by a separate node
      return {
        ...state,
        currentStep: "regeneration",
        // Add user guidance to messages if provided
        messages: comments
          ? [...state.messages, new HumanMessage(comments)]
          : state.messages,
      };

    default:
      logger.error(`Unknown feedback type: ${type}`);
      return {
        ...state,
        errors: [...state.errors, `Unknown feedback type: ${type}`],
        interruptStatus: "not_interrupted",
      };
  }
}
```

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

We've made significant progress on the HITL implementation:

1. **Completed Components**:

   - ✅ Defined and implemented the `InterruptStatus` interface and related types
   - ✅ Created schema validation for interrupt status with passing tests
   - ✅ Implemented `interruptStatusReducer` for proper state management
   - ✅ Implemented conditional routing for stale content choices with passing tests
   - ✅ Implemented HITL interrupt for `evaluateResearchNode` with proper status and metadata
   - ✅ Implemented HITL interrupt for `evaluateSolutionNode` with proper status and metadata
   - ✅ Implemented HITL interrupt for `evaluateSectionNode` with proper status and metadata specific to each section
   - ✅ Implemented HITL interrupt for `evaluateConnectionsNode` with proper status and metadata
   - ✅ Configured all necessary interrupt points in the graph's `interruptAfter` array
   - ✅ Added comprehensive tests for all evaluation nodes with HITL functionality
   - ✅ Created `OrchestratorService` with methods to detect interrupts, retrieve interrupt details, and provide content to UI
   - ✅ Implemented unit tests for all interrupt detection and handling functions

2. **Next Steps**:

   - ⏩ Implement user feedback submission and processing (Task 3.2)
   - ⏩ Implement graph resumption after feedback (Task 3.3)
   - ⏩ Implement feedback processing nodes (Task 4.x)
   - Continue with API endpoints and timeout handling

3. **Testing Status**:
   - ✅ Schema validation tests for interrupt status are passing
   - ✅ Conditional routing tests for stale content are passing
   - ✅ Tests for all evaluation nodes with HITL functionality are passing
   - ✅ Error handling tests for interrupted nodes are passing
   - ✅ Tests for OrchestratorService interrupt detection and handling are passing
   - More tests needed for feedback processing and graph resumption

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

- **HITL Settings:** `/apps/backend/config/settings.ts` (create new file and remove this note once created)
- **Environment Variables:** `/apps/backend/.env` (may need updates)

### Testing

- **State Tests:** `/apps/backend/tests/state/proposal.state.test.ts`
- **Node Tests:** `/apps/backend/tests/agents/proposal-agent/nodes/processFeedback.test.ts`
- **Conditional Tests:** `/apps/backend/tests/agents/proposal-agent/conditionals.test.ts` ✅ UPDATED
- **Orchestrator Tests:** `/apps/backend/tests/services/orchestrator.service.test.ts`
- **API Tests:** `/apps/backend/tests/api/routes/proposals.routes.test.ts`
- **Integration Tests:** `/apps/backend/tests/integration/hitl-workflow.test.ts`

## Outcomes

- Fully functional HITL capability in the proposal generation workflow
- Seamless integration between graph interrupts and the Orchestrator
- Proper state management during user review cycles
- Appropriate API endpoints for the frontend to interact with
