import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

/**
 * Creates a simple ReAct agent using the prebuilt function
 * @returns The configured ReAct agent
 */
export function createSimpleAgent() {
  // Define the tools for the agent to use
  const agentTools = [new TavilySearchResults({ maxResults: 3 })];
  const agentModel = new ChatOpenAI({ temperature: 0 });

  // Initialize memory to persist state between graph runs
  const agentCheckpointer = new MemorySaver();
  const agent = createReactAgent({
    llm: agentModel,
    tools: agentTools,
    checkpointSaver: agentCheckpointer,
  });

  return agent;
}

/**
 * Creates a custom LangGraph agent with more control over the flow
 * @returns The configured StateGraph agent
 */
export function createCustomAgent() {
  // Define the tools for the agent to use
  const tools = [new TavilySearchResults({ maxResults: 3 })];
  const toolNode = new ToolNode(tools);

  // Create a model and give it access to the tools
  const model = new ChatOpenAI({
    temperature: 0,
  }).bindTools(tools);

  // Define the function that determines whether to continue or not
  function shouldContinue({ messages }: typeof MessagesAnnotation.State) {
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // If the LLM makes a tool call, then we route to the "tools" node
    if (lastMessage.tool_calls?.length) {
      return "tools";
    }
    // Otherwise, we stop (reply to the user) using the special "__end__" node
    return "__end__";
  }

  // Define the function that calls the model
  async function callModel(state: typeof MessagesAnnotation.State) {
    const response = await model.invoke(state.messages);

    // We return a list, because this will get added to the existing list
    return { messages: [response] };
  }

  // Define a new graph
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addEdge("__start__", "agent") // __start__ is a special name for the entrypoint
    .addNode("tools", toolNode)
    .addEdge("tools", "agent")
    .addConditionalEdges("agent", shouldContinue);

  // Compile it into a LangChain Runnable.
  return workflow.compile();
}

/**
 * Example usage of the agents
 */
async function example() {
  // Use the simple agent
  const simpleAgent = createSimpleAgent();
  const simpleResult = await simpleAgent.invoke(
    { messages: [new HumanMessage("what is the current weather in sf")] },
    { configurable: { thread_id: "simple-agent" } }
  );
  console.log("Simple Agent Result:");
  console.log(simpleResult.messages[simpleResult.messages.length - 1].content);

  // Use the custom agent
  const customAgent = createCustomAgent();
  const customResult = await customAgent.invoke({
    messages: [new HumanMessage("what is the current weather in nyc")],
  });
  console.log("\nCustom Agent Result:");
  console.log(customResult.messages[customResult.messages.length - 1].content);
}

// Only run the example if this file is executed directly
if (require.main === module) {
  example().catch(console.error);
}
