# Test Cases for Evaluation Node Graph Integration

This document outlines comprehensive test cases for the evaluation node integration with the `ProposalGenerationGraph` system, covering both the integration utilities and graph definition updates.

## 1. Integration Utilities Tests

### 1.1 `routeAfterEvaluation` Conditional Function Tests

- [x] Test that routing returns "continue" when evaluation has passed and status is "approved"
- [x] Test that routing returns "revise" when evaluation has failed and status is "revision_requested"
- [x] Test that routing returns "awaiting_feedback" when the state is interrupted for review
- [x] Test that content-specific routing works for solution evaluation (using contentType parameter)
- [x] Test that content-specific routing works for connection pairs evaluation
- [x] Test that section-specific routing works correctly (using sectionId parameter)
- [x] Test graceful handling of missing evaluation data
- [x] Test that interrupted status is prioritized over evaluation results
- [x] Test correct handling of content with "edited" status

### 1.2 `addEvaluationNode` Helper Function Tests

- [x] Test basic node registration with graph, verifying node name, edges, and conditional edges
- [x] Test section-specific evaluation node registration (section-specific naming conventions)
- [x] Test that custom options (criteriaPath, passingThreshold, timeout) are properly passed to factory
- [x] Test error handling when unknown content type is provided
- [x] Test proper node naming conventions for different content types
- [x] Test that evaluation node function is correctly obtained from factory
- [x] Test proper edge connections between source, evaluation, and destination nodes

## 2. Graph Integration Tests

### 2.1 Evaluation Node Integration with Graph

- [x] Test adding multiple evaluation nodes to the graph (research, solution, connections)
- [x] Test proper node and edge configuration for multiple nodes
- [x] Test that conditional edges are configured with correct routing function
- [x] Test that graph.compiler.interruptAfter is called with all evaluation nodes
- [x] Test state transitions during graph execution (queued → evaluating → awaiting_review)
- [x] Test that evaluation results are properly stored in state
- [x] Test that interrupt flag is set correctly after evaluation
- [x] Test that graph execution stops at interrupt points and resumes correctly

### 2.2 Orchestrator Integration Tests

- [ ] Test handling of evaluation approval feedback (status transition to "approved")
- [ ] Test handling of evaluation revision feedback (status transition to "revision_requested")
- [ ] Test that appropriate messages are added to state when handling feedback
- [ ] Test that interrupt metadata is cleared after handling feedback
- [ ] Test that graph execution is resumed after feedback handling
- [ ] Test marking dependent sections as stale after content edit
- [ ] Test proper application of dependency map when marking stale content
- [ ] Test handling of regeneration choice for stale content (setting status to "queued")
- [ ] Test adding regeneration guidance to messages when regenerating stale content
- [ ] Test handling of "keep" choice for stale content (setting status to "approved")

## 3. End-to-End Flow Tests

### 3.1 Full Evaluation and Feedback Cycle

- [ ] Test complete flow from generation → evaluation → interruption → feedback → continuation
- [ ] Test flow with revision feedback (generation → evaluation → interruption → revision feedback → regeneration)
- [ ] Test evaluation → edit → dependency tracking → stale content → regeneration flow
- [ ] Test error recovery during evaluation (timeout, parser error, etc.)
- [ ] Test performance benchmarks for evaluation node (timing, state size growth)

## 4. Error Handling Tests

- [ ] Test handling of missing criteria files
- [ ] Test handling of malformed content for evaluation
- [ ] Test handling of timeout errors during LLM evaluation
- [ ] Test handling of LLM API errors
- [ ] Test error propagation to state.errors
- [ ] Test appropriate status updates on error conditions
- [ ] Test graph routing on error conditions

## 5. Advanced Integration Tests

- [ ] Test integration with multiple section evaluation nodes in sequence
- [ ] Test integration with custom validator functions
- [ ] Test handling of custom evaluation prompts
- [ ] Test evaluation node with different model configurations
- [ ] Test integration with specialized content extractors
- [ ] Test handling of complex interrupt metadata
- [ ] Test handling of multiple simultaneous interruptions

## 6. Implementation Requirements Checklist

- [x] Implement `routeAfterEvaluation` conditional function in `conditionals.ts`
- [x] Implement `addEvaluationNode` helper function in `evaluation_integration.ts`
- [x] Update graph definition to use evaluation node integration
- [x] Configure interrupt points for all evaluation nodes
- [ ] Implement Orchestrator's `handleEvaluationFeedback` method
- [ ] Implement mechanism for processing approval, revision, and edit actions
- [x] Add state transition handling for evaluation results
- [ ] Implement API routes for handling evaluation feedback
- [ ] Implement `markDependentSectionsAsStale` in OrchestratorService
- [ ] Implement stale content management logic
- [ ] Update generator nodes to check for guidance in state.messages

## 7. Progress Summary and Next Steps

### Completed Implementation

We have successfully implemented and tested the following components:

1. `addEvaluationNode` helper function:

   - Creates evaluation nodes with proper naming conventions
   - Adds appropriate edges between source and evaluation nodes
   - Configures conditional routing based on evaluation results
   - Sets up interrupt points for human feedback

2. `routeAfterEvaluation` conditional function:

   - Routes to "continue" when content is approved and passes evaluation
   - Routes to "revise" when content fails evaluation and needs revision
   - Routes to "awaiting_feedback" when human feedback is required
   - Handles section-specific and content-type specific routing

3. We have tested all core integration components:
   - Verified state transitions during evaluation
   - Confirmed proper storage of evaluation results in state
   - Validated that interrupt flags are correctly set
   - Ensured that graph execution stops at interrupt points and can resume

### Next Steps

The following components still need to be implemented:

1. **Orchestrator Integration:**

   - `handleEvaluationFeedback` method to process user feedback
   - State updates based on user approval or revision requests
   - Continuation of graph execution after feedback

2. **Dependency Tracking:**

   - Implementation of content dependency system
   - Marking dependent sections as stale when content is edited
   - Handling regeneration of stale content

3. **API Integration:**

   - API routes for submitting evaluation feedback
   - Integration with frontend evaluation review interface

4. **Error Handling:**
   - Comprehensive error recovery for evaluation errors
   - Proper propagation of errors to state.errors

### Key Considerations for Future Work

1. We should evaluate how the current implementation handles evaluation criteria loading and custom validation.

2. The section-specific evaluation naming conventions should be standardized and documented.

3. State updates need careful consideration to maintain immutability and proper typing.

4. TypeScript type safety in tests remains a challenge that needs to be addressed while maintaining test readability.

5. The interrupt metadata structure should be documented to ensure consistent usage across the system.
