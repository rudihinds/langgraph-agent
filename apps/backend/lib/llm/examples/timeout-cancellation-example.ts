/**
 * Example of using TimeoutManager with LangGraph and Loop Prevention
 * 
 * This example demonstrates how to integrate timeout safeguards and cancellation
 * support with the loop prevention utilities in a LangGraph workflow.
 */

import { StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { configureLoopPrevention } from "../loop-prevention";
import { configureTimeouts, TimeoutManager } from "../timeout-manager";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

// Define our state with the messages channel
const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),
  iterations: Annotation<number>({
    default: () => 0,
  }),
});

/**
 * Example of a simulated research node that might take a long time
 */
async function researchNode(state: typeof StateAnnotation.State) {
  console.log(`Research node called (iteration ${state.iterations})`);
  
  // Simulate a long-running research operation
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    messages: [
      new AIMessage({
        content: `I've completed my research on iteration ${state.iterations}.`,
      }),
    ],
    iterations: state.iterations + 1,
  };
}

/**
 * Example of a regular node with standard timeout
 */
async function processNode(state: typeof StateAnnotation.State) {
  console.log(`Process node called (iteration ${state.iterations})`);
  
  // Simulate processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    messages: [
      new AIMessage({
        content: `Processed data on iteration ${state.iterations}.`,
      }),
    ],
  };
}

/**
 * Node that calls an LLM
 */
async function llmNode(state: typeof StateAnnotation.State) {
  console.log(`LLM node called (iteration ${state.iterations})`);
  
  const llm = new ChatOpenAI({
    temperature: 0,
    maxTokens: 200,
  });
  
  const response = await llm.invoke([
    new HumanMessage(`This is iteration ${state.iterations}. Generate a brief response.`),
  ]);
  
  return {
    messages: [response],
  };
}

/**
 * Determines if the workflow should continue or end
 */
function shouldContinue(state: typeof StateAnnotation.State) {
  // Check if we've reached the maximum iterations
  if (state.iterations >= 3) {
    console.log("Reached maximum iterations, ending workflow");
    return "END";
  }
  
  // Continue the loop
  if (state.iterations % 2 === 0) {
    return "research";
  } else {
    return "process";
  }
}

/**
 * Create and run the workflow
 */
async function runWorkflow() {
  try {
    // Create the graph
    const graph = new StateGraph(StateAnnotation)
      .addNode("research", researchNode)
      .addNode("process", processNode)
      .addNode("llm", llmNode)
      .addConditionalEdges("research", shouldContinue)
      .addConditionalEdges("process", shouldContinue)
      .addEdge("llm", "research")
      .addEdge("__start__", "llm");
    
    // Configure loop prevention
    configureLoopPrevention(graph, {
      maxIterations: 10,
      autoAddTerminationNodes: true,
    });
    
    // Configure timeouts with generous limits for research nodes
    const { graph: timeoutGraph, timeoutManager } = configureTimeouts(graph, {
      workflowTimeout: 5 * 60 * 1000, // 5 minutes for the entire workflow
      researchNodes: ["research"],
      defaultTimeouts: {
        research: 3 * 60 * 1000,  // 3 minutes for research nodes
        default: 30 * 1000,       // 30 seconds for regular nodes
      },
      onTimeout: (nodeName, elapsedTime) => {
        console.log(`Timeout in node "${nodeName}" after ${elapsedTime}ms`);
      },
      onCancellation: (reason) => {
        console.log(`Workflow cancelled: ${reason}`);
      }
    });
    
    // Compile the graph
    const app = timeoutGraph.compile();
    
    // Start the timeout manager
    timeoutManager.startWorkflow();
    
    // Run the workflow
    console.log("Starting workflow...");
    
    const result = await app.invoke({
      messages: [new HumanMessage("Let's start the workflow")],
      iterations: 0,
    });
    
    console.log("Workflow completed successfully!");
    console.log("Final state:", JSON.stringify(result, null, 2));
    
    // Clean up resources
    timeoutManager.cleanup();
  } catch (error) {
    // Handle cancellation errors
    if (error.name === "WorkflowCancellationError") {
      console.error(`Workflow was cancelled: ${error.message}`);
    } else {
      console.error("Error running workflow:", error);
    }
  }
}

// Run the example
if (require.main === module) {
  runWorkflow()
    .then(() => {
      console.log("Example completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Example failed:", error);
      process.exit(1);
    });
}