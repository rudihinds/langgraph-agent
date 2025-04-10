import { ChatOpenAI } from "@langchain/openai";
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  FunctionMessage,
} from "@langchain/core/messages";
import { ProposalState } from "./state.js";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";

// Initialize OpenAI chat model - later can be parameterized or moved to config
const model = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.5,
});

/**
 * Orchestrator node that determines the next step in the workflow
 * @param state Current proposal state
 * @returns Updated state with orchestrator's response added to messages
 */
export async function orchestratorNode(
  state: ProposalState
): Promise<{ messages: BaseMessage[] }> {
  const messages = state.messages;

  // Template for orchestrator prompt
  const orchestratorTemplate = `
  You are the orchestrator of a proposal writing workflow.
  Based on the conversation so far and the current state of the proposal,
  determine the next step that should be taken.
  
  Current state of the proposal:
  - RFP Document: ${state.rfpDocument || "Not provided yet"}
  - Funder Info: ${state.funderInfo || "Not analyzed yet"}
  - Solution Sought: ${state.solutionSought || "Not identified yet"}
  - Connection Pairs: ${state.connectionPairs?.length || 0} identified
  - Proposal Sections: ${state.proposalSections?.length || 0} sections defined
  - Current Section: ${state.currentSection || "None selected"}
  
  Possible actions you can recommend:
  - "research" - Analyze the RFP and extract funder information
  - "solution sought" - Identify what the funder is looking for
  - "connection pairs" - Find alignment between the applicant and funder
  - "generate section" - Write a specific section of the proposal
  - "evaluate" - Review proposal content for quality
  - "human feedback" - Ask for user input or feedback
  
  Your response should indicate which action to take next and why.
  `;

  const prompt = PromptTemplate.fromTemplate(orchestratorTemplate);
  const formattedPrompt = await prompt.format({});

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const orchestratorMessages = [...messages, systemMessage];

  // Get response from orchestrator
  const response = await model.invoke(orchestratorMessages);

  // Return updated messages array
  return {
    messages: [...messages, response],
  };
}

/**
 * Extract funder information from research
 * @param text Research text
 * @returns Extracted funder info
 */
function extractFunderInfo(text: string): string {
  const funders = text.match(/funder:(.*?)(?=\n\n|\n$|$)/is);
  return funders ? funders[1].trim() : "";
}

/**
 * Research node that analyzes the RFP and funder information
 * @param state Current proposal state
 * @returns Updated state with research results and messages
 */
export async function researchNode(state: ProposalState): Promise<{
  messages: BaseMessage[];
  funderInfo: string | undefined;
}> {
  const messages = state.messages;
  const rfpDocument = state.rfpDocument;

  // Template for research prompt
  const researchTemplate = `
  You are a research specialist focusing on RFP analysis.
  Analyze the following RFP and provide key information about the funder:
  
  RFP Document:
  ${rfpDocument || "No RFP document provided. Please use available conversation context."}
  
  Please extract and summarize:
  1. The funder's mission and values
  2. Funding priorities and focus areas
  3. Key evaluation criteria
  4. Budget constraints or requirements
  5. Timeline and deadlines
  
  Format your response with the heading "Funder:" followed by the summary.
  `;

  const prompt = PromptTemplate.fromTemplate(researchTemplate);
  const formattedPrompt = await prompt.format({});

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const researchMessages = [...messages, systemMessage];

  // Get response from model
  const response = await model.invoke(researchMessages);

  // Extract funder info from response
  const funderInfo = extractFunderInfo(response.content as string);

  // Return updated state
  return {
    messages: [...messages, response],
    funderInfo: funderInfo || undefined,
  };
}

/**
 * Extract solution sought from text
 * @param text Text containing solution information
 * @returns Extracted solution sought
 */
function extractSolutionSought(text: string): string {
  const solution = text.match(/solution sought:(.*?)(?=\n\n|\n$|$)/is);
  return solution ? solution[1].trim() : "";
}

/**
 * Solution sought node that identifies what the funder is looking for
 * @param state Current proposal state
 * @returns Updated state with solution sought and messages
 */
export async function solutionSoughtNode(state: ProposalState): Promise<{
  messages: BaseMessage[];
  solutionSought: string | undefined;
}> {
  const messages = state.messages;
  const funderInfo = state.funderInfo;
  const rfpDocument = state.rfpDocument;

  // Template for solution sought prompt
  const solutionTemplate = `
  You are an analyst identifying what solutions funders are seeking.
  Based on the following information, identify what the funder is looking for:
  
  RFP Document:
  ${rfpDocument || "No RFP document provided."}
  
  Funder Information:
  ${funderInfo || "No funder information provided."}
  
  Please identify:
  1. The specific problem the funder wants to address
  2. The type of solution the funder prefers
  3. Any constraints or requirements for the solution
  4. Innovation expectations
  5. Impact metrics they value
  
  Format your response with the heading "Solution Sought:" followed by your detailed analysis.
  `;

  const prompt = PromptTemplate.fromTemplate(solutionTemplate);
  const formattedPrompt = await prompt.format({});

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const solutionMessages = [...messages, systemMessage];

  // Get response from model
  const response = await model.invoke(solutionMessages);

  // Extract solution sought from response
  const solutionSought = extractSolutionSought(response.content as string);

  // Return updated state
  return {
    messages: [...messages, response],
    solutionSought: solutionSought || undefined,
  };
}

/**
 * Extract connection pairs from text
 * @param text Text containing connection information
 * @returns Array of connection pairs
 */
function extractConnectionPairs(text: string): string[] {
  const connectionText = text.match(/connection pairs:(.*?)(?=\n\n|\n$|$)/is);
  if (!connectionText) return [];

  // Split by numbered items or bullet points
  const connections = connectionText[1]
    .split(/\n\s*[\d\.\-\*]\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return connections;
}

/**
 * Connection pairs node that finds alignment between applicant and funder
 * @param state Current proposal state
 * @returns Updated state with connection pairs and messages
 */
export async function connectionPairsNode(state: ProposalState): Promise<{
  messages: BaseMessage[];
  connectionPairs: string[];
}> {
  const messages = state.messages;
  const solutionSought = state.solutionSought;
  const funderInfo = state.funderInfo;

  // Template for connection pairs prompt
  const connectionTemplate = `
  You are a strategic advisor who identifies alignment between applicants and funders.
  Based on the following information, identify strong connections:
  
  Funder Information:
  ${funderInfo || "No funder information provided."}
  
  Solution Sought:
  ${solutionSought || "No solution information provided."}
  
  Please identify 5-7 specific connection pairs that align:
  1. What the funder values
  2. What the applicant can offer
  
  Format your response with the heading "Connection Pairs:" followed by a numbered list,
  where each item shows a specific alignment between funder priorities and applicant strengths.
  `;

  const prompt = PromptTemplate.fromTemplate(connectionTemplate);
  const formattedPrompt = await prompt.format({});

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const connectionMessages = [...messages, systemMessage];

  // Get response from model
  const response = await model.invoke(connectionMessages);

  // Extract connection pairs from response
  const connectionPairs = extractConnectionPairs(response.content as string);

  // Return updated state
  return {
    messages: [...messages, response],
    connectionPairs: connectionPairs,
  };
}

/**
 * Section generator node that writes proposal sections
 * @param state Current proposal state
 * @returns Updated state with proposal section and messages
 */
export async function sectionGeneratorNode(state: ProposalState): Promise<{
  messages: BaseMessage[];
  proposalSections: ProposalState["proposalSections"];
  currentSection: string | undefined;
}> {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  const sectionToGenerate = getSectionToGenerate(lastMessage.content as string);
  const existingSections = state.proposalSections || [];

  // Check if we already have this section
  const existingSection = existingSections.find(
    (s: ProposalState["proposalSections"][0]) =>
      s.name.toLowerCase() === sectionToGenerate.toLowerCase()
  );

  // Template for section generation prompt
  const sectionTemplate = `
  You are a professional proposal writer.
  
  Write the "${sectionToGenerate}" section of a proposal based on:
  
  Funder Information:
  ${state.funderInfo || "No funder information provided."}
  
  Solution Sought:
  ${state.solutionSought || "No solution information provided."}
  
  Connection Pairs:
  ${state.connectionPairs?.join("\n") || "No connection pairs identified."}
  
  Existing Sections:
  ${
    existingSections
      .map(
        (s: ProposalState["proposalSections"][0]) =>
          `${s.name}: ${s.content.substring(0, 100)}...`
      )
      .join("\n") || "No sections written yet."
  }
  
  Write a compelling, detailed, and well-structured section that addresses the funder's priorities.
  Format your response as the complete section text without additional commentary.
  `;

  const prompt = PromptTemplate.fromTemplate(sectionTemplate);
  const formattedPrompt = await prompt.format({});

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const sectionMessages = [...messages, systemMessage];

  // Get response from model
  const response = await model.invoke(sectionMessages);

  // Create or update the section
  let updatedSections: typeof existingSections;
  if (existingSection) {
    updatedSections = existingSections.map(
      (s: ProposalState["proposalSections"][0]) => {
        if (s.name.toLowerCase() === sectionToGenerate.toLowerCase()) {
          return {
            ...s,
            content: response.content as string,
            status: "review" as const,
          };
        }
        return s;
      }
    );
  } else {
    const newSection = {
      name: sectionToGenerate,
      content: response.content as string,
      status: "review" as const,
    };
    updatedSections = [...existingSections, newSection];
  }

  // Return updated state
  return {
    messages: [...messages, response],
    proposalSections: updatedSections,
    currentSection: sectionToGenerate,
  };
}

/**
 * Helper function to extract section name from message
 * @param messageContent Message content
 * @returns Section name
 */
function getSectionToGenerate(messageContent: string): string {
  // Extract section name using regex
  const sectionMatch =
    messageContent.match(/generate section[:\s]+([^"\n.]+)/i) ||
    messageContent.match(/write section[:\s]+([^"\n.]+)/i) ||
    messageContent.match(/section[:\s]+"([^"]+)"/i);

  if (sectionMatch && sectionMatch[1]) {
    return sectionMatch[1].trim();
  }

  // Default sections if none specified
  return "Project Description";
}

/**
 * Evaluator node that assesses proposal quality
 * @param state Current proposal state
 * @returns Updated state with evaluation messages
 */
export async function evaluatorNode(state: ProposalState): Promise<{
  messages: BaseMessage[];
}> {
  const messages = state.messages;
  const currentSection = state.currentSection;
  const proposalSections = state.proposalSections || [];

  // Find the section to evaluate
  const sectionToEvaluate = proposalSections.find(
    (s: ProposalState["proposalSections"][0]) =>
      s.name.toLowerCase() === (currentSection?.toLowerCase() || "")
  );

  if (!sectionToEvaluate) {
    // No section to evaluate
    const noSectionMessage = new AIMessage(
      "I cannot evaluate a section that doesn't exist. Please specify a valid section to evaluate."
    );
    return {
      messages: [...messages, noSectionMessage],
    };
  }

  // Template for evaluation prompt
  const evaluationTemplate = `
  You are a proposal reviewer and quality evaluator.
  
  Evaluate the following proposal section against the funder's criteria:
  
  Section: ${sectionToEvaluate.name}
  
  Content:
  ${sectionToEvaluate.content}
  
  Funder Information:
  ${state.funderInfo || "No funder information provided."}
  
  Solution Sought:
  ${state.solutionSought || "No solution information provided."}
  
  Connection Pairs:
  ${state.connectionPairs?.join("\n") || "No connection pairs identified."}
  
  Provide a detailed evaluation covering:
  1. Alignment with funder priorities
  2. Clarity and persuasiveness
  3. Specificity and detail
  4. Strengths of the section
  5. Areas for improvement
  
  End your evaluation with 3 specific recommendations for improving this section.
  `;

  const prompt = PromptTemplate.fromTemplate(evaluationTemplate);
  const formattedPrompt = await prompt.format({});

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const evaluationMessages = [...messages, systemMessage];

  // Get response from model
  const response = await model.invoke(evaluationMessages);

  // Return updated state
  return {
    messages: [...messages, response],
  };
}

/**
 * Human feedback node that collects user input
 * @param state Current proposal state
 * @returns Updated state with user feedback and messages
 */
export async function humanFeedbackNode(state: ProposalState): Promise<{
  messages: BaseMessage[];
  userFeedback: string | undefined;
}> {
  const messages = state.messages;

  // Create a message requesting user feedback
  const feedbackRequestMessage = new AIMessage(
    "I need your feedback to proceed. Please provide any comments, suggestions, or direction for the proposal."
  );

  // In a real implementation, this would wait for user input
  // For now, we'll simulate by just adding the request message

  // Return updated state without user feedback yet
  return {
    messages: [...messages, feedbackRequestMessage],
    userFeedback: undefined, // This would be filled with actual user input
  };
}

// Additional node functions can be added here
