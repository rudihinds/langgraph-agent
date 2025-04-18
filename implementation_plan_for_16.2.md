# Implementation Plan: Task 16.2 - Implement Requirement Analysis (`solutionSoughtNode`)

## 1. Overview

This plan details the steps to implement and test the `solutionSoughtNode` according to `spec_16.2.md` and the test cases defined in `apps/backend/agents/research/__tests__/solutionSoughtNode.test.ts`.

We will follow **Test-Driven Development (TDD)** principles: write a failing test, write the minimum code to make it pass, and then refactor.

**Relevant Specification:** `spec_16.2.md`
**Relevant Test File:** `apps/backend/agents/research/__tests__/solutionSoughtNode.test.ts`

## 2. Key File Paths

- **Node Implementation:** `apps/backend/agents/research/nodes.js`
- **Node Tests:** `apps/backend/agents/research/__tests__/solutionSoughtNode.test.ts`
- **Agent Implementation (Dependency):** `apps/backend/agents/research/agents.js`
- **Prompt Definition (Dependency):** `apps/backend/agents/research/prompts/index.js` (or similar)
- **State Definition:** `apps/backend/state/proposal.state.ts` (or `.js`)
- **Logger:** `apps/backend/lib/logger.js`
- **(Optional) Zod Schema:** (Location TBD, likely near state or node implementation)

## 3. Implementation Tasks (TDD Cycle)

**Note:** Each step involves running the relevant test(s) from `solutionSoughtNode.test.ts` to confirm failure (Red), implementing the code, and running tests again to confirm success (Green). Refactoring follows.

- **Setup & Basic Structure:**
  - [ ] **3.1.** Ensure `solutionSoughtNode` function exists in `nodes.js` with the correct async signature (`async function solutionSoughtNode(state: OverallProposalState): Promise<Partial<OverallProposalState>>`).
  - [ ] **3.2.** Add basic logging for node entry.
  - [ ] **3.3.** Run the test suite; expect most tests to fail initially.
- **Input Validation:**
  - [ ] **3.4.** **Test:** `should handle missing rfpDocument text`
  - [ ] **3.5.** **Implement:** Add check for `state.rfpDocument?.text`. If missing/empty, log error, update state (`solutionSoughtStatus: 'error', errors: [message]`), and return the partial state.
  - [ ] **3.6.** **Test:** `should handle missing deepResearchResults`
  - [ ] **3.7.** **Implement:** Add check for `state.deepResearchResults`. If missing/empty, log error, update state (`solutionSoughtStatus: 'error', errors: [message]`), and return partial state.
- **Status Update:**
  - [ ] **3.8.** **Implement:** Set `state.solutionSoughtStatus = 'running'` immediately after input validation passes. _(Note: Testing this specific intermediate state might be difficult, focus on final state)_.
- **Prompt Formatting:**
  - [ ] **3.9.** **Implement:** Import/load `solutionSoughtPrompt` template text.
  - [ ] **3.10.** **Implement:** Inject `state.rfpDocument.text` and `JSON.stringify(state.deepResearchResults)` into the prompt template.
  - [ ] **3.11.** **Test:** `should correctly format the prompt using state data` (verify the content passed to the mocked agent).
- **Agent/LLM Invocation:**
  - [ ] **3.12.** **Implement:** Import and call `createSolutionSoughtAgent()`.
  - [ ] **3.13.** **Implement:** Wrap the `agent.invoke()` call in a `try...catch` block.
  - [ ] **3.14.** **Implement:** Pass the formatted prompt (likely wrapped in a `HumanMessage`) to `agent.invoke()`.
- **Error Handling (Invocation):**
  - [ ] **3.15.** **Test:** `should handle LLM API errors gracefully`
  - [ ] **3.16.** **Implement:** In the `catch` block, log the error, update state (`solutionSoughtStatus: 'error', errors: [detailed message]`), and return partial state.
  - [ ] **3.17.** **Test:** `should handle LLM timeouts gracefully (if applicable)`
  - [ ] **3.18.** **Implement:** Ensure the catch block handles timeout-specific errors appropriately if distinguishable.
- **Response Processing (Success Path):**
  - [ ] **3.19.** **Implement:** Extract the content from the last message of the agent response (assuming it follows the standard LangChain message format).
  - [ ] **3.20.** **Implement:** Wrap JSON parsing (`JSON.parse()`) in a `try...catch` block.
  - [ ] **3.21.** **Test:** `should successfully analyze valid RFP text and research results`
  - [ ] **3.22.** **Implement:** Store the parsed results in a variable.
- **Response Processing (Failure Path):**
  - [ ] **3.23.** **Test:** `should handle non-JSON response from LLM`
  - [ ] **3.24.** **Test:** `should handle malformed JSON response from LLM`
  - [ ] **3.25.** **Implement:** In the JSON parsing `catch` block, log the parsing error and the problematic content, update state (`solutionSoughtStatus: 'error', errors: [parsing message]`), return partial state.
- **(Optional/Recommended) Zod Validation:**
  - [ ] **3.26.** **Decision:** Define the Zod schema for the expected `solutionSoughtResults` structure.
    - **Note:** Perform online research using brave mcp if unsure about the best structure or validation details based on the prompt's expected output.
  - [ ] **3.27.** **Implement:** After successful JSON parsing, use the Zod schema's `.safeParse()` method on the result.
  - [ ] **3.28.** **Test:** `should handle JSON response not matching expected schema`
  - [ ] **3.29.** **Implement:** If `.safeParse()` fails, log the Zod error details, update state (`solutionSoughtStatus: 'error', errors: [validation message]`), return partial state.
- **State Update (Success):**
  - [ ] **3.30.** **Test:** `should correctly store parsed results in solutionSoughtResults on success`
  - [ ] **3.31.** **Implement:** Update the state object: `solutionSoughtResults` = parsed (and validated) data, `solutionSoughtStatus` = `'awaiting_review'`.
  - [ ] **3.32.** **Test:** `should add appropriate messages to the state on success`
  - [ ] **3.33.** **Implement:** Append relevant messages (e.g., a `SystemMessage` indicating success) to the `messages` array in the returned state update. Ensure the original agent response message is handled according to the state reducer logic (likely added automatically by `messagesStateReducer`).
  - [ ] **3.34.** **Test:** `should clear previous node-specific errors on successful execution`
  - [ ] **3.35.** **Implement:** Filter the `errors` array to remove any errors specifically related to _this node_ before returning the successful state update.
- **Final Return:**
  - [ ] **3.36.** Ensure the function returns the `Partial<OverallProposalState>` object containing all necessary updates.

## 4. Refactoring

- [ ] **4.1.** Review the completed node function for clarity, efficiency, and adherence to coding standards.
- [ ] **4.2.** Ensure mocks in the test file are accurate and minimal.
- [ ] **4.3.** Verify all tests pass after refactoring.

## 5. Success Criteria

Task 16.2 is complete when:

- All checkboxes in Section 3 are ticked.
- All tests in `apps/backend/agents/research/__tests__/solutionSoughtNode.test.ts` pass (`npm run test -- solutionSoughtNode.test.ts`).
- The `solutionSoughtNode` implementation adheres to the requirements outlined in `spec_16.2.md`.
- The code is clean, well-documented, and refactored.
