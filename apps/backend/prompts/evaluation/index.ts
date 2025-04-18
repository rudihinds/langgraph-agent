/**
 * Evaluation Prompts Index
 *
 * This file exports all evaluation prompts used in the proposal evaluation process.
 * It serves as a central access point for all evaluation prompt templates.
 */

// Import prompts from individual files
import { researchEvaluationPrompt } from "./researchEvaluation.js";
import { solutionEvaluationPrompt } from "./solutionEvaluation.js";
import { connectionPairsEvaluationPrompt } from "./connectionPairsEvaluation.js";
import {
  getSectionEvaluationPrompt,
  sectionEvaluationPrompt,
  problemStatementKeyAreas,
  methodologyKeyAreas,
  budgetKeyAreas,
  timelineKeyAreas,
  conclusionKeyAreas,
} from "./sectionEvaluation.js";

// Export all prompts
export {
  researchEvaluationPrompt,
  solutionEvaluationPrompt,
  connectionPairsEvaluationPrompt,
  sectionEvaluationPrompt,
  getSectionEvaluationPrompt,
  problemStatementKeyAreas,
  methodologyKeyAreas,
  budgetKeyAreas,
  timelineKeyAreas,
  conclusionKeyAreas,
};
