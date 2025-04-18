# Implementation Plan for Task 16.3: Connection Pairs Analysis (connectionPairsNode)

**Status**: In Progress

> Note: Implementation pending for connectionPairsNode.

## Related Files

- `spec_16.3.md`: Specification document for the node
- `apps/backend/agents/research/nodes.js`: Main implementation file
- `apps/backend/agents/research/agents.js`: Agent definition used by the node
- `apps/backend/agents/research/prompts/index.js`: Prompt template for the connection pairs generation
- `apps/backend/agents/research/__tests__/connectionPairsNode.test.ts`: Unit tests
- `apps/backend/agents/proposal-generation/graph.ts`: Graph definition file (for integration)

## Implementation Tasks

1. [ ] **Setup**

   - [ ] Create `spec_16.3.md` to document requirements and expected behavior
   - [ ] Create comprehensive test file to guide the implementation following TDD approach

2. [ ] **Input Validation**

   - [ ] Validate existence and non-emptiness of `state.solutionResults`
   - [ ] Validate existence and non-emptiness of `state.researchResults`
   - [ ] Return appropriate error states with clear messages for missing required inputs
   - [ ] Add system messages to clearly indicate validation failures

3. [ ] **Agent Implementation**

   - [ ] Create `createConnectionPairsAgent` function in `agents.js`
   - [ ] Configure agent with appropriate model settings
   - [ ] Create connection pairs prompt template in `prompts/index.js`
   - [ ] Include detailed instructions for identifying funder-applicant alignments

4. [ ] **Node Processing Logic**

   - [ ] Format prompt with solution, research, and organization data
   - [ ] Implement timeout prevention with Promise.race
   - [ ] Invoke the connection pairs agent
   - [ ] Parse JSON response with appropriate error handling
   - [ ] Add fallback regex extraction for non-JSON responses
   - [ ] Transform structured pairs to the expected string format

5. [ ] **State Updates**

   - [ ] Set `state.connectionsStatus` to "running" during execution
   - [ ] Update `state.connections` with processed connection pairs
   - [ ] Set `state.connectionsStatus` to `awaiting_review` on success
   - [ ] Add appropriate messages to `state.messages`
   - [ ] Clear errors on successful execution

6. [ ] **Error Handling**

   - [ ] Implement specific handling for LLM API errors
   - [ ] Add timeout error handling
   - [ ] Implement specific handling for service unavailability (5xx)
   - [ ] Add special handling for rate limiting errors (429)
   - [ ] Create JSON parsing error handling with fallback mechanism
   - [ ] Handle case where no connection pairs could be extracted
   - [ ] Preserve raw responses in error states for debugging

7. [ ] **Graph Integration**

   - [ ] Add the node to the main `ProposalGenerationGraph`
   - [ ] Define edge from `evaluateSolutionNode` to `connectionPairsNode`
   - [ ] Add condition to only trigger when `solutionStatus === "approved"`
   - [ ] Define edge from `connectionPairsNode` to `evaluateConnectionsNode`
   - [ ] Add error handling path for connection failures

8. [ ] **Testing & Refactoring**
   - [ ] Write tests for successful execution path
   - [ ] Test input validation (both missing and empty)
   - [ ] Test agent invocation and prompt formatting
   - [ ] Test response processing with both JSON and non-JSON responses
   - [ ] Test error handling for API errors, timeouts, and service unavailability
   - [ ] Verify proper state updates in all cases
   - [ ] Ensure consistent error message patterns
   - [ ] Confirm preservation of raw responses for debugging

## Enhanced Error Handling Implementation

1. **LLM API Error Classification**

   - Implemented error type detection based on error properties
   - Created specific handling for service unavailability errors (5xx status)
   - Added dedicated handling for rate limiting errors (429 or message content)
   - Preserved original error messages with contextual prefixes

2. **Timeout Prevention**

   - Implemented Promise.race pattern with a 60-second timeout
   - Created a separate timeoutPromise that rejects after the specified duration
   - Added specific timeout error handling and messaging
   - Ensured proper cleanup and state updates on timeout

3. **Response Format Flexibility**

   - Implemented primary JSON parsing attempt for structured data
   - Added fallback regex-based extraction for non-JSON or partially formatted responses
   - Created a helper function `extractConnectionPairs` for text-based extraction
   - Included appropriate logging for parsing failures and fallback mechanism usage

4. **Test Coverage**
   - Created comprehensive test suite covering all error scenarios
   - Added verification for timeout prevention mechanism
   - Tested fallback extraction for malformed responses
   - Verified preservation of raw responses in error states
   - Added assertions for specific error message patterns

## Key Learnings & Design Decisions

1. **Format Flexibility**

   - Used a dual parsing approach (JSON primary, regex fallback)
   - Implemented transformation of structured JSON into consistent string format
   - Added warning logs for parsing failures to assist with debugging
   - Ensured graceful handling of both structured and unstructured responses

2. **Timeout Management**

   - Applied the same timeout pattern used in previous nodes
   - Used Promise.race to prevent hanging on long-running LLM operations
   - Created specific error messaging for timeout situations
   - Added logging with context for all timeout scenarios

3. **Prompt Design**

   - Created a comprehensive prompt template with clear instructions
   - Included examples of different connection types
   - Provided a structured JSON output format specification
   - Included context about both funder and applicant

4. **Error Categorization**

   - Implemented error classification based on error properties (message, status)
   - Created consistent error message format with `[connectionPairsNode]` prefix
   - Used descriptive error messages for different failure types
   - Preserved original error details for debugging

5. **State Management**
   - Used consistent state update patterns
   - Maintained proper message chronology in the state
   - Applied standard status transitions (queued -> running -> awaiting_review/error)
   - Preserved raw agent responses for debugging purposes

## Graph Integration Details

1. **Node Registration**

   ```typescript
   // In proposal-generation/graph.ts
   graph.addNode(
     "connectionPairsNode",
     new FunctionNode({
       func: connectionPairsNode,
     })
   );
   ```

2. **Edge Definitions**

   ```typescript
   // Edge from solution evaluation to connection pairs
   graph.addEdge({
     from: "evaluateSolutionNode",
     to: "connectionPairsNode",
     condition: (state) => state.solutionStatus === "approved",
   });

   // Edge from connection pairs to its evaluation
   graph.addEdge({
     from: "connectionPairsNode",
     to: "evaluateConnectionsNode",
     condition: (state) => state.connectionsStatus === "awaiting_review",
   });

   // Error handling edge if needed
   graph.addEdge({
     from: "connectionPairsNode",
     to: "errorHandlerNode", // Or appropriate error handling logic
     condition: (state) => state.connectionsStatus === "error",
   });
   ```

3. **Checkpoint Integration**

   - Node utilizes the standard LangGraph checkpointing mechanism
   - State updates follow the pattern required by the checkpointer
   - All state changes are properly structured for persistence

4. **HITL Configuration**
   ```typescript
   // Ensure evaluation node is included in interrupt points
   graph.compiler.interruptAfter([
     "evaluateConnectionsNode",
     ...otherEvalNodes,
   ]);
   ```

## Production Readiness Improvements

1. **Error Resilience**

   - All error conditions handled gracefully with specific messaging
   - Parsing failures use fallback mechanisms for maximum robustness
   - Raw responses preserved in error states for debugging
   - Structured error logging with appropriate context

2. **Timeout Protection**

   - LLM operations won't hang indefinitely
   - Configurable timeout threshold (60 seconds by default)
   - Clear error messaging for timeout conditions
   - Proper state updates on timeout

3. **Response Validation**
   - Multiple parsing approaches for maximum response flexibility
   - Result validation to ensure meaningful connection pairs were extracted
   - Transformation logic to ensure consistent output format
   - Appropriate logging for all validation stages

## Next Steps

1. Begin implementation of `evaluateConnectionsNode` (Task 16.4)
2. Create specification document (`spec_16.4.md`)
3. Develop comprehensive test suite following TDD approach
4. Implement node functionality to evaluate connection pairs quality
5. Ensure consistent error handling patterns across all nodes
6. Update relevant documentation to reflect completed implementation

The implementation should follow the specifications in `spec_16.3.md` and leverage lessons learned from previous node implementations to ensure a robust and consistent approach to connection pairs analysis. The node must be properly integrated into the overall graph flow and correctly handle all required state transitions.
