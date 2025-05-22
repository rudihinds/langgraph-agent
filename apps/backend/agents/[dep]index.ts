// /**
//  * Main agents index file
//  *
//  * This file exports all agent implementations and provides
//  * functions to register them with the orchestrator.
//  */
// import { AgentType } from "./orchestrator/state.js";
// import { RegisterAgentOptions } from "./orchestrator/agent-integration.js";
// import {
//   createWorkflowOrchestrator,
//   WorkflowOrchestratorOptions,
// } from "./orchestrator/workflow.js";
// import { researchAgent, ResearchAgentInput } from "./research/index.js";
// import { runProposalAgent } from "./proposal-agent/graph.js";
// import { Logger } from "@/lib/logger.js";

// // Initialize logger
// const logger = Logger.getInstance();

// /**
//  * Create and register all agents with the orchestrator
//  *
//  * @param options Options for creating the orchestrator
//  * @returns Initialized orchestrator instance with all agents registered
//  */
// export async function createOrchestrator(options: WorkflowOrchestratorOptions) {
//   // Create the base orchestrator instance
//   const orchestrator = createWorkflowOrchestrator({
//     ...options,
//     agents: [], // We'll register them manually below
//   });

//   // Register the research agent
//   await orchestrator.registerAgent({
//     id: "research",
//     name: "Research Agent",
//     role: "research",
//     description: "Analyzes RFP documents and extracts structured insights",
//     capabilities: [
//       "document parsing",
//       "RFP analysis",
//       "deep research",
//       "solution intent identification",
//     ],
//   });

//   // Register the proposal agent
//   await orchestrator.registerAgent({
//     id: "proposal",
//     name: "Proposal Writer",
//     role: "writer",
//     description:
//       "Generates high-quality proposal content based on research insights",
//     capabilities: [
//       "section generation",
//       "evaluation",
//       "content refinement",
//       "human feedback integration",
//     ],
//   });

//   logger.info("All agents registered with orchestrator");
//   return orchestrator;
// }

// /**
//  * Invoke the research agent directly
//  *
//  * @param input Research agent input parameters
//  * @returns Research agent state
//  */
// export async function invokeResearchAgent(input: ResearchAgentInput) {
//   logger.info("Directly invoking research agent", {
//     documentId: input.documentId,
//   });
//   try {
//     return await researchAgent.invoke(input);
//   } catch (error) {
//     logger.error("Error invoking research agent", {
//       error: error instanceof Error ? error.message : String(error),
//       documentId: input.documentId,
//     });
//     throw error;
//   }
// }

// /**
//  * Execute the research agent workflow through the orchestrator
//  *
//  * @param orchestrator Initialized orchestrator instance
//  * @param documentId ID of the document to analyze
//  * @returns Orchestrator state after executing the research workflow
//  */
// export async function executeResearchWorkflow(
//   orchestrator: any,
//   documentId: string
// ) {
//   const message = `Analyze the RFP document with ID ${documentId} and extract key insights`;

//   logger.info("Executing research workflow through orchestrator", {
//     documentId,
//   });
//   try {
//     // This will route through the orchestrator's workflow engine
//     const result = await orchestrator.processMessage(message, {
//       agentType: AgentType.RESEARCH,
//       contextData: { documentId },
//     });

//     logger.info("Research workflow completed successfully");
//     return result;
//   } catch (error) {
//     logger.error("Error executing research workflow", {
//       error: error instanceof Error ? error.message : String(error),
//       documentId,
//     });
//     throw error;
//   }
// }

// // Export all agent implementations
// export { researchAgent } from "./research/index.js";
// export {
//   graph as proposalAgent,
//   runProposalAgent,
// } from "./proposal-agent/graph.js";

// // Export agent types and interfaces
// export type { ResearchAgentInput } from "./research/index.js";
// export type { ProposalState } from "./proposal-agent/state.js";
// export { AgentType } from "./orchestrator/state.js";
// export type { RegisterAgentOptions } from "./orchestrator/agent-integration.js";
// export type { WorkflowOrchestratorOptions } from "./orchestrator/workflow.js";
