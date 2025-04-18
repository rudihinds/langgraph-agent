# Document Loader Node Implementation Plan (Task 16.1)

This document outlines the detailed steps required to implement the `documentLoaderNode` function located in `apps/backend/agents/proposal-generation/nodes/documentLoader.ts`, based on the requirements derived from the TDD test suite (`documentLoader.test.ts`).

## Implementation Tasks

### 1. Setup & Dependencies

- [x] **Import necessary modules:**
  - `OverallProposalState` from `@/state/proposal.state.js`
  - `serverSupabase` from `@/lib/supabase/client.js` (or appropriate client instance)
  - `parseRfpFromBuffer` from `@/lib/parsers/rfp.js`
  - `fs.promises` for temporary file handling
  - `path` for temporary file path construction
  - `os` for temporary directory location
  - `Buffer` from Node.js built-ins
  - Logger instance from `@/lib/logger`
  - `AppError` or error handling utilities if applicable (you may need to look into this. if you find a different utility update this file for future reference)
- [x] **Define Node Function Signature:**

  ```typescript
  import { OverallProposalState } from "@/state/proposal.state.js";

  export async function documentLoaderNode(
    state: OverallProposalState
  ): Promise<Partial<OverallProposalState>> {
    // Implementation...
  }
  ```

- [x] **Establish Supabase Client Access:** Confirm how the `serverSupabase` client (or equivalent authenticated instance) is accessed within the node's context.

### 2. Input Validation & Initial State

- [x] **Get Document ID:** Safely access `state.rfpDocument.id`.
- [x] **Validate Document ID:** Check if `rfpDocument.id` exists. If not:
  - Log an error.
  - Update state: `rfpDocument.status = 'error'`, add descriptive error to `state.errors`.
  - Return the updated error state.
- [x] **Update Status:** Set `state.rfpDocument.status = 'loading'`.
- [x] **Log Start:** Log an informational message indicating the node execution start with the document ID.

### 3. File Path Construction

- [x] **Define Supabase Bucket:** Use constant or config value `'proposal-documents'`.
- [x] **Construct Supabase Path:** Create the storage path (e.g., `documents/${state.rfpDocument.id}`). **Note:** This assumes the ID is the filename; adjust if a separate filename is provided in the state (`state.rfpDocument.fileName`).
- [x] **Determine Temporary File Extension:** Extract the file extension (e.g., `.pdf`, `.docx`) from `state.rfpDocument.fileName` if available. This is primarily for OS/tool compatibility when saving the temporary file. **The MIME type will be used for actual parsing.**
- [x] **Construct Temporary File Path:** Create a unique temporary file path using `os.tmpdir()`, a unique identifier (e.g., `uuid` or `Date.now()`), and the determined file extension (e.g., `/tmp/rfp-download-${Date.now()}.pdf`).

### 4. Document Download (Supabase)

- [x] **Wrap in Try/Catch/Finally:** Enclose download, parsing, and state update logic.
- [x] **Call Supabase Download:**
  ```typescript
  const { data: blob, error: downloadError } = await serverSupabase.storage
    .from("proposal-documents") // Use constant/config
    .download(storagePath); // Constructed path
  ```
- [x] **Handle Download Errors:**
  - Check `downloadError`.
  - If `downloadError.status === 404`: Update state (`error`, "Document not found (404)"), log, call cleanup, return error state.
  - If `downloadError.status === 403`: Update state (`error`, "Permission denied (403)"), log, call cleanup, return error state.
  - For other `downloadError` or exceptions during download: Update state (`error`, "Failed to download document from storage"), log error details, call cleanup, return error state.
- [x] **Check for Empty Blob:** If `!blob`, handle as an unexpected error (update state, log, cleanup, return).
- [x] **Extract MIME Type:** Get the MIME type from the downloaded Blob: `const mimeType = blob.type;`. Log the detected MIME type. Handle cases where `blob.type` might be empty or generic (e.g., `application/octet-stream`) if necessary, potentially falling back to extension or requiring explicit type from state if robust handling is needed.
- [x] **Convert Blob to Buffer:**
  ```typescript
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  ```
- [x] **Write to Temporary File:**
  ```typescript
  await fs.promises.writeFile(tempFilePath, buffer);
  ```
  - Handle potential `writeFile` errors (log, update state, cleanup, return).

### 5. Document Parsing (`parseRfpFromBuffer`)

- [x] **Validate MIME Type:** Check if the extracted `mimeType` is supported (e.g., `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`). If not supported: update state (`error`, `Unsupported MIME type: ${mimeType}`), log, cleanup, return.
- [x] **Call Parser:**
  ```typescript
  const parsedResult = await parseRfpFromBuffer(buffer, mimeType, storagePath);
  // Pass buffer directly, *mimeType*, and storagePath as context/source
  ```
- [x] **Handle Parsing Errors:** (Inside the main try block, or a nested one if preferred)
  - Catch errors thrown by `parseRfpFromBuffer`.
  - If error indicates corrupted file: Update state (`error`, "Parsing error: Corrupted document"), log, call cleanup, return error state.
  - For other parsing errors: Update state (`error`, "Failed to parse document content"), log error details, call cleanup, return error state.

### 6. Successful State Update

- [x] **Update `rfpDocument` State:**
  ```typescript
  return {
    ...state, // Ensure existing state is preserved
    rfpDocument: {
      ...state.rfpDocument,
      status: "loaded",
      text: parsedResult.text,
      metadata: {
        ...(state.rfpDocument.metadata || {}), // Preserve existing metadata
        ...parsedResult.metadata, // Merge parser metadata
        mimeType: mimeType, // Store the detected MIME type
        // TODO: Consider adding Supabase metadata if fetched (e.g., size, upload date)
      },
      // Ensure fileName is correctly set if derived/fetched
      fileName: state.rfpDocument.fileName || path.basename(storagePath), // Example logic
    },
    errors: state.errors?.filter((e) => !e.includes("document loading")), // Clear previous loading errors
    // Optionally add success message to state.messages
  };
  ```
- [x] **Log Success:** Log an informational message indicating successful loading and parsing.

### 7. Cleanup

- [x] **Implement `finally` Block:** Ensure cleanup runs regardless of success or failure.
- [x] **Check if `tempFilePath` exists:** Only attempt unlink if the path was defined.
- [x] **Delete Temporary File:**
  ```typescript
  try {
    if (tempFilePath) {
      // Ensure path was set
      await fs.promises.unlink(tempFilePath);
    }
  } catch (unlinkError) {
    logger.warn(
      `Failed to delete temporary file ${tempFilePath}:`,
      unlinkError
    );
    // Do not throw, just warn.
  }
  ```

### 8. Return Final State

- [x] Ensure the node function returns the appropriately modified `Partial<OverallProposalState>`.

## Implementation Status

✅ **COMPLETED:** The `documentLoaderNode` implementation has been successfully completed and all tests are passing. The implementation follows the plan outlined above and includes all the required functionality: document retrieval from Supabase, MIME type detection, temporary file handling, document parsing, and proper state updates.

## Success Criteria

The `documentLoaderNode` implementation is considered successful and complete as all of the following criteria have been met:

1. ✅ **All Tests Pass:** All unit tests defined in `apps/backend/agents/proposal-generation/nodes/__tests__/documentLoader.test.ts` pass consistently.
2. ✅ **Format Support (via MIME Type):** The node successfully downloads and triggers parsing for files identified by supported MIME types from Supabase.
3. ✅ **Content Extraction:** Extracted text content is correctly placed into `state.rfpDocument.text`.
4. ✅ **Metadata Handling:** Parser-generated metadata is correctly merged into `state.rfpDocument.metadata`.
5. ✅ **State Updates (Success):** Upon successful download and parsing, `state.rfpDocument.status` is set to `'loaded'`.
6. ✅ **Error Handling (Supabase):** All error scenarios are properly handled.
7. ✅ **Error Handling (Parsing):** Parsing errors are correctly propagated.
8. ✅ **Input Validation:** Missing document ID is properly handled.
9. ✅ **Cleanup:** Temporary files are reliably deleted.
10. ✅ **Logging:** Informative logs are generated for all scenarios.
11. ✅ **Integration Ready:** The node function adheres to the expected signature and state update patterns.

# Integration Test Plan for Document Loader Node

## Key Learning: Vitest Mocking Patterns

Through our implementation of the `documentLoaderNode` tests, we discovered important patterns for correctly mocking Node.js built-in modules and ES modules in Vitest:

1. **Mocking ES Modules with Both Default and Named Exports:**

   ```typescript
   // Need to provide both default export and named exports
   vi.mock("module-name", () => {
     return {
       default: {
         /* mock default export */
       },
       namedExport1: vi.fn(),
       namedExport2: vi.fn(),
     };
   });
   ```

2. **Properly Mocking Node.js Built-ins:**

   ```typescript
   // For fs module with nested promises property
   vi.mock("fs", () => {
     return {
       default: {
         promises: {
           writeFile: vi.fn(),
           unlink: vi.fn(),
         },
       },
       promises: {
         writeFile: vi.fn(),
         unlink: vi.fn(),
       },
     };
   });
   ```

3. **Using `vi.hoisted()` for Mock References:**

   ```typescript
   // Define mocks before vi.mock calls
   const mockFn = vi.hoisted(() => vi.fn());

   vi.mock("module-name", () => {
     return {
       someFn: mockFn, // Reference hoisted mock
     };
   });
   ```

4. **Resetting Modules Between Tests:**
   ```typescript
   beforeEach(() => {
     vi.resetModules();
   });
   ```

These patterns ensure that our mocks properly intercept both default and named imports, maintain proper nested property structures, and can be referenced properly in test assertions.

## Integration Test Strategy

For integrating the `documentLoaderNode` with the broader proposal generation system, we'll implement the following test approach:

### 1. Test Environment Structure

```
apps/backend/agents/proposal-generation/nodes/__tests__/integration/
├── fixtures/                  # Test documents
│   ├── test.pdf              # Sample PDF file
│   ├── test.docx             # Sample DOCX file
│   └── test.txt              # Sample TXT file
├── documentLoader.integration.test.ts  # Integration test file
└── setup.ts                  # Test environment setup helpers
```

### 2. Integration Test Scenarios

The integration tests will cover:

1. **Full Document Loading Flow:**

   - Test each document type (PDF, DOCX, TXT)
   - Verify state updates at each step
   - Confirm temporary file cleanup

2. **Error Handling Flows:**

   - Non-existent documents
   - Unauthorized access
   - Service unavailability
   - Parsing failures

3. **State Integration Tests:**
   - Verify that state updates correctly flow to the next node
   - Test conditional routing based on document loading status

### 3. Mock Design

For effective testing, we'll implement:

1. **MockBlob Class:**

   ```typescript
   class MockBlob {
     constructor(data: Uint8Array, type: string) {
       this.data = data;
       this.type = type;
     }

     async arrayBuffer(): Promise<ArrayBuffer> {
       return Promise.resolve(this.data.buffer);
     }
   }
   ```

2. **Helper Functions:**

   ```typescript
   // Create test state
   function createTestState(documentId: string): Partial<OverallProposalState> {
     return {
       userId: "test-user",
       rfpDocument: {
         id: documentId,
         status: "not_started",
         metadata: {},
       },
       errors: [],
     };
   }

   // Verify successful document loading
   function expectSuccessfulDocumentLoad(result) {
     expect(result.rfpDocument?.status).toBe("loaded");
     expect(result.rfpDocument?.text).toBeTruthy();
     expect(result.rfpDocument?.metadata).toBeTruthy();
   }
   ```

## Next Implementation Steps

1. **Set Up Test Fixtures:**

   - Create sample PDF, DOCX, and TXT files
   - Define mock Supabase responses

2. **Implement Mock Components:**

   - Create MockBlob class
   - Define test helper functions

3. **Write Integration Tests:**

   - Implement tests for each document type
   - Add tests for error scenarios
   - Test integration with surrounding nodes

4. **Verify Production Configuration:**
   - Check Supabase bucket configuration
   - Verify temporary file handling in production
   - Confirm error handling flows

By implementing this integration test strategy, we'll ensure that the `documentLoaderNode` not only works correctly in isolation but also integrates properly with the broader proposal generation system.
