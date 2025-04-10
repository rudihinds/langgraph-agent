/**
 * Configuration for the Proposal Agent
 * 
 * This file provides configuration options for the proposal agent that can be edited
 * through the LangGraph Studio UI.
 */

/**
 * Main configuration options
 */
export const configuration = {
  /**
   * Model to use for the proposal agent
   * @configurable
   * @default "anthropic/claude-3-5-sonnet-20240620"
   */
  modelName: process.env.DEFAULT_MODEL || "anthropic/claude-3-5-sonnet-20240620",
  
  /**
   * System message for the orchestrator
   * @configurable
   * @default "You are an expert grant proposal writer..."
   */
  orchestratorSystemMessage: `You are an expert grant proposal writer helping to create high-quality proposals.
Your role is to coordinate the proposal generation process and ensure all components work together effectively.`,

  /**
   * System message for the research agent
   * @configurable
   */
  researchSystemMessage: `You are a research specialist that analyzes RFP documents and gathers information.
Your goal is to extract key requirements, preferences, and evaluation criteria from RFP documents.`,

  /**
   * System message for the solution analysis agent
   * @configurable
   */
  solutionSystemMessage: `You are a solution architect that identifies the specific solutions sought in RFPs.
Your goal is to determine exactly what approaches are preferred and which should be avoided.`,

  /**
   * Temperature for model responses
   * @configurable
   * @default 0.2
   */
  temperature: 0.2,

  /**
   * Maximum number of orchestrator iterations before stopping
   * @configurable
   * @default 25
   */
  maxIterations: 25,
};