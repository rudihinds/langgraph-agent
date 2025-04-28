import { Database } from "@/lib/supabase/db/schema/database";
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
    `[UploadHelper] Processing file upload for proposal ${proposalId}`
  );

  // Validate Supabase client has necessary services
  if (!supabase.storage) {
    console.error(`[UploadHelper] Supabase client is missing storage module`);
    return {
      success: false,
      message: "Storage service unavailable.",
    };
  }

  try {
    // 1. Upload file to Supabase Storage
    const filePath = `${proposalId}/${file.name}`;

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("proposal-documents")
        .upload(filePath, file, {
          upsert: true,
        });

      if (uploadError || !uploadData) {
        console.error(
          "[UploadHelper] Storage upload failed:",
          uploadError?.message || "Unknown storage error"
        );
        return {
          success: false,
          message: `Failed to upload file: ${uploadError?.message || "Unknown storage error"}`,
        };
      }
      console.log(
        `[UploadHelper] File successfully uploaded to: ${uploadData.path}`
      );
    } catch (directUploadError) {
      console.error(
        `[UploadHelper] Exception during upload operation:`,
        directUploadError
      );
      return {
        success: false,
        message: `Upload operation error: ${directUploadError instanceof Error ? directUploadError.message : "Unknown error during upload"}`,
      };
    }

    // 2. Fetch existing proposal metadata
    const { data: proposalData, error: fetchError } = await supabase
      .from("proposals")
      .select("metadata")
      .eq("id", proposalId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      console.error(
        "[UploadHelper] Failed to fetch proposal metadata:",
        fetchError.message
      );
      return {
        success: false,
        message: `Failed to retrieve proposal metadata: ${fetchError.message}`,
      };
    }

    // Check if proposal was found and belongs to the user
    if (!proposalData) {
      console.warn(
        `[UploadHelper] Proposal ${proposalId} not found or user ${userId} does not own it.`
      );
      return {
        success: false,
        message: "Proposal not found or access denied.",
      };
    }

    // 3. Prepare and merge new metadata
    const existingMetadata =
      proposalData.metadata && typeof proposalData.metadata === "object"
        ? proposalData.metadata
        : {};

    const rfpDocumentMetadata = {
      name: file.name,
      path: `${proposalId}/${file.name}`,
      size: file.size,
      type: file.type,
      uploaded_at: new Date().toISOString(),
    };

    const newMetadata = {
      ...existingMetadata,
      rfp_document: rfpDocumentMetadata,
    };

    // 4. Update proposal metadata in database
    const { data: updateData, error: updateError } = await supabase
      .from("proposals")
      .update({ metadata: newMetadata })
      .eq("id", proposalId)
      .eq("user_id", userId)
      .select();

    if (updateError) {
      console.error(
        "[UploadHelper] Failed to update proposal metadata:",
        updateError.message
      );
      return {
        success: false,
        message: `Failed to update proposal metadata: ${updateError.message}`,
      };
    }
    console.log(
      `[UploadHelper] Metadata updated successfully for proposal ${proposalId}`
    );

    // 5. Return success
    return {
      success: true,
      message: "File uploaded and metadata updated successfully.",
    };
  } catch (error) {
    console.error(
      "[UploadHelper] Unexpected error in handleRfpUpload:",
      error instanceof Error ? error.message : error
    );
    return {
      success: false,
      message: `An unexpected error occurred during file handling: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
