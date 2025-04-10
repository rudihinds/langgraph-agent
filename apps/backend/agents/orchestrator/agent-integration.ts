import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import { OrchestratorState, AgentType } from "./state.js";
import { OrchestratorConfig } from "./configuration.js";
import { ErrorInfo } from "./state.js";
import { v4 as uuidv4 } from "uuid";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StateGraph } from "@langchain/langgraph";
import { AGENT_INTEGRATION_PROMPT } from "./prompt-templates.js";

/**
 * Interface for agent initialization parameters
 */
export interface AgentInitParams {
  /** The unique identifier for the agent */
  agentId: string;

  /** The thread ID for the agent's conversation */
  threadId?: string;

  /** Initial messages to seed the conversation */
  initialMessages?: BaseMessage[];

  /** Configuration overrides for this agent */
  config?: Record<string, any>;

  /** Metadata to associate with this agent instance */
  metadata?: Record<string, any>;
}

/**
 * Interface for agent execution parameters
 */
export interface AgentExecuteParams {
  /** The messages to send to the agent */
  messages: BaseMessage[];

  /** The thread ID for the agent's conversation */
  threadId: string;

  /** Configuration for the agent execution */
  config?: RunnableConfig;

  /** Whether to wait for the agent to complete before returning */
  waitForCompletion?: boolean;

  /** Timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Interface for agent execution results
 */
export interface AgentExecuteResult {
  /** The thread ID for the agent's conversation */
  threadId: string;

  /** The messages from the agent's execution */
  messages: BaseMessage[];

  /** Whether the execution completed successfully */
  completed: boolean;

  /** Additional data returned by the agent */
  data?: Record<string, any>;

  /** Error information if the execution failed */
  error?: ErrorInfo;
}

/**
 * Response structure for agent integration
 */
export interface AgentIntegrationResponse {
  agentId: string;
  recommendedUses: string[];
  complementaryAgents: Array<{
    agentId: string;
    relationship: string;
  }>;
  exampleWorkflows: Array<{
    name: string;
    description: string;
    steps: string[];
  }>;
}

/**
 * Options for agent registration
 */
export interface RegisterAgentOptions {
  id?: string;
  name: string;
  role: AgentRole;
  description: string;
  capabilities: string[];
  graphInstance?: StateGraph<any>;
  apiSchema?: Record<string, any>;
  config?: Record<string, any>;
}

/**
 * Class for managing agent integration and coordination
 */
export class AgentIntegrationManager {
  private config: OrchestratorConfig;
  private logger: Console;
  private agents: Record<AgentType, any>;

  /**
   * Create an AgentIntegrationManager
   * @param config The configuration for the manager
   * @param agents Map of agent instances by type
   */
  constructor(
    config: OrchestratorConfig,
    agents?: Partial<Record<AgentType, any>>
  ) {
    this.config = config;
    this.logger = console;
    this.agents = (agents as Record<AgentType, any>) || {};
  }

  /**
   * Register an agent with the manager
   * @param agentType The type of agent
   * @param agent The agent instance
   */
  registerAgent(agentType: AgentType, agent: any): void {
    this.agents[agentType] = agent;

    if (this.config.debug) {
      this.logger.info(`Registered agent type: ${agentType}`);
    }
  }

  /**
   * Get an agent by type
   * @param agentType The type of agent to get
   * @returns The agent instance
   */
  getAgent(agentType: AgentType): any {
    if (!this.agents[agentType]) {
      throw new Error(`Agent of type '${agentType}' not registered`);
    }

    return this.agents[agentType];
  }

  /**
   * Check if an agent is registered
   * @param agentType The type of agent to check
   * @returns Whether the agent is registered
   */
  hasAgent(agentType: AgentType): boolean {
    return !!this.agents[agentType];
  }

  /**
   * Initialize an agent thread
   * @param agentType The type of agent to initialize
   * @param params The initialization parameters
   * @returns The thread ID for the agent's conversation
   */
  async initializeAgentThread(
    agentType: AgentType,
    params: AgentInitParams
  ): Promise<string> {
    const agent = this.getAgent(agentType);

    if (!agent) {
      throw new Error(`Agent of type '${agentType}' not registered`);
    }

    try {
      // Initialize thread with the agent (implementation depends on agent interface)
      const threadId =
        params.threadId || `${agentType}-${params.agentId}-${Date.now()}`;

      // Log the initialization
      if (this.config.debug) {
        this.logger.info(`Initializing agent thread:`, {
          agentType,
          threadId,
          agentId: params.agentId,
        });
      }

      // Different agents may have different initialization patterns
      if (typeof agent.initializeThread === "function") {
        await agent.initializeThread(
          threadId,
          params.initialMessages,
          params.config
        );
      } else if (typeof agent.initialize === "function") {
        await agent.initialize(threadId, params.initialMessages, params.config);
      } else {
        // For agents without explicit initialization, we do nothing but return the threadId
        this.logger.warn(
          `Agent of type '${agentType}' has no initialization method`
        );
      }

      return threadId;
    } catch (error) {
      const errorInfo: ErrorInfo = {
        source: "initializeAgentThread",
        message:
          error.message || `Failed to initialize agent thread for ${agentType}`,
        timestamp: new Date().toISOString(),
        recoverable: false,
      };

      this.logger.error(`Agent thread initialization failed:`, errorInfo);
      throw error;
    }
  }

  /**
   * Execute an agent with messages
   * @param agentType The type of agent to execute
   * @param params The execution parameters
   * @returns The execution result
   */
  async executeAgent(
    agentType: AgentType,
    params: AgentExecuteParams
  ): Promise<AgentExecuteResult> {
    const agent = this.getAgent(agentType);

    if (!agent) {
      throw new Error(`Agent of type '${agentType}' not registered`);
    }

    try {
      // Set up execution timeout
      const timeoutMs = params.timeoutMs || this.config.timeoutSeconds * 1000;
      let timeoutId: NodeJS.Timeout | undefined;

      // Create a promise that will reject if the timeout is reached
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Agent execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Log the execution
      if (this.config.debug) {
        this.logger.info(`Executing agent:`, {
          agentType,
          threadId: params.threadId,
          messageCount: params.messages.length,
          waitForCompletion: params.waitForCompletion,
        });
      }

      // Execute the agent with timeout race
      const executionPromise = (async () => {
        // Different agents may have different execution patterns
        let result;
        if (typeof agent.executeThread === "function") {
          result = await agent.executeThread(
            params.threadId,
            params.messages,
            params.config
          );
        } else if (typeof agent.execute === "function") {
          result = await agent.execute(
            params.threadId,
            params.messages,
            params.config
          );
        } else if (typeof agent.invoke === "function") {
          // Handle LangChain-style invocations
          const stateWithMessages = {
            messages: params.messages,
            ...params.config?.state,
          };

          result = await agent.invoke(stateWithMessages, {
            ...params.config,
            configurable: {
              ...(params.config?.configurable || {}),
              thread_id: params.threadId,
            },
          });

          // Extract messages from result based on LangChain agent patterns
          if (result.messages) {
            result = {
              messages: result.messages,
              completed: true,
              data: result,
            };
          } else {
            // If no messages field, try to extract data in a reasonable way
            result = {
              messages: [],
              completed: true,
              data: result,
            };
          }
        } else {
          throw new Error(
            `Agent of type '${agentType}' has no execution method`
          );
        }

        return result;
      })();

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Clear timeout if execution completed
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Standardize the result format
      return {
        threadId: params.threadId,
        messages: result.messages || [],
        completed: result.completed || true,
        data: result.data || {},
      };
    } catch (error) {
      const errorInfo: ErrorInfo = {
        source: "executeAgent",
        message: error.message || `Failed to execute agent ${agentType}`,
        timestamp: new Date().toISOString(),
        recoverable: true,
        retryCount: 0,
      };

      this.logger.error(`Agent execution failed:`, errorInfo);

      return {
        threadId: params.threadId,
        messages: [],
        completed: false,
        error: errorInfo,
      };
    }
  }

  /**
   * Route messages to an agent and process the response
   * @param state The current orchestrator state
   * @param agentType The type of agent to route to
   * @param message The message to route
   * @returns Updated state with agent response
   */
  async routeToAgent(
    state: OrchestratorState,
    agentType: AgentType,
    message: HumanMessage
  ): Promise<Partial<OrchestratorState>> {
    // Ensure the agent is registered
    if (!this.hasAgent(agentType)) {
      const errorInfo: ErrorInfo = {
        source: "routeToAgent",
        message: `Agent of type '${agentType}' not registered`,
        timestamp: new Date().toISOString(),
        recoverable: false,
      };

      return {
        status: "error",
        errors: [errorInfo],
      };
    }

    // Get or create the thread ID for this agent
    let threadId = state.agentThreads[agentType];

    if (!threadId) {
      try {
        // Initialize a new thread for this agent
        threadId = await this.initializeAgentThread(agentType, {
          agentId: state.metadata.proposalId || `proposal-${Date.now()}`,
          initialMessages: [], // No initial messages yet
          metadata: state.metadata,
        });

        // Update the thread ID in the state
        const updatedAgentThreads = {
          ...state.agentThreads,
          [agentType]: threadId,
        };

        return {
          agentThreads: updatedAgentThreads,
        };
      } catch (error) {
        const errorInfo: ErrorInfo = {
          source: "routeToAgent_initialization",
          message: error.message || `Failed to initialize agent ${agentType}`,
          timestamp: new Date().toISOString(),
          recoverable: false,
        };

        return {
          status: "error",
          errors: [errorInfo],
        };
      }
    }

    // Execute the agent with the message
    try {
      const result = await this.executeAgent(agentType, {
        threadId,
        messages: [message],
        waitForCompletion: true,
      });

      if (!result.completed || result.error) {
        // Handle error case
        return {
          status: "error",
          errors: result.error
            ? [result.error]
            : [
                {
                  source: "routeToAgent_execution",
                  message: "Agent execution failed with unknown error",
                  timestamp: new Date().toISOString(),
                  recoverable: true,
                  retryCount: 0,
                },
              ],
        };
      }

      // Update state with the agent's response
      return {
        messages: [...state.messages, ...result.messages],
        status: "in_progress",
        metadata: {
          ...state.metadata,
          updatedAt: new Date().toISOString(),
          lastAgentInteraction: {
            agentType,
            threadId,
            timestamp: new Date().toISOString(),
          },
        },
      };
    } catch (error) {
      const errorInfo: ErrorInfo = {
        source: "routeToAgent_execution",
        message: error.message || `Failed to execute agent ${agentType}`,
        timestamp: new Date().toISOString(),
        recoverable: true,
        retryCount: 0,
      };

      return {
        status: "error",
        errors: [errorInfo],
      };
    }
  }

  /**
   * Coordinate a multi-step workflow across agents
   * @param state The current orchestrator state
   * @param steps Array of workflow steps with agent types and messages
   * @returns Updated state with all agent responses
   */
  async coordinateWorkflow(
    state: OrchestratorState,
    steps: Array<{
      agentType: AgentType;
      message: string | HumanMessage;
      waitForCompletion?: boolean;
    }>
  ): Promise<Partial<OrchestratorState>> {
    const results: AgentExecuteResult[] = [];
    const allMessages: BaseMessage[] = [];

    // Process each step in sequence
    for (const step of steps) {
      const agentType = step.agentType;
      const message =
        typeof step.message === "string"
          ? new HumanMessage(step.message)
          : step.message;

      // Ensure thread exists
      if (!state.agentThreads[agentType]) {
        try {
          // Initialize thread if needed
          const threadId = await this.initializeAgentThread(agentType, {
            agentId: state.metadata.proposalId || `proposal-${Date.now()}`,
            initialMessages: [],
            metadata: state.metadata,
          });

          // Update threads in state
          state.agentThreads = {
            ...state.agentThreads,
            [agentType]: threadId,
          };
        } catch (error) {
          const errorInfo: ErrorInfo = {
            source: "coordinateWorkflow_initialization",
            message: error.message || `Failed to initialize agent ${agentType}`,
            timestamp: new Date().toISOString(),
            recoverable: false,
          };

          return {
            status: "error",
            errors: [errorInfo],
          };
        }
      }

      // Execute this step
      try {
        const result = await this.executeAgent(agentType, {
          threadId: state.agentThreads[agentType],
          messages: [message],
          waitForCompletion: step.waitForCompletion ?? true,
        });

        results.push(result);

        // Add messages to the collection
        if (result.messages?.length) {
          allMessages.push(...result.messages);
        }

        // If this step failed, interrupt the workflow
        if (!result.completed || result.error) {
          return {
            status: "error",
            errors: result.error
              ? [result.error]
              : [
                  {
                    source: "coordinateWorkflow_execution",
                    message: `Workflow step with agent ${agentType} failed`,
                    timestamp: new Date().toISOString(),
                    recoverable: true,
                    retryCount: 0,
                  },
                ],
            metadata: {
              ...state.metadata,
              updatedAt: new Date().toISOString(),
              workflowResults: results,
            },
          };
        }
      } catch (error) {
        const errorInfo: ErrorInfo = {
          source: "coordinateWorkflow_execution",
          message: error.message || `Failed to execute agent ${agentType}`,
          timestamp: new Date().toISOString(),
          recoverable: true,
          retryCount: 0,
        };

        return {
          status: "error",
          errors: [errorInfo],
          metadata: {
            ...state.metadata,
            updatedAt: new Date().toISOString(),
            workflowResults: results,
          },
        };
      }
    }

    // All steps completed successfully
    return {
      messages: [...state.messages, ...allMessages],
      status: "in_progress",
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
        lastWorkflow: {
          steps: steps.map((s) => s.agentType),
          timestamp: new Date().toISOString(),
          completed: true,
        },
        workflowResults: results,
      },
    };
  }

  /**
   * Handle a timeout or cancellation request
   * @param state The current orchestrator state
   * @param agentType The type of agent to cancel (optional)
   * @returns Updated state after cancellation
   */
  async handleCancellation(
    state: OrchestratorState,
    agentType?: AgentType
  ): Promise<Partial<OrchestratorState>> {
    const agentTypesToCancel = agentType
      ? [agentType]
      : (Object.keys(state.agentThreads) as AgentType[]);

    // Log cancellation attempt
    if (this.config.debug) {
      this.logger.info(`Attempting to cancel agents:`, agentTypesToCancel);
    }

    // Try to cancel operations for each agent
    for (const type of agentTypesToCancel) {
      const agent = this.getAgent(type);
      const threadId = state.agentThreads[type];

      if (!agent || !threadId) continue;

      try {
        // Different agents may have different cancellation patterns
        if (typeof agent.cancelExecution === "function") {
          await agent.cancelExecution(threadId);
        } else if (typeof agent.cancel === "function") {
          await agent.cancel(threadId);
        } else {
          // No explicit cancellation method, just log a warning
          this.logger.warn(
            `Agent of type '${type}' has no cancellation method`
          );
        }
      } catch (error) {
        this.logger.error(`Failed to cancel agent ${type}:`, error);
        // Continue with other agents even if one fails
      }
    }

    return {
      status: "waiting_input",
      metadata: {
        ...state.metadata,
        updatedAt: new Date().toISOString(),
        cancellation: {
          agents: agentTypesToCancel,
          timestamp: new Date().toISOString(),
        },
      },
    };
  }
}

/**
 * Create an AgentIntegrationManager
 * @param config The configuration for the manager
 * @param agents Map of agent instances by type
 * @returns The agent integration manager
 */
export function createAgentIntegrationManager(
  config: OrchestratorConfig,
  agents?: Partial<Record<AgentType, any>>
): AgentIntegrationManager {
  return new AgentIntegrationManager(config, agents);
}

/**
 * Registers a new agent with the orchestrator
 *
 * @param state Current orchestrator state
 * @param options Options for agent registration
 * @returns Updated orchestrator state with the new agent
 */
export async function registerAgent(
  state: OrchestratorState,
  options: RegisterAgentOptions
): Promise<OrchestratorState> {
  // Check if an agent with this name already exists
  const existingAgent = state.agents.find(
    (agent) =>
      agent.name === options.name || (options.id && agent.id === options.id)
  );

  if (existingAgent) {
    return {
      ...state,
      errors: [
        ...state.errors,
        `Agent with name ${options.name} or ID ${options.id} already exists`,
      ],
    };
  }

  // Create a new agent metadata object
  const newAgent: AgentMetadata = {
    id: options.id || uuidv4(),
    name: options.name,
    role: options.role,
    description: options.description,
    capabilities: options.capabilities,
  };

  // Add a system message about the new agent
  const messages = [
    ...state.messages,
    {
      role: "system",
      content: `Registered new agent: ${newAgent.name} (${newAgent.role})`,
      timestamp: Date.now(),
    },
  ];

  // Return updated state with the new agent
  return {
    ...state,
    agents: [...state.agents, newAgent],
    messages,
    context: {
      ...state.context,
      agentConfigs: {
        ...state.context.agentConfigs,
        [newAgent.id]: {
          graphInstance: options.graphInstance,
          apiSchema: options.apiSchema,
          config: options.config,
        },
      },
    },
  };
}

/**
 * Unregisters an agent from the orchestrator
 *
 * @param state Current orchestrator state
 * @param agentId ID of the agent to unregister
 * @returns Updated orchestrator state without the agent
 */
export function unregisterAgent(
  state: OrchestratorState,
  agentId: string
): OrchestratorState {
  const agent = state.agents.find((a) => a.id === agentId);
  if (!agent) {
    return {
      ...state,
      errors: [...state.errors, `Agent with ID ${agentId} not found`],
    };
  }

  // Create a new agents array without the specified agent
  const agents = state.agents.filter((a) => a.id !== agentId);

  // Remove agent config
  const { [agentId]: _, ...agentConfigs } = state.context.agentConfigs || {};

  return {
    ...state,
    agents,
    messages: [
      ...state.messages,
      {
        role: "system",
        content: `Unregistered agent: ${agent.name} (${agent.role})`,
        timestamp: Date.now(),
      },
    ],
    context: {
      ...state.context,
      agentConfigs,
    },
  };
}

/**
 * Analyzes a new agent and provides recommendations for integration
 *
 * @param options Agent options to analyze
 * @param config Orchestrator configuration
 * @returns Analysis of the agent integration
 */
export async function analyzeAgentIntegration(
  options: RegisterAgentOptions,
  config: OrchestratorConfig,
  existingAgents: AgentMetadata[]
): Promise<AgentIntegrationResponse> {
  try {
    const llm = new ChatOpenAI({
      modelName: config.llmModel,
      temperature: 0.2,
    });

    const prompt = ChatPromptTemplate.fromTemplate(AGENT_INTEGRATION_PROMPT);

    // Format existing agents for context
    const existingAgentsContext = existingAgents
      .map(
        (agent) =>
          `${agent.name} (${agent.role}): ${agent.description}\nCapabilities: ${agent.capabilities.join(
            ", "
          )}`
      )
      .join("\n\n");

    // Execute the prompt to analyze the agent
    const response = await llm.invoke(
      prompt.format({
        agent_name: options.name,
        agent_description: options.description,
        agent_capabilities: options.capabilities.join(", "),
        agent_api_schema: JSON.stringify(options.apiSchema || {}, null, 2),
        existing_agents: existingAgentsContext,
      })
    );

    // Parse the response
    let parsedResponse: AgentIntegrationResponse;
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
      throw new Error(
        `Failed to parse agent integration analysis: ${parseError.message}`
      );
    }

    return parsedResponse;
  } catch (error) {
    console.error("Error analyzing agent integration:", error);
    throw new Error(`Error analyzing agent integration: ${error.message}`);
  }
}

/**
 * Gets an agent's configuration from the state
 *
 * @param state Current orchestrator state
 * @param agentId ID of the agent
 * @returns Agent configuration or null if not found
 */
export function getAgentConfig(
  state: OrchestratorState,
  agentId: string
): any | null {
  const agentConfigs = state.context.agentConfigs || {};
  return agentConfigs[agentId] || null;
}

/**
 * Gets an agent instance (graph) from the state
 *
 * @param state Current orchestrator state
 * @param agentId ID of the agent
 * @returns Agent graph instance or null if not found
 */
export function getAgentInstance(
  state: OrchestratorState,
  agentId: string
): StateGraph<any> | null {
  const agentConfig = getAgentConfig(state, agentId);
  return agentConfig?.graphInstance || null;
}

/**
 * Updates agent capabilities based on observed behavior
 *
 * @param state Current orchestrator state
 * @param agentId ID of the agent to update
 * @param newCapabilities New capabilities to add
 * @returns Updated orchestrator state
 */
export function updateAgentCapabilities(
  state: OrchestratorState,
  agentId: string,
  newCapabilities: string[]
): OrchestratorState {
  const agentIndex = state.agents.findIndex((a) => a.id === agentId);
  if (agentIndex === -1) {
    return {
      ...state,
      errors: [...state.errors, `Agent with ID ${agentId} not found`],
    };
  }

  // Get current agent
  const agent = state.agents[agentIndex];

  // Filter out duplicate capabilities
  const uniqueNewCapabilities = newCapabilities.filter(
    (cap) => !agent.capabilities.includes(cap)
  );

  if (uniqueNewCapabilities.length === 0) {
    return state; // No new capabilities to add
  }

  // Create updated agent with new capabilities
  const updatedAgent = {
    ...agent,
    capabilities: [...agent.capabilities, ...uniqueNewCapabilities],
  };

  // Create new agents array with updated agent
  const agents = [...state.agents];
  agents[agentIndex] = updatedAgent;

  return {
    ...state,
    agents,
    messages: [
      ...state.messages,
      {
        role: "system",
        content: `Updated capabilities for agent ${agent.name}: Added ${uniqueNewCapabilities.join(", ")}`,
        timestamp: Date.now(),
      },
    ],
  };
}
