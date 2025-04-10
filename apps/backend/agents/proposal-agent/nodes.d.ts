import { BaseMessage } from "@langchain/core/messages";
import { ProposalState } from "./state";

/**
 * Determines the next step in the proposal workflow
 */
export declare function orchestratorNode(state: ProposalState): Promise<{
  messages: BaseMessage[];
}>;

/**
 * Research node that analyzes the RFP and funder information
 */
export declare function researchNode(
  state: ProposalState
): Promise<{
  messages: BaseMessage[];
  funderInfo: string | undefined;
}>;

/**
 * Solution sought node that identifies what the funder is looking for
 */
export declare function solutionSoughtNode(
  state: ProposalState
): Promise<{
  messages: BaseMessage[];
  solutionSought: string | undefined;
}>;

/**
 * Connection pairs node that finds alignment between applicant and funder
 */
export declare function connectionPairsNode(
  state: ProposalState
): Promise<{
  messages: BaseMessage[];
  connectionPairs: string[];
}>;

/**
 * Section generator node that writes proposal sections
 */
export declare function sectionGeneratorNode(
  state: ProposalState
): Promise<{
  messages: BaseMessage[];
  proposalSections: Array<{
    name: string;
    content: string;
    evaluation?: string;
  }>;
  currentSection: string | undefined;
}>;

/**
 * Evaluator node that assesses the quality of proposal sections
 */
export declare function evaluatorNode(
  state: ProposalState
): Promise<{
  messages: BaseMessage[];
  proposalSections: Array<{
    name: string;
    content: string;
    evaluation?: string;
  }>;
}>;

/**
 * Human feedback node that collects user input for feedback
 */
export declare function humanFeedbackNode(
  state: ProposalState
): Promise<{
  messages: BaseMessage[];
  userFeedback?: string;
}>;