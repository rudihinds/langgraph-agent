# Human-in-the-Loop (HITL) Nodes Guide

This guide explains how to use the generic HITL node utilities to create natural, conversational workflows in LangGraph.

## Overview

The HITL nodes provide reusable patterns for common human-in-the-loop workflows:
- **Human Review Node**: Interrupts flow to collect user feedback
- **Feedback Router Node**: Interprets user responses and routes to appropriate handlers
- **Approval Node**: Handles approval scenarios with natural language confirmation
- **Rejection Node**: Handles rejection scenarios with contextual responses

All nodes generate dynamic, contextual responses using LLMs instead of hardcoded messages.

## Available Node Creators

### 1. `createHumanReviewNode`

Creates a node that interrupts the workflow to collect user feedback.

```typescript
const humanReview = createHumanReviewNode({
  nodeName: "strategyReview",
  llm: model,
  interruptType: "strategy_approval",
  reviewPromptTemplate: "Generate a natural question asking user to review the strategy",
  options: ["approve", "refine", "reject"],
  nextNode: "feedbackRouter"
});
```

**What you need to provide:**
- `nodeName`: Unique identifier for this node
- `llm`: Your configured LLM instance (e.g., ChatAnthropic, ChatOpenAI)
- `interruptType`: Type identifier for the interrupt payload
- `reviewPromptTemplate`: System prompt for generating the review question
- `options`: Array of expected user actions (optional)
- `nextNode`: Where to route after collecting feedback

### 2. `createFeedbackRouterNode`

Creates a node that analyzes user feedback and routes to appropriate handlers.

```typescript
const feedbackRouter = createFeedbackRouterNode({
  nodeName: "feedbackRouter",
  llm: model,
  intentPrompt: "Analyze user feedback to determine if they want to approve, refine, or reject",
  routingMap: {
    "approve": "approvalHandler",
    "refine": "analysisNode",
    "reject": "rejectionHandler"
  },
  defaultRoute: "analysisNode"
});
```

**What you need to provide:**
- `nodeName`: Unique identifier for this node
- `llm`: Your configured LLM instance
- `intentPrompt`: System prompt for analyzing user intent
- `routingMap`: Object mapping detected intents to node names
- `defaultRoute`: Fallback node if intent is unclear

### 3. `createApprovalNode`

Creates a node that handles approval scenarios with contextual responses.

```typescript
const approvalHandler = createApprovalNode({
  nodeName: "approvalHandler",
  llm: model,
  responsePrompt: "Generate an enthusiastic confirmation that the analysis is approved",
  nextNode: "nextPhase",
  stateUpdates: {
    status: "approved",
    approvalTimestamp: new Date().toISOString()
  }
});
```

**What you need to provide:**
- `nodeName`: Unique identifier for this node
- `llm`: Your configured LLM instance
- `responsePrompt`: System prompt for generating approval confirmation
- `nextNode`: Where to route after approval
- `stateUpdates`: Optional state changes to apply

### 4. `createRejectionNode`

Creates a node that handles rejection scenarios with understanding responses.

```typescript
const rejectionHandler = createRejectionNode({
  nodeName: "rejectionHandler",
  llm: model,
  responsePrompt: "Acknowledge the rejection and ask what they'd like to change",
  nextNode: "analysisNode",
  stateUpdates: {
    iterationCount: 0
  }
});
```

**What you need to provide:**
- `nodeName`: Unique identifier for this node
- `llm`: Your configured LLM instance
- `responsePrompt`: System prompt for generating rejection response
- `nextNode`: Where to route after rejection (usually back to analysis)
- `stateUpdates`: Optional state changes to apply

## Complete Example: RFP Analysis Flow

```typescript
import { ChatAnthropic } from "@langchain/anthropic";
import { 
  createHumanReviewNode,
  createFeedbackRouterNode,
  createApprovalNode,
  createRejectionNode
} from "@/lib/langgraph/common/hitl-nodes.js";

// Initialize your LLM
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3
});

// Create the review node
export const humanReview = createHumanReviewNode({
  nodeName: "rfpReview",
  llm: model,
  interruptType: "rfp_analysis_review",
  reviewPromptTemplate: "Ask the user to review the RFP analysis naturally",
  options: ["approve", "refine", "reject"],
  nextNode: "feedbackRouter"
});

// Create the feedback router
export const feedbackRouter = createFeedbackRouterNode({
  nodeName: "feedbackRouter",
  llm: model,
  intentPrompt: `Analyze the user's feedback about the RFP analysis.
    Determine if they want to:
    - approve: They're satisfied with the analysis
    - refine: They want changes or improvements
    - reject: They want to start over`,
  routingMap: {
    "approve": "approvalHandler",
    "refine": "rfpAnalyzer",
    "reject": "rejectionHandler"
  },
  defaultRoute: "rfpAnalyzer"
});

// Create approval handler
export const approvalHandler = createApprovalNode({
  nodeName: "approvalHandler",
  llm: model,
  responsePrompt: "Confirm the RFP analysis is approved. Be professional and enthusiastic.",
  nextNode: "researchPlanning",
  stateUpdates: {
    rfpStatus: "approved",
    approvedAt: new Date().toISOString()
  }
});

// Create rejection handler
export const rejectionHandler = createRejectionNode({
  nodeName: "rejectionHandler",
  llm: model,
  responsePrompt: "Acknowledge they want to restart the analysis. Ask what to focus on.",
  nextNode: "rfpAnalyzer"
});
```

## State Requirements

Your state type must include a `messages` array of `BaseMessage` objects:

```typescript
interface YourStateType {
  messages: BaseMessage[];
  // ... other state properties
}
```

## Best Practices

1. **Prompt Engineering**: Write clear, specific prompts that guide the LLM to generate appropriate responses
2. **Intent Mapping**: Keep your routing intents simple and distinct (approve/refine/reject)
3. **State Updates**: Use state updates to track workflow progress and decisions
4. **Error Handling**: The default route in feedback router handles unclear intents
5. **Natural Language**: Let the LLM generate contextual responses instead of hardcoding

## Customization Tips

- **Tone Control**: Adjust responsePrompt to control tone (professional, friendly, technical)
- **Context Awareness**: The utilities automatically include conversation history for context
- **Multi-language**: Add language preferences to your prompts for internationalization
- **Custom Routing**: Extend routingMap to handle more nuanced user intents

## Troubleshooting

**Issue**: Router always picks the default route
- **Solution**: Make your intentPrompt more specific about detecting keywords

**Issue**: Responses feel generic
- **Solution**: Include more context in your prompts about the specific domain

**Issue**: State updates not applying
- **Solution**: Ensure your state type matches and spread operators are used correctly