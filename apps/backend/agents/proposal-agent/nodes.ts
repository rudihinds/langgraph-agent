import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { ProposalState } from "./state";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

/**
 * Orchestrator node that handles overall flow and user interactions
 * @param state Current proposal state
 * @returns Updated state with orchestrator response
 */
export async function orchestratorNode(
  state: ProposalState
): Promise<ProposalState> {
  const model = new ChatOpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.2,
  });

  // Create system prompt for the orchestrator
  const systemPrompt = new SystemMessage(
    "You are the orchestrator for a proposal writing system. You help guide the user " +
      "through the process of creating a proposal. You determine what steps need to " +
      "be taken next based on the current state."
  );

  // Generate a response from the orchestrator
  const orchestratorResponse = await model.invoke([
    systemPrompt,
    ...state.messages,
  ]);

  return {
    ...state,
    messages: [...state.messages, orchestratorResponse],
  };
}

/**
 * Research node that analyzes RFP and funder information
 * @param state Current proposal state
 * @returns Updated state with research results
 */
export async function researchNode(
  state: ProposalState
): Promise<ProposalState> {
  const tools = [new TavilySearchResults({ maxResults: 3 })];

  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0,
  }).bind({
    tools: tools,
  });

  // Create system prompt for the researcher
  const systemPrompt = new SystemMessage(
    "You are a research agent for a proposal writing system. Your task is to deeply " +
      "analyze the RFP document and gather information about the funder. Use the search " +
      "tool to find relevant information if needed."
  );

  // Generate research results
  const researchResponse = await model.invoke([
    systemPrompt,
    ...state.messages,
  ]);

  return {
    ...state,
    messages: [...state.messages, researchResponse],
    funderInfo: extractFunderInfo(researchResponse),
  };
}

/**
 * Solution sought node that determines what the funder is looking for
 * @param state Current proposal state
 * @returns Updated state with solution sought analysis
 */
export async function solutionSoughtNode(
  state: ProposalState
): Promise<ProposalState> {
  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.1,
  });

  // Create system prompt for solution analysis
  const systemPrompt = new SystemMessage(
    "You are an analytical agent focused on determining exactly what solution the funder " +
      "is seeking. Based on the RFP document and research, identify the core problem to be " +
      "solved and the specific outcomes the funder wants to achieve."
  );

  // Generate solution sought analysis
  const solutionResponse = await model.invoke([
    systemPrompt,
    ...state.messages,
  ]);

  return {
    ...state,
    messages: [...state.messages, solutionResponse],
    solutionSought: extractSolutionSought(solutionResponse),
  };
}

/**
 * Connection pairs node that identifies alignment between applicant and funder
 * @param state Current proposal state
 * @returns Updated state with connection pairs
 */
export async function connectionPairsNode(
  state: ProposalState
): Promise<ProposalState> {
  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.3,
  });

  // Create system prompt for connection pairs
  const systemPrompt = new SystemMessage(
    "You are a strategic alignment agent. Your task is to identify points of alignment " +
      "between the applicant and the funder. Create connection pairs that show how the " +
      "applicant's capabilities align with the funder's needs and priorities."
  );

  // Generate connection pairs
  const connectionResponse = await model.invoke([
    systemPrompt,
    ...state.messages,
  ]);

  return {
    ...state,
    messages: [...state.messages, connectionResponse],
    connectionPairs: extractConnectionPairs(connectionResponse),
  };
}

/**
 * Section generator node that creates proposal sections
 * @param state Current proposal state
 * @returns Updated state with generated section content
 */
export async function sectionGeneratorNode(
  state: ProposalState
): Promise<ProposalState> {
  // Determine which section to generate
  const sectionToGenerate = state.currentSection || getNextSection(state);

  if (!sectionToGenerate) {
    return {
      ...state,
      messages: [
        ...state.messages,
        new AIMessage("All sections have been completed."),
      ],
    };
  }

  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.5,
  });

  // Create system prompt for section generation
  const systemPrompt = new SystemMessage(
    `You are a proposal section writer. Your task is to write the "${sectionToGenerate}" section ` +
      "of the proposal. Use the RFP document, funder information, solution sought analysis, " +
      "and connection pairs to create high-quality, well-structured content."
  );

  // Generate section content
  const sectionResponse = await model.invoke([systemPrompt, ...state.messages]);

  // Update the sections array with the new content
  const updatedSections = updateSections(
    state,
    sectionToGenerate,
    sectionResponse.content
  );

  return {
    ...state,
    messages: [...state.messages, sectionResponse],
    proposalSections: updatedSections,
    currentSection: null, // Reset current section after generation
  };
}

/**
 * Evaluator node that assesses the quality of generated content
 * @param state Current proposal state
 * @returns Updated state with evaluation results
 */
export async function evaluatorNode(
  state: ProposalState
): Promise<ProposalState> {
  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0.1,
  });

  // Create system prompt for evaluation
  const systemPrompt = new SystemMessage(
    "You are a proposal evaluator. Your task is to assess the quality of the generated " +
      "proposal sections. Provide specific feedback on strengths and areas for improvement."
  );

  // Generate evaluation
  const evaluationResponse = await model.invoke([
    systemPrompt,
    ...state.messages,
  ]);

  return {
    ...state,
    messages: [...state.messages, evaluationResponse],
  };
}

/**
 * Human feedback node that interrupts the flow to collect user input
 * @param state Current proposal state
 * @returns Updated state with human feedback
 */
export async function humanFeedbackNode(
  state: ProposalState
): Promise<ProposalState> {
  // This would be implemented with an interrupt() in the actual graph
  // For now, we'll just add a placeholder
  return {
    ...state,
    messages: [
      ...state.messages,
      new AIMessage("Waiting for human feedback..."),
    ],
  };
}

// Helper functions

/**
 * Extract funder information from research response
 * @param message Research response message
 * @returns Extracted funder information
 */
function extractFunderInfo(message: AIMessage): string {
  // In a real implementation, this would parse the message to extract structured information
  return message.content as string;
}

/**
 * Extract solution sought from analysis response
 * @param message Solution analysis message
 * @returns Extracted solution sought
 */
function extractSolutionSought(message: AIMessage): string {
  // In a real implementation, this would parse the message to extract structured information
  return message.content as string;
}

/**
 * Extract connection pairs from alignment response
 * @param message Connection pairs message
 * @returns Array of connection pairs
 */
function extractConnectionPairs(message: AIMessage): string[] {
  // In a real implementation, this would parse the message to extract structured connection pairs
  return [message.content as string];
}

/**
 * Get the next section to generate based on dependencies
 * @param state Current proposal state
 * @returns Name of the next section to generate
 */
function getNextSection(state: ProposalState): string | null {
  // Default section order if none are defined yet
  const defaultSections = [
    "Executive Summary",
    "Problem Statement",
    "Solution",
    "Methodology",
    "Timeline",
    "Budget",
    "Organizational Capacity",
    "Conclusion",
  ];

  if (!state.proposalSections || state.proposalSections.length === 0) {
    // Initialize with default sections if none exist
    return defaultSections[0];
  }

  // Find the first section that is not completed
  const pendingSection = state.proposalSections.find(
    (section) =>
      section.status === "pending" || section.status === "in_progress"
  );

  return pendingSection ? pendingSection.name : null;
}

/**
 * Update the sections array with new content
 * @param state Current proposal state
 * @param sectionName Name of the section to update
 * @param content New content for the section
 * @returns Updated sections array
 */
function updateSections(
  state: ProposalState,
  sectionName: string,
  content: string
): ProposalState["proposalSections"] {
  const sections = state.proposalSections || [];

  const sectionIndex = sections.findIndex((s) => s.name === sectionName);

  if (sectionIndex >= 0) {
    // Update existing section
    const updatedSections = [...sections];
    updatedSections[sectionIndex] = {
      ...updatedSections[sectionIndex],
      content,
      status: "review",
    };
    return updatedSections;
  } else {
    // Add new section
    return [
      ...sections,
      {
        name: sectionName,
        content,
        status: "review",
      },
    ];
  }
}
