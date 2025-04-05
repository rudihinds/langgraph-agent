# Implementation Plan: Fix and Optimize RFP Document Upload (TDD Approach)

## Goal
Refactor the RFP document upload process to be reliable and performant by separating file storage from content parsing, following TDD principles. The immediate goal is to successfully store the uploaded file in Supabase Storage and link it correctly via the proposal's `metadata`, deferring text extraction.

## Phase 1: Backend Refinement (Storage Focus)

### # 1.1: Define Tests for `uploadProposalFile` Action
   **Purpose:** Define the expected behavior and error conditions for the backend file upload action *before* implementation/refinement.
   **Implementation Steps:**
    1.  **Write Unit Test Specification:** Outline test cases for `uploadProposalFile` in a test file (e.g., `actions.test.ts`). Include:
        *   Happy path: Successful upload and metadata update.
        *   Error case: Storage upload failure.
        *   Error case: Database metadata fetch failure.
        *   Error case: Database metadata update failure.
        *   Error case: User authentication failure.
        *   Error case: Missing file or proposalId in input.
        *   Edge case: Merging with existing vs. empty metadata.
    2.  **Write Failing Unit Tests:** Implement the tests using Vitest/Jest. Mock dependencies (`supabase` client methods for storage/db, `ensureUserExists`, `cookies`). Assert expected calls to mocks and expected return values (success/error objects). These tests should initially fail or be skipped.
   **Success Criteria:** A suite of failing/skipped unit tests covering the specified scenarios exists.

### # 1.2: Implement/Refine `uploadProposalFile` Action Logic
   **Purpose:** Ensure the server action passes the defined tests, correctly handles storage and metadata update, and follows Supabase best practices.
   **Implementation Steps:**
    1.  **Implement/Refine `actions.ts` > `uploadProposalFile`:** Write or adjust the code to meet the requirements defined by the tests.
    2.  **Adhere to Supabase Guidelines:** Ensure `createClient` is called correctly (as per `supabase/server.ts` using `cookieStore`) and that storage/database interactions use the client appropriately.
    3.  **Focus on Storage & Metadata:** Confirm logic only uploads the raw file and updates the `metadata` JSONB field with `rfp_document` details (`name`, `path`, `size`, `type`).
    4.  **Ensure No Content Reading/Logging:** Verify no file content/buffer is read or logged directly.
    5.  **Refine Logging:** Implement clear, distinct logs for each step (start, auth, validation, storage attempt/result, db fetch/update attempt/result).
    6.  **Run Tests:** Execute the unit tests written in #1.1. Iterate on the code until all tests pass.
   **Success Criteria:** All unit tests for `uploadProposalFile` pass. Code review confirms adherence to Supabase guidelines and "store first" principle.

### # 1.3: Write Additional Backend Tests
    **Purpose:** Cover any further edge cases or refine existing tests after implementation.
    **Implementation Steps:**
     1. Review the implemented code and initial tests.
     2. Add tests for any scenarios missed (e.g., specific error codes from Supabase, handling of different file types/extensions if relevant).
     3. Ensure adequate test coverage.
    **Success Criteria:** Comprehensive unit test suite passes with good coverage.

## Phase 2: Frontend Refinement (TDD-Inspired)

### # 2.1: Define Tests for Frontend Upload Integration
   **Purpose:** Define how the frontend should interact with the (now tested) backend action and handle responses. While pure TDD is harder for UI, we can test the submission logic.
   **Implementation Steps:**
    1.  **Write Test Specification:** Outline integration tests for the submission logic within `ServerForm.tsx` or its related hook (`useProposalSubmission` if applicable). Focus on the `handleSubmit` part related to file uploads. Test cases:
        *   Calls `uploadProposalFile` action with correct `FormData` (mocking the action).
        *   Displays correct toast message on mocked success from `uploadProposalFile`.
        *   Displays correct toast message on mocked failure from `uploadProposalFile`.
        *   Sets `isSubmitting` state correctly during the process.
    2.  **Write Failing Integration Tests:** Implement tests using testing-library/react and Vitest/Jest. Mock the imported `uploadProposalFile` server action. Trigger form submission and assert on state changes and mock calls/toast calls.
   **Success Criteria:** A suite of failing/skipped integration tests for the frontend submission logic exists.

### # 2.2: Implement/Refine Frontend Integration (`ServerForm.tsx`)
   **Purpose:** Ensure the frontend component correctly calls the backend, handles state, provides feedback, and passes integration tests.
   **Implementation Steps:**
    1.  **Implement/Refine `ServerForm.tsx` > `handleSubmit`:** Write or adjust the code related to preparing `fileData` and calling `uploadProposalFile`.
    2.  **Handle State & Feedback:** Ensure `isSubmitting` state covers the upload call. Implement clear loading indicators (spinner added previously) based on `isSubmitting`. Ensure toast messages accurately reflect the *storage* operation outcome.
    3.  **Confirm Raw File:** Double-check that the raw `file` object is appended to `FormData`.
    4.  **Run Tests:** Execute the integration tests from #2.1. Iterate until they pass.
   **Success Criteria:** Frontend integration tests pass. UI provides clear feedback during upload.

## Phase 3: Verification & Documentation

### # 3.1: Manual End-to-End Test (RFP Upload)
   **Purpose:** Verify the complete, refactored RFP upload flow from the user's perspective *after* backend/frontend logic is tested.
   **Implementation Steps:**
    1.  Start the application locally.
    2.  Navigate through the UI to create a new RFP-type proposal.
    3.  Upload a **small-to-medium sized PDF** file (< 5MB).
    4.  Observe the UI feedback (loading states, toasts).
    5.  Check the browser's developer console for errors or relevant logs.
    6.  **After successful UI indication:**
        *   Check Supabase Storage to confirm the file exists in the correct path.
        *   Check the `proposals` table. Verify the `metadata` column contains the `rfp_document` object with accurate `name`, `path`, `size`, and `type`.
    7.  (Optional) Repeat with a slightly larger file.
   **Success Criteria:** File is successfully uploaded and linked in metadata. UI feedback is accurate. No garbled text appears. Hanging issue mitigated.

### # 3.2: Document Asynchronous Parsing Task
   **Purpose:** Formally plan for the deferred text extraction task in the main project documentation.
   **Implementation Steps:**
    1.  Create/update entry in `TASK.md`.
    2.  **Title:** "Implement Asynchronous RFP/Document Content Parsing".
    3.  **Description:** Explain need, strategy (parse *after* storage), triggers, tools (`pdf-parse`), storage location (`proposals.metadata.rfp_extracted_text`).
    4.  Mark as deferred.
   **Success Criteria:** Clear task for future parsing exists in `TASK.md`.

## Phase 4: (Deferred) Implement Asynchronous Parsing
*   Build the background process described in Task #3.2.

---
