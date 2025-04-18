# Implementation Plan for Document Loader

This document outlines the implementation plan for the RFP document loader component, following Test-Driven Development (TDD) methodology. The tests have already been written in `apps/backend/agents/proposal-generation/nodes/__tests__/documentLoader.test.ts`, and we'll use them as the guide for our implementation.

## Key Files

- `apps/backend/agents/proposal-generation/nodes/documentLoader.ts` - Main implementation file
- `apps/backend/state/proposal.state.ts` - State interface definition
- `apps/backend/lib/utils/fileHandling.ts` - Utility file for file operations (to be created)
- `apps/backend/lib/utils/events.ts` - Event handling utilities (to be created)
- `apps/backend/lib/parsers/index.ts` - Document parser utilities (to be created)

## Tasks and Subtasks

### 1. Setup State Interface

- [ ] Define/update `OverallProposalState` interface in `state/proposal.state.ts`
  - [ ] Ensure `rfpDocument` field has correct structure with `id`, `fileName`, `text`, `metadata`, and `status` fields
  - [ ] Define proper status enum values (`not_started`, `loading`, `loaded`, `error`)
  - **Success Criteria**: State correctly represents document loading status and content

### 2. Implement Core Document Loader

- [ ] Create `documentLoader.ts` implementing the node function
  - [ ] Implement file existence checking logic with proper error handling
  - [ ] Implement file reading functionality (Refer to test: "should load PDF documents successfully")
  - [ ] Implement state updating with content and status changes
  - **Success Criteria**: Function correctly loads file and updates state as per test expectations

### 3. Implement File Type Support

- [ ] Create parsing logic for PDF files
  - [ ] **Research Note**: Perform online research using Brave MCP to identify best PDF parsing package for Node.js
  - [ ] Implement PDF content extraction (Refer to test: "should load PDF documents successfully")
  - **Success Criteria**: PDF files load with properly extracted text content
- [ ] Create parsing logic for DOCX files
  - [ ] **Research Note**: Perform online research using Brave MCP to identify best DOCX parsing package for Node.js
  - [ ] Implement DOCX content extraction (Refer to test: "should load DOCX documents successfully")
  - **Success Criteria**: DOCX files load with properly extracted text content
- [ ] Create parsing logic for TXT files
  - [ ] Implement plain text handling (Refer to test: "should load TXT documents successfully")
  - **Success Criteria**: Text files load correctly with plain text content

### 4. Implement Error Handling

- [ ] Implement non-existent file path handling
  - [ ] Add `fs.promises.access` check (Refer to test: "should handle non-existent file paths")
  - [ ] Update state with proper error details
  - **Success Criteria**: Errors properly captured and state updated accordingly
- [ ] Implement corrupt file handling
  - [ ] Add try/catch blocks around file reading (Refer to test: "should handle corrupt document files")
  - [ ] Ensure specific error message for corrupt files
  - **Success Criteria**: Corrupt files properly identified and handled
- [ ] Implement unsupported file format handling
  - [ ] Add file extension checking logic (Refer to test: "should handle unsupported file formats")
  - [ ] Update state with appropriate error message
  - **Success Criteria**: Unsupported formats rejected with clear error message

### 5. Implement Event Handling

- [ ] Create event emission system for document loading
  - [ ] Implement `document-loading-started` event (Refer to test: "should emit correct events during loading process")
  - [ ] Implement `document-loading-completed` event
  - [ ] Add event payload with relevant document information
  - **Success Criteria**: Events emitted with correct timing and payload

### 6. Testing and Optimization

- [ ] Fix linter errors related to import paths
  - [ ] Add explicit file extensions to imports
  - [ ] Ensure types are properly defined to avoid "implicitly 'any' type" warnings
  - **Success Criteria**: No linter errors in the test or implementation files
- [ ] Run tests to verify implementation
  - [ ] Ensure all test cases pass
  - [ ] Verify code coverage metrics
  - **Success Criteria**: 100% pass rate and >85% code coverage

### 7. Integration with LangGraph

- [ ] Ensure node function signature matches LangGraph requirements
  - [ ] Use proper state annotation handling
  - [ ] Return state in the expected format
  - **Success Criteria**: Node integrates cleanly with the overall graph

### 8. Documentation

- [ ] Add JSDoc comments to the node function
  - [ ] Document purpose, parameters, return value, and exceptions
  - [ ] Include example usage
  - **Success Criteria**: Comprehensive and clear documentation
- [ ] Add inline comments for complex logic
  - [ ] Explain file format detection logic
  - [ ] Document error handling approach
  - **Success Criteria**: Code is well-documented and maintainable

## Dependencies and Research Items

1. **PDF Parsing Library**

   - Options to consider: pdf-parse, pdf.js-extract, pdf-lib
   - Requirements: Works in Node.js, handles various PDF formats, has good error handling
   - **Action**: Perform online research using Brave MCP to identify best option

2. **DOCX Parsing Library**

   - Options to consider: mammoth, docx, docx4js
   - Requirements: Extracts plain text properly, handles various DOCX formats
   - **Action**: Perform online research using Brave MCP to identify best option

3. **Event Handling System**
   - Determine whether to use Node's built-in EventEmitter or a custom solution
   - Requirements: Must work with LangGraph's architecture, should be testable
   - **Action**: Review existing codebase to identify the standard event pattern

## Success Metrics

1. All tests in `documentLoader.test.ts` pass
2. Code coverage of implementation file is above 85%
3. Implementation satisfies all LangGraph integration requirements
4. Document loader handles all specified file types correctly
5. Error handling is robust and provides useful error messages
6. Events are properly emitted for monitoring and integration purposes
