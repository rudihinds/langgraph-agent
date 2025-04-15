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
