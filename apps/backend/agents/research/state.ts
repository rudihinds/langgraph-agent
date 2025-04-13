import { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { z } from "zod";

/**
 * Organization information extracted from research
 */
export interface Organization {
  name: string;
  background: string;
  priorities: string[];
}

/**
 * Project details extracted from RFP
 */
export interface Project {
  objectives: string[];
  requirements: string[];
  timeline: string;
  budget: string;
}

/**
 * Evaluation criteria and process
 */
export interface Evaluation {
  criteria: string[];
  process: string;
}

/**
 * Key insights and opportunities
 */
export interface Insights {
  keyFindings: string[];
  uniqueOpportunities: string[];
}

/**
 * Deep research results structure
 */
export interface DeepResearchResults {
  organization: Organization;
  project: Project;
  evaluation: Evaluation;
  insights: Insights;
}

/**
 * Solution profile identified in analysis
 */
export interface SolutionProfile {
  idealApproach: string;
  keyFunctions: string[];
  successMetrics: string[];
}

/**
 * Technical requirements for the solution
 */
export interface TechnicalRequirements {
  mustHave: string[];
  niceToHave: string[];
  constraints: string[];
}

/**
 * Competitive advantage elements
 */
export interface CompetitiveAdvantage {
  differentiators: string[];
  winningStrategies: string[];
}

/**
 * Solution sought analysis results
 */
export interface SolutionSoughtResults {
  solutionProfile: SolutionProfile;
  technicalRequirements: TechnicalRequirements;
  competitiveAdvantage: CompetitiveAdvantage;
}

/**
 * Define the research agent state using LangGraph's Annotation system
 */
export const ResearchStateAnnotation = Annotation.Root({
  // Original document
  rfpDocument: Annotation<{
    id: string;
    text: string;
    metadata: Record<string, any>;
  }>(),
  
  // Research findings
  deepResearchResults: Annotation<DeepResearchResults | null>({
    default: null,
  }),
  
  // Solution sought analysis
  solutionSoughtResults: Annotation<SolutionSoughtResults | null>({
    default: null,
  }),
  
  // Standard message state for conversation history
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),
  
  // Error tracking
  errors: Annotation<string[]>({
    default: [],
    reducer: (curr, update) => [...(curr || []), ...update],
  }),
  
  // Status tracking
  status: Annotation<{
    documentLoaded: boolean;
    researchComplete: boolean;
    solutionAnalysisComplete: boolean;
  }>({
    default: {
      documentLoaded: false,
      researchComplete: false,
      solutionAnalysisComplete: false,
    },
  }),
});

/**
 * Export the state type for use in node functions
 */
export type ResearchState = typeof ResearchStateAnnotation.State;

/**
 * Zod schema for state validation
 */
export const ResearchStateSchema = z.object({
  rfpDocument: z.object({
    id: z.string(),
    text: z.string(),
    metadata: z.record(z.any()),
  }),
  deepResearchResults: z.object({
    organization: z.object({
      name: z.string(),
      background: z.string(),
      priorities: z.array(z.string()),
    }),
    project: z.object({
      objectives: z.array(z.string()),
      requirements: z.array(z.string()),
      timeline: z.string(),
      budget: z.string(),
    }),
    evaluation: z.object({
      criteria: z.array(z.string()),
      process: z.string(),
    }),
    insights: z.object({
      keyFindings: z.array(z.string()),
      uniqueOpportunities: z.array(z.string()),
    }),
  }).nullable(),
  solutionSoughtResults: z.object({
    solutionProfile: z.object({
      idealApproach: z.string(),
      keyFunctions: z.array(z.string()),
      successMetrics: z.array(z.string()),
    }),
    technicalRequirements: z.object({
      mustHave: z.array(z.string()),
      niceToHave: z.array(z.string()),
      constraints: z.array(z.string()),
    }),
    competitiveAdvantage: z.object({
      differentiators: z.array(z.string()),
      winningStrategies: z.array(z.string()),
    }),
  }).nullable(),
  messages: z.array(z.any()),
  errors: z.array(z.string()),
  status: z.object({
    documentLoaded: z.boolean(),
    researchComplete: z.boolean(),
    solutionAnalysisComplete: z.boolean(),
  }),
});