/**
 * Generation Prompts Index
 *
 * This file exports all generation prompts used in the proposal generation process.
 * It serves as a central access point for all prompt templates.
 */

// Import prompts from individual files
import { problemStatementPrompt } from "./problemStatement.js";
import { methodologyPrompt } from "./methodology.js";
import { budgetPrompt } from "./budget.js";
import { timelinePrompt } from "./timeline.js";
import { conclusionPrompt } from "./conclusion.js";

// Export all prompts
export {
  problemStatementPrompt,
  methodologyPrompt,
  budgetPrompt,
  timelinePrompt,
  conclusionPrompt,
};

// Note: Research, Solution Sought, and Connection Pairs prompts are currently
// defined in apps/backend/agents/research/prompts/index.ts
