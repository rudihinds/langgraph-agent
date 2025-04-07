"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { ensureUserExists } from "@/lib/user-management";
import { revalidatePath } from "next/cache";
import { handleRfpUpload, UploadResult } from "./upload-helper";

// Define Zod schema for input validation
const UploadProposalFileSchema = z.object({
  userId: z.string(),
  title: z.string().min(5, { message: "Title must be at least 5 characters" }),
  description: z
    .string()
    .min(10, { message: "Description must be at least 10 characters" }),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Invalid date format (YYYY-MM-DD)",
  }),
  fundingAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, { message: "Invalid funding amount format" }),
  file: z.instanceof(File, { message: "Valid file is required" }),
});

/**
 * Server action to create a proposal and upload an RFP file in one step
 * for the enhanced form component
 */
export async function uploadProposalFile(input: {
  userId: string;
  title: string;
  description: string;
  deadline: string;
  fundingAmount: string;
  file: File;
}): Promise<{
  success: boolean;
  proposalId?: string;
  error?: string;
}> {
  console.log("Starting proposal creation with file upload");

  // Validate input using Zod
  const validatedFields = UploadProposalFileSchema.safeParse(input);

  if (!validatedFields.success) {
    console.error("Input validation failed:", validatedFields.error.flatten());
    return {
      success: false,
      error: JSON.stringify(validatedFields.error.flatten().fieldErrors),
    };
  }

  // Use validated data from here on
  const { userId, title, description, deadline, fundingAmount, file } =
    validatedFields.data;

  try {
    // Initialize Supabase client
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    if (!supabase) {
      console.error("Failed to initialize Supabase client");
      return {
        success: false,
        error: "Service unavailable",
      };
    }

    // Verify user exists
    const userResult = await ensureUserExists(supabase);
    if (!userResult.success) {
      console.error("User verification failed:", userResult.error);
      return {
        success: false,
        error: "Authentication failed. Please sign in again.",
      };
    }

    // Verify the user ID matches the authenticated user
    if (userResult.user.id !== userId) {
      console.error("User ID mismatch - potential security issue");
      return {
        success: false,
        error: "Authorization failed",
      };
    }

    // Create proposal record using validated data
    const proposalData = {
      user_id: userId,
      title,
      status: "draft",
      deadline: deadline,
      metadata: {
        proposal_type: "rfp",
        description: description,
        funding_amount: fundingAmount,
      },
    };

    // Insert proposal into database
    const { data: proposal, error: insertError } = await supabase
      .from("proposals")
      .insert(proposalData)
      .select()
      .single();

    if (insertError || !proposal) {
      console.error("Failed to create proposal:", insertError);
      return {
        success: false,
        error: insertError?.message || "Failed to create proposal",
      };
    }

    // Upload file to storage
    const uploadResult = await handleRfpUpload(
      supabase,
      userId,
      proposal.id,
      file
    );

    if (!uploadResult.success) {
      console.error("File upload failed:", uploadResult.message);

      // Delete the proposal if file upload failed
      await supabase.from("proposals").delete().eq("id", proposal.id);

      return {
        success: false,
        error: uploadResult.message,
      };
    }

    // Everything succeeded
    revalidatePath("/dashboard");
    revalidatePath("/proposals");

    return {
      success: true,
      proposalId: proposal.id,
    };
  } catch (error) {
    console.error("Unexpected error in uploadProposalFile:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unexpected error occurred",
    };
  }
}
