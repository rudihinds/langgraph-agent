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
 * @param sectionId Optional section ID if extracting from a specific section instead of state.researchResults
 * @returns The extracted research content or null if invalid/missing
 */
export function extractResearchContent(
  state: OverallProposalState,
  sectionId?: string
): any {
  try {
    // If working with a specific section
    if (sectionId && state.sections) {
      const section = state.sections.get(sectionId as SectionType);

      if (!section) {
        return null;
      }

      // Check if the section has content
      if (!section.content || section.content.trim() === "") {
        return null;
      }

      // Try to parse JSON content from the section
      try {
        const content = JSON.parse(section.content);
        return content;
      } catch (error) {
        console.warn(`Research section content is not valid JSON: ${error}`);
        return null;
      }
    }
    // Otherwise use state.researchResults
    else if (
      state.researchResults &&
      Object.keys(state.researchResults).length > 0
    ) {
      // Structure validation
      // Research results should typically have certain expected keys
      // These keys would depend on your specific implementation
      const requiredKeys = ["findings", "summary"];
      const missingKeys = requiredKeys.filter(
        (key) => !(key in state.researchResults!)
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
    }

    // If no research content is available
    return null;
  } catch (error) {
    console.error("Error extracting research content:", error);
    return null;
  }
}

/**
 * Extracts and validates solution sought results from the proposal state
 * @param state The overall proposal state
 * @param sectionId Optional section ID if extracting from a specific section instead of state.solutionSoughtResults
 * @returns The extracted solution content or null if invalid/missing
 */
export function extractSolutionContent(
  state: OverallProposalState,
  sectionId?: string
): any {
  try {
    // If working with a specific section
    if (sectionId && state.sections) {
      const section = state.sections.get(sectionId as SectionType);

      if (!section) {
        return null;
      }

      // Check if the section has content
      if (!section.content || section.content.trim() === "") {
        return null;
      }

      // Try to parse JSON content from the section
      try {
        const content = JSON.parse(section.content);
        return content;
      } catch (error) {
        console.warn(`Solution section content is not valid JSON: ${error}`);
        // For non-JSON content, return as raw text since the test expects this
        return { rawText: section.content };
      }
    }
    // Otherwise use state.solutionSoughtResults
    else if (
      state.solutionSoughtResults &&
      Object.keys(state.solutionSoughtResults).length > 0
    ) {
      // Structure validation
      const requiredKeys = ["description", "keyComponents"];
      const missingKeys = requiredKeys.filter(
        (key) => !(key in state.solutionSoughtResults!)
      );

      if (missingKeys.length > 0) {
        console.warn(
          `Solution results missing required keys: ${missingKeys.join(", ")}`
        );
      }

      // Return the entire solution sought results structure for evaluation
      return state.solutionSoughtResults;
    }

    // If no solution content is available
    return null;
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
  if (!state.sections) {
    return null;
  }

  const section = state.sections.get(sectionId as SectionType);

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

/**
 * Extracts and validates content for funder-solution alignment evaluation
 * This extractor combines solution content with research findings to evaluate
 * how well the solution aligns with funder priorities
 *
 * @param state The overall proposal state
 * @returns Object containing solution and research content or null if invalid/missing
 */
export function extractFunderSolutionAlignmentContent(
  state: OverallProposalState
): any {
  // Check if required properties exist
  if (
    !state.solutionSoughtResults ||
    Object.keys(state.solutionSoughtResults).length === 0 ||
    !state.researchResults ||
    Object.keys(state.researchResults).length === 0
  ) {
    return null;
  }

  try {
    // At this point we know these properties exist and aren't undefined
    // TypeScript doesn't recognize our null check above, so we need to use non-null assertion
    const solutionResults = state.solutionSoughtResults!;
    const researchResults = state.researchResults!;

    // Basic validation of solution content
    const solutionKeys = ["description", "keyComponents"];
    const missingKeys = solutionKeys.filter((key) => !(key in solutionResults));

    if (missingKeys.length > 0) {
      console.warn(
        `Solution content missing recommended keys for funder alignment evaluation: ${missingKeys.join(
          ", "
        )}`
      );
      // We still proceed as it's not a hard failure
    }

    // Check for funder-specific research to ensure proper evaluation
    const funderResearchKeys = [
      "Author/Organization Deep Dive",
      "Structural & Contextual Analysis",
    ];
    const missingResearchKeys = funderResearchKeys.filter(
      (key) => !(key in researchResults)
    );

    if (missingResearchKeys.length > 0) {
      console.warn(
        `Research results missing recommended funder-related sections: ${missingResearchKeys.join(
          ", "
        )}`
      );
      // We still proceed as it's not a hard failure
    }

    // Prepare the combined content structure
    const content = {
      solution: solutionResults,
      research: researchResults,
    };

    return content;
  } catch (error) {
    console.error("Error extracting funder-solution alignment content:", error);
    return null;
  }
}

/**
 * Validates content based on specified validator
 * @param content The content to validate
 * @param validator A string identifier for built-in validators or a custom validator function
 * @returns The validation result with status and errors if any
 */
export function validateContent(
  content: any,
  validator:
    | string
    | ((
        content: any
      ) => { isValid: boolean; errors: string[] } | ValidationResult)
): {
  isValid: boolean;
  errors: string[];
} {
  // Default return value
  const defaultResult = {
    isValid: true,
    errors: [],
  };

  // If content is null or undefined, it's invalid
  if (content === null || content === undefined) {
    return {
      isValid: false,
      errors: ["Content is null or undefined"],
    };
  }

  try {
    // If validator is a function, use it directly
    if (typeof validator === "function") {
      try {
        const result = validator(content);

        // Handle object result
        if (typeof result === "object" && result !== null) {
          // Check if result has isValid property (as in test custom validators)
          if ("isValid" in result) {
            return {
              isValid: Boolean(result.isValid),
              errors: Array.isArray(result.errors) ? result.errors : [],
            };
          }

          // Check if result has valid property (as in ValidationResult interface)
          if ("valid" in result) {
            return {
              isValid: Boolean(result.valid),
              errors: result.error ? [result.error] : [],
            };
          }
        }

        // Handle boolean result
        if (typeof result === "boolean") {
          return {
            isValid: result,
            errors: result ? [] : ["Custom validation failed"],
          };
        }

        // Fallback for unknown return type
        return {
          isValid: Boolean(result),
          errors: Boolean(result)
            ? []
            : ["Custom validation returned invalid value"],
        };
      } catch (error) {
        return {
          isValid: false,
          errors: [
            `Custom validator error: ${error instanceof Error ? error.message : String(error)}`,
          ],
        };
      }
    }

    // Built-in validators
    switch (validator) {
      case "isValidJSON":
        if (typeof content === "string") {
          try {
            JSON.parse(content);
            return defaultResult;
          } catch (error) {
            return {
              isValid: false,
              errors: [
                `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
              ],
            };
          }
        }
        // If content is already an object, it's valid
        if (typeof content === "object" && content !== null) {
          return defaultResult;
        }
        return {
          isValid: false,
          errors: ["Content is not a valid JSON string or object"],
        };

      case "isNotEmpty":
        if (typeof content === "string") {
          const isValid = content.trim().length > 0;
          return {
            isValid,
            errors: isValid ? [] : ["Content is empty"],
          };
        }
        if (typeof content === "object" && content !== null) {
          const isValid = Object.keys(content).length > 0;
          return {
            isValid,
            errors: isValid ? [] : ["Content object has no properties"],
          };
        }
        return {
          isValid: Boolean(content),
          errors: Boolean(content) ? [] : ["Content is empty or falsy"],
        };

      // Unknown validator - default to valid
      default:
        console.warn(`Unknown validator: ${validator}, defaulting to valid`);
        return defaultResult;
    }
  } catch (error) {
    return {
      isValid: false,
      errors: [
        `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}
