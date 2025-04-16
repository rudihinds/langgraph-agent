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

  - Auth: User authentication and session management
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

_This document provides the technical landscape for the project, essential for onboarding and understanding the development environment._
