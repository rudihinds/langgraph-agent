# Orchestrator Agent

The Orchestrator Agent serves as the central coordination system for the proposal generation pipeline, managing the flow of work across specialized agents and ensuring cohesive proposal development.

## File Structure

```
orchestrator/
├── index.ts               # Main entry point and exports
├── state.ts               # State definition and annotations
├── nodes.ts               # Node function implementations
├── graph.ts               # Graph definition and routing
├── workflow.ts            # Workflow definitions and task coordination
├── agent-integration.ts   # Integration with other specialized agents
├── configuration.ts       # Configuration settings
├── prompt-templates.ts    # Prompt templates for orchestrator
├── prompts/               # Additional prompt templates
└── __tests__/             # Unit and integration tests
```

## State Structure

The Orchestrator manages a comprehensive state object that coordinates the entire proposal generation process:

```typescript
interface OrchestratorState {
  // Core workflow tracking
  workflow: {
    stage: WorkflowStage;
    status: WorkflowStatus;
    tasks: Record<string, TaskState>;
    currentTask: string | null;
  };
  
  // Document management
  documents: {
    rfp: RFPDocument | null;
    research: ResearchResults | null;
    proposal: ProposalDocument | null;
  };
  
  // Human interaction
  humanFeedback: {
    pending: boolean;
    type: FeedbackType | null;
    content: string | null;
    response: string | null;
  };
  
  // Error handling and logging
  errors: string[];
  logs: LogEntry[];
  
  // Standard message state
  messages: BaseMessage[];
}
```

The state tracks the complete lifecycle of proposal generation, from initial RFP analysis through research to final proposal assembly.

## Node Functions

The Orchestrator implements several key node functions:

1. **`initializeWorkflowNode`**: Sets up the initial workflow state and task queue.

2. **`taskManagerNode`**: Determines the next task to execute based on workflow stage and dependencies.

3. **`researchCoordinationNode`**: Coordinates with the Research Agent to analyze RFP documents.

4. **`proposalPlanningNode`**: Develops the high-level proposal structure and content plan.

5. **`proposalSectionGenerationNode`**: Manages the generation of individual proposal sections.

6. **`proposalAssemblyNode`**: Compiles completed sections into a cohesive proposal document.

7. **`humanFeedbackNode`**: Processes human input at key decision points.

8. **`errorHandlerNode`**: Manages error recovery and fallback strategies.

## Workflow Management

The Orchestrator defines a structured workflow with the following stages:

1. **Initialization**: Setup of workflow, loading documents, and initial configuration.
2. **Research**: Coordinating with the Research Agent for RFP analysis.
3. **Planning**: Developing the proposal structure and content strategy.
4. **Generation**: Coordinating the creation of proposal sections.
5. **Review**: Quality assessment and refinement of generated content.
6. **Assembly**: Combining sections into a final proposal document.
7. **Finalization**: Polishing, formatting, and preparing for submission.

## Graph Structure

The Orchestrator implements a complex graph with:

- Conditional edges based on workflow stage and task state
- Human-in-the-loop decision points
- Error handling paths and recovery strategies
- Integration with specialized agents through defined interfaces

## Agent Integration

The `agent-integration.ts` file defines interfaces for communicating with:

- Research Agent
- Proposal Section Agents
- Evaluation Agents

Each integration includes standardized request/response formats, error handling, and state transformation functions.

## Usage Example

```typescript
import { createOrchestratorGraph } from "./index.js";

// Create an orchestrator instance
const orchestrator = createOrchestratorGraph();

// Initialize with an RFP document
const result = await orchestrator.invoke({
  documents: {
    rfp: {
      id: "doc-123",
      title: "Project Funding RFP"
    }
  }
});

// Stream updates for UI feedback
const stream = await orchestrator.stream({
  documents: {
    rfp: {
      id: "doc-123",
      title: "Project Funding RFP"
    }
  }
});

for await (const chunk of stream) {
  // Process state updates
  console.log(chunk.workflow.stage);
}
```

## Import Patterns

This module follows ES Module standards. When importing or exporting:

- Always include `.js` file extensions for relative imports
- Do not include extensions for package imports

Example correct imports:

```typescript
// Correct relative imports with .js extension
import { OrchestratorState } from "./state.js";
import { initializeWorkflowNode } from "./nodes.js";

// Correct package imports without extensions
import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
```

## Configuration

The Orchestrator supports configuration through the `configuration.ts` file, including:

- Model selection for different stages
- Timeout and retry settings
- Persistence configuration
- Feature flags for experimental capabilities

## Human-in-the-Loop Design

The orchestrator implements structured human feedback points with:

- Clear prompting for specific decisions
- State tracking of pending feedback requests
- Graceful handling of feedback integration
- Timeout mechanisms for asynchronous interaction