# LangGraph 0.2.63 Checkpointer – Expectations vs. Our Implementation

---

## Section 1 — How LangGraph 0.2.63 Checkpointing _Should_ Work

### 1.1 Lifecycle & Contract

| Phase                              | What LangGraph Does                                                                                                                        | Expectation for the `checkpointer`                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Graph `compile({ checkpointer })`  | • Stores a **reference** to the object.<br>• Validates it implements **`BaseCheckpointSaver`** from **`@langchain/langgraph-checkpoint`**. | The object **must extend** `BaseCheckpointSaver` **or** fully satisfy its TS interface **including**:<br> `put`, `putWrites`, `getTuple`, `get`, `list`, `getNextVersion`, and a `serde` property. |
| Super-step execution               | After every reducer sweep, LangGraph<br>`await checkpointer.put(updatedConfig, checkpoint, metadata, versions)`                            | `put` _must_ persist and **return _RunnableConfig_** (usually with `checkpoint_id`).                                                                                                               |
| Interrupted nodes / pending writes | When some nodes fail LangGraph calls<br>`checkpointer.putWrites(...)`                                                                      | Implementation should **store** pending writes or **noop** but **MUST NOT throw**.                                                                                                                 |
| Graph resumption / time-travel     | LangGraph retrieves prior state via<br>`checkpointer.getTuple(config)`                                                                     | Must return correct tuple **or undefined**.                                                                                                                                                        |

**Key rule:** if the `config.configurable.thread_id` is **missing** in the config passed to `invoke` / `stream`, **LangGraph silently skips checkpointing**.

### 1.2 Bundled Checkpointers

| Package                                    | Notes                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `@langchain/langgraph-checkpoint`          | Defines **`MemorySaver`** + the **base interface**.                                        |
| `@langchain/langgraph-checkpoint-sqlite`   | SQLite implementation (experimental / local dev).                                          |
| `@langchain/langgraph-checkpoint-postgres` | Production-grade **`PostgresSaver`** (works with Supabase because Supabase _is_ Postgres). |

### 1.3 Canonical Postgres Schema (used by `PostgresSaver`)

```sql
CREATE TABLE IF NOT EXISTS checkpoints (
  thread_id   TEXT NOT NULL,
  checkpoint  BYTEA NOT NULL,         -- serialized Checkpoint object
  thread_ts   TIMESTAMPTZ NOT NULL,   -- PK part 1
  parent_ts   TIMESTAMPTZ,            -- FK to previous checkpoint
  PRIMARY KEY (thread_id, thread_ts)
);
```

### 1.4 Minimum Runtime Config

```ts
const config = {
  configurable: {
    thread_id: "<unique-string>"  // **required**
    // Optional for replay / forks:
    checkpoint_id: "<uuid>"
  }
};
```

If `thread_id` is absent → **no calls** to `checkpointer.put` or `putWrites`.

### 1.5 Supabase Persistence Pattern

Because Supabase ≈ Postgres, the **simplest** production path is to **use `PostgresSaver` directly** with the Supabase connection string. No custom adapter is technically required:

```ts
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
const checkpointer = new PostgresSaver({
  connectionString: process.env.SUPABASE_DB_URL,
});
```

A custom implementation is only needed when you want **row-level security** or a different table shape; in that case the full interface **must be honoured**.

---

## Section 2 — Our Current Setup (Code Review)

### 2.1 Factory & Adapters

- **`createCheckpointer()`** (apps/backend/lib/persistence/checkpointer-factory.ts)
  - Picks **Supabase** vs **In-Memory**.
  - Returns:
    - `new LangGraphCheckpointer( SupabaseCheckpointer )`, **or**
    - `new MemoryLangGraphCheckpointer( InMemoryCheckpointer )`.

### 2.2 `LangGraphCheckpointer` (Wrapper)

- **Extends `BaseCheckpointSaver`** ✓
- Implements **`put`, `getTuple`, `get`, `list`**.
- **`putWrites`** – _stub_ (logs "not implemented").
- **`getNextVersion`** – commented out (returns undefined).
- **`serde` property is _missing_** (super() is called **without** a serializer) → internal runtime may fallback to default but **type check** expects it.

### 2.3 `MemoryLangGraphCheckpointer`

- **Does _not_ extend `BaseCheckpointSaver`** (TS error in linter).
- Only implements `get`, `put`, `list`, `delete` — no `putWrites`, `getTuple`, `serde`.

### 2.4 `SupabaseCheckpointer`

- Low-level helper that upserts into **`proposal_checkpoints`** _(custom schema)_ with columns:
  - `thread_id`, `user_id`, `proposal_id`, `checkpoint`, `updated_at`, …
- Signature: `put(threadId, checkpoint)` – **_not_** the interface LangGraph will call directly.

### 2.5 Graph Compilation

- `createProposalGenerationGraph()` passes the factory result to **`graph.compile({ checkpointer })`** ✅
- Server uses `graph.stream(input, config)` but **`config` construction is not shown** in the provided snippet — needs verification that `thread_id` is included.

---

## Section 3 — Alignment Analysis

| Criterion                                         | LangGraph Expectation                     | Our Implementation                          | Implication                                                                                                         |
| ------------------------------------------------- | ----------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `thread_id` present in every invoke               | **Required**                              | **Unverified** (API handler may not supply) | If missing → LangGraph silently **skips checkpointing** – matches the "put never called" symptom.                   |
| Checkpointer is instance of `BaseCheckpointSaver` | **Yes**                                   | Supabase path ✓, **Memory path ✗**          | In dev (memory) flow the object fails `instanceof` check; LG replaces it with internal fallback (no-op) ➜ no `put`. |
| `serde` property provided                         | **Must exist**                            | **Missing** in `LangGraphCheckpointer`      | Could cause runtime issues; LG may treat saver as legacy v1 and ignore writes.                                      |
| `putWrites` implemented                           | Called on partial-step errors             | Stub/no-op                                  | OK if no errors, but violating interface may cause internal guard to mark saver "unsupported → disabled".           |
| Database schema                                   | Must mirror PostgresSaver or custom logic | We use custom `proposal_checkpoints` table  | OK _if_ adapter handles it, but makes migrating to PostgresSaver harder.                                            |

**Conclusion:** _Two independent paths can explain the zero-write behaviour_

1. **Config Path:** handler doesn't pass `thread_id` ⇒ LangGraph disables persistence.
2. **Adapter Path:** provided saver fails internal capability checks (missing `serde`, `putWrites`, inheritance) ⇒ LG falls back to in-memory 'noop' saver.

---

## Section 4 — High-Priority Next Steps

### 1️⃣ Isolate & Validate with **Official** Saver

1. **Install & import**
   ```bash
   npm i @langchain/langgraph-checkpoint-postgres
   ```
2. **Hard-wire** a test graph:
   ```ts
   import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
   const checkpointer = new PostgresSaver({ connectionString: process.env.SUPABASE_DB_URL });
   const graph = workflow.compile({ checkpointer });
   await graph.invoke({ ... }, { configurable: { thread_id: "debug-1" } });
   ```
3. **Expectation:** rows appear in Supabase `checkpoints` table.  
   If this works → our custom adapter is the culprit. If **still** silent → the issue is **missing `thread_id`** or execution never reaches a second super-step.

### 2️⃣ Audit `thread_id` Propagation End-to-End

- Add a **temporary console log** at the top of `LangGraphCheckpointer.put` **and** in the **API handler** right before `graph.stream(...)`:
  ```ts
  console.log("CONFIG RECEIVED", JSON.stringify(config));
  ```
- Hit the endpoint, confirm structure: `{ configurable: { thread_id: "xyz" } }`.
  - If absent → fix the server layer to generate a deterministic thread id per conversation.

These two focused experiments will immediately tell us **which layer is breaking persistence** so we can iterate on either (a) repairing the adapter to fully comply with `BaseCheckpointSaver`, or (b) ensuring correct config flow.
