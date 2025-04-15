# Proposal Writer Agent

A comprehensive proposal writing system using LangGraph.js and Next.js. This project helps users create high-quality proposals for grants and RFPs by using AI agents to analyze requirements, generate content, and provide feedback.

## Project Structure

This project is structured as a monorepo containing:

- **Backend**: LangGraph agents and tools to handle the proposal writing process
- **Frontend**: Next.js web application for user interaction

### Directory Structure

```
proposal-writer/
├── src/                  # Backend source code
│   ├── agents/           # LangGraph agent definitions
│   │   ├── basic-agent.ts         # Simple agent example
│   │   ├── multi-agent.ts         # Multi-agent example
│   │   └── proposal-agent/        # Proposal writing agent
│   │       ├── state.ts           # State definitions
│   │       ├── nodes.ts           # Node functions
│   │       ├── tools.ts           # Custom tools
│   │       └── graph.ts           # Graph definition
│   ├── lib/              # Shared utilities
│   │   ├── supabase.ts            # Supabase integration
│   │   └── types.ts               # Type definitions
│   └── index.ts          # Backend entry point
├── web/                  # Frontend Next.js app
│   ├── src/
│   │   ├── app/                   # Next.js app router
│   │   ├── components/            # UI components
│   │   └── lib/                   # Frontend utilities
│   └── ...                        # Next.js configuration files
├── .env                  # Environment variables
├── .env.example          # Environment variable examples
├── langgraph.json        # LangGraph server configuration
├── package.json          # Project dependencies
└── tsconfig.json         # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js v18+
- npm or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/proposal-writer.git
   cd proposal-writer
   ```

2. Install dependencies:

   ```bash
   npm run install:all
   ```

3. Copy the environment variables:

   ```bash
   cp .env.example .env
   ```

4. Add your API keys to the `.env` file.

### Development

Run the development servers:

```bash
npm run dev
```

This will start:

- The backend server at http://localhost:3001
- The LangGraph server at http://localhost:2024
- The Next.js frontend at http://localhost:3000

### Alternative Development

You can run the servers independently:

```bash
# Backend only
npm run dev:backend

# Frontend only
npm run dev:frontend

# LangGraph server only
npm run dev:agents
```

## Using the Application

1. Open the application at http://localhost:3000
2. Enter the LangGraph server URL (default: http://localhost:2024)
3. Choose the proposal_agent as your Agent ID
4. Start a conversation with the proposal writing agent

## Features

- RFP/grant analysis
- Funder research
- Solution analysis
- Connection pairs generation
- Structured proposal generation
- Human-in-the-loop feedback
- Complete proposal export

## Error Handling and Resilience System

The application implements a comprehensive error handling and resilience system to ensure robustness:

### Key Components

- **Error Classification**: Automatically categorizes errors (rate limits, context windows, tool failures, etc.)
- **Retry Mechanisms**: Implements exponential backoff for transient errors
- **Context Window Management**: Prevents token limit errors through message truncation and summarization
- **Graceful Degradation**: Provides alternative paths when primary functions fail
- **Error Monitoring**: Tracks and logs errors for analysis and improvement

### Integration Points

The error handling system is integrated at multiple levels:

- LLM interaction layer with wrapper functions
- Node level with error catching and recovery
- Graph level with conditional edges for different error scenarios
- Tool execution with standardized error propagation

### Development

For developers extending the system:

- All error handlers are in `apps/backend/lib/llm/error-handlers.ts`
- Error classification logic is in `apps/backend/lib/llm/error-classification.ts`
- Context window management is in `apps/backend/lib/llm/context-window-manager.ts`
- Message truncation utilities are in `apps/backend/lib/llm/message-truncation.ts`
- Monitoring tools are in `apps/backend/lib/llm/monitoring.ts`

See `apps/backend/lib/llm/error-handling.md` for detailed implementation documentation.

## Testing

Run the test suite:

```bash
npm test
```

#### Authentication Testing

We've implemented comprehensive tests for the Supabase authentication flow, ensuring:

- Proper user creation and synchronization
- Robust session management
- Comprehensive error handling
- Protection of authenticated routes

For detailed information about our authentication implementation and testing:

- See [SUPABASE_IMPLEMENTATION.md](./SUPABASE_IMPLEMENTATION.md) for implementation details
- See [AUTHENTICATION_TESTING.md](./AUTHENTICATION_TESTING.md) for testing approach

## Documentation

For detailed information about our implementation:

- See [SUPABASE_IMPLEMENTATION.md](./SUPABASE_IMPLEMENTATION.md) for authentication implementation details
- See [AUTHENTICATION_TESTING.md](./AUTHENTICATION_TESTING.md) for authentication testing approach
- See [docs/database-schema-relationships.md](./docs/database-schema-relationships.md) for database schema and relationships

## License

MIT
