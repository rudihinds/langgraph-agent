# Refactoring Plan: Standardize Checkpointer Interfaces

## 1. Goal

Standardize the checkpointer adapter interfaces used in the backend (`LangGraphCheckpointer`, `MemoryLangGraphCheckpointer`) to strictly align with the `BaseCheckpointSaver` interface defined in `@langchain/langgraph` and `@langchain/langgraph-checkpoint`. This will resolve persistent type errors, improve code clarity, and ensure compatibility with LangGraph library expectations.

## 2. Problem Statement

Persistent TypeScript linter errors occur in `apps/backend/api/langgraph/index.ts` when calling `.put()` and `.get()` methods on the `checkpointerInstance`. Investigation revealed that the custom adapter `LangGraphCheckpointer` (defined in `apps/backend/lib/persistence/langgraph-adapter.ts`) implements `BaseCheckpointSaver` but uses non-standard method signatures (`put(threadId, checkpoint)` and `get(threadId)`) that conflict with the interface (`put(config, ...)` and `get(config)`).

Additionally, the necessary `ChannelVersions` type for the standard `.put()` signature was not correctly imported.

## 3. Investigation Summary

- **Checkpointer Creation (`createCheckpointer`):** Confirmed that this service function returns either `MemoryLangGraphCheckpointer` or `LangGraphCheckpointer`, both typed as `BaseCheckpointSaver`.
- **Custom Adapters:**
  - `LangGraphCheckpointer` (`langgraph-adapter.ts`): Wraps `SupabaseCheckpointer`. **Crucially, its implemented `.put()` and `.get()` methods use `threadId: string` directly, deviating from the `BaseCheckpointSaver` interface which expects a `config: RunnableConfig` object.**
  - `MemoryLangGraphCheckpointer` (`memory-adapter.ts`): Wraps `InMemoryCheckpointer` and extends `BaseCheckpointSaver`. It is expected to implement the standard interface correctly, but verification is needed.
  - The underlying `SupabaseCheckpointer` and `InMemoryCheckpointer` use simple, non-standard `put(threadId, ...)` and `get(threadId)` signatures.
- **Standard Interface (`BaseCheckpointSaver`):** Research confirmed the standard signatures:
  - `put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, newVersions: ChannelVersions): Promise<RunnableConfig>`
  - `get(config: RunnableConfig): Promise<CheckpointSaved | null>`
- **Type Issue:** The `ChannelVersions` type, required for the standard `put` method, was missing or incorrectly imported.

## 4. Proposed Refactoring Steps

**Step 1: Correct `ChannelVersions` Import**

- **Action:** Locate the correct export path for the `ChannelVersions` type (likely `@langchain/langgraph/checkpoint`) and update the import statement in `apps/backend/api/langgraph/index.ts`.

**Step 2: Standardize `LangGraphCheckpointer` Adapter (`apps/backend/lib/persistence/langgraph-adapter.ts`)**

- **Action:** Modify the method signatures and implementations to match `BaseCheckpointSaver` precisely.
  - **Modify `.put()**:
    - Change signature to: `async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata, newVersions: ChannelVersions): Promise<RunnableConfig>`
    - Inside the method: Extract `threadId` from `config.configurable.thread_id`.
    - Call the underlying `this.checkpointer.put(threadId, checkpoint)` (ignoring `metadata` and `newVersions` for this specific underlying call as it doesn't support them).
    - Return the input `config` object as required by the standard signature.
  - **Modify `.get()**:
    - Change signature to: `async get(config: RunnableConfig): Promise<CheckpointSaved | null>`
    - Inside the method: Extract `threadId` from `config.configurable.thread_id`.
    - Call the underlying `this.checkpointer.get(threadId)`.
    - Return the result. Ensure the return type matches `CheckpointSaved | null` (casting or transformation might be needed if the underlying method returns a different shape).

**Step 3: Verify/Standardize `MemoryLangGraphCheckpointer` Adapter (`apps/backend/lib/persistence/memory-adapter.ts`)**

- **Action:** Read the full file content.
  - Confirm its `.put()` method signature matches `(config, checkpoint, metadata, newVersions)`. Correct if necessary.
  - Confirm its `.get()` method signature matches `(config)`. Correct if necessary.
  - Ensure it correctly calls the underlying `InMemoryCheckpointer` methods while adhering to the standard interface.

**Step 4: Update API Route Handler (`apps/backend/api/langgraph/index.ts`)**

- **Action:** Modify the checkpointer calls within the route handlers (`/threads` POST and `/threads/:thread_id/state` GET) to use the now-standardized signatures for _both_ `checkpointerInstance` types.
  - **Update `.put()` call:** Use the standard 4-argument signature: `await checkpointerInstance.put(config, initialCheckpoint, initialMetadata, initialChannelVersions);`
  - **Update `.get()` call:** Use the standard 1-argument signature: `const checkpointResult = await checkpointerInstance.get(config);`
  - **Handle `.get()` Return:** Adjust the response logic. The `.get()` method returns `CheckpointSaved | null`. The API should likely return just the `checkpoint` part of this result (e.g., `res.json(checkpointResult)` if the result _is_ the checkpoint, or `res.json(checkpointResult.checkpoint)` if it's a tuple/object containing the checkpoint - _needs verification based on final `.get()` implementation_).

## 5. Expected Outcome

- Elimination of TypeScript linter errors related to checkpointer method signatures in `api/langgraph/index.ts`.
- Consistent usage of checkpointer methods according to the standard `BaseCheckpointSaver` interface.
- Improved maintainability and alignment with LangGraph library conventions.
- Correct functionality for creating and retrieving thread checkpoints.

## 6. Next Steps

1. Review and approve this plan.
2. Execute Step 1 (Correct Import).
3. Execute Step 2 (Standardize `LangGraphCheckpointer`).
4. Execute Step 3 (Verify/Standardize `MemoryLangGraphCheckpointer` - requires reading the file).
5. Execute Step 4 (Update API Route Handler).
6. Test the `/api/langgraph/threads` endpoint creation and `/api/langgraph/threads/:thread_id/state` retrieval.
