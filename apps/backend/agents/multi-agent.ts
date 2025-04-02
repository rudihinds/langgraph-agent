import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation } from "@langchain/langgraph";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";

interface MessageState {
  messages: Array<HumanMessage | AIMessage | SystemMessage>;
}

/**
 * Creates a multi-agent system with a researcher and writer agent
 * This uses a simplified approach with message passing
 */
export function createMultiAgentSystem() {
  // Create models with different personas
  const researcherModel = new ChatOpenAI({
    temperature: 0,
  });

  const writerModel = new ChatOpenAI({
    temperature: 0.7,
  });

  // Define function to run researcher agent
  async function runResearcher(state: MessageState) {
    const { messages } = state;

    // Check if the last message indicates we're done with research
    const lastMessage = messages[messages.length - 1];
    const lastContent = lastMessage.content?.toString() || "";
    if (lastContent.includes("[RESEARCH COMPLETE]")) {
      return { messages };
    }

    // Create a system prompt for the researcher
    const researcherPrompt = new SystemMessage(
      "You are a skilled researcher. Your job is to research a topic thoroughly and " +
        "provide detailed findings. Be factual and comprehensive. " +
        "When you have completed your research, end your response with the tag [RESEARCH COMPLETE]."
    );

    // Generate a response from the researcher
    const researcherResponse = await researcherModel.invoke([
      researcherPrompt,
      ...messages,
    ]);

    return {
      messages: [...messages, researcherResponse],
    };
  }

  // Define function to run writer agent
  async function runWriter(state: MessageState) {
    const { messages } = state;

    // Create a system prompt for the writer
    const writerPrompt = new SystemMessage(
      "You are a skilled writer. Your job is to take the research findings provided " +
        "and create a well-structured, engaging outline. Focus on clarity and organization. " +
        "Review all the previous messages to find the research that was completed."
    );

    // Generate a response from the writer
    const writerResponse = await writerModel.invoke([
      writerPrompt,
      ...messages,
    ]);

    return {
      messages: [...messages, writerResponse],
    };
  }

  // Define routing logic
  function shouldContinue(state: MessageState) {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];
    const lastContent = lastMessage.content?.toString() || "";

    // If research is complete, move to writing
    if (lastContent.includes("[RESEARCH COMPLETE]")) {
      return "writer";
    }

    // If last message was from human or research isn't complete yet, continue research
    if (
      lastMessage instanceof HumanMessage ||
      !lastContent.includes("[RESEARCH COMPLETE]")
    ) {
      return "researcher";
    }

    // If we've already gone through writing, we're done
    return "__end__";
  }

  // Create the graph
  const workflow = new StateGraph(MessagesAnnotation)
    .addNode("researcher", runResearcher)
    .addNode("writer", runWriter)
    .addEdge("__start__", "researcher")
    .addConditionalEdges("researcher", shouldContinue, {
      researcher: "researcher",
      writer: "writer",
    })
    .addEdge("writer", "__end__");

  // Compile the graph
  return workflow.compile();
}

/**
 * Example usage of the multi-agent system
 */
export async function runMultiAgentExample(topic: string) {
  const agentSystem = createMultiAgentSystem();

  // Initialize with a question
  const initialState = {
    messages: [
      new HumanMessage(`Research and create an outline about: ${topic}`),
    ],
  };

  // Define config
  const config: RunnableConfig = {
    recursionLimit: 10,
  };

  // Run the agent system
  const result = await agentSystem.invoke(initialState, config);

  // Extract the research and outline from the messages
  const messages = result.messages;
  let researchFindings = "";
  let outline = "";

  // Find the research findings and outline in the messages
  for (const message of messages) {
    if (message instanceof AIMessage) {
      const content = message.content?.toString() || "";
      if (content.includes("[RESEARCH COMPLETE]")) {
        researchFindings = content.replace("[RESEARCH COMPLETE]", "").trim();
      } else if (researchFindings && outline === "") {
        outline = content;
      }
    }
  }

  return {
    finalMessages: messages,
    researchFindings,
    outline,
  };
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMultiAgentExample("The history and impact of artificial intelligence")
    .then((result) => {
      console.log("Research Findings:\n", result.researchFindings);
      console.log("\nOutline:\n", result.outline);
    })
    .catch(console.error);
}
