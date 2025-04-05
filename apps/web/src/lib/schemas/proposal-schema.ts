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
 * Define metadata schema for additional fields
 */
export const MetadataSchema = z
  .object({
    description: z.string().optional(),
    funder_details: FunderDetailsSchema.optional(),
    questions: z.array(QuestionSchema).optional(),
    proposal_type: z.enum(["rfp", "application"]).optional(),
    rfp_document: z
      .object({
        name: z.string(),
        url: z.string().url("Invalid document URL"),
        size: z.number().optional(),
        type: z.string().optional(),
      })
      .optional(),
  })
  .passthrough() // Allow additional fields in metadata
  .optional() // Make the entire metadata field optional

/**
 * Schema for proposals that matches the database structure
 */
export const ProposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  user_id: z.string().uuid("User ID must be a valid UUID"),
  status: z
    .enum([
      "draft",
      "in_progress",
      "review",
      "completed",
      "submitted",
      "approved",
      "rejected",
    ])
    .default("draft"),
  funder: z.string().optional().default(""),
  applicant: z.string().optional().default(""),
  deadline: z.string().optional().nullable(),
  metadata: z.any().optional(), // Accept any object structure for metadata
});

export type ProposalType = z.infer<typeof ProposalSchema>;
