import { Database } from "@/lib/schema/database";
import { SupabaseClient } from "@supabase/supabase-js";

// Type definition for the result of the helper
export type UploadResult = {
  success: boolean;
  message: string;
  document?: {
    id: string;
    name: string;
    size: number;
    type: string;
    uploadedAt: string;
  };
};

/**
 * Helper function for RFP file upload using the new document service API.
 *
 * @param proposalId The ID of the proposal to update.
 * @param file The File object to upload.
 * @returns UploadResult indicating success or failure.
 */
export async function handleRfpUpload(
  proposalId: string,
  file: File
): Promise<UploadResult> {
  console.log(
    `[UploadHelper] Processing file upload for proposal ${proposalId}`
  );

  try {
    // Create FormData for the API call
    const formData = new FormData();
    formData.append("file", file);

    // Call the new upload API
    const response = await fetch(`/api/proposals/${proposalId}/upload`, {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[UploadHelper] API call failed:", result.message);
      return {
        success: false,
        message: result.message || "Upload failed",
      };
    }

    console.log(`[UploadHelper] File successfully uploaded:`, result.document);

    return {
      success: true,
      message: result.message,
      document: result.document,
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

/**
 * Legacy function for backward compatibility - now just calls the new API
 * @deprecated Use handleRfpUpload(proposalId, file) instead
 */
export async function handleRfpUploadLegacy(
  supabase: SupabaseClient<Database>,
  userId: string,
  proposalId: string,
  file: File
): Promise<UploadResult> {
  console.warn(
    "[UploadHelper] Using legacy upload function - consider migrating to new API"
  );
  return handleRfpUpload(proposalId, file);
}
