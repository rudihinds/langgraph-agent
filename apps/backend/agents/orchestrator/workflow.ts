import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, StateGraphArgs } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { v4 as uuidv4 } from "uuid";
import { HumanMessage } from "@langchain/core/messages";

import {
  OrchestratorState,
  getInitialOrchestratorState,
  OrchestratorStateAnnotation,
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
import { Logger } from "@/lib/logger.js";

// Initialize logger
const logger = Logger.getInstance();

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
   * Initial context for the orchestrator
   */
  initialContext?: Record<string, any>;

  /**
   * Thread ID for this orchestrator instance
   */
  threadId?: string;
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
   * Checkpointer instance for persistence
   */
  private readonly checkpointer: PostgresSaver;

  /**
   * Thread ID for this orchestrator instance (used for persistence)
   */
  private threadId: string;

  /**
   * Compiler instance for the state graph
   */
  private compiler: ReturnType<
    StateGraph<OrchestratorState>["compile"]
  > | null = null;

  /**
   * Creates a new WorkflowOrchestrator
   *
   * @param options Options for creating the orchestrator
   */
  constructor(options: WorkflowOrchestratorOptions) {
    this.userId = options.userId;
    this.projectId = options.projectId;
    this.config = mergeConfig(options.config);
    this.threadId = options.threadId || uuidv4();

    // --- Persistence Setup ---
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      logger.error(
        "DATABASE_URL environment variable is not set for Orchestrator."
      );
      throw new Error("Database connection URL is missing.");
    }
    this.checkpointer = PostgresSaver.fromConnString(dbUrl);

    // Create initial state
    this.initialState = getInitialOrchestratorState(
      this.userId,
      this.projectId
    );
    if (options.initialContext) {
      this.initialState.context = {
        ...this.initialState.context,
        ...options.initialContext,
      };
    }

    // Create the state graph using the Annotation, inferring the state type
    this.graph = new StateGraph(OrchestratorStateAnnotation);

    // Add nodes to the graph
    this.graph
      .addNode("analyzeUserQuery", analyzeUserQuery)
      .addNode("determineWorkflow", determineWorkflow)
      .addNode("startWorkflow", startWorkflow)
      .addNode("executeNextStep", executeNextStep)
      .addNode("completeWorkflow", completeWorkflow)
      .addNode("handleError", handleError);

    // Add edges and conditional logic
    this.graph.addEdge("analyzeUserQuery", "determineWorkflow");
    this.graph.addEdge("determineWorkflow", "startWorkflow");
    this.graph.addEdge("startWorkflow", "executeNextStep");
    this.graph.addEdge("completeWorkflow", END);
    this.graph.addEdge("handleError", END);

    // Conditional routing after executing a step
    this.graph.addConditionalEdges("executeNextStep", routeWorkflow, {
      continue: "executeNextStep",
      complete: "completeWorkflow",
      error: "handleError",
    });

    // Set the entry point
    this.graph.setEntryPoint("analyzeUserQuery");

    // Register pre-defined agents if provided
    if (options.agents && options.agents.length > 0) {
      // Consider making agent registration async or part of an init step
      // if it needs to modify state used *during* graph compilation/setup
      this.registerAgents(options.agents);
    }
  }

  /**
   * Initializes persistence and compiles the graph if not already done.
   */
  async initializePersistence() {
    if (!this.compiler) {
      try {
        logger.info("Setting up orchestrator persistence tables...");
        await this.checkpointer.setup();
        logger.info("Persistence tables setup complete. Compiling graph...");
        this.compiler = this.graph.compile({ checkpointer: this.checkpointer });
        logger.info("Orchestrator graph compiled with persistence.");
      } catch (error) {
        logger.error("Failed to initialize persistence or compile graph", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        throw error; // Re-throw critical initialization error
      }
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
      const agentId = options.id || uuidv4();
      options.id = agentId;
      this.initialState = await registerAgent(this.initialState, options);
      logger.info("Registered agent", {
        agentId: options.id,
        name: options.name,
      });
      return agentId;
    } catch (error: unknown) {
      let message = "An unknown error occurred during agent registration.";
      if (error instanceof Error) {
        message = error.message;
      }
      logger.error("Error registering agent", { error: message });
      throw new Error(`Failed to register agent: ${message}`);
    }
  }

  /**
   * Unregisters an agent from the orchestrator
   *
   * @param agentId ID of the agent to unregister
   */
  public unregisterAgent(agentId: string): void {
    // Similar caution applies here regarding direct initialState modification
    this.initialState = unregisterAgent(this.initialState, agentId);
    logger.info("Unregistered agent", { agentId });
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
   * @param threadId Optional thread ID to resume an existing session
   * @returns Result of the workflow execution
   */
  public async processQuery(
    query: string,
    context?: Record<string, any>,
    threadId?: string
  ): Promise<OrchestratorState> {
    await this.initializePersistence(); // Ensure compiled with persistence
    if (!this.compiler) {
      // Check compilation success
      throw new Error("Orchestrator graph failed to compile.");
    }

    const currentThreadId = threadId || this.threadId;

    // Initial input for the graph for this run.
    // If resuming, the checkpointer loads the actual state.
    // We only provide the *new* information (message, context).
    const invocationState = {
      messages: [new HumanMessage(query)],
      context: { ...this.initialState.context, ...context }, // Merge context
    };

    const config = {
      configurable: {
        thread_id: currentThreadId,
      },
    };

    logger.info(`Processing query in orchestrator`, {
      threadId: currentThreadId,
    });

    try {
      const result = await this.compiler.invoke(invocationState, config);
      logger.info(`Orchestrator query processing complete`, {
        threadId: currentThreadId,
      });
      return result;
    } catch (error: unknown) {
      let message = "An unknown error occurred during query processing.";
      let stack: string | undefined;
      if (error instanceof Error) {
        message = error.message;
        stack = error.stack;
      }
      logger.error(`Error processing orchestrator query`, {
        threadId: currentThreadId,
        error: message,
        stack,
      });
      throw error; // Re-throw original error after logging
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
    workflowTemplate: any, // Consider defining a type for WorkflowTemplate
    context?: Record<string, any>,
    threadId?: string
  ): Promise<OrchestratorState> {
    await this.initializePersistence();
    if (!this.compiler) {
      throw new Error("Orchestrator graph failed to compile.");
    }
    const currentThreadId = threadId || uuidv4(); // Generate new thread ID if not provided

    logger.info("Executing workflow directly", {
      workflowId: workflowTemplate.id,
      threadId: currentThreadId,
    });

    try {
      const inputState: Partial<OrchestratorState> = {
        // Minimal state needed to start this specific workflow
        workflows: [workflowTemplate],
        currentWorkflowId: workflowTemplate.id,
        context: { ...this.initialState.context, ...context },
        userId: this.userId, // Pass necessary identifiers
        projectId: this.projectId,
      };

      const config = {
        configurable: { thread_id: currentThreadId },
      };

      // Invoke, potentially starting at a specific node if applicable
      const result = await this.compiler.invoke(inputState, config);

      logger.info("Direct workflow execution complete", {
        threadId: currentThreadId,
      });
      return result;
    } catch (error: unknown) {
      let message =
        "An unknown error occurred during direct workflow execution.";
      if (error instanceof Error) {
        message = error.message;
      }
      logger.error("Error executing workflow", {
        workflowId: workflowTemplate.id,
        threadId: currentThreadId,
        error: message,
      });
      throw error; // Re-throw original error after logging
    }
  }

  /**
   * Gets the current orchestrator state
   */
  public getState(): OrchestratorState {
    // Caution: might not reflect persisted state if invoked separately
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
  options: WorkflowOrchestratorOptions & { threadId?: string }
): WorkflowOrchestrator {
  return new WorkflowOrchestrator(options);
}
