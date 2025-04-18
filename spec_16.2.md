# Specification: Task 16.2 - Implement Requirement Analysis (`solutionSoughtNode`)

## 1. Overview

This document outlines the high-level specification for the `solutionSoughtNode` within the `ProposalGenerationGraph`. The primary goal of this node is to analyze the Request for Proposal (RFP) document and the preceding deep research findings to determine the core requirements and the solution the funder is seeking.

## 2. Node Purpose

To analyze `state.rfpDocument.text` and `state.deepResearchResults` to identify and structure the **funder's desired solution**. This includes understanding:

- The core problem the funder aims to solve.
- Preferred primary and secondary solution approaches.
- Key constraints or limitations mentioned or implied.
- Explicitly unwanted or discouraged approaches.
- Success metrics or key performance indicators, if identifiable.

The output should be a structured representation suitable for informing subsequent proposal section generation.

## 3. Integration Context

- **Graph:** Part of the `ProposalGenerationGraph`.
- **State:** Operates on the `OverallProposalState`.
- **Trigger:** Executes when its status is `queued` and dependencies (e.g., `deepResearchNode` results approved via `evaluateResearchNode`) are met.
- **Precedes:** `evaluateSolutionNode`.

## 4. Core Processing Logic

1.  **Input Validation:**
    - **Check:** `state.rfpDocument.text` exists and is non-empty.
    - **Check:** `state.deepResearchResults` exists and is non-empty (or handle gracefully if legitimately empty).
    - **Action on Fail:** Log error, update `state.solutionSoughtStatus` to `error`, add details to `state.errors`, return state.
2.  **Status Update:** Set `state.solutionSoughtStatus` = `'running'`.
3.  **Prompt Preparation:**
    - Load the `solutionSoughtPrompt` template.
    - Inject `state.rfpDocument.text` and `state.deepResearchResults` into the prompt.
4.  **Agent/LLM Invocation:**
    - Call the underlying language model or agent (e.g., `createSolutionSoughtAgent`) with the prepared prompt.
5.  **Response Processing:**
    - Receive the response, expected to be a **JSON string**.
    - **Parse:** Attempt `JSON.parse()` on the response content.
    - **(Recommended) Validate:** Validate the parsed object against a predefined Zod schema for `SolutionSoughtResults`.
    - **Action on Fail:** Log parsing/validation error, update `state.solutionSoughtStatus` to `error`, add details to `state.errors`, return state.
6.  **State Update (Success):**
    - Store the parsed (and validated) analysis results in `state.solutionSoughtResults`.
    - Set `state.solutionSoughtStatus` = `'awaiting_review'` (preparing for `evaluateSolutionNode`).
    - Append relevant execution information (e.g., success message, summary of results) to `state.messages`.
    - Clear any previous errors related to this node from `state.errors`.
7.  **Return:** Return the `Partial<OverallProposalState>` containing the updates.

## 5. Expected State Changes

- `state.solutionSoughtResults`: Populated with structured requirement analysis data.
- `state.solutionSoughtStatus`: Updated to `'running'` during execution, then `'awaiting_review'` on success or `'error'` on failure.
- `state.messages`: Appended with relevant logs/outputs.
- `state.errors`: Populated if errors occur during execution.

## 6. Error Handling Scenarios

The node must gracefully handle and report errors for:

- Missing or invalid input data (`rfpDocument.text`, `deepResearchResults`).
- Errors during LLM/agent invocation (API errors, timeouts, content filtering).
- Failure to parse the LLM response as valid JSON.
- Failure of the parsed JSON to validate against the expected schema (if validation is implemented).

In all error cases, `state.solutionSoughtStatus` should be set to `'error'`, and a descriptive message added to `state.errors`.

## 7. Dependencies

- **Input Data:** Relies on successful completion and state update from `documentLoaderNode` and `deepResearchNode` (and approval from `evaluateResearchNode`).
- **Configuration:** Requires access to LLM client configuration and the `solutionSoughtPrompt` template text.
- **Output:** Provides the necessary `state.solutionSoughtResults` for the subsequent `evaluateSolutionNode`.

## 8. Success Criteria (for Task 16.2 Implementation)

- The `solutionSoughtNode` implementation exists and is correctly integrated into the `ProposalGenerationGraph`.
- The node correctly validates its input state fields (`rfpDocument.text`, `deepResearchResults`).
- The node correctly formats and uses the `solutionSoughtPrompt`.
- The node successfully invokes the underlying LLM/agent.
- The node correctly parses the expected JSON response from the LLM/agent.
- **(Stretch Goal/Best Practice):** The node validates the parsed JSON against a Zod schema.
- Upon success, the node accurately updates `state.solutionSoughtResults`, `state.solutionSoughtStatus` (to `awaiting_review`), and `state.messages`.
- The node handles all specified error scenarios gracefully, updating `state.solutionSoughtStatus` (to `error`) and `state.errors`.
- Comprehensive unit tests exist for the node, covering success paths, error handling, and various input scenarios.
- The node functions correctly within the overall application flow, using the configured checkpointer for state persistence.
