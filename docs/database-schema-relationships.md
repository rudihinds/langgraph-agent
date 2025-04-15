# Database Schema and Relationships

This document outlines the database schema structure and relationships between tables in the Proposal Agent System.

## Database Tables Overview

Our system uses several interconnected tables to manage proposals, documents, state persistence, and user data:

### Core Tables

1. **`users`** - User account information (extends Supabase Auth)
2. **`proposals`** - Main proposal metadata and status
3. **`proposal_documents`** - Documents associated with proposals
4. **`proposal_states`** - LangGraph state management for proposals

### Persistence Tables

1. **`proposal_checkpoints`** - Stores LangGraph checkpoint data
2. **`proposal_sessions`** - Tracks metadata about agent sessions

## Entity Relationship Diagram

```
users
├── id (UUID, PK)
├── email (TEXT, UNIQUE)
├── full_name (TEXT)
├── avatar_url (TEXT)
├── created_at (TIMESTAMP)
└── last_login (TIMESTAMP)
     │
     │  1:N
     ▼
proposals
├── id (UUID, PK)
├── user_id (UUID, FK → users.id)
├── title (TEXT)
├── funder (TEXT)
├── applicant (TEXT)
├── status (TEXT)
├── created_at (TIMESTAMP)
├── updated_at (TIMESTAMP)
└── metadata (JSONB)
     │
     │  1:N
     ▼
┌────────────────────┐   ┌────────────────────┐
│ proposal_documents │   │ proposal_states    │
├────────────────────┤   ├────────────────────┤
│ id (UUID, PK)      │   │ id (UUID, PK)      │
│ proposal_id (FK)   │◄──┤ proposal_id (FK)   │
│ document_type      │   │ thread_id (TEXT)   │
│ file_name          │   │ checkpoint_id      │
│ file_path          │   │ parent_checkpoint_id│
│ file_type          │   │ created_at         │
│ size_bytes         │   │ metadata (JSONB)   │
│ created_at         │   │ values (JSONB)     │
│ metadata (JSONB)   │   │ next (TEXT[])      │
└────────────────────┘   │ tasks (JSONB[])    │
                         │ config (JSONB)     │
                         └────────────────────┘
                               │
                               │ 1:N (via thread_id)
                               ▼
  ┌───────────────────────┐   ┌───────────────────────┐
  │ proposal_checkpoints  │   │ proposal_sessions     │
  ├───────────────────────┤   ├───────────────────────┤
  │ id (BIGINT, PK)       │   │ id (BIGINT, PK)       │
  │ thread_id (TEXT, UQ)  │◄──┤ thread_id (TEXT, FK)  │
  │ user_id (UUID, FK)    │   │ proposal_id (TEXT)    │
  │ proposal_id (UUID, FK)│   │ user_id (UUID, FK)    │
  │ checkpoint_data (JSONB)│  │ created_at            │
  │ metadata (JSONB)      │   │ last_active           │
  │ created_at            │   │ status                │
  │ updated_at            │   │ metadata (JSONB)      │
  └───────────────────────┘   └───────────────────────┘
```

## Key Relationships

### User and Proposals

- A user can have many proposals (`users.id` → `proposals.user_id`)
- Row Level Security ensures users can only see their own proposals

### Proposals and Documents

- A proposal can have many associated documents (`proposals.id` → `proposal_documents.proposal_id`)
- Documents are categorized by `document_type` (rfp, generated_section, final_proposal, etc.)

### Proposals and States

- A proposal can have many state checkpoints (`proposals.id` → `proposal_states.proposal_id`)
- Each state represents a point in the proposal generation workflow

### Thread IDs and Session Persistence

- The `thread_id` is a crucial linking field between tables
- Each `thread_id` uniquely identifies a specific agent session
- Thread IDs link `proposal_checkpoints` to `proposal_sessions`

## Thread ID Format and Usage

Thread IDs follow a standard format:
```
{componentName}_{hash}_{timestamp}
```

Example: `research_a1b2c3d4e5_1634567890123`

Thread IDs are used to:
1. Link checkpoints to session metadata
2. Allow resumption of previous sessions
3. Track progress across multiple agent invocations
4. Separate concurrent workflows for the same proposal

## Foreign Key Constraints

The system enforces referential integrity with the following constraints:

1. `proposals.user_id` → `users.id` (CASCADE DELETE)
2. `proposal_documents.proposal_id` → `proposals.id` (CASCADE DELETE)
3. `proposal_states.proposal_id` → `proposals.id` (CASCADE DELETE)
4. `proposal_sessions.thread_id` → `proposal_checkpoints.thread_id` (CASCADE DELETE)
5. `proposal_sessions.user_id` → `auth.users.id` (CASCADE DELETE)
6. `proposal_checkpoints.user_id` → `auth.users.id` (CASCADE DELETE)
7. `proposal_checkpoints.proposal_id` → `proposals.id` (CASCADE DELETE)

## Security Model

The database implements Row Level Security (RLS) policies to ensure data isolation:

1. Users can only view, update, or delete their own data
2. All table access is filtered by the authenticated user's ID
3. Service role access is available for server-side operations
4. All tables have RLS enabled by default

## Performance Considerations

The schema includes several indexes to optimize query performance:

1. `idx_proposals_user_id` on `proposals(user_id)`
2. `idx_proposal_states_proposal_id` on `proposal_states(proposal_id)`
3. `idx_proposal_states_thread_id` on `proposal_states(thread_id)`
4. `idx_proposal_documents_proposal_id` on `proposal_documents(proposal_id)`
5. `proposal_checkpoints_thread_id_idx` on `proposal_checkpoints(thread_id)`
6. `proposal_sessions_user_id_idx` on `proposal_sessions(user_id)`
7. `proposal_sessions_proposal_id_idx` on `proposal_sessions(proposal_id)`
8. `proposal_sessions_status_idx` on `proposal_sessions(status)`
9. `proposal_sessions_last_active_idx` on `proposal_sessions(last_active)`

## Cleanup and Maintenance

A scheduled function `cleanup_old_sessions(days_threshold integer)` automatically removes inactive sessions older than the specified threshold (default: 30 days).

## State Serialization and Storage

The `checkpoint_data` and `state` JSONB columns store serialized LangGraph state, which includes:
- Conversation history
- Research results
- Proposal sections
- Agent status information
- Tool outputs and intermediate results

Each state update creates a new checkpoint entry, allowing for potential rollback to previous states.