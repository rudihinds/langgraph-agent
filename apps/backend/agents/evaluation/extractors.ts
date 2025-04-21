/**
 * Content Extractors
 *
 * This module provides various extractors that pull specific content from the overall
 * proposal state for evaluation. These extractors are used by the evaluation nodes
 * to get the content they need to evaluate.
 */

import { OverallProposalState } from "../../state/proposal.state.js";
import { SectionType } from "../../state/modules/constants.js";

/**
 * Interface for content extractor options
 */
interface ExtractorOptions {
  [key: string]: any;
}

/**
 * Interface for section extractor options
 */
interface SectionExtractorOptions extends ExtractorOptions {
  sectionType: SectionType;
}

/**
 * Base extractor class that all specific extractors extend
 */
abstract class ContentExtractor {
  protected options: ExtractorOptions;

  constructor(options: ExtractorOptions = {}) {
    this.options = options;
  }

  /**
   * Extract content from the state
   * @param state The current proposal state
   * @returns The extracted content as a string, or null if content can't be extracted
   */
  abstract extract(state: OverallProposalState): string | null;
}

/**
 * Extracts content from a specific section
 */
export class SectionExtractor extends ContentExtractor {
  protected options: SectionExtractorOptions;

  constructor(options: SectionExtractorOptions) {
    super(options);
    this.options = options;
  }

  /**
   * Create a new SectionExtractor instance
   * @param options Options including sectionType
   * @returns A new SectionExtractor instance
   */
  static create(options: SectionExtractorOptions): SectionExtractor {
    return new SectionExtractor(options);
  }

  /**
   * Extract content from a specific section
   * @param state The current proposal state
   * @returns The section content as a string, or null if the section doesn't exist
   */
  extract(state: OverallProposalState): string | null {
    const { sectionType } = this.options;
    const section = state.sections.get(sectionType);
    return section?.content || null;
  }
}

/**
 * Extracts research content from the state
 */
export class ResearchExtractor extends ContentExtractor {
  /**
   * Create a new ResearchExtractor instance
   * @returns A new ResearchExtractor instance
   */
  static create(): ResearchExtractor {
    return new ResearchExtractor();
  }

  /**
   * Extract research content
   * @param state The current proposal state
   * @returns The research content as a string, or null if no research exists
   */
  extract(state: OverallProposalState): string | null {
    return state.researchResults ? JSON.stringify(state.researchResults) : null;
  }
}

/**
 * Extracts solution content from the state
 */
export class SolutionExtractor extends ContentExtractor {
  /**
   * Create a new SolutionExtractor instance
   * @returns A new SolutionExtractor instance
   */
  static create(): SolutionExtractor {
    return new SolutionExtractor();
  }

  /**
   * Extract solution content
   * @param state The current proposal state
   * @returns The solution content as a string, or null if no solution exists
   */
  extract(state: OverallProposalState): string | null {
    return state.solutionResults ? JSON.stringify(state.solutionResults) : null;
  }
}

/**
 * Extracts connections content from the state
 */
export class ConnectionsExtractor extends ContentExtractor {
  /**
   * Create a new ConnectionsExtractor instance
   * @returns A new ConnectionsExtractor instance
   */
  static create(): ConnectionsExtractor {
    return new ConnectionsExtractor();
  }

  /**
   * Extract connections content
   * @param state The current proposal state
   * @returns The connections content as a string, or null if no connections exist
   */
  extract(state: OverallProposalState): string | null {
    return state.connections ? JSON.stringify(state.connections) : null;
  }
}
