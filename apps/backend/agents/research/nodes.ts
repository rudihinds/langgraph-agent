import { HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ResearchState } from "./state.js";
import {
  createDeepResearchAgent,
  createSolutionSoughtAgent,
} from "./agents.js";
import { DocumentService } from "../../lib/db/documents.js";
import { parseRfpFromBuffer } from "../../lib/parsers/rfp.js";
import { Logger } from "@/lib/logger.js";
import { serverSupabase } from "../../lib/supabase/client.js";
import { exponentialBackoff } from "../../lib/utils/backoff.js";
import { getFileExtension } from "../../lib/utils/files.js";

// Initialize logger
const logger = Logger.getInstance();

// Storage bucket name
const DOCUMENTS_BUCKET = "proposal-documents";

/**
 * Document loader node
 *
 * Retrieves a document from Supabase storage by ID, parses it,
 * and updates the state with its content or any errors encountered.
 *
 * @param state Current research state
 * @returns Updated state with document content or error information
 */
export async function documentLoaderNode(
  state: ResearchState
): Promise<Partial<ResearchState>> {
  const documentId = state.rfpDocument?.id;
  const initialErrors = state.errors || [];

  if (!documentId) {
    const errorMsg = "Document ID not provided in state.rfpDocument.id";
    logger.error(errorMsg);
    return {
      errors: [...initialErrors, errorMsg],
      status: {
        ...state.status,
        documentLoaded: false,
      },
    };
  }

  logger.info("Starting document load", { documentId });

  const documentPath = `documents/${documentId}.pdf`;
  logger.debug(`Constructed document path: ${documentPath}`);

  try {
    // --- Step 1b: Get File Metadata (Using list) ---
    let fileMetadata = null;
    try {
      const listResult = await exponentialBackoff(
        async () => {
          logger.debug("Attempting to list file for metadata", {
            bucket: DOCUMENTS_BUCKET,
            pathPrefix: documentPath,
          });
          // Use list() with the full path as prefix to get info for a single file
          const { data, error } = await serverSupabase.storage
            .from(DOCUMENTS_BUCKET)
            .list(`documents/`, {
              // List directory containing the file
              limit: 1, // Only need one result
              offset: 0,
              search: `${documentId}.pdf`, // Search for the specific file name
            });

          if (error) {
            logger.warn("Failed to list file for metadata", {
              documentId,
              error: error.message,
            });
            return null; // Allow proceeding, rely on extension
          }
          // Check if the specific file was found in the list
          if (data && data.length > 0 && data[0].name === `${documentId}.pdf`) {
            return data[0]; // Return the metadata of the found file
          }
          return null; // File not found in list
        },
        { maxRetries: 2, baseDelayMs: 200 }
      );

      fileMetadata = listResult;
    } catch (listError: any) {
      logger.warn("Listing file for metadata failed after retries", {
        documentId,
        error: listError.message,
      });
      fileMetadata = null;
    }

    // Determine file type (Metadata MIME type > Extension > Default 'txt')
    // Supabase list() returns metadata object with mimetype
    const mimeType = fileMetadata?.metadata?.mimetype;
    const extension = getFileExtension(documentPath);
    const fileType = mimeType || extension || "txt";
    logger.debug("Determined file type", {
      documentId,
      mimeType,
      extension,
      finalType: fileType,
    });

    // --- Step 2 & 4: Implement Download with Retry Logic ---
    const downloadResult = await exponentialBackoff(
      async () => {
        logger.debug("Attempting to download from Supabase Storage", {
          bucket: DOCUMENTS_BUCKET,
          path: documentPath,
        });
        // Use the pre-configured server client
        const { data, error } = await serverSupabase.storage
          .from(DOCUMENTS_BUCKET)
          .download(documentPath);

        // Check for Supabase-specific errors *before* throwing
        if (error) {
          logger.warn("Supabase download error occurred", {
            documentId,
            code: error.name,
            message: error.message,
            status: (error as any).status,
          });
          // Throw the error to trigger retry or failure based on shouldRetry
          const augmentedError = new Error(error.message);
          (augmentedError as any).status = (error as any).status || 500; // Add status if available
          throw augmentedError;
        }
        if (!data) {
          // Should ideally be caught by error, but handle explicitly if Supabase returns null data without error
          logger.error("Supabase download returned null data without error", {
            documentId,
          });
          throw new Error("Downloaded data is null.");
        }
        return data; // Return the ArrayBuffer on success
      },
      {
        maxRetries: 3, // Production-ready retry count
        baseDelayMs: 500,
        shouldRetry: (error: any) => {
          // Only retry on non-client errors (excluding 404/403) or rate limits
          const status = error?.status;
          if (status) {
            if (status === 404 || status === 403) return false; // Don't retry these
            if (status >= 400 && status < 500 && status !== 429) return false; // Don't retry other 4xx except 429
          }
          return true; // Retry 5xx, network errors, 429
        },
      }
    );

    // --- Step 3: Error Handling (Handled by try/catch and shouldRetry) ---
    // If we get here, download (with retries) was successful
    const documentBuffer = await downloadResult.arrayBuffer();
    logger.info("Document downloaded successfully", {
      documentId,
      size: documentBuffer.byteLength,
    });

    // --- Step 5: Integrate with Document Parser ---
    let parsedData;
    try {
      parsedData = await parseRfpFromBuffer(
        documentBuffer,
        fileType,
        documentPath
      );
      logger.info("Document parsed successfully", { documentId });
    } catch (parseError: any) {
      logger.error("Failed to parse document", {
        documentId,
        error: parseError.message,
      });
      return {
        errors: [...initialErrors, `Parsing error: ${parseError.message}`],
        status: { ...state.status, documentLoaded: false },
      };
    }

    // --- Step 6: Update State on Success ---
    return {
      rfpDocument: {
        ...state.rfpDocument,
        text: parsedData.text,
        metadata: {
          ...(state.rfpDocument.metadata || {}),
          ...(fileMetadata?.metadata || {}), // Metadata from Supabase list()
          ...(parsedData.metadata || {}), // Metadata from parser
          // Add size from buffer as a fallback/override
          size: documentBuffer.byteLength,
        },
      },
      status: {
        ...state.status,
        documentLoaded: true,
      },
      errors: initialErrors,
    };
  } catch (error: any) {
    // Catch errors from download (after retries) or other unexpected issues
    const status = error?.status;
    let specificErrorMessage =
      error.message || "Unknown error during document loading";

    if (status === 404) {
      specificErrorMessage = `Document not found at path: ${documentPath}`;
    } else if (status === 403) {
      specificErrorMessage = `Permission denied for document: ${documentPath}`;
    } else if (error.message.includes("NetworkError")) {
      // Example check
      specificErrorMessage = `Network error while fetching document: ${documentPath}`;
    }

    logger.error("Document loading failed definitively", {
      documentId,
      error: specificErrorMessage,
      status,
    });
    return {
      errors: [...initialErrors, specificErrorMessage],
      status: {
        ...state.status,
        documentLoaded: false,
      },
    };
  }
}

/**
 * Deep research node
 *
 * Invokes the deep research agent to analyze RFP documents
 * and extract structured information
 */
export async function deepResearchNode(state: ResearchState) {
  try {
    // Create and invoke the deep research agent
    const agent = createDeepResearchAgent();
    const result = await agent.invoke({
      messages: [new HumanMessage(state.rfpDocument.text)],
    });

    // Parse the JSON response from the agent
    const lastMessage = result.messages[result.messages.length - 1];
    const jsonContent = JSON.parse(lastMessage.content as string);

    return {
      deepResearchResults: jsonContent,
      status: { ...state.status, researchComplete: true },
      messages: [...state.messages, ...result.messages],
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`Failed to perform deep research: ${errorMessage}`);

    return {
      errors: [`Failed to perform deep research: ${errorMessage}`],
      status: { ...state.status, researchComplete: false },
    };
  }
}

/**
 * Solution sought node
 *
 * Invokes the solution sought agent to identify what
 * the funder is seeking based on research results
 */
export async function solutionSoughtNode(state: ResearchState) {
  try {
    // Create a message combining document text and research results
    const message = `RFP Text: ${state.rfpDocument.text}\n\nResearch Results: ${JSON.stringify(state.deepResearchResults)}`;

    // Create and invoke the solution sought agent
    const agent = createSolutionSoughtAgent();
    const result = await agent.invoke({
      messages: [new HumanMessage(message)],
    });

    // Parse the JSON response from the agent
    const lastMessage = result.messages[result.messages.length - 1];
    const jsonContent = JSON.parse(lastMessage.content as string);

    return {
      solutionSoughtResults: jsonContent,
      status: { ...state.status, solutionAnalysisComplete: true },
      messages: [...state.messages, ...result.messages],
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error(`Failed to analyze solution sought: ${errorMessage}`);

    return {
      errors: [`Failed to analyze solution sought: ${errorMessage}`],
      status: { ...state.status, solutionAnalysisComplete: false },
    };
  }
}
