import { Annotation } from "@langchain/langgraph";

/**
 * The core state type for the proposal agent system
 */
export interface ProposalState {
  /** Conversation messages between user and agent */
  messages: Array<any>;
  /** RFP document content */
  rfpDocument?: string;
  /** Information about the funder */
  funderInfo?: string;
  /** What the funder is looking for */
  solutionSought?: string;
  /** Connections between applicant and funder */
  connectionPairs?: Array<string>;
  /** Generated proposal sections */
  proposalSections?: Array<{
    name: string;
    content: string;
    evaluation?: string;
  }>;
  /** Current section being worked on */
  currentSection?: string;
  /** Feedback from the user */
  userFeedback?: string;
}

/**
 * Annotation for the ProposalState
 */
export const ProposalStateAnnotation: {
  messages: [{ default: () => Array<any> }];
  rfpDocument: { required: false };
  funderInfo: { required: false };
  solutionSought: { required: false };
  connectionPairs: { required: false; default: () => Array<string> };
  proposalSections: { required: false; default: () => Array<any> };
  currentSection: { required: false };
  userFeedback: { required: false };
};