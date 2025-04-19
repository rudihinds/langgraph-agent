import { OverallProposalState } from "../../../state/proposal.state";
import { SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { loadCriteriaConfiguration } from "./criteriaLoader";
import {
  EvaluationResult,
  evaluationResultSchema,
  calculateOverallScore,
} from "./evaluationResult";

/**
 * Options for configuring an evaluation node
 */
export interface EvaluationNodeOptions {
  /** Type of content being evaluated (e.g., "research", "solution") */
  contentType: string;

  /** Function to extract content from state */
  contentExtractor: ContentExtractor;

  /** Path to criteria configuration JSON */
  criteriaPath: string;

  /** State field to store evaluation results */
  resultField: string;

  /** State field to update status */
  statusField: string;

  /** Threshold score to pass evaluation (default: 0.7) */
  passingThreshold?: number;

  /** LLM model to use (default from config) */
  modelName?: string;

  /** Optional custom validation logic */
  customValidator?: ResultValidator;

  /** Optional custom prompt override */
  evaluationPrompt?: string;

  /** Callback for tracking state updates (for testing) */
  stateUpdateCallback?: (state: Partial<OverallProposalState>) => void;
}

/** Function to extract content from state */
export type ContentExtractor = (
  state: OverallProposalState
) => { content: string } | null;

/** Function to validate results */
export type ResultValidator = (result: any) => boolean;

/** Evaluation node function signature */
export type EvaluationNodeFunction = (
  state: OverallProposalState
) => Promise<Partial<OverallProposalState>>;

/**
 * Creates a standardized evaluation node for a specific content type
 * @param options Configuration for the evaluation node
 * @returns A node function compatible with the LangGraph StateGraph
 */
export function createEvaluationNode(
  options: EvaluationNodeOptions
): EvaluationNodeFunction {
  return async function evaluationNode(
    state: OverallProposalState
  ): Promise<Partial<OverallProposalState>> {
    // Initialize partial state with fields that will be updated
    const partialState: Partial<OverallProposalState> = {
      [options.statusField]: "evaluating",
    };

    // For testing: track state updates if callback provided
    if (options.stateUpdateCallback) {
      options.stateUpdateCallback(partialState);
    }

    // 1. Extract content to evaluate
    const content = options.contentExtractor(state);

    // Validate content exists
    if (!content) {
      return {
        [options.statusField]: "error",
        errors: [
          ...(state.errors || []),
          `Evaluation failed: ${options.contentType} content is missing`,
        ],
      };
    }

    // Validate content has required fields
    if (!content.content) {
      return {
        [options.statusField]: "error",
        errors: [
          ...(state.errors || []),
          `Evaluation failed: ${options.contentType} content is malformed or empty`,
        ],
      };
    }

    try {
      // 2. Load evaluation criteria
      const criteria = await loadCriteriaConfiguration(options.criteriaPath);

      // 3. Construct evaluation prompt
      const prompt = constructEvaluationPrompt(
        content.content,
        criteria,
        options.evaluationPrompt
      );

      // 4. Invoke LLM
      const model = new ChatOpenAI({
        modelName:
          options.modelName || process.env.EVALUATION_MODEL || "gpt-4-turbo",
        temperature: 0.2,
      });

      // Implement timeout protection (60 seconds)
      const evaluationPromise = model.invoke(prompt);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Evaluation timed out after 60 seconds")),
          60000
        )
      );

      const response = await Promise.race([evaluationPromise, timeoutPromise]);

      // 5. Process LLM response
      const evaluationText = response.content;

      // Extract JSON from response
      const jsonMatch =
        evaluationText.match(/```json\n([\s\S]*?)\n```/) ||
        evaluationText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error("Failed to extract JSON from LLM response");
      }

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const evaluationData = JSON.parse(jsonStr);

      // 6. Validate results
      const validationResult = evaluationResultSchema.safeParse(evaluationData);

      if (!validationResult.success) {
        throw new Error(`Invalid evaluation result: ${validationResult.error}`);
      }

      // Apply any custom validation if provided
      if (options.customValidator && !options.customValidator(evaluationData)) {
        throw new Error("Evaluation result failed custom validation");
      }

      // 7. Calculate pass/fail status if not explicitly set
      const evaluation: EvaluationResult = validationResult.data;

      if (evaluation.passed === undefined) {
        const threshold = options.passingThreshold || 0.7;
        evaluation.passed = evaluation.overallScore >= threshold;
      }

      // 8. Create user-friendly timestamp if not present
      if (!evaluation.timestamp) {
        evaluation.timestamp = new Date().toISOString();
      }

      // Set evaluator if not present
      if (!evaluation.evaluator) {
        evaluation.evaluator = "ai";
      }

      // 9. Prepare state updates
      return {
        [options.statusField]: "awaiting_review",
        [options.resultField]: evaluation,
        isInterrupted: true,
        interruptMetadata: {
          type: "evaluation_review",
          contentType: options.contentType,
          evaluation: evaluation,
          actions: ["approve", "revise", "edit"],
          title: `${getHumanReadableContentType(options.contentType)} Evaluation Review`,
          description: `Review the evaluation of the ${getHumanReadableContentType(options.contentType).toLowerCase()}.`,
        },
        messages: [
          ...(state.messages || []),
          new SystemMessage(
            `Evaluation of ${options.contentType} complete. Overall score: ${(evaluation.overallScore * 100).toFixed(1)}%. ${evaluation.passed ? "PASSED" : "NEEDS REVISION"}.`
          ),
        ],
      };
    } catch (error) {
      // 10. Handle errors
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown error during evaluation";

      return {
        [options.statusField]: "error",
        errors: [
          ...(state.errors || []),
          `Evaluation of ${options.contentType} failed: ${errorMessage}`,
        ],
        messages: [
          ...(state.messages || []),
          new SystemMessage(
            `Error during evaluation of ${options.contentType}: ${errorMessage}`
          ),
        ],
      };
    }
  };
}

/**
 * Construct the evaluation prompt
 */
function constructEvaluationPrompt(
  content: string,
  criteria: any,
  customPrompt?: string
): string {
  if (customPrompt) {
    return customPrompt
      .replace("{{content}}", content)
      .replace("{{criteria}}", JSON.stringify(criteria, null, 2));
  }

  return `
You are an expert evaluator tasked with assessing content quality according to specific criteria.

# Content to Evaluate

${content}

# Evaluation Criteria

${JSON.stringify(criteria, null, 2)}

# Instructions

1. Carefully review the content above
2. Evaluate it against each criterion
3. For each criterion, assign a score between 0.0 and 1.0
4. Identify specific strengths and weaknesses
5. Provide constructive suggestions for improvement
6. Determine whether the content passes based on the overall score and criteria thresholds
7. Format your evaluation as a JSON object with the following structure:

\`\`\`json
{
  "passed": boolean,
  "overallScore": number,
  "scores": {
    "criterionId1": number,
    "criterionId2": number,
    ...
  },
  "strengths": ["strength1", "strength2", ...],
  "weaknesses": ["weakness1", "weakness2", ...],
  "suggestions": ["suggestion1", "suggestion2", ...],
  "feedback": "Detailed evaluation feedback"
}
\`\`\`

Ensure all fields are present and properly formatted. Be objective, precise, and constructive in your evaluation.
`;
}

/**
 * Convert contentType to human-readable format
 */
function getHumanReadableContentType(contentType: string): string {
  const mapping: Record<string, string> = {
    research: "Research",
    solution: "Solution Analysis",
    connections: "Connection Pairs",
    problem_statement: "Problem Statement",
    approach: "Approach",
    methodology: "Methodology",
    budget: "Budget",
    timeline: "Timeline",
  };

  return (
    mapping[contentType] ||
    contentType.charAt(0).toUpperCase() + contentType.slice(1)
  );
}
