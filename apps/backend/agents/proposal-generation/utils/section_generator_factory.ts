/**
 * Section Generator Factory
 *
 * This utility creates consistent section generator nodes for proposal sections.
 * It follows modern LangGraph conventions for state management, tool usage, and messaging.
 */

import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { createModel } from "@/lib/llm/model-factory.js";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateGraph, END } from "@langchain/langgraph";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { Logger } from "../../../lib/logger.js";
import { ENV } from "../../../lib/config/env.js";
import {
  OverallProposalState,
  SectionType,
  ProcessingStatus,
  SectionToolInteraction,
} from "../../../state/proposal.state.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableConfig } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const logger = Logger.getInstance();

type TemplateVariables = {
  [key: string]: string;
};

// Define state annotation properly using Annotation.Root
export const SectionStateAnnotation = Annotation.Root({
  // Conversation history for the section-specific sub‑graph
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer, // use built‑in reducer for message arrays
    default: () => [],
  }),

  // The final generated content for this section (updated once finished)
  content: Annotation<string | null>({
    // simple last‑value‑wins behaviour
    value: (_existing, incoming) => incoming,
    default: () => null,
  }),

  // Cached prompt template (optional – may be useful for debugging)
  prompt_template: Annotation<string>({
    value: (_existing, incoming) => incoming,
    default: () => "",
  }),

  // Map of template variables actually substituted into the prompt
  template_variables: Annotation<TemplateVariables>({
    value: (_existing, incoming) => incoming,
    default: () => ({}),
  }),
});

// Helper type for strongly‑typed state throughout this file
export type SectionGenerationState = typeof SectionStateAnnotation.State;

// Define the standard section tools - shared across all section generators
export const sectionTools = [
  // Research tool for funder information
  new DynamicStructuredTool({
    name: "research_tool",
    description:
      "For exploring the funder's perspective, finding relevant data, or discovering contextual information.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "The research query about the funder's perspective or relevant data"
        ),
    }),
    func: async ({ query }) => {
      logger.info(`Research tool called with query: ${query}`);
      return JSON.stringify({
        results: [
          {
            title: "Search Result",
            content:
              "This is a placeholder for real search results about the funder.",
          },
        ],
      });
    },
  }),

  // Company knowledge tool for applicant information
  new DynamicStructuredTool({
    name: "company_knowledge_tool",
    description:
      "For identifying the applicant's perspective, experiences, and unique approaches related to this problem.",
    schema: z.object({
      query: z
        .string()
        .describe("The query about the applicant's perspective or experiences"),
    }),
    func: async ({ query }) => {
      logger.info(`Company knowledge tool called with query: ${query}`);
      return JSON.stringify({
        results: [
          {
            title: "Organization Information",
            content:
              "This is a placeholder for real information about the applicant organization.",
          },
        ],
      });
    },
  }),
];

/**
 * Factory function to create section generator nodes
 *
 * @param sectionType - The type of section to generate (e.g., PROBLEM_STATEMENT)
 * @param promptTemplatePath - Path to the prompt template file relative to prompts directory
 * @param fallbackPromptTemplate - Fallback template to use if file not found
 * @param additionalTools - Optional additional tools specific to this section
 * @returns A node function that handles section generation
 */
export function createSectionGeneratorNode(
  sectionType: SectionType,
  promptTemplatePath: string,
  fallbackPromptTemplate: string,
  additionalTools: any[] = []
) {
  // Create the tools node once per generator
  const tools = [...sectionTools, ...additionalTools];
  const toolsNode = new ToolNode(tools);

  return async function sectionGeneratorNode(
    state: OverallProposalState
  ): Promise<Partial<OverallProposalState>> {
    logger.info(`Starting ${sectionType} generator node`, {
      threadId: state.activeThreadId,
    });

    try {
      // Input validation
      if (!state.rfpDocument?.text) {
        const errorMsg = `RFP document text is missing for ${sectionType} generation.`;
        logger.error(errorMsg, { threadId: state.activeThreadId });
        return {
          errors: [...state.errors, errorMsg],
          status: ProcessingStatus.ERROR,
        };
      }

      // Update section status to running
      const sectionsMap = new Map(state.sections);
      const currentSection = sectionsMap.get(sectionType) || {
        id: sectionType,
        title: getSectionTitle(sectionType),
        content: "",
        status: ProcessingStatus.NOT_STARTED,
        lastUpdated: new Date().toISOString(),
      };

      // Update status if not already running
      if (currentSection.status !== ProcessingStatus.RUNNING) {
        currentSection.status = ProcessingStatus.RUNNING;
        currentSection.lastUpdated = new Date().toISOString();
        sectionsMap.set(sectionType, currentSection);
      }

      // Get or initialize section tool messages
      const existingInteraction = state.sectionToolMessages?.[sectionType] || {
        hasPendingToolCalls: false,
        messages: [],
        lastUpdated: new Date().toISOString(),
      };

      // Create initial messages for the model
      const initialMessages = prepareInitialMessages(
        state,
        sectionType,
        promptTemplatePath,
        fallbackPromptTemplate,
        existingInteraction.messages
      );

      // Execute the section generation subgraph
      const result = await executeSectionGenerationGraph(
        initialMessages,
        state,
        tools,
        toolsNode
      );

      // If the result contains content, update the section
      if (result.content) {
        currentSection.content = result.content;
        // Update status to READY_FOR_EVALUATION to trigger evaluation
        currentSection.status = ProcessingStatus.READY_FOR_EVALUATION;
        currentSection.lastUpdated = new Date().toISOString();
        sectionsMap.set(sectionType, currentSection);
      }

      // Update the section tool messages
      const updatedSectionToolMessages = {
        ...(state.sectionToolMessages || {}),
        [sectionType]: {
          hasPendingToolCalls: false,
          messages: result.messages,
          lastUpdated: new Date().toISOString(),
        },
      };

      // Return the updated state
      return {
        sections: sectionsMap,
        status: ProcessingStatus.RUNNING,
        sectionToolMessages: updatedSectionToolMessages,
      };
    } catch (error: any) {
      // Handle error cases
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Failed to generate ${sectionType}: ${errorMessage}`, {
        threadId: state.activeThreadId,
        error,
      });

      return {
        errors: [
          ...state.errors,
          `Failed to generate ${sectionType}: ${errorMessage}`,
        ],
        status: ProcessingStatus.ERROR,
      };
    }
  };
}

/**
 * Executes the section generation subgraph
 *
 * @param initialMessages - Initial messages for the model
 * @param state - Overall proposal state
 * @param tools - Tools available to the model
 * @param toolsNode - ToolNode for handling tool calls
 * @returns Result containing generated content and messages
 */
async function executeSectionGenerationGraph(
  initialMessages: BaseMessage[],
  state: OverallProposalState,
  tools: any[],
  toolsNode: ToolNode
): Promise<{ content: string; messages: BaseMessage[] }> {
  // Set up the model with tools
  const model = createModel(undefined, {
    temperature: 0.7,
  }).bindTools(tools);

  // Node name constants for readability
  const AGENT_NODE = "agent";
  const TOOLS_NODE = "tools";

  // Core LLM call node (takes SectionGenerationState)
  async function modelNode(state: SectionGenerationState) {
    try {
      const response = await model.invoke(state.messages);
      return { messages: [response] };
    } catch (error) {
      logger.error("Error in model node:", error);
      return {
        messages: [
          new AIMessage(
            "I encountered an error processing your request. Please try again."
          ),
        ],
      };
    }
  }

  // Create router function with proper type signature for LangGraph
  function routeToNextNode(state: SectionGenerationState) {
    if (!state.messages || state.messages.length === 0) {
      return END;
    }

    const lastMessage = state.messages[state.messages.length - 1];
    if (
      lastMessage instanceof AIMessage &&
      lastMessage.tool_calls &&
      lastMessage.tool_calls.length > 0
    ) {
      return TOOLS_NODE;
    }

    return END;
  }

  // Build sub‑graph using the annotation
  const workflow = new StateGraph(SectionStateAnnotation)
    .addNode(AGENT_NODE, modelNode)
    .addNode(TOOLS_NODE, toolsNode);

  // Add initial edge from __start__ to the agent node
  workflow.addEdge("__start__", AGENT_NODE as any);

  // Conditional routing after each agent response
  workflow.addConditionalEdges(AGENT_NODE as any, routeToNextNode as any, {
    [TOOLS_NODE]: TOOLS_NODE as any,
    __end__: "__end__",
  });

  // Tools node loops back to the agent once tool call results are injected
  workflow.addEdge(TOOLS_NODE as any, AGENT_NODE as any);

  // Compile the graph
  const app = workflow.compile();

  // Execute with error handling
  try {
    const finalState = await app.invoke({
      messages: initialMessages,
    });

    // Extract the final content from the last AI message
    const messages = finalState.messages as BaseMessage[];
    let content = "No content generated";

    if (messages && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage instanceof AIMessage) {
        content =
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : "Generated content not available as text";
      }
    }

    return { content, messages };
  } catch (error) {
    logger.error("Error executing section generation subgraph:", error);
    // Return a fallback response
    return {
      content: "Unable to generate section content due to an error.",
      messages: [
        ...initialMessages,
        new AIMessage("Unable to generate section content due to an error."),
      ],
    };
  }
}

/**
 * Prepares initial messages for the model based on the state
 *
 * @param state - Current proposal state
 * @param sectionType - The type of section being generated
 * @param promptTemplatePath - Path to the prompt template file
 * @param fallbackPromptTemplate - Fallback template to use if file not found
 * @param existingMessages - Any existing messages from previous interactions
 * @returns Array of BaseMessage objects for the model
 */
function prepareInitialMessages(
  state: OverallProposalState,
  sectionType: SectionType,
  promptTemplatePath: string,
  fallbackPromptTemplate: string,
  existingMessages: BaseMessage[] = []
): BaseMessage[] {
  // Extract relevant data for template variables
  let systemPrompt: string;

  try {
    // Try to load prompt from file
    const promptPath = join(__dirname, "..", promptTemplatePath);
    let promptTemplate = readFileSync(promptPath, "utf-8");

    // Create a map of template variables to replace
    const variables: Record<string, string> = {
      research_results: state.researchResults
        ? JSON.stringify(state.researchResults)
        : "No research results available",
      problem_statement: getSectionContent(
        state,
        SectionType.PROBLEM_STATEMENT
      ),
      solution: getSectionContent(state, SectionType.SOLUTION),
      organizational_capacity: getSectionContent(
        state,
        SectionType.ORGANIZATIONAL_CAPACITY
      ),
      implementation_plan: getSectionContent(
        state,
        SectionType.IMPLEMENTATION_PLAN
      ),
      evaluation_approach: getSectionContent(state, SectionType.EVALUATION),
      budget: getSectionContent(state, SectionType.BUDGET),
      connection_pairs: state.connections
        ? JSON.stringify(state.connections)
        : "[]",
      solution_sought: "Solution sought from RFP", // General fallback
      funder_name: extractFunderFromState(state),
      applicant_name: extractApplicantFromState(state),
      word_length: getWordLength(state, sectionType),
    };

    // Replace all variables in the template
    for (const [key, value] of Object.entries(variables)) {
      const tagPattern = new RegExp(
        `<${key}>([\\s\\S]*?){${key}}([\\s\\S]*?)</${key}>`,
        "g"
      );
      promptTemplate = promptTemplate.replace(
        tagPattern,
        `<${key}>${value}</${key}>`
      );
    }

    systemPrompt = promptTemplate;
  } catch (err) {
    logger.warn(
      `Prompt template file not found: ${promptTemplatePath}, using fallback`
    );
    // Use fallback template if file not found
    systemPrompt = fallbackPromptTemplate
      .replace(/\${rfpText}/g, state.rfpDocument?.text || "")
      .replace(
        /\${research}/g,
        state.researchResults
          ? JSON.stringify(state.researchResults)
          : "No research results available"
      )
      .replace(/\${funder}/g, extractFunderFromState(state))
      .replace(/\${applicant}/g, extractApplicantFromState(state))
      .replace(/\${wordLength}/g, getWordLength(state, sectionType))
      .replace(/\${sectionType}/g, sectionType);
  }

  // Check for revision guidance
  const revisionGuidance = getRevisionGuidance(state, sectionType);
  if (revisionGuidance) {
    systemPrompt += `\n\nREVISION GUIDANCE: ${revisionGuidance}`;
  }

  // Check for evaluation feedback if this is a revision
  const section = state.sections.get(sectionType);
  if (section?.evaluation && section.status === ProcessingStatus.RUNNING) {
    const evaluation = section.evaluation;

    // Add general feedback if available
    if (evaluation.feedback) {
      systemPrompt += `\n\nEVALUATION FEEDBACK: ${evaluation.feedback}\n\n`;
    }

    // Add overall score
    systemPrompt += `Overall Score: ${evaluation.score || 0}/100\n\n`;

    // Add category scores if available
    if (evaluation.categories) {
      systemPrompt += "Category Scores:\n";
      Object.entries(evaluation.categories).forEach(([category, data]) => {
        systemPrompt += `- ${category}: ${data.score}/100 - ${data.feedback}\n`;
      });
    }
  }

  // If we have existing messages, use them after the system message
  if (existingMessages.length > 0) {
    return [new SystemMessage({ content: systemPrompt }), ...existingMessages];
  }

  // Otherwise, just include the system message
  return [new SystemMessage({ content: systemPrompt })];
}

/**
 * Gets the content of a section if it exists
 */
function getSectionContent(
  state: OverallProposalState,
  sectionType: SectionType
): string {
  const section = state.sections.get(sectionType);
  return section?.content || `No ${sectionType} content available yet`;
}

/**
 * Gets the section title from a section type
 */
function getSectionTitle(sectionType: SectionType): string {
  const titles: Record<string, string> = {
    [SectionType.PROBLEM_STATEMENT]: "Problem Statement",
    [SectionType.ORGANIZATIONAL_CAPACITY]: "Organizational Capacity",
    [SectionType.SOLUTION]: "Proposed Solution",
    [SectionType.IMPLEMENTATION_PLAN]: "Implementation Plan",
    [SectionType.EVALUATION]: "Evaluation Approach",
    [SectionType.BUDGET]: "Budget and Cost Breakdown",
    [SectionType.CONCLUSION]: "Conclusion",
    [SectionType.EXECUTIVE_SUMMARY]: "Executive Summary",
  };

  return titles[sectionType] || sectionType;
}

/**
 * Helper functions for extracting data from state
 */
function extractFunderFromState(state: OverallProposalState): string {
  if (state.funder?.name) return state.funder.name;
  if (state.researchResults?.funder) return state.researchResults.funder;
  if (state.researchResults?.funderName)
    return state.researchResults.funderName;
  if (state.solutionResults?.funder) return state.solutionResults.funder;
  return "The funder";
}

function extractApplicantFromState(state: OverallProposalState): string {
  if (state.applicant?.name) return state.applicant.name;
  if (state.researchResults?.applicant) return state.researchResults.applicant;
  if (state.researchResults?.applicantName)
    return state.researchResults.applicantName;
  if (state.solutionResults?.applicant) return state.solutionResults.applicant;
  return "Our organization";
}

function getWordLength(
  state: OverallProposalState,
  sectionType: SectionType
): string {
  if (!state.wordLength) {
    // Default word lengths by section type
    const defaults: Record<string, string> = {
      [SectionType.PROBLEM_STATEMENT]: "500-1000 words",
      [SectionType.ORGANIZATIONAL_CAPACITY]: "400-800 words",
      [SectionType.SOLUTION]: "600-1200 words",
      [SectionType.IMPLEMENTATION_PLAN]: "500-1000 words",
      [SectionType.EVALUATION]: "400-800 words",
      [SectionType.BUDGET]: "300-600 words",
      [SectionType.CONCLUSION]: "200-400 words",
      [SectionType.EXECUTIVE_SUMMARY]: "300-500 words",
    };
    return defaults[sectionType] || "500-1000 words";
  }

  const min = state.wordLength.min || 500;
  const max = state.wordLength.max || 1000;
  const target = state.wordLength.target;

  if (target) {
    return `approximately ${target} words`;
  }

  return `${min}-${max} words`;
}

function getRevisionGuidance(
  state: OverallProposalState,
  sectionType: SectionType
): string | null {
  const section = state.sections.get(sectionType);

  if (section?.status === ProcessingStatus.STALE && state.userFeedback) {
    // Use a generic approach that doesn't depend on specific property names
    return typeof state.userFeedback === "string"
      ? state.userFeedback
      : JSON.stringify(state.userFeedback);
  }

  return null;
}
/**
 * Creates a function to route between agent and tools
 */
const routeToToolOrEnd = (state: { messages: BaseMessage[] }) => {
  const lastMessage = state.messages[state.messages.length - 1];
  if (
    lastMessage instanceof AIMessage &&
    lastMessage.tool_calls &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }
  return "__end__";
};
