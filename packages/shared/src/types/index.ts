import { z } from "zod";

export const ProposalSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  userId: z.string(),
  status: z.enum(["draft", "in_progress", "completed", "archived"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Proposal = z.infer<typeof ProposalSchema>;

export const ProposalSectionSchema = z.object({
  id: z.string(),
  proposalId: z.string(),
  title: z.string(),
  content: z.string(),
  order: z.number(),
  status: z.enum(["pending", "in_progress", "completed", "needs_revision"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ProposalSection = z.infer<typeof ProposalSectionSchema>;

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;
