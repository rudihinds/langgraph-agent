# Document Loader

This module provides a robust solution for loading and parsing various document formats within the Research Agent workflow.

## Overview

The Document Loader is responsible for:
1. Retrieving documents from Supabase storage
2. Parsing different file formats (PDF, DOCX, TXT)
3. Extracting text content and metadata
4. Handling errors gracefully

## Quick Start

```typescript
import { DocumentService } from "../lib/db/documents";
import { parseRfpFromBuffer } from "../lib/parsers/rfp";

async function loadDocument(documentId: string) {
  try {
    // Initialize document service
    const documentService = new DocumentService();
    
    // Download document with retry logic
    const { buffer, metadata } = await documentService.downloadDocument(documentId);
    
    // Parse document based on file type
    const parsedContent = await parseRfpFromBuffer(buffer, metadata.file_type);
    
    // Use the parsed content
    console.log(`Loaded document: ${parsedContent.text.substring(0, 100)}...`);
    console.log(`Metadata: ${JSON.stringify(parsedContent.metadata)}`);
    
    return {
      text: parsedContent.text,
      metadata: {
        ...metadata,
        ...parsedContent.metadata
      }
    };
  } catch (error) {
    console.error(`Failed to load document: ${error.message}`);
    throw error;
  }
}
```

## Supported File Formats

The parser currently supports the following file formats:

| Format | Extension | Library | Metadata Extracted |
|--------|-----------|---------|-------------------|
| PDF    | .pdf      | pdf-parse | Title, Author, Subject, Keywords, Page Count |
| DOCX   | .docx     | mammoth | Basic file info |
| TXT    | .txt      | Native  | Basic file info |

## API Reference

### `DocumentService` class

Located in `apps/backend/lib/db/documents.ts`, this class handles document retrieval from Supabase.

```typescript
// Create a document service instance
const documentService = new DocumentService();

// Download a document
const { buffer, metadata } = await documentService.downloadDocument("document-id");
```

#### Key Methods

- `downloadDocument(documentId: string)`: Retrieves a document from Supabase storage
- `getDocumentMetadata(documentId: string)`: Fetches only the document's metadata
- `listProposalDocuments(proposalId: string)`: Lists all documents for a proposal
- `getProposalDocumentByType(proposalId: string, documentType: string)`: Gets a specific document type

### `parseRfpFromBuffer` function

Located in `apps/backend/lib/parsers/rfp.ts`, this function handles document parsing.

```typescript
const result = await parseRfpFromBuffer(buffer, fileType, filePath);
```

#### Parameters

- `buffer: Buffer`: The document content as a buffer
- `fileType: string`: The file type (e.g., 'pdf', 'docx', 'txt')
- `filePath?: string`: Optional path for metadata purposes

#### Return Value

```typescript
{
  text: string;       // The extracted text content
  metadata: {         // Metadata extracted from the document
    format: string;   // The document format (pdf, docx, txt)
    // Format-specific metadata fields...
  }
}
```

## Error Handling

The library provides custom error types for specific failure scenarios:

### `UnsupportedFileTypeError`

Thrown when attempting to parse an unsupported file format.

```typescript
try {
  await parseRfpFromBuffer(buffer, 'pptx');
} catch (error) {
  if (error instanceof UnsupportedFileTypeError) {
    console.log('File format not supported');
  }
}
```

### `ParsingError`

Thrown when a supported file type fails to parse correctly.

```typescript
try {
  await parseRfpFromBuffer(buffer, 'pdf');
} catch (error) {
  if (error instanceof ParsingError) {
    console.log('Document parsing failed');
  }
}
```

## LangGraph Integration

In LangGraph workflows, the document loader is implemented as a node function:

```typescript
export async function documentLoaderNode(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  try {
    const { id } = state.rfpDocument;
    const documentService = new DocumentService();
    const { buffer, metadata } = await documentService.downloadDocument(id);
    const parsedContent = await parseRfpFromBuffer(buffer, metadata.file_type);
    
    return {
      rfpDocument: {
        id,
        text: parsedContent.text,
        metadata: {
          ...metadata,
          ...parsedContent.metadata
        }
      },
      status: {
        documentLoaded: true,
        // Other status fields...
      }
    };
  } catch (error) {
    return {
      errors: [`Failed to load document: ${error.message}`],
      status: {
        documentLoaded: false,
        // Other status fields...
      }
    };
  }
}
```

## Testing

Test files are available in:
- `apps/backend/lib/parsers/__tests__/rfp.test.ts` - Tests for parser
- `apps/backend/agents/research/__tests__/nodes.test.ts` - Tests for document loader node

When writing tests, remember to mock:
- Supabase storage client 
- PDF parsing library
- DOCX conversion library

Example of mocking document service:

```typescript
vi.mock("../../../lib/db/documents", () => {
  return {
    DocumentService: vi.fn().mockImplementation(() => ({
      downloadDocument: vi.fn().mockResolvedValue({
        buffer: Buffer.from("Test document content"),
        metadata: {
          id: "test-doc-id",
          file_type: "application/pdf",
          // Other metadata fields...
        },
      }),
    })),
  };
});
```

## Environment Setup

Required environment variables:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Performance Considerations

For best performance:
- Prefer smaller documents when possible
- Consider implementing caching for frequently accessed documents
- For very large documents, consider implementing chunking

## Future Improvements

Planned enhancements:
- Section detection and structured parsing
- Additional file format support
- OCR for scanned documents
- Document summarization capabilities