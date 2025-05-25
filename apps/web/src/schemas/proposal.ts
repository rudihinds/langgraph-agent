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

// Define metadata schema for additional fields
const MetadataSchema = z
  .object({
    description: z.string().optional().default(""),
    funder_details: FunderDetailsSchema.optional(),
    questions: z.array(QuestionSchema).optional().default([]),
    proposal_type: z.enum(["rfp", "application"]).optional(),
    rfp_document: DocumentSchema.optional(),
  })
  .passthrough(); // Allow additional fields in metadata

// Base proposal schema matching database structure
const ProposalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  status: z
    .enum([
      "draft",
      "in_progress",
      "submitted",
      "approved",
      "rejected",
      "review",
      "completed",
    ])
    .default("draft"),
  funder: z.string().optional().default(""),
  applicant: z.string().optional().default(""),
  deadline: z.string().optional().nullable(),
  metadata: MetadataSchema.optional().default({}),
});

// Export schemas
export { ProposalSchema, QuestionSchema, FunderDetailsSchema, DocumentSchema };

// Export type definitions
type Question = z.infer<typeof QuestionSchema>;
type FunderDetails = z.infer<typeof FunderDetailsSchema>;
type Document = z.infer<typeof DocumentSchema>;
export type Proposal = z.infer<typeof ProposalSchema>;
