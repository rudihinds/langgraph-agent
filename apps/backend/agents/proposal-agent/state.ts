import { MessagesState } from "@langchain/langgraph";
import { z } from "zod";

/**
 * State interface for the proposal agent
 */
export interface ProposalState extends MessagesState {
  // Proposal-specific state fields
  rfpDocument?: string;
  funderInfo?: string;
  solutionSought?: string;
  connectionPairs?: string[];
  proposalSections?: {
    name: string;
    content: string;
    status: "pending" | "in_progress" | "review" | "complete";
    dependencies?: string[];
  }[];
  currentSection?: string;
  userFeedback?: string;
}

/**
 * Zod schema for validating proposal state
 */
export const ProposalStateSchema = z.object({
  messages: z.array(z.any()),
  rfpDocument: z.string().optional(),
  funderInfo: z.string().optional(),
  solutionSought: z.string().optional(),
  connectionPairs: z.array(z.string()).optional(),
  proposalSections: z
    .array(
      z.object({
        name: z.string(),
        content: z.string(),
        status: z.enum(["pending", "in_progress", "review", "complete"]),
        dependencies: z.array(z.string()).optional(),
      })
    )
    .optional(),
  currentSection: z.string().optional(),
  userFeedback: z.string().optional(),
});