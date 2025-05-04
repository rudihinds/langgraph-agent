# Definitive Plan: Fix Chat Thread History Loading

This plan outlines the steps to correctly load persisted chat history for existing threads in the frontend, adhering strictly to LangGraph principles and utilizing existing backend endpoints.

**Overall Goal:** Ensure that when a user navigates to the chat UI with an existing `threadId`, the complete message history for that thread is displayed immediately, and subsequent interactions correctly append to that thread's state via the stream.

## Phase 1: Frontend State Hydration

**Goal:** Fetch the initial state (specifically message history) for an existing thread from the backend _before_ initializing the stream connection for updates.

- [ ] **Step 1.1: Add State Fetching Logic to `StreamProvider`**

  - **File:** `apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - **Goal:** Introduce logic to call the backend's `GET /threads/:thread_id/state` endpoint when `initialThreadId` is provided on component mount.
  - **Action:**
    - Create a new `useEffect` hook that runs when `initialThreadId` changes (and is not null).
    - Inside the effect, construct the URL: `${process.env.NEXT_PUBLIC_API_URL}/threads/${initialThreadId}/state`.
    - Use `fetch` to make a GET request to this URL.
    - Handle potential errors during the fetch (network issues, 404 if thread not found, etc.) and display appropriate toasts/logs.
    - On success, parse the JSON response. Expect it to match the `OverallProposalState` structure (or at least contain a `values.messages` array).

- [ ] **Step 1.2: Store Initial Messages**

  - **File:** `apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - **Goal:** Store the fetched historical messages in a way that the `useStream` hook or the `Thread` component can access them.
  - **Action:**
    - Introduce a new state variable within `StreamProvider`, e.g., `const [initialMessages, setInitialMessages] = useState<Message[] | null>(null);`.
    - In the `useEffect` from Step 1.1, upon successfully fetching the state, extract the `messages` array from the response (`response.values.messages`) and update the `initialMessages` state using `setInitialMessages`.
    - Add a loading state (e.g., `isFetchingHistory`) managed within this effect to potentially disable UI elements while history loads.

- [ ] **Step 1.3: Pass Initial Messages to `useStream` or Context**
  - **File:** `apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - **Goal:** Make the fetched `initialMessages` available to the rest of the chat UI.
  - **Action:**
    - **Option A (Modify `useStream` - Preferred if possible):** If the `useStream` hook can be modified to accept an `initialMessages` option, pass the `initialMessages` state to it. This would allow the hook itself to manage the merging of initial and streamed messages. (Requires inspecting/modifying `useStream`).
    - **Option B (Modify Context Value):** If modifying `useStream` is not feasible/desired, update the `StreamContext.Provider`'s `value`. The `messages` property exposed by the context should combine the `initialMessages` (if loaded) with the messages received from the `streamValue` hook. Ensure duplicates are handled correctly (e.g., only show initial messages until the stream connects and potentially sends overlapping messages).
    - The context value logic might look something like: `const displayedMessages = initialMessages ? [...initialMessages, ...streamValue.messages.slice(initialMessages.length)] : streamValue.messages;` (This logic needs careful implementation to avoid duplicates based on message IDs if the stream _also_ sends history). A safer initial approach might be: `const displayedMessages = streamValue.messages.length > 0 ? streamValue.messages : initialMessages ?? [];`

## Phase 2: Stream Connection (No Change Needed - Verification Only)

**Goal:** Verify that the existing stream connection logic correctly targets the thread-specific endpoint for receiving _new_ updates after the initial history load.

- [ ] **Step 2.1: Verify `apiUrl` Construction**

  - **File:** `apps/web/src/features/chat-ui/providers/StreamProvider.tsx`
  - **Goal:** Confirm the `apiUrl` passed to `useTypedStream` correctly points to the backend's streaming endpoint _including_ the `thread_id`.
  - **Action:** Double-check the logic that sets the `apiUrl`. It should dynamically construct the URL like `${directApiUrl}/threads/${activeThreadId}/stream` (or the appropriate endpoint) only when `activeThreadId` is present and configuration is valid.

- [ ] **Step 2.2: Verify `useStream` Hook Connection**
  - **File:** `apps/web/src/features/chat-ui/hooks/useStream.ts` (or equivalent)
  - **Goal:** Confirm the hook uses the provided `apiUrl` to establish its `EventSource` or other streaming connection.
  - **Action:** Briefly review the hook's implementation to ensure `apiUrl` is used as the connection target.

## Success Criteria

1.  When navigating to `/dashboard/chat?rfpId=X&threadId=Y`:
    - A GET request is made to `/api/threads/Y/state`.
    - The chat UI initially displays all historical messages retrieved from the `/state` endpoint.
    - A stream connection is established to `/api/threads/Y/stream` (or equivalent).
    - Sending a new message uses the `submit` function, correctly passing the input and `thread_id: Y` via the POST request payload's `configurable` object to the stream endpoint.
    - New messages/responses received via the stream are appended correctly to the displayed history.
2.  When navigating to `/dashboard/chat?rfpId=X` (no `threadId`):
    - No request is made to `/state`.
    - The chat UI shows the "No messages yet" view.
    - Sending the first message generates a _new_ `thread_id` (handled by `StreamProvider`'s `useEffect` for `initialThreadId` being null).
    - Subsequent interactions use this new `thread_id`.
3.  Error handling: Appropriate feedback (toasts, console logs) is provided if fetching the initial state fails.

## Deferred

- Optimizing the merging logic between `initialMessages` and `streamValue.messages` if the stream sends overlapping history.
- Adding sophisticated loading indicators while initial history is fetched.
- Handling the "new thread" scenario more elegantly if the backend requires an initial POST to create a thread before streaming.

This plan leverages the existing backend structure and aligns with LangGraph's separation of state retrieval (`getState`) and state update streaming (`stream`).
