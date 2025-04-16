# Persistence Layer

This directory contains the implementation of the persistence layer for the LangGraph-based proposal agent.

## Architecture

The persistence layer is designed using the adapter pattern to provide flexible storage options:

```
┌─────────────────┐     ┌───────────────────┐     ┌──────────────────────┐
│                 │     │                   │     │                      │
│  LangGraph API  │────▶│  Storage Adapter  │────▶│  ICheckpointer       │
│                 │     │                   │     │  Implementation      │
└─────────────────┘     └───────────────────┘     └──────────────────────┘
                                                   ┌───────────────────┐
                                                   │                   │
                                                   │  Concrete         │
                                                   │  Storage Backend  │
                                                   │                   │
                                                   └───────────────────┘
```

## Components

### ICheckpointer Interface

The `ICheckpointer` interface defines the contract that all storage implementations must adhere to:

```typescript
interface ICheckpointer {
  put: (threadId: string, state: object) => Promise<void>;
  get: (threadId: string) => Promise<object | null>;
  list: () => Promise<string[]>;
  delete: (threadId: string) => Promise<void>;
}
```

### Storage Implementations

1. **InMemoryCheckpointer** (`memory-checkpointer.ts`)

   - Simple in-memory storage for development and testing
   - Thread-safe with private state management
   - No persistence between service restarts

2. **SupabaseCheckpointer** (`supabase-checkpointer.ts`)
   - PostgreSQL-based storage using Supabase
   - Multi-tenant isolation with user ID filtering
   - Persistent storage with transaction support

### Factory and Adapter

1. **Checkpointer Factory** (`checkpointer-factory.ts`)

   - Creates the appropriate checkpointer implementation based on configuration
   - Validates environment variables for Supabase configuration
   - Provides graceful fallback to in-memory storage

2. **Storage Adapter** (`checkpointer-adapter.ts`)
   - Converts our internal `ICheckpointer` to LangGraph's `BaseCheckpointSaver`
   - Handles serialization/deserialization of state objects
   - Provides proper error handling and logging

## Usage

```typescript
import { createCheckpointer } from "../services/checkpointer.service";
import { createCheckpointSaver } from "./persistence/checkpointer-adapter";

// Create a checkpointer instance
const checkpointer = await createCheckpointer({
  userId: "user-123",
  useSupabase: true,
});

// Convert to LangGraph-compatible checkpoint saver
const checkpointSaver = createCheckpointSaver(checkpointer);

// Use with LangGraph
const graph = StateGraph.from_state_annotation({
  checkpointSaver,
});
```

## Testing

The persistence layer can be tested using the script at `scripts/test-checkpointer.ts`:

```bash
# Run the test script
npx tsx scripts/test-checkpointer.ts
```

## Security Considerations

- All operations include user ID filtering for multi-tenant isolation
- Row Level Security policies on the Supabase table enforce access control
- Service role key is required for administrative operations (table creation)
- Regular operations use client credentials with appropriate permissions
