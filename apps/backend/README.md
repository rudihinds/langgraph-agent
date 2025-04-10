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

## Testing

Run tests with:

```bash
npm test           # Run all tests
npm run test:unit  # Run unit tests only
npm run test:integration # Run integration tests only
```

## API Routes

The backend exposes the following API routes when running:

- `POST /api/proposal/create` - Create a new proposal
- `POST /api/proposal/:id/message` - Add a message to an existing proposal
- `GET /api/proposal/:id` - Get the current state of a proposal
- `GET /api/proposal/:id/history` - Get the message history of a proposal

See the API documentation for more details on request and response formats.