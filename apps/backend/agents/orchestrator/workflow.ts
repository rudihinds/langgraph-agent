import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END } from "@langchain/langgraph";
import { v4 as uuidv4 } from "uuid";

import {
  OrchestratorState,
  getInitialOrchestratorState,
  orchestratorStateSchema,
} from "./state.js";
import {
  analyzeUserQuery,
  determineWorkflow,
  startWorkflow,
  executeNextStep,
  routeWorkflow,
  completeWorkflow,
  handleError,
} from "./nodes.js";
import { OrchestratorConfig, mergeConfig } from "./configuration.js";
import {
  registerAgent,
  unregisterAgent,
  analyzeAgentIntegration,
  getAgentInstance,
  RegisterAgentOptions,
} from "./agent-integration.js";

/**
 * Options for creating a WorkflowOrchestrator
 */
export interface WorkflowOrchestratorOptions {
  /**
   * User ID for the current user
   */
  userId: string;

  /**
   * Project ID for the current project
   */
  projectId: string;

  /**
   * Configuration options for the orchestrator
   */
  config?: Partial<OrchestratorConfig>;

  /**
   * Pre-registered agents
   */
  agents?: RegisterAgentOptions[];

  /**
   * Whether to persist state between steps
   */
  persistState?: boolean;

  /**
   * Initial context for the orchestrator
   */
  initialContext?: Record<string, any>;
}

/**
 * Main class for the workflow orchestrator
 */
export class WorkflowOrchestrator {
  /**
   * The state graph powering the orchestrator
   */
  private readonly graph: StateGraph<OrchestratorState>;

  /**
   * Configuration for the orchestrator
   */
  private readonly config: OrchestratorConfig;

  /**
   * User ID for the current user
   */
  private readonly userId: string;

  /**
   * Project ID for the current project
   */
  private readonly projectId: string;

  /**
   * The initial state for the orchestrator
   */
  private initialState: OrchestratorState;

  /**
   * Thread ID for this orchestrator instance
   */
  private threadId: string;

  /**
   * Compiler instance for the state graph
   */
  private compiler: any;

  /**
   * Creates a new WorkflowOrchestrator
   *
   * @param options Options for creating the orchestrator
   */
  constructor(options: WorkflowOrchestratorOptions) {
    this.userId = options.userId;
    this.projectId = options.projectId;
    this.config = mergeConfig(options.config);
    this.threadId = uuidv4();

    // Create initial state
    this.initialState = getInitialOrchestratorState(
      this.userId,
      this.projectId
    );

    // Add initial context if provided
    if (options.initialContext) {
      this.initialState.context = {
        ...this.initialState.context,
        ...options.initialContext,
      };
    }

    // Create the state graph
    this.graph = new StateGraph({
      channels: { state: orchestratorStateSchema },
    });

    // Add nodes to the graph
    this.graph.addNode("analyzeUserQuery", {
      action: analyzeUserQuery,
      retry: this.config.maxRetries,
    });
    this.graph.addNode("determineWorkflow", {
      action: determineWorkflow,
      retry: this.config.maxRetries,
    });
    this.graph.addNode("startWorkflow", {
      action: startWorkflow,
    });
    this.graph.addNode("executeNextStep", {
      action: executeNextStep,
      retry: this.config.maxRetries,
    });
    this.graph.addNode("completeWorkflow", {
      action: completeWorkflow,
    });
    this.graph.addNode("handleError", {
      action: handleError,
    });

    // Add conditional edge
    this.graph.addConditionalEdges("executeNextStep", routeWorkflow, {
      continue: "executeNextStep",
      complete: "completeWorkflow",
      error: "handleError",
    });

    // Connect the nodes
    this.graph.addEdge("analyzeUserQuery", "determineWorkflow");
    this.graph.addEdge("determineWorkflow", "startWorkflow");
    this.graph.addEdge("startWorkflow", "executeNextStep");
    this.graph.addEdge("completeWorkflow", END);
    this.graph.addEdge("handleError", END);

    // Set the entry point
    this.graph.setEntryPoint("analyzeUserQuery");

    // Compile the graph
    this.compiler = this.graph.compile();

    // Register pre-defined agents if provided
    if (options.agents && options.agents.length > 0) {
      this.registerAgents(options.agents);
    }
  }

  /**
   * Registers multiple agents with the orchestrator
   *
   * @param agents Array of agent options to register
   * @returns Promise resolving when all agents are registered
   */
  private async registerAgents(agents: RegisterAgentOptions[]): Promise<void> {
    for (const agentOptions of agents) {
      await this.registerAgent(agentOptions);
    }
  }

  /**
   * Registers a single agent with the orchestrator
   *
   * @param options Options for agent registration
   * @returns Promise resolving with the agent ID
   */
  public async registerAgent(options: RegisterAgentOptions): Promise<string> {
    try {
      // Generate agent ID if not provided
      const agentId = options.id || uuidv4();
      options.id = agentId;

      // Update the initial state with the new agent
      this.initialState = await registerAgent(this.initialState, options);

      return agentId;
    } catch (error) {
      console.error("Error registering agent:", error);
      throw new Error(`Failed to register agent: ${error.message}`);
    }
  }

  /**
   * Unregisters an agent from the orchestrator
   *
   * @param agentId ID of the agent to unregister
   */
  public unregisterAgent(agentId: string): void {
    this.initialState = unregisterAgent(this.initialState, agentId);
  }

  /**
   * Analyzes a new agent and provides recommendations for integration
   *
   * @param options Agent options to analyze
   * @returns Analysis of the agent integration
   */
  public async analyzeAgentIntegration(
    options: RegisterAgentOptions
  ): Promise<any> {
    return analyzeAgentIntegration(
      options,
      this.config,
      this.initialState.agents
    );
  }

  /**
   * Processes a user query through the orchestrator
   *
   * @param query The user's query to process
   * @param context Optional additional context for this query
   * @returns Result of the workflow execution
   */
  public async processQuery(
    query: string,
    context?: Record<string, any>
  ): Promise<OrchestratorState> {
    try {
      // Create the input state
      const inputState: OrchestratorState = {
        ...this.initialState,
        lastUserQuery: query,
        context: {
          ...this.initialState.context,
          ...context,
        },
      };

      // Create event stream config
      const config = {
        configurable: {
          // Add any dynamic configuration here
        },
      };

      // Run the graph
      const result = await this.compiler.invoke(
        {
          state: inputState,
        },
        config
      );

      return result.state;
    } catch (error) {
      console.error("Error processing query:", error);

      // Return error state
      return {
        ...this.initialState,
        lastUserQuery: query,
        errors: [
          ...this.initialState.errors,
          `Error processing query: ${error.message}`,
        ],
      };
    }
  }

  /**
   * Executes a specific workflow directly
   *
   * @param workflowTemplate Template for the workflow to execute
   * @param context Additional context for the workflow
   * @returns Result of the workflow execution
   */
  public async executeWorkflow(
    workflowTemplate: any,
    context?: Record<string, any>
  ): Promise<OrchestratorState> {
    try {
      // Create input state with the workflow already determined
      const inputState: OrchestratorState = {
        ...this.initialState,
        workflows: [workflowTemplate],
        currentWorkflowId: workflowTemplate.id,
        context: {
          ...this.initialState.context,
          ...context,
        },
      };

      // Run the graph starting from the startWorkflow node
      const result = await this.compiler.invoke(
        {
          state: inputState,
        },
        {
          startNode: "startWorkflow",
        }
      );

      return result.state;
    } catch (error) {
      console.error("Error executing workflow:", error);

      // Return error state
      return {
        ...this.initialState,
        workflows: [workflowTemplate],
        currentWorkflowId: workflowTemplate.id,
        errors: [
          ...this.initialState.errors,
          `Error executing workflow: ${error.message}`,
        ],
      };
    }
  }

  /**
   * Gets the current orchestrator state
   */
  public getState(): OrchestratorState {
    return this.initialState;
  }

  /**
   * Gets the thread ID for this orchestrator instance
   */
  public getThreadId(): string {
    return this.threadId;
  }
}

/**
 * Creates a new WorkflowOrchestrator instance
 *
 * @param options Options for creating the orchestrator
 * @returns A new WorkflowOrchestrator instance
 */
export function createWorkflowOrchestrator(
  options: WorkflowOrchestratorOptions
): WorkflowOrchestrator {
  return new WorkflowOrchestrator(options);
}
