# Migrating to the Enhanced SupabaseCheckpointer

This guide explains how to migrate from the older checkpoint implementations to the new, enhanced `SupabaseCheckpointer`.

## Background

As part of our effort to align with the architecture defined in `AGENT_ARCHITECTURE.md`, we've implemented a more robust `SupabaseCheckpointer` that:

1. Fully implements the `BaseCheckpointSaver` interface from LangGraph
2. Includes Row Level Security (RLS) policies for proper security
3. Provides better error handling and retry capabilities
4. Optimizes database access with proper indexing
5. Supports user and proposal ID association

## Migration Steps

### 1. Update Your Imports

Change your imports from:

```typescript
// Old implementations
import { PostgresCheckpointer } from "@/lib/postgres-checkpointer";
// OR
import { SupabaseCheckpointer } from "@/lib/state/supabase";
```

To:

```typescript
// New implementation
import { SupabaseCheckpointer } from "@/lib/persistence/supabase-checkpointer";
```

### 2. Update Constructor Usage

#### From PostgresCheckpointer

**Old:**

```typescript
const checkpointer = new PostgresCheckpointer({
  client: supabaseClient,
  debug: true,
});
```

**New:**

```typescript
const checkpointer = new SupabaseCheckpointer({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  userIdGetter: async () => userId,
  proposalIdGetter: async (threadId) => proposalId,
  logger: console, // Or use your custom logger
});
```

#### From the old SupabaseCheckpointer

**Old:**

```typescript
const checkpointer = new SupabaseCheckpointer<YourStateType>({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_KEY,
  validator: yourZodSchema,
});
```

**New:**

```typescript
const checkpointer = new SupabaseCheckpointer({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  userIdGetter: async () => userId,
  proposalIdGetter: async (threadId) => proposalId,
});
```

### 3. Update Method Calls

The new implementation follows the `BaseCheckpointSaver` interface from LangGraph, which means:

#### If you were using PostgresCheckpointer:

- `get_latest_checkpoint(threadId)` → Use `get({configurable: {thread_id: threadId}})`
- `create_checkpoint(checkpoint)` → Use `put({configurable: {thread_id: threadId}}, checkpoint, metadata, versions)`
- `delete_thread(threadId)` → Use `delete(threadId)`

#### If you were using the old SupabaseCheckpointer:

- Method signatures have changed:
  - `get(threadId)` → `get({configurable: {thread_id: threadId}})`
  - `put(threadId, checkpoint)` → `put({configurable: {thread_id: threadId}}, checkpoint, metadata, versions)`
  - `delete(threadId)` → No change

### 4. Use with LangGraph

The new implementation is meant to be used directly with LangGraph:

```typescript
import { StateGraph } from "@langchain/langgraph";
import { SupabaseCheckpointer } from "@/lib/persistence/supabase-checkpointer";

// Create the checkpointer
const checkpointer = new SupabaseCheckpointer({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  userIdGetter: async () => userId,
  proposalIdGetter: async (threadId) => proposalId,
});

// Create and compile the graph
const graph = new StateGraph({...})
  .addNode(...)
  .addEdge(...);

// Compile with checkpointer
const compiledGraph = graph.compile({
  checkpointer
});

// Invoke with thread_id
await compiledGraph.invoke(
  {...}, // initial state
  { configurable: { thread_id: threadId } }
);
```

### 5. Database Setup

Ensure your Supabase database has the required tables. The SQL schema is available in `/apps/backend/lib/persistence/db-schema.sql`.

## Testing Your Migration

Run tests to ensure your migration is successful:

```bash
cd /apps/backend/lib/persistence
./run-tests.sh
```

## Getting Help

If you encounter issues during migration, please:

1. Check the implementation details in `supabase-checkpointer.ts`
2. Review the integration tests in `__tests__/supabase-checkpointer.test.ts`
3. File an issue with specific details about the error and your use case
