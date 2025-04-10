# Agent Chat UI

Agent Chat UI is a Vite + React application which enables chatting with any LangGraph server with a `messages` key through a chat interface.

## Setup

> [!TIP]
> Don't want to run the app locally? Use the deployed site here: [agent-chat-ui.vercel.app](https://agentchat.vercel.app)!

First, clone the repository:

```bash
git clone https://github.com/langchain-ai/agent-chat-ui.git

cd agent-chat-ui
```

Install dependencies:

```bash
pnpm install
```

Run the app:

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`.

## Date Format Conventions

This application follows specific date format conventions:

- **UI Display Format**: `DD/MM/YYYY` (British format)

  - All dates shown to users in the UI follow this format
  - Date input fields expect dates in this format

- **API Format**: `YYYY-MM-DD` (ISO format)

  - All dates sent to or received from the API use this format
  - This format is used for database storage

- **Internal Handling**:
  - Dates are stored as JavaScript `Date` objects in component state
  - Conversion between formats happens at the boundaries (UI display and API calls)
  - Utilities for date handling are in `lib/utils/date-utils.ts`

When implementing new features that use dates:

1. Use the `AppointmentPicker` component for date selection
2. Use `formatDateForUI()` to display dates
3. Use `formatDateForAPI()` when sending dates to the API

## Usage

Once the app is running (or if using the deployed site), you'll be prompted to enter:

- **Deployment URL**: The URL of the LangGraph server you want to chat with. This can be a production or development URL.
- **Assistant/Graph ID**: The name of the graph, or ID of the assistant to use when fetching, and submitting runs via the chat interface.
- **LangSmith API Key**: (only required for connecting to deployed LangGraph servers) Your LangSmith API key to use when authenticating requests sent to LangGraph servers.

After entering these values, click `Continue`. You'll then be redirected to a chat interface where you can start chatting with your LangGraph server.
