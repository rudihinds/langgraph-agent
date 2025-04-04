import { z } from "zod";

/**
 * Shared question schema used across different proposal types
 */
export const QuestionSchema = z.object({
  text: z.string().min(1, "Question text is required"),
  category: z.string().nullable(),
  wordLimit: z.number().nullable(),
  charLimit: z.number().nullable(),
});

export type QuestionType = z.infer<typeof QuestionSchema>;

/**
 * Schema for funder details
 */
export const FunderDetailsSchema = z.object({
  funderName: z.string().min(1, "Funder name is required"),
  funderType: z.string().min(1, "Funder type is required"),
  funderDescription: z.string().optional(),
  funderMission: z.string().optional(),
  funderPriorities: z.string().optional(),
  funderWebsite: z.string().optional(),
  funderContactName: z.string().optional(),
  funderContactEmail: z.string().optional(),
  funderContactPhone: z.string().optional(),
  funderAddress: z.string().optional(),
  funderLocations: z.string().optional(),
  programName: z.string().optional(),
  programDescription: z.string().optional(),
  fundingAmount: z.string().optional(),
  deadline: z.string().optional(),
  eligibilityCriteria: z.string().optional(),
});

export type FunderDetailsType = z.infer<typeof FunderDetailsSchema>;

/**
 * Schema for application-type proposals
 */
export const ApplicationProposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  proposal_type: z.literal("application"),
  funder_details: FunderDetailsSchema,
  questions: z.array(QuestionSchema).min(1, "At least one question is required"),
  deadline: z.string().optional(),
  status: z.enum(["draft", "in_progress", "completed", "submitted"]).default("draft"),
});

/**
 * Schema for RFP-type proposals
 */
export const RFPProposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  proposal_type: z.literal("rfp"),
  funder_details: FunderDetailsSchema,
  rfp_document: z.object({
    name: z.string(),
    url: z.string().url("Invalid document URL"),
    size: z.number().optional(),
    type: z.string().optional(),
  }).optional(),
  deadline: z.string().optional(),
  status: z.enum(["draft", "in_progress", "completed", "submitted"]).default("draft"),
});

/**
 * Combined proposal schema that handles both application and RFP types
 */
export const ProposalSchema = z.discriminatedUnion("proposal_type", [
  ApplicationProposalSchema,
  RFPProposalSchema,
]);

export type ProposalType = z.infer<typeof ProposalSchema>;
export type ApplicationProposalType = z.infer<typeof ApplicationProposalSchema>;
export type RFPProposalType = z.infer<typeof RFPProposalSchema>;