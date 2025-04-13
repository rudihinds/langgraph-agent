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
 * Evidence for an approach with source information
 */
export interface ApproachEvidence {
  approach: string;
  evidence: string;
  page: string;
}

/**
 * Unwanted approach with evidence
 */
export interface UnwantedApproach {
  approach: string;
  evidence: string;
  page: string;
}

/**
 * Solution approach details
 */
export interface SolutionApproach {
  primary_approaches: string[];
  secondary_approaches: string[];
  evidence: ApproachEvidence[];
}

/**
 * Solution sought analysis results
 */
export interface SolutionSoughtResults {
  solution_sought: string;
  solution_approach: SolutionApproach;
  explicitly_unwanted: UnwantedApproach[];
  turn_off_approaches: string[];
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
    value: (existing, newValue) => newValue ?? existing,
    default: () => null,
  }),

  // Solution sought analysis
  solutionSoughtResults: Annotation<SolutionSoughtResults | null>({
    value: (existing, newValue) => newValue ?? existing,
    default: () => null,
  }),

  // Standard message state for conversation history
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),

  // Error tracking
  errors: Annotation<string[]>({
    value: (curr, update) => [...(curr || []), ...update],
    default: () => [],
  }),

  // Status tracking
  status: Annotation<{
    documentLoaded: boolean;
    researchComplete: boolean;
    solutionAnalysisComplete: boolean;
  }>({
    value: (existing, newValue) => ({ ...existing, ...newValue }),
    default: () => ({
      documentLoaded: false,
      researchComplete: false,
      solutionAnalysisComplete: false,
    }),
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
  deepResearchResults: z
    .object({
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
    })
    .nullable(),
  solutionSoughtResults: z
    .object({
      solution_sought: z.string(),
      solution_approach: z.object({
        primary_approaches: z.array(z.string()),
        secondary_approaches: z.array(z.string()),
        evidence: z.array(
          z.object({
            approach: z.string(),
            evidence: z.string(),
            page: z.string(),
          })
        ),
      }),
      explicitly_unwanted: z.array(
        z.object({
          approach: z.string(),
          evidence: z.string(),
          page: z.string(),
        })
      ),
      turn_off_approaches: z.array(z.string()),
    })
    .nullable(),
  messages: z.array(z.any()),
  errors: z.array(z.string()),
  status: z.object({
    documentLoaded: z.boolean(),
    researchComplete: z.boolean(),
    solutionAnalysisComplete: z.boolean(),
  }),
});
