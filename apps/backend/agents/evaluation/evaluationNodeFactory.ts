import { ChatOpenAI } from "@langchain/openai";
import { LangChainTracer } from "langchain/callbacks";
import { ConsoleCallbackHandler } from "langchain/callbacks";
import { withRetry } from "@langchain/core/runnables";
import fs from "fs";
import path from "path";

// Add .js extensions to local imports
import {
  ProcessingStatus,
  SectionStatus,
} from "../../state/modules/constants.js";
import { Logger, LogLevel } from "../../lib/logger.js";
import { OverallProposalState } from "../../state/proposal.state.js";

// Create logger instance
const logger = Logger.getInstance();

/**
 * Options for configuring an evaluation node
 */
export interface EvaluationNodeOptions {
  /**
   * The type of content being evaluated (e.g., "research", "solution")
   */
  contentType: string;
  /**
   * Function to extract the content to be evaluated from the state
   */
  contentExtractor: ContentExtractor;
  /**
   * Path to the JSON file containing evaluation criteria
   */
  criteriaPath: string;
  /**
   * Field in the state to store the evaluation result
   */
  resultField: string;
  /**
   * Field in the state to store the evaluation status
   */
  statusField: string;
  /**
   * Threshold for passing evaluation (0-100)
   */
  passingThreshold?: number;
  /**
   * Model name to use for evaluation
   */
  modelName?: string;
  /**
   * Custom validator function for evaluation results
   */
  customValidator?: ResultValidator;
  /**
   * Custom evaluation prompt template
   */
  evaluationPrompt?: string;
  /**
   * Callback to update state with evaluation results
   */
  stateUpdateCallback?: (state: any, results: EvaluationResult) => any;
}

/** Function to extract content from state */
export type ContentExtractor = (state: OverallProposalState) => string | null;

/** Function to validate results */
export type ResultValidator = (result: EvaluationResult) => boolean;

/** Evaluation node function signature */
export type EvaluationNodeFunction = (
  state: OverallProposalState
) => Promise<OverallProposalState>;

export interface EvaluationResult {
  scores: {
    [criterion: string]: number;
  };
  feedback: {
    [criterion: string]: string;
  };
  overallScore: number;
  passed: boolean;
  summary: string;
}

export class EvaluationNodeFactory {
  /**
   * Create a model instance with the specified options
   */
  private static getModel(options: EvaluationNodeOptions): ChatOpenAI {
    const modelName = options.modelName || "gpt-4-turbo";
    const model = new ChatOpenAI({
      modelName,
      temperature: 0,
      callbacks: [new LangChainTracer(), new ConsoleCallbackHandler()],
    });

    // Apply retry functionality
    return model.withRetry({
      stopAfterAttempt: 3,
      onFailedAttempt: (error) => {
        const attemptNumber = error.attemptNumber || 1;
        logger.info(`Retrying evaluation (attempt ${attemptNumber})...`);
      },
    }) as ChatOpenAI;
  }

  /**
   * Create an evaluation node function based on the provided options
   */
  public static createNode(
    options: EvaluationNodeOptions
  ): EvaluationNodeFunction {
    return async (
      state: OverallProposalState
    ): Promise<OverallProposalState> => {
      try {
        // Extract content to evaluate
        const content = options.contentExtractor(state);
        if (!content) {
          logger.error(`No content to evaluate for ${options.contentType}`);
          return {
            ...state,
            [options.statusField]: ProcessingStatus.ERROR,
            errors: [
              ...(state.errors || []),
              {
                type: "evaluation",
                message: `Failed to extract content for ${options.contentType} evaluation`,
                timestamp: new Date().toISOString(),
              },
            ],
          };
        }

        // Load evaluation criteria
        const criteria = await loadJSONFile(options.criteriaPath);
        if (!criteria || !criteria.criteria) {
          logger.error(
            `Failed to load evaluation criteria from ${options.criteriaPath}`
          );
          return {
            ...state,
            [options.statusField]: ProcessingStatus.ERROR,
            errors: [
              ...(state.errors || []),
              {
                type: "evaluation",
                message: `Failed to load evaluation criteria from ${options.criteriaPath}`,
                timestamp: new Date().toISOString(),
              },
            ],
          };
        }

        // Get the evaluation model
        const model = EvaluationNodeFactory.getModel(options);

        // Construct evaluation prompt
        const prompt = EvaluationNodeFactory.constructEvaluationPrompt(
          options.contentType,
          content,
          criteria,
          options.evaluationPrompt
        );

        // Invoke the model with retry functionality built in
        logger.info(`Evaluating ${options.contentType}...`);
        const response = await model.invoke(prompt);

        // Process the response
        let result: EvaluationResult;
        try {
          const content = response.content;
          if (typeof content !== "string") {
            throw new Error("Invalid response format");
          }

          // Find the JSON part of the response
          const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
          const jsonString = jsonMatch ? jsonMatch[1] : content;

          result = JSON.parse(jsonString);

          // Validate the result structure
          if (!result.scores || !result.feedback || !result.overallScore) {
            throw new Error("Invalid evaluation result structure");
          }
        } catch (error) {
          logger.error(`Failed to parse evaluation response: ${error}`);
          return {
            ...state,
            [options.statusField]: ProcessingStatus.ERROR,
            errors: [
              ...(state.errors || []),
              {
                type: "evaluation",
                message: `Failed to parse evaluation response: ${error}`,
                timestamp: new Date().toISOString(),
              },
            ],
          };
        }

        // Validate the result
        let passed = false;
        if (options.customValidator) {
          passed = options.customValidator(result);
        } else {
          const threshold = options.passingThreshold || 70;
          passed = result.overallScore >= threshold;
        }

        result.passed = passed;

        // Prepare state update
        const newStatus = passed
          ? ProcessingStatus.APPROVED
          : ProcessingStatus.NEEDS_REVISION;
        let updatedState = {
          ...state,
          [options.resultField]: result,
          [options.statusField]: newStatus,
        };

        // Apply custom state update if provided
        if (options.stateUpdateCallback) {
          updatedState = options.stateUpdateCallback(updatedState, result);
        }

        logger.info(
          `Evaluation complete for ${options.contentType}. Result: ${passed ? "Passed" : "Failed"} (${result.overallScore})`
        );
        return updatedState;
      } catch (error) {
        logger.error(`Error in evaluation node: ${error}`);
        return {
          ...state,
          [options.statusField]: ProcessingStatus.ERROR,
          errors: [
            ...(state.errors || []),
            {
              type: "evaluation",
              message: `Error in evaluation node: ${error}`,
              timestamp: new Date().toISOString(),
            },
          ],
        };
      }
    };
  }

  /**
   * Construct the evaluation prompt based on the content and criteria
   */
  private static constructEvaluationPrompt(
    contentType: string,
    content: string,
    criteria: any,
    customPrompt?: string
  ) {
    if (customPrompt) {
      return customPrompt
        .replace("{content}", content)
        .replace(
          "{content_type}",
          EvaluationNodeFactory.formatContentType(contentType)
        )
        .replace("{criteria}", JSON.stringify(criteria, null, 2));
    }

    return [
      {
        role: "system",
        content: `You are an expert evaluator for proposal content. You will be given ${EvaluationNodeFactory.formatContentType(contentType)} content from a proposal, and you need to evaluate it based on specific criteria. Provide a fair and objective assessment.`,
      },
      {
        role: "user",
        content: `Please evaluate the following ${EvaluationNodeFactory.formatContentType(contentType)} content:

${content}

Use these evaluation criteria:
${JSON.stringify(criteria, null, 2)}

For each criterion, assign a score from 0-100 and provide specific, constructive feedback.

Your response should be in JSON format:
\`\`\`json
{
  "scores": {
    "criterion1": 85,
    "criterion2": 70,
    // etc. for all criteria
  },
  "feedback": {
    "criterion1": "Specific feedback for criterion1",
    "criterion2": "Specific feedback for criterion2",
    // etc. for all criteria
  },
  "overallScore": 75, // Average of all scores
  "summary": "A 2-3 sentence summary of the overall evaluation and key areas for improvement."
}
\`\`\`
`,
      },
    ];
  }

  /**
   * Format content type to a human-readable format
   */
  private static formatContentType(contentType: string): string {
    return contentType
      .replace(/([A-Z])/g, " $1")
      .toLowerCase()
      .trim();
  }
}

// Implement loadJSONFile function directly instead of importing it
async function loadJSONFile(filePath: string): Promise<any> {
  try {
    // Handle both absolute and relative paths
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    // Read and parse the file
    const rawData = fs.readFileSync(resolvedPath, "utf-8");
    return JSON.parse(rawData);
  } catch (error) {
    logger.error(`Error loading JSON file: ${error}`);
    return null;
  }
}

/**
 * Convenience wrapper function for creating evaluation nodes
 * @param options Configuration options for the evaluation node
 * @returns An evaluation node function
 */
export function createEvaluationNode(
  options: EvaluationNodeOptions
): EvaluationNodeFunction {
  return EvaluationNodeFactory.createNode(options);
}
