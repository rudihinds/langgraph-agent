# System Patterns

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

* **Single Source of Truth**: Define comprehensive `OverallProposalState` interface containing all workflow state.
* **Immutable Updates**: Use reducer functions for predictable state transformations.
* **Persistent Checkpointing**: Utilize `@langchain/langgraph-checkpoint-postgres` for PostgreSQL-based state persistence.
* **Status Tracking**: Define explicit status enums for tracking progress at various granularities.

### Workflow Control

* **Orchestration Pattern**: Centralize control logic in the Orchestrator rather than embedding in the graph.
* **Human-in-the-Loop**: Use LangGraph interrupts for approval checkpoints and feedback incorporation.
* **Non-Sequential Editing**: Enable targeted node execution via Orchestrator rather than always linear graph traversal.
* **Dependency Management**: Track section relationships in a dependency map for intelligent regeneration guidance.

### Agent Communication

* **Message-Based Protocol**: Use BaseMessage instances for standardized agent communication.
* **Context Preservation**: Ensure critical context is included in state and passed between components.
* **Structured Outputs**: Define Zod schemas for validating agent outputs in a type-safe manner.

### Infrastructure

* **Supabase Integration**: Leverage Supabase for authentication, database, and PostgreSQL access.
* **Service-Based Design**: Implement core business logic in services rather than directly in graph nodes.
* **File Length Limits**: Enforce 300-line maximum to maintain modularity and readability.

## 3. Core Design Patterns

### StateGraph Pattern

* Graph nodes represent discrete processing steps with well-defined inputs/outputs
* State is passed and updated through the graph rather than using side effects
* Conditional routing determines the execution path based on state evaluation

### Orchestrator Pattern

* Central service coordinates the overall flow and integrates components
* State loading/saving handled by Orchestrator via Checkpointer
* Graph invocation, interruption, and resumption managed consistently

### Human-in-the-Loop Pattern

* Interrupt graph execution at critical review points
* Capture and incorporate human feedback
* Resume execution with updated context

### Edit-with-Dependencies Pattern

* Track relationships between content sections
* Mark dependent sections as stale when predecessors change
* Provide guided regeneration based on dependency context

### Reducer Pattern

* Custom reducer functions for complex state updates
* Ensures immutable state transitions
* Handles array updates, nested objects, and section maps

### Evaluation-Revision Pattern

* Generate content → Evaluate against criteria → Present for review → Revise based on feedback
* Apply consistent evaluation framework across content types
* Capture evaluation results in state for decision-making

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
type LoadingStatus = 'not_started' | 'loading' | 'loaded' | 'error';
type ProcessingStatus = 'queued' | 'running' | 'awaiting_review' | 'approved' | 'edited' | 'stale' | 'complete' | 'error';
type SectionProcessingStatus = 'queued' | 'generating' | 'awaiting_review' | 'approved' | 'edited' | 'stale' | 'error';

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
  rfpDocument: { id: string; fileName?: string; text?: string; metadata?: Record<string, any>; status: LoadingStatus; };
  researchResults?: Record<string, any>; 
  researchStatus: ProcessingStatus;
  researchEvaluation?: EvaluationResult | null;
  solutionSoughtResults?: Record<string, any>; 
  solutionSoughtStatus: ProcessingStatus;
  solutionSoughtEvaluation?: EvaluationResult | null;
  connectionPairs?: any[]; 
  connectionPairsStatus: ProcessingStatus;
  connectionPairsEvaluation?: EvaluationResult | null;
  sections: { [sectionId: string]: SectionData | undefined; };
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
  async resumeGraph(threadId: string, feedback?: any): Promise<OverallProposalState> {
    const state = await this.checkpointer.get(threadId);
    const updatedState = this.incorporateFeedback(state, feedback);
    await this.checkpointer.put(threadId, updatedState);
    
    const result = await this.graph.invoke(updatedState);
    return result;
  }

  // Handle user edits
  async handleEdit(threadId: string, sectionId: string, editedContent: string): Promise<OverallProposalState> {
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
      status: 'edited',
      lastUpdated: new Date().toISOString()
    });
    
    // Mark dependent sections as stale
    const dependentSections = this.getDependentSections(sectionId);
    const staleState = this.markSectionsAsStale(updatedState, dependentSections);
    
    await this.checkpointer.put(threadId, staleState);
    return staleState;
  }

  // Handle user choices for stale sections
  async handleStaleChoice(threadId: string, sectionId: string, choice: 'keep' | 'regenerate'): Promise<OverallProposalState> {
    const state = await this.checkpointer.get(threadId);
    
    if (choice === 'keep') {
      // Update status from stale to approved
      const approvedState = this.updateSection(state, sectionId, {
        ...state.sections[sectionId],
        status: 'approved',
        lastUpdated: new Date().toISOString()
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

*This document serves as a blueprint for the system, illustrating key architectural decisions, patterns, relationships, and implementation strategies. It provides essential context for understanding how components interact and how data flows through the system.*