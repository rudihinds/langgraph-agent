import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { 
  connectionPairsReducer,
  proposalSectionsReducer,
  researchDataReducer,
  solutionRequirementsReducer
} from "./reducers.js";

/**
 * Define the state using the new Annotation API with specialized reducers
 */
export const ProposalStateAnnotation = Annotation.Root({
  // Messages with special reducer for handling message history
  messages: Annotation({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  
  // Document content
  rfpDocument: Annotation({
    default: () => undefined,
  }),
  
  // Basic funder information
  funderInfo: Annotation({
    default: () => undefined,
  }),
  
  // Structured research data with specialized reducer
  research: Annotation({
    reducer: researchDataReducer,
    default: () => null,
  }),
  
  // Structured solution requirements with specialized reducer
  solutionSought: Annotation({
    reducer: solutionRequirementsReducer,
    default: () => null,
  }),
  
  // Connection pairs with deduplication reducer
  connectionPairs: Annotation({
    reducer: connectionPairsReducer,
    default: () => [],
  }),
  
  // Proposal sections with versioning reducer
  proposalSections: Annotation({
    reducer: proposalSectionsReducer,
    default: () => ({}),
  }),
  
  // Evaluation results for sections
  evaluations: Annotation({
    default: () => ({}),
  }),
  
  // Current section being worked on
  currentSection: Annotation({
    default: () => undefined,
  }),
  
  // Current phase of the workflow
  currentPhase: Annotation({
    default: () => "research",
  }),
  
  // User feedback with timestamp
  userFeedback: Annotation({
    default: () => undefined,
  }),
  
  // Metadata for tracking and persistence
  metadata: Annotation({
    default: () => ({
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      proposalId: "",
      userId: "",
      proposalTitle: "",
    }),
  }),
});

/**
 * Define a type for accessing the state
 */
export const ProposalState = ProposalStateAnnotation.State;