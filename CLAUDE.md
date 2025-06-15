# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Running the Application
```bash
# Install all dependencies (including workspaces)
npm run install:all

# Development (starts backend, frontend, and LangGraph servers)
npm run dev

# Run specific services
npm run dev:backend    # Backend API server (port 3001)
npm run dev:web        # Next.js frontend (port 3000)
npm run dev:agents     # LangGraph server (port 2024)
```

### Testing
```bash
# Run all tests
npm test

# Run backend tests
cd apps/backend && npm test

# Run web tests  
cd apps/web && npm test

# Run specific test file
cd apps/backend && npm test path/to/test.test.ts

# Run tests with coverage
npm run test:coverage
```

### Building and Linting
```bash
# Build everything
npm run build

# Lint entire codebase
npm run lint

# Format code
npm run format
```

## High-Level Architecture

### System Overview
This is a two-phase proposal generation system using LangGraph.js:
- **Phase 1: Planning Intelligence** - 11 specialized agents gather strategic intelligence
- **Phase 2: Adaptive Writing** - 8 agents generate content based on planning insights

### Key Architectural Components

1. **Frontend (Next.js 15)**: 
   - App router at `apps/web/src/app`
   - Authentication via Supabase with middleware protection
   - Real-time streaming chat UI for agent interactions
   - Form-based proposal creation flow

2. **Backend (Express + LangGraph)**:
   - Express API server at `apps/backend/server.ts`
   - LangGraph agents defined in `apps/backend/agents/`
   - Supabase persistence via custom checkpointer
   - Authentication middleware syncs with Supabase Auth

3. **State Management**:
   - Single comprehensive `OverallProposalState` persisted via checkpointer
   - Custom reducers for state updates
   - Supports full pause/resume capabilities

4. **Agent Communication**:
   - Human-in-the-Loop (HITL) via `interrupt()` for user collaboration
   - Send API for parallel agent execution
   - Streaming responses through EventSource

### Critical Path Aliases
The backend uses TypeScript path aliases configured in `tsconfig.json`:
```typescript
@/lib → apps/backend/lib
@/state → apps/backend/state
@/agents → apps/backend/agents
@/services → apps/backend/services
```

### Authentication Flow
1. Supabase Auth handles user authentication
2. Middleware protects routes requiring auth
3. Users synchronized to local `users` table on auth events
4. Sessions managed via cookies with proper async handling

### Error Handling Architecture
Comprehensive error handling system at multiple levels:
- LLM wrapper functions in `apps/backend/lib/llm/error-handlers.ts`
- Context window management prevents token limit errors
- Automatic retry with exponential backoff for transient errors
- Error classification for intelligent recovery strategies

### Testing Strategy
- Unit tests for individual components
- Integration tests for agent workflows
- Mocked Supabase clients for isolated testing
- Test files co-located with source using `__tests__` directories

## Key Development Patterns

### Working with LangGraph Agents
Agents are defined in `apps/backend/agents/` with this structure:
```
agent-name/
├── graph.ts       # StateGraph definition
├── nodes.ts       # Node implementations
├── state.ts       # State types and annotations
└── prompts/       # Agent-specific prompts
```

### Adding New API Endpoints
1. Create route handler in `apps/backend/api/`
2. Add authentication check if needed
3. Use consistent error handling patterns
4. Add corresponding tests in `__tests__/`

### Frontend Component Development
1. Components in `apps/web/src/features/` organized by feature
2. Use existing UI components from `src/features/ui/components/`
3. Follow existing patterns for forms, error handling, and auth
4. Co-locate tests in `__tests__` directories

### Database Operations
- Use `apps/backend/lib/db/` utilities for database access
- Always handle Supabase RLS (Row Level Security) errors
- Sync auth users to local database via `syncUserToDatabase`

### Important Considerations
- Never commit secrets or API keys
- Follow existing code style and conventions
- Use streaming for long-running operations
- Test error scenarios and edge cases
- Maintain backwards compatibility when updating APIs
- Do not include Claude attributions in commits or pull requests

### Development Environment Notes
- **Do not start the backend or LangGraph servers** - The user keeps these running with hot reloading
- **LangGraph agents run on a separate LangGraph server** (port 2024), not the main backend
- The user will test functionality manually when needed
- Focus on code implementation rather than testing by running servers