# Research Agent

The Research Agent is a specialized LangGraph.js component that analyzes RFP (Request for Proposal) documents to extract critical insights for proposal development. This agent serves as the foundation for the proposal generation system, providing deep analysis that informs downstream proposal writing agents.

## File Structure

```
research/
├── index.ts         # Main entry point and graph definition
├── state.ts         # State definition and annotations
├── nodes.ts         # Node function implementations
├── agents.ts        # Specialized agent definitions
├── tools.ts         # Tool implementations
├── prompts/         # Prompt templates
│   └── index.ts     # All prompt templates
└── __tests__/       # Unit and integration tests
```

## State Structure

The Research Agent maintains a comprehensive state object with the following key components:

```typescript
interface ResearchState {
  // Original document
  rfpDocument: {
    id: string;
    text: string;
    metadata: Record<string, any>;
  };

  // Research findings
  deepResearchResults: DeepResearchResults | null;

  // Solution sought analysis
  solutionSoughtResults: SolutionSoughtResults | null;

  // Standard message state for conversation history
  messages: BaseMessage[];

  // Error tracking
  errors: string[];

  // Status tracking
  status: {
    documentLoaded: boolean;
    researchComplete: boolean;
    solutionAnalysisComplete: boolean;
  };
}
```

The state includes specialized structures for research results:

- `DeepResearchResults`: A structured analysis across 12 categories including "Structural & Contextual Analysis", "Hidden Needs & Constraints", "Competitive Intelligence", etc.
- `SolutionSoughtResults`: Analysis of what solution the funder is seeking, including primary/secondary approaches and explicitly unwanted approaches.

## State Validation

The Research Agent uses Zod schemas to validate state structure:

```typescript
export const ResearchStateSchema = z.object({
  rfpDocument: z.object({
    id: z.string(),
    text: z.string(),
    metadata: z.record(z.any()),
  }),
  deepResearchResults: z
    .object({
      "Structural & Contextual Analysis": z.record(z.string()),
      "Author/Organization Deep Dive": z.record(z.string()),
      "Hidden Needs & Constraints": z.record(z.string()),
      // Additional categories omitted for brevity
    })
    .catchall(z.record(z.string()))
    .nullable(),
  solutionSoughtResults: z
    .object({
      solution_sought: z.string(),
      solution_approach: z.object({
        primary_approaches: z.array(z.string()),
        secondary_approaches: z.array(z.string()),
        evidence: z.array(
          z.object({
            approach: z.string(),
            evidence: z.string(),
            page: z.string(),
          })
        ),
      }),
      // Additional fields omitted for brevity
    })
    .catchall(z.any())
    .nullable(),
  messages: z.array(z.any()),
  errors: z.array(z.string()),
  status: z.object({
    documentLoaded: z.boolean(),
    researchComplete: z.boolean(),
    solutionAnalysisComplete: z.boolean(),
  }),
});
```

This schema is used by the SupabaseCheckpointer to validate state during persistence operations.

## Node Functions

The Research Agent implements three primary node functions:

1. **`documentLoaderNode`**: Loads RFP document content from a document service and attaches it to the agent state.

2. **`deepResearchNode`**: Invokes the deep research agent to analyze RFP documents and extract structured information across 12 key research categories.

3. **`solutionSoughtNode`**: Invokes the solution sought agent to identify what the funder is seeking based on research results.

Each node function properly handles errors and updates the state with appropriate status flags.

## Agent Components

The Research Agent uses two specialized agent components:

1. **`deepResearchAgent`**: Analyzes RFP documents to extract structured information using GPT-3.5 Turbo with access to web search capability.

2. **`solutionSoughtAgent`**: Identifies what funders are looking for by analyzing research data and has access to a specialized research tool.

## Tools

The agent provides the following tools:

1. **`webSearchTool`**: Allows agents to search the web for real-time information that may not be present in the context or training data.

2. **`deepResearchTool`**: Provides specialized research capabilities using a dedicated LLM for deeper analysis of specific topics related to the RFP.

## Graph Structure

The Research Agent implements a linear workflow:

1. Load the document → Document loader node
2. Analyze the document → Deep research node
3. Determine solution sought → Solution sought node

Conditional logic ensures that each step only proceeds if the previous step was successful.

## Usage Example

```typescript
import { createResearchGraph } from "./index.js";

// Create a research agent instance
const researchAgent = createResearchGraph();

// Run the agent with a document ID
const result = await researchAgent.invoke({
  rfpDocument: { id: "doc-123" },
});

// Access the research results
const deepResearch = result.deepResearchResults;
const solutionSought = result.solutionSoughtResults;
```

## Import Patterns

This module follows ES Module standards. When importing or exporting:

- Always include `.js` file extensions for relative imports
- Do not include extensions for package imports

Example correct imports:

```typescript
// Correct relative imports with .js extension
import { ResearchState } from "./state.js";
import { documentLoaderNode } from "./nodes.js";

// Correct package imports without extensions
import { StateGraph } from "@langchain/langgraph";
import { z } from "zod";
```

## Prompt Templates

The agent uses two main prompt templates:

1. **`deepResearchPrompt`**: Guides the deep research agent to analyze RFP documents across 12 key areas.

2. **`solutionSoughtPrompt`**: Instructs the solution sought agent to identify the specific solution the funder is seeking.

Prompt templates are stored in `prompts/index.ts` and are referenced by the agent functions.
