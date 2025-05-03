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

## Persistence: Checkpointer Adapter Pattern

We've implemented a layered adapter pattern for checkpointer functionality that separates storage implementation from LangGraph interface requirements:

### Storage Layer

- **ICheckpointer Interface**: Defines a common contract with methods:

  - `put(threadId: string, key: string, value: any): Promise<void>`
  - `get(threadId: string, key: string): Promise<any>`
  - `list(threadId: string): Promise<string[]>`
  - `delete(threadId: string): Promise<void>`

- **Implementations**:
  - `InMemoryCheckpointer`: Uses a Map-based in-memory storage for development/testing
  - `SupabaseCheckpointer`: Persists to Supabase database with proper tenant isolation

### Adapter Layer

- **LangGraph-Compatible Adapters**: Convert our storage implementations to LangGraph's `BaseCheckpointSaver` interface:
  - `MemoryLangGraphCheckpointer`: Adapts InMemoryCheckpointer
  - `LangGraphCheckpointer`: Adapts SupabaseCheckpointer
- These adapters implement LangGraph's required methods:
  - `put`: Store a checkpoint (calls underlying storage.put)
  - `get`: Retrieve a checkpoint (calls underlying storage.get)
  - `list`: List checkpoints (calls underlying storage.list)

### Factory Pattern

- **`createCheckpointer()`**: Factory function that:
  - Checks environment for valid Supabase credentials
  - Creates SupabaseCheckpointer + adapter if credentials exist and are valid
  - Falls back to InMemoryCheckpointer + adapter if credentials missing/invalid
  - Logs appropriate warnings when falling back to in-memory storage
  - Can be configured with specific user ID for multi-tenant isolation

### Key Advantages

1. **Decoupling**: Storage implementation is separate from LangGraph interface
2. **Testability**: In-memory implementation makes testing straightforward
3. **Future-Proofing**: If LangGraph changes `BaseCheckpointSaver` interface, we only update the adapter layer
4. **Multi-Tenant Security**: Enforces Row Level Security in Supabase implementation
5. **Development Flexibility**: Works without database configuration during development

### Usage Example

```typescript
// In graph definition/compilation
import { createGraph } from "./graph";
import { createCheckpointer } from "../services/checkpointer.service";

// Create a checkpointer with specific user ID
const checkpointer = createCheckpointer({ userId: "user-123" });

// Compile graph with the checkpointer
const compiledGraph = await createGraph().compile({
  checkpointer,
});

// Execute with thread ID
await compiledGraph.invoke(
  { messages: [] },
  { configurable: { thread_id: "thread-456" } }
);
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
    UI[User Interface] <--> API[API Layer - Express.js]
    API <--> OR[Orchestrator Service]
    OR <--> CK[Persistent Checkpointer]
    OR <--> PG[ProposalGenerationGraph]
    OR <--> EA[EditorAgent]

    subgraph "LangGraph StateGraph"
        PG --> LD[documentLoaderNode]
        PG --> DR[deepResearchNode]
        PG --> ER[evaluateResearchNode]
        PG --> SS[solutionSoughtNode]
        PG --> ES[evaluateSolutionNode]
        PG --> CP[connectionPairsNode]
        PG --> EC[evaluateConnectionsNode]
        PG --> SM[sectionManagerNode]
        PG --> SG[Section Generator Nodes]
        PG --> SE[Section Evaluator Nodes]
    end

    CK <--> DB[(PostgreSQL/Supabase)]

    classDef core fill:#f9f,stroke:#333;
    classDef graph fill:#bbf,stroke:#333;
    classDef storage fill:#bfb,stroke:#333;

    class OR,CK,PG core;
    class LD,DR,ER,SS,ES,CP,EC,SM,SG,SE graph;
    class DB storage;
```

### Key Components

1. **User Interface (UI)**: Frontend for user interactions (not part of this implementation).
2. **API Layer**: Express.js REST API handling HTTP requests and authentication.
3. **Orchestrator Service**: Core control unit managing workflow, state, and agent coordination.
4. **Persistent Checkpointer**: State persistence layer using PostgreSQL/Supabase.
5. **ProposalGenerationGraph**: LangGraph StateGraph defining the workflow.
6. **EditorAgent**: Specialized service for handling revisions and edits.
7. **Specialized Nodes**: Graph nodes for specific tasks (research, evaluation, generation).

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

## Persistence: Checkpointer Adapter Pattern

- **Pattern:** A layered adapter pattern that separates storage implementation from LangGraph interface requirements.
- **Storage Layer:**
  - `InMemoryCheckpointer`: Basic implementation for development and testing.
  - `SupabaseCheckpointer`: Production implementation using Supabase PostgreSQL.
  - These implement a consistent interface with basic `put()`, `get()`, `list()`, `delete()` methods.
- **Adapter Layer:**
  - `MemoryLangGraphCheckpointer`: Adapts `InMemoryCheckpointer` to implement `BaseCheckpointSaver<number>`.
  - `LangGraphCheckpointer`: Adapts `SupabaseCheckpointer` to implement `BaseCheckpointSaver<number>`.
  - These adapters translate between our simple storage API and LangGraph's more specific checkpoint interface.
- **Factory Pattern:**
  - `createCheckpointer()`: Factory function that creates the appropriate checkpointer based on environment configuration.
  - Handles fallback logic: if Supabase credentials are missing/invalid, falls back to in-memory implementation.
- **Key Advantages:**
  - **Decoupling:** Storage implementation details are isolated from LangGraph's interface requirements.
  - **Testability:** Can easily swap implementations for testing purposes.
  - **Future-Proofing:** If LangGraph's `BaseCheckpointSaver` interface changes, only adapters need to be updated.
- **Usage:** The compiled graph requires the appropriate adapter:
  ```typescript
  const checkpointer = createCheckpointer();
  const compiledGraph = graph.compile({
    checkpointer: checkpointer,
  });
  ```

## Editing: Editor Agent Service

- **Pattern:** A dedicated `EditorAgentService` handles non-sequential edits.
- **Responsibilities:** Takes section ID, current content, user feedback, and relevant context (e.g., surrounding sections, research results) to produce revised content.
- **Invocation:** Called by the `OrchestratorService` upon user edit requests.

## State Reducers

- **Pattern:** Custom reducer functions are used within the state definition (`ProposalStateAnnotation` or explicit channels object) for complex updates.
- **Examples:** `sectionsReducer` (merges map entries), `errorsReducer` (appends to array), `messagesStateReducer` (LangGraph built-in).
- **Requirement:** Reducers MUST ensure immutability.

## Validation: Zod Schemas

- **Pattern:** Zod schemas are used for validating:
  - API request/response bodies.
  - Structured outputs from LLMs/tools (e.g., evaluation results, research data).
  - Potentially parts of the `OverallProposalState` (though full state validation might be complex).

## Document Loader Node Pattern

The Document Loader Node is responsible for fetching RFP documents from Supabase storage and preparing them for parsing:

1. **Storage Integration**

   - Uses Supabase client to access the "proposal-documents" bucket
   - Retrieves documents by ID, matching user permissions
   - Handles various storage-related errors (not found, unauthorized, etc.)

2. **Format Support**

   - Supports PDF, DOCX, and TXT formats
   - Determines format based on file extension or content-type metadata
   - Streams document content for efficient processing

3. **Error Handling**

   - Implements comprehensive error handling for all potential failure points
   - Updates state with detailed error information for user feedback
   - Categorizes errors (not found, unauthorized, corrupted, etc.) for appropriate UI messaging

4. **State Updates**
   - Updates document status in the `OverallProposalState.rfpDocument` field
   - Sets status to 'loading', 'loaded', or 'error' based on operation result
   - Maintains content and metadata for successful loads
   - Records error details for failed operations

## Critical Implementation Paths

The most critical implementation paths in this system are:

1. **HITL Workflow**: The interrupt-feedback-resume cycle for human review
2. **Document Processing**: Loading, parsing, and analyzing RFP documents
3. **Section Generation**: Creating and evaluating proposal sections
4. **State Persistence**: Saving and loading state via the checkpointer

These paths require special attention for error handling, testing, and performance optimization.

## Chat UI Architecture

### Directory Structure

The Chat UI implementation follows a feature-based architecture within the web application:

```
/apps/web/src/features/chat-ui/
├── components/       # UI components for the chat interface
├── hooks/            # Custom React hooks for chat functionality
├── providers/        # Context providers for state management
├── types.ts          # Type definitions for the chat feature
├── utils.ts          # Utility functions for chat operations
└── index.ts          # Public exports from the feature
```

### Phase 2 Status

- All core UI components and utilities for Chat UI have been implemented in their correct target locations as per the integration plan.
- Linter errors are present for missing dependencies (e.g., `@/components/ui/tooltip`, `@/components/ui/button`, `@/lib/utils`), which must be resolved in the next phase.

### Next Phase Focus

- Resolve linter errors and ensure all required dependencies and UI primitives are present
- Complete backend integration for real-time chat and tool call handling
- Finalize Agent Inbox and tool call UI
- Add comprehensive tests for all components
- Polish UI for consistency, accessibility, and mobile responsiveness

### Core Patterns

#### State Management

The Chat UI uses React Context for state management with a clear separation of concerns:

1. **Chat Context**: Manages thread data and operations

   - Stores threads, active thread ID, and loading state
   - Provides actions for thread manipulation (create, update, delete)
   - Implements optimistic updates for better UX

2. **Stream Context**: Handles real-time communication with LangGraph
   - Manages WebSocket/SSE connections to the LangGraph server
   - Handles authentication and authorization
   - Processes incoming messages and updates the UI accordingly

#### Component Hierarchy

```
└── ChatProvider
    └── StreamProvider
        ├── ThreadHistory
        │   └── ThreadListItem
        └── Thread
            ├── MessageList
            │   └── Message (variants)
            │       ├── UserMessage
            │       ├── AssistantMessage
            │       ├── ToolCallMessage
            │       └── ToolResultMessage
            ├── AgentInbox (for interruptions)
            └── MessageInput
```

#### Type System

The type system is built around these core interfaces:

- `Message`: Represents a single message in a conversation
- `Thread`: Represents a conversation thread with multiple messages
- `ChatState`: Tracks the current state of all threads and UI
- `ChatActions`: Defines all possible operations on threads
- `ChatContextValue`: Combines state and actions for the context

#### Data Flow

1. User input is captured in the `MessageInput` component
2. The input is processed and added to the thread via `ChatContext`
3. Messages are sent to LangGraph through the `StreamProvider`
4. Responses from LangGraph are processed by `StreamProvider`
5. New messages are added to the thread via `ChatContext`
6. The UI updates to reflect the new state

#### Error Handling

- Network errors are caught and displayed to the user
- LangGraph server errors are processed and displayed appropriately
- UI state includes loading and error states to handle asynchronous operations

## Chat UI Integration Progress (2024-06)

Phase 2 of the Chat UI integration is complete. All UI components and utilities have been implemented in their correct locations. The next phase will focus on backend integration, tool call handling, and UI polish. Linter errors for missing dependencies must be resolved as part of this work.

## Recent Updates (2024-06)

- Chat UI integration Phase 2 is complete: all UI components and utilities are implemented in their correct locations. Linter errors remain due to missing dependencies (e.g., @/components/ui/tooltip, @/components/ui/button, @/lib/utils), to be resolved in the next phase.
- Backend integration, tool call handling, and UI polish are the next focus areas.
- Orchestrator and graph now support rfpId and userId for multi-tenant, document-specific workflows.
- Supabase Auth SSR integration is robust and follows best practices (getAll/setAll, getUser()).
- Adapter pattern for checkpointing ensures future-proofing against LangGraph API changes.
- Project is on track for backend integration and final polish phases.
