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
 * Structure for a subcategory analysis within a main research category
 * Each key is a subcategory name, and the value is the analysis text
 */
export type CategoryAnalysis = Record<string, string>;

/**
 * Deep research results structure that matches the 12-category output
 * from the deep research prompt. This more flexible approach allows
 * the agent to classify observations as it sees fit within the defined
 * top-level categories.
 */
export interface DeepResearchResults {
  "Structural & Contextual Analysis": CategoryAnalysis;
  "Author/Organization Deep Dive": CategoryAnalysis;
  "Hidden Needs & Constraints": CategoryAnalysis;
  "Competitive Intelligence": CategoryAnalysis;
  "Psychological Triggers": CategoryAnalysis;
  "Temporal & Trend Alignment": CategoryAnalysis;
  "Narrative Engineering": CategoryAnalysis;
  "Compliance Sleuthing": CategoryAnalysis;
  "Cultural & Linguistic Nuances": CategoryAnalysis;
  "Risk Mitigation Signaling": CategoryAnalysis;
  "Emotional Subtext": CategoryAnalysis;
  "Unfair Advantage Tactics": CategoryAnalysis;
  [key: string]: CategoryAnalysis; // Allow for additional categories if needed
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
 *
 * Using a more flexible approach to match the DeepResearchResults structure while
 * still providing validation for expected fields
 */
export const ResearchStateSchema = z.object({
  rfpDocument: z.object({
    id: z.string(),
    text: z.string(),
    metadata: z.record(z.any()),
  }),
  deepResearchResults: z
    .object({
      "Structural & Contextual Analysis": z.record(z.string()),
      "Author/Organization Deep Dive": z.record(z.string()),
      "Hidden Needs & Constraints": z.record(z.string()),
      "Competitive Intelligence": z.record(z.string()),
      "Psychological Triggers": z.record(z.string()),
      "Temporal & Trend Alignment": z.record(z.string()),
      "Narrative Engineering": z.record(z.string()),
      "Compliance Sleuthing": z.record(z.string()),
      "Cultural & Linguistic Nuances": z.record(z.string()),
      "Risk Mitigation Signaling": z.record(z.string()),
      "Emotional Subtext": z.record(z.string()),
      "Unfair Advantage Tactics": z.record(z.string()),
    })
    .catchall(z.record(z.string()))
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
