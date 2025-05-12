# Technology Context

## 1. Core Technologies

- **Language:** TypeScript
- **Backend Framework:** Node.js with Express.js
- **Agent Framework:** LangGraph.js - Framework for building stateful, multi-actor applications with LLMs
- **Database:** PostgreSQL via Supabase for persistent state storage
- **Cloud Provider:** Supabase for authentication, database, and storage
- **Frontend Framework:** Next.js (React)
- **Key Libraries:**
  - `@langchain/core` - Core LangChain components
  - `@langchain/langgraph` - Main agent graph framework
  - `@langchain/langgraph-checkpoint-postgres` - Checkpoint persistence with PostgreSQL
  - `@supabase/supabase-js` - Supabase client for database, auth, and storage
  - `zod` - Schema validation for state and API inputs/outputs
  - Various LLM provider clients (Anthropic, OpenAI, Mistral, Gemini)

## 2. Development Environment Setup

- **Node.js:** Latest stable version is recommended
- **Package Manager:** npm (Node Package Manager)
- **Environment Variables:**

  - `SUPABASE_URL` - Supabase instance URL
  - `SUPABASE_ANON_KEY` - Supabase anonymous API key
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for trusted server operations)
  - `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. - LLM provider API keys
  - `DEFAULT_MODEL` - Default LLM model to use (e.g., "anthropic/claude-3-5-sonnet-20240620")
  - `PORT` - Port for the backend server (default: 3001)
  - `NEXT_PUBLIC_BACKEND_URL` - URL for backend API (default: "http://localhost:3001")
  - `NEXT_PUBLIC_APP_URL` - URL for frontend app (default: "http://localhost:3000")
  - `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY` - Optional: LangSmith observability (monitoring and debugging)

- **Local Development:**
  - Backend server: `npm run dev` in the backend directory
  - Web application: `npm run dev` in the web directory
  - Tests: `npm run test` for unit tests

## 3. Technical Constraints

- **LLM Rate Limits:** API providers have rate limits that must be respected
- **Token Limitations:** Different models have specific context window sizes:
  - Claude models: 200,000 tokens
  - GPT-4o: 128,000 tokens
  - Mistral models: 32,768 tokens
- **Costs:** LLM API calls incur costs based on input/output tokens
- **Streaming Limitations:** Some models support streaming, others don't
- **Authentication Requirements:** All proposal endpoints require user authentication
- **State Size:** LangGraph state serialization has size limitations

## 4. External Dependencies & Services

- **Supabase:**

  - Auth: User authentication and session management.
    - **Express Integration:** Requires `cookie-parser` middleware in `server.ts` for server-side authentication using `@supabase/ssr`'s `createServerClient`. The client needs custom `cookies` options using `req.cookies` and `res.cookie`/`res.clearCookie`.
  - Database: PostgreSQL for persistent storage
  - Row-Level Security: Ensures users can only access their own data
  - Used for storing LangGraph checkpoints and proposal data

- **LLM Providers:**

  - Anthropic (Claude models) - Primary LLM provider
  - OpenAI (GPT models) - Alternative LLM provider
  - Mistral AI - Alternative LLM provider
  - Google Gemini - Alternative LLM provider

- **LangSmith (Optional):**
  - Tracing and observability for LangChain/LangGraph executions
  - Debugging and performance monitoring

## 5. Tool Usage Patterns

- **Code Organization:**

  - File length limit: 300 lines maximum
  - Structured directory hierarchy:
    - `/agents` - LangGraph agent definitions
    - `/api` - Express.js API routes
    - `/lib` - Shared utilities and core integrations
    - `/prompts` - Organized prompt templates
    - `/state` - Core state definitions
    - `/tools` - Custom tool implementations
    - `/services` - Business logic services

- **Testing Framework:** Vitest for unit and integration tests

- **LangGraph Patterns:**

  - State defined via TypeScript interfaces and Annotation
  - Node functions follow verbNoun naming convention
  - Custom reducers for complex state updates
  - Conditional edges for graph flow control
  - Checkpointer usage for persistence
  - **CRITICAL: ALWAYS defer to current LangGraph.js documentation (attached context or via web search) for implementation details regarding state definition (Annotations/Channels), reducers, checkpointers, nodes, edges, HITL patterns, and conditional logic. Internal knowledge may be outdated or incorrect; verify against official, current examples and API specifications.**

- **Error Handling:**

  - Custom AppError classes for typed errors
  - Standardized API response format
  - Route handler wrappers for consistent error handling

- **Dependency Management:**
  - Package.json for npm dependencies
  - Strict versioning to prevent breaking changes

## LangGraph Usage Patterns

- **State Definition:** Using `OverallProposalState` interface. State schema passed to `StateGraph` constructor must follow current LangGraph documentation (either via `Annotation.Root` or explicit `{ channels: ... }` structure).

  - **Documentation Adherence:** Verify state definition patterns against the **latest official LangGraph.js documentation**.
  - **Clarification via Search:** If confusion persists regarding `StateGraph` initialization, state definition, or related type errors, **use the web search tool (e.g., Brave Search)** to find current examples, best practices, or issue discussions relevant to the LangGraph version.

- **Checkpointer Usage:** Checkpointer instances (`PostgresSaver` or `MemorySaver`) are obtained via `createRobustCheckpointer`. Thread isolation is managed by passing `thread_id` in `RunnableConfig` to graph operations.

- **Nodes:** Defined as TypeScript functions or LangChain Runnables, interacting with state.

## Server Entry Point

- The backend server is started via `apps/backend/server.ts`.
- This script handles initialization of LangGraph components and starts the Express server (configured in `apps/backend/api/express-server.ts`).

## Chat UI Technologies

### Frontend Technologies

- **React**: Core UI library for building the chat interface components
- **Next.js**: Framework for server-side rendering and routing
- **TypeScript**: For type-safe development throughout the codebase
- **Context API**: For state management of chat threads and messages
- **React Hooks**: Custom hooks for managing chat logic and state
- **Tailwind CSS**: For responsive and consistent styling
- **Shadcn UI**: Component library providing UI primitives

### Backend Integration

- **LangGraph SDK**: JavaScript SDK for integration with LangGraph server
  - `@langchain/langgraph-sdk`: Primary package for connecting to LangGraph
  - Server-sent events (SSE) for streaming responses
  - WebSocket connections for real-time updates
- **Supabase Auth**: Used for authentication and securing chat endpoints
  - JWT tokens for authentication with LangGraph server
  - Row-level security for user data

### Tools & Utilities

- **clsx** and **tailwind-merge**: For conditional class name composition
- **Zod**: For runtime validation of data structures
- **date-fns**: For date manipulation and formatting in timestamps
- **nanoid**: For generating unique IDs for messages and threads

### Key APIs & Integration Points

- **LangGraph Server API**:
  - `/v1/thread` endpoints for thread management
  - Stream endpoints for real-time communication
  - Tool call handling for agent actions
- **Supabase API**:
  - Authentication endpoints
  - User profile management
  - Storage for persistent thread history

### Development Tools

- **Vitest**: Testing framework for unit and integration tests
- **React Testing Library**: For component testing
- **MSW (Mock Service Worker)**: For API mocking during development and testing
- **Storybook**: For component documentation and visual testing

### Browser APIs

- **EventSource**: For server-sent events
- **LocalStorage**: For caching thread data
- **Fetch API**: For non-streaming HTTP requests

## Chat UI Integration Progress (2024-06)

Phase 2 of the Chat UI integration is complete. All UI components and utilities have been implemented in their correct locations. Linter errors for missing dependencies (e.g., '@/components/ui/tooltip', '@/components/ui/button', '@/lib/utils') must be resolved in the next phase, which will focus on backend integration, tool call handling, and UI polish.

## Recent Updates (2024-06)

- Chat UI integration Phase 2 is complete: all UI components and utilities are implemented in their correct locations. Linter errors remain due to missing dependencies (e.g., @/components/ui/tooltip, @/components/ui/button, @/lib/utils), to be resolved in the next phase.
- Backend integration, tool call handling, and UI polish are the next focus areas.
- Supabase Auth SSR integration is robust and follows best practices (getAll/setAll, getUser()).
- Adapter pattern for checkpointing ensures future-proofing against LangGraph API changes.
- Project is on track for backend integration and final polish phases.

_This document provides the technical landscape for the project, essential for onboarding and understanding the development environment._
