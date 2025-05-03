# Backend API Refactoring Guide (LangGraph SDK Compatibility)

## 1. Overview

This document details the refactoring of the `apps/backend` Express API to align with the standard interaction patterns expected by LangGraph SDK clients, such as the `@langchain/langgraph-sdk` used in the frontend (`apps/web`).

The primary goal was to move away from the custom `/rfp/*` API prefix and implement endpoints at the server root (`/`) that mirror the standard LangGraph REST API specification. This allows frontend components like `useStream` to interact with the backend seamlessly, often through a Next.js API passthrough route (e.g., `/api/langgraph/*`).

**Key Change:** The backend now manually implements the essential LangGraph API endpoints instead of relying on a non-existent JavaScript version of LangServe or the previous custom routing.

## 2. Core Components

- **`apps/backend/server.ts`**: The main Express server entry point. It initializes the Express app, sets up middleware, initializes the LangGraph graph (`graphInstance`) and checkpointer (`checkpointerInstance`), defines the API routes, and starts the server.
- **`apps/backend/agents/proposal-generation/graph.ts`**: Defines and compiles the core LangGraph `StateGraph` (`createProposalGenerationGraph`).
- **`apps/backend/services/checkpointer.service.ts`**: Provides the `createCheckpointer` factory function to get a configured checkpointer instance (either Supabase-backed via `LangGraphCheckpointer` adapter or in-memory via `MemoryLangGraphCheckpointer` adapter).
- **`apps/backend/lib/persistence/`**: Contains the checkpointer implementations (`supabase-checkpointer.ts`, `memory-checkpointer.ts`) and their respective LangGraph adapters (`langgraph-adapter.ts`, `memory-adapter.ts`).

## 3. API Endpoints

The API is now served directly from the root of the Express application mounted by `server.ts`. The following endpoints are implemented:

### 3.1. `GET /info`

- **Purpose:** Provides basic information about the running graph service. Useful for frontend status checks.
- **Implementation:** Currently returns a placeholder response.
- **Request:** `GET /info`
- **Response (Success):** `200 OK` with JSON body `{ status: "ok", timestamp: "..." }`
- **Response (Error):** `500 Internal Server Error` if initialization failed.

```typescript
// Placeholder in server.ts
langgraphApiRouter.get("/info", (req: Request, res: Response) => {
  // TODO: Implement actual graph info/status retrieval if needed
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

### 3.2. `POST /threads`

- **Purpose:** Creates a new, unique LangGraph thread (conversation) and persists its initial empty state.
- **Implementation:**
  - Validates `assistant_id` and `metadata.rfpId` in the request body.
  - Generates a unique `thread_id` (UUID v4).
  * Creates a `RunnableConfig` containing the `thread_id`.
  - Constructs a minimal initial `Checkpoint` object and `CheckpointMetadata`.
  - Calls `checkpointerInstance.put()` to save the initial state, handling differences between memory and Supabase adapters.
  - Returns the `thread_id` and echoes back metadata.
- **Request:** `POST /threads`
  - Body (JSON): `{ "assistant_id": "proposal-agent", "metadata": { "rfpId": "your-rfp-id" } }`
- **Response (Success):** `201 Created` with JSON body `{ "thread_id": "...", "assistant_id": "...", "metadata": {...}, "created_at": "..." }`
- **Response (Error):** `400 Bad Request` for missing fields, `500 Internal Server Error` for checkpointer errors.

```typescript
// Snippet from server.ts
langgraphApiRouter.post(
  "/threads",
  async (req: Request, res: Response, next: NextFunction) => {
    // ... validation ...
    try {
      // ... checkpointer check, ID generation ...
      const config: RunnableConfig = {
        configurable: { thread_id: newThreadId },
      };
      const initialCheckpoint: Checkpoint = {
        /* ... */
      };
      const initialMetadata: CheckpointMetadata = {
        /* ... */
      };

      // Save based on checkpointer type
      if (checkpointerInstance instanceof MemoryLangGraphCheckpointer) {
        await checkpointerInstance.put(
          config,
          initialCheckpoint,
          initialMetadata,
          {}
        );
      } else if (checkpointerInstance instanceof LangGraphCheckpointer) {
        await (checkpointerInstance as LangGraphCheckpointer).put(
          newThreadId,
          initialCheckpoint
        );
      } else {
        /* error */
      }

      res.status(201).json({
        /* ... thread info ... */
      });
    } catch (error) {
      /* ... error handling ... */
    }
  }
);
```

### 3.3. `GET /threads/:thread_id/state`

- **Purpose:** Retrieves the latest saved checkpoint (state) for a given thread.
- **Implementation:**
  - Extracts `thread_id` from the URL parameters.
  * Creates a `RunnableConfig` with the `thread_id`.
  - Calls `checkpointerInstance.get(config)` to fetch the state.
  - Returns the checkpoint data.
- **Request:** `GET /threads/your-thread-id/state`
- **Response (Success):** `200 OK` with the JSON checkpoint object as the body.
- **Response (Not Found):** `404 Not Found` if the thread or checkpoint doesn't exist.
- **Response (Error):** `500 Internal Server Error` for checkpointer errors.

```typescript
// Snippet from server.ts
langgraphApiRouter.get(
  "/threads/:thread_id/state",
  async (req: Request, res: Response, next: NextFunction) => {
    const { thread_id } = req.params;
    try {
      // ... checkpointer check ...
      const config: RunnableConfig = { configurable: { thread_id } };
      const checkpoint = await checkpointerInstance.get(config);
      if (checkpoint) {
        res.json(checkpoint);
      } else {
        res.status(404).json({ error: "Thread state not found" });
      }
    } catch (error) {
      /* ... error handling ... */
    }
  }
);
```

### 3.4. `POST /threads/:thread_id/update`

- **Purpose:** Allows manually updating the state of a thread (e.g., adding user feedback, correcting tool calls).
- **Implementation:**
  - Extracts `thread_id` from the URL parameters.
  - Takes the update payload from the request body.
  * Creates a `RunnableConfig` with the `thread_id`.
  - Calls `graphInstance.updateState(config, updatePayload)` to apply the update via the graph's internal logic and checkpointer.
  - Returns the configuration of the updated checkpoint.
- **Request:** `POST /threads/your-thread-id/update`
  - Body (JSON): The specific update payload (e.g., `{ "messages": [ ... ] }`). The structure depends on the graph's state schema.
- **Response (Success):** `200 OK` with the JSON runnable config of the updated checkpoint: `{ "configurable": { "thread_id": "...", "checkpoint_id": "..." } }`
- **Response (Error):** `400 Bad Request` for missing body, `500 Internal Server Error` for graph/checkpointer errors.

```typescript
// Snippet from server.ts
langgraphApiRouter.post(
  "/threads/:thread_id/update",
  async (req: Request, res: Response, next: NextFunction) => {
    const { thread_id } = req.params;
    const updatePayload = req.body;
    try {
      // ... graph/checkpointer check ...
      if (!updatePayload) {
        /* 400 error */
      }
      const config: RunnableConfig = { configurable: { thread_id } };
      const updatedConfig = await graphInstance.updateState(
        config,
        updatePayload
      );
      res.json(updatedConfig);
    } catch (error) {
      /* ... error handling ... */
    }
  }
);
```

### 3.5. `POST /threads/:thread_id/stream`

- **Purpose:** Executes the LangGraph graph for a given thread, streaming back state updates and events via Server-Sent Events (SSE). This is the primary endpoint for chat interactions.
- **Implementation:**
  - Sets up SSE headers (`Content-Type: text/event-stream`, etc.).
  - Extracts `thread_id` and the input payload.
  * Creates a `RunnableConfig` with the `thread_id`.
  - Calls `graphInstance.stream(input, config)` to start the graph execution stream.
  - Iterates through the stream events:
    - Formats each event chunk according to the LangGraph SDK's streaming protocol (likely `event: data`, `data: JSON.stringify(chunk)`).
    - Writes the formatted event to the response stream.
  - Handles stream end and errors, ensuring the connection is closed properly.
- **Request:** `POST /threads/your-thread-id/stream`
  - Body (JSON): The input payload for the graph (e.g., `{ "messages": [{ "role": "user", "content": "Hello" }] }`). Can be empty/null if resuming after an interrupt.
- **Response (Success):** `200 OK` with `Content-Type: text/event-stream`. The body is a stream of SSE events.
- **Response (Error):** `400 Bad Request` for missing input (if required), `500 Internal Server Error` for graph/checkpointer errors during streaming setup. Errors during the stream itself are typically handled by closing the connection.

```typescript
// Snippet from server.ts
langgraphApiRouter.post(
  "/threads/:thread_id/stream",
  async (req: Request, res: Response, next: NextFunction) => {
    const { thread_id } = req.params;
    const input = req.body;
    try {
      // ... graph/checkpointer check ...
      // --- Setup SSE ---
      res.setHeader("Content-Type", "text/event-stream");
      // ... other SSE headers ...

      const config: RunnableConfig = { configurable: { thread_id } };

      const stream = await graphInstance.stream(input || null, config); // Pass null if input is empty

      // --- Writable stream to handle SSE formatting ---
      const sseStream = new Writable({
        /* ... handles writing formatted events to res ... */
      });

      // Pipe graph stream to SSE stream
      stream.pipeTo(
        new WritableStream({
          /* ... calls sseStream.write ... */
        })
      );

      req.on("close", () => {
        /* ... cleanup ... */
      });
    } catch (error) {
      /* ... error handling for setup ... */
    }
  }
);
```

## 4. Initialization

The `initializeLangGraph` function in `server.ts` is called asynchronously when the server starts. It's responsible for:

1.  Creating the compiled graph instance using `createProposalGenerationGraph`.
2.  Creating the checkpointer instance using `createCheckpointer`.
3.  Making `graphInstance` and `checkpointerInstance` available globally within the server module for the route handlers to use.

## 5. Logging

Descriptive logs using the custom `Logger` are included in each endpoint handler to trace requests, parameters, successes, and errors. Review `server.ts` for specific log messages.
