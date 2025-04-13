# Research Agent Implementation

This directory contains the implementation of the Research Agent, a specialized agent built with LangGraph.js that analyzes RFP documents and extracts key information.

## File Structure

The agent follows the standardized directory structure for LangGraph agents:

```
research/
├── README.md           # This file
├── index.ts            # Main exports and graph creation
├── state.ts            # State definitions with annotations
├── nodes.ts            # Node implementations
├── agents.ts           # Agent definitions
├── tools.ts            # Tool implementations
└── prompts/            # Prompt templates
    └── index.ts        # Consolidated prompt templates
```

## State Structure

The Research Agent maintains the following state:

- `rfpDocument`: The original RFP document text and metadata
- `deepResearchResults`: Structured results from the deep research process
- `solutionSoughtResults`: Analysis of what solution the funder is seeking
- `messages`: Conversation history
- `errors`: Error tracking
- `status`: Status tracking for different phases of research

## Node Functions

The agent is composed of the following node functions:

1. `documentLoaderNode`: Loads and processes RFP documents
2. `deepResearchNode`: Analyzes RFP documents and extracts key information
3. `solutionSoughtNode`: Identifies what solution the funder is seeking

## Agent Components

The agent uses the following specialized components:

1. `deepResearchAgent`: A ReAct agent that performs deep analysis of RFP documents
2. `solutionSoughtAgent`: A ReAct agent that analyzes research results to identify solutions

## Tools

The agent provides the following tools:

1. `webSearchTool`: Allows research agent to search for additional context
2. `deepResearchTool`: Specialized tool for in-depth research on specific topics

## Graph Structure

The research workflow follows a linear process:

1. Document loading and processing
2. Deep research on the document
3. Solution sought analysis

Each step includes conditional edges that verify successful completion before proceeding to the next step.

## Usage Example

```typescript
import { researchAgent } from "./apps/backend/agents/research";

async function analyzeDocument(documentId: string) {
  const result = await researchAgent.invoke(documentId);
  
  console.log("Research complete!");
  console.log("Deep research results:", result.deepResearchResults);
  console.log("Solution sought:", result.solutionSoughtResults);
}

analyzeDocument("doc123").catch(console.error);
```

## Design Decisions

1. **Structured JSON Output**: All agent outputs are formatted as structured JSON for easier integration with other components
2. **Error Tracking**: Comprehensive error tracking in state
3. **Status Management**: Clear status flags for tracking progress
4. **Tool Integration**: ReAct agents for autonomous tool use
5. **Modular Structure**: Clean separation of concerns