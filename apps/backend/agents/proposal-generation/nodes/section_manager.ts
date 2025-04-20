/**
 * Section Manager Node
 *
 * This node is responsible for managing the generation of sections in the proposal.
 * It determines which sections are required, their dependencies, and the order
 * in which they should be generated.
 */

import { Logger } from "@/lib/logger.js";
import {
  OverallProposalState,
  ProcessingStatus,
  SectionType,
  SectionData,
  SectionProcessingStatus,
} from "@/state/proposal.state.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Gets dependency array for a section
 * @param sectionType The type of section
 * @returns Array of section types that this section depends on
 */
function getSectionDependencies(sectionType: SectionType): SectionType[] {
  // Define section dependencies based on proposal structure
  // Note: This should match the dependency configuration in the conditionals.ts file
  const dependencies: Record<string, SectionType[]> = {
    [SectionType.PROBLEM_STATEMENT]: [],
    [SectionType.ORGANIZATIONAL_CAPACITY]: [SectionType.PROBLEM_STATEMENT],
    [SectionType.SOLUTION]: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.ORGANIZATIONAL_CAPACITY,
    ],
    [SectionType.IMPLEMENTATION_PLAN]: [SectionType.SOLUTION],
    [SectionType.BUDGET]: [
      SectionType.SOLUTION,
      SectionType.IMPLEMENTATION_PLAN,
    ],
    [SectionType.EVALUATION]: [
      SectionType.SOLUTION,
      SectionType.IMPLEMENTATION_PLAN,
    ],
    [SectionType.CONCLUSION]: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.SOLUTION,
    ],
    [SectionType.EXECUTIVE_SUMMARY]: [
      SectionType.PROBLEM_STATEMENT,
      SectionType.SOLUTION,
      SectionType.CONCLUSION,
    ],
  };

  return dependencies[sectionType] || [];
}

/**
 * Determines which sections should be included in the proposal based on RFP analysis
 * @param state Current proposal state
 * @returns Array of section types to include
 */
function determineRequiredSections(state: OverallProposalState): SectionType[] {
  // In a real implementation, this would analyze the RFP content and requirements
  // For now, we'll include a standard set of sections
  const standardSections = [
    SectionType.PROBLEM_STATEMENT,
    SectionType.ORGANIZATIONAL_CAPACITY,
    SectionType.SOLUTION,
    SectionType.BUDGET,
    SectionType.IMPLEMENTATION_PLAN,
    SectionType.CONCLUSION,
    SectionType.EVALUATION,
    SectionType.EXECUTIVE_SUMMARY,
  ];

  // Check for research results to determine if additional sections are needed
  // This would be based on a more sophisticated analysis in production
  if (state.researchResults) {
    const researchData = state.researchResults;

    // Add optional sections based on research findings (demonstration logic)
    if (researchData.requiresStakeholderAnalysis) {
      standardSections.push(SectionType.STAKEHOLDER_ANALYSIS);
    }
  }

  return standardSections;
}

/**
 * Creates initial section data for a new section
 * @param sectionType The type of section to create
 * @returns SectionData object with initial values
 */
function createInitialSectionData(sectionType: SectionType): SectionData {
  const now = new Date().toISOString();

  return {
    id: sectionType,
    title: getSectionTitle(sectionType),
    content: "",
    status: SectionProcessingStatus.QUEUED,
    lastUpdated: now,
  };
}

/**
 * Gets a human-readable title for a section type
 * @param sectionType The type of section
 * @returns User-friendly title
 */
function getSectionTitle(sectionType: SectionType): string {
  const titles: Record<string, string> = {
    [SectionType.PROBLEM_STATEMENT]: "Problem Statement",
    [SectionType.ORGANIZATIONAL_CAPACITY]: "Organizational Capacity",
    [SectionType.SOLUTION]: "Proposed Solution",
    [SectionType.IMPLEMENTATION_PLAN]: "Implementation Plan",
    [SectionType.EVALUATION]: "Evaluation Approach",
    [SectionType.BUDGET]: "Budget and Cost Breakdown",
    [SectionType.CONCLUSION]: "Conclusion",
    [SectionType.EXECUTIVE_SUMMARY]: "Executive Summary",
  };

  return titles[sectionType] || sectionType;
}

/**
 * Section Manager node
 *
 * Determines required sections, their dependencies, and generation order
 * based on RFP analysis and research results.
 *
 * @param state Current proposal state
 * @returns Updated partial state with section information
 */
export async function sectionManagerNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Starting section manager node", {
    threadId: state.activeThreadId,
  });

  // Determine which sections should be included in the proposal
  const requiredSections =
    state.requiredSections.length > 0
      ? state.requiredSections // Use existing if already set
      : determineRequiredSections(state);

  logger.info(`Determined ${requiredSections.length} required sections`, {
    sections: requiredSections.join(", "),
    threadId: state.activeThreadId,
  });

  // Create or update the sections map
  const sectionsMap = new Map(state.sections);

  // Add any missing sections to the map
  for (const sectionType of requiredSections) {
    if (!sectionsMap.has(sectionType)) {
      sectionsMap.set(sectionType, createInitialSectionData(sectionType));
      logger.info(`Added new section: ${sectionType}`, {
        threadId: state.activeThreadId,
      });
    }
  }

  // Prioritize sections based on dependencies
  const prioritizedSections = prioritizeSections(requiredSections);

  logger.info("Section manager completed", {
    threadId: state.activeThreadId,
    prioritizedSections: prioritizedSections.join(", "),
  });

  // Return updated state
  return {
    sections: sectionsMap,
    requiredSections,
    currentStep: "section_generation",
    status: ProcessingStatus.RUNNING,
  };
}

/**
 * Prioritizes sections based on their dependencies
 * @param sectionTypes Array of section types to prioritize
 * @returns Ordered array of section types
 */
function prioritizeSections(sectionTypes: SectionType[]): SectionType[] {
  // Build dependency graph
  const graph: Record<string, SectionType[]> = {};
  const result: SectionType[] = [];
  const visited = new Set<SectionType>();
  const processing = new Set<SectionType>();

  // Initialize graph
  for (const sectionType of sectionTypes) {
    graph[sectionType] = getSectionDependencies(sectionType).filter((dep) =>
      sectionTypes.includes(dep)
    );
  }

  // Topological sort function
  function dfs(node: SectionType) {
    // Skip if already processed
    if (visited.has(node)) return;

    // Detect cycles (should not happen with our dependency structure)
    if (processing.has(node)) {
      logger.warn(`Dependency cycle detected for section: ${node}`);
      return;
    }

    // Mark as being processed
    processing.add(node);

    // Process dependencies first
    for (const dependency of graph[node] || []) {
      dfs(dependency);
    }

    // Mark as visited and add to result
    processing.delete(node);
    visited.add(node);
    result.push(node);
  }

  // Process all sections
  for (const sectionType of sectionTypes) {
    if (!visited.has(sectionType)) {
      dfs(sectionType);
    }
  }

  return result;
}
