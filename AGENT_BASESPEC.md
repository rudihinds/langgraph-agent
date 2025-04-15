# Agent System Base Specification (AGENT_BASESPEC.md)

## 1. Introduction

This document outlines the finalized, foundational architectural decisions for the AI Proposal Assistant backend. It is derived from `AGENT_ARCHITECTURE.md` and serves as the primary source of truth regarding the chosen system design, component responsibilities, and core workflow patterns. Its purpose is to ensure consistency and provide clear specifications for implementation, preventing rework and ambiguity. All justifications are based on LangGraph.js best practices and the specific requirements of this project (persistence, HITL, flexible non-sequential editing, evaluation).

## 2. Core Architectural Pattern

*   **Decision:** The system will employ a **Hybrid Orchestrated Pattern** consisting of a central **Coded Orchestrator Service** managing interactions between a primary **LangGraph `ProposalGenerationGraph`**, a separate **Coded `EditorAgent` Service**, and a **Persistent Checkpointer**.
*   **Justification:** This pattern provides the necessary flexibility and control for complex requirements like non-sequential editing and dependency management.
    *   The `ProposalGenerationGraph` leverages LangGraph's strengths for stateful, sequential, interruptible workflows (generation, evaluation, HITL).
    *   The Coded Orchestrator Service provides deterministic, low-latency control over session management, external agent calls (Editor), direct state manipulation via the checkpointer (for edits and stale marking), and complex dependency logic, which is less suited for pure LLM/agent control.
    *   The separate `EditorAgent` Service encapsulates revision logic cleanly, preventing the main generation graph from becoming overly complex with editing pathways.

## 3. Component Decisions & Justifications

*   **Orchestrator Service:**
    *   **Decision:** Implemented as a **Coded TypeScript/Node.js Service**.
    *   **Justification:** Required for deterministic control flow, reliable state manipulation via the checkpointer API, direct access to configuration (like the dependency map), lower latency orchestration decisions, and easier debugging compared to an LLM-based orchestrator for these specific tasks.
*   **API Layer:**
    *   **Decision:** Implemented using **Express.js**.
    *   **Justification:** Standard Node.js framework, aligns with common backend practices, suitable for handling HTTP requests and routing to the Orchestrator Service.
*   **Persistent Checkpointer:**
    *   **Decision:** Utilizes **`@langgraph/checkpoint-postgres`** (or an equivalent Supabase-compatible adapter) connected to a Postgres database (e.g., Supabase DB).
    *   **Justification:** Essential for state persistence, enabling pause/resume across sessions, HITL workflows, and state recovery. Postgres provides a robust, scalable storage solution compatible with available LangGraph checkpointer implementations.
*   **Primary Workflow Graph:**
    *   **Decision:** A single, primary **`ProposalGenerationGraph`** (LangGraph `StateGraph`) managing the `OverallProposalState`.
    *   **Justification:** Handles the core sequential logic of generation and evaluation effectively. LangGraph's state management and automatic checkpointing are ideal for this complex, multi-step process.
*   **Editing Component:**
    *   **Decision:** A separate **Coded `EditorAgent` Service** invoked by the Orchestrator. (May be specialized per content type, e.g., `ResearchEditorService`, `SectionEditorService`).
    *   **Justification:** Decouples complex editing logic from the generation flow. Allows the Orchestrator to manage the edit lifecycle explicitly (invoke editor, update state, manage dependencies) which is crucial for non-sequential edits.
*   **Graph Computational Units:**
    *   **Decision:** Utilize **Nodes** for distinct, relatively atomic steps (loading, evaluation, specific generation tasks). **Subgraphs** will only be used if a specific node's internal logic becomes highly complex (multiple steps, internal loops, distinct state needs), with the default being Nodes.
    *   **Justification:** Keeps the main graph structure cleaner. Nodes are sufficient for invoking chains, functions, or agents. Subgraphs add unnecessary overhead unless encapsulating significant internal complexity.
*   **State Management:**
    *   **Decision:** A single, comprehensive **`OverallProposalState`** interface (defined in `/state/proposal.state.ts`) serves as the schema for the checkpointer.
    *   **Justification:** Provides a single source of truth for the entire proposal session, accessible by the graph, the Orchestrator, and potentially the Editor Agent (passed by Orchestrator). LangGraph's state management relies on a defined schema.
*   **Dependency Management:**
    *   **Decision:** Handled explicitly by the **Coded Orchestrator Service**, using a loaded dependency map.
    *   **Justification:** Required for flexible handling of non-sequential edits. Calculating dependencies and marking sections stale based on arbitrary edits is complex conditional logic better suited to code than reactive graph edges. It allows the Orchestrator to control *when* and *how* regeneration is triggered.

## 4. Key Workflow Decisions & Justifications

*   **Linear Generation:** Managed by the `ProposalGenerationGraph` using conditional edges based on state statuses (`approved`, `queued`, etc.) and driven by the `sectionManagerNode` logic. Evaluation nodes follow generation nodes. HITL interrupts occur after evaluation nodes.
    *   **Justification:** Standard LangGraph pattern for sequential, stateful processes with review cycles.
*   **HITL Revision (During Linear Flow):** Orchestrator intercepts user revision feedback -> Calls `EditorAgent` -> Orchestrator updates state (content + status `awaiting_review`) -> UI re-presents for review loop continues.
    *   **Justification:** Prevents graph complexity; Orchestrator handles the "edit loop" externally before resuming standard graph flow for subsequent steps.
*   **Non-Sequential Editing:** Orchestrator handles user request -> Calls `EditorAgent` -> Orchestrator updates state (content + status `approved`/`edited`) -> Orchestrator checks Dependency Map -> Orchestrator marks dependents `stale` -> UI presents options for stale sections.
    *   **Justification:** Provides maximum flexibility and user control, centralizes complex dependency logic in the coded Orchestrator.
*   **Handling Stale Sections:** User chooses "Keep Approved Version" (Orchestrator updates status) or "Regenerate with Guidance" (Orchestrator updates status to `pending`, adds guidance to state messages, resumes graph). Section Generator Nodes must check `state.messages` for guidance.
    *   **Justification:** Balances user control, efficiency (avoids blind regeneration), and implementation feasibility by reusing the message state for guidance.
*   **Pause / Resume:** Enabled intrinsically by the use of a Persistent Checkpointer and `thread_id` tracking by the Orchestrator. When a session is revisited, the Orchestrator loads the last state and can resume graph execution if applicable.
    *   **Justification:** Core feature of LangGraph persistence.

## 5. Specific Implementation Requirements (Answers to Critical Specs)

*   **State Annotations/Reducers:**
    *   **Requirement:** MUST BE DEFINED for `OverallProposalState` in `/state/proposal.state.ts` using `Annotation.Root`.
    *   **Decision:** Use `messagesStateReducer` for the `messages` field. Custom reducers (likely simple replacement or targeted merge) MUST BE IMPLEMENTED for all other fields updated by graph nodes (e.g., `researchResults`, `sections`, statuses, evaluations). Default 'replace' reducer might be sufficient for many fields but complex objects like `sections` likely need a merging strategy.
*   **Checkpointer Configuration:**
    *   **Decision:** Use `@langgraph/checkpoint-postgres`.
    *   **Requirement:** The standard DB schema required by this library MUST BE created in the target Postgres (Supabase) database. Connection details MUST BE provided via configuration.
*   **Orchestrator Logic:**
    *   **Requirement:** Logic for `sectionManagerNode` (or equivalent function called by it/Orchestrator) determining initial `requiredSections` and sequencing of `queued` sections MUST BE IMPLEMENTED.
    *   **Decision:** The **Dependency Map** will be loaded from a static JSON file: `config/dependencies.json`. Orchestrator MUST load and parse this file.
    *   **Requirement:** A detailed error handling strategy (retry policies, error reporting, state updates on failure) MUST BE IMPLEMENTED within the Orchestrator.
*   **Graph Definition:**
    *   **Requirement:** All **conditional edge functions** (routing logic based on state) MUST BE IMPLEMENTED.
    *   **Decision:** **HITL Interrupts** will occur after *every* evaluation node (`evaluateResearchNode`, `evaluateSolutionNode`, `evaluateConnectionsNode`, and each `evaluate<Section>Node`). The `interruptAfter` list in `graph.compile()` must reflect this.
*   **Node/Agent Contracts:**
    *   **Requirement:** **Prompts** for every LLM-based node MUST BE DEFINED (likely in `/prompts` directory, organized by agent/node).
    *   **Decision:** **Output Schemas** for structured outputs (Research, Solution, Evaluation, Budget, etc.) will use **Zod schemas** for validation and type safety. These schemas MUST BE DEFINED alongside node implementations.
    *   **Requirement:** Specific **Tools** required by nodes (e.g., web search for research) MUST BE DEFINED and provided during agent/node initialization.
*   **Evaluation Framework:**
    *   **Decision:** **Evaluation criteria** will be loaded from configuration files (e.g., `config/evaluation/research.json`, `config/evaluation/problem_statement.json`). Format TBD (e.g., list of criteria names/descriptions). Evaluation nodes MUST load the relevant criteria.
    *   **Requirement:** Logic for calculating `EvaluationResult.passed` (e.g., based on scores, critical failures) MUST BE IMPLEMENTED within evaluation nodes.
*   **API Specification:**
    *   **Requirement:** An API specification (e.g., OpenAPI/Swagger) defining all endpoints, request/response bodies, and authentication MUST BE CREATED.
*   **Configuration:**
    *   **Decision:** Use `.env` files for secrets (API keys, DB connection strings). Use static config files (e.g., JSON/YAML in `/config`) for non-secrets (model names, timeouts, dependency map path, evaluation criteria paths). A config loading service/module is recommended.
*   **Initialization:**
    *   **Requirement:** Default values for initializing a new `OverallProposalState` MUST BE DEFINED (e.g., empty arrays, `not_started`/`queued` statuses, current timestamp).

## 6. Conclusion

This Base Specification document provides the definitive architectural decisions and justifications for the AI Proposal Assistant backend. Adherence to these specifications during implementation is crucial for maintaining consistency, achieving project goals, and minimizing rework. It explicitly addresses core requirements and defines the necessary inputs and decisions required for successful development.
