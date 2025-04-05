"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ProposalSchema } from "@/lib/schemas/proposal-schema";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureUserExists } from "@/lib/user-management";
import { Database } from "@/lib/schema/database";
import { revalidatePath } from "next/cache";

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

    // 3. Prepare data for insertion
    // Handle file separately if needed
    let fileToUpload = null;
    if (formData.get("file")) {
      fileToUpload = formData.get("file") as File;
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

// Type definition for uploadProposalFile result
type UploadResult = {
  success: boolean;
  filePath?: string;
  error?: string;
};

/**
 * Server action to upload a proposal file
 */
export async function uploadProposalFile(
  formData: FormData
): Promise<UploadResult> {
  console.log("[Action] Starting uploadProposalFile action");

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
        "[Action][UploadAuth] User not authenticated or failed verification:",
        userResult.error
      );
      return {
        success: false,
        error: userResult.error?.message || "User authentication failed",
      };
    }
    const userId = userResult.user.id;
    console.log(`[Action][UploadAuth] User ${userId} authenticated for upload`);

    // 2. Get file and proposal ID from FormData
    const file = formData.get("file") as File | null;
    const proposalId = formData.get("proposalId") as string | null;

    if (!file || !proposalId) {
      console.error("[Action][UploadValidation] Missing file or proposalId");
      return { success: false, error: "Missing file or proposal ID" };
    }
    console.log(
      `[Action][Upload] Received file: ${file.name} for proposal ${proposalId}`
    );

    // 3. Verify user owns the proposal (optional but recommended)
    console.log(
      `[Action][UploadVerify] Verifying ownership for proposal ${proposalId} by user ${userId}`
    );
    const { data: proposalOwner, error: ownerError } = await supabase
      .from("proposals")
      .select("user_id")
      .eq("id", proposalId)
      .single();

    if (ownerError || !proposalOwner || proposalOwner.user_id !== userId) {
      console.error(
        `[Action][UploadVerify] Ownership verification failed for proposal ${proposalId}. Error:`,
        ownerError
      );
      return {
        success: false,
        error: ownerError?.message || "Proposal not found or access denied",
      };
    }
    console.log(
      `[Action][UploadVerify] Ownership confirmed for proposal ${proposalId}`
    );

    // 4. Construct file path
    const fileExtension = file.name.split(".").pop();
    const filePath = `${userId}/${proposalId}/document.${fileExtension}`;
    console.log(`[Action][Upload] Generated file path: ${filePath}`);

    // 5. Upload file to Supabase Storage
    console.log(`[Action][Upload] Uploading file to storage: ${filePath}`);
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("proposals")
        .upload(filePath, file, { upsert: true }); // Upsert allows overwriting

      if (uploadError) {
        console.error(
          `[Action][UploadStorage] Storage upload failed for ${filePath}:`,
          uploadError
        );
        return {
          success: false,
          error: uploadError.message || "File upload failed",
        };
      }

      if (!uploadData) {
        console.error(
          `[Action][UploadStorage] Storage upload succeeded but no data returned for ${filePath}`
        );
        return {
          success: false,
          error: "File upload failed: No path returned",
        };
      }

      console.log(
        `[Action][UploadStorage] File uploaded successfully: ${uploadData.path}`
      );

      // 6. Update proposal record with file path
      console.log(
        `[Action][UploadUpdateDB] Updating proposal ${proposalId} with file path: ${uploadData.path}`
      );
      const { error: updateError } = await supabase
        .from("proposals")
        .update({ file_url: uploadData.path })
        .eq("id", proposalId);

      if (updateError) {
        console.error(
          `[Action][UploadUpdateDB] Failed to update proposal ${proposalId} with file path:`,
          updateError
        );
        // Depending on requirements, you might want to delete the uploaded file here
        return {
          success: false,
          error:
            updateError.message || "Failed to update proposal with file path",
        };
      }

      console.log(
        `[Action][UploadUpdateDB] Proposal ${proposalId} updated successfully`
      );

      // 7. Return success
      return { success: true, filePath: uploadData.path };
    } catch (error) {
      console.error(
        "[Action][Upload] Unexpected error during file upload:",
        error
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unexpected upload error",
      };
    }
  } catch (error) {
    console.error("[Action] Unexpected error in uploadProposalFile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error",
    };
  }
}
