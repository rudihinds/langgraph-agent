# Chat UI Integration Setup

This document explains how to set up and run the Chat UI integration with LangGraph for the proposal generation agent.

## Required Servers

To fully enable the chat functionality, you need to run three servers:

1. **LangGraph Server**: Handles the agent graphs and streaming responses
2. **Backend Express Server**: Handles API requests, authentication, and RFP operations
3. **Frontend Next.js Server**: Serves the web UI

## Quick Start

The easiest way to start all required servers is to use the following commands:

```bash
# Start both backend servers (LangGraph + Express) with one command
npm run start:all

# In a separate terminal, start the frontend
cd apps/web && npm run dev
```

## Manual Setup

If you need to start servers individually:

### 1. LangGraph Server

```bash
# From the project root
npm run langgraph
```

This starts the LangGraph server on port 2024 and loads the agent graphs defined in `langgraph.json`.

### 2. Backend Express Server

```bash
# From the project root
cd apps/backend && npm run dev:api
```

This starts the Express server on port 3002, handling API requests.

### 3. Frontend Next.js Server

```bash
# From the project root
cd apps/web && npm run dev
```

This starts the Next.js server on port 3000.

## Graph Configuration

The LangGraph server needs to have the chat agent graph properly registered. This is done in `langgraph.json` with this configuration:

```json
{
  "graphs": {
    "proposal-generation": "apps/backend/agents/proposal-generation/graph.ts:createProposalGenerationGraph",
    "proposal-agent": "apps/backend/agents/proposal-generation/graph.ts:createProposalGenerationGraph",
    "agent": "apps/backend/agents/proposal-generation/graph.ts:createProposalGenerationGraph"
  }
}
```

The `"agent"` name is critical as it's the default assistantId used by the StreamProvider.

## Troubleshooting

### "No assistant found for agent" Error

If you see this error:

```
HTTPError: HTTP 404: No assistant found for "agent". Make sure the assistant ID is for a valid assistant or a valid graph ID.
```

Ensure:

1. The LangGraph server is running
2. The `langgraph.json` file has the "agent" graph registered
3. Restart the LangGraph server

### Connection Errors

If the chat UI cannot connect to the backend:

1. Verify all three servers are running
2. Check the ports:
   - LangGraph should be on port 2024
   - Express server should be on port 3002
   - Next.js should be on port 3000
3. Ensure the StreamProvider is configured with the correct URL

### Missing graph-streaming.js Error

If you see:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/path/to/graph-streaming.js'
```

Ensure the `graph-streaming.ts` file exists in the `apps/backend/agents/proposal-generation/` directory.

## Flow Overview

1. User clicks "Continue in Chat" on a proposal card
2. Next.js redirects to `/dashboard/chat?rfpId=<id>`
3. StreamProvider initializes a thread with the LangGraph server
4. LangGraph server creates a stateful chat session
5. User interacts with the chat UI

## Environment Variables

For proper configuration, ensure these environment variables are set:

- `NEXT_PUBLIC_LANGGRAPH_API_URL`: URL of the LangGraph server (default: http://localhost:2024)
- `PORT`: Port for the Express server (default: 3002)
