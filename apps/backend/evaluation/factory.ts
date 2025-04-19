import {
  EvaluationNodeOptions,
  EvaluationNodeFunction,
  EvaluationCriteria,
  createEvaluationNode,
  loadCriteriaConfiguration,
} from "./index.js";
import { OverallProposalState } from "../state/proposal.state.js";
import * as extractors from "./extractors.js";

/**
 * Configuration options for the EvaluationNodeFactory
 */
export interface EvaluationNodeFactoryOptions {
  temperature?: number;
  criteriaDirPath?: string;
  modelName?: string;
  defaultTimeoutSeconds?: number;
}

/**
 * Factory class for creating standardized evaluation nodes.
 * Encapsulates configuration and logic for generating evaluation node functions.
 */
export class EvaluationNodeFactory {
  private readonly temperature: number;
  private readonly criteriaDirPath: string;
  private readonly modelName: string;
  private readonly defaultTimeoutSeconds: number;

  /**
   * Creates an instance of EvaluationNodeFactory.
   * @param options Configuration options for the factory.
   */
  constructor(options: EvaluationNodeFactoryOptions = {}) {
    this.temperature = options.temperature ?? 0; // Default to 0 for deterministic eval
    this.criteriaDirPath = options.criteriaDirPath ?? ""; // Empty string - path is handled by loadCriteriaConfiguration
    this.modelName = options.modelName ?? "gpt-4o-2024-05-13"; // Specify default model
    this.defaultTimeoutSeconds = options.defaultTimeoutSeconds ?? 60; // Default 60s timeout
  }

  /**
   * Creates an evaluation node function for a specific content type.
   * This method leverages the existing createEvaluationNode function, passing
   * the factory's configured defaults and any overrides.
   *
   * @param contentType The type of content the node will evaluate (e.g., 'research', 'solution').
   *                    This is used to determine the default criteria file path.
   * @param overrides Optional configuration overrides specific to this node.
   *                  These will take precedence over factory defaults.
   * @returns An EvaluationNodeFunction ready to be used in a LangGraph graph.
   */
  public createNode(
    contentType: string,
    overrides: Partial<EvaluationNodeOptions> = {}
  ): EvaluationNodeFunction {
    const criteriaFileName = `${contentType}.json`;
    const defaultCriteriaPath = this.criteriaDirPath
      ? `${this.criteriaDirPath}/${criteriaFileName}`
      : criteriaFileName;

    // Combine factory defaults with specific overrides
    const nodeOptions: EvaluationNodeOptions = {
      contentType: contentType,
      // Provide required fields that might be in overrides or need defaults
      contentExtractor: overrides.contentExtractor!, // Needs to be provided in overrides
      resultField: overrides.resultField!, // Needs to be provided in overrides
      statusField: overrides.statusField!, // Needs to be provided in overrides
      // Use factory defaults, overridden by specific options
      criteriaPath: overrides.criteriaPath ?? defaultCriteriaPath,
      modelName: overrides.modelName ?? this.modelName,
      timeoutSeconds: overrides.timeoutSeconds ?? this.defaultTimeoutSeconds,
      passingThreshold: overrides.passingThreshold, // Allow override, default handled within createEvaluationNode
      evaluationPrompt: overrides.evaluationPrompt, // Allow override
      customValidator: overrides.customValidator, // Allow override
    };

    // Validate required overrides are present
    if (!nodeOptions.contentExtractor) {
      throw new Error(
        `Content extractor must be provided in overrides for content type '${contentType}'`
      );
    }
    if (!nodeOptions.resultField) {
      throw new Error(
        `Result field must be provided in overrides for content type '${contentType}'`
      );
    }
    if (!nodeOptions.statusField) {
      throw new Error(
        `Status field must be provided in overrides for content type '${contentType}'`
      );
    }

    // Use the existing createEvaluationNode function with the composed options
    return createEvaluationNode(nodeOptions);
  }

  /**
   * Creates a research evaluation node with default settings
   * @returns An evaluation node function for research content
   */
  public createResearchEvaluationNode(
    overrides: Partial<EvaluationNodeOptions> = {}
  ): EvaluationNodeFunction {
    return this.createNode("research", {
      contentExtractor: extractors.extractResearchContent,
      resultField: "researchEvaluation",
      statusField: "researchStatus",
      ...overrides,
    });
  }

  /**
   * Creates a solution evaluation node with default settings
   * @returns An evaluation node function for solution content
   */
  public createSolutionEvaluationNode(
    overrides: Partial<EvaluationNodeOptions> = {}
  ): EvaluationNodeFunction {
    return this.createNode("solution", {
      contentExtractor: extractors.extractSolutionContent,
      resultField: "solutionEvaluation",
      statusField: "solutionStatus",
      ...overrides,
    });
  }

  /**
   * Creates a connection pairs evaluation node with default settings
   * @returns An evaluation node function for connection pairs content
   */
  public createConnectionPairsEvaluationNode(
    overrides: Partial<EvaluationNodeOptions> = {}
  ): EvaluationNodeFunction {
    return this.createNode("connection_pairs", {
      contentExtractor: extractors.extractConnectionPairsContent,
      resultField: "connectionPairsEvaluation",
      statusField: "connectionPairsStatus",
      ...overrides,
    });
  }

  /**
   * Creates a funder-solution alignment evaluation node with default settings
   * @returns An evaluation node function for funder-solution alignment content
   */
  public createFunderSolutionAlignmentEvaluationNode(
    overrides: Partial<EvaluationNodeOptions> = {}
  ): EvaluationNodeFunction {
    return this.createNode("funder_solution_alignment", {
      contentExtractor: extractors.extractFunderSolutionAlignmentContent,
      resultField: "funderSolutionAlignmentEvaluation",
      statusField: "funderSolutionAlignmentStatus",
      ...overrides,
    });
  }

  /**
   * Creates a section evaluation node for the specified section type
   * @param sectionType The type of section to evaluate
   * @returns An evaluation node function for the specified section content
   */
  public createSectionEvaluationNode(
    sectionType: string,
    overrides: Partial<EvaluationNodeOptions> = {}
  ): EvaluationNodeFunction {
    // Create a section-specific extractor function
    const sectionExtractor = extractors.createSectionExtractor(sectionType);

    return this.createNode(sectionType, {
      contentExtractor: sectionExtractor,
      resultField: `sections.${sectionType}.evaluation`,
      statusField: `sections.${sectionType}.status`,
      ...overrides,
    });
  }
}

// Export the factory instance
export default EvaluationNodeFactory;
