import { StateGraph } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { OrchestratorStateAnnotation, OrchestratorState, WorkflowStatus } from "./state.js";
import { OrchestratorConfig, createDefaultConfig } from "./configuration.js";
import { OrchestratorNode, createOrchestratorNode } from "./nodes.js";

/**
 * Create the orchestrator graph
 * @param config Configuration for the orchestrator
 * @returns Compiled StateGraph
 */
export function createOrchestratorGraph(config?: Partial<OrchestratorConfig>) {
  // Create config and node instance
  const orchestratorConfig = createDefaultConfig(config);
  const orchestratorNode = createOrchestratorNode(orchestratorConfig);
  
  // Create the state graph with our annotation
  const graph = new StateGraph(OrchestratorStateAnnotation);

  // Add the orchestrator nodes
  graph.addNode("initialize", async (state: OrchestratorState) => {
    return await orchestratorNode.initialize(state);
  });

  graph.addNode("analyze_input", async (state: OrchestratorState) => {
    return await orchestratorNode.analyzeUserInput(state);
  });

  graph.addNode("route_to_agent", async (state: OrchestratorState) => {
    // This node will trigger the appropriate agent based on the analysis
    if (!state.currentAgent) {
      return await orchestratorNode.handleError(state, {
        source: "route_to_agent",
        message: "No agent selected for routing",
        recoverable: false,
      });
    }
    
    // Get the latest user message to route
    const lastUserMessage = state.messages
      .slice()
      .reverse()
      .find(m => m instanceof HumanMessage) as HumanMessage | undefined;
      
    if (!lastUserMessage) {
      return await orchestratorNode.handleError(state, {
        source: "route_to_agent",
        message: "No user message found to route",
        recoverable: false,
      });
    }

    // Log the routing operation
    await orchestratorNode.logOperation(state, {
      type: "route_message",
      agentType: state.currentAgent,
      details: { messageContent: lastUserMessage.content.toString().substring(0, 100) + "..." },
    });

    // Route the message to the selected agent
    return await orchestratorNode.routeToAgent(
      state, 
      state.currentAgent, 
      lastUserMessage
    );
  });

  graph.addNode("handle_error", async (state: OrchestratorState) => {
    // This node handles any errors that might have occurred
    if (state.errors && state.errors.length > 0) {
      const latestError = state.errors[state.errors.length - 1];
      
      // Log error and determine if we can retry
      await orchestratorNode.logOperation(state, {
        type: "handle_error",
        details: { error: latestError },
      });

      // If recoverable and under max retries, attempt to retry
      if (latestError.recoverable && 
          (latestError.retryCount || 0) < (state.config.maxRetries || 3)) {
        // Wait before retry
        await new Promise(resolve => 
          setTimeout(resolve, state.config.retryDelay || 1000)
        );
        
        // Return to appropriate node based on error source
        return {
          status: "in_progress",
        };
      }
      
      // Otherwise mark as unrecoverable error
      return {
        status: "error",
      };
    }
    
    return {}; // No errors to handle
  });

  // Define the workflow with conditional edges
  graph.addEdge("__start__", "initialize");
  graph.addEdge("initialize", "analyze_input");
  
  // Define conditional routing based on the current status
  graph.addConditionalEdges(
    "analyze_input",
    (state: OrchestratorState) => {
      if (state.status === "error") {
        return "handle_error";
      }
      return "route_to_agent";
    },
    {
      handle_error: "handle_error",
      route_to_agent: "route_to_agent",
    }
  );
  
  // Add conditional routing from route_to_agent
  graph.addConditionalEdges(
    "route_to_agent",
    (state: OrchestratorState) => {
      if (state.status === "error") {
        return "handle_error";
      }
      return "__end__";
    },
    {
      handle_error: "handle_error",
      __end__: "__end__",
    }
  );
  
  // Connect error handling back to workflow or end
  graph.addConditionalEdges(
    "handle_error",
    (state: OrchestratorState) => {
      // If the error was handled and we're back to in_progress
      if (state.status === "in_progress") {
        // Look at the source of the error to determine where to go back to
        const lastError = state.errors[state.errors.length - 1];
        if (lastError.source === "analyzeUserInput") {
          return "analyze_input";
        }
        if (lastError.source === "route_to_agent") {
          return "route_to_agent";
        }
      }
      // Otherwise end the workflow
      return "__end__";
    },
    {
      analyze_input: "analyze_input",
      route_to_agent: "route_to_agent",
      __end__: "__end__",
    }
  );
  
  // Compile the graph
  return graph.compile();
}

/**
 * Run the orchestrator with an initial message
 * @param message Initial user message
 * @param config Configuration overrides
 * @returns Final state after execution
 */
export async function runOrchestrator(
  message: string | HumanMessage,
  config?: Partial<OrchestratorConfig>
) {
  const graph = createOrchestratorGraph(config);
  
  // Create initial state with message
  const initialMessage = typeof message === "string" 
    ? new HumanMessage(message) 
    : message;
    
  const initialState = {
    messages: [initialMessage],
  };
  
  // Execute the graph
  const result = await graph.invoke(initialState);
  
  return result;
}