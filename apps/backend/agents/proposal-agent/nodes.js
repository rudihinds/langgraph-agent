import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { ProposalState, ProposalStateAnnotation } from "./state.js";
import { PromptTemplate } from "@langchain/core/prompts";
import {
  orchestratorPrompt,
  researchPrompt,
  solutionSoughtPrompt,
  connectionPairsPrompt,
  sectionGeneratorPrompt,
  evaluatorPrompt,
  humanFeedbackPrompt,
} from "./prompts/index.js";
import {
  extractFunderInfo,
  extractSolutionSought,
  extractConnectionPairs,
  getSectionToGenerate,
} from "./prompts/extractors.js";
import { configuration } from "./configuration.js";

// Initialize model based on configuration
const model = new ChatOpenAI({
  modelName: configuration.modelName || "gpt-4o",
  temperature: configuration.temperature || 0.5,
});

/**
 * Determines the next step in the proposal workflow
 * @param {Object} state - The current state of the proposal workflow
 * @returns {Object} Updated state with the next step decision
 */
export const orchestratorNode = async (state) => {
  const messages = state.messages;

  // Replace template variables
  const prompt = PromptTemplate.fromTemplate(orchestratorPrompt);
  const formattedPrompt = await prompt.format({
    rfpDocument: state.rfpDocument || "Not provided yet",
    funderInfo: state.funderInfo || "Not analyzed yet",
    solutionSought: state.solutionSought 
      ? `Primary goals: ${state.solutionSought.primaryGoals?.join(", ") || "None identified"}`
      : "Not identified yet",
    connectionPairsCount: state.connectionPairs?.length || 0,
    proposalSectionsCount: Object.keys(state.proposalSections || {}).length || 0,
    currentSection: state.currentSection || "None selected",
    currentPhase: state.currentPhase || "research",
  });

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const orchestratorMessages = [...messages, systemMessage];

  // Get response from orchestrator
  const response = await model.invoke(orchestratorMessages);

  // Return updated messages array and update phase if needed
  return {
    messages: [...messages, response],
  };
};

/**
 * Research node that analyzes the RFP and funder information
 * @param {Object} state Current proposal state
 * @returns {Promise<Object>} Updated state with research data
 */
export const researchNode = async (state) => {
  const messages = state.messages;
  const rfpDocument = state.rfpDocument;

  // Replace template variables
  const prompt = PromptTemplate.fromTemplate(researchPrompt);
  const formattedPrompt = await prompt.format({
    rfpDocument:
      rfpDocument ||
      "No RFP document provided. Please use available conversation context.",
  });

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const researchMessages = [...messages, systemMessage];

  // Get response from model
  const response = await model.invoke(researchMessages);

  // Extract funder info from response
  const funderInfo = extractFunderInfo(response.content);

  // Create research data object
  const researchData = {
    keyFindings: response.content
      .split("\n")
      .filter(line => line.trim().startsWith("- "))
      .map(line => line.trim().substring(2)),
    funderPriorities: response.content
      .split("\n")
      .filter(line => line.trim().startsWith("Priority:"))
      .map(line => line.trim().substring(9).trim()),
    fundingHistory: funderInfo,
    additionalNotes: response.content,
  };

  // Return updated state
  return {
    messages: [...messages, response],
    funderInfo: funderInfo || undefined,
    research: researchData,
    currentPhase: "solution_analysis",
  };
};

/**
 * Solution sought node that identifies what the funder is looking for
 * @param {Object} state Current proposal state
 * @returns {Promise<Object>} Updated state with solution requirements
 */
export const solutionSoughtNode = async (state) => {
  const messages = state.messages;
  const funderInfo = state.funderInfo;
  const rfpDocument = state.rfpDocument;

  // Replace template variables
  const prompt = PromptTemplate.fromTemplate(solutionSoughtPrompt);
  const formattedPrompt = await prompt.format({
    rfpDocument: rfpDocument || "No RFP document provided.",
    funderInfo: funderInfo || "No funder information provided.",
  });

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const solutionMessages = [...messages, systemMessage];

  // Get response from model
  const response = await model.invoke(solutionMessages);

  // Extract solution sought from response
  const solutionSoughtText = extractSolutionSought(response.content);

  // Parse into solution requirements structure
  const primaryGoals = response.content
    .split("\n")
    .filter(line => line.trim().startsWith("Goal:"))
    .map(line => line.trim().substring(5).trim());

  const constraints = response.content
    .split("\n")
    .filter(line => line.trim().startsWith("Constraint:"))
    .map(line => line.trim().substring(11).trim());

  const successMetrics = response.content
    .split("\n")
    .filter(line => line.trim().startsWith("Metric:"))
    .map(line => line.trim().substring(7).trim());

  const solutionRequirements = {
    primaryGoals: primaryGoals.length > 0 ? primaryGoals : 
      [solutionSoughtText || "Improve outcomes for target population"],
    constraints: constraints.length > 0 ? constraints : ["Budget constraints", "Timeline constraints"],
    successMetrics: successMetrics.length > 0 ? successMetrics : ["Increased impact", "Cost efficiency"]
  };

  // Return updated state
  return {
    messages: [...messages, response],
    solutionSought: solutionRequirements,
    currentPhase: "connection_pairs",
  };
};

/**
 * Connection pairs node that finds alignment between applicant and funder
 * @param {Object} state Current proposal state
 * @returns {Promise<Object>} Updated state with connection pairs
 */
export const connectionPairsNode = async (state) => {
  const messages = state.messages;
  const solutionSought = state.solutionSought;
  const funderInfo = state.funderInfo;

  // Replace template variables
  const prompt = PromptTemplate.fromTemplate(connectionPairsPrompt);
  const formattedPrompt = await prompt.format({
    funderInfo: funderInfo || "No funder information provided.",
    solutionSought: solutionSought 
      ? `Primary goals: ${solutionSought.primaryGoals?.join(", ")}`
      : "No solution information provided.",
  });

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const connectionMessages = [...messages, systemMessage];

  // Get response from model
  const response = await model.invoke(connectionMessages);

  // Extract connection pairs from response and convert to structured format
  const connectionPairsText = extractConnectionPairs(response.content);
  
  // Parse into connection pairs structure
  const connectionPairs = connectionPairsText.map((pairText, index) => {
    const parts = pairText.split(" | ");
    return {
      id: `cp-${index + 1}`,
      applicantStrength: parts[0] || "Organizational strength",
      funderNeed: parts[1] || "Funder priority",
      alignmentRationale: parts[2] || "Natural alignment exists",
      confidenceScore: 0.8,
      source: "AI analysis",
    };
  });

  // Return updated state
  return {
    messages: [...messages, response],
    connectionPairs: connectionPairs,
    currentPhase: "section_generation",
  };
};

/**
 * Section generator node that writes proposal sections
 * @param {Object} state Current proposal state
 * @returns {Promise<Object>} Updated state with new or updated section
 */
export const sectionGeneratorNode = async (state) => {
  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  const sectionToGenerate = getSectionToGenerate(lastMessage.content);
  const existingSections = state.proposalSections || {};

  // Check if we already have this section
  const existingSection = existingSections[sectionToGenerate];

  // Format connection pairs for prompt
  const connectionPairsText = state.connectionPairs
    ? state.connectionPairs.map(cp => 
        `- ${cp.applicantStrength} | ${cp.funderNeed} | ${cp.alignmentRationale}`
      ).join("\n")
    : "No connection pairs identified.";

  // Replace template variables
  const prompt = PromptTemplate.fromTemplate(sectionGeneratorPrompt);
  const formattedPrompt = await prompt.format({
    sectionName: sectionToGenerate,
    funderInfo: state.funderInfo || "No funder information provided.",
    solutionSought: state.solutionSought 
      ? `Primary goals: ${state.solutionSought.primaryGoals?.join(", ")}`
      : "No solution information provided.",
    connectionPairs: connectionPairsText,
    existingSections: Object.entries(existingSections)
      .map(([name, section]) => `${name}: ${section.content.substring(0, 100)}...`)
      .join("\n") || "No sections written yet.",
  });

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const sectionMessages = [...messages, systemMessage];

  // Get response from model
  const response = await model.invoke(sectionMessages);

  // Create section content object
  const sectionContent = {
    name: sectionToGenerate,
    content: response.content,
    status: "review",
    version: existingSection ? (existingSection.version || 0) + 1 : 1,
    lastUpdated: new Date().toISOString(),
  };

  // Create a new section update object with the section name as the key
  const sectionUpdate = {
    [sectionToGenerate]: sectionContent
  };

  // Return updated state
  return {
    messages: [...messages, response],
    proposalSections: sectionUpdate,
    currentSection: sectionToGenerate,
    currentPhase: "evaluation",
  };
};

/**
 * Evaluator node that assesses proposal quality
 * @param {Object} state Current proposal state
 * @returns {Promise<Object>} Updated state with evaluation results
 */
export const evaluatorNode = async (state) => {
  const messages = state.messages;
  const currentSection = state.currentSection;
  const proposalSections = state.proposalSections || {};

  // Find the section to evaluate
  const sectionToEvaluate = proposalSections[currentSection];

  if (!sectionToEvaluate) {
    // No section to evaluate
    const noSectionMessage = new AIMessage(
      "I cannot evaluate a section that doesn't exist. Please specify a valid section to evaluate."
    );
    return {
      messages: [...messages, noSectionMessage],
    };
  }

  // Format connection pairs for prompt
  const connectionPairsText = state.connectionPairs
    ? state.connectionPairs.map(cp => 
        `- ${cp.applicantStrength} | ${cp.funderNeed} | ${cp.alignmentRationale}`
      ).join("\n")
    : "No connection pairs identified.";

  // Replace template variables
  const prompt = PromptTemplate.fromTemplate(evaluatorPrompt);
  const formattedPrompt = await prompt.format({
    sectionName: sectionToEvaluate.name,
    sectionContent: sectionToEvaluate.content,
    funderInfo: state.funderInfo || "No funder information provided.",
    solutionSought: state.solutionSought 
      ? `Primary goals: ${state.solutionSought.primaryGoals?.join(", ")}`
      : "No solution information provided.",
    connectionPairs: connectionPairsText,
  });

  // Add system message
  const systemMessage = new HumanMessage(formattedPrompt);
  const evaluationMessages = [...messages, systemMessage];

  // Get response from model
  const response = await model.invoke(evaluationMessages);

  // Parse evaluation results
  const strengths = response.content
    .split("\n")
    .filter(line => line.trim().startsWith("Strength:"))
    .map(line => line.trim().substring(9).trim());

  const weaknesses = response.content
    .split("\n")
    .filter(line => line.trim().startsWith("Weakness:"))
    .map(line => line.trim().substring(9).trim());

  const suggestions = response.content
    .split("\n")
    .filter(line => line.trim().startsWith("Suggestion:"))
    .map(line => line.trim().substring(11).trim());

  // Create evaluation result
  const evaluationResult = {
    sectionName: currentSection,
    score: 7, // Default score
    strengths: strengths.length > 0 ? strengths : ["Clear articulation"],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["Could be more specific"],
    improvementSuggestions: suggestions.length > 0 ? suggestions : ["Add more details"],
    alignmentScore: 0.8,
  };

  // Update the section status
  const updatedSection = {
    ...sectionToEvaluate,
    status: "complete",
  };

  // Return updated state
  return {
    messages: [...messages, response],
    evaluations: { [currentSection]: evaluationResult },
    proposalSections: { [currentSection]: updatedSection },
    currentPhase: "revision",
  };
};

/**
 * Human feedback node that collects user input
 * @param {Object} state Current proposal state
 * @returns {Promise<Object>} Updated state with user feedback placeholder
 */
export const humanFeedbackNode = async (state) => {
  const messages = state.messages;
  const currentSection = state.currentSection;

  // Create a message requesting user feedback
  const feedbackRequestMessage = new AIMessage(humanFeedbackPrompt);

  // Create a placeholder for user feedback
  const userFeedback = {
    targetSection: currentSection,
    feedback: "Awaiting user feedback...",
    timestamp: new Date().toISOString(),
  };

  // Return updated state without actual user feedback yet
  return {
    messages: [...messages, feedbackRequestMessage],
    userFeedback,
  };
};