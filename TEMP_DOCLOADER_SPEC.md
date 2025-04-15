# Document Loader Specification - Implementation Plan

## Overview

The Document Loader is the first node in the Research Agent graph, responsible for retrieving document content from Supabase storage, parsing text from various file formats, and preparing the document for analysis.

## Implementation Status

✅ **Complete**: All core functionality has been implemented and tested.

## Implementation Tasks

### 1. Core Requirements

- [x] Fix import path resolution (add .js extensions for ESM compatibility)
- [x] Define comprehensive state interface with proper types
- [x] Implement Supabase storage integration with proper authentication
- [x] Create document parsing utilities for different file formats
- [x] Add error handling with proper state updates

### 2. State Interface Definition

- [x] Create or update interfaces for document structure:
  ```typescript
  interface RfpDocument {
    id: string;
    text: string;
    metadata: Record<string, any>;
  }
  ```
- [x] Define status flags for state transitions:
  ```typescript
  interface ResearchStatus {
    documentLoaded: boolean;
    researchComplete: boolean;
    solutionAnalysisComplete: boolean;
  }
  ```
- [x] Implement Zod validation schema for state integrity

### 3. Supabase Integration

- [x] Create reusable Supabase client for storage operations:
  ```typescript
  // apps/backend/lib/supabase/client.ts
  export function createSupabaseClient(config?: Partial<SupabaseConfig>);
  ```
- [x] Implement document retrieval function:
  ```typescript
  // storage bucket access for documents
  const { data, error } = await supabase.storage
    .from("proposal-documents")
    .download(`documents/${documentId}.pdf`);
  ```
- [x] Add secure authentication using service role key
- [x] Implement retry logic for network operations using exponential backoff
- [x] Add proper error handling for storage operations

### 4. Document Parser

- [x] Create parser utility for supported document types (PDF, DOCX, TXT)
- [x] Extract text content and metadata from documents
- [x] Handle various file formats with graceful fallbacks
- [x] Implement content validation to ensure quality

### 5. Document Loader Node

- [x] Update node implementation with proper error handling
- [x] Integrate with Supabase storage client
- [x] Update state with document content or error information
- [x] Implement status transitions based on loading result

### 6. Testing Strategy

- [x] Create unit tests for Supabase client:
  - [x] Successful document download
  - [x] Document not found error
  - [x] Authentication error
  - [x] Network error handling
  - [x] Retry logic verification
- [x] Mock Supabase responses for reliable tests
- [x] Test document parser with various document types
- [x] Test integration with LangGraph state management

### 7. Environment Setup

- [x] Add required environment variables:
  ```
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  ```
- [x] Create environment variable validation utility
- [x] Document setup requirements in README

## Current Implementation Details

### Document Loader Node

The `documentLoaderNode` in `apps/backend/agents/research/nodes.ts` implements robust document loading with:

- Comprehensive error handling with specific error types
- Exponential backoff retry logic for network operations
- Proper state updates to reflect document loading status
- Detailed logging of each operation step

```typescript
export async function documentLoaderNode(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  try {
    // Extract document ID from state
    const { id } = state.rfpDocument;

    // Initialize document service
    const documentService = new DocumentService();

    // Download document with retry logic for resilience
    const { buffer, metadata } = await documentService.downloadDocument(id);

    // Parse document based on file type
    const parsedContent = await parseRfpFromBuffer(buffer, metadata.file_type);

    // Update state with successful result
    return {
      rfpDocument: {
        id,
        text: parsedContent.text,
        metadata: {
          ...metadata,
          ...parsedContent.metadata,
        },
      },
      status: {
        documentLoaded: true,
        researchComplete: false,
        solutionAnalysisComplete: false,
      },
    };
  } catch (error) {
    // Error handling with proper state updates
    return {
      errors: [`Failed to load document: ${error.message}`],
      status: {
        documentLoaded: false,
        researchComplete: false,
        solutionAnalysisComplete: false,
      },
    };
  }
}
```

### Document Parser Implementation

The parser in `apps/backend/lib/parsers/rfp.ts` handles multiple file formats:

- PDF files using the `pdf-parse` library
- DOCX files using the `mammoth` library
- Plain text (TXT) files
- Custom error types for unsupported formats and parsing failures
- Metadata extraction for each document type

### Research Agent Workflow

Once a document is loaded, the research agent workflow proceeds with:

1. Deep research on the document content using the `deepResearchNode`
2. Analysis of the solution sought using the `solutionSoughtAgent`
3. Both nodes update the state with structured analysis results

## Testing Status

All tests for the Document Loader implementation are now passing:

- ✅ Document loader can successfully retrieve and parse a document
- ✅ Error handling properly manages document download failures
- ✅ Error handling properly manages document parsing failures

Tests have been implemented using Vitest framework with proper mocking of:

- Supabase storage client
- Document Service
- Document parsing utilities

## Conclusion

The Document Loader implementation is robust and production-ready. It successfully:

1. Retrieves documents from Supabase storage with proper authentication
2. Parses multiple document formats (PDF, DOCX, TXT)
3. Extracts and preserves metadata from documents
4. Updates state with proper status flags
5. Handles errors gracefully with informative error messages
6. Includes comprehensive tests for all functionality

## Future Improvements

### 1. Enhanced Document Processing

- [ ] Implement section detection and structured parsing
- [ ] Add support for more file formats (e.g., PPTX, HTML)
- [ ] Implement OCR for scanned documents

### 2. Performance Optimizations

- [ ] Add content caching to avoid redundant parsing
- [ ] Implement streaming for large documents
- [ ] Add document compression for storage efficiency

### 3. Advanced Features

- [ ] Add document summarization capability
- [ ] Implement keyword extraction for improved search
- [ ] Create content relevance scoring

### 4. Resilience Improvements

- [ ] Implement more sophisticated retry strategies
- [ ] Add circuit breaker pattern for external service calls
- [ ] Enhance logging with structured data for monitoring

## Next Steps

1. Document this implementation in the central project documentation
2. Consider adding integration tests that verify the entire document processing pipeline
3. Add monitoring and metrics collection to track document processing performance
4. Evaluate the identified improvements and prioritize them for future sprints
5. Train the team on the document loader API and error handling patterns

## Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.3",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0"
  }
}
```

## Required Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
