/**
 * Reducer functions for managing complex state updates in the proposal agent system
 */
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";

/**
 * Connection pair with source identification and confidence score
 */
export interface ConnectionPair {
  id: string;
  applicantStrength: string;
  funderNeed: string;
  alignmentRationale: string;
  confidenceScore: number;
  source?: string;
}

/**
 * Research data structure for RFP and funder analysis
 */
export interface ResearchData {
  keyFindings: string[];
  funderPriorities: string[];
  fundingHistory?: string;
  relevantProjects?: string[];
  competitiveAnalysis?: string;
  additionalNotes?: string;
}

/**
 * Solution requirements identified from the RFP
 */
export interface SolutionRequirements {
  primaryGoals: string[];
  secondaryObjectives?: string[];
  constraints: string[];
  successMetrics: string[];
  preferredApproaches?: string[];
  explicitExclusions?: string[];
}

/**
 * Content and metadata for a proposal section
 */
export interface SectionContent {
  name: string;
  content: string;
  status: "pending" | "in_progress" | "review" | "complete";
  version: number;
  lastUpdated: string;
  dependencies?: string[];
}

/**
 * Evaluation result for a proposal section
 */
export interface EvaluationResult {
  sectionName: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  improvementSuggestions: string[];
  alignmentScore: number;
}

/**
 * Reducer for connection pairs that handles deduplication and merging
 *
 * @param current - The current array of connection pairs
 * @param update - New connection pairs to be added or merged
 * @returns Updated array of connection pairs
 */
export function connectionPairsReducer(
  current: ConnectionPair[],
  update: ConnectionPair[]
): ConnectionPair[] {
  // Create a map of existing pairs by id for quick lookup
  const existingPairsMap = new Map<string, ConnectionPair>();
  current.forEach((pair) => existingPairsMap.set(pair.id, pair));

  // Process each update pair
  update.forEach((updatePair) => {
    // If pair with same id exists, merge with preference for higher confidence
    if (existingPairsMap.has(updatePair.id)) {
      const existingPair = existingPairsMap.get(updatePair.id)!;

      // Only update if new pair has higher confidence
      if (updatePair.confidenceScore > existingPair.confidenceScore) {
        existingPairsMap.set(updatePair.id, {
          ...existingPair,
          ...updatePair,
          // Preserve source information in a meaningful way
          source: updatePair.source
            ? existingPair.source
              ? `${existingPair.source}, ${updatePair.source}`
              : updatePair.source
            : existingPair.source,
        });
      }
    } else {
      // If new pair, simply add it
      existingPairsMap.set(updatePair.id, updatePair);
    }
  });

  // Convert map back to array
  return Array.from(existingPairsMap.values());
}

/**
 * Reducer for section content that handles versioning and updates
 *
 * @param current - The current map of section content by name
 * @param update - Updated section content
 * @returns Updated map of section content
 */
export function proposalSectionsReducer(
  current: Map<string, SectionContent>,
  update: Map<string, SectionContent> | SectionContent
): Map<string, SectionContent> {
  // Create a new map to avoid mutating the original
  const updatedSections = new Map(current);

  // Handle both single section updates and multiple section updates
  const sectionsToUpdate = Array.isArray(update) ? update : [update];

  sectionsToUpdate.forEach((section) => {
    const sectionName = section.name;

    if (updatedSections.has(sectionName)) {
      // If section exists, increment version and update content
      const existingSection = updatedSections.get(sectionName)!;
      updatedSections.set(sectionName, {
        ...existingSection,
        ...section,
        version: (existingSection.version || 0) + 1,
        lastUpdated: new Date().toISOString(),
      });
    } else {
      // If new section, initialize with version 1
      updatedSections.set(sectionName, {
        ...section,
        version: 1,
        lastUpdated: new Date().toISOString(),
      });
    }
  });

  return updatedSections;
}

/**
 * Reducer for research data that merges new findings with existing data
 *
 * @param current - The current research data
 * @param update - New research findings
 * @returns Updated research data
 */
export function researchDataReducer(
  current: ResearchData | null,
  update: Partial<ResearchData>
): ResearchData {
  if (!current) {
    return {
      keyFindings: update.keyFindings || [],
      funderPriorities: update.funderPriorities || [],
      ...update,
    };
  }

  // Create new object with merged arrays for list properties
  return {
    keyFindings: [
      ...new Set([...current.keyFindings, ...(update.keyFindings || [])]),
    ],
    funderPriorities: [
      ...new Set([
        ...current.funderPriorities,
        ...(update.funderPriorities || []),
      ]),
    ],
    // Merge other properties, preferring the update values
    fundingHistory: update.fundingHistory || current.fundingHistory,
    relevantProjects: update.relevantProjects || current.relevantProjects,
    competitiveAnalysis:
      update.competitiveAnalysis || current.competitiveAnalysis,
    additionalNotes: update.additionalNotes || current.additionalNotes,
  };
}

/**
 * Reducer for solution requirements that handles merging and prioritization
 *
 * @param current - The current solution requirements
 * @param update - New or updated solution requirements
 * @returns Updated solution requirements
 */
export function solutionRequirementsReducer(
  current: SolutionRequirements | null,
  update: Partial<SolutionRequirements>
): SolutionRequirements {
  if (!current) {
    return {
      primaryGoals: update.primaryGoals || [],
      constraints: update.constraints || [],
      successMetrics: update.successMetrics || [],
      ...update,
    };
  }

  // Merge arrays and deduplicate
  return {
    primaryGoals: [
      ...new Set([...current.primaryGoals, ...(update.primaryGoals || [])]),
    ],
    secondaryObjectives: [
      ...new Set([
        ...(current.secondaryObjectives || []),
        ...(update.secondaryObjectives || []),
      ]),
    ],
    constraints: [
      ...new Set([...current.constraints, ...(update.constraints || [])]),
    ],
    successMetrics: [
      ...new Set([...current.successMetrics, ...(update.successMetrics || [])]),
    ],
    preferredApproaches: [
      ...new Set([
        ...(current.preferredApproaches || []),
        ...(update.preferredApproaches || []),
      ]),
    ],
    explicitExclusions: [
      ...new Set([
        ...(current.explicitExclusions || []),
        ...(update.explicitExclusions || []),
      ]),
    ],
  };
}

/**
 * Zod schemas for validation
 */

// Connection pair schema
export const ConnectionPairSchema = z.object({
  id: z.string(),
  applicantStrength: z.string(),
  funderNeed: z.string(),
  alignmentRationale: z.string(),
  confidenceScore: z.number().min(0).max(1),
  source: z.string().optional(),
});

// Research data schema
export const ResearchDataSchema = z.object({
  keyFindings: z.array(z.string()),
  funderPriorities: z.array(z.string()),
  fundingHistory: z.string().optional(),
  relevantProjects: z.array(z.string()).optional(),
  competitiveAnalysis: z.string().optional(),
  additionalNotes: z.string().optional(),
});

// Solution requirements schema
export const SolutionRequirementsSchema = z.object({
  primaryGoals: z.array(z.string()),
  secondaryObjectives: z.array(z.string()).optional(),
  constraints: z.array(z.string()),
  successMetrics: z.array(z.string()),
  preferredApproaches: z.array(z.string()).optional(),
  explicitExclusions: z.array(z.string()).optional(),
});

// Section content schema
export const SectionContentSchema = z.object({
  name: z.string(),
  content: z.string(),
  status: z.enum(["pending", "in_progress", "review", "complete"]),
  version: z.number().int().positive(),
  lastUpdated: z.string(),
  dependencies: z.array(z.string()).optional(),
});

// Evaluation result schema
export const EvaluationResultSchema = z.object({
  sectionName: z.string(),
  score: z.number().min(0).max(10),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  improvementSuggestions: z.array(z.string()),
  alignmentScore: z.number().min(0).max(1),
});
