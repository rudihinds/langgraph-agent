/**
 * Section Evaluation Node Examples
 *
 * This file demonstrates how to use the EvaluationNodeFactory to create
 * evaluation nodes for different section types. These patterns can be used
 * when integrating section evaluations into the main graph.
 */

import { SectionType } from "../../state/proposal.state.js";
import { EvaluationNodeFactory } from "../factory.js";
import { EvaluationNodeFunction } from "../index.js";

/**
 * Creates all section evaluation nodes using the factory pattern
 * @returns An object mapping section types to their evaluation node functions
 */
export function createSectionEvaluationNodes(): Record<
  string,
  EvaluationNodeFunction
> {
  // Create a factory instance with standard configuration
  const factory = new EvaluationNodeFactory({
    temperature: 0.1, // Slight variation to allow for different phrasings
    modelName: "gpt-4o-2024-05-13",
    defaultTimeoutSeconds: 120, // Longer timeout for section evaluations
  });

  // Create an evaluation node for each section type
  const evaluationNodes: Record<string, EvaluationNodeFunction> = {
    // Problem Statement section evaluation
    [SectionType.PROBLEM_STATEMENT]: factory.createSectionEvaluationNode(
      SectionType.PROBLEM_STATEMENT,
      {
        // Optional customizations for this specific section
        timeoutSeconds: 90, // Custom timeout if needed
        evaluationPrompt:
          "Evaluate this problem statement for clarity, relevance, and comprehensiveness. Consider how well it identifies the core issues and connects to the research findings.",
      }
    ),

    // Methodology section evaluation
    [SectionType.METHODOLOGY]: factory.createSectionEvaluationNode(
      SectionType.METHODOLOGY,
      {
        evaluationPrompt:
          "Evaluate this methodology for appropriateness, soundness, and clarity. Consider how well it addresses the identified problems and aligns with the solution approach.",
      }
    ),

    // Budget section evaluation
    [SectionType.BUDGET]: factory.createSectionEvaluationNode(
      SectionType.BUDGET,
      {
        evaluationPrompt:
          "Evaluate this budget for clarity, appropriateness, and comprehensiveness. Consider how well it aligns with the proposed solution and timeline.",
      }
    ),

    // Timeline section evaluation
    [SectionType.TIMELINE]: factory.createSectionEvaluationNode(
      SectionType.TIMELINE,
      {
        evaluationPrompt:
          "Evaluate this timeline for realism, clarity, and comprehensiveness. Consider how well it sequences activities and aligns with the methodology.",
      }
    ),

    // Conclusion section evaluation
    [SectionType.CONCLUSION]: factory.createSectionEvaluationNode(
      SectionType.CONCLUSION,
      {
        evaluationPrompt:
          "Evaluate this conclusion for clarity, persuasiveness, and completeness. Consider how well it summarizes the key points and reinforces the value proposition.",
      }
    ),
  };

  return evaluationNodes;
}

/**
 * Example of how to use section evaluation nodes in a graph
 */
export function exampleGraphIntegration() {
  // This is a conceptual example - actual graph integration would be done in the main graph file

  // Get all section evaluation nodes
  const sectionEvaluators = createSectionEvaluationNodes();

  // Example of adding nodes to a graph (pseudo-code)
  /* 
  const graph = new StateGraph({
    channels: {...},
  });

  // Add each section evaluator as a node in the graph
  Object.entries(sectionEvaluators).forEach(([sectionType, evaluatorNode]) => {
    graph.addNode(
      `evaluate${sectionType.charAt(0).toUpperCase() + sectionType.slice(1)}`,
      evaluatorNode
    );
  });

  // Add edges (this would depend on your graph topology)
  graph.addEdge('generateProblemStatement', 'evaluateProblemStatement');
  graph.addConditionalEdges(
    'evaluateProblemStatement',
    (state) => {
      const status = state.sections?.problemStatement?.status;
      if (status === 'approved') return 'generateMethodology';
      if (status === 'rejected') return 'regenerateProblemStatement';
      return 'waitForFeedback';
    }
  );
  
  // Repeat similar patterns for other sections
  */
}

/**
 * Example of how to create a custom section evaluator with specialized handling
 * @returns A custom evaluation node function
 */
export function createCustomSectionEvaluator(): EvaluationNodeFunction {
  const factory = new EvaluationNodeFactory();

  // Create a custom section evaluator with specialized validation
  return factory.createSectionEvaluationNode(
    "custom_section", // Custom section type
    {
      contentExtractor: (state) => {
        // Custom extraction logic
        const customContent = state.sections?.customSection?.content;
        if (!customContent) return null;

        // Additional preprocessing if needed
        return {
          content: customContent,
          metadata: state.sections?.customSection?.metadata,
          // Add any other context needed for evaluation
        };
      },
      resultField: "sections.customSection.evaluation",
      statusField: "sections.customSection.status",
      customValidator: (content) => {
        // Custom validation logic
        if (!content || !content.content) {
          return { valid: false, error: "Missing required content" };
        }

        // Length check example
        if (content.content.length < 100) {
          return {
            valid: false,
            error: "Content too short (minimum 100 characters)",
          };
        }

        return { valid: true };
      },
      evaluationPrompt: "Evaluate this custom section based on...", // Custom prompt
    }
  );
}

/**
 * Example of how to create a batch of specialized section evaluators
 * for different parts of a complex section
 */
export function createComplexSectionEvaluators() {
  const factory = new EvaluationNodeFactory();

  // Create evaluators for subsections of a complex section (e.g., methodology with multiple parts)
  return {
    approach: factory.createNode(
      "methodology_approach", // Custom criteria file
      {
        contentExtractor: (state) => {
          const methodology = state.sections?.methodology?.content;
          if (!methodology) return null;

          // Extract just the approach section using regex or parsing
          const approachMatch = methodology.match(
            /## Approach([\s\S]*?)(?=## |$)/
          );
          return approachMatch ? approachMatch[1].trim() : null;
        },
        resultField: "sections.methodology.subsections.approach.evaluation",
        statusField: "sections.methodology.subsections.approach.status",
      }
    ),

    implementation: factory.createNode(
      "methodology_implementation", // Custom criteria file
      {
        contentExtractor: (state) => {
          const methodology = state.sections?.methodology?.content;
          if (!methodology) return null;

          // Extract just the implementation section using regex or parsing
          const implMatch = methodology.match(
            /## Implementation([\s\S]*?)(?=## |$)/
          );
          return implMatch ? implMatch[1].trim() : null;
        },
        resultField:
          "sections.methodology.subsections.implementation.evaluation",
        statusField: "sections.methodology.subsections.implementation.status",
      }
    ),

    // Additional subsection evaluators can be added as needed
  };
}
