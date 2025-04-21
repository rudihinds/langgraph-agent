# Proposal Generator Backend

This is the backend service for the Proposal Generator application, built with LangGraph, Express, and TypeScript.

## Structure

The backend is organized into a modular structure:

- `server.js` - Main entry point for the Express API
- `/api` - Express API implementation
  - `/api/express-server.ts` - Main Express application configuration
  - `/api/rfp` - Route handlers for RFP-related endpoints
- `/agents` - LangGraph agent definitions
- `/lib` - Shared utilities and helpers
- `/state` - State definitions and type declarations
- `/prompts` - Prompt templates for LLM interactions
- `/services` - Core business logic and services

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- Supabase account (for state persistence)

### Environment Setup

Copy the `.env.example` file to `.env` and fill in the required values:

```
# LLM API Keys
ANTHROPIC_API_KEY=your_anthropic_api_key

# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# Server Configuration
PORT=3001
NODE_ENV=development
```

### Development

To start the development server:

```bash
# Start the HTTP server for agent testing
npm run dev

# Start the Express API server for RFP endpoints
npm run dev:api
```

### Building and Deployment

```bash
# Build the application
npm run build

# Start the API server in production mode
npm start
```

## API Endpoints

### Proposal Generation

- **POST `/api/rfp/start`** - Start a new proposal generation process
  - Request: RFP content (string or structured object)
  - Response: Thread ID and initial state

### Human-in-the-Loop (HITL) Controls

- **GET `/api/rfp/interrupt-status`** - Check if a proposal is awaiting user input

  - Request: Thread ID
  - Response: Interrupt status and details

- **POST `/api/rfp/feedback`** - Submit user feedback for interrupted proposal

  - Request: Thread ID, feedback type, comments
  - Response: Status update

- **POST `/api/rfp/resume`** - Resume proposal generation after feedback
  - Request: Thread ID
  - Response: Status update

### Utility Endpoints

- **GET `/api/health`** - Health check endpoint
  - Response: Status confirmation

## State Management

All state is managed by the LangGraph checkpointer, which is integrated with Supabase for persistence. This allows for:

- Resuming interrupted proposal generation
- Human-in-the-loop reviews and edits
- Tracking proposal generation progress
- State recovery in case of server restarts

## Testing

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run tests with coverage
npm run test:coverage
```

## Architecture

For more details on the architecture, see `AGENT_ARCHITECTURE.md` and `AGENT_BASESPEC.md`.

## Checkpointer Setup

Before starting, ensure your Supabase database has the required tables:

```bash
# Set up the checkpointer tables
npm run setup-checkpointer
```

# Proposal Agent Backend

This directory contains the LangGraph-based backend for the Proposal Agent System.

## Directory Structure

```
backend/
├── agents/           # Agent implementations
│   └── proposal-agent/  # Proposal agent implementation
│       ├── index.ts     # Main exports
│       ├── state.ts     # State definitions
│       ├── nodes.ts     # Node implementations
│       ├── tools.ts     # Specialized tools
│       ├── graph.ts     # Graph definition
│       └── configuration.ts # Configurable options
├── lib/              # Shared utilities
├── tools/            # Common agent tools
├── tests/            # Backend tests
├── public/           # Static files
├── index.ts          # Entry point
├── tsconfig.json     # TypeScript configuration
└── package.json      # Dependencies
```

## Agent Implementations

This backend contains implementations of various agents used in the proposal generation system:

- `/agents/research` - Research Agent for analyzing RFPs and extracting information
- `/agents/orchestrator` - Workflow Orchestrator for coordinating the overall proposal process
- `/agents/proposal-agent` - Proposal Agent for generating proposal sections
- `/agents/examples` - Example agent implementations for reference

## Import Patterns

This project uses ES Modules with TypeScript's NodeNext module resolution, which requires specific import patterns:

**Always use .js file extensions for relative imports**:

```typescript
// ✅ CORRECT: Include file extension for relative imports
import { ResearchState } from "./state.js";
import { documentLoaderNode } from "./nodes.js";
import { SupabaseCheckpointer } from "../../lib/state/supabase.js";

// ❌ INCORRECT: Missing file extension
import { ResearchState } from "./state";
import { documentLoaderNode } from "./nodes";
import { SupabaseCheckpointer } from "../../lib/state/supabase";
```

Package imports (from node_modules) don't need file extensions:

```typescript
// ✅ CORRECT: No file extension needed for package imports
import { StateGraph } from "@langchain/langgraph";
import { ChatAnthropic } from "@langchain/anthropic";
```

See `IMPORT_PATTERN_SPEC.md` in the project root for more details on the import pattern requirements.

## Logger Usage

The project includes a standardized Logger utility for consistent logging across the application:

```typescript
// Import the Logger class
import { Logger } from "../logger.js";

// Get the singleton instance
const logger = Logger.getInstance();

// Log at different levels
logger.info("Operation completed successfully", { userId, documentId });
logger.error("Failed to process request", { error: err.message, requestId });
logger.debug("Processing item", { item });
```

Available log levels (from least to most verbose):

- `ERROR` - Fatal errors and exceptions
- `WARN` - Warning conditions
- `INFO` - General informational messages (default)
- `DEBUG` - Detailed debug information
- `TRACE` - Very detailed tracing information

The log level can be configured via the `LOG_LEVEL` environment variable.

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   - Copy `.env.example` to `.env` in the project root
   - Fill in required API keys and configuration

3. Run the backend in development mode:

   ```bash
   npm run dev
   ```

4. Run with LangGraph Studio:
   ```bash
   npx @langchain/langgraph-cli dev --port 2024 --config langgraph.json
   ```

## Development

- **State Management**: The state definition is in `shared/src/state/proposalState.ts`
- **Node Development**: Create new agent capabilities in the `nodes.ts` file
- **Tool Development**: Add custom tools in the `tools.ts` file

## Agent Development Guidelines

When developing new agents or modifying existing ones:

1. Define state in a dedicated `state.ts` file with proper annotations
2. Implement node functions in `nodes.ts` with comprehensive error handling
3. Keep prompts in a separate directory organized by function
4. Follow the ES Module import patterns as described above
5. Document all public interfaces and node functions
6. Create comprehensive tests in `__tests__` directories

## Agent Communication Patterns

Agents communicate through the following mechanisms:

1. Direct state access for child agents (e.g., Research Agent)
2. HTTP APIs for cross-service communication
3. Event-based messaging for async processes
4. Checkpoint persistence for resumable workflows

## Testing

Run tests with:

```bash
npm test           # Run all tests
npm run test:unit  # Run unit tests only
npm run test:integration # Run integration tests only
```

### Testing Guidelines

1. Create unit tests for individual node functions
2. Implement integration tests for full agent workflows
3. Use mock LLM responses for deterministic testing
4. Test both success and error paths
5. Verify state transitions and error recovery

## Database Schema

The system relies on several interconnected database tables for managing proposals, documents, and agent sessions. For a detailed explanation of the database schema and relationships:

- See [docs/database-schema-relationships.md](../../docs/database-schema-relationships.md) for complete documentation
- Table definitions can be found in `lib/schema.sql` and `lib/state/schema.sql`
- Foreign key relationships ensure data integrity across user sessions
- Row Level Security (RLS) policies protect user data

## API Routes

The backend exposes the following API routes when running:

- `POST /api/proposal/create` - Create a new proposal
- `POST /api/proposal/:id/message` - Add a message to an existing proposal
- `GET /api/proposal/:id` - Get the current state of a proposal
- `GET /api/proposal/:id/history` - Get the message history of a proposal

See the API documentation for more details on request and response formats.

# Backend Service

This directory contains the backend service for the LangGraph-based proposal agent.

## Setup

1. Environment variables are loaded from the root `.env` file. See `.env.example` for required variables.
2. Run `npm install` from the root of the project
3. Run `npx tsx scripts/setup-checkpointer.ts` to set up the database tables (if using Supabase)

## Key Components

### Persistence Layer

The persistence layer uses the adapter pattern to provide flexible storage options:

- `ICheckpointer` interface defines the contract for all storage implementations
- `InMemoryCheckpointer` provides an in-memory implementation for development and testing
- `SupabaseCheckpointer` provides a database implementation for production

#### Factory Pattern

The `createCheckpointer` factory function creates the appropriate checkpointer instance based on environment configuration:

```typescript
// With Supabase credentials
const checkpointer = await createCheckpointer({
  userId: "user-123",
  useSupabase: true,
});

// Without Supabase (falls back to in-memory)
const checkpointer = await createCheckpointer({
  userId: "user-123",
});
```

#### Storage Adapter

The storage adapter converts our internal storage implementations to the LangGraph `BaseCheckpointSaver` interface:

```typescript
// Create a LangGraph-compatible checkpoint saver
const checkpointSaver = createCheckpointSaver(checkpointer);

// Use with LangGraph
const graph = StateGraph.from_state_annotation({
  checkpointSaver,
});
```

### Testing

To test the checkpointer implementation:

```bash
# Run the test script
npx tsx scripts/test-checkpointer.ts
```

## Database Schema

If using Supabase, the following tables are created:

### checkpoints

| Column     | Type      | Description                       |
| ---------- | --------- | --------------------------------- |
| thread_id  | text      | Unique identifier for the thread  |
| state      | jsonb     | Serialized state object           |
| created_at | timestamp | Creation timestamp                |
| updated_at | timestamp | Last update timestamp             |
| user_id    | text      | User identifier for multi-tenancy |

Row Level Security policies ensure users can only access their own checkpoints.

## Development

### Environment Variables

The backend service uses the following environment variables from the root `.env` file:

```
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

If these are not present, the service will fall back to an in-memory checkpointer.
