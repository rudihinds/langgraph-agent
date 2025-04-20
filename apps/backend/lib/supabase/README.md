# Supabase Runnable Utilities

This directory contains utilities for working with Supabase storage using LangChain's Runnable interface with built-in retry capabilities.

## Overview

The `supabase-runnable.ts` file implements LangChain Runnable wrappers around Supabase storage operations. These utilities provide:

1. **Retry Capability**: All operations automatically retry on transient errors using LangChain's `withRetry` mechanism
2. **Consistent Error Handling**: Standardized error handling for storage operations
3. **Proper Logging**: Detailed logging for debugging and monitoring
4. **Type Safety**: TypeScript interfaces for all operations

## Available Operations

The library provides three main operations:

### 1. List Files

```typescript
import { listFilesWithRetry } from "../lib/supabase/supabase-runnable.js";

// List files in a bucket
const files = await listFilesWithRetry.invoke({
  bucketName: "my-bucket",
  path: "optional/path/prefix",
  options: { limit: 100, offset: 0 }, // Optional
});
```

### 2. Download Files

```typescript
import { downloadFileWithRetry } from "../lib/supabase/supabase-runnable.js";

// Download a file
const fileBlob = await downloadFileWithRetry.invoke({
  bucketName: "my-bucket",
  path: "path/to/file.pdf",
});
```

### 3. Upload Files

```typescript
import { uploadFileWithRetry } from "../lib/supabase/supabase-runnable.js";

// Upload a file
const result = await uploadFileWithRetry.invoke({
  bucketName: "my-bucket",
  path: "path/to/file.pdf",
  fileBody: fileData, // Can be File, Blob, ArrayBuffer, or string
  options: { contentType: "application/pdf" }, // Optional
});
```

## Retry Configuration

The default retry configuration is defined in `DEFAULT_RETRY_CONFIG` and can be customized if needed:

```typescript
// Default configuration
export const DEFAULT_RETRY_CONFIG = {
  stopAfterAttempt: 3,
};

// Example of custom configuration
const customRetryConfig = {
  stopAfterAttempt: 5,
  factor: 2,
  minTimeout: 1000,
};

// Using custom configuration
const customListFiles = listFiles.withRetry(customRetryConfig);
```

## Integration with LangGraph

These utilities are designed to be used within LangGraph nodes. For example, in the `documentLoaderNode`:

```typescript
// Inside a node function
const fileObjects = await listFilesWithRetry.invoke({
  bucketName,
  path: "",
});

const fileBlob = await downloadFileWithRetry.invoke({
  bucketName,
  path: documentPath,
});
```

## Error Handling

All operations throw appropriate errors that include:

- Status codes for standard HTTP errors (404, 403, etc.)
- Detailed error messages
- Original Supabase error information

## TODOs

- [ ] Add unit tests for all runnable operations
- [ ] Implement pagination helper for listing large directories
- [ ] Add support for file metadata operations
- [ ] Add option to return file URLs instead of blob data
- [ ] Create utility for signed URL generation
- [ ] Add support for bucket management operations
- [ ] Implement move/copy operations between buckets
- [ ] Add cache layer for frequent operations
