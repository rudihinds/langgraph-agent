# Frontend Chat Thread Logic Implementation Plan

This document outlines the steps to implement RFP-contextualized chat thread management in the frontend, ensuring users can start new chats for specific RFPs or continue existing ones.

## Phase 1: Preparation & Context Handling

- [ ] **Step 1.1: Define URL Routing Strategy**

  - Confirm the primary chat route (e.g., `/dashboard/chat`).
  - Establish query parameter usage:
    - `/dashboard/chat?rfpId=<RFP_UUID>`: **New Thread Scenario**.
    - `/dashboard/chat?rfpId=<RFP_UUID>&threadId=<THREAD_UUID>`: **Existing Thread Scenario**.
    - `/dashboard/chat`: **No Context Scenario**.

- [ ] **Step 1.2: Update Chat Page Component (`apps/web/app/dashboard/chat/page.tsx`)**
  - Import `useSearchParams` from `next/navigation`.
  - Read `rfpId` and `threadId` from URL parameters.
  - **Conditional Rendering:**
    - If neither `rfpId` nor `threadId` exists: Render a `SelectProposalPrompt` component (to be created). This component should guide the user to select a thread via the (future) sidebar or navigate to the proposal creation flow.
    - If `rfpId` _is_ present: Render the main chat structure (`StreamProvider`, `InterruptProvider`, `Thread`).
  - **Prop Drilling:** Pass `rfpId` and `initialThreadId` (which is `threadId` from the URL, possibly null) as props to `StreamProvider`.

```typescript
// Example in apps/web/app/dashboard/chat/page.tsx
import { useSearchParams } from "next/navigation";
import { StreamProvider } from "@/features/chat-ui/providers/StreamProvider";
import { Thread } from "@/features/chat-ui/components/Thread";
// import SelectProposalPrompt from './SelectProposalPrompt'; // Create this component

export default function ChatPage() {
  const searchParams = useSearchParams();
  const rfpId = searchParams.get("rfpId");
  const initialThreadId = searchParams.get("threadId");

  if (!rfpId) {
    // return <SelectProposalPrompt />; // Render prompt when no RFP context
  }

  return (
    <StreamProvider rfpId={rfpId} initialThreadId={initialThreadId}>
      {/* ... InterruptProvider, Thread, etc. ... */}
      <Thread />
    </StreamProvider>
  );
}
```

## Phase 2: Stream Provider Logic

- [ ] **Step 2.1: Modify `StreamProviderProps` (`apps/web/src/features/chat-ui/providers/StreamProvider.tsx`)**

  - Update the interface to accept `rfpId: string | null` and `initialThreadId: string | null`.

- [ ] **Step 2.2: Internal State Management**

  - Add internal state within `StreamProvider` to manage the _active_ thread ID:
    ```typescript
    const [activeThreadId, setActiveThreadId] = useState<string | null>(
      initialThreadId
    );
    ```
  - Add state to track if the current active thread is newly generated client-side:
    ```typescript
    const [isNewClientThread, setIsNewClientThread] = useState<boolean>(false);
    ```

- [ ] **Step 2.3: Implement Thread ID Initialization Logic**

  - Use a `useEffect` hook that runs when `rfpId` or `initialThreadId` props change.
  - **Logic inside `useEffect`:**
    - If `rfpId` prop is null/undefined:
      - Reset `activeThreadId` to `null`.
      - Set `isNewClientThread` to `false`.
      - (The chat UI should ideally not be rendered by the parent in this case).
    - If `rfpId` is present AND `initialThreadId` prop is also present:
      - Set `activeThreadId` to `initialThreadId`.
      - Set `isNewClientThread` to `false`.
    - If `rfpId` is present BUT `initialThreadId` prop is null/undefined (New Thread Scenario):
      - Generate a new UUID: `const newThreadId = uuidv4();`
      - Set `activeThreadId` to `newThreadId`.
      - Set `isNewClientThread` to `true`.
      - **Important:** Do _not_ update the URL query params here. The provider manages the active session's thread ID internally.

- [ ] **Step 2.4: Adapt `useStream` Hook Initialization**
  - Modify the arguments passed to the `useStream` (or `useTypedStream`) hook.
  - **Remove `threadId` from `useStream` args:** Do not pass `threadId` directly to the hook initializer. LangGraph SDK's hook doesn't use it for initialization; thread context is managed via the `configurable` object during invocation/submission.
  - Ensure `apiUrl` and `assistantId` are correctly passed.

```typescript
// Inside StreamProvider
const streamValue = useTypedStream({
  apiUrl: directApiUrl,
  assistantId: assistantId,
  streamMode: "values",
  // threadId: activeThreadId ?? undefined, // <<< REMOVE THIS LINE
});
```

- [ ] **Step 2.5: Update `submit` Function Logic**
  - Locate the `submit` function obtained from the `useStream` hook.
  - Modify the call to `submit` to include the `configurable` object with the `activeThreadId`.
  - **New Thread Context:** If `isNewClientThread` is true, consider adding `rfpId` and `userId` (fetch `userId` if needed) to the _first message's payload_ or initial state structure if the backend graph requires it for context on thread creation. Reset `isNewClientThread` to `false` after the first submission.

```typescript
// Example modification within a wrapper around streamValue.submit
const handleSubmitWrapper = (values: Partial<StateType> /* other args */) => {
  if (!activeThreadId) {
    toast.error("Cannot send message: No active thread.");
    return;
  }

  const config = {
    configurable: {
      thread_id: activeThreadId,
      // Potentially add user_id if needed by backend for checkpointer RLS
      // user_id: fetchedUserId,
    },
    // ... other options like toolChoice
  };

  let submissionValues = values;
  // If it's the very first message of a client-generated thread,
  // potentially inject context needed by the backend graph's start.
  if (isNewClientThread && values.messages && values.messages.length > 0) {
    console.log(
      `Injecting initial context for new thread ${activeThreadId}: rfpId=${rfpId}`
    );
    // Example: Modify first message or add context to values
    // This depends heavily on how the backend graph expects initial context.
    // For simplicity, we might just rely on backend retrieving context based on thread_id + user_id.
    // Let's assume for now the backend handles context association via thread_id + checkpointer logic.
    setIsNewClientThread(false); // Reset flag after first submission
  }

  console.log(
    `[StreamProvider] Submitting to thread: ${activeThreadId} with config:`,
    config
  );
  streamValue.submit(submissionValues, { config });
};

// The context value should expose this handleSubmitWrapper instead of streamValue.submit directly
const contextValue = useMemo(
  () => ({
    // ... other values
    submit: handleSubmitWrapper,
    threadId: activeThreadId, // Expose the active threadId
  }),
  [
    /* dependencies */
  ]
);
```

- [ ] **Step 2.6: Refine Context Value**
  - Ensure the `StreamContextType` interface and the returned `contextValue` correctly reflect the structure, including the `activeThreadId` and the potentially wrapped `submit` function.

## Phase 3: UI & Finalization

- [ ] **Step 3.1: Implement `SelectProposalPrompt` Component**

  - Create a simple component displayed by `ChatPage` when no `rfpId` is present.
  - Include text explaining the situation.
  - Add a button/link styled like "Start New Proposal" that navigates the user to the proposal creation route (e.g., `/proposals/new/rfp`).
  - Mention that users can select existing conversations from the sidebar (even if the sidebar isn't built yet).

- [ ] **Step 3.2: Testing**
  - Test the "No Context" scenario: Ensure the prompt appears.
  - Test the "New Thread" scenario (`rfpId` only): Verify a UUID is generated internally, the stream connects, and messages are sent with the correct `thread_id` in `configurable`.
  - Test the "Existing Thread" scenario (`rfpId` and `threadId`): Verify the provider uses the `initialThreadId`, connects, loads previous messages (if any), and sends messages with the correct `thread_id`.
  - Test switching between scenarios by changing URL parameters.

## Success Criteria

- Users accessing `/dashboard/chat` without parameters see a prompt to select or start a new proposal.
- Users accessing `/dashboard/chat?rfpId=<ID>` start a new chat session; messages sent are associated with a unique, newly generated `thread_id` linked conceptually to the `rfpId`.
- Users accessing `/dashboard/chat?rfpId=<ID>&threadId=<ID>` load the specified chat session; messages sent use the provided `thread_id`.
- The correct `thread_id` is consistently passed in the `configurable` object when submitting messages via the `useStream` hook's `submit` function.
- The application remains stable when switching between URLs with different parameters.

## Deferred Items (Post-MVP)

- Implementation of the `ThreadHistorySidebar` component to list and select existing threads.
- UI elements on the dashboard explicitly offering "Continue Chat" vs. "Start New Chat" for each RFP.
- Backend logic/API endpoints to fetch threads associated with an `rfpId` for the sidebar.
- Handling potential race conditions if URL parameters change while a stream is active.
- Real-time updates to the sidebar if new threads are created elsewhere.
- Multi-user collaboration features.
- Multi-tenant organization filtering.
- Injecting `rfpId`/`userId` context into the initial graph state if required by the backend (beyond just checkpointer configuration).
