# Definitive Plan: Fix Chat Thread History Loading (useStream Convention)

This plan outlines the steps to correctly load persisted chat history using the built-in mechanisms of the LangGraph `useStream` hook and its expected backend endpoints.

**Overall Goal:** Ensure that when a user navigates to the chat UI with an existing `threadId`, the `useStream` hook automatically fetches the history via the standard `POST /threads/:thread_id/history` endpoint, displays it, and subsequent interactions correctly use the `POST /threads/:thread_id/runs/stream` endpoint.

## Phase 1: Frontend Configuration (`useStream` Alignment) - COMPLETE

**Goal:** Ensure the frontend `StreamProvider` correctly configures and uses the `useStream` hook according to LangGraph conventions for history and streaming.

- [x] **Step 1.1: Configure `useStream` Correctly**

  - **File:** `apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - **Goal:** Initialize `useStream` with the necessary parameters for it to handle history and streaming automatically.
  - **Action:** Ensured `useStream` is called with:
    - `apiUrl`: The base URL pointing to the LangGraph API endpoint (e.g., `http://localhost:2024/api/langgraph`).
    - `assistantId`: The ID of the deployed assistant/graph (used potentially by the hook or backend).
    - `threadId`: The `activeThreadId` state variable.
    - `messagesKey: "messages"`: Specifies the key within the state where messages are stored.
  - **Status:** Completed.

- [x] **Step 1.2: Configure `submit` Correctly**

  - **File:** `apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - **Goal:** Ensure messages are submitted correctly via the hook's `submit` function.
  - **Action:** The `handleSubmitWrapper` correctly calls `streamValue.submit` and passes the `thread_id` within the `configurable` property of the `config` object.
  - **Status:** Completed.

- [x] **Step 1.3: Expose Context Correctly**
  - **File:** `apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - **Goal:** The provider's context value directly uses the `messages`, `isLoading`, `isError`, etc., returned by the `useStream` hook.
  - **Action:** The `contextValue` is correctly mapping the hook's return values.
  - **Status:** Completed.

## Phase 2: Backend Express Router Implementation (LangGraph Standard Endpoints)

**Goal:** Implement the standard POST endpoints expected by `useStream` within the existing Express router that handles LangGraph interactions.

- [ ] **Step 2.1: Implement `POST /threads/:thread_id/history`**

  - **File:** `apps/backend/api/langgraph/index.ts`
  - **Goal:** Create an Express route handler that retrieves the thread's state history using the checkpointer and returns it in the format expected by `useStream`.
  - **Action:**
    1. Define a new route: `router.post("/threads/:thread_id/history", async (req, res, next) => { ... });`
    2. Extract `thread_id` from `req.params`.
    3. Access the `checkpointerInstance` passed into `createLangGraphRouter` (ensure it's passed correctly from `server.ts`).
    4. Call `checkpointerInstance.get({ configurable: { thread_id } });` to fetch the latest checkpoint.
    5. If a checkpoint exists, send it back as JSON: `res.json(checkpoint);` (The hook likely expects the full checkpoint object containing `channel_values`).
    6. If no checkpoint exists (thread not found), return an empty object or appropriate response (e.g., `res.json({ channel_values: { messages: [] } });` or potentially a 404, though `useStream` might handle empty responses gracefully).
    7. Include robust error handling (try/catch) and logging.

- [ ] **Step 2.2: Implement `POST /threads/:thread_id/runs/stream`**

  - **File:** `apps/backend/api/langgraph/index.ts`
  - **Goal:** Create an Express route handler that receives input, invokes the LangGraph stream, and pipes the Server-Sent Events (SSE) back to the client.
  - **Action:**
    1. Define a new route: `router.post("/threads/:thread_id/runs/stream", async (req, res, next) => { ... });`
    2. Extract `thread_id` from `req.params`.
    3. Extract `input` and `config` from `req.body`. **Crucially, ensure the `config` from the request body (which includes `configurable: { thread_id }`) is correctly passed to `graphInstance.stream`.**
    4. Access the `graphInstance` passed into `createLangGraphRouter` (ensure it's passed correctly from `server.ts`).
    5. **Validate `input`:** Check if the `input` structure matches what the graph expects to prevent 422 Unprocessable Entity errors. Log a warning or return a 400/422 if invalid.
    6. Set SSE Headers: `res.setHeader('Content-Type', 'text/event-stream'); res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Connection', 'keep-alive');`
    7. Invoke the graph stream: `const stream = await graphInstance.stream(input, config);`
    8. Iterate through the stream chunks: `for await (const chunk of stream) { ... }`
    9. Format each chunk as an SSE event: `res.write(\`data: ${JSON.stringify(chunk)}\\n\\n\`);`
    10. Flush data to the client if necessary (`res.flushHeaders()` or similar depending on Express setup).
    11. End the response when the stream finishes: `res.end();`
    12. Include robust error handling (try/catch) for both stream invocation and iteration. Send an error event if issues occur during streaming.

## Phase 3: Testing & Validation

**Goal:** Verify the end-to-end flow works as expected.

- [ ] **Step 3.1: Test History Loading**
  - **Action:** Navigate to `/dashboard/chat?rfpId=X&threadId=Y` (where Y is a thread with existing history). Verify the UI loads with the previous messages. Check browser network tools to confirm a successful `POST /api/langgraph/threads/Y/history` request.
- [ ] **Step 3.2: Test Message Submission**
  - **Action:** Send a new message in an existing thread. Verify the message appears, and a response is streamed back. Check network tools for a successful `POST /api/langgraph/threads/Y/runs/stream` request and subsequent SSE events. Check backend logs for confirmation.
- [ ] **Step 3.3: Test New Thread**
  - **Action:** Navigate to `/dashboard/chat?rfpId=X`. Verify the chat starts empty. Send a message. Verify it works and subsequent interactions use the new `thread_id`.

## Success Criteria

1.  Navigating to an existing thread (`threadId` in URL) correctly displays the full message history fetched via `POST /history`.
2.  Sending messages in an existing thread correctly uses `POST /runs/stream` and appends messages/responses.
3.  Starting a new chat (no `threadId`) works correctly, generating a new ID and allowing interaction.
4.  The 404 (`/history`) and 422 (`/runs/stream`) errors are resolved.

## Deferred

- Advanced error handling on the backend endpoints.
- UI optimizations for loading states.
