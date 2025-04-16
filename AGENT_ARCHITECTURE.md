# Agent System Architecture

## 1. Overview

This document outlines the architecture for the multi-agent backend system designed to assist users in analyzing Request for Proposals (RFPs) and generating tailored proposal content. The system leverages LangGraph.js for managing stateful workflows, incorporates Human-in-the-Loop (HITL) checkpoints for user review and refinement, and includes automated evaluation steps for quality assurance. Key requirements include seamless pause/resume capabilities, the ability for users to perform non-sequential edits on generated sections, and intelligent, user-guided handling of dependencies following edits.

## 2. Core Principles

- **Stateful & Persistent:** Enables seamless **pause and resume**. State saved via persistent checkpointer.
- **Interruptible (HITL):** Mandatory user review pauses after evaluations.
- **Evaluated:** Automated quality checks before user review.
- **Flexible Editing:** Non-sequential edits via Orchestrator & Editor Agent.
- **Dependency Aware:** Orchestrator tracks dependencies, offers **guided regeneration**.
- **Orchestrated:** A central **Coded Service** manages workflow, state, feedback, agent calls.
- **Modular:** Distinct components with clear responsibilities.

## 3. Architectural Components

1.  **User Interface (UI):** (External) Frontend application.
2.  **API Layer (Express.js):** Handles HTTP, auth, validation, forwards to Orchestrator.
3.  **Orchestrator Service (Coded TypeScript/Node.js Service):** Central control unit. Manages sessions (`thread_id`), Checkpointer interactions, graph invocation/resumption, EditorAgent calls, dependency logic, user feedback handling.
4.  **Persistent Checkpointer (`BaseCheckpointSaver`):** Using **`@langgraph/checkpoint-postgres`** (or equivalent Supabase adapter). Stores/retrieves `OverallProposalState` snapshots by `thread_id`.
5.  **`ProposalGenerationGraph` (LangGraph `StateGraph`):** Primary stateful workflow for sequential generation, evaluation, analysis. Contains Nodes listed below. State saved automatically via checkpointer.
6.  **`EditorAgent` (Coded Service):** Invoked by Orchestrator for revisions. Takes section ID, current content, feedback, context. Returns revised content to Orchestrator. (Can be specialized, e.g., `ResearchEditorService`, `SectionEditorService`).
7.  **Specialized Nodes (within `ProposalGenerationGraph`):** Functions or LangChain Runnables. Examples: `documentLoaderNode`, `deepResearchNode`, `evaluateResearchNode`, `solutionSoughtNode`, `evaluateSolutionNode`, `connectionPairsNode`, `evaluateConnectionsNode`, `sectionManagerNode`, **Section Generator Nodes** (`generateProblemStatementNode`, etc.), **Section Evaluator Nodes** (`evaluateProblemStatementNode`, etc.). Generator nodes must handle regeneration guidance from state.

## 4. Logical Flow

_(Flow description remains largely the same as the previous version, focusing on the Orchestrator driving edits and resuming the graph for regeneration)._

### A. Initial Linear Generation Workflow

_(Start -> Load -> Research -> Eval -> Interrupt -> [Approval -> Resume] -> Solution -> Eval -> Interrupt -> [Approval -> Resume] -> ... -> Section Gen -> Section Eval -> Interrupt -> [Approval -> Resume] -> ... -> END)_

### B. HITL Revision (During Linear Flow)

_(Interrupt -> User Revision Feedback -> Orchestrator calls EditorAgent -> Editor returns revised content -> Orchestrator updates state (content replaced, status `awaiting_review`) -> Loop back to user review step)._

### C. Non-Sequential ("Jump-In") Editing (with Guided Regeneration Option)

_(User Edit Request -> Orchestrator calls EditorAgent -> Editor returns revised content -> Orchestrator updates state (content, status `edited`/`approved`), checks deps, marks dependents `stale` -> UI shows stale sections -> User interacts with stale section -> UI offers "Keep" or "Regenerate w/ Guidance" -> Orchestrator updates status based on choice, adds guidance to messages if needed, resumes graph for regeneration if chosen -> Graph routes to generator node which uses guidance -> Eval Node -> Interrupt for review)_

## 5. Foundational Requirements

### 5.1. State Management (`OverallProposalState`)

Single source of truth, persisted via Checkpointer.

```typescript
// Located in: /state/proposal.state.ts (Example path)
import { BaseMessage } from "@langchain/core/messages";

// Refined Status definitions
type LoadingStatus = 'not_started' | 'loading' | 'loaded' | 'error';
// 'queued': Ready to run, waiting for turn/dependency.
// 'stale': Dependency updated, needs attention (Keep or Regenerate).
type ProcessingStatus = 'queued' | 'running' | 'awaiting_review' | 'approved' | 'edited' | 'stale' | 'complete' | 'error';
type SectionProcessingStatus = 'queued' | 'generating' | 'awaiting_review' | 'approved' | 'edited' | 'stale' | 'error';

interface EvaluationResult { /* ... as before ... */ }
interface SectionData { /* ... as before (status uses SectionProcessingStatus) ... */ }

export interface OverallProposalState {
  rfpDocument: { id: string; fileName?: string; text?: string; metadata?: Record<string, any>; status: LoadingStatus; };
  researchResults?: Record<string, any>; researchStatus: ProcessingStatus; researchEvaluation?: EvaluationResult | null;
  solutionSoughtResults?: Record<string, any>; solutionSoughtStatus: ProcessingStatus; solutionSoughtEvaluation?: EvaluationResult | null;
  connectionPairs?: any[]; connectionPairsStatus: ProcessingStatus; connectionPairsEvaluation?: EvaluationResult | null;
  sections: { [sectionId: string]: SectionData | undefined; }; // Use specific IDs: problem_statement, etc.
  requiredSections: string[];
  currentStep: string | null;
  activeThreadId: string;
  // messages now holds user inputs, AI outputs, tool calls, HITL feedback, AND regeneration guidance
  messages: BaseMessage[];
  errors: string[];
  projectName?: string; userId?: string; createdAt: string; lastUpdatedAt: string;
}

// LangGraph State Annotation Definition (Required Implementation Detail)
// import { Annotation } from "@langchain/langgraph";
// import { messagesStateReducer } from "@langchain/langgraph";
// Need to define precise annotations and reducers for *all* fields.
export const ProposalStateAnnotation = Annotation.Root<OverallProposalState>({
//   messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),
//   rfpDocument: ...,
  sections: ..., // Needs a custom reducer for merging section data
  // ... etc for all fields
});

// **Note:** The precise definition and usage of Annotations and Reducers MUST follow the latest LangGraph.js documentation.
```

### 5.2. Persistence (Checkpointer)

- **Implementation:** Specific library (e.g., `@langgraph/checkpoint-postgres`), schema definition for checkpoint tables, connection configuration.
- **Role:** Enables persistence, pause/resume.
- **Usage:** Automatic by LangGraph; Direct by Orchestrator.
- **Note:** Checkpointer implementation and usage MUST adhere to current LangGraph.js standards and documentation.

### 5.3. Dependency Management

- **Location:** Coded **Orchestrator Service**.
- **Mechanism:** Uses dependency map (see previous example). **Source required:** (e.g., Load from `config/dependencies.json`).
- **Functionality:** On edit of `X`, finds dependents `Y`, updates `Y.status` to `stale`.
- **Triggering:** Orchestrator guides regeneration based on user choice ("Keep" vs. "Regenerate with Guidance").
- **Note:** All LangGraph-specific implementations (State Annotations, Checkpointer, Graph Definition, Nodes, Conditional Logic) MUST be validated against current LangGraph.js documentation.

## 6. Required Implementation Details (Critical Missing Specs)

- **State Annotations/Reducers:** Precise definitions for merging updates to `OverallProposalState` fields within LangGraph.
- **Checkpointer Config:** DB Schema, connection details, library choice for the `BaseCheckpointSaver`.
- **Orchestrator Logic:**
  - Algorithm for determining initial `requiredSections`.
  - Algorithm for selecting the next `queued` section to run based on dependencies and `requiredSections`.
  - Source and loading mechanism for the **Dependency Map**.
  - Detailed error handling strategy (e.g., retry logic, reporting to user).
- **Graph Definition:**
  - Implementation of all **conditional edge functions** (e.g., `routeAfterEvaluation`, `determineNextStep`).
  - Specific `interruptAfter` node list configuration.
- **Node/Agent Contracts:**
  - **Prompts:** Exact prompts for all LLM-based nodes (generators, evaluators, research, solution, editor).
  - **Output Schemas:** Zod/TypeScript schemas for structured JSON outputs (Research, Solution, Evaluation, Budget).
  - **Tool Definitions:** Specific tools needed by each node/agent and their schemas.
- **Evaluation Framework:**
  - Source and format of **evaluation criteria** per step/section.
  - Logic for calculating `EvaluationResult.passed`.
- **API Specification:** Endpoint definitions (routes, methods, request bodies, response formats) for UI interaction.
- **Configuration:** Strategy for managing secrets (API keys), model names, DB connection, timeouts, dependency map location, etc. (e.g., `.env`, config files).
- **Initialization:** Default values for a new `OverallProposalState`.

## 7. Future Considerations

_(Same as previous version: Editor specialization, Dep Map maintenance, Eval Criteria source, Intelligent Tweak, Concurrency, Error Handling, Time-Travel, Monitoring)_
