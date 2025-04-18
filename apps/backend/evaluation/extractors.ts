/**
 * Content Extractors for Evaluation Framework
 *
 * This module contains extractor functions that pull specific content from the
 * OverallProposalState for evaluation. Each extractor handles validation and
 * preprocessing of the content to ensure it's in a format suitable for evaluation.
 */

import { OverallProposalState, SectionType } from "../state/proposal.state.js";

/**
 * Base interface for validation results
 */
interface ValidationResult {
  valid: boolean;
  content?: any;
  error?: string;
}

/**
 * Extracts and validates research results from the proposal state
 * @param state The overall proposal state
 * @returns The extracted research content or null if invalid/missing
 */
export function extractResearchContent(state: OverallProposalState): any {
  // Check if research results exist
  if (
    !state.researchResults ||
    Object.keys(state.researchResults).length === 0
  ) {
    return null;
  }

  try {
    // Structure validation
    // Research results should typically have certain expected keys
    // These keys would depend on your specific implementation
    const requiredKeys = ["findings", "summary"];
    const missingKeys = requiredKeys.filter(
      (key) => !(key in state.researchResults)
    );

    if (missingKeys.length > 0) {
      console.warn(
        `Research results missing required keys: ${missingKeys.join(", ")}`
      );
      // Depending on requirements, we might still return partial content
      // or return null if strict validation is needed
    }

    // Return the entire research results structure for evaluation
    return state.researchResults;
  } catch (error) {
    console.error("Error extracting research content:", error);
    return null;
  }
}

/**
 * Extracts and validates solution sought results from the proposal state
 * @param state The overall proposal state
 * @returns The extracted solution content or null if invalid/missing
 */
export function extractSolutionContent(state: OverallProposalState): any {
  // Check if solution results exist
  if (
    !state.solutionSoughtResults ||
    Object.keys(state.solutionSoughtResults).length === 0
  ) {
    return null;
  }

  try {
    // Structure validation
    const requiredKeys = ["description", "keyComponents"];
    const missingKeys = requiredKeys.filter(
      (key) => !(key in state.solutionSoughtResults)
    );

    if (missingKeys.length > 0) {
      console.warn(
        `Solution results missing required keys: ${missingKeys.join(", ")}`
      );
    }

    // Return the entire solution sought results structure for evaluation
    return state.solutionSoughtResults;
  } catch (error) {
    console.error("Error extracting solution content:", error);
    return null;
  }
}

/**
 * Extracts and validates connection pairs from the proposal state
 * @param state The overall proposal state
 * @returns The extracted connection pairs or null if invalid/missing
 */
export function extractConnectionPairsContent(
  state: OverallProposalState
): any {
  // Check if connection pairs exist
  if (
    !state.connectionPairs ||
    !Array.isArray(state.connectionPairs) ||
    state.connectionPairs.length === 0
  ) {
    return null;
  }

  try {
    // Validate each connection pair
    const validatedPairs = state.connectionPairs
      .map((pair, index) => {
        // Basic structure validation
        if (!pair.problem || !pair.solution) {
          console.warn(
            `Connection pair at index ${index} is missing problem or solution`
          );
          return null;
        }
        return pair;
      })
      .filter((pair) => pair !== null);

    if (validatedPairs.length === 0) {
      console.warn("No valid connection pairs found");
      return null;
    }

    // Return the validated connection pairs
    return validatedPairs;
  } catch (error) {
    console.error("Error extracting connection pairs:", error);
    return null;
  }
}

/**
 * Extracts content from a specific section in the proposal
 * @param state The overall proposal state
 * @param sectionId The ID of the section to extract
 * @returns The section content or null if invalid/missing
 */
export function extractSectionContent(
  state: OverallProposalState,
  sectionId: string
): any {
  // Check if the section exists
  if (!state.sections || !state.sections[sectionId]) {
    return null;
  }

  const section = state.sections[sectionId];

  // Check if the section has content
  if (!section || !section.content || section.content.trim() === "") {
    return null;
  }

  try {
    // For section content, we primarily return the raw content string
    // Additional preprocessing could be added based on section-specific requirements
    return section.content;
  } catch (error) {
    console.error(`Error extracting content for section ${sectionId}:`, error);
    return null;
  }
}

/**
 * Creates a section content extractor for a specific section type
 * @param sectionId The ID of the section to extract
 * @returns A function that extracts content for the specified section
 */
export function createSectionExtractor(sectionId: string) {
  return (state: OverallProposalState) =>
    extractSectionContent(state, sectionId);
}

/**
 * Predefined extractor for the problem statement section
 */
export const extractProblemStatementContent = createSectionExtractor(
  SectionType.PROBLEM_STATEMENT
);

/**
 * Predefined extractor for the methodology section
 */
export const extractMethodologyContent = createSectionExtractor(
  SectionType.METHODOLOGY
);

/**
 * Predefined extractor for the budget section
 */
export const extractBudgetContent = createSectionExtractor(SectionType.BUDGET);

/**
 * Predefined extractor for the timeline section
 */
export const extractTimelineContent = createSectionExtractor(
  SectionType.TIMELINE
);

/**
 * Predefined extractor for the conclusion section
 */
export const extractConclusionContent = createSectionExtractor(
  SectionType.CONCLUSION
);
