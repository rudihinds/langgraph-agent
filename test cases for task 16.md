# Updated Test Cases for Task 16: Refactor Node Functions

## Overview

This document outlines the comprehensive test strategy for the document loader node in the proposal generation system, following Test-Driven Development (TDD) principles to ensure complete coverage of functionality, edge cases, and integration points.

## Test Framework Details

- **Framework**: Vitest
- **Location**: Tests should mirror the implementation structure, with test files corresponding to each implementation file
- **Naming Convention**: `[component-name].test.ts`
- **Coverage Target**: >85% line coverage, 100% branch coverage for critical paths

## Test Cases

### 1. Document Processing Nodes Tests

#### 1.1 Document Loader Node (`apps/backend/agents/proposal-generation/nodes/__tests__/documentLoader.test.ts`)

**Description**: Tests the node responsible for retrieving documents from Supabase storage and parsing them into the proposal state.

**Required Files**:

- Implementation: `apps/backend/agents/proposal-generation/nodes/documentLoader.ts`
- Dependencies:
  - `apps/backend/lib/supabase/client.js` - Supabase client for storage access
  - `apps/backend/lib/parsers/rfp.js` - Document parsing utilities
  - `apps/backend/state/proposal.state.js` - State interface definitions

**Unit Tests**:

- `should load a PDF document from Supabase storage successfully`

  - Input: Valid document ID referencing a PDF in Supabase storage
  - Expected: rfpDocument.status = "loaded", document text extracted, metadata properly populated
  - Mock: Supabase storage download returning a PDF buffer

- `should load a DOCX document from Supabase storage successfully`

  - Input: Valid document ID referencing a DOCX in Supabase storage
  - Expected: rfpDocument.status = "loaded", document text extracted, metadata properly populated
  - Mock: Supabase storage download returning a DOCX buffer

- `should load a TXT document from Supabase storage successfully`

  - Input: Valid document ID referencing a TXT in Supabase storage
  - Expected: rfpDocument.status = "loaded", document text extracted, metadata properly populated
  - Mock: Supabase storage download returning a text buffer

- `should handle non-existent document ID`

  - Input: Document ID that doesn't exist in storage
  - Expected: rfpDocument.status = "error", errors array contains "Document not found" message
  - Mock: Supabase storage download returning a 404 error

- `should handle unauthorized access to Supabase bucket`

  - Input: Valid document ID but no access to bucket
  - Expected: rfpDocument.status = "error", errors array contains access/authorization error message
  - Mock: Supabase storage download returning a 403 error

- `should handle Supabase service unavailability`

  - Input: Valid document ID but Supabase service is down
  - Expected: rfpDocument.status = "error", errors array contains service unavailability message
  - Mock: Supabase storage download throwing a network/connection error

- `should handle corrupted document in storage`

  - Input: ID of a corrupted document
  - Expected: rfpDocument.status = "error", errors array contains parsing error message
  - Mock: Supabase download succeeding but parser throwing a ParsingError

- `should handle unsupported file type`

  - Input: Document ID for an unsupported file format (e.g., .xyz)
  - Expected: rfpDocument.status = "error", errors array contains unsupported format message
  - Mock: Supabase metadata showing unsupported extension or parser throwing UnsupportedFileTypeError

- `should update rfpDocument state correctly`

  - Input: Valid document ID
  - Expected: State properly updated with:
    - id (string matching input ID)
    - fileName (from metadata)
    - text (extracted document text)
    - metadata (combined from Supabase and document parsing)
    - status: "loaded"
  - Mock: Successful Supabase download and parsing

- `should preserve document ID when errors occur`

  - Input: Valid document ID but error during loading
  - Expected: rfpDocument contains original ID, status = "error"
  - Mock: Supabase throwing an error

- `should handle empty document gracefully`

  - Input: ID of an empty but valid document
  - Expected: rfpDocument.status = "loaded", text is empty string, metadata present
  - Mock: Supabase returning empty file buffer, parser handling it correctly

- `should use the correct Supabase bucket from configuration`

  - Input: Valid document ID
  - Expected: Supabase client attempts to download from "proposal-documents" bucket
  - Mock: Verify Supabase client is called with correct bucket name

- `should include appropriate metadata from both Supabase and document parsing`
  - Input: Valid document ID
  - Expected: rfpDocument.metadata contains merged data from Supabase storage (upload date, size, etc.) and document parsing (title, author, etc.)
  - Mock: Supabase returning metadata, document parser extracting internal metadata

#### 1.2 Requirement Analysis Node (`solutionSoughtNode`)

**Location:** Likely `apps/backend/agents/research/nodes.ts` (or similar, based on search results)
**Test File:** `apps/backend/agents/research/__tests__/solutionSoughtNode.test.ts` (assuming location)

**Description:** Tests the node responsible for analyzing RFP text and research results to identify the funder's desired solution.

**Dependencies to Mock:**

- Underlying LLM/Agent client (`createSolutionSoughtAgent` or the model it uses).
- Potentially `solutionSoughtPrompt` if loaded dynamically.
- Logger instance.
- (Potentially) Zod schema if validation is implemented.

**Unit Tests:**

- **Happy Path:**
  - `should successfully analyze valid RFP text and research results`
    - Input: State with valid `rfpDocument.text` and `deepResearchResults`.
    - Expected Output: State update with `solutionSoughtResults` (structured JSON), `solutionSoughtStatus` = `'awaiting_review'`, relevant success message in `messages`.
    - Mock: LLM returns a valid, parsable JSON string matching the expected structure.
- **Input Validation:**
  - `should handle missing rfpDocument text`
    - Input: State where `state.rfpDocument.text` is null, undefined, or empty.
    - Expected Output: State update with `solutionSoughtStatus` = `'error'`, specific error message in `state.errors`, no LLM call.
  - `should handle missing deepResearchResults`
    - Input: State where `state.deepResearchResults` is null or undefined.
    - Expected Output: State update with `solutionSoughtStatus` = `'error'`, specific error message in `state.errors`, no LLM call.
- **LLM/Agent Interaction:**
  - `should correctly format the prompt using state data`
    - Input: State with valid inputs.
    - Expected: Verify the prompt passed to the LLM client correctly includes text and research results.
    - Mock: Capture arguments passed to the LLM client.
  - `should handle LLM API errors gracefully`
    - Input: Valid state.
    - Expected Output: State update with `solutionSoughtStatus` = `'error'`, specific API error message in `state.errors`.
    - Mock: LLM client throws an API error (e.g., network error, 500 status).
  - `should handle LLM timeouts gracefully` (if applicable)
    - Input: Valid state.
    - Expected Output: State update with `solutionSoughtStatus` = `'error'`, specific timeout error message in `state.errors`.
    - Mock: LLM client simulates a timeout.
- **Response Processing:**
  - `should handle non-JSON response from LLM`
    - Input: Valid state.
    - Expected Output: State update with `solutionSoughtStatus` = `'error'`, specific parsing error message in `state.errors`.
    - Mock: LLM returns a plain string or malformed JSON.
  - `should handle JSON response not matching expected schema` (if Zod validation implemented)
    - Input: Valid state.
    - Expected Output: State update with `solutionSoughtStatus` = `'error'`, specific validation error message in `state.errors`.
    - Mock: LLM returns valid JSON but with missing/incorrect fields according to the Zod schema.
- **State Management:**
  - `should update solutionSoughtStatus to 'running' during execution` (May require inspecting state updates or specific logging if directly testing intermediate status is hard).
  - `should correctly store parsed results in solutionSoughtResults on success`
    - Input: Valid state.
    - Expected Output: Verify `state.solutionSoughtResults` matches the parsed output from the mocked LLM response.
    - Mock: LLM returns valid JSON.
  - `should add appropriate messages to the state on success and failure`
    - Input: Various scenarios (success, different errors).
    - Expected Output: Verify `state.messages` contains relevant system/AI messages reflecting the outcome.
  - `should clear previous node-specific errors on successful execution`
    - Input: State with a pre-existing error related to this node.
    - Expected Output: Verify the specific error is removed from `state.errors` upon successful completion.
    - Mock: LLM returns valid JSON.

**Implementation Notes for Tests:**

- Use Vitest (`vi.mock`, `vi.fn`, `expect`).
- Create mock initial `OverallProposalState` objects for different scenarios.
- Mock the LLM/agent invocation (`model.invoke` or `agent.invoke`) to control responses.
- Verify the final partial state returned by the node function matches expectations for each scenario.

#### 1.3 Connection Pairs Node (`connectionPairsNode`)

**Location:** `apps/backend/agents/research/nodes.js`
**Test File:** `apps/backend/agents/research/__tests__/connectionPairsNode.test.ts`

**Description:** Tests the node responsible for identifying meaningful alignment opportunities (connection pairs) between the funding organization and the applicant based on research results and solution requirements.

**Dependencies to Mock:**

- `createConnectionPairsAgent` function from `../agents.js`
- LLM/Agent client that processes connection pairs requests
- `connectionPairsPrompt` from `../prompts/index.js`
- Logger instance

**Unit Tests:**

- **Input Validation:**

  - `should return error when solutionResults is missing`

    - Input: State with undefined or empty `solutionResults`
    - Expected Output: State update with `connectionsStatus` = `'error'`, appropriate error message added to `state.errors`, no agent invocation
    - Verification: Error message contains "Solution results are missing or empty"

  - `should return error when researchResults is missing`
    - Input: State with undefined or empty `researchResults`
    - Expected Output: State update with `connectionsStatus` = `'error'`, appropriate error message added to `state.errors`, no agent invocation
    - Verification: Error message contains "Research results are missing or empty"

- **Agent Invocation:**

  - `should format the prompt correctly and invoke the agent`

    - Input: Valid state with solution and research results
    - Expected: Agent is correctly created and invoked with properly formatted prompt
    - Verification: `createConnectionPairsAgent` and `mockAgentInvoke` are called

  - `should handle LLM API errors properly`

    - Input: Valid state, but agent throws API error
    - Expected Output: State update with `connectionsStatus` = `'error'`, API error message in `state.errors`
    - Mock: Agent invocation throws error with message "API Error: Rate limit exceeded"

  - `should handle timeouts during LLM invocation`
    - Input: Valid state, but agent operation times out
    - Expected Output: State update with `connectionsStatus` = `'error'`, timeout error message in `state.errors`
    - Mock: Agent invocation throws error related to timeout

- **Response Processing:**

  - `should correctly parse valid JSON responses`

    - Input: Valid state with agent returning proper JSON response
    - Expected Output: State update with parsed connection pairs in `state.connections`, `connectionsStatus` = `'awaiting_review'`
    - Mock: Agent returns JSON string with connection pairs structure

  - `should use regex fallback for non-JSON responses`

    - Input: Valid state with agent returning non-JSON but parseable text
    - Expected Output: State update with extracted connection pairs in `state.connections`, `connectionsStatus` = `'awaiting_review'`
    - Mock: Agent returns plain text containing connection pairs information

  - `should handle completely unparseable responses`

    - Input: Valid state with agent returning unparseable response
    - Expected Output: State update with `connectionsStatus` = `'error'`, parsing error message in `state.errors`
    - Mock: Agent returns text with no extractable connection pairs

  - `should transform connection_pairs from JSON to expected format`
    - Input: Valid state with agent returning structured JSON
    - Expected Output: Verify `state.connections` contains properly transformed data from JSON format
    - Verification: Connection pairs follow the expected format pattern

- **State Management:**

  - `should correctly update state on successful execution`

    - Input: Valid state with successful agent response
    - Expected Output: State update with `connectionsStatus` = `'awaiting_review'`, connection pairs in `state.connections`, empty errors array
    - Verification: State properties correctly reflect successful execution

  - `should add appropriate messages to the state on success`

    - Input: Valid state with successful agent response
    - Expected Output: Verify system messages contain success indicator and response message is captured
    - Verification: Messages include "Connection pairs analysis successful"

  - `should add appropriate error messages to the state on failure`

    - Input: State causing execution failure
    - Expected Output: Verify system messages contain failure indicator
    - Verification: Messages include "Connection pairs analysis failed"

  - `should clear previous node-specific errors on successful execution`
    - Input: State with pre-existing errors
    - Expected Output: Successful execution clears previous errors
    - Verification: No errors remain in the returned state

**Implementation Notes for Tests:**

- Use Vitest for testing framework (`vi.mock`, `vi.fn`, `expect`)
- Create mock initial state objects for different test scenarios
- Mock the agent invocation to control responses
- Verify proper state updates for each test case
- Test both JSON parsing and fallback regex extraction logic
- Ensure error handling tests cover API errors, timeouts, and parsing failures
- Confirm state messages are appropriately updated in all scenarios

**Test Fixtures Required:**

- `mockState`: Basic state structure with required fields
- `mockLLMResponse`: Sample JSON response with connection pairs
- `nonJsonResponse`: Sample text response containing connection pairs information
- `unparsableResponse`: Sample text without connection pairs information

### 2. Requirement Analysis Nodes Tests

_To be updated later_

### 3. Section Generation Nodes Tests

_To be updated later_

### 4. Cross-Cutting Concerns Tests

_To be updated later_

### 5. End-to-End Workflow Tests

_To be updated later_

## Test Fixtures for Document Loader Node

The following test fixtures should be created to support testing:

1. **Mock Document Buffers**:

   - `mockPdfBuffer` - Buffer representing a PDF document
   - `mockDocxBuffer` - Buffer representing a DOCX document
   - `mockTxtBuffer` - Buffer representing a TXT document
   - `mockCorruptBuffer` - Buffer representing a corrupted document

2. **Mock Supabase Responses**:

   - `successResponse` - Successful download response with metadata
   - `notFoundResponse` - 404 not found error
   - `unauthorizedResponse` - 403 unauthorized error
   - `serviceUnavailableResponse` - Service unavailable error

3. **Mock State Inputs**:
   - `baseMockState` - Basic state structure with minimal rfpDocument data
   - `completeMockState` - Complete state structure for integration tests

## Files to Be Updated/Created

- Create or update: `apps/backend/agents/proposal-generation/nodes/documentLoader.ts`
- Create or update: `apps/backend/agents/proposal-generation/nodes/__tests__/documentLoader.test.ts`

## Files to Be Deleted

- `apps/backend/agents/proposal-generation/nodes/__tests__/documentValidator.test.ts` (if it exists)

## Implementation Steps

1. Create mock fixtures for Supabase responses and document buffers
2. Implement basic document loader node test structure
3. Implement tests for successful document loading (PDF, DOCX, TXT)
4. Implement tests for error handling scenarios
5. Implement tests for state management
6. Implement integration tests with Supabase and parser
7. Create the actual document loader node implementation
8. Verify all tests pass

## Conclusion

This comprehensive test strategy ensures that the document loader node reliably fetches documents from Supabase storage, handles various formats and error conditions appropriately, and correctly updates the proposal state. The focus is on robustness and error-free performance for the MVP, providing a solid foundation for the rest of the proposal generation workflow.
