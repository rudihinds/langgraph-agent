/**
 * Section Nodes
 *
 * This file defines generator nodes for each section of the proposal using the
 * section generator factory. Each node handles the generation of a specific
 * proposal section using standardized prompts and tools.
 */

import { SectionType } from "@/state/proposal.state.js";
import { createSectionGeneratorNode } from "../utils/section_generator_factory.js";

// Define prompt paths for each section
const PROMPT_PATHS = {
  [SectionType.EXECUTIVE_SUMMARY]: "prompts/sections/executive_summary.txt",
  [SectionType.PROBLEM_STATEMENT]: "prompts/sections/problem_statement.txt",
  [SectionType.SOLUTION]: "prompts/sections/solution.txt",
  [SectionType.IMPLEMENTATION_PLAN]: "prompts/sections/implementation_plan.txt",
  [SectionType.EVALUATION]: "prompts/sections/evaluation.txt",
  [SectionType.ORGANIZATIONAL_CAPACITY]:
    "prompts/sections/organizational_capacity.txt",
  [SectionType.BUDGET]: "prompts/sections/budget.txt",
  [SectionType.CONCLUSION]: "prompts/sections/conclusion.txt",
} as const;

// Default fallback prompt if template loading fails
const DEFAULT_FALLBACK_PROMPT = `
You are an expert proposal writer. Your task is to generate a high-quality section for a grant proposal.
Use the provided research and context to create compelling content that addresses the requirements.
Focus on clarity, specificity, and alignment with the funder's priorities.
`;

// Create a generator node for each section
export const executiveSummaryNode = createSectionGeneratorNode(
  SectionType.EXECUTIVE_SUMMARY,
  PROMPT_PATHS[SectionType.EXECUTIVE_SUMMARY],
  DEFAULT_FALLBACK_PROMPT
);

export const problemStatementNode = createSectionGeneratorNode(
  SectionType.PROBLEM_STATEMENT,
  PROMPT_PATHS[SectionType.PROBLEM_STATEMENT],
  DEFAULT_FALLBACK_PROMPT
);

export const solutionNode = createSectionGeneratorNode(
  SectionType.SOLUTION,
  PROMPT_PATHS[SectionType.SOLUTION],
  DEFAULT_FALLBACK_PROMPT
);

export const implementationPlanNode = createSectionGeneratorNode(
  SectionType.IMPLEMENTATION_PLAN,
  PROMPT_PATHS[SectionType.IMPLEMENTATION_PLAN],
  DEFAULT_FALLBACK_PROMPT
);

export const evaluationNode = createSectionGeneratorNode(
  SectionType.EVALUATION,
  PROMPT_PATHS[SectionType.EVALUATION],
  DEFAULT_FALLBACK_PROMPT
);

export const organizationalCapacityNode = createSectionGeneratorNode(
  SectionType.ORGANIZATIONAL_CAPACITY,
  PROMPT_PATHS[SectionType.ORGANIZATIONAL_CAPACITY],
  DEFAULT_FALLBACK_PROMPT
);

export const budgetNode = createSectionGeneratorNode(
  SectionType.BUDGET,
  PROMPT_PATHS[SectionType.BUDGET],
  DEFAULT_FALLBACK_PROMPT
);

export const conclusionNode = createSectionGeneratorNode(
  SectionType.CONCLUSION,
  PROMPT_PATHS[SectionType.CONCLUSION],
  DEFAULT_FALLBACK_PROMPT
);

// Export a map of all section nodes for easier access
export const sectionNodes = {
  [SectionType.EXECUTIVE_SUMMARY]: executiveSummaryNode,
  [SectionType.PROBLEM_STATEMENT]: problemStatementNode,
  [SectionType.SOLUTION]: solutionNode,
  [SectionType.IMPLEMENTATION_PLAN]: implementationPlanNode,
  [SectionType.EVALUATION]: evaluationNode,
  [SectionType.ORGANIZATIONAL_CAPACITY]: organizationalCapacityNode,
  [SectionType.BUDGET]: budgetNode,
  [SectionType.CONCLUSION]: conclusionNode,
} as const;
