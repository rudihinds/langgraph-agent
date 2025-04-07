# Implementation Plan: Fix and Optimize RFP Document Upload (TDD Approach)

## Goal

Refactor the RFP document upload process to be reliable and performant by separating file storage from content parsing, following TDD principles. The immediate goal is to successfully store the uploaded file in Supabase Storage and link it correctly via the proposal's `metadata`, deferring text extraction.

## Phase 1: Backend Refinement (Storage Focus)

### # 1.1: Define Tests for `uploadProposalFile` Action

- [x] **Purpose:** Define the expected behavior and error conditions for the backend file upload action _before_ implementation/refinement.
- [x] **Implementation Steps:**
  1. [x] **Write Unit Test Specification:** Outline test cases for `uploadProposalFile` in a test file (e.g., `actions.test.ts`). Include:
     - [x] Happy path: Successful upload and metadata update.
     - [x] Error case: Storage upload failure.
     - [x] Error case: Database metadata fetch failure.
     - [x] Error case: Database metadata update failure.
     - [x] Error case: User authentication failure.
     - [x] Error case: Missing file or proposalId in input.
     - [x] Edge case: Merging with existing vs. empty metadata.
  2. [x] **Write Failing Unit Tests:** Implement the tests using Vitest/Jest. Mock dependencies (`supabase` client methods for storage/db, `ensureUserExists`, `cookies`). Assert expected calls to mocks and expected return values (success/error objects). These tests should initially fail or be skipped.
- [x] **Success Criteria:** A suite of failing/skipped unit tests covering the specified scenarios exists.

### # 1.2: Implement/Refine `uploadProposalFile` Action Logic

- [x] **Purpose:** Ensure the server action passes the defined tests, correctly handles storage and metadata update, and follows Supabase best practices.
- [x] **Implementation Steps:**
  1. [x] **Implement/Refine `actions.ts` > `uploadProposalFile`:** Write or adjust the code to meet the requirements defined by the tests.
  2. [x] **Adhere to Supabase Guidelines:** Ensure `createClient` is called correctly (as per `supabase/server.ts` using `cookieStore`) and that storage/database interactions use the client appropriately.
  3. [x] **Focus on Storage & Metadata:** Confirm logic only uploads the raw file and updates the `metadata` JSONB field with `rfp_document` details (`name`, `path`, `size`, `type`).
  4. [x] **Ensure No Content Reading/Logging:** Verify no file content/buffer is read or logged directly.
  5. [x] **Refine Logging:** Implement clear, distinct logs for each step (start, auth, validation, storage attempt/result, db fetch/update attempt/result).
  6. [x] **Run Tests:** Execute the unit tests written in #1.1. Iterate on the code until all tests pass.
- [x] **Success Criteria:** All unit tests for `uploadProposalFile` pass. Code review confirms adherence to Supabase guidelines and "store first" principle.

### # 1.3: Write Additional Backend Tests

- [x] **Purpose:** Cover any further edge cases or refine existing tests after implementation.
- [x] **Implementation Steps:**
  1. [x] Review the implemented code and initial tests.
  2. [x] Add tests for any scenarios missed (e.g., specific error codes from Supabase, handling of different file types/extensions if relevant).
  3. [x] Ensure adequate test coverage.
- [x] **Success Criteria:** Comprehensive unit test suite passes with good coverage.

## Phase 2: Frontend Refinement (TDD-Inspired)

### # 2.1: Define Tests for Frontend Upload Integration

- [x] **Purpose:** Define how the frontend should interact with the (now tested) backend action and handle responses. While pure TDD is harder for UI, we can test the submission logic.
- [x] **Implementation Steps:**
  1. [x] **Write Test Specification:** Outline integration tests for the submission logic within `ServerForm.tsx` or its related hook (`useProposalSubmission` if applicable). Focus on the `handleSubmit` part related to file uploads. Test cases:
     - [x] Calls `uploadProposalFile` action with correct `FormData` (mocking the action).
     - [x] Displays correct toast message on mocked success from `uploadProposalFile`.
     - [x] Displays correct toast message on mocked failure from `uploadProposalFile`.
     - [x] Sets `isSubmitting` state correctly during the process.
  2. [x] **Write Failing Integration Tests:** Implement tests using testing-library/react and Vitest/Jest. Mock the imported `uploadProposalFile` server action. Trigger form submission and assert on state changes and mock calls/toast calls.
- [x] **Success Criteria:** A suite of failing/skipped integration tests for the frontend submission logic exists.

### # 2.2: Implement/Refine Frontend Integration (`ServerForm.tsx`)

- [x] **Purpose:** Ensure the frontend component correctly calls the backend, handles state, provides feedback, and passes integration tests.
- [x] **Implementation Steps:**
  1. [x] **Implement/Refine `ServerForm.tsx` > `handleSubmit`:** Write or adjust the code related to preparing `fileData` and calling `uploadProposalFile`.
  2. [x] **Handle State & Feedback:** Ensure `isSubmitting` state covers the upload call. Implement clear loading indicators (spinner added previously) based on `isSubmitting`. Ensure toast messages accurately reflect the _storage_ operation outcome.
  3. [x] **Confirm Raw File:** Double-check that the raw `file` object is appended to `FormData`.
  4. [x] **Run Tests:** Execute the integration tests from #2.1. Iterate until they pass.
- [x] **Success Criteria:** Frontend integration tests pass. UI provides clear feedback during upload.

## Phase 3: Verification & Documentation

### # 3.1: Manual End-to-End Test (RFP Upload)

- [x] **Purpose:** Verify the complete, refactored RFP upload flow from the user's perspective _after_ backend/frontend logic is tested.
- [x] **Implementation Steps:**
  1. [x] Start the application locally.
  2. [x] Navigate through the UI to create a new RFP-type proposal.
  3. [x] Upload a **small-to-medium sized PDF** file (< 5MB).
  4. [x] Observe the UI feedback (loading states, toasts).
  5. [x] Check the browser's developer console for errors or relevant logs.
  6. [x] **After successful UI indication:**
     - [x] Check Supabase Storage to confirm the file exists in the correct path.
     - [x] Check the `proposals` table. Verify the `metadata` column contains the `rfp_document` object with accurate `name`, `path`, `size`, and `type`.
  7. [x] (Optional) Repeat with a slightly larger file.
- [x] **Success Criteria:** File is successfully uploaded and linked in metadata. UI feedback is accurate. No garbled text appears. Hanging issue mitigated.

### # 3.2: Document Asynchronous Parsing Task

- [x] **Purpose:** Formally plan for the deferred text extraction task in the main project documentation.
- [x] **Implementation Steps:**
  1. [x] Create/update entry in `TASK.md`.
  2. [x] **Title:** "Implement Asynchronous RFP/Document Content Parsing".
  3. [x] **Description:** Explain need, strategy (parse _after_ storage), triggers, tools (`pdf-parse`), storage location (`proposals.metadata.rfp_extracted_text`).
  4. [x] Mark as deferred.
- [x] **Success Criteria:** Clear task for future parsing exists in `TASK.md`.

## Phase 4: (Deferred) Implement Asynchronous Parsing

- [ ] Build the background process described in Task #3.2.

---
