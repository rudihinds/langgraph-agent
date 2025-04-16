# Task 3.2: User Feedback Submission and Processing - Implementation Plan

## Overview

This plan outlines the implementation of user feedback submission and processing functionality in the OrchestratorService. This is a critical part of the Human-In-The-Loop (HITL) workflow, allowing users to provide feedback when the graph pauses at evaluation nodes.

## Core Requirements

1. **Submit user feedback** when the graph is interrupted
2. **Update state with feedback** information
3. **Prepare state for resumption** based on feedback type
4. **Validate feedback data** before processing

## Implementation Steps

### 1. Define Feedback Submission Interface

```typescript
// In apps/backend/state/modules/types.ts (already defined)
export interface UserFeedback {
  type: "approve" | "revise" | "regenerate";
  comments?: string;
  specificEdits?: Record<string, any>;
  timestamp: string;
}
```

### 2. Create Validation Schema

```typescript
// In apps/backend/lib/validation/feedback.schema.ts
import { z } from "zod";

export const UserFeedbackSchema = z.object({
  type: z.enum(["approve", "revise", "regenerate"]),
  comments: z.string().optional(),
  specificEdits: z.record(z.any()).optional(),
  timestamp: z.string().optional(), // Optional as we'll set it server-side if not provided
});

export type UserFeedbackInput = z.infer<typeof UserFeedbackSchema>;
```

### 3. Extend OrchestratorService with Feedback Methods

```typescript
// In apps/backend/services/orchestrator.service.ts

/**
 * Submit user feedback during an interrupt
 *
 * @param threadId The thread ID of the interrupted graph
 * @param feedback The user feedback data
 * @returns The updated state with feedback
 */
async submitFeedback(
  threadId: string,
  feedback: UserFeedbackInput
): Promise<OverallProposalState> {
  // Get the latest state
  const state = await this.checkpointer.get(threadId) as OverallProposalState;

  // Validate the interrupt is still active
  if (!state?.interruptStatus?.isInterrupted) {
    throw new Error('Cannot submit feedback: no active interrupt');
  }

  // Validate input using Zod schema
  const validatedFeedback = UserFeedbackSchema.parse(feedback);

  // Add server timestamp if not provided
  if (!validatedFeedback.timestamp) {
    validatedFeedback.timestamp = new Date().toISOString();
  }

  // Update state with user feedback
  const updatedState = {
    ...state,
    userFeedback: validatedFeedback,
    interruptStatus: {
      ...state.interruptStatus,
      feedback: {
        type: validatedFeedback.type,
        content: validatedFeedback.comments || null,
        timestamp: validatedFeedback.timestamp,
      },
      processingStatus: "processed" as const,
    },
  };

  // Persist the updated state
  await this.checkpointer.put(threadId, updatedState);

  return updatedState;
}

/**
 * Prepare the state for resumption based on feedback type
 *
 * @param threadId The thread ID to prepare for resumption
 * @returns The prepared state
 */
async prepareFeedbackForProcessing(
  threadId: string
): Promise<OverallProposalState> {
  // Get the latest state
  const state = await this.checkpointer.get(threadId) as OverallProposalState;

  // Validate feedback exists
  if (!state.userFeedback) {
    throw new Error('Cannot prepare for processing: no feedback submitted');
  }

  let updatedState = { ...state };

  // Handle different feedback types
  switch (state.userFeedback.type) {
    case "approve":
      // For approval, mark the content as approved based on the interruptionPoint
      updatedState = this.handleApproval(state);
      break;

    case "revise":
      // For revision, prepare for editor agent interaction
      updatedState = this.prepareForRevision(state);
      break;

    case "regenerate":
      // For regeneration, prepare for content regeneration
      updatedState = this.prepareForRegeneration(state);
      break;
  }

  // Persist the updated state
  await this.checkpointer.put(threadId, updatedState);

  return updatedState;
}
```

### 4. Implement Content Status Update Helpers

```typescript
/**
 * Handle content approval - updates status based on the interrupt point
 *
 * @param state The current state
 * @returns The updated state with approved status
 */
private handleApproval(state: OverallProposalState): OverallProposalState {
  const updatedState = { ...state };
  const interruptPoint = state.interruptStatus.interruptionPoint;

  if (!interruptPoint) {
    return updatedState;
  }

  // Update status based on the interrupt point
  if (interruptPoint === 'evaluateResearch') {
    updatedState.researchStatus = 'approved';
  }
  else if (interruptPoint === 'evaluateSolution') {
    updatedState.solutionStatus = 'approved';
  }
  else if (interruptPoint === 'evaluateConnections') {
    updatedState.connectionsStatus = 'approved';
  }
  else if (interruptPoint.startsWith('evaluateSection:')) {
    // Extract section type from interrupt point
    const sectionType = interruptPoint.split(':')[1] as SectionType;

    // Get the section data
    const sectionData = updatedState.sections.get(sectionType);

    if (sectionData) {
      // Update section status to approved
      updatedState.sections.set(sectionType, {
        ...sectionData,
        status: 'approved'
      });
    }
  }

  // Reset interrupt status
  updatedState.interruptStatus = {
    isInterrupted: false,
    interruptionPoint: null,
    feedback: null,
    processingStatus: null
  };

  // Update overall status if all required sections are completed
  if (this.areAllSectionsComplete(updatedState)) {
    updatedState.status = 'complete';
  } else {
    updatedState.status = 'running';
  }

  return updatedState;
}

/**
 * Prepare for content revision - sets status for editor agent
 *
 * @param state The current state
 * @returns The updated state ready for revision
 */
private prepareForRevision(state: OverallProposalState): OverallProposalState {
  const updatedState = { ...state };
  const interruptPoint = state.interruptStatus.interruptionPoint;

  if (!interruptPoint) {
    return updatedState;
  }

  // Update status based on the interrupt point
  if (interruptPoint === 'evaluateResearch') {
    updatedState.researchStatus = 'needs_revision';
  }
  else if (interruptPoint === 'evaluateSolution') {
    updatedState.solutionStatus = 'needs_revision';
  }
  else if (interruptPoint === 'evaluateConnections') {
    updatedState.connectionsStatus = 'needs_revision';
  }
  else if (interruptPoint.startsWith('evaluateSection:')) {
    // Extract section type from interrupt point
    const sectionType = interruptPoint.split(':')[1] as SectionType;

    // Get the section data
    const sectionData = updatedState.sections.get(sectionType);

    if (sectionData) {
      // Update section status to needs_revision
      updatedState.sections.set(sectionType, {
        ...sectionData,
        status: 'needs_revision'
      });
    }
  }

  // Set current step for editor agent
  updatedState.currentStep = `revise:${state.interruptMetadata?.contentReference || 'content'}`;

  // Do not reset interrupt status yet (will be reset after revision)
  updatedState.status = 'running';

  return updatedState;
}

/**
 * Prepare for content regeneration
 *
 * @param state The current state
 * @returns The updated state ready for regeneration
 */
private prepareForRegeneration(state: OverallProposalState): OverallProposalState {
  const updatedState = { ...state };
  const interruptPoint = state.interruptStatus.interruptionPoint;

  if (!interruptPoint) {
    return updatedState;
  }

  // Update status based on the interrupt point
  if (interruptPoint === 'evaluateResearch') {
    updatedState.researchStatus = 'queued';
    updatedState.currentStep = 'research';
  }
  else if (interruptPoint === 'evaluateSolution') {
    updatedState.solutionStatus = 'queued';
    updatedState.currentStep = 'solution';
  }
  else if (interruptPoint === 'evaluateConnections') {
    updatedState.connectionsStatus = 'queued';
    updatedState.currentStep = 'connections';
  }
  else if (interruptPoint.startsWith('evaluateSection:')) {
    // Extract section type from interrupt point
    const sectionType = interruptPoint.split(':')[1] as SectionType;

    // Get the section data
    const sectionData = updatedState.sections.get(sectionType);

    if (sectionData) {
      // Update section status to queued
      updatedState.sections.set(sectionType, {
        ...sectionData,
        status: 'queued'
      });
      updatedState.currentStep = `section:${sectionType}`;
    }
  }

  // If user provided comments, add as a message
  if (state.userFeedback?.comments) {
    updatedState.messages = [
      ...updatedState.messages,
      {
        type: 'human',
        content: state.userFeedback.comments,
        additional_kwargs: { timestamp: state.userFeedback.timestamp }
      }
    ];
  }

  // Reset interrupt status
  updatedState.interruptStatus = {
    isInterrupted: false,
    interruptionPoint: null,
    feedback: null,
    processingStatus: null
  };

  updatedState.status = 'running';

  return updatedState;
}

/**
 * Check if all required sections are completed
 */
private areAllSectionsComplete(state: OverallProposalState): boolean {
  // Check if research, solution, and connections are complete
  if (
    state.researchStatus !== 'approved' &&
    state.researchStatus !== 'complete'
  ) {
    return false;
  }

  if (
    state.solutionStatus !== 'approved' &&
    state.solutionStatus !== 'complete'
  ) {
    return false;
  }

  if (
    state.connectionsStatus !== 'approved' &&
    state.connectionsStatus !== 'complete'
  ) {
    return false;
  }

  // Check all required sections
  for (const sectionType of state.requiredSections) {
    const section = state.sections.get(sectionType);
    if (!section || (section.status !== 'approved' && section.status !== 'complete')) {
      return false;
    }
  }

  return true;
}
```

### 5. Update Interface with Resume Method

```typescript
/**
 * Resume graph execution after feedback processing
 *
 * @param threadId The thread ID to resume
 * @returns The updated state after resumption
 */
async resumeAfterFeedback(threadId: string): Promise<OverallProposalState> {
  // Prepare the state for resumption
  await this.prepareFeedbackForProcessing(threadId);

  // Resume the graph execution
  await this.graph.resume(threadId);

  // Return the latest state
  return await this.checkpointer.get(threadId) as OverallProposalState;
}
```

## Testing Strategy

### 1. Unit Tests for Feedback Submission

```typescript
// In apps/backend/services/orchestrator.service.test.ts

describe("OrchestratorService - Feedback Submission", () => {
  // Setup mocks as in previous tests

  it("should submit feedback and update state for approval", async () => {
    // Setup mock state with interrupt
    mockCheckpointer.get.mockResolvedValue({
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateResearchNode",
        contentReference: "research",
        timestamp: "2023-06-15T14:30:00Z",
      },
      researchStatus: "awaiting_review",
      status: "awaiting_review",
    });

    const feedback = {
      type: "approve",
      comments: "Looks good",
    };

    const result = await orchestrator.submitFeedback("test-thread", feedback);

    // Verify state updates
    expect(result.interruptStatus.feedback).toBeDefined();
    expect(result.interruptStatus.feedback?.type).toBe("approve");
    expect(result.interruptStatus.feedback?.content).toBe("Looks good");
    expect(result.interruptStatus.processingStatus).toBe("processed");
    expect(result.userFeedback).toBeDefined();
    expect(result.userFeedback?.type).toBe("approve");

    // Verify checkpointer was called with updated state
    expect(mockCheckpointer.put).toHaveBeenCalledWith("test-thread", result);
  });

  it("should throw error when no interrupt is active", async () => {
    mockCheckpointer.get.mockResolvedValue({
      interruptStatus: {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      },
      status: "running",
    });

    await expect(
      orchestrator.submitFeedback("test-thread", { type: "approve" })
    ).rejects.toThrow("no active interrupt");
  });

  // Additional test cases for different feedback types
});
```

### 2. Tests for Content Status Updates

```typescript
describe("OrchestratorService - Content Status Updates", () => {
  it("should update research status to approved", async () => {
    // Setup mock state with research interrupt
    const mockState = {
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: null,
        processingStatus: "processed",
      },
      interruptMetadata: {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateResearchNode",
        contentReference: "research",
        timestamp: "2023-06-15T14:30:00Z",
      },
      userFeedback: {
        type: "approve",
        timestamp: "2023-06-15T14:35:00Z",
      },
      researchStatus: "awaiting_review",
      solutionStatus: "queued",
      connectionsStatus: "queued",
      sections: new Map(),
      requiredSections: [],
      status: "awaiting_review",
      messages: [],
    };

    mockCheckpointer.get.mockResolvedValue(mockState);

    const result =
      await orchestrator.prepareFeedbackForProcessing("test-thread");

    // Verify research status was updated
    expect(result.researchStatus).toBe("approved");
    expect(result.status).toBe("running");
    expect(result.interruptStatus.isInterrupted).toBe(false);

    // Verify checkpointer was called
    expect(mockCheckpointer.put).toHaveBeenCalledWith("test-thread", result);
  });

  it("should set section to needs_revision for revision feedback", async () => {
    // Setup mock sections Map
    const sectionsMap = new Map();
    sectionsMap.set(SectionType.PROBLEM_STATEMENT, {
      id: SectionType.PROBLEM_STATEMENT,
      content: "Problem statement content",
      status: "awaiting_review",
      lastUpdated: "2023-06-15T14:30:00Z",
    });

    // Setup mock state with section interrupt
    const mockState = {
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateSection:problem_statement",
        feedback: null,
        processingStatus: "processed",
      },
      interruptMetadata: {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateSectionNode",
        contentReference: SectionType.PROBLEM_STATEMENT,
        timestamp: "2023-06-15T14:30:00Z",
      },
      userFeedback: {
        type: "revise",
        comments: "Please revise this section",
        timestamp: "2023-06-15T14:35:00Z",
      },
      researchStatus: "approved",
      solutionStatus: "approved",
      connectionsStatus: "approved",
      sections: sectionsMap,
      requiredSections: [SectionType.PROBLEM_STATEMENT],
      status: "awaiting_review",
      messages: [],
    };

    mockCheckpointer.get.mockResolvedValue(mockState);

    const result =
      await orchestrator.prepareFeedbackForProcessing("test-thread");

    // Get the updated section
    const updatedSection = result.sections.get(SectionType.PROBLEM_STATEMENT);

    // Verify section status was updated
    expect(updatedSection?.status).toBe("needs_revision");
    expect(result.status).toBe("running");
    expect(result.currentStep).toBe(`revise:${SectionType.PROBLEM_STATEMENT}`);

    // Verify checkpointer was called
    expect(mockCheckpointer.put).toHaveBeenCalledWith("test-thread", result);
  });

  // Additional tests for regeneration and other content types
});
```

### 3. Test for Graph Resumption

```typescript
describe("OrchestratorService - Graph Resumption", () => {
  it("should prepare state and resume graph", async () => {
    // Setup mocks for prepare and resume
    mockCheckpointer.get.mockResolvedValue({
      // Mock state with feedback
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateResearch",
        feedback: {
          type: "approve",
          content: "Looks good",
          timestamp: "2023-06-15T14:35:00Z",
        },
        processingStatus: "processed",
      },
      userFeedback: {
        type: "approve",
        comments: "Looks good",
        timestamp: "2023-06-15T14:35:00Z",
      },
      researchStatus: "awaiting_review",
      status: "awaiting_review",
    });

    // Setup second return value after resume
    mockCheckpointer.get
      .mockResolvedValueOnce({
        // First call returns interrupted state
      })
      .mockResolvedValueOnce({
        // Second call returns resumed state
        interruptStatus: {
          isInterrupted: false,
          interruptionPoint: null,
          feedback: null,
          processingStatus: null,
        },
        researchStatus: "approved",
        status: "running",
      });

    const result = await orchestrator.resumeAfterFeedback("test-thread");

    // Verify graph was resumed
    expect(mockGraph.resume).toHaveBeenCalledWith("test-thread");

    // Verify final state
    expect(result.interruptStatus.isInterrupted).toBe(false);
    expect(result.status).toBe("running");
  });
});
```

## Implementation Order

1. **Define Types and Schemas** (Day 1)

   - Ensure UserFeedback interface is properly defined
   - Create validation schema for feedback input

2. **Implement Feedback Submission** (Day 1)

   - Add submitFeedback method to OrchestratorService
   - Write tests for feedback submission

3. **Implement Status Update Helpers** (Day 2)

   - Create handleApproval, prepareForRevision, and prepareForRegeneration methods
   - Write tests for each helper method

4. **Implement Graph Resumption** (Day 2)

   - Add resumeAfterFeedback method
   - Update integration with graph and checkpointer
   - Write tests for resumption

5. **Integration Testing** (Day 3)
   - Test the full feedback cycle
   - Verify state transitions
   - Ensure proper error handling

## Dependencies

- **Required Before Starting:**
  - Task 3.1: OrchestratorService Interrupt Detection (Complete)
  - Base state interfaces and reducers (Complete)

## Expected Outcomes

- OrchestratorService with complete HITL feedback handling
- Proper state transitions based on feedback type
- Full test coverage for all feedback scenarios
