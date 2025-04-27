import { z } from "zod";

/**
 * Simplified schema for the funder details form submission
 * This is specifically for the form in FunderDetailsView.tsx
 */
export const FunderDetailsFormSchema = z.object({
  organizationName: z.string().min(1, "Organization name is required"),
  fundingTitle: z.string().min(1, "Funding title is required"),
  deadline: z.date(),
  budgetRange: z.string().min(1, "Budget range is required"),
  focusArea: z.string().min(1, "Focus area is required"),
});

// Export the type for use in components
export type FunderDetailsForm = z.infer<typeof FunderDetailsFormSchema>;
