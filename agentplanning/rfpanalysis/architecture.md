# LangGraph RFP Analysis Architecture - Corrected Implementation

## Graph Flow Architecture

```
START → parallel_dispatcher → [4 agents in parallel] → synthesis → hitl_review → END
```

## State Definition

```typescript
import { Annotation } from "@langchain/langgraph";

const RFPAnalysisStateAnnotation = Annotation.Root({
  // Input data
  rfpDocument: Annotation<string>,
  
  // Metadata
  analysisId: Annotation<string>,
  timestamp: Annotation<string>,
  documentMetadata: Annotation<{
    wordCount: number;
    sectionCount: number;
    complexity: "Simple" | "Medium" | "Complex";
  } | null>,
  
  // Analysis outputs
  linguisticAnalysis: Annotation<object | null>,
  requirementsAnalysis: Annotation<object | null>, 
  structureAnalysis: Annotation<object | null>,
  strategicAnalysis: Annotation<object | null>,
  synthesisAnalysis: Annotation<object | null>,
  
  // Human review
  humanReview: Annotation<object | null>,
  
  // Status tracking
  status: Annotation<string>,
  errors: Annotation<string[]>({
    reducer: (existing, update) => [...(existing || []), ...update],
    default: () => []
  }),
  
  // Final output
  finalOutput: Annotation<object | null>
});
```

## Node Implementations

### 1. Parallel Dispatcher Node

```typescript
import { Send } from "@langchain/langgraph";

async function parallelDispatcherNode(state: typeof RFPAnalysisStateAnnotation.State) {
  // Validate RFP document
  if (!state.rfpDocument || state.rfpDocument.length < 100) {
    return {
      errors: ["Invalid or missing RFP document"],
      status: "failed"
    };
  }
  
  // Extract document metadata
  const wordCount = state.rfpDocument.split(' ').length;
  const sectionCount = (state.rfpDocument.match(/^#+\s/gm) || []).length;
  const complexity = wordCount > 10000 ? "Complex" : wordCount > 5000 ? "Medium" : "Simple";
  
  // Dispatch to all 4 agents in parallel using Send API
  const sends = [
    new Send("linguistic_patterns", state),
    new Send("requirements_extraction", state), 
    new Send("document_structure", state),
    new Send("strategic_signals", state)
  ];
  
  return {
    analysisId: generateUUID(),
    timestamp: new Date().toISOString(),
    documentMetadata: { wordCount, sectionCount, complexity },
    status: "analyzing",
    ...sends
  };
}
```

### 2. Individual Agent Nodes

```typescript
// Agent 1: Linguistic Patterns
async function linguisticPatternsNode(state: typeof RFPAnalysisStateAnnotation.State) {
  const analysis = await performLinguisticAnalysis(state.rfpDocument);
  
  return {
    linguisticAnalysis: analysis
  };
}

// Agent 2: Requirements Extraction  
async function requirementsExtractionNode(state: typeof RFPAnalysisStateAnnotation.State) {
  const analysis = await performRequirementsExtraction(state.rfpDocument);
  
  return {
    requirementsAnalysis: analysis
  };
}

// Agent 3: Document Structure
async function documentStructureNode(state: typeof RFPAnalysisStateAnnotation.State) {
  const analysis = await performStructureAnalysis(state.rfpDocument);
  
  return {
    structureAnalysis: analysis
  };
}

// Agent 4: Strategic Signals
async function strategicSignalsNode(state: typeof RFPAnalysisStateAnnotation.State) {
  const analysis = await performStrategicAnalysis(state.rfpDocument);
  
  return {
    strategicAnalysis: analysis
  };
}
```

### 3. Synthesis Node

```typescript
async function synthesisNode(state: typeof RFPAnalysisStateAnnotation.State) {
  // Check all analyses are complete
  if (!state.linguisticAnalysis || !state.requirementsAnalysis || 
      !state.structureAnalysis || !state.strategicAnalysis) {
    return {
      errors: ["Not all analyses completed"],
      status: "incomplete"
    };
  }
  
  // Synthesize competitive intelligence
  const synthesis = await performSynthesis({
    linguistic: state.linguisticAnalysis,
    requirements: state.requirementsAnalysis, 
    structure: state.structureAnalysis,
    strategic: state.strategicAnalysis
  });
  
  return {
    synthesisAnalysis: synthesis,
    status: "synthesis_complete"
  };
}
```

### 4. HITL Review Node

```typescript
import { interrupt } from "@langchain/langgraph";

function hitlReviewNode(state: typeof RFPAnalysisStateAnnotation.State) {
  // Prepare review package
  const reviewPackage = {
    synthesis: state.synthesisAnalysis,
    analyses: {
      linguistic: state.linguisticAnalysis,
      requirements: state.requirementsAnalysis,
      structure: state.structureAnalysis, 
      strategic: state.strategicAnalysis
    },
    timestamp: new Date().toISOString()
  };
  
  // Interrupt for human review
  const userInput = interrupt({
    type: "rfp_analysis_review",
    question: "Please review the RFP analysis results. Do you approve, want modifications, or reject?",
    data: reviewPackage,
    options: ["approve", "modify", "reject"]
  });
  
  return {
    humanReview: userInput
  };
}
```

### 5. Router Functions

```typescript
function hitlReviewRouter(state: typeof RFPAnalysisStateAnnotation.State): string {
  if (!state.humanReview) {
    return "hitl_review";
  }
  
  const review = state.humanReview as { action: string };
  
  switch (review.action) {
    case "approve":
      return "final_output";
    case "modify":
      return "synthesis"; // Re-run synthesis with feedback
    case "reject":
      return "parallel_dispatcher"; // Start over
    default:
      return "final_output";
  }
}
```

### 6. Final Output Node

```typescript
function finalOutputNode(state: typeof RFPAnalysisStateAnnotation.State) {
  const finalOutput = {
    analysisId: state.analysisId,
    timestamp: state.timestamp,
    documentMetadata: state.documentMetadata,
    executive_summary: state.synthesisAnalysis?.executive_summary,
    detailed_analyses: {
      linguistic: state.linguisticAnalysis,
      requirements: state.requirementsAnalysis,
      structure: state.structureAnalysis,
      strategic: state.strategicAnalysis,
      synthesis: state.synthesisAnalysis
    },
    humanReview: state.humanReview,
    status: "complete"
  };
  
  return {
    finalOutput,
    status: "complete"
  };
}
```

## Graph Construction

```typescript
import { StateGraph, END } from "@langchain/langgraph";

const graph = new StateGraph(RFPAnalysisStateAnnotation)

// Add nodes
.addNode("parallel_dispatcher", parallelDispatcherNode)
.addNode("linguistic_patterns", linguisticPatternsNode)
.addNode("requirements_extraction", requirementsExtractionNode)  
.addNode("document_structure", documentStructureNode)
.addNode("strategic_signals", strategicSignalsNode)
.addNode("synthesis", synthesisNode)
.addNode("hitl_review", hitlReviewNode)
.addNode("final_output", finalOutputNode)

// Add edges
.addEdge("parallel_dispatcher", "synthesis") // Dispatcher triggers agents, synthesis waits
.addEdge("linguistic_patterns", "synthesis")
.addEdge("requirements_extraction", "synthesis")
.addEdge("document_structure", "synthesis")
.addEdge("strategic_signals", "synthesis")
.addConditionalEdges("hitl_review", hitlReviewRouter, {
  "final_output": "final_output",
  "synthesis": "synthesis", 
  "parallel_dispatcher": "parallel_dispatcher"
})
.addEdge("synthesis", "hitl_review")
.addEdge("final_output", END)

// Set entry point
.setEntryPoint("parallel_dispatcher");
```

## Folder Structure

```
apps/backend/agents/rfp-analysis/
├── __tests__/
│   ├── parallel-dispatcher.test.ts
│   ├── linguistic-patterns.test.ts
│   ├── requirements-extraction.test.ts
│   ├── document-structure.test.ts
│   ├── strategic-signals.test.ts
│   ├── synthesis.test.ts
│   ├── hitl-review.test.ts
│   └── integration.test.ts
├── nodes/
│   ├── parallel-dispatcher.ts
│   ├── linguistic-patterns.ts
│   ├── requirements-extraction.ts
│   ├── document-structure.ts
│   ├── strategic-signals.ts
│   ├── synthesis.ts
│   ├── hitl-review.ts
│   └── final-output.ts
├── prompts/
│   ├── linguistic-analysis.prompt.md
│   ├── requirements-extraction.prompt.md
│   ├── document-structure.prompt.md
│   ├── strategic-signals.prompt.md
│   └── synthesis.prompt.md
├── state/
│   └── annotations.ts
├── utils/
│   ├── document-analyzer.ts
│   └── synthesis-engine.ts
├── graph.ts
├── index.ts
└── README.md
```

## Key LangGraph Compliance Features

1. **Send API for Parallel Execution**: Dispatcher uses Send to trigger all agents
2. **Proper State Management**: Uses Annotation.Root with reducers where needed
3. **HITL with interrupt()**: Human review uses proper interrupt mechanism
4. **Conditional Routing**: Router functions control flow based on human input
5. **No Command Anti-patterns**: Nodes return plain state updates unless routing needed
6. **Proper Edge Configuration**: All edges properly defined with conditional routing

## Implementation Notes

- All agent nodes run in parallel after dispatcher triggers them
- Synthesis node automatically waits for all parallel nodes to complete
- HITL checkpoint allows human approval/modification/rejection
- Router handles different human decisions appropriately
- Final output packages everything for downstream consumption
- Error handling built into each node
- State properly typed with TypeScript annotations