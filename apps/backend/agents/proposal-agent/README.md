# Proposal Agent Implementation

This directory contains the implementation of the Proposal Agent, a multi-stage workflow built with LangGraph.js to assist users in creating high-quality proposals for grants and RFPs.

## File Structure

- `state.js` - Type definitions and state schema for the agent
- `nodes.ts` - Original implementation of node functions (with TypeScript)
- `nodes-refactored.js` - Refactored implementation with improved organization
- `graph.ts` - Original implementation of the graph (with TypeScript)
- `graph-refactored.js` - Refactored implementation with better error handling
- `tools.ts` - Tool definitions for proposal generation
- `configuration.ts` - Configuration options for the agent
- `index.ts` - Main exports for original implementation
- `index-refactored.js` - Main exports for refactored implementation
- `prompts/` - Directory containing prompt templates
  - `index.js` - Prompt template definitions
  - `extractors.js` - Helper functions for extracting data from LLM responses

## Node Functions

The agent is composed of the following node functions:

1. `orchestratorNode` - Determines the next steps in the workflow
2. `researchNode` - Analyzes RFP documents and extracts key information
3. `solutionSoughtNode` - Identifies what solution the funder is seeking
4. `connectionPairsNode` - Generates alignment between applicant and funder
5. `sectionGeneratorNode` - Writes specific proposal sections
6. `evaluatorNode` - Reviews and provides feedback on proposal sections
7. `humanFeedbackNode` - Collects user input and feedback

## Graph Structure

The graph is organized as a star topology with the orchestrator at the center. The orchestrator determines which node to route to next based on the content of the last message. After each specialized node completes its task, control returns to the orchestrator.

## State Management

The state includes:
- Message history
- RFP document text
- Extracted funder information
- Identified solution sought
- Generated connection pairs
- Proposal sections
- Current section being worked on
- User feedback

## Usage Example

```javascript
import { runProposalAgent } from "./apps/backend/agents/proposal-agent/index-refactored.js";

async function example() {
  const result = await runProposalAgent(
    "I need help writing a grant proposal for a community garden project."
  );
  
  console.log("Final state:", result);
}

example().catch(console.error);
```

## Design Decisions

1. **Modular Organization**: Separating prompt templates and extraction functions improves maintainability.
2. **Configuration**: Agent parameters can be easily adjusted through the configuration file.
3. **Progressive Workflow**: The agent follows a logical progression through research, analysis, and writing.
4. **Human-in-the-Loop**: User feedback is integrated throughout the process.

## Future Improvements

- Add more specialized tools for research and analysis
- Implement better error handling and recovery
- Add checkpoint persistence for long-running proposals
- Improve extraction patterns for better content structuring