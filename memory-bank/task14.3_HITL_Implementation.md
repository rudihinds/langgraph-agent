# Task 14.3: Human-In-The-Loop (HITL) Implementation

## Overview

Implement the Human-In-The-Loop (HITL) feedback cycle to enable users to review and provide feedback on generated content throughout the proposal generation process.

## Status: COMPLETED

## Components

1. ✅ Update State Interface

   - Added `interruptStatus` and `interruptMetadata` fields to `OverallProposalState`
   - Added `userFeedback` field to store user feedback

2. ✅ Interrupt Detection

   - Implemented `evaluateConnectionsNode` to evaluate connections between research and solution
   - Updated existing evaluation nodes for interrupts

3. ✅ Feedback Processing

   - ✅ 3.1 Added `processFeedbackNode` function to route user feedback
   - ✅ 3.2 Implemented `submitFeedback` method in `OrchestratorService`
   - ✅ 3.3 Implemented `resumeAfterFeedback` method in `OrchestratorService`
   - ✅ 3.4 Added `updateContentStatus` private helper method

4. ✅ Conditional Routing

   - ✅ 4.1 Implemented `routeAfterFeedbackProcessing` function
   - ✅ 4.2 Updated `routeAfterResearchReview` function
   - ✅ 4.3 Updated `routeAfterSolutionReview` function
   - ✅ 4.4 Updated `routeAfterSectionFeedback` function
   - ✅ 4.5 Updated `routeFinalizeProposal` function

5. ✅ API Endpoints

   - ✅ 5.1 Implemented `/feedback` endpoint
   - ✅ 5.2 Implemented `/resume` endpoint
   - ✅ 5.3 Implemented `/interrupt-status` endpoint

6. ✅ Testing
   - ✅ 6.1 Implemented tests for API endpoints
     - ✅ `feedback.test.ts`
     - ✅ `resume.test.ts`
     - ✅ `interrupt-status.test.ts`
   - ✅ 6.2 Implemented tests for nodes
     - ✅ `processFeedbackNode` tests
   - ✅ 6.3 Implemented tests for conditional routing functions
     - ✅ `routeAfterFeedbackProcessing` tests
     - ✅ `routeAfterResearchReview` tests
     - ✅ `routeAfterSolutionReview` tests
     - ✅ `routeAfterSectionFeedback` tests
     - ✅ `routeFinalizeProposal` tests
   - ✅ 6.4 Implemented tests for Orchestrator Service HITL methods
     - ✅ `detectInterrupt` tests
     - ✅ `getInterruptDetails` tests
     - ✅ `submitFeedback` tests
     - ✅ `resumeAfterFeedback` tests
     - ✅ `updateContentStatus` tests
   - ✅ 6.5 Implemented integration tests for full HITL workflow
     - ✅ `hitl-workflow.test.ts`

## Implementation Details

### State Interface Updates

The `OverallProposalState` interface was extended with new fields to track interrupts and user feedback:

- `interruptStatus`: Tracks whether the generation is interrupted, the interruption point, and processing status
- `interruptMetadata`: Contains metadata about the interrupt (reason, nodeId, timestamp, contentReference)
- `userFeedback`: Stores user feedback (type, comments, timestamp, specificEdits)

### Feedback Processing

The `processFeedbackNode` function processes user feedback and updates content status based on the feedback type:

- For `approve`: Updates content status to `approved`
- For `revise`: Updates content status to `edited` and adds revision instructions
- For `regenerate`: Updates content status to `stale` and adds regeneration instructions

The `OrchestratorService` was extended with methods to handle the HITL workflow:

- `detectInterrupt`: Checks if the graph has paused at an interrupt point
- `getInterruptDetails`: Gets detailed information about the current interrupt
- `submitFeedback`: Processes user feedback and updates the proposal state
- `resumeAfterFeedback`: Resumes graph execution after feedback has been processed
- `updateContentStatus`: Updates the status of content based on feedback type

### Conditional Routing

Updated routing functions to handle different feedback paths:

- `routeAfterFeedbackProcessing`: Routes based on user feedback (regenerate, revise, or continue)
- `routeAfterResearchReview`, `routeAfterSolutionReview`, `routeAfterSectionFeedback`: Handle routing after content reviews
- `routeFinalizeProposal`: Checks if all required sections are approved before finalizing the proposal

### API Endpoints

Implemented new API endpoints to facilitate the HITL workflow:

- `/feedback`: Submits user feedback for processing
- `/resume`: Resumes graph execution after feedback processing
- `/interrupt-status`: Checks if the graph is interrupted and gets interrupt details

### Testing

Comprehensive test coverage for all HITL components:

- API endpoint tests validate request/response handling and error cases
- Node tests verify state transformations and error handling
- Conditional routing tests ensure correct path selection
- Orchestrator Service method tests validate HITL workflow logic
- Integration tests verify the complete HITL workflow cycle

## Dependencies

- LangGraph for graph creation and execution
- Checkpointer for state persistence
- Express.js for API endpoints

## Completion Notes

The HITL implementation is now complete, with all components implemented and tested. Users can now review and provide feedback on generated content throughout the proposal generation process. The implementation follows the design patterns established in the architecture documentation.

## Next Steps

- ✅ Integrate HITL with the frontend UI
- Consider adding more detailed analytics for HITL interactions
- Monitor for any edge cases or performance issues in production use

## Updates and Fixes

### FeedbackType Enum Implementation (Current Update)

- Created a dedicated `FeedbackType` enum in `apps/backend/lib/types/feedback.ts` to replace string literals
- Updated imports across the codebase to use the centralized enum:
  - Fixed `OrchestratorService` to import from the correct location
  - Updated `processFeedbackNode` switch statement to use the enum values
  - Fixed the API feedback schema to use `z.nativeEnum(FeedbackType)`
  - Updated conditionals to import and use the enum
- This standardization ensures type safety and consistency throughout the HITL workflow
