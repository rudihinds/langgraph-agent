# Evaluation Framework

This module provides a standardized framework for evaluating different components of a proposal, including research, solution, connection pairs, and individual sections.

## Overview

The evaluation framework consists of several key components:

1. **Evaluation Node Factory**: A factory class for creating standardized evaluation nodes that can be integrated into the LangGraph proposal generation flow.
2. **Content Extractors**: Functions that extract and validate specific content from the proposal state.
3. **Criteria Configuration**: JSON files that define evaluation criteria for different content types.
4. **Evaluation Result Interface**: Standardized structure for evaluation results.

## Key Components

### EvaluationNodeFactory

The `EvaluationNodeFactory` class provides a clean interface for creating evaluation nodes for different content types. It encapsulates configuration and logic for generating evaluation node functions.

```typescript
// Create a factory instance
const factory = new EvaluationNodeFactory({
  temperature: 0,
  modelName: "gpt-4o-2024-05-13",
  defaultTimeoutSeconds: 60,
});

// Create a research evaluation node
const researchEvalNode = factory.createResearchEvaluationNode();

// Create a section evaluation node
const problemStatementEvalNode = factory.createSectionEvaluationNode(
  SectionType.PROBLEM_STATEMENT
);
```

### Content Extractors

Content extractors are functions that extract and validate specific content from the proposal state. They handle validation and preprocessing of the content to ensure it's in a format suitable for evaluation.

```typescript
// Example of using a content extractor
const researchContent = extractResearchContent(state);
const solutionContent = extractSolutionContent(state);
const problemStatementContent = extractSectionContent(
  state,
  SectionType.PROBLEM_STATEMENT
);
```

### Evaluation Result Interface

All evaluations return a standardized result structure that includes:

```typescript
interface EvaluationResult {
  passed: boolean;
  timestamp: string;
  evaluator: "ai" | "human" | string;
  overallScore: number;
  scores: {
    [criterionId: string]: number;
  };
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  feedback: string;
  rawResponse?: any;
}
```

## Integration with Proposal Generation Graph

The evaluation nodes can be integrated into the proposal generation graph to provide automated evaluation of content as it's generated. This is demonstrated in the `examples/` directory:

- `examples/sectionEvaluationNodes.ts`: Shows how to create evaluation nodes for different section types.
- `examples/graphIntegration.ts`: Demonstrates how to integrate evaluation nodes into the main graph.

### Basic Integration Steps

1. **Create evaluation nodes using the factory**:

```typescript
const evaluationFactory = new EvaluationNodeFactory();
const researchEvalNode = evaluationFactory.createResearchEvaluationNode();
const sectionEvaluators = createSectionEvaluationNodes();
```

2. **Add the nodes to your graph**:

```typescript
graph.addNode("evaluateResearch", researchEvalNode);

// For section evaluators
Object.entries(sectionEvaluators).forEach(([sectionType, evaluatorNode]) => {
  const capitalizedType =
    sectionType.charAt(0).toUpperCase() + sectionType.slice(1);
  graph.addNode(`evaluate${capitalizedType}`, evaluatorNode);
});
```

3. **Create edges and conditional routing**:

```typescript
// Add edge from generation to evaluation
graph.addEdge("generateResearch", "evaluateResearch");

// Add conditional edges based on evaluation result
graph.addConditionalEdges("evaluateResearch", (state: OverallProposalState) => {
  if (state.researchEvaluation?.passed) {
    return "nextNode"; // Proceed if passed
  } else {
    return "regenerateResearch"; // Regenerate if failed
  }
});
```

## Human-in-the-Loop (HITL) Evaluation

The evaluation framework supports human-in-the-loop evaluation through the following mechanism:

1. When evaluation nodes run, they set `interruptStatus.isInterrupted = true` and `interruptStatus.processingStatus = "awaiting_review"`.
2. The Orchestrator should detect this interruption and allow a human to review the evaluation results.
3. After human input, the Orchestrator can resume the graph with updated state.

Example implementation of resuming after human evaluation:

```typescript
async function resumeAfterHumanEvaluation(
  graph: StateGraph<OverallProposalState>,
  threadId: string,
  state: OverallProposalState,
  humanFeedback: {
    contentType: string;
    approved: boolean;
    feedback?: string;
  }
) {
  // Update state with human feedback
  const updatedState: OverallProposalState = {
    ...state,
    interruptStatus: {
      isInterrupted: false, // Clear the interrupt
      interruptionPoint: state.interruptStatus?.interruptionPoint || null,
      processingStatus: humanFeedback.approved ? "approved" : "rejected",
    },
  };

  // Resume the graph with updated state
  return await graph.resume(threadId, updatedState);
}
```

## Custom Criteria

The evaluation framework supports custom criteria through JSON configuration files located in `config/evaluation/criteria/`.

Each criteria file follows this structure:

```json
{
  "criteria": [
    {
      "id": "relevance",
      "name": "Relevance",
      "description": "How relevant the content is...",
      "weight": 3,
      "passThreshold": 0.8
    }
    // Additional criteria...
  ],
  "overallPassThreshold": 0.75,
  "evaluationInstructions": "Evaluate the content against each criterion..."
}
```

## Custom Validation

The evaluation framework supports custom validation logic through the `customValidator` option:

```typescript
const customEvaluator = factory.createNode("custom", {
  contentExtractor: customExtractor,
  resultField: "customEvaluation",
  statusField: "customStatus",
  customValidator: (content) => {
    if (!content || !content.requiredField) {
      return { valid: false, error: "Missing required field" };
    }
    return { valid: true };
  },
});
```

## Error Handling

The evaluation framework includes comprehensive error handling:

- Content validation errors
- LLM API errors and timeouts
- Response parsing errors
- Criteria loading errors

Errors are captured in the state's `errors` array and also reflected in system messages.

## Performance Considerations

- Default timeout is 60 seconds (configurable)
- Uses temperature 0 for deterministic evaluations
- Supports custom model selection

## Examples

Check the `examples/` directory for practical examples of using the evaluation framework:

- `sectionEvaluationNodes.ts`: Creating evaluation nodes for different section types
- `graphIntegration.ts`: Integrating evaluation nodes into the main graph
