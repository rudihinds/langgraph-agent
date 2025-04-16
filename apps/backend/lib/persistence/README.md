# Supabase Persistence Layer for LangGraph

This module provides a robust persistence layer for LangGraph using Supabase as the backing store. It implements the `BaseCheckpointSaver` interface to enable state persistence, checkpoint management, and resumable workflows.

## Components

### SupabaseCheckpointer

The `SupabaseCheckpointer` class implements LangGraph's `BaseCheckpointSaver` interface, providing:

- **Persistence**: Store and retrieve checkpoints using Supabase PostgreSQL
- **Retry Logic**: Built-in exponential backoff for network resilience
- **Security**: User and proposal association for Row Level Security (RLS)
- **Session Tracking**: Monitoring of active graph sessions
- **Error Handling**: Comprehensive error handling with logging

```typescript
import { SupabaseCheckpointer } from './supabase-checkpointer.js';

// Initialize checkpointer
const checkpointer = new SupabaseCheckpointer({
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  userIdGetter: async () => userId,
  proposalIdGetter: async (threadId) => proposalId,
});

// Use with LangGraph
const graph = new StateGraph({...})
  .addNode(...)
  .addEdge(...);

const compiledGraph = graph.compile({
  checkpointer,
});
```

### Database Schema

The required Supabase tables are defined in `db-schema.sql`. This includes:

1. `proposal_checkpoints`: Stores the checkpoint data with RLS policies
2. `proposal_sessions`: Tracks active sessions and metadata

Each table includes:

- Appropriate indexes for efficient querying
- Row Level Security policies to ensure data isolation
- Optimized schema for LangGraph state storage

### Storage Configuration

The system requires a properly configured Supabase storage bucket for RFP document storage:

1. **Bucket Configuration**:

   - **Name**: `proposal-documents`
   - **Visibility**: Private (non-public)
   - **File size limit**: 50MB

2. **Required RLS Policies**:

   ```sql
   -- Allow users to upload files (INSERT)
   CREATE POLICY "Users can upload their own proposal documents"
   ON storage.objects FOR INSERT
   WITH CHECK (
     auth.uid() = (
       SELECT user_id FROM proposals
       WHERE id::text = (storage.foldername(name))[1]
     )
   );

   -- Allow users to view their own files (SELECT)
   CREATE POLICY "Users can view their own proposal documents"
   ON storage.objects FOR SELECT
   USING (
     auth.uid() = (
       SELECT user_id FROM proposals
       WHERE id::text = (storage.foldername(name))[1]
     )
   );

   -- Allow users to update their own files (UPDATE)
   CREATE POLICY "Users can update their own proposal documents"
   ON storage.objects FOR UPDATE
   USING (
     auth.uid() = (
       SELECT user_id FROM proposals
       WHERE id::text = (storage.foldername(name))[1]
     )
   );

   -- Allow users to delete their own files (DELETE)
   CREATE POLICY "Users can delete their own proposal documents"
   ON storage.objects FOR DELETE
   USING (
     auth.uid() = (
       SELECT user_id FROM proposals
       WHERE id::text = (storage.foldername(name))[1]
     )
   );
   ```

3. **File Organization**:
   - Files are stored following the path pattern `proposal_id/filename`
   - This hierarchy ensures proper RLS policy application

## Setup Instructions

1. Create the tables in your Supabase project:

   ```bash
   # Option 1: Using the Supabase dashboard
   # Copy the contents of db-schema.sql and execute in the SQL Editor

   # Option 2: Using the CLI
   psql -h your-project.supabase.co -U postgres -d postgres -f db-schema.sql
   ```

2. Set environment variables:

   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. Import and use the `SupabaseCheckpointer` in your LangGraph implementation

## Migration Guide

If you're using an older checkpointer implementation (either `PostgresCheckpointer` from `/lib/postgres-checkpointer.ts` or the older `SupabaseCheckpointer` from `/lib/state/supabase.ts`), please see our [Migration Guide](./MIGRATION_GUIDE.md) for instructions on updating to this enhanced implementation.

## Implementation Notes

### Security

- Row Level Security (RLS) policies ensure users can only access their own data
- Service role key required for backend usage (never expose in client-side code)
- User ID and proposal ID are associated with each checkpoint for proper authorization

### Performance

- Indexes are created on `thread_id`, `user_id`, and `proposal_id` for faster queries
- Retry logic with exponential backoff for handling transient failures
- Optimized database schema to minimize storage requirements

### Extensibility

- The session tracking table provides a foundation for monitoring active chains
- Additional metadata can be stored alongside checkpoints for richer context

## Testing

Run tests with:

```bash
./run-tests.sh
```

Or individually:

```bash
npm test -- "apps/backend/lib/persistence/__tests__/supabase-checkpointer.test.ts"
```

## LangGraph Integration

To use the SupabaseCheckpointer with LangGraph, we need to use a special adapter that implements LangGraph's `BaseCheckpointSaver` interface correctly. This is done with the `LangGraphCheckpointer` class:

```typescript
import { SupabaseCheckpointer } from "./lib/persistence/supabase-checkpointer.js";
import { LangGraphCheckpointer } from "./lib/persistence/langgraph-adapter.js";

// Create the base SupabaseCheckpointer
const supabaseCheckpointer = new SupabaseCheckpointer({
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  userIdGetter: async () => getUserId(), // Function that returns the current user ID
  proposalIdGetter: async (threadId) => extractProposalId(threadId), // Function that extracts proposal ID from thread ID
});

// Create the LangGraph adapter
const langGraphCheckpointer = new LangGraphCheckpointer(supabaseCheckpointer);

// Use with a LangGraph StateGraph
const graph = new StateGraph({ channels: {} });
// ...add nodes and edges...

const compiledGraph = graph.compile({
  checkpointer: langGraphCheckpointer,
});
```

### Testing the Checkpointer

You can test the checkpointer integration with LangGraph using the test script:

```bash
# From the apps/backend directory
npm run test-checkpointer

# Or using ts-node directly
npx ts-node scripts/test-checkpointer.ts
```

This script will verify that the checkpointer can properly save, retrieve, and delete checkpoints through the LangGraph interface.

## Testing Without a Database (In-Memory Mode)

For development and testing purposes, you can use the in-memory checkpointer implementation:

```typescript
import { InMemoryCheckpointer } from "./lib/persistence/memory-checkpointer.js";
import { MemoryLangGraphCheckpointer } from "./lib/persistence/memory-adapter.js";

// Create the in-memory checkpointer
const memoryCheckpointer = new InMemoryCheckpointer();

// Create the LangGraph adapter
const langGraphCheckpointer = new MemoryLangGraphCheckpointer(
  memoryCheckpointer
);

// Use with a LangGraph StateGraph
const graph = new StateGraph({ channels: {} });
// ...add nodes and edges...

const compiledGraph = graph.compile({
  checkpointer: langGraphCheckpointer,
});
```

This implementation stores checkpoints in memory only and doesn't persist them across application restarts. It's useful for:

- Testing in environments without a Supabase database
- Local development without setting up Supabase credentials
- Unit testing with predictable state management

The system will automatically fall back to the in-memory implementation if Supabase credentials aren't provided in the environment variables.

### Configuration with Environment Variables

The checkpointer system uses the following environment variables:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `TEST_USER_ID`: (Optional) User ID to use for testing
- `CHECKPOINTER_TABLE_NAME`: (Optional) Override for the checkpoints table name
- `CHECKPOINTER_SESSION_TABLE_NAME`: (Optional) Override for the sessions table name

You can copy `.env.example` to `.env` and update the values to configure the system.
