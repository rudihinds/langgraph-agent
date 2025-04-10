"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ProposalSchema } from "@/lib/schemas/proposal-schema";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureUserExists } from "@/lib/user-management";
import { Database } from "@/lib/schema/database";
import { revalidatePath } from "next/cache";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  handleRfpUpload,
  UploadResult,
} from "@/lib/proposal-actions/upload-helper";

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

    // 1. Ensure user is authenticated and exists in DB
    const userResult = await ensureUserExists(supabase);
    if (!userResult.success) {
      console.error(
        "[Action][Auth] User not authenticated or failed verification:",
        userResult.error
      );
      return {
        success: false,
        error: userResult.error?.message || "User authentication failed",
      };
    }
    const userId = userResult.user.id;
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
    const userResult = await ensureUserExists(supabase);

    if (!userResult.success) {
      console.error("[UploadAction] Authentication failed");
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
      .eq("user_id", userResult.user.id)
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
    const result = await handleRfpUpload(
      supabase,
      userResult.user.id,
      proposalId,
      file
    );

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
