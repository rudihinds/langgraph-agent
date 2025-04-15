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
