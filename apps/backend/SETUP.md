# LangGraph Integration Setup

This document outlines the structure and configuration we've set up for integrating LangGraph with our existing application.

## Project Structure

The project now follows a monorepo structure:

```
/
├── apps/
│   ├── web/               # Next.js frontend
│   └── backend/           # LangGraph agents backend
│       ├── agents/        # Agent implementations
│       │   └── proposal-agent/
│       │       ├── index.ts
│       │       ├── state.ts
│       │       ├── nodes.ts
│       │       ├── tools.ts
│       │       ├── graph.ts
│       │       └── configuration.ts
│       ├── lib/           # Shared utilities
│       ├── tools/         # Common agent tools
│       ├── tests/         # Backend tests
│       ├── public/        # Static files
│       ├── index.ts       # Entry point
│       ├── package.json   # Backend dependencies
│       └── tsconfig.json  # TypeScript configuration
├── packages/
│   └── shared/            # Shared types and utilities
│       └── src/
│           └── state/     # State definitions
│               └── proposalState.ts
├── langgraph.json         # LangGraph configuration
└── .env.example           # Example environment variables
```

## Configuration Files

1. **langgraph.json**: Configures the LangGraph CLI with graph definitions, entry points, and working directories.

2. **.env.example**: Template for environment variables needed for both frontend and backend.

3. **apps/backend/package.json**: Dependencies specific to the backend, including LangGraph packages.

4. **apps/backend/agents/proposal-agent/configuration.ts**: Configurable options for the proposal agent, editable through LangGraph Studio.

## Running the Application

1. Development mode with both frontend and backend:
   ```bash
   npm run dev
   ```

2. Running with LangGraph Studio for visualization and debugging:
   ```bash
   npm run dev:agents
   ```

## Integration Points

The integration between our existing application and LangGraph happens in several key places:

1. **State Definitions**: Shared state in `packages/shared/src/state/proposalState.ts` used by both frontend and backend.

2. **API Routes**: Backend server exposes REST endpoints at `/api/proposal-agent` that the frontend can call.

3. **Environment Variables**: Shared configuration via environment variables.

4. **Package Structure**: Monorepo setup allows for shared code while maintaining separation.

## Next Steps

1. **API Enhancement**: Add more sophisticated API routes for different proposal operations.

2. **Authentication Integration**: Connect Supabase authentication to agent persistence.

3. **UI Components**: Implement the agent inbox components in the frontend.

4. **Testing**: Create comprehensive tests for the agent components.

5. **Documentation**: Update documentation with integration details.