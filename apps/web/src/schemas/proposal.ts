import { z } from "zod";

// Define the question schema for application proposals
const QuestionSchema = z.object({
  question: z.string().min(1, "Question is required"),
  required: z.boolean().optional().default(false),
  maxLength: z.number().optional(),
});

// Define the funder details schema with more flexibility
const FunderDetailsSchema = z
  .object({
    // Accept either funderName (API) or organizationName (form)
    funderName: z
      .string()
      .min(1, "Funder name is required")
      .optional()
      .or(z.literal("")),
    // Allow programName (from API) or fundingTitle (from form)
    programName: z.string().optional().nullable(),
    // Original fields
    funderWebsite: z.string().url("Must be a valid URL").optional().nullable(),
    funderType: z.string().optional().nullable(),
    funderDescription: z.string().optional().nullable(),
    programDescription: z.string().optional().nullable(),
    deadline: z.string().optional().nullable(),
    // New fields from form
    organizationName: z.string().optional(),
    fundingTitle: z.string().optional(),
    budgetRange: z.string().optional(),
    focusArea: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Ensure at least one of organizationName or funderName is provided
    if (!data.funderName && !data.organizationName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either funderName or organizationName must be provided",
        path: ["funderName"],
      });
    }

    // Ensure at least one of programName or fundingTitle is provided for title
    if (!data.programName && !data.fundingTitle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either programName or fundingTitle must be provided",
        path: ["programName"],
      });
    }
  });

// Define the document schema for uploaded files
const DocumentSchema = z.object({
  name: z.string(),
  url: z.string().url("Must be a valid URL"),
  size: z.number().optional(),
  type: z.string().optional(),
});

// Base proposal schema with common fields
const BaseProposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  status: z
    .enum(["draft", "in_progress", "submitted", "approved", "rejected"])
    .default("draft"),
  funder_details: FunderDetailsSchema,
  deadline: z.string().optional().nullable(),
});

// Application-specific proposal schema
const ApplicationProposalSchema = BaseProposalSchema.extend({
  proposal_type: z.literal("application"),
  questions: z.array(QuestionSchema).default([]),
});

// RFP-specific proposal schema
const RFPProposalSchema = BaseProposalSchema.extend({
  proposal_type: z.literal("rfp"),
  rfp_document: DocumentSchema.optional(),
});

// Combine the schemas using discriminated union
export const ProposalSchema = z.discriminatedUnion("proposal_type", [
  ApplicationProposalSchema,
  RFPProposalSchema,
]);

// Export type definitions
export type Question = z.infer<typeof QuestionSchema>;
export type FunderDetails = z.infer<typeof FunderDetailsSchema>;
export type Document = z.infer<typeof DocumentSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
export type ApplicationProposal = z.infer<typeof ApplicationProposalSchema>;
export type RFPProposal = z.infer<typeof RFPProposalSchema>;
