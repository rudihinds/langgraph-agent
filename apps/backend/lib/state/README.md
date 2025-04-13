# State Management and Persistence

This directory contains utilities for managing state and persistence in LangGraph agents.

## Overview

The persistence layer ensures that agent states can be saved and restored across server restarts, process crashes, or long-running operations. It uses Supabase as the database backend.

## Components

### `supabase.ts`

The `SupabaseCheckpointer` class implements the LangGraph `BaseCheckpointSaver` interface, providing:

- Storage and retrieval of agent state checkpoints
- Session metadata tracking
- Error handling with retries
- Row-level security for multi-tenant isolation

### `messages.ts`

Contains utilities for managing message history:

- `pruneMessageHistory`: Prevents token overflow by intelligently pruning messages
- `summarizeConversion`: Creates summarized messages to preserve context

## Database Schema

The persistence layer uses two main tables:

1. `proposal_checkpoints`: Stores LangGraph checkpoints (serialized state)
2. `proposal_sessions`: Tracks metadata about active sessions

See `schema.sql` for the complete table definitions and security policies.

## Usage

### Basic Setup

```typescript
import { SupabaseCheckpointer } from "../lib/state/supabase";
import { StateGraph } from "@langchain/langgraph";

// Create a checkpointer
const checkpointer = new SupabaseCheckpointer<YourStateType>();

// Use it with a StateGraph
const graph = new StateGraph<YourStateType>({
  channels: YourStateAnnotation,
});

// Compile with persistence
const compiledGraph = graph.compile({
  checkpointer,
});

// Invoke with thread_id for persistence
const result = await compiledGraph.invoke(initialState, {
  configurable: {
    thread_id: "your-thread-id",
  },
});
```

### Message Pruning

```typescript
import { pruneMessageHistory } from "../lib/state/messages";

// Prune messages to prevent context overflow
const prunedMessages = pruneMessageHistory(messages, {
  maxTokens: 6000,
  keepSystemMessages: true,
});
```

## Row-Level Security

The Supabase tables use Row-Level Security (RLS) policies to ensure:

1. Users can only access their own checkpoints
2. Sessions are linked to specific users and proposals
3. Administrative functions are protected

## Error Handling

The SupabaseCheckpointer implements:

- Retry logic with exponential backoff
- Comprehensive error logging
- Transaction support for checkpoint updates

## Session Management

Sessions track:

- User ID
- Proposal ID
- Creation time
- Last activity
- Status
- Custom metadata

## Performance Considerations

- Use appropriate indexes for queries
- Enable connection pooling
- Implement pruning for large message histories
- Configure cleanup for abandoned sessions