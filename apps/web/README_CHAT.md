# Chat Integration Configuration

This document outlines how to set up and configure the chat integration with LangGraph.

## Environment Configuration

To properly connect your frontend to the LangGraph backend, you need to set the following environment variables:

### Frontend (.env.local in apps/web)

```bash
# LangGraph API URL (default if not set: http://localhost:2024)
NEXT_PUBLIC_LANGGRAPH_API_URL=http://localhost:2024
```

### Backend (.env in apps/backend)

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=sk-xxxxx

# Tracing (optional)
LANGCHAIN_API_KEY=ls_xxxxx
LANGCHAIN_CALLBACKS_BACKGROUND=true
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=your-project-name
```

## Architecture

The chat integration follows this architecture:

1. **Next.js Frontend Components**:

   - `StreamProvider`: Manages connection to LangGraph and thread state
   - `Thread`: Renders chat messages and handles user input
   - `InterruptProvider`: Manages human-in-the-loop interactions

2. **LangGraph Backend**:
   - Runs standalone LangGraph server with graph definitions
   - Exposes API endpoints for thread management and message streaming
   - Handles authentication and state persistence

## State Management

The chat UI uses React Context for state management:

- `StreamContext`: Manages connection to LangGraph, thread data, and message streaming
- `InterruptContext`: Handles human-in-the-loop interactions when the agent needs user input

## URL Parameters

The chat UI uses the following URL parameters:

- `threadId`: The ID of the current thread, which will be automatically managed
- `rfpId`: (Optional) The ID of the RFP document being discussed

## Common Issues

### Authentication Issues

If you see error messages about invalid API keys, make sure you have set the `OPENAI_API_KEY` environment variable with a valid OpenAI API key.

### Connection Issues

If the chat UI cannot connect to the LangGraph server, verify:

1. The LangGraph server is running (`npm run langgraph:dev`)
2. The `NEXT_PUBLIC_LANGGRAPH_API_URL` environment variable is set correctly
3. There are no network issues or CORS restrictions

## Development Notes

- The LangGraph server must be running for the chat UI to function
- The chat UI will automatically create a new thread if no `threadId` is provided
- The thread state is persisted on the server, allowing conversations to continue across page refreshes
