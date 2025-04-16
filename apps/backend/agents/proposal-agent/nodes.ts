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

/**
 * Represents the result of an evaluation.
 */
interface EvaluationResult {
  score: number; // e.g., 1-10
  feedback: string; // Qualitative feedback
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  passed: boolean; // Did it meet the minimum threshold?
}

/**
 * Node to evaluate the generated research based on predefined criteria.
 * This node should ideally use a separate LLM call with specific evaluation prompts.
 * @param state The current overall proposal state.
 * @returns A partial state update containing the evaluation result and updated status.
 */
export async function evaluateResearchNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  console.log("--- Evaluating Research ---");
  const researchResults = state.researchResults;

  if (!researchResults) {
    console.warn("No research results found to evaluate.");
    return {
      researchStatus: "error",
      errors: ["No research results found to evaluate."],
    };
  }

  // --- Placeholder Evaluation Logic ---
  // TODO: Replace with actual LLM call for evaluation based on criteria.
  // This involves:
  // 1. Defining evaluation criteria (perhaps loaded from config).
  // 2. Creating a specific prompt for the evaluator LLM.
  // 3. Calling the LLM with the research content and criteria.
  // 4. Parsing the LLM response into the EvaluationResult structure.
  console.log("Using placeholder evaluation logic.");
  const placeholderEvaluation: EvaluationResult = {
    score: 8,
    feedback:
      "Research seems comprehensive and relevant (placeholder evaluation).",
    strengths: ["Covers funder mission", "Identifies priorities"],
    weaknesses: ["Could use more specific examples"],
    suggestions: ["Add recent funding examples if possible"],
    passed: true, // Assume it passed for now
  };
  // --- End Placeholder ---

  console.log(`Evaluation Passed: ${placeholderEvaluation.passed}`);

  // Set interrupt metadata and status for HITL interrupt
  return {
    researchEvaluation: placeholderEvaluation,
    // Set interrupt metadata to provide context for the UI
    interruptMetadata: {
      reason: "EVALUATION_NEEDED",
      nodeId: "evaluateResearchNode",
      timestamp: new Date().toISOString(),
      contentReference: "research",
      evaluationResult: placeholderEvaluation,
    },
    // Set interrupt status to 'awaiting_input' to signal user review needed
    interruptStatus: {
      isInterrupted: true,
      interruptionPoint: "evaluateResearch",
      feedback: null,
      processingStatus: "pending",
    },
    // Always set research status to awaiting_review for consistency
    researchStatus: "awaiting_review",
  };
}

/**
 * Placeholder node for handling the Human-in-the-Loop (HITL) review step for research.
 * In a full implementation, this might trigger a UI notification or pause execution.
 * @param state The current overall proposal state.
 * @returns No state change, simply acts as a named step in the graph.
 */
export async function awaitResearchReviewNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  console.log("--- Awaiting Research Review --- ");
  console.log(
    "Graph execution paused, waiting for user review of research results."
  );
  // In a real system, this node would likely involve an interrupt
  // or signal to the Orchestrator/UI to wait for user input.
  // It does not modify the state itself, just represents the waiting point.
  return {};
}

/**
 * Placeholder node for handling errors encountered during graph execution.
 * Logs the errors found in the state.
 * @param state The current overall proposal state.
 * @returns No state change, acts as a terminal error state for now.
 */
export async function handleErrorNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  console.error("--- Handling Graph Error --- ");
  console.error("Errors recorded in state:", state.errors);
  // This node could potentially:
  // - Add a final error message to the state.messages
  // - Notify an administrator
  // - Update a general status field
  // For now, it just logs and acts as an end point.
  return {};
}

/**
 * Node for planning proposal sections based on research and solution analysis
 * @param state Current proposal state
 * @returns Updated state with planned sections
 */
export async function planSectionsNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Planning proposal sections...");

  // This would contain logic to determine required sections and their order
  // based on the research and solution sought

  // For now, return a simple set of required sections
  return {
    requiredSections: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.METHODOLOGY,
      SectionType.BUDGET,
      SectionType.TIMELINE,
      SectionType.CONCLUSION,
    ],
    currentStep: "plan_sections",
    // Update the status to indicate the planning is complete
    status: "running",
  };
}

/**
 * Node for generating specific proposal sections
 * @param state Current proposal state
 * @returns Updated state with the generated section
 */
export async function generateSectionNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Generating section...");

  // Determine which section to generate from the state
  // In a real implementation, this would use the specific section assigned
  // during the determineNextSection routing

  // For this stub, we'll just pick the first pending section
  let sectionToGenerate: SectionType | undefined;

  for (const sectionType of state.requiredSections) {
    const section = state.sections.get(sectionType);
    if (
      !section ||
      section.status === "not_started" ||
      section.status === "error"
    ) {
      sectionToGenerate = sectionType;
      break;
    }
  }

  if (!sectionToGenerate) {
    // Default to problem statement if no pending section
    sectionToGenerate = SectionType.PROBLEM_STATEMENT;
  }

  // Create updated sections map
  const updatedSections = new Map(state.sections);
  updatedSections.set(sectionToGenerate, {
    id: sectionToGenerate,
    content: `Placeholder content for ${sectionToGenerate}`,
    status: "generating",
    lastUpdated: new Date().toISOString(),
  });

  return {
    sections: updatedSections,
    currentStep: `section:${sectionToGenerate}`,
    status: "running",
  };
}

/**
 * Node for evaluating a generated section
 * @param state Current proposal state
 * @returns Updated state with section evaluation
 */
export async function evaluateSectionNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Evaluating section...");

  // Determine the current section from the currentStep
  const currentStepMatch = state.currentStep?.match(/^section:(.+)$/);
  if (!currentStepMatch) {
    return {
      errors: [
        ...state.errors,
        "No current section found in state for evaluation",
      ],
    };
  }

  const sectionType = currentStepMatch[1] as SectionType;
  const section = state.sections.get(sectionType);

  if (!section) {
    return {
      errors: [...state.errors, `Section ${sectionType} not found in state`],
    };
  }

  // In a real implementation, this would analyze the section content against
  // evaluation criteria and provide detailed feedback

  // Create an evaluation result
  const sectionEvaluation = {
    score: 7,
    passed: true,
    feedback: `This ${sectionType} section looks good overall but could use some minor refinement.`,
    strengths: [`Good alignment with ${sectionType} requirements`],
    weaknesses: ["Could use more specific examples"],
    suggestions: ["Add more concrete examples"],
  };

  // Update the section with evaluation result
  const updatedSections = new Map(state.sections);
  updatedSections.set(sectionType, {
    ...section,
    status: "awaiting_review",
    evaluation: sectionEvaluation,
    lastUpdated: new Date().toISOString(),
  });

  // Set interrupt metadata and status for HITL interrupt
  return {
    sections: updatedSections,
    // Set interrupt metadata to provide context for the UI
    interruptMetadata: {
      reason: "EVALUATION_NEEDED",
      nodeId: "evaluateSectionNode",
      timestamp: new Date().toISOString(),
      contentReference: sectionType,
      evaluationResult: sectionEvaluation,
    },
    // Set interrupt status to 'awaiting_input' to signal user review needed
    interruptStatus: {
      isInterrupted: true,
      interruptionPoint: `evaluateSection:${sectionType}`,
      feedback: null,
      processingStatus: "pending",
    },
    status: "awaiting_review",
  };
}

/**
 * Node to improve a section based on evaluation feedback
 * @param state Current proposal state
 * @returns Updated state with improved section
 */
export async function improveSection(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Improving section based on feedback...");

  // Extract current section from state
  const currentStepMatch = state.currentStep?.match(/^section:(.+)$/);
  if (!currentStepMatch) {
    return {
      errors: [
        ...state.errors,
        "No current section found in state for improvement",
      ],
    };
  }

  const sectionType = currentStepMatch[1] as SectionType;
  const section = state.sections.get(sectionType);

  if (!section) {
    return {
      errors: [...state.errors, `Section ${sectionType} not found in state`],
    };
  }

  // In a real implementation, this would incorporate feedback to improve the section

  const updatedSections = new Map(state.sections);
  updatedSections.set(sectionType, {
    ...section,
    content: `Improved content for ${sectionType} based on feedback: ${section.content}`,
    status: "generating", // Reset to generating for re-evaluation
    lastUpdated: new Date().toISOString(),
  });

  return {
    sections: updatedSections,
    status: "running",
  };
}

/**
 * Node to submit a section for human review
 * @param state Current proposal state
 * @returns Updated state with section ready for review
 */
export async function submitSectionForReviewNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Submitting section for review...");

  // Extract current section from state
  const currentStepMatch = state.currentStep?.match(/^section:(.+)$/);
  if (!currentStepMatch) {
    return {
      errors: [
        ...state.errors,
        "No current section found in state for review submission",
      ],
    };
  }

  const sectionType = currentStepMatch[1] as SectionType;
  const section = state.sections.get(sectionType);

  if (!section) {
    return {
      errors: [...state.errors, `Section ${sectionType} not found in state`],
    };
  }

  // Update the section status to awaiting review
  const updatedSections = new Map(state.sections);
  updatedSections.set(sectionType, {
    ...section,
    status: "awaiting_review",
    lastUpdated: new Date().toISOString(),
  });

  // Add a message requesting review
  const reviewRequestMessage = {
    content: `Please review the ${sectionType} section of the proposal.`,
    role: "assistant",
  };

  return {
    sections: updatedSections,
    messages: [...state.messages, reviewRequestMessage],
    status: "awaiting_review",
  };
}

/**
 * Node to await human review for a section
 * @param state Current proposal state
 * @returns Updated state indicating waiting for review
 */
export async function awaitSectionReviewNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Awaiting section review...");

  // In a real implementation, this would integrate with the human-in-the-loop system
  // to wait for user feedback

  return {
    status: "awaiting_review",
    // Note: This node doesn't modify state but would normally pause execution
    // until human input is received
  };
}

/**
 * Node to await human review for the solution
 * @param state Current proposal state
 * @returns Updated state indicating waiting for solution review
 */
export async function awaitSolutionReviewNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Awaiting solution review...");

  // Add a message explaining what is needed from the human reviewer
  const reviewRequestMessage = {
    content:
      "Please review the solution approach before proceeding with section generation.",
    role: "assistant",
  };

  return {
    messages: [...state.messages, reviewRequestMessage],
    solutionStatus: "awaiting_review",
    status: "awaiting_review",
  };
}

/**
 * Node to await user input after an error
 * @param state Current proposal state
 * @returns Updated state with error notification
 */
export async function awaitUserInputNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Awaiting user input after error...");

  // Compose an error message for the user
  const errorMessages =
    state.errors.length > 0
      ? state.errors.join(". ")
      : "An unspecified error occurred";

  const errorNotificationMessage = {
    content: `Error in the proposal generation process: ${errorMessages}. Please provide instructions on how to proceed.`,
    role: "assistant",
  };

  return {
    messages: [...state.messages, errorNotificationMessage],
    status: "error",
  };
}

/**
 * Node to finalize the proposal once all sections are complete
 * @param state Current proposal state
 * @returns Updated state with completed proposal
 */
export async function completeProposalNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Completing proposal...");

  // In a real implementation, this might:
  // - Organize all sections in final order
  // - Generate executive summary
  // - Create PDF/docx output
  // - Notify stakeholders

  const completionMessage = {
    content:
      "Proposal has been successfully generated and finalized with all required sections.",
    role: "assistant",
  };

  return {
    messages: [...state.messages, completionMessage],
    status: "complete",
    currentStep: "completed",
    lastUpdatedAt: new Date().toISOString(),
  };
}

/**
 * Node to evaluate a solution sought section
 * @param state Current proposal state
 * @returns Updated state with solution evaluation
 */
export async function evaluateSolutionNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Evaluating solution sought...");

  // In a real implementation, this would assess the solution against
  // the research findings and funder priorities

  const solutionEvaluation = {
    score: 8,
    passed: true,
    feedback:
      "The solution approach is well-aligned with the funder's priorities and research findings.",
  };

  // Set interrupt metadata and status for HITL interrupt
  return {
    solutionEvaluation,
    // Set interrupt metadata to provide context for the UI
    interruptMetadata: {
      reason: "EVALUATION_NEEDED",
      nodeId: "evaluateSolutionNode",
      timestamp: new Date().toISOString(),
      contentReference: "solution",
      evaluationResult: solutionEvaluation,
    },
    // Set interrupt status to 'awaiting_input' to signal user review needed
    interruptStatus: {
      isInterrupted: true,
      interruptionPoint: "evaluateSolution",
      feedback: null,
      processingStatus: "pending",
    },
    // Update solution status
    solutionStatus: "awaiting_review",
    status: "awaiting_review",
  };
}

/**
 * Node to handle the finalization step and check if all sections are ready
 * @param state Current proposal state
 * @returns Updated state after finalization check
 */
export async function finalizeProposalNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Finalizing proposal...");

  // Check if all required sections are complete
  let allSectionsComplete = true;
  const incompleteSections: SectionType[] = [];

  for (const sectionType of state.requiredSections) {
    const section = state.sections.get(sectionType);
    if (!section || section.status !== "approved") {
      allSectionsComplete = false;
      incompleteSections.push(sectionType);
    }
  }

  if (!allSectionsComplete) {
    return {
      errors: [
        ...state.errors,
        `Cannot finalize: Sections still incomplete: ${incompleteSections.join(", ")}`,
      ],
      status: "error",
    };
  }

  // Prepare for completion
  return {
    status: "awaiting_review",
    currentStep: "finalizing",
  };
}

/**
 * Node to evaluate the connection pairs between funder and applicant priorities
 * @param state Current proposal state
 * @returns Updated state with connection evaluation
 */
export async function evaluateConnectionsNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  console.log("Evaluating connection pairs...");

  // Check if connections exist
  if (!state.connections || state.connections.length === 0) {
    return {
      errors: [...state.errors, "No connection pairs found to evaluate."],
      connectionsStatus: "error",
    };
  }

  // In a real implementation, this would analyze the connection pairs against
  // research findings, solution sought, and funder priorities to ensure
  // they represent strong alignment

  // Example evaluation result for connections
  const connectionsEvaluation = {
    score: 8,
    passed: true,
    feedback:
      "Connection pairs show good alignment between funder priorities and applicant capabilities.",
    strengths: [
      "Clear alignment with mission",
      "Addresses specific priorities",
    ],
    weaknesses: ["Could be more specific in some areas"],
    suggestions: [
      "Add more quantifiable impact metrics",
      "Strengthen connection to timeline",
    ],
  };

  // Set interrupt metadata and status for HITL interrupt
  return {
    connectionsEvaluation,
    // Set interrupt metadata to provide context for the UI
    interruptMetadata: {
      reason: "EVALUATION_NEEDED",
      nodeId: "evaluateConnectionsNode",
      timestamp: new Date().toISOString(),
      contentReference: "connections",
      evaluationResult: connectionsEvaluation,
    },
    // Set interrupt status to 'awaiting_input' to signal user review needed
    interruptStatus: {
      isInterrupted: true,
      interruptionPoint: "evaluateConnections",
      feedback: null,
      processingStatus: "pending",
    },
    // Update connections status
    connectionsStatus: "awaiting_review",
    status: "awaiting_review",
  };
}

/**
 * Process user feedback and determine the next steps
 * This node is called after the graph has been resumed from a HITL interrupt
 * and uses the feedback provided by the user to determine how to proceed
 *
 * @param state Current proposal state
 * @returns Updated state based on feedback processing
 */
export async function processFeedbackNode(
  state: ProposalState
): Promise<Partial<ProposalState>> {
  const logger = console;
  logger.info("Processing user feedback");

  // Validate that we have feedback to process
  if (!state.userFeedback) {
    logger.error("No user feedback found in state");
    return {
      errors: [
        ...(state.errors || []),
        {
          nodeId: "processFeedbackNode",
          message: "No user feedback found in state",
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // Get the feedback type and additional content
  const { type, comments, specificEdits } = state.userFeedback;
  const interruptPoint = state.interruptStatus?.interruptionPoint;
  const contentRef = state.interruptMetadata?.contentReference;

  logger.info(
    `Processing ${type} feedback for ${interruptPoint} at ${contentRef}`
  );

  // Different handling based on feedback type
  switch (type) {
    case "approve":
      // For approval, we update status and continue
      logger.info("User approved content, continuing flow");

      // Determine what was approved to update the appropriate status
      if (contentRef && contentRef === "research") {
        return {
          researchStatus: "approved",
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      } else if (contentRef && contentRef === "solution") {
        return {
          solutionStatus: "approved",
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      } else if (contentRef && contentRef === "connections") {
        return {
          connectionsStatus: "approved",
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      } else if (contentRef && state.sections && state.sections[contentRef]) {
        // This is a section approval
        return {
          sections: {
            ...state.sections,
            [contentRef]: {
              ...state.sections[contentRef],
              status: "approved",
            },
          },
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      }
      break;

    case "revise":
      // For revision, we update content with specific edits
      logger.info("User requested revisions with specific edits");

      // Capture revision instructions
      const revisionInstructions = comments || "Revise based on user feedback";

      if (contentRef && contentRef === "research") {
        return {
          researchStatus: "edited",
          revisionInstructions: revisionInstructions,
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      } else if (contentRef && contentRef === "solution") {
        return {
          solutionStatus: "edited",
          revisionInstructions: revisionInstructions,
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      } else if (contentRef && contentRef === "connections") {
        return {
          connectionsStatus: "edited",
          revisionInstructions: revisionInstructions,
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      } else if (contentRef && state.sections && state.sections[contentRef]) {
        // This is a section revision
        return {
          sections: {
            ...state.sections,
            [contentRef]: {
              ...state.sections[contentRef],
              status: "edited",
              edits: specificEdits || {},
              revisionInstructions: revisionInstructions,
            },
          },
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      }
      break;

    case "regenerate":
      // For regeneration, we reset to an earlier state
      logger.info("User requested complete regeneration");

      if (contentRef && contentRef === "research") {
        return {
          researchStatus: "stale",
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      } else if (contentRef && contentRef === "solution") {
        return {
          solutionStatus: "stale",
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      } else if (contentRef && contentRef === "connections") {
        return {
          connectionsStatus: "stale",
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      } else if (contentRef && state.sections && state.sections[contentRef]) {
        // This is a section regeneration
        return {
          sections: {
            ...state.sections,
            [contentRef]: {
              ...state.sections[contentRef],
              status: "stale",
              content: "", // Clear content for regeneration
            },
          },
          interruptStatus: {
            isInterrupted: false,
            interruptionPoint: null,
            feedback: null,
            processingStatus: null,
          },
          interruptMetadata: undefined,
        };
      }
      break;

    default:
      logger.error(`Unknown feedback type: ${type}`);
      return {
        errors: [
          ...(state.errors || []),
          {
            nodeId: "processFeedbackNode",
            message: `Unknown feedback type: ${type}`,
            timestamp: new Date().toISOString(),
          },
        ],
      };
  }

  // If we couldn't determine what to do, log an error and return
  logger.error(`Could not process feedback for content: ${contentRef}`);
  return {
    errors: [
      ...(state.errors || []),
      {
        nodeId: "processFeedbackNode",
        message: `Could not process feedback for content: ${contentRef}`,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

// Additional node functions can be added here
