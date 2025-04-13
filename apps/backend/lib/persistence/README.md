# LangGraph Persistence Layer

This directory contains the implementation of the persistence layer for LangGraph agents, using Supabase for storage.

## Setup Instructions

### 1. Create Supabase Tables

Use the SQL in `migrations/create_persistence_tables.sql` to create the necessary tables, indexes, and security policies in your Supabase project.

You can either:
- Copy and paste the SQL into the Supabase SQL Editor
- Use the Supabase CLI to apply the migration

### 2. Set Required Environment Variables

Add the following environment variables to your project:

```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

The service role key is required to bypass RLS policies for server-side operations.

### 3. Using the SupabaseCheckpointer

The `SupabaseCheckpointer` class provides a persistent storage implementation for LangGraph's checkpointer interface.

```typescript
import { SupabaseCheckpointer } from "../../lib/persistence/supabase-checkpointer";

// Initialize the checkpointer with the user and proposal context
const checkpointer = new SupabaseCheckpointer({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  userIdGetter: async () => userId,
  proposalIdGetter: async () => proposalId,
});

// Use in your LangGraph initialization
const graph = new StateGraph(MyStateAnnotation)
  .addNode("myNode", myNodeFunction)
  // ... add other nodes and edges
  .compile({ checkpointer });
```

### 4. Thread ID Management

Use the static method to generate consistent thread IDs:

```typescript
const threadId = SupabaseCheckpointer.generateThreadId(proposalId, "componentName");
```

### 5. Handling Message History

The message history utilities help prevent context overflow:

```typescript
import { pruningMessagesStateReducer } from "../../lib/state/messages";

// Use in your state definition
const MyStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: pruningMessagesStateReducer,
  }),
  // ... other state fields
});
```

## Tables Schema

### proposal_checkpoints

Stores the LangGraph checkpoint data for serialized graph states.

| Column           | Type           | Description                              |
|------------------|----------------|------------------------------------------|
| id               | BIGSERIAL      | Primary key                              |
| thread_id        | TEXT           | Thread identifier                        |
| user_id          | UUID           | References auth.users(id)                |
| proposal_id      | UUID           | References proposals(id)                 |
| checkpoint_data  | JSONB          | Serialized LangGraph state               |
| metadata         | JSONB          | Additional metadata                      |
| created_at       | TIMESTAMPTZ    | Creation timestamp                       |
| updated_at       | TIMESTAMPTZ    | Last update timestamp                    |

### proposal_sessions

Tracks session metadata for active agent sessions.

| Column           | Type           | Description                              |
|------------------|----------------|------------------------------------------|
| id               | BIGSERIAL      | Primary key                              |
| thread_id        | TEXT           | Thread identifier                        |
| user_id          | UUID           | References auth.users(id)                |
| proposal_id      | UUID           | References proposals(id)                 |
| status           | TEXT           | Session status (active, completed, etc.) |
| component        | TEXT           | Agent component name                     |
| start_time       | TIMESTAMPTZ    | Session start timestamp                  |
| last_activity    | TIMESTAMPTZ    | Last activity timestamp                  |
| metadata         | JSONB          | Additional metadata                      |

## Security Considerations

- All tables have Row Level Security (RLS) policies activated
- Users can only access their own sessions and checkpoints
- Direct database access requires using the service role key