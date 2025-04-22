# Chat Router Integration Plan

This document outlines the steps needed to integrate a natural language chat router into the proposal generation system, allowing users to control the workflow through conversational interactions.

## 1. State Schema Updates

First, we need to extend the `OverallProposalState` to include chat-related fields:

```typescript
// In state/proposal.state.ts
import { BaseMessage } from "@langchain/core/messages";

export interface OverallProposalState {
  // Existing fields...

  // New fields for chat functionality
  messages: BaseMessage[];
  commandAction?: string;
  commandDetails?: {
    targetSection?: string;
    feedback?: string;
    confidence?: number;
  };
}
```

## 2. State Annotation Updates

Update the state annotation to include reducers for the new fields:

```typescript
// In state/modules/annotations.ts
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

export const OverallProposalStateAnnotation = Annotation.Root({
  // Existing fields...

  // Add messages channel with the messagesStateReducer
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),

  // Simple value fields
  commandAction: Annotation<string>(),
  commandDetails: Annotation<{
    targetSection?: string;
    feedback?: string;
    confidence?: number;
  }>(),
});
```

## 3. Create Chat Router Node

Implement the chat router in a new file `agents/proposal-generation/nodes/chatRouter.ts`:

```typescript
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ProcessingStatus } from "../../../state/modules/constants.js";
import { SectionType } from "../../../state/modules/types.js";
import { ENV } from "../../../lib/config/env.js";

// Define the command schema with descriptive names that map clearly to our system
const commandSchema = z.object({
  command: z
    .enum([
      "load_rfp_document",
      "start_background_research",
      "funder_solution_sought", // Instead of "solution_content"
      "map_content_connections",
      "create_executive_summary",
      "define_problem_statement",
      "our_proposed_solution", // Instead of just "solution"
      "detail_implementation_plan",
      "outline_evaluation_approach",
      "write_conclusion",
      "develop_budget",
      "approve_content",
      "revise_content",
      "continue_workflow",
      "check_current_status",
      "need_clarification",
      "general_question",
    ])
    .describe("The command that best matches the user's intent"),
  targetSection: z
    .string()
    .optional()
    .describe("The specific section this command applies to, if any"),
  feedback: z
    .string()
    .optional()
    .describe("Any feedback or content provided by the user"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("How confident you are about this interpretation (0-1)"),
});

// Create intent interpretation tool
const interpretIntentTool = tool(
  async ({ userMessage, currentState }) => {
    // This function is just a structured way for the LLM to output its interpretation
    return "Intent interpreted";
  },
  {
    name: "interpret_user_intent",
    description:
      "Determine what action the user is trying to take based on their message",
    schema: z.object({
      userMessage: z.string().describe("The user's message to interpret"),
      currentState: z
        .record(z.any())
        .describe("Current workflow state for context"),
    }),
    returnType: commandSchema,
  }
);

// Function to determine available actions based on state
function getAvailableActions(state) {
  const actions = [];

  // Basic actions always available
  actions.push("check_current_status", "general_question");

  // Document loading only if not already loaded
  if (!state.documentLoaded) {
    actions.push("load_rfp_document");
  }

  // Research can be started after document loading
  if (
    state.documentLoaded &&
    state.researchStatus !== ProcessingStatus.APPROVED &&
    state.researchStatus !== ProcessingStatus.RUNNING
  ) {
    actions.push("start_background_research");
  }

  // Solution sought and connections based on state
  if (state.researchStatus === ProcessingStatus.APPROVED) {
    if (state.solutionStatus !== ProcessingStatus.APPROVED) {
      actions.push("funder_solution_sought");
    } else if (state.connectionsStatus !== ProcessingStatus.APPROVED) {
      actions.push("map_content_connections");
    }
  }

  // Add section-specific actions based on state
  if (state.sections instanceof Map) {
    state.sections.forEach((sectionData, sectionType) => {
      // Add specific section actions if they're not approved
      if (sectionData.status !== ProcessingStatus.APPROVED) {
        switch (sectionType) {
          case SectionType.EXECUTIVE_SUMMARY:
            actions.push("create_executive_summary");
            break;
          case SectionType.PROBLEM_STATEMENT:
            actions.push("define_problem_statement");
            break;
          case SectionType.SOLUTION:
            actions.push("our_proposed_solution");
            break;
          case SectionType.IMPLEMENTATION_PLAN:
            actions.push("detail_implementation_plan");
            break;
          case SectionType.EVALUATION:
            actions.push("outline_evaluation_approach");
            break;
          case SectionType.CONCLUSION:
            actions.push("write_conclusion");
            break;
          case SectionType.BUDGET:
            actions.push("develop_budget");
            break;
        }
      }
    });
  }

  // Approval/revision available when interrupted for review
  if (state.interruptStatus?.isInterrupted) {
    actions.push("approve_content", "revise_content");

    // Add context about what's being reviewed
    const interruptNodeId = state.interruptMetadata?.nodeId || "";
    if (interruptNodeId.startsWith("evaluateSection_")) {
      const sectionType = interruptNodeId.replace("evaluateSection_", "");
      actions.push(`reviewing_section:${sectionType}`);
    } else if (interruptNodeId.includes("research")) {
      actions.push("reviewing_background_research");
    } else if (interruptNodeId.includes("solution")) {
      actions.push("reviewing_solution_analysis");
    }
  }

  return actions;
}

/**
 * Chat router node implementation for handling user messages and determining intent
 * @param state Current proposal state
 * @returns Updated state with AI response and potential command action
 */
export async function chatRouterNode(state) {
  // Extract the latest human message
  const messages = state.messages || [];
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || !(lastMessage instanceof HumanMessage)) {
    return {
      messages: [
        new AIMessage(
          "Welcome to the proposal generation assistant. How can I help you today?"
        ),
      ],
    };
  }

  // Create the state snapshot for the LLM
  const stateSnapshot = {
    documentLoaded: state.documentLoaded,
    rfpId: state.rfpId,
    researchStatus: state.researchStatus,
    solutionStatus: state.solutionStatus,
    connectionsStatus: state.connectionsStatus,
    sectionStatuses: state.sections
      ? Object.fromEntries(
          Array.from(state.sections.entries()).map(([id, data]) => [
            id,
            data.status,
          ])
        )
      : {},
    awaitingInput: state.interruptStatus?.isInterrupted || false,
    interruptContext: state.interruptMetadata,
    status: state.status,
    errors: state.errors || [],
  };

  // Get available actions for this state
  const availableActions = getAvailableActions(state);

  // Create system prompt with workflow knowledge and available actions
  const systemPrompt = new SystemMessage(`
You are a proposal generation assistant that helps users navigate through the proposal creation process.

WORKFLOW STAGES:
1. Document Loading - Loading an RFP (Request for Proposal) document
2. Background Research - Conducting deep research on the topic and funder
3. Funder Solution Analysis - Understanding what solution the funder is seeking
4. Connection Mapping - Mapping relationships between different proposal elements
5. Section Generation - Creating each proposal section:
   - Executive Summary
   - Problem Statement
   - Our Proposed Solution
   - Implementation Plan
   - Evaluation Approach
   - Organizational Capacity
   - Budget
   - Conclusion

CURRENT STATE:
${JSON.stringify(stateSnapshot, null, 2)}

AVAILABLE ACTIONS:
${availableActions.join("\n")}

You should:
1. Help the user understand where they are in the workflow
2. Explain what actions they can take next
3. Interpret their intent accurately, even when expressed indirectly
4. Ask for clarification when their intent is ambiguous

IMPORTANT: You have the ability to analyze the user's message and determine which command they intend to execute.
For example, if they say "looks good to me" while reviewing a section, that means they want to "approve_content".
Use the interpret_user_intent tool to explicitly identify the command.
`);

  // Combine messages for the LLM
  const contextualizedMessages = [systemPrompt, ...messages];

  // Create the model with tool binding
  const model = new ChatAnthropic({
    model: ENV.LLM_MODEL || "claude-3-5-sonnet-20240620",
    temperature: 0.3,
    apiKey: ENV.ANTHROPIC_API_KEY,
  }).bindTools([interpretIntentTool]);

  // Get response from LLM with potential tool calls
  const response = await model.invoke(contextualizedMessages);

  // Extract command from tool calls if present
  let commandAction = null;
  let commandDetails = null;

  if (response.tool_calls && response.tool_calls.length > 0) {
    // Find the intent interpretation tool call
    const intentToolCall = response.tool_calls.find(
      (call) => call.name === "interpret_user_intent"
    );

    if (intentToolCall) {
      try {
        const args = JSON.parse(intentToolCall.args);
        const result = JSON.parse(intentToolCall.output);

        // Extract the command and details
        commandAction = result.command;
        commandDetails = {
          targetSection: result.targetSection,
          feedback: result.feedback,
          confidence: result.confidence,
        };

        // If confidence is low, treat as need_clarification
        if (
          result.confidence < 0.7 &&
          result.command !== "need_clarification"
        ) {
          commandAction = "need_clarification";
        }
      } catch (error) {
        console.error("Error parsing tool call result:", error);
      }
    }
  }

  // Return updated state
  return {
    messages: [...messages, response],
    commandAction,
    commandDetails: commandDetails || {},
  };
}
```

## 4. Add Route Function

Create a conditional routing function in `agents/proposal-generation/conditionals.ts`:

```typescript
import { SectionType } from "../../state/modules/types.js";
import { NODES } from "./constants.js";

/**
 * Maps our descriptive command names to actual node names in the graph
 */
const COMMAND_TO_NODE_MAP = {
  load_rfp_document: NODES.DOC_LOADER,
  start_background_research: NODES.DEEP_RESEARCH,
  funder_solution_sought: NODES.SOLUTION_SOUGHT,
  map_content_connections: NODES.CONNECTION_PAIRS,
  create_executive_summary: NODES.EXEC_SUMMARY,
  define_problem_statement: NODES.PROB_STATEMENT,
  our_proposed_solution: NODES.SOLUTION,
  detail_implementation_plan: NODES.IMPL_PLAN,
  outline_evaluation_approach: NODES.EVALUATION,
  write_conclusion: NODES.CONCLUSION,
  develop_budget: NODES.BUDGET,
  process_feedback: NODES.PROCESS_FEEDBACK,
  chatRouter: "chatRouter",
};

/**
 * Routes from the chat router node to the appropriate next node
 * @param state Current proposal state
 * @returns Next node name based on command action
 */
export function routeFromChat(state) {
  if (!state.commandAction) {
    return "chatRouter"; // Stay in chat if no command identified
  }

  // Map each command to the appropriate node in the graph
  switch (state.commandAction) {
    case "load_rfp_document":
      return NODES.DOC_LOADER;

    case "start_background_research":
      return NODES.DEEP_RESEARCH;

    case "funder_solution_sought":
      return NODES.SOLUTION_SOUGHT;

    case "map_content_connections":
      return NODES.CONNECTION_PAIRS;

    // Map section commands to section nodes
    case "create_executive_summary":
      return NODES.EXEC_SUMMARY;

    case "define_problem_statement":
      return NODES.PROB_STATEMENT;

    case "our_proposed_solution":
      return NODES.SOLUTION;

    case "detail_implementation_plan":
      return NODES.IMPL_PLAN;

    case "outline_evaluation_approach":
      return NODES.EVALUATION;

    case "develop_budget":
      return NODES.BUDGET;

    case "write_conclusion":
      return NODES.CONCLUSION;

    // Feedback handling
    case "approve_content":
    case "revise_content":
      if (state.interruptStatus?.isInterrupted) {
        return NODES.PROCESS_FEEDBACK;
      }
      break;

    case "continue_workflow":
      if (state.interruptStatus?.isInterrupted) {
        return NODES.PROCESS_FEEDBACK;
      }
      return "chatRouter";

    // These don't change the workflow
    case "need_clarification":
    case "check_current_status":
    case "general_question":
      return "chatRouter";
  }

  // Default - stay in chat
  return "chatRouter";
}
```

## 5. Update Graph Structure

Modify `agents/proposal-generation/graph.ts` to include the chat router:

```typescript
// Add import for chat router
import { chatRouterNode } from "./nodes/chatRouter.js";
import { routeFromChat } from "./conditionals.js";

// Update NODES to include chat router
const NODES = {
  // Existing nodes...
  CHAT_ROUTER: "chatRouter",
  // ...
} as const;

// Add chat router node
proposalGenerationGraph.addNode(NODES.CHAT_ROUTER, chatRouterNode);

// Add edge from start to chat router
// This makes the chat router the initial entry point
(proposalGenerationGraph as any).addEdge("__start__", NODES.CHAT_ROUTER);

// Add conditional edges from chat router
(proposalGenerationGraph as any).addConditionalEdges(
  NODES.CHAT_ROUTER,
  routeFromChat,
  {
    // Define all potential destinations
    documentLoader: NODES.DOC_LOADER,
    deepResearch: NODES.DEEP_RESEARCH,
    solutionSought: NODES.SOLUTION_SOUGHT,
    connectionPairs: NODES.CONNECTION_PAIRS,
    generateExecutiveSummary: NODES.EXEC_SUMMARY,
    generateProblemStatement: NODES.PROB_STATEMENT,
    generateSolution: NODES.SOLUTION,
    generateImplementationPlan: NODES.IMPL_PLAN,
    generateEvaluation: NODES.EVALUATION,
    generateOrganizationalCapacity: NODES.ORG_CAPACITY,
    generateBudget: NODES.BUDGET,
    generateConclusion: NODES.CONCLUSION,
    process_feedback: NODES.PROCESS_FEEDBACK,
    chatRouter: NODES.CHAT_ROUTER,
  }
);

// Add edges from other nodes back to chat router
// This ensures we return to chat after operations complete
// Add after each major operation to return to chat interface
(proposalGenerationGraph as any).addEdge(NODES.DOC_LOADER, NODES.CHAT_ROUTER);
(proposalGenerationGraph as any).addEdge(
  NODES.EVAL_RESEARCH,
  NODES.CHAT_ROUTER
);
(proposalGenerationGraph as any).addEdge(
  NODES.EVAL_SOLUTION,
  NODES.CHAT_ROUTER
);
(proposalGenerationGraph as any).addEdge(
  NODES.EVAL_CONNECTIONS,
  NODES.CHAT_ROUTER
);
```

## 6. Update OrchestratorService

Add methods to handle chat interactions in `services/orchestrator.service.ts`:

```typescript
/**
 * Adds a user message to the conversation
 *
 * @param threadId The thread ID for the proposal
 * @param message The user message
 * @returns Updated state with added message
 */
async addUserMessage(
  threadId: string,
  message: string
): Promise<OverallProposalState> {
  // Get current state
  const state = await this.getState(threadId);

  // Create the human message
  const humanMessage = new HumanMessage(message);

  // Update state with new message
  const config: RunnableConfig = { configurable: { thread_id: threadId } };

  // Cast to CompiledStateGraph to access proper methods
  const compiledGraph = this.graph as CompiledStateGraph<
    OverallProposalState,
    Partial<OverallProposalState>,
    "__start__"
  >;

  // Update state with the new message
  await compiledGraph.updateState(config, {
    messages: [humanMessage]
  });

  // Now invoke the graph to process the message
  const result = await compiledGraph.invoke({}, config);

  return result;
}

/**
 * Processes a chat message and returns the response
 *
 * @param threadId The thread ID for the proposal
 * @param message The user message
 * @returns The AI response
 */
async processChatMessage(
  threadId: string,
  message: string
): Promise<{ response: string, commandExecuted: boolean }> {
  try {
    // Add the message and process through the graph
    const updatedState = await this.addUserMessage(threadId, message);

    // Check if a command was executed
    const commandExecuted = updatedState.commandAction !== undefined &&
                          updatedState.commandAction !== "check_current_status" &&
                          updatedState.commandAction !== "need_clarification" &&
                          updatedState.commandAction !== "general_question";

    // Get the AI response from the last message
    const messages = updatedState.messages || [];
    const lastMessage = messages[messages.length - 1];

    if (lastMessage instanceof AIMessage) {
      return {
        response: lastMessage.content.toString(),
        commandExecuted
      };
    }

    return {
      response: "I'm not sure how to respond to that.",
      commandExecuted: false
    };
  } catch (error) {
    this.logger.error(`Error processing chat message: ${error}`);
    throw error;
  }
}
```

## 7. Add API Endpoint

Add a chat endpoint in your API:

```typescript
// In api/rfp/index.ts

// Add chat endpoint
router.post("/chat", async (req, res) => {
  try {
    const { threadId, message } = req.body;

    if (!threadId) {
      return res.status(400).json({ error: "Missing threadId" });
    }

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    // Process the chat message
    const result = await orchestratorService.processChatMessage(
      threadId,
      message
    );

    res.json(result);
  } catch (error) {
    console.error("Error processing chat message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

## 8. Initialize with Default Messages

Update the `startProposalGeneration` method to include a welcome message:

```typescript
async startProposalGeneration(
  // ...existing code
): Promise<{ threadId: string; state: OverallProposalState }> {
  // ...existing code

  // Add welcome message
  initialState.messages = [
    new AIMessage("Welcome to the proposal generation assistant. I'll help you create a compelling proposal based on the RFP. Would you like to start by loading a document, or do you have any questions about the process?")
  ];

  // ...remaining code
}
```

## Integration with Current Orchestrator

The current `OrchestratorService` already provides:

1. **State persistence** through the checkpointer
2. **Interrupt handling** for human-in-the-loop approvals
3. **Feedback processing** and workflow resumption
4. **Dependency management** between proposal sections

This chat router integration complements the existing system by:

1. Acting as a conversational entry point for the entire graph
2. Providing natural language control over the workflow
3. Translating user intentions into specific graph operations
4. Guiding users through the process with context-aware assistance
5. Returning control to the chat interface after automated steps complete

The integration maintains the original architecture while adding a more accessible and intuitive user experience.

## Implementation Steps

1. Create or update the state interfaces and annotations
2. Implement the chat router node and routing function
3. Update the graph structure to include the chat router
4. Add the OrchestratorService methods for chat handling
5. Create the API endpoint for chat interactions
6. Add welcome messages to proposal initialization
7. Test the integration with various user inputs

This approach provides a natural language interface to the proposal generation workflow while preserving all the existing functionality and architectural patterns.
