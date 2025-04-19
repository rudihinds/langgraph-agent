import path from "path";
import fs from "fs/promises";
import { z } from "zod";
import {
  BaseMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import {
  OverallProposalState,
  ProcessingStatus,
  InterruptMetadata,
  InterruptReason,
} from "../state/proposal.state.js";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

/**
 * Interface for evaluation results
 */
export interface EvaluationResult {
  passed: boolean;
  timestamp: string;
  evaluator: "ai" | "human" | string;
  overallScore: number;
  scores: {
    [criterionId: string]: number;
  };
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  feedback: string;
  rawResponse?: any;
}

/**
 * Zod schema for validating evaluation results
 */
export const EvaluationResultSchema = z.object({
  passed: z.boolean(),
  timestamp: z.string().datetime(),
  evaluator: z.union([z.literal("ai"), z.literal("human"), z.string()]),
  overallScore: z.number().min(0).max(1),
  scores: z.record(z.string(), z.number().min(0).max(1)),
  strengths: z.array(z.string()).min(1),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
  feedback: z.string().min(1),
  rawResponse: z.any().optional(),
});

/**
 * Interface for evaluation criteria configuration
 */
export interface EvaluationCriteria {
  id: string;
  name: string;
  version: string;
  criteria: Array<{
    id: string;
    name: string;
    description: string;
    weight: number;
    isCritical: boolean;
    passingThreshold: number;
    scoringGuidelines: {
      excellent: string;
      good: string;
      adequate: string;
      poor: string;
      inadequate: string;
    };
  }>;
  passingThreshold: number;
}

/**
 * Default evaluation criteria
 */
export const DEFAULT_CRITERIA: EvaluationCriteria = {
  id: "default",
  name: "Default Evaluation Criteria",
  version: "1.0.0",
  criteria: [
    {
      id: "relevance",
      name: "Relevance",
      description: "Content addresses key requirements",
      weight: 0.4,
      isCritical: true,
      passingThreshold: 0.6,
      scoringGuidelines: {
        excellent: "Fully addresses all requirements",
        good: "Addresses most requirements",
        adequate: "Addresses key requirements",
        poor: "Misses some key requirements",
        inadequate: "Fails to address requirements",
      },
    },
    {
      id: "completeness",
      name: "Completeness",
      description: "All required elements are present",
      weight: 0.3,
      isCritical: false,
      passingThreshold: 0.5,
      scoringGuidelines: {
        excellent: "All elements present with detail",
        good: "All elements present",
        adequate: "Most elements present",
        poor: "Missing several elements",
        inadequate: "Missing most elements",
      },
    },
    {
      id: "clarity",
      name: "Clarity",
      description: "Content is clear and understandable",
      weight: 0.3,
      isCritical: false,
      passingThreshold: 0.5,
      scoringGuidelines: {
        excellent: "Exceptionally clear and well-organized",
        good: "Clear and organized",
        adequate: "Generally clear",
        poor: "Confusing in places",
        inadequate: "Difficult to understand",
      },
    },
  ],
  passingThreshold: 0.7,
};

/**
 * Zod schema for validating evaluation criteria
 */
export const EvaluationCriteriaSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  criteria: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        weight: z.number(),
        isCritical: z.boolean().optional().default(false),
        passingThreshold: z.number().min(0).max(1),
        scoringGuidelines: z
          .object({
            excellent: z.string(),
            good: z.string(),
            adequate: z.string(),
            poor: z.string(),
            inadequate: z.string(),
          })
          .optional()
          .default({
            excellent: "Excellent",
            good: "Good",
            adequate: "Adequate",
            poor: "Poor",
            inadequate: "Inadequate",
          }),
      })
    )
    .min(1),
  passingThreshold: z.number().min(0).max(1),
  evaluationInstructions: z.string().optional(),
});

/**
 * Type for content extractor function
 */
export type ContentExtractor = (state: OverallProposalState) => any;

/**
 * Type for result validation function
 */
export type ValidationResult = boolean | { valid: boolean; error?: string };
export type ResultValidator = (result: any) => ValidationResult;

/**
 * Interface for evaluation node options
 */
export interface EvaluationNodeOptions {
  contentType: string;
  contentExtractor: ContentExtractor;
  criteriaPath: string;
  evaluationPrompt?: string;
  resultField: string;
  statusField: string;
  passingThreshold?: number;
  modelName?: string;
  customValidator?: ResultValidator;
  timeoutSeconds?: number;
}

/**
 * Type for evaluation node function
 */
export type EvaluationNodeFunction = (
  state: OverallProposalState
) => Promise<Partial<OverallProposalState>>;

/**
 * Loads the criteria configuration from a JSON file
 * @param filePath Path to the criteria configuration file
 * @returns Parsed and validated criteria configuration
 */
export async function loadCriteriaConfiguration(
  filePath: string
): Promise<EvaluationCriteria> {
  try {
    // Resolve the path relative to the project root or intelligently handle absolute/relative
    // Assuming filePath is like 'research.json' or potentially 'custom/path/research.json'
    // Let's resolve relative to the project root initially.
    // IMPORTANT: This assumes the process runs from the project root.
    // A more robust solution might involve environment variables or a config service.
    const basePath = process.cwd(); // Get current working directory (project root assumed)
    const fullPath = path.resolve(
      basePath,
      "config/evaluation/criteria",
      filePath
    );
    console.log(`Attempting to load criteria from: ${fullPath}`); // Add logging

    // Check if file exists
    await fs.access(fullPath);

    // Read and parse file
    const fileContent = await fs.readFile(fullPath, "utf-8");
    const criteriaData = JSON.parse(fileContent);

    // Validate against schema
    const result = EvaluationCriteriaSchema.safeParse(criteriaData);

    if (!result.success) {
      console.warn(
        `Invalid criteria configuration in ${filePath}: ${result.error.message}`
      );
      console.warn("Using default criteria instead");
      return DEFAULT_CRITERIA;
    }

    return criteriaData as EvaluationCriteria;
  } catch (error: unknown) {
    // Explicitly handle unknown error type
    let errorMessage = "An unknown error occurred while loading criteria";
    if (error instanceof Error) {
      errorMessage = error.message;
      console.warn(
        `Failed to load criteria from ${filePath}: ${error.stack || error.message}`
      );
    } else {
      errorMessage = String(error);
      console.warn(
        `Failed to load criteria from ${filePath} with non-Error object:`,
        error
      );
    }
    console.warn("Using default criteria instead");
    return DEFAULT_CRITERIA;
  }
}

/**
 * Calculates the overall score based on individual scores and weights
 * @param scores Object with criterion IDs as keys and scores as values
 * @param weights Object with criterion IDs as keys and weights as values
 * @returns Weighted average score
 */
export function calculateOverallScore(
  scores: Record<string, number>,
  weights: Record<string, number>
): number {
  let totalScore = 0;
  let totalWeight = 0;

  for (const criterionId in scores) {
    if (weights[criterionId]) {
      totalScore += scores[criterionId] * weights[criterionId];
      totalWeight += weights[criterionId];
    }
  }

  // If no weights were found, return a simple average
  if (totalWeight === 0) {
    const values = Object.values(scores);
    return values.reduce((sum, score) => sum + score, 0) / values.length;
  }

  return totalScore / totalWeight;
}

/**
 * Creates a standardized evaluation node for a specific content type
 * @param options Configuration for the evaluation node
 * @returns A node function compatible with the LangGraph StateGraph
 */
export function createEvaluationNode(
  options: EvaluationNodeOptions
): EvaluationNodeFunction {
  // Set default values for optional parameters
  const passingThreshold = options.passingThreshold ?? 0.7;
  const modelName =
    options.modelName ?? process.env.EVALUATION_MODEL_NAME ?? "gpt-4";
  const timeoutSeconds = options.timeoutSeconds ?? 60;

  // Return the node function
  return async function evaluationNode(
    state: OverallProposalState
  ): Promise<Partial<OverallProposalState>> {
    try {
      // 1. Input Validation
      const content = options.contentExtractor(state);
      if (!content) {
        return {
          [options.statusField]: "error" as ProcessingStatus,
          errors: [
            ...(state.errors || []),
            `${options.contentType} evaluation failed: Content is missing or empty`,
          ],
          messages: [
            ...(state.messages || []),
            new SystemMessage(
              `An error occurred during ${options.contentType} evaluation: Content is missing or empty`
            ),
          ],
        };
      }

      // Add custom validation support
      if (options.customValidator) {
        const validationResult = options.customValidator(content);

        // Handle both boolean and object-style results
        if (
          validationResult === false ||
          (typeof validationResult === "object" &&
            validationResult.valid === false)
        ) {
          const errorMessage =
            typeof validationResult === "object"
              ? validationResult.error || "Custom validation failed"
              : "Custom validation failed";

          return {
            [options.statusField]: "error" as ProcessingStatus,
            errors: [
              ...(state.errors || []),
              `${options.contentType} evaluation failed: ${errorMessage}`,
            ],
            messages: [
              ...(state.messages || []),
              new SystemMessage(
                `An error occurred during ${options.contentType} evaluation: ${errorMessage}`
              ),
            ],
          };
        }
      }

      // 2. Status Update
      const partialState: Partial<OverallProposalState> = {
        [options.statusField]: "evaluating" as ProcessingStatus,
      };

      // 3. Criteria Loading
      const criteria = await loadCriteriaConfiguration(options.criteriaPath);

      // 4. Prompt Construction
      const prompt =
        options.evaluationPrompt ??
        `Evaluate the following ${options.contentType} content based on these criteria:\n\n` +
          `${JSON.stringify(criteria, null, 2)}\n\n` +
          `Content to evaluate:\n${JSON.stringify(content, null, 2)}\n\n` +
          `Provide a detailed evaluation with scores for each criterion, strengths, weaknesses, ` +
          `suggestions for improvement, and an overall assessment.`;

      // 5. Agent/LLM Invocation with Timeout
      // Setup AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutSeconds * 1000);

      try {
        // If custom validator is provided, check if content is valid first
        if (options.customValidator && !options.customValidator(content)) {
          return {
            ...state,
            [options.statusField]: "error" as ProcessingStatus,
            errors: [
              ...(state.errors || []),
              `Custom validation failed for ${options.contentType} content.`,
            ],
            messages: [
              ...(state.messages || []),
              new SystemMessage(
                `❌ ${options.contentType} validation failed. Please check the content and try again.`
              ),
            ],
          };
        }

        // Proceed with evaluation
        const llm = new ChatOpenAI({
          modelName: "gpt-4o-2024-05-13",
          temperature: 0,
          timeout: timeoutSeconds * 1000, // Convert to ms
        });

        // Build the prompt
        const res = await llm.invoke([
          new SystemMessage(prompt),
          new HumanMessage(String(content)),
        ]);

        // Parse the response
        let evaluationResult: EvaluationResult;
        try {
          evaluationResult = JSON.parse(
            String(res.content)
          ) as EvaluationResult;

          // Add timestamp if not provided in the response
          if (!evaluationResult.timestamp) {
            evaluationResult.timestamp = new Date().toISOString();
          }
        } catch (e: unknown) {
          const parseError = e instanceof Error ? e.message : String(e);
          return {
            ...state,
            [options.statusField]: "error" as ProcessingStatus,
            errors: [
              ...(state.errors || []),
              `Failed to parse LLM response for ${options.contentType} evaluation: ${parseError}`,
            ],
            messages: [
              ...(state.messages || []),
              new SystemMessage(
                `❌ Failed to parse ${options.contentType} evaluation. The LLM did not return valid JSON.`
              ),
            ],
          };
        }

        // Update state with evaluation result and metadata for interruption
        return {
          ...state,
          [options.resultField]: evaluationResult,
          [options.statusField]: "awaiting_review" as ProcessingStatus,
          interruptStatus: {
            isInterrupted: true,
            interruptionPoint: "evaluation",
            processingStatus: "awaiting_review",
          },
          interruptMetadata: {
            reason: "EVALUATION_NEEDED" as InterruptReason,
            contentReference: options.contentType,
            evaluationResult: evaluationResult,
          } as InterruptMetadata,
          messages: [
            ...(state.messages || []),
            new SystemMessage(
              `✅ ${options.contentType} evaluation completed.`
            ),
          ],
        } as any;
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        const errorMessage = error.message;

        // Check if this is a timeout error
        const isTimeout =
          error.name === "AbortError" || errorMessage.includes("timed out");

        const formattedErrorMessage = isTimeout
          ? `${options.contentType} evaluation timed out after ${timeoutSeconds} seconds`
          : `LLM API error during ${options.contentType} evaluation: ${errorMessage}`;

        return {
          ...state,
          [options.statusField]: "error" as ProcessingStatus,
          errors: [...(state.errors || []), formattedErrorMessage],
          messages: [
            ...(state.messages || []),
            new SystemMessage(
              `❌ Error during ${options.contentType} evaluation: ${
                isTimeout
                  ? "The operation timed out."
                  : "There was an issue with the LLM API."
              }`
            ),
          ],
        };
      }
    } catch (error: unknown) {
      // Handle unexpected errors
      let errorMessage = "An unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
        console.error(
          `${options.contentType} evaluation failed unexpectedly: ${error.stack || error.message}`
        );
      } else {
        errorMessage = String(error);
        console.error(
          `${options.contentType} evaluation failed unexpectedly with non-Error object:`,
          error
        );
      }
      return {
        [options.statusField]: "error" as ProcessingStatus,
        errors: [
          ...(state.errors || []),
          `${options.contentType} evaluation failed: Unexpected error: ${errorMessage}`,
        ],
        messages: [
          ...(state.messages || []),
          new SystemMessage(
            `An error occurred during ${options.contentType} evaluation: ${errorMessage}`
          ),
        ],
      };
    }
  };
}

// Export factory
export { EvaluationNodeFactory } from "./factory.js";
export type { EvaluationNodeFactoryOptions } from "./factory.js";
export { default as EvaluationNodeFactoryDefault } from "./factory.js";

// Export content extractors
export * from "./extractors.js";
