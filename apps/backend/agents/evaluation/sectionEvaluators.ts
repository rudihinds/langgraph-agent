/**
 * Section Evaluators
 *
 * This module contains factory functions and utilities for creating section evaluation nodes.
 * These nodes are responsible for evaluating different sections of the proposal against
 * predefined criteria and triggering human review when necessary.
 */

import { join } from "path";
import {
  EvaluationNodeFactory,
  EvaluationNodeOptions,
  EvaluationResult,
} from "./evaluationNodeFactory.js";
import {
  SectionType,
  ProcessingStatus,
  InterruptProcessingStatus,
  InterruptReason,
} from "../../state/modules/constants.js";
import { OverallProposalState } from "../../state/proposal.state.js";
import { Logger } from "../../lib/logger.js";
import { SectionExtractor } from "./extractors.js";

const logger = Logger.getInstance();

/**
 * Create a section evaluation node for a specific section type
 * @param sectionType The type of section to create an evaluation node for
 * @returns A node function that evaluates the specified section
 */
export function createSectionEvaluationNode(sectionType: SectionType) {
  // Create path to section-specific criteria file
  const criteriaPath = join(
    process.cwd(),
    "config",
    "evaluation",
    "criteria",
    `${sectionType.toLowerCase()}.json`
  );

  return async function sectionEvaluationNode(
    state: OverallProposalState
  ): Promise<Partial<OverallProposalState>> {
    logger.info(`Running evaluation for section: ${sectionType}`, {
      threadId: state.activeThreadId,
    });

    // Skip evaluation if section isn't ready
    const section = state.sections.get(sectionType);
    if (!section) {
      logger.warn(`Section ${sectionType} not found for evaluation`, {
        threadId: state.activeThreadId,
      });
      return {};
    }

    // Only evaluate sections that are ready for evaluation
    if (section.status !== ProcessingStatus.READY_FOR_EVALUATION) {
      logger.info(
        `Section ${sectionType} not ready for evaluation, status: ${section.status}`,
        {
          threadId: state.activeThreadId,
        }
      );
      return {};
    }

    try {
      // Create a section extractor instance
      const extractor = SectionExtractor.create({ sectionType });

      // Create evaluation options using LangGraph patterns
      const options: EvaluationNodeOptions = {
        contentType: "section",
        contentExtractor: (state) => extractor.extract(state),
        criteriaPath,
        resultField: "evaluationResult", // Store result in standard field
        statusField: "evaluationStatus", // Store status in standard field
        passingThreshold: isKeySection(sectionType) ? 80 : 75, // Higher threshold for key sections
        customValidator: (result) => {
          // Add custom validation logic if needed
          return result.overallScore >= (isKeySection(sectionType) ? 80 : 75);
        },
        // Use a callback to properly update our state with LangGraph patterns
        stateUpdateCallback: (current, results) => {
          // Make a copy of the sections map for immutable update
          const sectionsMap = new Map(current.sections);
          const section = sectionsMap.get(sectionType);

          if (section) {
            // Update the section with evaluation results
            sectionsMap.set(sectionType, {
              ...section,
              evaluation: results,
              status: results.passed
                ? ProcessingStatus.APPROVED
                : ProcessingStatus.AWAITING_REVIEW,
              lastUpdated: new Date().toISOString(),
            });
          }

          // Return partial state update
          return {
            ...current,
            sections: sectionsMap,
          };
        },
      };

      // Create and execute the evaluation node
      const evaluationNode = EvaluationNodeFactory.createNode(options);
      const result = await evaluationNode(state);

      // Extract evaluation results from the returned state
      // This avoids directly referencing a nonexistent property
      const evalResult: EvaluationResult | undefined = result[
        options.resultField as keyof typeof result
      ] as EvaluationResult;
      const evalPassed = evalResult?.passed || false;

      logger.info(
        `Evaluation for ${sectionType} completed: passed=${evalPassed}`,
        {
          threadId: state.activeThreadId,
        }
      );

      // If evaluation failed, create an interrupt for human review
      // This follows LangGraph interrupt patterns
      if (!evalPassed) {
        logger.info(
          `Section ${sectionType} failed evaluation, creating interrupt`,
          {
            threadId: state.activeThreadId,
          }
        );

        return {
          interruptStatus: {
            isInterrupted: true,
            interruptionPoint: `evaluate_${sectionType}`,
            feedback: null,
            processingStatus: InterruptProcessingStatus.PENDING,
          },
          interruptMetadata: {
            reason: InterruptReason.EVALUATION_NEEDED,
            nodeId: `evaluate_${sectionType}`,
            timestamp: new Date().toISOString(),
            contentReference: sectionType,
            evaluationResult: evalResult,
          },
        };
      }

      // Return the result - section updates were already handled in the callback
      return result;
    } catch (error) {
      logger.error(`Error evaluating section ${sectionType}`, {
        threadId: state.activeThreadId,
        error,
      });

      return {
        errors: [
          ...(state.errors || []),
          `Error evaluating section ${sectionType}: ${error}`,
        ],
      };
    }
  };
}

/**
 * Creates evaluation nodes for all section types
 * @returns An object mapping section types to their evaluation node functions
 */
export function createSectionEvaluators() {
  return Object.values(SectionType).reduce(
    (evaluators, sectionType) => {
      evaluators[sectionType] = createSectionEvaluationNode(sectionType);
      return evaluators;
    },
    {} as Record<SectionType, ReturnType<typeof createSectionEvaluationNode>>
  );
}

/**
 * Determines if a section is a key/critical section that might need stricter evaluation
 * @param sectionType The section type to check
 * @returns boolean indicating whether the section is considered key
 */
function isKeySection(sectionType: SectionType): boolean {
  // We consider these sections most critical to the proposal's success
  const keySections = [
    SectionType.PROBLEM_STATEMENT,
    SectionType.SOLUTION,
    SectionType.IMPLEMENTATION_PLAN,
    SectionType.BUDGET,
  ];

  return keySections.includes(sectionType);
}
