# Evaluation Pattern Documentation for Proposal Generation System

## 1. Overview

This document outlines the standardized evaluation pattern implemented for the `evaluateConnectionsNode` and proposed for use across all evaluation nodes in the Proposal Generation System. This pattern provides a consistent approach to quality assessment, human-in-the-loop (HITL) review, and state management throughout the proposal generation process.

## 2. Evaluation Pattern Architecture

The evaluation pattern consists of the following key components:

### 2.1 Core Components

1. **Evaluation Node**: A specialized LangGraph node function that assesses the quality of generated content.
2. **Evaluation Agent**: An LLM-based agent configured to analyze content against predefined criteria.
3. **Evaluation Result Structure**: A standardized format for evaluation outcomes.
4. **HITL Interrupt Metadata**: A structured approach to pausing execution for human review.
5. **State Management**: Consistent patterns for updating the `OverallProposalState`.

### 2.2 Flow Diagram

```
[Previous Node] → [Evaluation Node] → [HITL Interrupt] → [User Review] → [Conditional Routing]
                                                                            ↙           ↘
                                                        [Continue to Next Node]    [Return to Generator]
```

## 3. Evaluation Node Implementation

Each evaluation node follows this pattern:

```typescript
/**
 * Node to evaluate generated content against predefined criteria
 * @param state Current proposal state
 * @returns Updated state with evaluation results and interrupt metadata
 */
export async function evaluateXNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  // 1. Input validation
  // 2. Status update to 'evaluating'
  // 3. Prepare evaluation context
  // 4. Invoke evaluation agent
  // 5. Process evaluation results
  // 6. Set interrupt metadata
  // 7. Update status to 'awaiting_review'
  // 8. Return updated state
}
```

### 3.1 Input Validation

Consistent validation pattern for all evaluation nodes:

```typescript
// Check if required content exists and is properly formatted
if (
  !state.contentToEvaluate ||
  typeof state.contentToEvaluate !== "string" ||
  state.contentToEvaluate.trim() === ""
) {
  return {
    contentStatus: "error",
    errors: [
      ...(state.errors || []),
      "EvaluateXNode: Content to evaluate is missing or empty",
    ],
  };
}
```

### 3.2 Status Update

Consistent status transition pattern:

```typescript
// Update status to indicate evaluation is in progress
return {
  ...processedState,
  contentStatus: "evaluating",
};
```

### 3.3 Evaluation Agent Invocation

Standardized agent creation and invocation:

```typescript
// Create evaluation agent with appropriate criteria
const evaluationAgent = createEvaluationAgent({
  criteria: getEvaluationCriteria("contentType"),
  temperature: 0.2, // Lower temperature for more consistent evaluations
});

// Invoke agent with content and context
const evaluationResponse = await evaluationAgent.invoke({
  content: state.contentToEvaluate,
  context: buildEvaluationContext(state),
});
```

### 3.4 Evaluation Result Structure

Standardized structure for all evaluation results:

```typescript
interface EvaluationResult {
  passed: boolean; // Overall pass/fail assessment
  score: number; // Numeric score (1-10)
  feedback: string; // General feedback summary
  strengths: string[]; // Specific positive aspects
  weaknesses: string[]; // Areas for improvement
  suggestions: string[]; // Specific improvement recommendations
  criteriaAssessments: {
    // Detailed criteria-specific assessments
    [criterionName: string]: {
      score: number; // Criterion-specific score (1-10)
      comments: string; // Detailed assessment for this criterion
    };
  };
}
```

### 3.5 HITL Interrupt Configuration

Standardized interrupt metadata pattern:

```typescript
// Set interrupt metadata for HITL review
return {
  ...processedState,
  contentStatus: "awaiting_review",
  interruptStatus: {
    isInterrupted: true,
    interruptionPoint: `evaluateX:${contentIdentifier}`,
    feedback: null,
    processingStatus: "pending",
  },
  interruptMetadata: {
    reason: "EVALUATION_NEEDED",
    nodeId: "evaluateXNode",
    timestamp: new Date().toISOString(),
    contentReference: contentIdentifier,
    evaluationResult: evaluationResult,
  },
};
```

## 4. State Management Integration

### 4.1 OverallProposalState Updates

The evaluation pattern utilizes and updates the following fields in the `OverallProposalState`:

```typescript
interface OverallProposalState {
  // Content-specific fields (examples for different content types):
  connections?: any[];
  connectionPairsStatus: ProcessingStatus;
  connectionPairsEvaluation?: EvaluationResult | null;

  solutionResults?: Record<string, any>;
  solutionStatus: ProcessingStatus;
  solutionEvaluation?: EvaluationResult | null;

  // Section-specific fields (within sections map):
  sections: Map<SectionType, SectionData>;
  // Where SectionData includes:
  // {
  //   evaluation?: EvaluationResult;
  //   status: SectionProcessingStatus;
  // }

  // HITL fields (common across all evaluation nodes):
  interruptStatus?: {
    isInterrupted: boolean;
    interruptionPoint: string;
    feedback: any | null;
    processingStatus: "pending" | "processing" | "completed";
  };
  interruptMetadata?: {
    reason: "EVALUATION_NEEDED" | "USER_REQUESTED" | "ERROR_OCCURRED";
    nodeId: string;
    timestamp: string;
    contentReference: string;
    evaluationResult?: EvaluationResult;
  };

  // Other standard fields...
  messages: BaseMessage[];
  errors: string[];
  status: ProcessingStatus;
}
```

### 4.2 Required Updates to OverallProposalState

To fully support this evaluation pattern across all nodes, the `OverallProposalState` interface needs the following updates:

1. Ensure the `interruptStatus` and `interruptMetadata` fields are properly defined.
2. Add evaluation result fields for all content types (research, solution, connections, and each section type).
3. Standardize the `ProcessingStatus` type to include 'evaluating' and 'awaiting_review' statuses.
4. Add a consistent evaluation field to the `SectionData` interface.

## 5. Conditional Routing Implementation

After HITL review, standardized conditional routing functions determine the next path:

```typescript
/**
 * Routes flow after evaluation of specific content
 * @param state Current proposal state
 * @returns The next node to route to ('next' or 'revise')
 */
export function routeAfterEvaluation(contentType: string) {
  return function (state: OverallProposalState): "next" | "revise" {
    // Check if user provided feedback approving or requesting revisions
    if (state.interruptStatus?.feedback?.action === "approve") {
      return "next";
    } else if (state.interruptStatus?.feedback?.action === "revise") {
      return "revise";
    }

    // Default routing based on evaluation result
    const evaluation = getEvaluationForContentType(state, contentType);
    return evaluation?.passed ? "next" : "revise";
  };
}
```

## 6. Evaluation Criteria Management

### 6.1 Criteria Configuration

Criteria are loaded from configuration files for each content type:

```typescript
// In config/evaluation/index.js
export const CRITERIA_CONFIG = {
  connections: [
    {
      name: "relevance",
      description:
        "How relevant the connections are to both funder priorities and applicant capabilities",
      weight: 2.0, // Higher weight for more important criteria
    },
    {
      name: "specificity",
      description: "How specific and concrete the connections are",
      weight: 1.5,
    },
    // Additional criteria...
  ],
  // Other content types...
};
```

### 6.2 Evaluation Prompts

Standardized prompt structure for all evaluation agents:

```typescript
const evaluationPromptTemplate = `
You are an expert proposal evaluator reviewing {contentType}.

CONTENT TO EVALUATE:
{content}

EVALUATION CRITERIA:
{criteria}

CONTEXT:
{context}

Evaluate the content above against each criterion, and provide:
1. A score from 1-10 for each criterion
2. Specific feedback for each criterion
3. An overall assessment including:
   - Overall score (1-10)
   - Pass/fail determination (pass requires score >= 7)
   - Key strengths (2-3 bullet points)
   - Areas for improvement (2-3 bullet points)
   - Specific suggestions for enhancement

RESPONSE FORMAT:
{
  "overall_score": number,
  "passed": boolean,
  "feedback": "General feedback summary",
  "strengths": ["Strength 1", "Strength 2", ...],
  "weaknesses": ["Weakness 1", "Weakness 2", ...],
  "suggestions": ["Suggestion 1", "Suggestion 2", ...],
  "criteria_assessments": {
    "criterion1": {
      "score": number,
      "comments": "Detailed assessment"
    },
    ...
  }
}
`;
```

## 7. Best Practices Alignment

This evaluation pattern aligns with industry best practices for AI system evaluation:

1. **Transparent Criteria**: Explicitly defined evaluation criteria.
2. **Multi-Dimensional Assessment**: Scores across multiple dimensions rather than a single metric.
3. **Qualitative and Quantitative**: Combines numeric scores with detailed feedback.
4. **Human Oversight**: HITL review for critical decisions.
5. **Consistent Methodology**: Standard approach across all content types.
6. **Actionable Feedback**: Specific suggestions for improvement.
7. **Audit Trail**: Preserved evaluation results for review and analysis.

## 8. Evaluation Pattern Implementation for connectionPairsNode

The `evaluateConnectionsNode` implements this pattern as follows:

```typescript
/**
 * Node to evaluate the connection pairs between funder and applicant priorities
 * @param state Current proposal state
 * @returns Updated state with connection evaluation
 */
export async function evaluateConnectionsNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  // Input validation
  if (
    !state.connections ||
    !Array.isArray(state.connections) ||
    state.connections.length === 0
  ) {
    return {
      connectionPairsStatus: "error",
      errors: [
        ...(state.errors || []),
        "EvaluateConnectionsNode: Connection pairs are missing or empty",
      ],
    };
  }

  // Status update
  let processedState: Partial<OverallProposalState> = {
    connectionPairsStatus: "evaluating",
    messages: [
      ...(state.messages || []),
      new SystemMessage("Evaluating connection pairs..."),
    ],
  };

  try {
    // Create evaluation agent
    const evalAgent = createConnectionEvaluationAgent();

    // Prepare evaluation context
    const evaluationContext = {
      connections: state.connections,
      solutionResults: state.solutionResults,
      researchResults: state.researchResults,
    };

    // Invoke agent
    const response = await evalAgent.invoke(evaluationContext);

    // Parse evaluation result
    const evaluationResult = parseEvaluationResponse(response);

    // Set interrupt metadata for HITL review
    return {
      ...processedState,
      connectionPairsStatus: "awaiting_review",
      connectionPairsEvaluation: evaluationResult,
      interruptStatus: {
        isInterrupted: true,
        interruptionPoint: "evaluateConnections",
        feedback: null,
        processingStatus: "pending",
      },
      interruptMetadata: {
        reason: "EVALUATION_NEEDED",
        nodeId: "evaluateConnectionsNode",
        timestamp: new Date().toISOString(),
        contentReference: "connections",
        evaluationResult: evaluationResult,
      },
    };
  } catch (error) {
    // Error handling with appropriate categorization
    const errorMsg = `EvaluateConnectionsNode: ${categorizeError(error)}`;
    return {
      ...processedState,
      connectionPairsStatus: "error",
      errors: [...(state.errors || []), errorMsg],
    };
  }
}
```

## 9. Implementation Roadmap

To implement this pattern consistently across the system:

1. **Update OverallProposalState** with standardized evaluation fields
2. **Create Evaluation Configuration Files** for all content types
3. **Implement Base Evaluation Agent Factory** with shared logic
4. **Standardize Conditional Routing Functions**
5. **Update Graph Configuration** to include interrupt points after all evaluation nodes
6. **Document Pattern in Architecture Documentation**

## 10. Conclusion

This standardized evaluation pattern provides a consistent approach to quality assessment, human review, and state management across the Proposal Generation System. By implementing this pattern for all evaluation nodes, we ensure a cohesive, maintainable system with predictable behavior and a consistent user experience.
