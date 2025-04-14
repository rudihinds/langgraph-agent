# Document Loader Specification - Implementation Plan

## Overview

The Document Loader is the first node in the Research Agent graph, responsible for retrieving document content from Supabase storage, parsing text from various file formats, and preparing the document for analysis.

## Implementation Tasks

### 1. Core Requirements

- [x] Fix import path resolution (add .js extensions for ESM compatibility)
- [ ] Define comprehensive state interface with proper types
- [ ] Implement Supabase storage integration with proper authentication
- [ ] Create document parsing utilities for different file formats
- [ ] Add error handling with proper state updates

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

- [ ] Create parser utility for supported document types (PDF, DOCX, TXT)
- [ ] Extract text content and metadata from documents
- [ ] Handle various file formats with graceful fallbacks
- [ ] Implement content validation to ensure quality

### 5. Document Loader Node

- [x] Update node implementation with proper error handling
- [x] Integrate with Supabase storage client
- [x] Update state with document content or error information
- [x] Implement status transitions based on loading result

### 6. Testing Strategy

- [ ] Create unit tests for Supabase client:
  - [ ] Successful document download
  - [ ] Document not found error
  - [ ] Authentication error
  - [ ] Network error handling
  - [ ] Retry logic verification
- [ ] Mock Supabase responses for reliable tests
- [ ] Test document parser with various document types
- [ ] Test integration with LangGraph state management

### 7. Environment Setup

- [ ] Add required environment variables:
  ```
  SUPABASE_URL=https://your-project.supabase.co
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  ```
- [ ] Create environment variable validation utility
- [ ] Document setup requirements in README

## Supabase Storage Configuration

- [ ] Create private storage bucket named `proposal-documents`
- [ ] Implement Row Level Security (RLS) policies:

  ```sql
  -- Allow users to read their own documents
  CREATE POLICY "Users can read their own documents"
  ON storage.objects
  FOR SELECT
  USING (
    auth.uid() = (
      SELECT user_id FROM proposals
      WHERE id::text = regexp_replace(storage.foldername(name), '^documents/(.*?)/', '\1')
    )
  );

  -- Service role has full access
  CREATE POLICY "Service role has full access to documents"
  ON storage.objects
  USING (
    auth.role() = 'service_role'
  );
  ```

- [ ] Document expected storage structure (e.g., `documents/{document_id}.pdf`)

## Implementation Steps

1. [ ] Create Supabase client implementation

   ```typescript
   // apps/backend/lib/supabase/client.ts
   import { createClient } from "@supabase/supabase-js";

   export function createSupabaseClient(config?: Partial<SupabaseConfig>) {
     const supabaseUrl = config?.supabaseUrl || process.env.SUPABASE_URL;
     const supabaseKey =
       config?.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

     // Validate required configuration
     if (!supabaseUrl || !supabaseKey) {
       throw new Error("Missing Supabase configuration");
     }

     return createClient(supabaseUrl, supabaseKey);
   }
   ```

2. [ ] Create document parser utility

   ```typescript
   // apps/backend/lib/documents/parser.ts
   export async function parseRfpFromBuffer(buffer: Buffer): Promise<{
     text: string;
     metadata: Record<string, any>;
   }> {
     // Implementation for different document formats
   }
   ```

3. [ ] Update document loader node

   ```typescript
   // apps/backend/agents/research/nodes.ts
   export async function documentLoaderNode(
     state: ResearchState
   ): Promise<Partial<ResearchState>> {
     try {
       // Extract document ID from state
       const { id } = state.rfpDocument;

       // Initialize Supabase client
       const supabase = createSupabaseClient();

       // Download document from Supabase storage
       const { data: documentBuffer, error } = await supabase.storage
         .from("proposal-documents")
         .download(`documents/${id}.pdf`);

       // Handle errors and parse document
       // ...
     } catch (error) {
       // Error handling
     }
   }
   ```

4. [ ] Create comprehensive tests

   ```typescript
   // apps/backend/agents/research/__tests__/document-loader.test.ts
   describe("Document Loader Node", () => {
     it("should successfully load a document from Supabase storage", async () => {
       // Test implementation
     });

     it("should handle document not found errors", async () => {
       // Test implementation
     });

     // Additional tests
   });
   ```

## Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.39.3",
    "pdf-parse": "^1.1.1"
  }
}
```

## Required Environment Variables

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```
