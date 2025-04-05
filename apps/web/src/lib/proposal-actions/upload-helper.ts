import { Database } from "@/lib/schema/database";
import { SupabaseClient } from "@supabase/supabase-js";

// Type definition for the result of the helper
export type UploadResult = {
  success: boolean;
  message: string;
};

/**
 * Helper function containing the core logic for RFP file upload and metadata update.
 *
 * @param supabase Initialized Supabase client instance.
 * @param userId Authenticated user ID.
 * @param proposalId The ID of the proposal to update.
 * @param file The File object to upload.
 * @returns UploadResult indicating success or failure.
 */
export async function handleRfpUpload(
  supabase: SupabaseClient<Database>,
  userId: string, // Expecting validated user ID
  proposalId: string,
  file: File
): Promise<UploadResult> {
  console.log(
    `[Helper][Upload] Starting internal handler for proposal ${proposalId}, user ${userId}`
  );
  try {
    // 1. Upload file to Supabase Storage
    const filePath = `${proposalId}/${file.name}`;
    console.log(
      `[Helper][UploadStorage] Attempting to upload file to path: ${filePath}`
    );
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("proposal-documents") // Ensure bucket name matches setup from SUPABASE_SETUP.md
      .upload(filePath, file, {
        upsert: true,
      });

    if (uploadError || !uploadData) {
      console.error(
        "[Helper][UploadStorage] Storage upload failed:",
        uploadError
      );
      return {
        success: false,
        message: `Failed to upload file: ${uploadError?.message || "Unknown storage error"}`,
      };
    }
    console.log(
      `[Helper][UploadStorage] File successfully uploaded to: ${uploadData.path}`
    );

    // 2. Fetch existing proposal metadata
    console.log(
      `[Helper][UploadDB] Fetching metadata for proposal: ${proposalId}`
    );
    const { data: proposalData, error: fetchError } = await supabase
      .from("proposals")
      .select("metadata")
      .eq("id", proposalId)
      // Ensure user owns the proposal (important check, even if auth done in wrapper)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error(
        "[Helper][UploadDB] Failed to fetch proposal metadata:",
        fetchError
      );
      return {
        success: false,
        message: `Failed to retrieve proposal metadata: ${fetchError.message}`,
      };
    }
    // Check if proposal was found and belongs to the user
    if (!proposalData) {
      console.warn(
        `[Helper][UploadDB] Proposal ${proposalId} not found or user ${userId} does not own it.`
      );
      return {
        success: false,
        message: "Proposal not found or access denied.",
      };
    }

    console.log(
      "[Helper][UploadDB] Successfully fetched proposal metadata",
      proposalData.metadata
    );

    // 3. Prepare and merge new metadata
    const existingMetadata =
      proposalData.metadata && typeof proposalData.metadata === "object"
        ? proposalData.metadata
        : {};

    const rfpDocumentMetadata = {
      name: file.name,
      path: uploadData.path,
      size: file.size,
      type: file.type,
    };

    const newMetadata = {
      ...existingMetadata,
      rfp_document: rfpDocumentMetadata,
    };
    console.log(
      "[Helper][UploadDB] Prepared new merged metadata:",
      newMetadata
    );

    // 4. Update proposal metadata in database
    console.log(
      `[Helper][UploadDB] Updating metadata for proposal: ${proposalId}`
    );
    // We already verified ownership with the select, so update should be safe if RLS is correct
    const { error: updateError } = await supabase
      .from("proposals")
      .update({ metadata: newMetadata })
      .eq("id", proposalId)
      .eq("user_id", userId); // Re-iterate user_id for safety/clarity

    if (updateError) {
      console.error(
        "[Helper][UploadDB] Failed to update proposal metadata:",
        updateError
      );
      return {
        success: false,
        message: `Failed to update proposal metadata: ${updateError.message}`,
      };
    }
    console.log(
      `[Helper][UploadDB] Metadata updated successfully for proposal ${proposalId}`
    );

    // 5. Return success
    return {
      success: true,
      message: "File uploaded and metadata updated successfully.",
    };
  } catch (error) {
    console.error(
      "[Helper][Upload] Unexpected error in handleRfpUpload:",
      error
    );
    return {
      success: false,
      message: `An unexpected error occurred during file handling: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
