import { z } from "zod";

// ==== Base Schemas ====

/**
 * FunderDetailsSchema - Validates information about the funding organization
 */
export const FunderDetailsSchema = z.object({
  organizationName: z
    .string()
    .min(1, { message: "Organization name is required" }),
  fundingTitle: z
    .string()
    .min(1, { message: "Grant/funding opportunity title is required" }),
  deadline: z
    .string()
    .or(z.date())
    .nullable()
    .refine((val) => val !== null, {
      message: "Submission deadline is required",
    })
    .transform((val) => {
      // If it's already a Date object, return as is
      if (val instanceof Date) return val;

      // If it's a string, check format (DD/MM/YYYY)
      if (typeof val === "string") {
        if (val.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          const [day, month, year] = val.split("/").map(Number);
          const date = new Date(year, month - 1, day);
          if (!isNaN(date.getTime())) return date;
        }

        // If API format (YYYY-MM-DD)
        if (val.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const date = new Date(val);
          if (!isNaN(date.getTime())) return date;
        }
      }

      return val; // Return as is if can't parse
    }),
  budgetRange: z
    .string()
    .min(1, { message: "Budget range is required" })
    .regex(/^\d+$/, { message: "Please enter numbers only" }),
  focusArea: z.string().min(1, { message: "Primary focus area is required" }),
});

export type FunderDetails = z.infer<typeof FunderDetailsSchema>;

/**
 * Schema for individual questions within ApplicationQuestionsSchema
 */
export const QuestionSchema = z.object({
  text: z.string().min(1, { message: "Question text is required" }),
  wordLimit: z.number().nullable().optional(),
  charLimit: z.number().nullable().optional(),
  category: z.string().nullable().optional(),
});

export type Question = z.infer<typeof QuestionSchema>;

/**
 * ApplicationQuestionsSchema - Validates application questions
 */
export const ApplicationQuestionsSchema = z.object({
  questions: z.array(QuestionSchema).min(1, {
    message: "At least one question is required",
  }),
});

export type ApplicationQuestions = z.infer<typeof ApplicationQuestionsSchema>;

/**
 * RFPResponseSchema - Validates RFP response data
 */
export const RFPResponseSchema = z
  .object({
    companyName: z.string().min(1, { message: "Company name is required" }),
    rfpUrl: z.string().optional(),
    rfpText: z.string().optional(),
  })
  .refine((data) => data.rfpUrl?.trim() || data.rfpText?.trim(), {
    message: "Please provide either a URL or text for the RFP",
    path: ["rfpSource"],
  });

export type RFPResponse = z.infer<typeof RFPResponseSchema>;

// ==== Proposal Schemas ====

/**
 * Base proposal schema with common fields
 */
export const ProposalSchema = z.object({
  id: z.string(),
  title: z.string().min(1, { message: "Proposal title is required" }),
  description: z.string().optional(),
  userId: z.string(),
  status: z.enum(["draft", "in_progress", "completed", "archived"], {
    errorMap: () => ({ message: "Invalid status" }),
  }),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  type: z.enum(["application", "rfp"], {
    errorMap: () => ({
      message: "Proposal type must be either 'application' or 'rfp'",
    }),
  }),
});

export type Proposal = z.infer<typeof ProposalSchema>;

/**
 * Application-type proposal schema
 */
export const ProposalApplicationSchema = ProposalSchema.extend({
  type: z.literal("application"),
  funderDetails: FunderDetailsSchema,
  applicationQuestions: ApplicationQuestionsSchema,
});

export type ProposalApplication = z.infer<typeof ProposalApplicationSchema>;

/**
 * RFP-type proposal schema
 */
export const ProposalRFPSchema = ProposalSchema.extend({
  type: z.literal("rfp"),
  funderDetails: FunderDetailsSchema,
  rfpResponse: RFPResponseSchema,
});

export type ProposalRFP = z.infer<typeof ProposalRFPSchema>;

/**
 * Union type of all proposal types
 */
export const ProposalUnionSchema = z.discriminatedUnion("type", [
  ProposalApplicationSchema,
  ProposalRFPSchema,
]);

export type ProposalUnion = z.infer<typeof ProposalUnionSchema>;

/**
 * Partial proposal schema for creating new proposals
 */
export const CreateProposalSchema = ProposalSchema.partial({
  id: true,
  createdAt: true,
  updatedAt: true,
})
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    title: z.string().min(1, { message: "Proposal title is required" }),
    type: z.enum(["application", "rfp"]),
  });

export type CreateProposal = z.infer<typeof CreateProposalSchema>;

/**
 * Schema for validating form data in FunderDetailsView
 */
export const FunderDetailsFormSchema = FunderDetailsSchema.extend({
  deadline: z
    .date()
    .nullable()
    .refine((val) => val !== null, {
      message: "Submission deadline is required",
    }),
});

export type FunderDetailsForm = z.infer<typeof FunderDetailsFormSchema>;

/**
 * Schema for validating partially completed proposals (for saving drafts)
 */
export const PartialProposalSchema = ProposalSchema.partial().extend({
  id: z.string(),
  type: z.enum(["application", "rfp"]),
});

export type PartialProposal = z.infer<typeof PartialProposalSchema>;

/**
 * Validate that a proposal meets all requirements before submission
 * @param proposal The proposal to validate
 * @returns Result of validation with any error messages
 */
export function validateProposalForSubmission(proposal: unknown) {
  const baseCheck = ProposalSchema.safeParse(proposal);

  if (!baseCheck.success) {
    return baseCheck;
  }

  // Use discriminated union to validate by type
  return ProposalUnionSchema.safeParse(proposal);
}

/**
 * Check if a partially completed proposal can be saved as a draft
 * @param proposal Partial proposal data
 * @returns Result of validation with any error messages
 */
export function validatePartialProposal(proposal: unknown) {
  return PartialProposalSchema.safeParse(proposal);
}
