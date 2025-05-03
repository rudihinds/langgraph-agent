# Refactoring Backend API for LangGraph SDK Compatibility

## Goal

Modify the `apps/backend` API to align with the standard endpoints expected by the `@langchain/langgraph-sdk` (used in `apps/web`) and the `langgraph-nextjs-api-passthrough`. This involves moving away from the custom `/rfp` route prefix and adopting the standard LangGraph server pattern.

## Analysis Summary

1.  **Frontend Expectation:** `useStream` hook expects standard endpoints (`/info`, `/threads`, `/threads/{id}/state`, etc.) relative to its `apiUrl`.
2.  **API Passthrough:** The Next.js passthrough route proxies `/api/langgraph/*` to `LANGGRAPH_API_URL`, assuming standard endpoints at the backend's root.
3.  **Current Backend:** Serves relevant logic under `/rfp`, which is incompatible with SDK/passthrough expectations.

## Required Resources

To implement this refactor, the following files and information are needed:

**Backend (`apps/backend`):**

- **Express Server Setup:**
  - `server.ts`
  - `api/express-server.ts` (if exists, else check `server.ts`/`api/index.ts`)
  - `api/index.ts`
- **Current API Implementation (`/rfp` routes):**
  - `api/rfp/index.ts`
  - `api/rfp/express-handlers/start.js`
  - `api/rfp/feedback.ts`
  - `api/rfp/resume.ts`
  - `api/rfp/interrupt-status.ts`
  - `api/rfp/chat.ts`
  - `api/rfp/thread.ts`
- **LangGraph Graph Instance:**
  - `agents/proposal-generation/graph.ts`
  - `register-agent-graphs.ts` (if exists)
  - `services/orchestrator.service.ts` (or wherever graph is instantiated/used)
- **Checkpointer Implementation:**
  - `services/checkpointer.service.ts`
  - `lib/persistence/checkpointer-factory.ts` (if exists)
  - `lib/persistence/supabase-checkpointer.ts`
  - `lib/persistence/ICheckpointer.ts`
- **Authentication/Middleware:**
  - `lib/middleware/langraph-auth.ts` (if exists)
  - `lib/supabase/auth-utils.ts`
  - `lib/supabase/server.ts`
- **LangGraph Documentation:**
  - Latest official LangGraph.js documentation on integrating with existing Express servers (confirm function like `createLangGraphServer`, `addRoutes`, etc.).

**Frontend (`apps/web`):**

- **Environment Configuration:**
  - `.env.*` files (for `NEXT_PUBLIC_API_URL`)
- **API Passthrough Route:**
  - `app/api/langgraph/[...path]/route.ts`
- **Streaming Hook Usage:**
  - `src/features/chat-ui/providers/StreamProvider.tsx`

## Refactoring Plan

1.  **Integrate Standard LangGraph Server:**

    - **Action:** Modify `apps/backend/server.ts` or `apps/backend/api/express-server.ts`.
    - **Method:** Utilize LangGraph.js server utilities (e.g., `createLangGraphServer` or similar - **verify function name in current docs**) to automatically mount standard API endpoints (`/threads`, `/threads/{id}/state`, etc.) at the Express app's root (`/`).
    - **Configuration:** Pass the compiled graph instance(s) (registered with appropriate IDs like `proposal-agent`) and the checkpointer instance to the server utility.
    - **Rationale:** Ensures compliance, maintainability, and leverages standard patterns.

2.  **Remove/Adapt Custom `/rfp` Routes:**

    - **Action:** Review handlers in `apps/backend/api/rfp/`.
    - **Method:** Remove handlers whose functionality is now covered by the standard LangGraph server (e.g., basic thread management, state, streaming). Adapt any unique logic (like custom `/rfp/start` behavior or `/rfp/feedback`) to either integrate into the standard flow (e.g., as input to `POST /threads`, custom tools) or maintain them as separate custom endpoints _if absolutely necessary_.
    - **Rationale:** Avoids redundancy and simplifies the API.

3.  **Verify Environment Variables:**

    - **Action:** Ensure `NEXT_PUBLIC_API_URL` in `apps/web` (used by the passthrough) points to the backend _root_ (e.g., `http://localhost:3001`), not a subpath.
    - **Rationale:** Correct configuration for the passthrough and SDK.

4.  **Testing:**
    - **Action:** Test frontend (`apps/web`) against the refactored backend. Verify thread creation, streaming, state updates, HITL, and any remaining custom logic.
    - **Rationale:** Ensure end-to-end functionality.

## Recommendation

**Proceed with the refactor.** Aligning with the standard LangGraph API is the most robust and maintainable solution for compatibility with the SDK and future updates.

## Alternatives (Not Recommended)

- **Configuring Passthrough Prefix:** Setting `NEXT_PUBLIC_API_URL`'s _path_ to include `/rfp` for the passthrough.
  - **Downsides:** Still requires backend implementation of standard endpoints under `/rfp`, potentially brittle if SDK expects root paths for some operations (like `/info`), deviates from standard practice.
