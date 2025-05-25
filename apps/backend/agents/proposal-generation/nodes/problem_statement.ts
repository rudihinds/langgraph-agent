/**
 * Problem Statement Node
 *
 * This node is responsible for generating the problem statement section of a proposal.
 * It leverages tools for deep research and company knowledge to enhance its analysis.
 */

import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { Logger } from "../../../lib/logger.js";
import { ENV } from "../../../lib/config/env.js";
import {
  OverallProposalState,
  SectionData,
  SectionType,
  SectionProcessingStatus,
  ProcessingStatus,
  SectionToolInteraction,
} from "../../../state/proposal.state.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph } from "@langchain/langgraph";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize logger
const logger = Logger.getInstance();

// Define the tools
const deepResearchTool = tool(
  async ({ query }) => {
    // In a production implementation, this would call a vector store or API
    logger.info(`Executing Deep Research Tool with query: "${query}"`);

    // Simple mock implementation
    if (query.toLowerCase().includes("funding")) {
      return `The funder has a history of supporting initiatives that address root causes of social issues.
Their recent grants show preference for evidence-based approaches and community engagement.
They particularly value sustainable impact and clear measurement strategies.
The funder has allocated $2.5 million for proposals in this area, with typical grants ranging from $100,000 to $350,000.`;
    }

    if (query.toLowerCase().includes("problem")) {
      return `The RFP identifies several key challenges:
1. Lack of coordination among service providers
2. Limited access to services in rural communities
3. High recidivism rates due to inadequate support systems
4. Insufficient data collection for impact measurement
5. Funding gaps for preventative programs`;
    }

    return `Based on research of the funder's priorities and recent funded projects, 
they are looking for innovative approaches to systemic problems with clear outcomes and sustainability plans.
The funder values collaborative approaches and has shown interest in programs that leverage technology
to improve service delivery and data collection.`;
  },
  {
    name: "Deep_Research_Tool",
    description:
      "For exploring how the funder views this problem, finding relevant data, or discovering contextual information.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "The research query about the funder's perspective or relevant data"
        ),
    }),
  }
);

const companyKnowledgeTool = tool(
  async ({ query }) => {
    // In a production implementation, this would query a knowledge base or RAG system
    logger.info(`Executing Company Knowledge Tool with query: "${query}"`);

    // Simple mock implementation
    if (query.toLowerCase().includes("experience")) {
      return `The applicant organization has 7 years of experience addressing similar challenges.
Key achievements include:
- Developed an integrated service model that reduced client drop-off by 42%
- Partnered with 12 community organizations to expand service reach
- Published 3 research papers on effective intervention strategies
- Successfully secured and managed over $1.2M in grant funding`;
    }

    if (query.toLowerCase().includes("approach")) {
      return `The applicant's approach is characterized by:
1. Human-centered design principles
2. Data-driven decision making
3. Collaborative partnerships with stakeholders
4. Emphasis on building sustainable solutions
5. Focus on capacity building within communities served`;
    }

    return `The applicant organization has expertise in developing community-based solutions
with a track record of successful implementation in diverse settings.
Their team includes professionals with backgrounds in social work, data science,
program evaluation, and community organizing.`;
  },
  {
    name: "Company_Knowledge_RAG",
    description:
      "For identifying the applicant's perspective, experiences, and unique approaches related to this problem.",
    schema: z.object({
      query: z
        .string()
        .describe("The query about the applicant's perspective or experiences"),
    }),
  }
);

// Combine tools
const tools = [deepResearchTool, companyKnowledgeTool];

// Create a ToolNode from the tools
const toolsNode = new ToolNode(tools);

/**
 * Main entry point for problem statement generation
 * Sets up the initial state for the problem statement generation subgraph
 *
 * @param state Current proposal state
 * @returns Updated partial state with problem statement or error information
 */
export async function problemStatementNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Starting problem statement node", {
    threadId: state.activeThreadId,
  });

  try {
    // Input validation
    if (!state.rfpDocument?.text) {
      const errorMsg =
        "RFP document text is missing for problem statement generation.";
      logger.error(errorMsg, { threadId: state.activeThreadId });
      return {
        errors: [...state.errors, errorMsg],
        status: ProcessingStatus.ERROR,
      };
    }

    // Update section status to running
    const sectionsMap = new Map(state.sections);
    const currentSection = sectionsMap.get(SectionType.PROBLEM_STATEMENT) || {
      id: SectionType.PROBLEM_STATEMENT,
      title: "Problem Statement",
      content: "",
      status: ProcessingStatus.NOT_STARTED,
      lastUpdated: new Date().toISOString(),
    };

    // Update status if not already running
    if (currentSection.status !== ProcessingStatus.RUNNING) {
      currentSection.status = ProcessingStatus.RUNNING;
      currentSection.lastUpdated = new Date().toISOString();
      sectionsMap.set(SectionType.PROBLEM_STATEMENT, currentSection);
    }

    // Get or initialize section tool messages
    const sectionKey = SectionType.PROBLEM_STATEMENT;
    const existingInteraction = state.sectionToolMessages?.[sectionKey] || {
      hasPendingToolCalls: false,
      messages: [],
      lastUpdated: new Date().toISOString(),
    };

    // Create a subgraph state for handling tool interactions
    const initialMessages = prepareInitialMessages(
      state,
      existingInteraction.messages
    );

    // Execute the problem statement subgraph
    const result = await executeProblemStatementGraph(
      initialMessages,
      state,
      existingInteraction
    );

    // If the result contains content, update the section
    if (result.content) {
      currentSection.content = result.content;
      currentSection.status = ProcessingStatus.READY_FOR_EVALUATION;
      currentSection.lastUpdated = new Date().toISOString();
      sectionsMap.set(SectionType.PROBLEM_STATEMENT, currentSection);
    }

    // Update the section tool messages
    const updatedSectionToolMessages = {
      ...(state.sectionToolMessages || {}),
      [sectionKey]: {
        hasPendingToolCalls: false,
        messages: result.messages,
        lastUpdated: new Date().toISOString(),
      },
    };

    // Return the updated state
    return {
      sections: sectionsMap,
      currentStep: "problem_statement_evaluation",
      status: ProcessingStatus.RUNNING,
      sectionToolMessages: updatedSectionToolMessages,
    };
  } catch (error: any) {
    // Handle error cases
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to generate problem statement: ${errorMessage}`, {
      threadId: state.activeThreadId,
      error,
    });

    return {
      errors: [
        ...state.errors,
        `Failed to generate problem statement: ${errorMessage}`,
      ],
      status: ProcessingStatus.ERROR,
    };
  }
}

/**
 * Executes the problem statement generation subgraph
 *
 * @param initialMessages Initial messages for the model
 * @param state Overall proposal state
 * @param existingInteraction Existing tool interaction data
 * @returns Result containing generated content and messages
 */
async function executeProblemStatementGraph(
  initialMessages: BaseMessage[],
  state: OverallProposalState,
  existingInteraction: SectionToolInteraction
): Promise<{ content: string; messages: BaseMessage[] }> {
  // Define state annotation for the subgraph
  const SubgraphStateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
      reducer: messagesStateReducer,
      default: () => initialMessages,
    }),
  });

  // Set up the model with tools
  const model = new ChatOpenAI({
    temperature: 0.7,
    modelName: ENV.DEFAULT_MODEL.includes("openai")
      ? ENV.DEFAULT_MODEL.split("/")[1]
      : "gpt-4-1106-preview",
  }).bindTools(tools);

  // Create the model node function
  async function modelNode(nodeState: typeof SubgraphStateAnnotation.State) {
    const messages = nodeState.messages;
    const response = await model.invoke(messages);
    return { messages: [response] };
  }

  // Create routing function
  function shouldContinue(nodeState: typeof SubgraphStateAnnotation.State) {
    const messages = nodeState.messages;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    // If there are tool calls, route to tools node
    if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
      return "tools";
    }

    // Otherwise, we're done
    return "__end__";
  }

  // Create and configure the subgraph
  const subgraph = new StateGraph(SubgraphStateAnnotation)
    .addNode("agent", modelNode)
    .addNode("tools", toolsNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent");

  // Compile and execute the subgraph
  const app = subgraph.compile();
  const finalState = await app.invoke({
    messages: initialMessages,
  });

  // Extract the final content from the last AI message
  const messages = finalState.messages;
  const lastMessage = messages[messages.length - 1] as AIMessage;
  const content = lastMessage.content as string;

  return { content, messages };
}

/**
 * Prepares initial messages for the model based on the state
 *
 * @param state Current proposal state
 * @param existingMessages Any existing messages from previous interactions
 * @returns Array of BaseMessage objects for the model
 */
function prepareInitialMessages(
  state: OverallProposalState,
  existingMessages: BaseMessage[]
): BaseMessage[] {
  // Extract relevant data
  const rfpText = state.rfpDocument?.text || "";
  const research = state.researchResults
    ? JSON.stringify(state.researchResults)
    : "No research results available";

  // Get or generate values for required fields
  const funder = extractFunderFromState(state);
  const applicant = extractApplicantFromState(state);
  const wordLength = getWordLength(state);

  // Format the system prompt
  let systemPrompt = createPromptFromTemplate(
    rfpText,
    research,
    funder,
    applicant,
    wordLength
  );

  // Check for revision guidance
  const revisionGuidance = getRevisionGuidance(
    state,
    SectionType.PROBLEM_STATEMENT
  );
  if (revisionGuidance) {
    systemPrompt += `\n\nREVISION GUIDANCE: ${revisionGuidance}`;
  }

  // If we have existing messages, use them after the system message
  if (existingMessages.length > 0) {
    return [new SystemMessage({ content: systemPrompt }), ...existingMessages];
  }

  // Otherwise, just include the system message
  return [new SystemMessage({ content: systemPrompt })];
}

/**
 * Creates a prompt from the template file or string
 */
function createPromptFromTemplate(
  rfpText: string,
  research: string,
  funder: string,
  applicant: string,
  wordLength: string
): string {
  // Try to load prompt from file
  try {
    const templatePath = join(
      __dirname,
      "../../../prompts/section_generators/problem_statement.prompt.txt"
    );
    const template = readFileSync(templatePath, "utf-8");

    // Replace variables in template
    return template
      .replace("${rfpText}", rfpText)
      .replace("${research}", research)
      .replace("${funder}", funder)
      .replace("${applicant}", applicant)
      .replace("${wordLength}", wordLength);
  } catch (err) {
    // Fallback to inline template if file not found
    return `You are an expert proposal writer tasked with writing the Problem Statement section of a grant proposal.

The Problem Statement should clearly articulate the need or challenge being addressed, provide relevant data and context to support this need, and briefly introduce how the applicant plans to address it. Your writing should be compelling, evidence-based, and aligned with the funder's priorities.

Request for Proposal (RFP) text:
${rfpText}

Research analysis:
${research}

Funder: ${funder}
Applicant: ${applicant}
Target word count: ${wordLength}

If you need additional depth or specific details, you have access to:

Deep_Research_Tool: For exploring how the funder views this problem, finding relevant data, or discovering contextual information.
Company_Knowledge_RAG: For identifying the applicant's perspective, experiences, and unique approaches related to this problem.

Your response should ONLY include the text for the Problem Statement section. Write in a professional tone with clear, concise language.`;
  }
}

/**
 * Extracts funder information from state
 */
function extractFunderFromState(state: OverallProposalState): string {
  // Extract from state if available
  if (state.funder?.name) {
    return state.funder.name;
  }

  // Extract from research results if available
  if (state.researchResults?.funder) {
    return state.researchResults.funder;
  }

  if (state.researchResults?.funderName) {
    return state.researchResults.funderName;
  }

  // Extract from solution results if available
  if (state.solutionResults?.funder) {
    return state.solutionResults.funder;
  }

  // Default value
  return "The funder";
}

/**
 * Extracts applicant information from state
 */
function extractApplicantFromState(state: OverallProposalState): string {
  // Extract from state if available
  if (state.applicant?.name) {
    return state.applicant.name;
  }

  // Extract from research results if available
  if (state.researchResults?.applicant) {
    return state.researchResults.applicant;
  }

  if (state.researchResults?.applicantName) {
    return state.researchResults.applicantName;
  }

  // Extract from solution results if available
  if (state.solutionResults?.applicant) {
    return state.solutionResults.applicant;
  }

  // Default value
  return "Our organization";
}

/**
 * Gets the recommended word length for a section
 * @param state Current proposal state
 * @returns The recommended word length
 */
function getWordLength(state: OverallProposalState): string {
  if (!state.wordLength) {
    return "500-1000 words";
  }

  // Fix: Properly access the properties of the WordLength interface
  const min = state.wordLength.min || 500;
  const max = state.wordLength.max || 1000;
  const target = state.wordLength.target;

  if (target) {
    return `approximately ${target} words`;
  }

  return `${min}-${max} words`;
}

/**
 * Checks for revision guidance for regenerating a section
 * @param state Current proposal state
 * @param sectionType The type of section
 * @returns Revision guidance or null
 */
function getRevisionGuidance(
  state: OverallProposalState,
  sectionType: SectionType
): string | null {
  const section = state.sections.get(sectionType);

  // Look for revision guidance in the metadata or user feedback
  if (section && section.status === ProcessingStatus.STALE) {
    // In a real implementation, we would look for guidance in user feedback
    // or section metadata. For now we'll return null
    return null;
  }

  return null;
}
