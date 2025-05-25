"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ProposalSchema } from "@/lib/schema/proposal-schema";
import { redirect } from "next/navigation";
import { z } from "zod";
// User management is handled by Supabase Auth automatically
import { Database } from "@/lib/schema/database";
import { revalidatePath } from "next/cache";
import { SupabaseClient } from "@supabase/supabase-js";
import { handleRfpUpload, UploadResult } from "./upload-helper";

// Type definition for createProposal result
type ProposalResult = {
  success: boolean;
  proposal?: Database["public"]["Tables"]["proposals"]["Row"];
  error?: string;
};

/**
 * Server action to create a new proposal
 */
export async function createProposal(
  formData: FormData
): Promise<ProposalResult> {
  console.log("[Action] Starting createProposal action");

  try {
    // Create the Supabase client with proper awaiting
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    // Check if supabase or supabase.auth is undefined
    if (!supabase || !supabase.auth) {
      console.error("[Action] Failed to initialize Supabase client");
      return {
        success: false,
        error: "Authentication service unavailable",
      };
    }

    // 1. Ensure user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[Action][Auth] User not authenticated:", authError);
      return {
        success: false,
        error: "User authentication failed",
      };
    }
    const userId = user.id;
    console.log(`[Action][Auth] User ${userId} authenticated and verified`);

    // 2. Validate form data
    console.log("[Action] Validating form data");
    let validatedData;
    try {
      // Extract raw data
      const rawData: Record<string, any> = {};
      formData.forEach((value, key) => {
        // Handle JSON strings (like metadata)
        if (key === "metadata" && typeof value === "string") {
          try {
            rawData[key] = JSON.parse(value);
            console.log(
              "[Action] Successfully parsed metadata JSON, checking for RFP document:",
              rawData[key].proposal_type === "rfp"
                ? "Found RFP proposal type"
                : "Not an RFP"
            );

            // Special handling for RFP metadata
            if (
              rawData[key].proposal_type === "rfp" &&
              rawData[key].rfp_document
            ) {
              console.log(
                "[Action] RFP document details found in metadata:",
                rawData[key].rfp_document
                  ? rawData[key].rfp_document.name
                  : "No document"
              );
            }
          } catch (error) {
            console.error("[Action] Failed to parse metadata JSON:", error);
            rawData[key] = {};
          }
        } else if (
          typeof value === "string" &&
          (value.startsWith("{") || value.startsWith("["))
        ) {
          try {
            rawData[key] = JSON.parse(value);
          } catch {
            rawData[key] = value;
          }
        } else {
          rawData[key] = value;
        }
      });

      console.log("[Action] Raw data extracted:", rawData);

      // Add user_id before validation
      rawData.user_id = userId;

      // Make sure ProposalSchema is imported correctly
      if (!ProposalSchema || typeof ProposalSchema.parse !== "function") {
        console.error(
          "[Action][Validation] ProposalSchema is not properly imported"
        );
        throw new Error("Invalid schema configuration");
      }

      // Validate against Zod schema
      validatedData = ProposalSchema.parse(rawData);
      console.log("[Action] Form data validated successfully");
    } catch (error) {
      console.error("[Action][Validation] Form validation failed:", error);
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: `Validation failed: ${JSON.stringify(error.flatten().fieldErrors)}`,
        };
      }
      return {
        success: false,
        error: "Form data validation failed: Unexpected error",
      };
    }

    // Ensure validatedData does not contain the file content if it somehow got there
    if (validatedData.metadata?.rfp_details?.rfpText) {
      console.warn("[Action] Removing rfpText from metadata before insertion.");
      delete validatedData.metadata.rfp_details.rfpText;
    }

    console.log("[Action] Prepared data for insertion:", validatedData);

    // 4. Insert proposal into database
    console.log(`[Action] Inserting proposal into database for user ${userId}`);
    try {
      const { data, error } = await supabase
        .from("proposals")
        .insert(validatedData)
        .select()
        .single();

      if (error) {
        console.error("[Action][DB] Database insert failed:", error);
        // Check for specific errors like RLS violation
        if (error.code === "42501") {
          return { success: false, error: "Database permission denied (RLS)." };
        }
        return { success: false, error: error.message || "Database error" };
      }

      if (!data) {
        console.error("[Action][DB] Insert succeeded but no data returned");
        return {
          success: false,
          error: "Failed to create proposal: No data returned from database",
        };
      }

      console.log(`[Action] Proposal created successfully with ID: ${data.id}`);

      // 5. Revalidate path and return success
      revalidatePath("/dashboard");
      return {
        success: true,
        proposal: data as Database["public"]["Tables"]["proposals"]["Row"],
      };
    } catch (error) {
      console.error(
        "[Action][DB] Unexpected error during database insertion:",
        error
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unexpected database error",
      };
    }
  } catch (error) {
    console.error("[Action] Unexpected error in createProposal:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  }
}

/**
 * Server action wrapper to upload an RFP file, store it, and update proposal metadata.
 * Handles authentication, client initialization, and calls the core logic helper.
 */
export async function uploadProposalFile(
  formData: FormData
): Promise<UploadResult> {
  console.log("[UploadAction] Processing proposal file upload");

  // 1. Validate Input
  const proposalId = formData.get("proposalId");
  const file = formData.get("file");

  if (!proposalId || typeof proposalId !== "string") {
    console.error("[UploadAction] Missing or invalid proposalId");
    return { success: false, message: "Proposal ID is required." };
  }
  if (!file) {
    console.error("[UploadAction] Missing file");
    return { success: false, message: "File is required." };
  }
  if (!(file instanceof File)) {
    console.error("[UploadAction] Invalid file format - not a File object");
    return { success: false, message: "Invalid file format." };
  }

  try {
    // 2. Initialize Supabase Client
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    if (!supabase) {
      console.error("[UploadAction] Failed to initialize Supabase client");
      return { success: false, message: "Service unavailable." };
    }

    // 3. Ensure user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("[UploadAction] Authentication failed:", authError);
      return {
        success: false,
        message: "Authentication failed. Please sign in again.",
      };
    }

    // 4. Verify proposal ownership before upload
    const { data: proposalData, error: verifyError } = await supabase
      .from("proposals")
      .select("id")
      .eq("id", proposalId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (verifyError) {
      console.error("[UploadAction] Error verifying proposal ownership");
      return {
        success: false,
        message: "Failed to verify proposal ownership.",
      };
    }

    if (!proposalData) {
      console.error("[UploadAction] Proposal not found or user doesn't own it");
      return {
        success: false,
        message: "Proposal not found or you don't have permission.",
      };
    }

    // 5. Perform the actual upload using the helper
    const result = await handleRfpUpload(supabase, user.id, proposalId, file);

    // 6. Return the result
    if (result.success) {
      // If successful, revalidate the dashboard path
      revalidatePath("/dashboard");
    }

    return result;
  } catch (error) {
    console.error(
      "[UploadAction] Unexpected error:",
      error instanceof Error ? error.message : error
    );
    return {
      success: false,
      message: `An unexpected error occurred: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

// Define Zod schema for the enhanced RFP form input validation
const UploadProposalFileSchema = z.object({
  userId: z.string(),
  title: z.string().min(5, { message: "Title must be at least 5 characters" }),
  description: z
    .string()
    .min(10, { message: "Description must be at least 10 characters" }),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message:
      "Please enter a valid date in YYYY-MM-DD format. The UI uses DD/MM/YYYY format but API requires YYYY-MM-DD.",
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
export async function uploadProposalFileEnhanced(input: {
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("User verification failed:", authError);
      return {
        success: false,
        error: "Authentication failed. Please sign in again.",
      };
    }

    // Verify the user ID matches the authenticated user
    if (user.id !== userId) {
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

/**
 * Create a proposal with application questions.
 * This is used by the ApplicationQuestionsViewNew component.
 */
export async function createProposalWithQuestions(input: {
  userId: string;
  title: string;
  description: string;
  deadline: string;
  questions: Array<{
    text: string;
    type: string;
    required: boolean;
  }>;
}): Promise<{
  success: boolean;
  proposalId?: string;
  error?: string;
}> {
  console.log("Starting proposal creation with questions");

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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("User verification failed:", authError);
      return {
        success: false,
        error: "Authentication failed. Please sign in again.",
      };
    }

    // Verify the user ID matches the authenticated user
    if (user.id !== input.userId) {
      console.error("User ID mismatch - potential security issue");
      return {
        success: false,
        error: "Authorization failed",
      };
    }

    // Create proposal record
    const proposalData = {
      user_id: input.userId,
      title: input.title,
      status: "draft",
      deadline: input.deadline,
      metadata: {
        proposal_type: "application",
        description: input.description,
        questions: input.questions,
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

    // Everything succeeded
    revalidatePath("/dashboard");
    revalidatePath("/proposals");

    return {
      success: true,
      proposalId: proposal.id,
    };
  } catch (error) {
    console.error("Unexpected error in createProposalWithQuestions:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unexpected error occurred",
    };
  }
}
