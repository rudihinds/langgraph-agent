import { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { z } from "zod";

/**
 * Structure for a subcategory analysis within a main research category
 * Each key is a subcategory name, and the value is the analysis text
 */
type CategoryAnalysis = Record<string, string>;

/**
 * Deep research results structure that matches the 12-category output
 * from the deep research prompt. This more flexible approach allows
 * the agent to classify observations as it sees fit within the defined
 * top-level categories.
 */
interface DeepResearchResults {
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
 * Solution sought analysis results with a flexible structure
 * Captures core expected fields while allowing for additional data
 */
interface SolutionSoughtResults {
  // Core fields aligned with the solution sought prompt
  solution_sought: string;
  solution_approach: {
    primary_approaches: string[];
    secondary_approaches: string[];
    evidence: Array<{
      approach: string;
      evidence: string;
      page: string;
    }>;
  };
  explicitly_unwanted: Array<{
    approach: string;
    evidence: string;
    page: string;
  }>;
  turn_off_approaches: string[];

  // Allow for any additional fields the agent might include
  [key: string]: any;
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
 * Using a flexible approach to match the deepResearchResults and
 * solutionSoughtResults structures while still providing validation
 * for expected fields
 */
const ResearchStateSchema = z.object({
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
    .catchall(z.any())
    .nullable(),
  messages: z.array(z.any()),
  errors: z.array(z.string()),
  status: z.object({
    documentLoaded: z.boolean(),
    researchComplete: z.boolean(),
    solutionAnalysisComplete: z.boolean(),
  }),
});
