import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import {
  OrchestratorState,
  AgentType,
  WorkflowStatus,
  ErrorInfo,
} from "./state.js";
import { OrchestratorConfig, createDefaultConfig } from "./configuration.js";
import { z } from "zod";
import { AgentExecutor } from "@langchain/core/agents";
import { StateGraph, END } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { v4 as uuidv4 } from "uuid";

import {
  StepStatus,
  AgentRole,
  WorkflowStep,
  Workflow,
  getNextExecutableStep,
  isWorkflowCompleted,
  hasWorkflowFailed,
} from "./state.js";

import { ANALYZE_USER_QUERY_PROMPT } from "./prompt-templates.js";

/**
 * Class representing the OrchestratorNode
 * Handles core orchestration logic for coordinating different agents
 */
export class OrchestratorNode {
  private config: OrchestratorConfig;
  private llm: BaseLanguageModel;
  private logger: Console;

  /**
   * Create an OrchestratorNode
   * @param config The configuration for the orchestrator
   */
  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = createDefaultConfig(config);
    this.llm = this.config.llm;
    this.logger = console;

    if (this.config.debug) {
      this.logger.info(
        "OrchestratorNode initialized with config:",
        this.config
      );
    }
  }

  /**
   * Initialize the orchestrator with base configuration
   * @param state Current state
   * @returns Updated state with initialization values
   */
  async initialize(
    state: OrchestratorState
  ): Promise<Partial<OrchestratorState>> {
    // Set initial state values
    const now = new Date().toISOString();

    return {
      status: "init",
      metadata: {
        ...state.metadata,
        updatedAt: now,
        initialized: true,
      },
      config: {
        ...state.config,
        maxRetries: this.config.maxRetries,
        retryDelay: this.config.retryDelay,
        timeoutSeconds: this.config.timeoutSeconds,
      },
    };
  }

  /**
   * Analyze user input to determine which agent should handle it
   * @param state Current state
   * @returns Updated state with routing information
   */
  async analyzeUserInput(
    state: OrchestratorState
  ): Promise<Partial<OrchestratorState>> {
    try {
      const messages = state.messages;
      if (messages.length === 0) {
        this.logger.warn("No messages in state to analyze");
        return {};
      }

      // Get the latest user message
      const latestMessages = messages.slice(-3);
      const lastUserMessage = latestMessages.find(
        (m) => m instanceof HumanMessage
      ) as HumanMessage | undefined;

      if (!lastUserMessage) {
        this.logger.warn("No user message found to analyze");
        return {};
      }

      // Use LLM to classify the message and determine appropriate agent
      const routingSchema = z.object({
        agentType: z.enum([
          "proposal",
          "research",
          "solution_analysis",
          "evaluation",
        ]),
        reason: z
          .string()
          .describe("Explanation of why this agent was selected"),
        priority: z
          .number()
          .int()
          .min(1)
          .max(10)
          .describe("Priority level from 1-10"),
      });

      const systemPrompt = new SystemMessage(
        `You are an orchestrator that routes user requests to the appropriate agent.
         Available agents:
         - proposal: Handles generating full proposals, revisions, and final documents
         - research: Conducts background research on funder, topic, or requirements
         - solution_analysis: Analyzes requirements and develops solution approaches
         - evaluation: Evaluates proposal sections and provides improvement feedback
         
         Determine which agent should handle the user request based on the content.
         Return a JSON object with the following fields:
         - agentType: One of "proposal", "research", "solution_analysis", or "evaluation"
         - reason: Brief explanation of why you chose this agent
         - priority: Number from 1-10 indicating urgency (10 being highest)`
      );

      // Call LLM to determine routing
      const response = await this.llm.invoke([systemPrompt, ...latestMessages]);

      // Extract structured data from response
      let parsedResponse;
      try {
        // Extract JSON from response if it's embedded in text
        const content = response.content.toString();
        const jsonMatch =
          content.match(/```json\n([\s\S]*)\n```/) ||
          content.match(/\{[\s\S]*\}/);

        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        parsedResponse = JSON.parse(jsonStr.replace(/```json|```/g, "").trim());

        // Validate against schema
        parsedResponse = routingSchema.parse(parsedResponse);
      } catch (error) {
        this.logger.error("Failed to parse routing response:", error);
        // Default to proposal agent if parsing fails
        parsedResponse = {
          agentType: "proposal" as AgentType,
          reason: "Default routing due to parsing error",
          priority: 5,
        };
      }

      // Update state with routing decision
      return {
        currentAgent: parsedResponse.agentType,
        status: "in_progress",
        metadata: {
          ...state.metadata,
          updatedAt: new Date().toISOString(),
          lastRoutingReason: parsedResponse.reason,
          routingPriority: parsedResponse.priority,
        },
      };
    } catch (error) {
      // Handle error and return error state
      const errorInfo: ErrorInfo = {
        source: "analyzeUserInput",
        message: error.message || "Unknown error in user input analysis",
        timestamp: new Date().toISOString(),
        recoverable: true,
      };

      return {
        status: "error",
        errors: [errorInfo],
      };
    }
  }

  /**
   * Log and track an agent operation
   * @param state Current state
   * @param operation Operation details
   * @returns Updated state with logging information
   */
  async logOperation(
    state: OrchestratorState,
    operation: {
      type: string;
      agentType?: AgentType;
      threadId?: string;
      details?: Record<string, any>;
    }
  ): Promise<Partial<OrchestratorState>> {
    if (!this.config.debug) {
      return {};
    }

    const now = new Date().toISOString();
    const logEntry = {
      timestamp: now,
      ...operation,
    };

    this.logger.info("Orchestrator operation:", logEntry);

    return {
      metadata: {
        ...state.metadata,
        updatedAt: now,
        lastOperation: logEntry,
        operationHistory: [
          ...(state.metadata.operationHistory || []),
          logEntry,
        ].slice(-10), // Keep last 10 operations
      },
    };
  }

  /**
   * Handle error that occurred during orchestration
   * @param state Current state
   * @param error Error information
   * @returns Updated state with error handling
   */
  async handleError(
    state: OrchestratorState,
    error: Omit<ErrorInfo, "timestamp">
  ): Promise<Partial<OrchestratorState>> {
    const now = new Date().toISOString();
    const errorInfo: ErrorInfo = {
      ...error,
      timestamp: now,
    };

    this.logger.error("Orchestrator error:", errorInfo);

    // If the error is recoverable and under max retries, attempt recovery
    if (
      errorInfo.recoverable &&
      (errorInfo.retryCount || 0) < (state.config.maxRetries || 3)
    ) {
      const retryCount = (errorInfo.retryCount || 0) + 1;

      return {
        errors: [{ ...errorInfo, retryCount }],
        metadata: {
          ...state.metadata,
          updatedAt: now,
          lastError: errorInfo,
          retryAttempt: retryCount,
        },
      };
    }

    // Otherwise, update state to error status
    return {
      status: "error",
      errors: [errorInfo],
      metadata: {
        ...state.metadata,
        updatedAt: now,
        lastError: errorInfo,
      },
    };
  }

  /**
   * Track a thread ID for a specific agent
   * @param state Current state
   * @param agentType Type of agent
   * @param threadId Thread ID to track
   * @returns Updated state with thread tracking
   */
  async trackAgentThread(
    state: OrchestratorState,
    agentType: AgentType,
    threadId: string
  ): Promise<Partial<OrchestratorState>> {
    return {
      agentThreads: {
        ...state.agentThreads,
        [agentType]: threadId,
      },
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Route a message to a specific agent
   * @param state Current state
   * @param agentType Type of agent to route to
   * @param message Message to route
   * @returns Updated state with routed message
   */
  async routeToAgent(
    state: OrchestratorState,
    agentType: AgentType,
    message: HumanMessage
  ): Promise<Partial<OrchestratorState>> {
    // Add message to pending inputs for the specified agent
    const pendingInputs = {
      ...state.pendingUserInputs,
    };

    pendingInputs[agentType] = [...(pendingInputs[agentType] || []), message];

    return {
      pendingUserInputs: pendingInputs,
      currentAgent: agentType,
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
        lastRoutedAgent: agentType,
      },
    };
  }
}

/**
 * Factory function to create OrchestratorNode instance
 * @param config Configuration options
 * @returns OrchestratorNode instance
 */
export function createOrchestratorNode(
  config?: Partial<OrchestratorConfig>
): OrchestratorNode {
  return new OrchestratorNode(config);
}

/**
 * Analyzes the user query to determine the next action
 */
export async function analyzeUserQuery(
  state: OrchestratorState
): Promise<OrchestratorState> {
  if (!state.lastUserQuery) {
    return {
      ...state,
      errors: [...state.errors, "No user query provided to analyze"],
    };
  }

  try {
    const llm = new ChatOpenAI({
      modelName: "gpt-4-turbo",
      temperature: 0.2,
    });

    const prompt = ChatPromptTemplate.fromTemplate(ANALYZE_USER_QUERY_PROMPT);

    // Get agent capabilities to include in the prompt
    const agentCapabilities = state.agents
      .map((agent) => {
        return `${agent.name} (${agent.role}): ${agent.description}
Capabilities: ${agent.capabilities.join(", ")}`;
      })
      .join("\n\n");

    // Execute the prompt to analyze the query
    const response = await llm.invoke(
      prompt.format({
        user_query: state.lastUserQuery,
        agent_capabilities: agentCapabilities,
        context: JSON.stringify(state.context, null, 2),
      })
    );

    // Parse the response to extract intent
    let parsedResponse;
    try {
      // Extract JSON from response if wrapped in code blocks
      const jsonMatch =
        response.content.match(/```json\n([\s\S]*?)\n```/) ||
        response.content.match(/```\n([\s\S]*?)\n```/);

      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[1]);
      } else {
        // Try parsing the entire response
        parsedResponse = JSON.parse(response.content);
      }
    } catch (parseError) {
      console.error("Failed to parse LLM response as JSON:", parseError);
      return {
        ...state,
        errors: [
          ...state.errors,
          `Failed to parse query analysis: ${parseError.message}`,
        ],
      };
    }

    return {
      ...state,
      context: {
        ...state.context,
        analysis: parsedResponse,
      },
      messages: [
        ...state.messages,
        {
          role: "system",
          content: `Analyzed user query: ${parsedResponse.summary}`,
          timestamp: Date.now(),
        },
      ],
    };
  } catch (error) {
    console.error("Error analyzing user query:", error);
    return {
      ...state,
      errors: [...state.errors, `Error analyzing user query: ${error.message}`],
    };
  }
}

/**
 * Determines which workflow to create based on user query analysis
 */
export async function determineWorkflow(
  state: OrchestratorState
): Promise<OrchestratorState> {
  const analysis = state.context.analysis;

  if (!analysis) {
    return {
      ...state,
      errors: [
        ...state.errors,
        "No query analysis available to determine workflow",
      ],
    };
  }

  try {
    // Create a new workflow based on the analysis
    const workflowId = uuidv4();
    const workflow: Workflow = {
      id: workflowId,
      name: `Workflow for ${analysis.intent || "user query"}`,
      description: analysis.summary || "Workflow created from user query",
      steps: [],
      status: StepStatus.PENDING,
      startTime: Date.now(),
      metadata: {
        userQuery: state.lastUserQuery,
        intent: analysis.intent,
        entities: analysis.entities,
      },
    };

    // Determine which steps need to be included based on the analysis
    if (analysis.requiredAgents && Array.isArray(analysis.requiredAgents)) {
      // Map the required agents to workflow steps
      const steps: WorkflowStep[] = analysis.requiredAgents
        .map((agentId: string, index: number) => {
          // Find the agent in our registered agents
          const agent = state.agents.find((a) => a.id === agentId);
          if (!agent) return null;

          return {
            id: `step-${uuidv4()}`,
            name: `${agent.name} Step`,
            description: `Execute ${agent.name} to handle ${analysis.intent || "request"}`,
            agentId: agent.id,
            status: StepStatus.PENDING,
            dependencies:
              index === 0
                ? []
                : [
                    /*Previous step IDs could go here*/
                  ],
            startTime: undefined,
            endTime: undefined,
          };
        })
        .filter(Boolean) as WorkflowStep[];

      // Add any dependencies between steps
      // For now, we'll make a simple linear workflow
      for (let i = 1; i < steps.length; i++) {
        steps[i].dependencies = [steps[i - 1].id];
      }

      // Add steps to the workflow
      workflow.steps = steps;
    }

    // If no steps were created, add an error
    if (workflow.steps.length === 0) {
      return {
        ...state,
        errors: [
          ...state.errors,
          "Failed to create workflow: no valid agents determined",
        ],
      };
    }

    return {
      ...state,
      workflows: [...state.workflows, workflow],
      currentWorkflowId: workflowId,
      messages: [
        ...state.messages,
        {
          role: "system",
          content: `Created workflow '${workflow.name}' with ${workflow.steps.length} steps.`,
          timestamp: Date.now(),
        },
      ],
    };
  } catch (error) {
    console.error("Error determining workflow:", error);
    return {
      ...state,
      errors: [...state.errors, `Error determining workflow: ${error.message}`],
    };
  }
}

/**
 * Starts execution of the current workflow
 */
export async function startWorkflow(
  state: OrchestratorState
): Promise<OrchestratorState> {
  if (!state.currentWorkflowId) {
    return {
      ...state,
      errors: [...state.errors, "No current workflow to start"],
    };
  }

  try {
    const workflowIndex = state.workflows.findIndex(
      (w) => w.id === state.currentWorkflowId
    );
    if (workflowIndex === -1) {
      return {
        ...state,
        errors: [
          ...state.errors,
          `Workflow with ID ${state.currentWorkflowId} not found`,
        ],
      };
    }

    // Create a new workflows array with the updated workflow
    const workflows = [...state.workflows];
    workflows[workflowIndex] = {
      ...workflows[workflowIndex],
      status: StepStatus.IN_PROGRESS,
      startTime: Date.now(),
    };

    return {
      ...state,
      workflows,
      messages: [
        ...state.messages,
        {
          role: "system",
          content: `Started workflow: ${workflows[workflowIndex].name}`,
          timestamp: Date.now(),
        },
      ],
    };
  } catch (error) {
    console.error("Error starting workflow:", error);
    return {
      ...state,
      errors: [...state.errors, `Error starting workflow: ${error.message}`],
    };
  }
}

/**
 * Executes the next step in the current workflow
 */
export async function executeNextStep(
  state: OrchestratorState
): Promise<OrchestratorState> {
  if (!state.currentWorkflowId) {
    return {
      ...state,
      errors: [...state.errors, "No current workflow for step execution"],
    };
  }

  try {
    const workflowIndex = state.workflows.findIndex(
      (w) => w.id === state.currentWorkflowId
    );
    if (workflowIndex === -1) {
      return {
        ...state,
        errors: [
          ...state.errors,
          `Workflow with ID ${state.currentWorkflowId} not found`,
        ],
      };
    }

    const workflow = state.workflows[workflowIndex];

    // Get the next executable step
    const nextStep = getNextExecutableStep(workflow);
    if (!nextStep) {
      return {
        ...state,
        errors: [
          ...state.errors,
          "No executable steps found in the current workflow",
        ],
      };
    }

    // Update the step status
    const updatedSteps = workflow.steps.map((step) => {
      if (step.id === nextStep.id) {
        return {
          ...step,
          status: StepStatus.IN_PROGRESS,
          startTime: Date.now(),
        };
      }
      return step;
    });

    // Create a new workflows array with the updated workflow
    const workflows = [...state.workflows];
    workflows[workflowIndex] = {
      ...workflow,
      steps: updatedSteps,
      currentStepId: nextStep.id,
    };

    // Find the agent for this step
    const agent = state.agents.find((a) => a.id === nextStep.agentId);
    if (!agent) {
      return {
        ...state,
        workflows,
        errors: [
          ...state.errors,
          `Agent with ID ${nextStep.agentId} not found for step ${nextStep.id}`,
        ],
      };
    }

    return {
      ...state,
      workflows,
      messages: [
        ...state.messages,
        {
          role: "system",
          content: `Executing step: ${nextStep.name} with agent: ${agent.name}`,
          timestamp: Date.now(),
        },
      ],
    };
  } catch (error) {
    console.error("Error executing next step:", error);
    return {
      ...state,
      errors: [...state.errors, `Error executing next step: ${error.message}`],
    };
  }
}

/**
 * Routes control flow based on current workflow status
 */
export function routeWorkflow(
  state: OrchestratorState
): "continue" | "complete" | "error" {
  if (state.errors.length > 0) {
    // If we have errors, route to error handling
    return "error";
  }

  if (!state.currentWorkflowId) {
    // If no current workflow, we're done
    return "complete";
  }

  const workflow = state.workflows.find(
    (w) => w.id === state.currentWorkflowId
  );
  if (!workflow) {
    // If workflow not found, we're done (with an error)
    return "error";
  }

  if (isWorkflowCompleted(workflow)) {
    // If workflow is completed, we're done
    return "complete";
  }

  if (hasWorkflowFailed(workflow)) {
    // If workflow has failed, route to error handling
    return "error";
  }

  // Otherwise, continue workflow execution
  return "continue";
}

/**
 * Marks the current workflow as complete
 */
export async function completeWorkflow(
  state: OrchestratorState
): Promise<OrchestratorState> {
  if (!state.currentWorkflowId) {
    return state;
  }

  try {
    const workflowIndex = state.workflows.findIndex(
      (w) => w.id === state.currentWorkflowId
    );
    if (workflowIndex === -1) {
      return {
        ...state,
        errors: [
          ...state.errors,
          `Workflow with ID ${state.currentWorkflowId} not found`,
        ],
      };
    }

    const workflow = state.workflows[workflowIndex];

    // Create a new workflows array with the updated workflow
    const workflows = [...state.workflows];
    workflows[workflowIndex] = {
      ...workflow,
      status: StepStatus.COMPLETED,
      endTime: Date.now(),
    };

    return {
      ...state,
      workflows,
      currentWorkflowId: undefined,
      messages: [
        ...state.messages,
        {
          role: "system",
          content: `Completed workflow: ${workflow.name}`,
          timestamp: Date.now(),
        },
      ],
    };
  } catch (error) {
    console.error("Error completing workflow:", error);
    return {
      ...state,
      errors: [...state.errors, `Error completing workflow: ${error.message}`],
    };
  }
}

/**
 * Handles errors in the orchestration process
 */
export async function handleError(
  state: OrchestratorState
): Promise<OrchestratorState> {
  const latestError = state.errors[state.errors.length - 1];

  // Log the error
  console.error("Orchestration error:", latestError);

  // If we have a current workflow, mark it as failed
  if (state.currentWorkflowId) {
    const workflowIndex = state.workflows.findIndex(
      (w) => w.id === state.currentWorkflowId
    );
    if (workflowIndex !== -1) {
      const workflow = state.workflows[workflowIndex];

      // Create a new workflows array with the updated workflow
      const workflows = [...state.workflows];
      workflows[workflowIndex] = {
        ...workflow,
        status: StepStatus.FAILED,
        endTime: Date.now(),
      };

      return {
        ...state,
        workflows,
        currentWorkflowId: undefined,
        messages: [
          ...state.messages,
          {
            role: "system",
            content: `Workflow failed: ${workflow.name}. Error: ${latestError}`,
            timestamp: Date.now(),
          },
        ],
      };
    }
  }

  // If we don't have a current workflow or couldn't find it
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        role: "system",
        content: `Orchestration error: ${latestError}`,
        timestamp: Date.now(),
      },
    ],
  };
}
