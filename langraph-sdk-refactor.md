# Refactoring Backend API for LangGraph SDK Compatibility

## Goal

Modify the `apps/backend` API to align with the standard endpoints expected by the `@langchain/langgraph-sdk` (used in `apps/web`) and the `langgraph-nextjs-api-passthrough`. This involves moving away from the custom `/rfp` route prefix and adopting the standard LangGraph server pattern.

## Analysis Summary

1.  **Frontend Expectation:** `useStream` hook expects standard endpoints (`/info`, `/threads`, `/threads/{id}/state`, etc.) relative to its `apiUrl`.
2.  **API Passthrough:** The Next.js passthrough route proxies `/api/langgraph/*` to `LANGGRAPH_API_URL`, assuming standard endpoints at the backend's root.
3.  **Current Backend:** Serves relevant logic under `/rfp`, which is incompatible with SDK/passthrough expectations.

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

    - **Action:** Ensure `LANGGRAPH_API_URL` in `apps/web/.env` points to the backend _root_ (e.g., `http://localhost:8000`), not `/rfp`.
    - **Rationale:** Correct configuration for the passthrough.

4.  **Testing:**
    - **Action:** Test frontend (`apps/web`) against the refactored backend. Verify thread creation, streaming, state updates, HITL, and any remaining custom logic.
    - **Rationale:** Ensure end-to-end functionality.

## Recommendation

**Proceed with the refactor.** Aligning with the standard LangGraph API is the most robust and maintainable solution for compatibility with the SDK and future updates.

## Alternatives (Not Recommended)

- **Configuring Passthrough Prefix:** Setting `LANGGRAPH_API_URL` to include `/rfp` for the passthrough.
  - **Downsides:** Still requires backend implementation of standard endpoints under `/rfp`, potentially brittle if SDK expects root paths for some operations (like `/info`), deviates from standard practice.
