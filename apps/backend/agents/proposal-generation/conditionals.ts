/**
 * Conditional routing functions for the proposal generation graph
 * 
 * These functions determine the next node in the graph based on the current state.
 * They implement the control flow logic for the proposal generation process.
 */
import { ProposalState, SectionType } from "../../state/proposal.state.js";

/**
 * Determines the next step based on the overall state
 * This is a general-purpose router that can be used when specific routes aren't defined
 */
export function determineNextStep(state: ProposalState): string {
  if (state.errors.length > 0) {
    return "error";
  }
  
  if (state.status === "stale") {
    // Route to appropriate regeneration node based on what's stale
    // This would be expanded based on which sections can be marked stale
    if (state.researchStatus === "stale") return "deepResearch";
    if (state.solutionStatus === "stale") return "solutionSought";
    // Default to section manager if specific stale section can't be determined
    return "sectionManager";
  }
  
  // Default route if no specific condition is met
  return "documentLoader";
}

/**
 * Routes after research evaluation
 * @param state The current proposal state
 * @returns The next node to route to
 */
export function routeAfterResearchEvaluation(state: ProposalState): string {
  // If research was just approved, move to solution
  if (state.researchStatus === "approved") {
    return "solution";
  }
  
  // If research needs revision, go back to research
  if (state.researchStatus === "needs_revision") {
    return "revise";
  }
  
  // Default case - this shouldn't happen if state is properly managed
  console.warn("Unexpected state in routeAfterResearchEvaluation:", state.researchStatus);
  return "revise";
}

/**
 * Routes after solution evaluation
 * @param state The current proposal state
 * @returns The next node to route to
 */
export function routeAfterSolutionEvaluation(state: ProposalState): string {
  // If solution was approved, move to connections
  if (state.solutionStatus === "approved") {
    return "connections";
  }
  
  // If solution needs revision, go back to solution generation
  if (state.solutionStatus === "needs_revision") {
    return "revise";
  }
  
  // Default case
  console.warn("Unexpected state in routeAfterSolutionEvaluation:", state.solutionStatus);
  return "revise";
}

/**
 * Routes after connections evaluation
 * @param state The current proposal state
 * @returns The next node to route to
 */
export function routeAfterConnectionsEvaluation(state: ProposalState): string {
  // If connections were approved, move to section generation
  if (state.connectionsStatus === "approved") {
    return "sections";
  }
  
  // If connections need revision, go back to connection generation
  if (state.connectionsStatus === "needs_revision") {
    return "revise";
  }
  
  // Default case
  console.warn("Unexpected state in routeAfterConnectionsEvaluation:", state.connectionsStatus);
  return "revise";
}

/**
 * Routes section generation based on which section should be generated next
 * @param state The current proposal state
 * @returns The next section to generate or "complete" if all sections are done
 */
export function routeSectionGeneration(state: ProposalState): string {
  // Get the ordered list of sections to generate
  const sectionOrder: SectionType[] = [
    "problem_statement", 
    "methodology", 
    "budget", 
    "timeline", 
    "conclusion"
  ];
  
  // Find the first section that needs generation
  for (const sectionType of sectionOrder) {
    const sectionState = state.sections.get(sectionType);
    
    // If this section doesn't exist or needs generation/regeneration
    if (!sectionState || 
        sectionState.status === "not_started" || 
        sectionState.status === "stale") {
      return sectionType;
    }
  }
  
  // If all sections are complete, we're done
  return "complete";
}

/**
 * Creates a router function for after section evaluation
 * @param sectionType The section type that was just evaluated
 * @returns A function that routes after section evaluation
 */
export function routeAfterSectionEvaluation(sectionType: SectionType) {
  return (state: ProposalState): string => {
    const sectionState = state.sections.get(sectionType);
    
    // If section needs revision, route back to generation
    if (sectionState && sectionState.status === "needs_revision") {
      return "revise";
    }
    
    // Otherwise, move to the next section
    return "next";
  };
}

export default {
  determineNextStep,
  routeAfterResearchEvaluation,
  routeAfterSolutionEvaluation,
  routeAfterConnectionsEvaluation,
  routeSectionGeneration,
  routeAfterSectionEvaluation
};