# LangGraph Interrupt System Guide

This document provides guidance for implementing and extending the reusable interrupt system in our chat UI.

## Overview

The interrupt system enables Human-in-the-Loop (HITL) workflows by pausing LangGraph execution and presenting interactive UI components to users. The system is designed to be fully reusable and type-safe for any interrupt type.

## Architecture

### Core Components

1. **StreamProvider** - Manages LangGraph useStream hook and interrupt state
2. **GenericInterruptHandler** - Routes interrupts to appropriate UI components
3. **Specific Interrupt Components** - Custom UI for each interrupt type (e.g., RFPSynthesisInterrupt)
4. **Thread Component** - Integrates interrupt handling into chat flow

### Type System

```typescript
// Base type for ALL interrupt types
export type BaseInterruptPayload = {
  type: string;           // Unique identifier for interrupt type
  question: string;       // Question/prompt to display to user
  options: string[];      // Available action options
  timestamp: string;      // When interrupt was created
  nodeName: string;       // LangGraph node that triggered interrupt
  [key: string]: any;     // Additional data specific to interrupt type
};

// Example: Specific interrupt type
export type SynthesisInterruptPayload = BaseInterruptPayload & {
  type: 'rfp_analysis_review';
  synthesisData: any;     // RFP-specific data
};
```

## Backend Implementation

### Creating an Interrupt

In your LangGraph node:

```typescript
import { interrupt } from "@langchain/langgraph";

function myAnalysisNode(state) {
  // Perform analysis...
  const analysisResults = performAnalysis(state);
  
  // Create interrupt with structured payload
  const userInput = interrupt({
    type: "analysis_review",           // Unique type identifier
    question: "Please review the analysis results",
    options: ["approve", "modify", "reject"],
    timestamp: new Date().toISOString(),
    nodeName: "analysisReview",
    analysisData: analysisResults      // Custom data for this interrupt type
  });
  
  // Handle user response
  return new Command({
    goto: getNextNode(userInput),
    update: { userFeedback: userInput }
  });
}
```

### Resume Pattern

Users respond with natural language that gets parsed on the backend:

```typescript
// User types natural language response in chat input
// Backend automatically parses: "looks good" → { action: "approve" }
// Backend automatically parses: "please add more detail to section 3" → { action: "modify", feedback: "..." }
await submit(undefined, { command: { resume: naturalLanguageInput } });
```

The system includes powerful natural language parsing utilities that convert user responses like:
- "looks good" → `approve`
- "change the risks section" → `modify` with specific feedback
- "start over" → `reject`

## Frontend Implementation

The frontend automatically handles all interrupt types through natural language input. No custom components are needed for new interrupt types.

### How It Works

1. **Interrupt Display**: When an interrupt occurs, the system displays it as a notification in the chat
2. **Natural Language Input**: Users type their response naturally in the chat input box
3. **Backend Parsing**: The response is sent to backend parsers that extract intent and actions
4. **Automatic Resume**: The flow resumes based on the parsed intent

### Adding a New Interrupt Type (Backend Only)

#### Step 1: Define the Parser Schema

Create a Zod schema for your interrupt response in `interrupt-response-parser.ts`:

```typescript
export const MyCustomResponseSchema = z.object({
  action: z.enum(["approve", "modify", "reject"]).describe("The user's decision"),
  confidence: z.number().min(0).max(1).describe("Confidence in parsing accuracy"),
  feedback: z.string().optional().describe("Specific feedback from user"),
  reasoning: z.string().describe("Brief explanation of why this action was chosen"),
  // Add custom fields specific to your interrupt type
  priority: z.enum(["high", "medium", "low"]).optional(),
});
```

#### Step 2: Create Enhanced HITL Flow

Use the enhanced HITL utilities:

```typescript
import { createEnhancedHumanReviewNode, createEnhancedFeedbackRouterNode } from "@/lib/langgraph/common/enhanced-hitl-nodes.js";

const myReviewFlow = {
  humanReview: createEnhancedHumanReviewNode({
    nodeName: "myReview",
    llm: model,
    interruptType: "my_custom_review",
    question: "Please review the results. What would you like to do?",
    options: ["approve", "modify", "reject"],
    nextNode: "myFeedbackRouter"
  }),
  
  feedbackRouter: createEnhancedFeedbackRouterNode({
    nodeName: "myFeedbackRouter",
    parserType: "generic", // or create a custom parser
    validActions: ["approve", "modify", "reject"],
    routingMap: {
      "approve": "approvalHandler",
      "modify": "modificationHandler", 
      "reject": "rejectionHandler"
    },
    defaultRoute: "modificationHandler"
  })
};
```

The frontend will automatically:
- Display the interrupt question
- Show available options as guidance
- Allow natural language responses
- Parse responses on the backend
- Resume the appropriate flow

## Best Practices

### UI Design

1. **Natural Flow**: Interrupts appear as part of the conversation flow, not separate modals
2. **Clear Guidance**: Show the question and available options to guide user responses
3. **Flexible Input**: Users can respond with natural language rather than clicking buttons
4. **Visual Indicators**: Use visual cues (colors, icons) to indicate interrupt state
5. **Responsive Design**: Ensure interrupt notifications work on mobile devices

### Data Handling

1. **Type Safety**: Always extend `BaseInterruptPayload` for new types
2. **Validation**: Validate interrupt data before displaying
3. **Fallback UI**: Provide graceful fallback for unknown interrupt types
4. **Serialization**: Ensure all interrupt data is JSON-serializable

### Backend Integration

1. **Structured Payloads**: Use structured interrupt payloads with clear questions and options
2. **Natural Language Parsing**: Use the enhanced HITL utilities for automatic response parsing
3. **Flexible Parsers**: Support confidence scoring and fallback parsing for unclear responses
4. **Error Recovery**: Implement graceful fallbacks when parsing fails
5. **State Updates**: Store both raw user feedback and parsed structured responses

## Common Patterns

### Simple Approval Interrupt

```typescript
// Backend - Using enhanced HITL utilities
const approvalFlow = createApprovalFlow({
  reviewNodeName: "approvalCheck",
  routerNodeName: "approvalRouter",
  approvalNodeName: "processApproval",
  rejectionNodeName: "processRejection", 
  changesNodeName: "processChanges",
  llm: model,
  question: "Do you approve this action?",
  contextExtractor: (state) => state.actionDescription
});

// User types naturally: "yes", "looks good", "no", "I don't approve"
// Backend automatically parses into approve/reject actions
```

### Feedback Collection Interrupt

```typescript
// Backend - RFP synthesis example
const rfpFlow = createRFPSynthesisReviewFlow({
  reviewNodeName: "humanReview",
  routerNodeName: "feedbackRouter",
  approvalNodeName: "approvalHandler",
  rejectionNodeName: "rejectionHandler",
  modificationNodeName: "rfpAnalyzer",
  llm: model
});

// User types naturally: 
// - "looks perfect, proceed"
// - "please add more detail to the risk section"  
// - "I don't like this approach, start over"
// Backend automatically parses into structured actions with feedback
```

### Multi-step Review Interrupt

```typescript
// Backend
const userInput = interrupt({
  type: "multi_step_review",
  question: "Review each section and provide overall decision",
  options: ["approve_all", "approve_partial", "reject_all"],
  timestamp: new Date().toISOString(),
  nodeName: "sectionReview",
  sections: sectionsToReview,
  currentStep: 1,
  totalSteps: 3
});

// Frontend - Show progress and section-by-section review
```

## Troubleshooting

### Interrupt Not Appearing

1. Check that interrupt payload is properly structured with required fields
2. Verify interrupt type is registered in `GenericInterruptHandler`
3. Ensure `StreamProvider` is properly configured
4. Check console for TypeScript errors

### Resume Not Working

1. Verify using `submit(undefined, { command: { resume: naturalLanguageInput } })` pattern
2. Check that backend parser handles the user's natural language input
3. Ensure proper error handling in parsing and resume submission
4. Verify thread state and authentication
5. Check that enhanced HITL nodes are being used instead of basic ones

### Parsing Issues

1. Check parser confidence scores in logs - low scores indicate unclear input
2. Verify fallback parsing is working for edge cases
3. Test with various natural language inputs to improve parser prompts
4. Ensure valid actions list matches routing map keys

### UI Issues

1. Check that interrupt notification displays correctly in chat flow
2. Verify input field is enabled during interrupts
3. Test responsive design on different screen sizes
4. Ensure interrupt guidance text is helpful and clear

## Migration Guide

### From Button-Based to Natural Language

Old pattern:
```typescript
// Frontend - Button-based responses
<Button onClick={() => onResume("approve")}>Approve</Button>
<Button onClick={() => onResume("reject")}>Reject</Button>

// Backend - Simple string handling
const userInput = interrupt("Please review the content");
```

New pattern:
```typescript
// Frontend - Natural language input (automatic)
// User types: "looks good" or "needs changes" or "reject this"

// Backend - Enhanced parsing with structured output
const reviewFlow = createRFPSynthesisReviewFlow({
  reviewNodeName: "contentReview",
  routerNodeName: "contentRouter", 
  approvalNodeName: "approvalHandler",
  rejectionNodeName: "rejectionHandler",
  modificationNodeName: "contentGenerator",
  llm: model
});
```

### Migration Steps

1. **Replace HITL Nodes**: Replace `createHumanReviewNode` and `createFeedbackRouterNode` with enhanced versions
2. **Remove Custom Interrupt Components**: Delete button-based interrupt UI components
3. **Update Documentation**: Update any documentation to reflect natural language approach
4. **Test Natural Language**: Test with various natural language inputs to ensure parsing works
5. **Gradual Rollout**: The system supports both patterns during transition

Benefits of Natural Language Approach:
- More natural user experience
- Handles nuanced feedback better
- Eliminates need for custom UI components
- Scales to any interrupt type automatically
- Better international/accessibility support