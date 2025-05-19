# System Patterns & Architecture

This document outlines the key architectural patterns, decisions, and structures within our LangGraph agent implementation.

## Core Agent Architecture

The proposal agent system follows a structured workflow using LangGraph's `StateGraph` paradigm. Nodes within the graph represent discrete steps in the proposal generation process, with state flowing between them.

### LangGraph Integration

- We use `StateGraph<OverallProposalState>` as our core state management structure.
- Standard LangGraph patterns are followed for node registration, edge definition, and compilation.
- The graph is persisted using a custom checkpointer implementation for Supabase.

### State Management

State is defined through a comprehensive `OverallProposalState` interface with the following key components:

- `messages`: Array of conversation messages
- `sections`: Map of proposal sections with statuses and content
- `userId`: User identification for multi-tenant isolation
- `title`: Proposal title
- `status`: Overall generation status
- `dependencies`: Section dependency mapping
- `evaluations`: Section evaluation results
- `errors`: Error tracking
- `timestamps`: Various time markers for operations
- `history`: State update history for debugging

Custom reducers handle immutable state updates, particularly for complex nested structures like the `sections` map.

### Human-in-the-Loop (HITL) Integration

The system incorporates HITL at key decision points:

- Section approval/revision after initial generation
- Overall proposal approval before final compilation
- Error resolution when automated handling fails

HITL integration is implemented through special conditional edges that route execution based on user feedback.

## Persistence: Official `PostgresSaver` with Robust Factory

We now utilize the official `@langchain/langgraph-checkpoint-postgres` package's `PostgresSaver` for persistent checkpointing to our Supabase PostgreSQL database. This replaces the previous custom adapter pattern.

### Key Implementation Details:

- **Factory Function (`getInitializedCheckpointer`)**: Located in `apps/backend/lib/persistence/robust-checkpointer.ts`, this function:
  - Attempts to create and configure a `PostgresSaver` instance using environment variables (`DATABASE_URL`, etc.).
  - **Critically, it calls `await pgSaver.setup()` (after `const pgSaver = new PostgresSaver(pgPoolInstance);`) to ensure the necessary `langgraph.checkpoints` table (or similarly named by the library) and schema exist in the database.** This method handles DB migrations automatically.
  - If `PostgresSaver` setup fails (e.g., missing env vars, connection error), it falls back to using LangGraph's `MemorySaver` for resilience during development or in environments without a DB connection.
  - Returns a `BaseCheckpointSaver` compatible instance (either `PostgresSaver` or `MemorySaver`).
- **Thread ID Management**: Thread isolation is achieved by passing a uniquely constructed `thread_id` (typically `user-[userId]::rfp-[rfpId]::proposal`) within the `RunnableConfig` during graph invocations (`invoke`, `updateState`, `getState`). The checkpointer instance itself is thread-agnostic.
- **`OrchestratorService`**: This service is responsible for constructing the `thread_id` and managing all interactions with the checkpointer instance obtained from `getInitializedCheckpointer`.
- **Removed Components**: Custom `SupabaseCheckpointer`, `LangGraphCheckpointer`, `MemoryLangGraphCheckpointer`, and `checkpointer-factory.ts` have been removed.

### Key Advantages:

1.  **Alignment with LangGraph**: Uses the official, maintained persistence mechanism.
2.  **Reduced Maintenance**: Eliminates the need to keep custom adapters synchronized with `BaseCheckpointSaver` updates.
3.  **Simplified Configuration**: Relies on standard environment variables for `PostgresSaver`.
4.  **Robustness**: Falls back gracefully to `MemorySaver` if the database is unavailable.
5.  **Automatic Schema Management**: Leverages `checkpointer.setup()` for database table creation and migrations.

### Usage Example:

```typescript
// In OrchestratorService or API handler
import { getInitializedCheckpointer } from "@/lib/persistence/robust-checkpointer.js";
import { constructProposalThreadId } from "@/lib/utils/threads.js";

const checkpointer = await getInitializedCheckpointer(); // Get the singleton instance
const userId = "user-123";
const rfpId = "rfp-abc";
const threadId = constructProposalThreadId(userId, rfpId);

// Use threadId in config for graph operations
const config = { configurable: { thread_id: threadId } };

// Example: Getting state
const checkpoint = await checkpointer.get(config);

// Example: Invoking graph (graph instance obtained elsewhere)
// compiledGraph.invoke(initialState, config);
```

## API Design

The API layer serves as the interface between the frontend and the agent system:

- RESTful endpoints for initiating proposal generation, checking status, and feedback
- Authentication integration with Supabase Auth
- Webhook support for asynchronous processing updates
- Error handling with appropriate HTTP status codes and structured error responses

## OrchestrationService

The `OrchestrationService` manages the LangGraph execution lifecycle:

- Thread creation and management
- State persistence coordination
- Recovery from interruptions
- Human feedback integration
- Progress tracking and status reporting

## Error Handling Strategy

We implement multi-layered error handling:

- **Node-level** try/catch with error state updates
- **Graph-level** error edges for recoverable errors
- **Service-level** error handling in the `OrchestrationService`
- **API-level** error responses with appropriate status codes
- **Logging** for operational visibility

## Dependency Management

Section generation follows a DAG (Directed Acyclic Graph) of dependencies:

- Executive Summary depends on Solution Approach
- Implementation Plan depends on Solution Approach
- Budget depends on Implementation Plan
- Timeline depends on Implementation Plan

Dependencies ensure that sections are generated in an order that maintains logical consistency in the final proposal.

## Tools and External Integrations

The system integrates with external services:

- LLM providers for content generation
- Vector databases for context retrieval
- External research APIs
- Document generation services

## Code Organization

The codebase follows a structured organization:

- `agents/` - LangGraph definitions, nodes, and conditionals
- `services/` - Core business logic
- `api/` - Express.js routing and controllers
- `state/` - State definitions and reducers
- `lib/` - Shared utilities
- `prompts/` - LLM prompt templates
- `tools/` - Agent tool implementations
- `__tests__/` - Test files (sibling to implementation files)

## 1. High-Level Architecture

The LangGraph Proposal Agent employs a multi-component architecture centered around stateful graph-based workflows and orchestrated agent interactions:

```mermaid
graph TD
    subgraph "Frontend (Next.js)"
        UI[User Interface]
        SP[StreamProvider]
        IP[InterruptProvider]
    end

    subgraph "Backend (Node.js/Express)"
        API[API Layer - Express.js]
        OR[Orchestrator Service]
        CK[Persistent Checkpointer]
        EA[EditorAgent]
    end

    subgraph "LangGraph Agent (Separate Process/Server)"
        LG_API[LangGraph API Endpoint]
        PG[ProposalGenerationGraph]
    end

    UI <--> SP
    SP <--> IP
    SP <-->|Direct Stream| LG_API

    UI -->|HTTP API Calls| API
    API <--> OR
    API <--> CK // Via Orchestrator or direct?
    API <--> EA // Via Orchestrator

    OR <--> CK
    OR <-->|Manages| LG_API // Invokes runs, handles state outside graph flow

    LG_API --> PG

    CK <--> DB[(PostgreSQL/Supabase)]

    classDef core fill:#f9f,stroke:#333;
    classDef graph fill:#bbf,stroke:#333;
    classDef storage fill:#bfb,stroke:#333;
    classDef frontend fill:#ccf,stroke:#333;
    classDef backend fill:#ffc,stroke:#333;
    classDef langgraph fill:#cfc,stroke:#333;

    class UI,SP,IP frontend;
    class API,OR,CK,EA backend;
    class LG_API,PG langgraph;
    class DB storage;
```

### Key Components

1.  **User Interface (UI)**: Frontend Next.js application.
2.  **StreamProvider/InterruptProvider**: Frontend components managing the direct connection to the LangGraph stream endpoints (e.g., `http://localhost:2024/threads/...`).
3.  **API Layer**: Express.js REST API (`http://localhost:3001`) handling HTTP requests for application-specific logic (RFP management, user proposal associations), authentication, and calls to backend services _other than_ the direct LangGraph chat stream.
4.  **Orchestrator Service**: Core control unit managing workflow state (via Checkpointer), invoking agent runs on the LangGraph server, and coordinating non-stream actions.
5.  **Persistent Checkpointer**: State persistence layer using PostgreSQL/Supabase, initialized via `getInitializedCheckpointer` which calls `PostgresSaver.setup()`.
6.  **LangGraph API Endpoint**: The actual LangGraph server endpoint (e.g., `http://localhost:2024` currently) that handles stream requests, graph execution, and checkpointer interactions.
7.  **ProposalGenerationGraph**: LangGraph StateGraph defining the workflow, running within the LangGraph server process.
8.  **EditorAgent**: Specialized service for handling revisions and edits, called via the Express API.

## 2. Key Technical Decisions

### State Management

- **Single Source of Truth**: Define comprehensive `OverallProposalState` interface containing all workflow state.
- **Immutable Updates**: Use reducer functions for predictable state transformations.
- **Persistent Checkpointing**: Utilize `@langchain/langgraph-checkpoint-postgres` for PostgreSQL-based state persistence.
- **Status Tracking**: Define explicit status enums for tracking progress at various granularities.

### Workflow Control

- **Orchestration Pattern**: Centralize control logic in the Orchestrator rather than embedding in the graph.
- **Human-in-the-Loop**: Use LangGraph interrupts for approval checkpoints and feedback incorporation.
- **Non-Sequential Editing**: Enable targeted node execution via Orchestrator rather than always linear graph traversal.
- **Dependency Management**: Track section relationships in a dependency map for intelligent regeneration guidance.

### Agent Communication

- **Message-Based Protocol**: Use BaseMessage instances for standardized agent communication.
- **Context Preservation**: Ensure critical context is included in state and passed between components.
- **Structured Outputs**: Define Zod schemas for validating agent outputs in a type-safe manner.

### Infrastructure

- **Supabase Integration**: Leverage Supabase for authentication, database, and PostgreSQL access.
- **Service-Based Design**: Implement core business logic in services rather than directly in graph nodes.
- **File Length Limits**: Enforce 300-line maximum to maintain modularity and readability.

## 3. Core Design Patterns

### StateGraph Pattern

- Graph nodes represent discrete processing steps with well-defined inputs/outputs
- State is passed and updated through the graph rather than using side effects
- Conditional routing determines the execution path based on state evaluation
- **Note:** Implementation MUST follow current LangGraph.js documentation for defining state, nodes, and edges.

### Orchestrator Pattern

- Central service coordinates the overall flow and integrates components
- State loading/saving handled by Orchestrator via Checkpointer
- Graph invocation, interruption, and resumption managed consistently

### Human-in-the-Loop Pattern

- Interrupt graph execution at critical review points
- Capture and incorporate human feedback
- Resume execution with updated context

### Edit-with-Dependencies Pattern

- Track relationships between content sections
- Mark dependent sections as stale when predecessors change
- Provide guided regeneration based on dependency context

### Reducer Pattern

- Custom reducer functions for complex state updates
- Ensures immutable state transitions
- Handles array updates, nested objects, and section maps
- **Note:** Reducer implementation and integration with state annotations MUST align with current LangGraph.js documentation.

### Evaluation-Revision Pattern

- Generate content → Evaluate against criteria → Present for review → Revise based on feedback
- Apply consistent evaluation framework across content types
- Capture evaluation results in state for decision-making

## 4. Data Flow

### Initial Content Generation Flow

1. User submits RFP document via API
2. API routes to Orchestrator Service
3. Orchestrator initializes new state with thread_id
4. Orchestrator invokes ProposalGenerationGraph
5. Graph processes through nodes:
   - Document loading/analysis
   - Research generation
   - Solution analysis
   - Section generation
   - Evaluation
6. Each node updates state through reducer functions
7. Checkpointer persists state after each update
8. Graph interrupts at review points
9. User provides feedback via API
10. Orchestrator processes feedback and resumes graph

### Edit-Based Regeneration Flow

1. User submits edit for specific section via API
2. API routes to Orchestrator Service
3. Orchestrator retrieves current state from Checkpointer
4. Orchestrator calls EditorAgent with edit request
5. EditorAgent returns updated content
6. Orchestrator updates state with new content, marks section as "edited"
7. Orchestrator identifies dependent sections, marks them as "stale"
8. User selects approach for stale sections (keep or regenerate)
9. If regenerate, Orchestrator adds guidance to state
10. Orchestrator resumes graph, targeting specific generator node
11. Generator node creates updated content with guidance context
12. Evaluator node assesses updated content
13. Graph interrupts for review
14. Process continues until all sections are approved

## 5. Critical Implementation Paths

### State Definition and Annotation

```typescript
// Located in: /state/proposal.state.ts
import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { messagesStateReducer } from "@langchain/langgraph";

// Status types
type LoadingStatus = "not_started" | "loading" | "loaded" | "error";
type ProcessingStatus =
  | "queued"
  | "running"
  | "awaiting_review"
  | "approved"
  | "edited"
  | "stale"
  | "complete"
  | "error";
type SectionProcessingStatus =
  | "queued"
  | "generating"
  | "awaiting_review"
  | "approved"
  | "edited"
  | "stale"
  | "error";

// Core interfaces
interface EvaluationResult {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  passed: boolean;
}

interface SectionData {
  id: string;
  title: string;
  content: string;
  status: SectionProcessingStatus;
  evaluation?: EvaluationResult;
  lastUpdated: string;
}

// Main state interface
export interface OverallProposalState {
  rfpDocument: {
    id: string;
    fileName?: string;
    text?: string;
    metadata?: Record<string, any>;
    status: LoadingStatus;
  };
  researchResults?: Record<string, any>;
  researchStatus: ProcessingStatus;
  researchEvaluation?: EvaluationResult | null;
  solutionSoughtResults?: Record<string, any>;
  solutionSoughtStatus: ProcessingStatus;
  solutionSoughtEvaluation?: EvaluationResult | null;
  connectionPairs?: any[];
  connectionPairsStatus: ProcessingStatus;
  connectionPairsEvaluation?: EvaluationResult | null;
  sections: { [sectionId: string]: SectionData | undefined };
  requiredSections: string[];
  currentStep: string | null;
  activeThreadId: string;
  messages: BaseMessage[];
  errors: string[];
  projectName?: string;
  userId?: string;
  createdAt: string;
  lastUpdatedAt: string;
}

// LangGraph state annotation
export const ProposalStateAnnotation = Annotation.Root<OverallProposalState>({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),
  // Additional field annotations with reducers
});
```

### Orchestrator Implementation

```typescript
// Located in: /services/orchestrator.service.ts

export class OrchestratorService {
  private checkpointer: BaseCheckpointSaver;
  private editorAgent: EditorAgentService;
  private graph: CompiledStateGraph<typeof ProposalStateAnnotation.State>;
  private dependencyMap: Record<string, string[]>;

  constructor() {
    // Initialize components
  }

  // Initialize a new proposal session
  async initializeSession(userId: string, rfpDocument: any): Promise<string> {
    const threadId = generateThreadId();
    const initialState = this.createInitialState(userId, threadId, rfpDocument);
    await this.checkpointer.put(threadId, initialState);
    return threadId;
  }

  // Get current state for a session
  async getState(threadId: string): Promise<OverallProposalState> {
    return await this.checkpointer.get(threadId);
  }

  // Resume graph execution
  async resumeGraph(
    threadId: string,
    feedback?: any
  ): Promise<OverallProposalState> {
    const state = await this.checkpointer.get(threadId);
    const updatedState = this.incorporateFeedback(state, feedback);
    await this.checkpointer.put(threadId, updatedState);

    const result = await this.graph.invoke(updatedState);
    return result;
  }

  // Handle user edits
  async handleEdit(
    threadId: string,
    sectionId: string,
    editedContent: string
  ): Promise<OverallProposalState> {
    const state = await this.checkpointer.get(threadId);
    const updatedContent = await this.editorAgent.reviseContent(
      sectionId,
      state.sections[sectionId]?.content || "",
      editedContent,
      state
    );

    // Update state with edited content
    const updatedState = this.updateSection(state, sectionId, {
      ...state.sections[sectionId],
      content: updatedContent,
      status: "edited",
      lastUpdated: new Date().toISOString(),
    });

    // Mark dependent sections as stale
    const dependentSections = this.getDependentSections(sectionId);
    const staleState = this.markSectionsAsStale(
      updatedState,
      dependentSections
    );

    await this.checkpointer.put(threadId, staleState);
    return staleState;
  }

  // Handle user choices for stale sections
  async handleStaleChoice(
    threadId: string,
    sectionId: string,
    choice: "keep" | "regenerate"
  ): Promise<OverallProposalState> {
    const state = await this.checkpointer.get(threadId);

    if (choice === "keep") {
      // Update status from stale to approved
      const approvedState = this.updateSection(state, sectionId, {
        ...state.sections[sectionId],
        status: "approved",
        lastUpdated: new Date().toISOString(),
      });

      await this.checkpointer.put(threadId, approvedState);
      return approvedState;
    } else {
      // Add regeneration guidance to state
      const guidanceState = this.addRegenerationGuidance(state, sectionId);
      await this.checkpointer.put(threadId, guidanceState);

      // Resume graph execution, targeting the specific generator node
      const result = await this.graph.invoke(guidanceState);
      return result;
    }
  }

  // Helper methods...
}
```

_This document serves as a blueprint for the system, illustrating key architectural decisions, patterns, relationships, and implementation strategies. It provides essential context for understanding how components interact and how data flows through the system._

## Core Workflow: LangGraph StateGraph

- **Pattern:** The primary workflow for proposal generation is implemented as a LangGraph `StateGraph` (`ProposalGenerationGraph`).
- **State:** Managed by the `OverallProposalState` interface, persisted via `SupabaseCheckpointer`.
- **Initialization:** The `StateGraph` constructor requires a schema definition. This MUST align with current LangGraph documentation, potentially using `Annotation.Root` or an explicit `{ channels: ... }` structure.
  - **Documentation Adherence:** Verify initialization patterns against the **latest official LangGraph.js documentation**.
  - **Clarification via Search:** If type errors or confusion persist regarding `StateGraph` initialization or state definition, **use the web search tool (e.g., Brave Search)** to find current examples, best practices, or issue discussions relevant to the LangGraph version being used.
- **Nodes:** Represent distinct steps (e.g., `researchNode`, `evaluateResearchNode`, `generateSectionNode`). Implemented as functions or LangChain Runnables taking state and returning updates.
- **Edges:** Define transitions. Sequential (`addEdge`) and conditional (`addConditionalEdges`) based on state (e.g., evaluation results).
- **HITL:** Implemented via graph interrupts, managed by the Orchestrator Service based on evaluation node results (`awaiting_review` status).

## Orchestration: Coded Service

- **Pattern:** A central `OrchestratorService` manages the overall process lifecycle.
- **Responsibilities:**
  - Session management (using `thread_id`).
  - Invoking/Resuming the `ProposalGenerationGraph` via the `checkpointer`.
  - Handling user input/feedback from the API layer.
  - Calling the `EditorAgentService` for revisions.
  - Managing state updates outside the graph flow (e.g., applying edits, marking sections `stale`).
  - Tracking dependencies (using `config/dependencies.json`) and guiding regeneration.

## Server Startup Architecture

- **Primary Entry Point**: `apps/backend/server.ts` is the main script executed to start the backend.
- **Asynchronous Initialization**: `server.ts` handles asynchronous setup tasks, notably initializing the LangGraph `graphInstance` and `checkpointerInstance`.
- **Express App Configuration**: `apps/backend/api/express-server.ts` configures the core Express application instance (`app`). It sets up essential middleware (CORS, helmet, security headers, body-parser, cookie-parser) and mounts the primary, non-LangGraph-specific API routers (e.g., `/api/rfp`). It then exports the configured `app` instance.
- **Router Mounting**: `server.ts` imports the configured `app` from `express-server.ts`. After the asynchronous initialization completes, it mounts the LangGraph-specific router (`/api/langgraph`) onto the imported `app`. It also sets up final middleware like 404 handlers and global error handlers.
- **Server Listening**: Finally, `server.ts` creates an HTTP server using the fully configured `app` instance and starts listening on the configured port.
- **Benefits**: This separation ensures that asynchronous setup (like DB connections or graph compilation) completes before the server starts accepting requests that depend on those components, while keeping core Express configuration distinct.
