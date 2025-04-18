# Document Loader Node Implementation Plan (Task 16.1)

This document outlines the detailed steps required to implement the `documentLoaderNode` function located in `apps/backend/agents/proposal-generation/nodes/documentLoader.ts`, based on the requirements derived from the TDD test suite (`documentLoader.test.ts`).

## Implementation Tasks

### 1. Setup & Dependencies

- [ ] **Import necessary modules:**
  - `OverallProposalState` from `@/state/proposal.state.js`
  - `serverSupabase` from `@/lib/supabase/client.js` (or appropriate client instance)
  - `parseRfpFromBuffer` from `@/lib/parsers/rfp.js`
  - `fs.promises` for temporary file handling
  - `path` for temporary file path construction
  - `os` for temporary directory location
  - `Buffer` from Node.js built-ins
  - Logger instance from `@/lib/logger`
  - `AppError` or error handling utilities if applicable (you may need to look into this. if you find a different utility update this file for future reference)
- [ ] **Define Node Function Signature:**

  ```typescript
  import { OverallProposalState } from "@/state/proposal.state.js";

  export async function documentLoaderNode(
    state: OverallProposalState
  ): Promise<Partial<OverallProposalState>> {
    // Implementation...
  }
  ```

- [ ] **Establish Supabase Client Access:** Confirm how the `serverSupabase` client (or equivalent authenticated instance) is accessed within the node's context.

### 2. Input Validation & Initial State

- [ ] **Get Document ID:** Safely access `state.rfpDocument.id`.
- [ ] **Validate Document ID:** Check if `rfpDocument.id` exists. If not:
  - Log an error.
  - Update state: `rfpDocument.status = 'error'`, add descriptive error to `state.errors`.
  - Return the updated error state.
- [ ] **Update Status:** Set `state.rfpDocument.status = 'loading'`.
- [ ] **Log Start:** Log an informational message indicating the node execution start with the document ID.

### 3. File Path Construction

- [ ] **Define Supabase Bucket:** Use constant or config value `'proposal-documents'`.
- [ ] **Construct Supabase Path:** Create the storage path (e.g., `documents/${state.rfpDocument.id}`). **Note:** This assumes the ID is the filename; adjust if a separate filename is provided in the state (`state.rfpDocument.fileName`).
- [ ] **Determine Temporary File Extension:** Extract the file extension (e.g., `.pdf`, `.docx`) from `state.rfpDocument.fileName` if available. This is primarily for OS/tool compatibility when saving the temporary file. **The MIME type will be used for actual parsing.**
- [ ] **Construct Temporary File Path:** Create a unique temporary file path using `os.tmpdir()`, a unique identifier (e.g., `uuid` or `Date.now()`), and the determined file extension (e.g., `/tmp/rfp-download-${Date.now()}.pdf`).

### 4. Document Download (Supabase)

- [ ] **Wrap in Try/Catch/Finally:** Enclose download, parsing, and state update logic.
- [ ] **Call Supabase Download:**
  ```typescript
  const { data: blob, error: downloadError } = await serverSupabase.storage
    .from("proposal-documents") // Use constant/config
    .download(storagePath); // Constructed path
  ```
- [ ] **Handle Download Errors:**
  - Check `downloadError`.
  - If `downloadError.status === 404`: Update state (`error`, "Document not found (404)"), log, call cleanup, return error state.
  - If `downloadError.status === 403`: Update state (`error`, "Permission denied (403)"), log, call cleanup, return error state.
  - For other `downloadError` or exceptions during download: Update state (`error`, "Failed to download document from storage"), log error details, call cleanup, return error state.
- [ ] **Check for Empty Blob:** If `!blob`, handle as an unexpected error (update state, log, cleanup, return).
- [ ] **Extract MIME Type:** Get the MIME type from the downloaded Blob: `const mimeType = blob.type;`. Log the detected MIME type. Handle cases where `blob.type` might be empty or generic (e.g., `application/octet-stream`) if necessary, potentially falling back to extension or requiring explicit type from state if robust handling is needed.
- [ ] **Convert Blob to Buffer:**
  ```typescript
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  ```
- [ ] **Write to Temporary File:**
  ```typescript
  await fs.promises.writeFile(tempFilePath, buffer);
  ```
  - Handle potential `writeFile` errors (log, update state, cleanup, return).

### 5. Document Parsing (`parseRfpFromBuffer`)

- [ ] **Validate MIME Type:** Check if the extracted `mimeType` is supported (e.g., `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`). If not supported: update state (`error`, `Unsupported MIME type: ${mimeType}`), log, cleanup, return.
- [ ] **Call Parser:**
  ```typescript
  const parsedResult = await parseRfpFromBuffer(buffer, mimeType, storagePath);
  // Pass buffer directly, *mimeType*, and storagePath as context/source
  ```
- [ ] **Handle Parsing Errors:** (Inside the main try block, or a nested one if preferred)
  - Catch errors thrown by `parseRfpFromBuffer`.
  - If error indicates corrupted file: Update state (`error`, "Parsing error: Corrupted document"), log, call cleanup, return error state.
  - For other parsing errors: Update state (`error`, "Failed to parse document content"), log error details, call cleanup, return error state.

### 6. Successful State Update

- [ ] **Update `rfpDocument` State:**
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
- [ ] **Log Success:** Log an informational message indicating successful loading and parsing.

### 7. Cleanup

- [ ] **Implement `finally` Block:** Ensure cleanup runs regardless of success or failure.
- [ ] **Check if `tempFilePath` exists:** Only attempt unlink if the path was defined.
- [ ] **Delete Temporary File:**
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

- [ ] Ensure the node function returns the appropriately modified `Partial<OverallProposalState>`.

## Success Criteria

The `documentLoaderNode` implementation will be considered successful and complete when the following criteria are met:

1.  **All Tests Pass:** All unit tests defined in `apps/backend/agents/proposal-generation/nodes/__tests__/documentLoader.test.ts` pass consistently (Note: Tests might need slight updates to mock/verify MIME type handling).
2.  **Format Support (via MIME Type):** The node successfully downloads and triggers parsing for files identified by supported MIME types (e.g., `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`) from Supabase.
3.  **Content Extraction:** Extracted text content is correctly placed into `state.rfpDocument.text`.
4.  **Metadata Handling:** Parser-generated metadata is correctly merged into `state.rfpDocument.metadata`. (Supabase metadata merging is optional but desirable).
5.  **State Updates (Success):** Upon successful download and parsing, `state.rfpDocument.status` is set to `'loaded'`, `text` and `metadata` are populated, and relevant previous errors are cleared.
6.  **Error Handling (Supabase):**
    - File Not Found (404) errors result in `state.rfpDocument.status = 'error'` and a descriptive message in `state.errors`.
    - Permission Denied (403) errors result in `state.rfpDocument.status = 'error'` and a descriptive message in `state.errors`.
    - Network/Service errors during download result in `state.rfpDocument.status = 'error'` and a descriptive message in `state.errors`.
7.  **Error Handling (Parsing):**
    - Errors from `parseRfpFromBuffer` (e.g., corrupted file, unsupported format) result in `state.rfpDocument.status = 'error'` and a descriptive message in `state.errors`.
8.  **Input Validation:** Missing `state.rfpDocument.id` results in an immediate error state return.
9.  **Cleanup:** The temporary file created for the downloaded document is reliably deleted after node execution finishes, whether it succeeded or failed.
10. **Logging:** Informative logs are generated for start, success, errors (including specific error details), and cleanup warnings.
11. **Integration Ready:** The node function adheres to the expected signature and state update patterns required for integration into the LangGraph `ProposalGenerationGraph`.

# DocumentLoader Node Integration Test Plan

## Overview

This document outlines the integration testing strategy for the `documentLoaderNode` to ensure it correctly interfaces with Supabase for document retrieval and the RFP parser for content extraction.

## Key Components Under Test

1. **Supabase Integration:** Document retrieval from storage buckets
2. **MIME Type Detection:** Correctly identifying document formats
3. **Parser Integration:** Using `parseRfpFromBuffer` with the right parameters
4. **State Management:** Properly updating the `OverallProposalState`
5. **Error Handling:** Gracefully handling various failure scenarios

## Test Environment Setup

### File Structure

```
apps/backend/agents/proposal-generation/nodes/__tests__/integration/
├── fixtures/                  # Test documents
│   ├── test.pdf              # Sample PDF file
│   ├── test.docx             # Sample DOCX file
│   └── test.txt              # Sample TXT file
├── documentLoader.integration.test.ts  # Integration test file
└── setup.ts                  # Test environment setup helpers
```

### Mock Strategy

Based on our learnings with Vitest mocking, we'll use the following approach:

```typescript
// Mock functions using vi.hoisted() to ensure proper hoisting
const mockDownload = vi.hoisted(() => vi.fn());
const mockFrom = vi.hoisted(() =>
  vi.fn().mockReturnValue({ download: mockDownload })
);
const parseRfpFromBufferMock = vi.hoisted(() => vi.fn());

// Mock modules correctly including both default and named exports where needed
vi.mock("@/lib/supabase/client.js", () => ({
  serverSupabase: {
    storage: {
      from: mockFrom,
    },
  },
}));

vi.mock("@/lib/parsers/rfp.js", () => ({
  parseRfpFromBuffer: parseRfpFromBufferMock,
}));

// For Node.js built-ins, ensure the full structure matches import patterns
vi.mock("fs", () => {
  return {
    default: {
      promises: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
      },
    },
    promises: {
      writeFile: vi.fn().mockResolvedValue(undefined),
      unlink: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Similar structure for path and os modules
```

## Test Cases

### 1. Successful Document Processing Flow

#### PDF Documents

```typescript
it("should successfully retrieve and parse a PDF document", async () => {
  // Arrange: Create sample PDF blob with appropriate MIME type
  const pdfBlob = new MockBlob(samplePdfBuffer, "application/pdf");
  mockDownload.mockResolvedValue({
    data: pdfBlob,
    error: null,
  });

  // Mock successful parser response
  parseRfpFromBufferMock.mockResolvedValue({
    text: "Sample PDF content",
    metadata: { format: "pdf", title: "Test Document" },
  });

  const testState = createTestState("test-pdf-id");

  // Act
  const result = await documentLoaderNode(testState as OverallProposalState);

  // Assert
  expect(mockFrom).toHaveBeenCalledWith("proposal-documents");
  expect(parseRfpFromBufferMock).toHaveBeenCalled();
  expect(result.rfpDocument?.status).toBe("loaded");
  expect(result.rfpDocument?.text).toBe("Sample PDF content");
  expect(result.rfpDocument?.metadata?.mimeType).toBe("application/pdf");
  expect(result.rfpDocument?.metadata?.format).toBe("pdf");
});
```

#### DOCX Documents

Similar to PDF test but with DOCX MIME type and content.

#### Text Documents

Similar to PDF test but with text/plain MIME type and content.

### 2. Error Handling Flows

#### Supabase Error Handling

```typescript
it("should handle Supabase storage errors appropriately", async () => {
  // Test different error scenarios (404, 403, service errors)
});
```

#### Parser Error Handling

```typescript
it("should handle document parsing errors gracefully", async () => {
  // Test scenarios where parser throws different types of errors
});
```

#### Empty or Corrupted Documents

```typescript
it("should handle empty or corrupted documents properly", async () => {
  // Test scenarios with empty or malformed documents
});
```

## Integration with Real Components (Optional)

For a true integration test, we could set up:

1. **Local Supabase Docker Environment**

   - Create a test bucket
   - Upload test documents
   - Configure minimal permissions

2. **Actual Parse Implementation**
   - Use the real parser with controlled test files

However, this approach has drawbacks:

- More complex setup
- Slower test execution
- Potential for external dependencies to cause false failures

A pragmatic approach would use deep mocks as described above, with selective real component tests for critical paths.

## Implementation Recommendations

### 1. Mock Design Best Practices

- Create realistic blob responses that match Supabase's structure
- Ensure MIME types are correctly set in test blobs
- Structure mocks to match the actual module interfaces

### 2. Test Helper Functions

```typescript
// Create a well-structured mock blob
function createMockBlob(content: Uint8Array, mimeType: string): MockBlob {
  return new MockBlob(content, mimeType);
}

// Create test state with specific document ID
function createTestState(documentId: string): Partial<OverallProposalState> {
  return {
    userId: "test-user",
    rfpDocument: {
      id: documentId,
      fileName: `test-document.${
        mimeType === "application/pdf"
          ? "pdf"
          : mimeType ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            ? "docx"
            : "txt"
      }`,
      status: "not_started",
      metadata: {},
    },
    errors: [],
  };
}
```

### 3. Testing Utilities

- Create a `MockBlob` class that behaves like the Blob returned by Supabase
- Implement helper functions for common assertions
- Set up shared before/after hooks for test preparation and cleanup

## Execution Plan

1. **Create Test Directory Structure**

   - Set up integration test folder and fixture storage

2. **Implement Mock Classes**

   - Create `MockBlob` with proper interface

3. **Write Base Test Helpers**

   - Implement state creation and assertion utilities

4. **Implement Test Cases**

   - Start with happy path scenarios
   - Add error handling scenarios
   - Add edge cases

5. **Configure Test Running**
   - Set up npm script for integration tests
   - Configure Vitest for integration test environment

## Conclusion

This integration test plan provides a comprehensive strategy for verifying the `documentLoaderNode`'s functionality within the ecosystem of components. By using proper mocking patterns and realistic test scenarios, we can ensure the node functions correctly across various document types and error conditions.

By implementing these tests, we'll have confidence that the document loading capabilities of the proposal generation system work reliably across all supported formats and handle error conditions gracefully.
