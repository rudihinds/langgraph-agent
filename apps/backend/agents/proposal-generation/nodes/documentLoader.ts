import { serverSupabase } from "@/lib/supabase/client.js";
import { parseRfpFromBuffer } from "@/lib/parsers/rfp.js";
import { OverallProposalState } from "@/state/proposal.state.js";
import { Logger } from "@/lib/logger.js";
import fs from "fs";
import path from "path";
import os from "os";

// Initialize logger
const logger = Logger.getInstance();

// Define the StorageError interface to match Supabase's error structure
interface StorageError {
  message: string;
  status?: number;
  statusCode?: number; // Some versions of Supabase use statusCode instead of status
}

/**
 * Document loader node responsible for retrieving RFP documents from Supabase storage
 * and updating the proposal state with the document content and metadata.
 * Supports PDF, DOCX, and TXT formats.
 *
 * @param state - The current state of the proposal generation process
 * @returns A partial state update with document loading results or errors
 */
export async function documentLoaderNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  // Extract document ID from state
  const { id } = state.rfpDocument;

  // Validate Document ID
  if (!id) {
    logger.error("No document ID provided for document loading");
    return {
      rfpDocument: {
        ...state.rfpDocument,
        status: "error",
      },
      errors: ["No document ID provided for document loading"],
    };
  }

  // Log Start
  logger.info("Document loading started", { documentId: id });

  // Temporary file path for downloaded document if needed
  let tempFilePath: string | null = null;

  try {
    // Update state to loading status
    const updatedState: Partial<OverallProposalState> = {
      rfpDocument: {
        ...state.rfpDocument,
        status: "loading",
      },
    };

    // Construct the document path in Supabase storage
    const documentPath = `documents/${id}`;

    // Download document from Supabase
    const { data, error } = await serverSupabase.storage
      .from("proposal-documents")
      .download(documentPath);

    // Handle download errors
    if (error) {
      const storageError = error as StorageError;
      // Handle different versions of the Supabase SDK that might use different property names
      const statusCode = storageError.status ?? storageError.statusCode;

      logger.error("Failed to download document", {
        documentId: id,
        error: storageError.message,
        statusCode,
      });

      let userMessage = "Failed to download document";

      // Add specific error messages based on status code
      if (statusCode === 404) {
        userMessage = "The requested document was not found (404)";
      } else if (statusCode === 403) {
        userMessage = "Permission denied when accessing document (403)";
      } else {
        userMessage = `Failed to download document: ${storageError.message}`;
      }

      return {
        rfpDocument: {
          ...state.rfpDocument,
          id, // Explicitly carry over the ID
          status: "error",
        },
        errors: [userMessage],
      };
    }

    if (!data) {
      logger.error("Document download returned no data", { documentId: id });
      return {
        rfpDocument: {
          ...state.rfpDocument,
          id,
          status: "error",
        },
        errors: ["Document download returned no data"],
      };
    }

    // Get MIME type from blob
    const mimeType = data.type || "application/octet-stream";
    logger.info("Downloaded document with MIME type", {
      documentId: id,
      mimeType,
    });

    // Convert blob to buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // For some parsing libraries that require file access, we may need to write to temp file
    tempFilePath = path.join(os.tmpdir(), `rfp-doc-${id}-${Date.now()}`);
    await fs.promises.writeFile(tempFilePath, buffer);

    // Parse the document
    const result = await parseRfpFromBuffer(buffer, mimeType, tempFilePath);

    logger.info("Document loaded successfully", {
      documentId: id,
      format: result.metadata.format,
      textLength: result.text.length,
    });

    // Return updated state with parsed document
    return {
      rfpDocument: {
        id,
        fileName: state.rfpDocument.fileName || result.metadata.fileName,
        text: result.text,
        metadata: {
          ...result.metadata,
          mimeType, // Include the MIME type in metadata
        },
        status: "loaded",
      },
    };
  } catch (error: unknown) {
    // Handle parsing errors or other unexpected issues
    const err = error as Error;
    logger.error("Error in document loader", {
      documentId: id,
      error: err.message,
      stack: err.stack,
    });

    let errorMessage = `Failed to process document: ${err.message}`;

    if (err.name === "ParsingError" || err.message.includes("parse")) {
      errorMessage = `Parsing error: ${err.message}`;
    }

    // Return error state
    return {
      rfpDocument: {
        ...state.rfpDocument,
        id,
        status: "error",
      },
      errors: [errorMessage],
    };
  } finally {
    // Clean up temporary file if created
    if (tempFilePath) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch (cleanupError) {
        logger.warn("Failed to clean up temporary file", {
          path: tempFilePath,
          error: (cleanupError as Error).message,
        });
        // We intentionally don't throw here to avoid failing due to cleanup issues
      }
    }
  }
}
