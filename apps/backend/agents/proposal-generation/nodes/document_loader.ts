/**
 * Document Loader Node
 *
 * Loads RFP documents from storage with authentication support.
 * This node handles retrieving document content from Supabase storage,
 * supporting both authenticated and server-side access patterns.
 */
import { LoadingStatus } from "../../../state/modules/constants.js";
import { OverallProposalStateAnnotation } from "../../../state/modules/annotations.js";
import { serverSupabase } from "../../../lib/supabase/client.js";
import { parseRfpFromBuffer } from "../../../lib/parsers/rfp.js";
import { ProposalDocumentService } from "../../../lib/db/proposal-documents.js";
import { Logger } from "../../../lib/logger.js";
import { Command } from "@langchain/langgraph";

const logger = Logger.getInstance();
const BUCKET_NAME = "proposal-documents";

/**
 * Client type identifier for tracking which client was used for document access
 */
type ClientType = "authenticated" | "server";

/**
 * Minimally required interface for storage clients to support testing
 */
interface StorageClient {
  storage: {
    from: (bucket: string) => {
      download: (path: string) => Promise<{
        data: any;
        error: {
          message: string;
          status?: number;
        } | null;
      }>;
    };
  };
}

/**
 * Error types for document loading failures
 */
enum ErrorType {
  MISSING_INPUT = "missing_input",
  AUTHORIZATION = "authorization",
  DOCUMENT_NOT_FOUND = "document_not_found",
  PARSING_ERROR = "parsing_error",
  DATABASE_ERROR = "database_error",
  UNKNOWN = "unknown",
}

/**
 * Creates an error command for document loading
 *
 * @param state Current state
 * @param errorType Type of error that occurred
 * @param errorMessage Detailed error message
 * @param rfpId The extracted rfpId that was being processed
 * @param clientType Client used during the operation
 * @returns Command with error information and routing to chatAgent
 */
function createErrorCommand(
  state: typeof OverallProposalStateAnnotation.State,
  errorType: ErrorType,
  errorMessage: string,
  rfpId: string,
  clientType?: ClientType
): Command {
  logger.error(`Document loading error: ${errorType} - ${errorMessage}`, {
    rfpId,
    clientType,
  });

  return new Command({
    goto: "chatAgent",
    update: {
      rfpDocument: {
        ...state.rfpDocument,
        id: rfpId,
        status: LoadingStatus.ERROR,
        metadata: {
          errorType,
          error: errorMessage,
          clientType,
          timestamp: new Date().toISOString(),
        },
      },
      currentStatus: `Document loading failed: ${errorMessage}`,
      isAnalyzingRfp: false,
    },
  });
}

/**
 * Document Loader Node
 *
 * Loads and processes RFP documents from storage with authentication support.
 * First queries the proposal_documents table to get the actual file path,
 * then downloads the document from storage.
 *
 * @param state Current proposal state
 * @param context Optional context containing authenticated client and user info
 * @returns Command with document content or error information
 */
export const documentLoaderNode = async (
  state: typeof OverallProposalStateAnnotation.State,
  context?: { supabase?: StorageClient; user?: { id: string } }
): Promise<Command> => {
  // CRITICAL FIX: Extract rfpId from metadata first (auto-start flow), then fallback to other sources
  const rfpId =
    state.metadata?.rfpId ||
    state.rfpDocument?.id ||
    state.intent?.requestDetails;

  // Validate that we have an rfpId to work with
  if (!rfpId) {
    return createErrorCommand(
      state,
      ErrorType.MISSING_INPUT,
      "Missing rfpId in state metadata, rfpDocument.id, or intent.requestDetails",
      rfpId || "unknown",
      "server"
    );
  }

  logger.info(`Document loading initiated for rfpId: ${rfpId}`, {
    hasContext: !!context,
    hasSupabaseClient: !!context?.supabase,
  });

  // Determine which client to use (authenticated or server)
  const storageClient = context?.supabase || serverSupabase;
  const clientType: ClientType = context?.supabase ? "authenticated" : "server";

  try {
    // Step 1: Query the proposal_documents table to get the actual file path
    logger.info(`Querying proposal_documents table for proposal_id: ${rfpId}`, {
      rfpId,
      clientType,
      userId: context?.user?.id,
    });

    const documentRecord = await ProposalDocumentService.getByProposalId(rfpId);

    // Handle case where no document record is found
    if (!documentRecord) {
      return createErrorCommand(
        state,
        ErrorType.DOCUMENT_NOT_FOUND,
        `No document record found for proposal_id: ${rfpId}`,
        rfpId,
        clientType
      );
    }

    logger.info(`Found document record: ${documentRecord.id}`, {
      rfpId,
      documentId: documentRecord.id,
      filePath: documentRecord.file_path,
      fileName: documentRecord.file_name,
      parsingStatus: documentRecord.parsing_status,
    });

    // Step 2: Check if we already have parsed text available
    if (
      documentRecord.parsed_text &&
      documentRecord.parsing_status === "success"
    ) {
      logger.info(
        `Using cached parsed text for document: ${documentRecord.id}`,
        {
          rfpId,
          documentId: documentRecord.id,
          textLength: documentRecord.parsed_text.length,
        }
      );

      return new Command({
        goto: "rfpAnalysisDispatcher",
        update: {
          rfpDocument: {
            ...state.rfpDocument,
            id: rfpId,
            status: LoadingStatus.LOADED,
            text: documentRecord.parsed_text,
            metadata: {
              documentId: documentRecord.id,
              fileName: documentRecord.file_name,
              fileType: documentRecord.file_type,
              sizeBytes: documentRecord.size_bytes,
              clientType,
              loadedAt: new Date().toISOString(),
              source: "cached_parsed_text",
              raw: documentRecord.parsed_text,
            },
          },
          currentStatus: "Document loaded successfully. Starting analysis...",
          isAnalyzingRfp: true,
        },
      });
    }

    // Step 3: Download document from storage using the actual file path
    logger.info(
      `Downloading document from storage: ${documentRecord.file_path}`,
      {
        rfpId,
        documentId: documentRecord.id,
        filePath: documentRecord.file_path,
        clientType,
      }
    );

    const { data, error } = await storageClient.storage
      .from(BUCKET_NAME)
      .download(documentRecord.file_path);

    // Handle download errors
    if (error) {
      // Determine error type based on error information
      let errorType = ErrorType.UNKNOWN;

      // Check for authentication errors (typically 403)
      if (
        error.message?.includes("access denied") ||
        error.message?.includes("not authorized") ||
        (typeof error === "object" && "status" in error && error.status === 403)
      ) {
        errorType = ErrorType.AUTHORIZATION;
      }
      // Check for not found errors (typically 404)
      else if (
        error.message?.includes("not found") ||
        error.message?.includes("does not exist") ||
        (typeof error === "object" && "status" in error && error.status === 404)
      ) {
        errorType = ErrorType.DOCUMENT_NOT_FOUND;
      }

      return createErrorCommand(
        state,
        errorType,
        `Storage download failed: ${error.message}`,
        rfpId,
        clientType
      );
    }

    // Process document data
    if (!data) {
      return createErrorCommand(
        state,
        ErrorType.DOCUMENT_NOT_FOUND,
        "No data returned from storage",
        rfpId,
        clientType
      );
    }

    // Step 4: Convert data to ArrayBuffer and parse
    try {
      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Determine file extension from the actual file name or file path
      const fileExtension =
        documentRecord.file_name?.split(".").pop()?.toLowerCase() ||
        documentRecord.file_path?.split(".").pop()?.toLowerCase() ||
        "pdf";

      logger.info("About to parse document from buffer", {
        bufferSize: buffer.length,
        fileName: documentRecord.file_name,
        fileType: documentRecord.file_type,
      });

      // DEBUG: Test the parsing function directly
      console.log("[DOC LOADER DEBUG] Calling parseRfpFromBuffer...");
      console.log("[DOC LOADER DEBUG] Buffer length:", buffer.length);
      console.log("[DOC LOADER DEBUG] Buffer type:", buffer.constructor.name);

      const { text, metadata: docMetadata } = await parseRfpFromBuffer(
        buffer,
        fileExtension,
        documentRecord.file_name
      );

      console.log("[DOC LOADER DEBUG] Parse result:");
      console.log("[DOC LOADER DEBUG] Text length:", text.length);
      console.log("[DOC LOADER DEBUG] Text preview:", text.substring(0, 200));
      console.log(
        "[DOC LOADER DEBUG] Is mock content?",
        text.includes("mock PDF content generated for development")
      );

      // Cache the parsed text in database
      await ProposalDocumentService.updateParsedText(
        documentRecord.id,
        text,
        docMetadata
      );

      return new Command({
        goto: "rfpAnalysisDispatcher",
        update: {
          rfpDocument: {
            id: rfpId,
            status: "loaded" as LoadingStatus,
            text: text,
            metadata: {
              ...docMetadata,
              documentId: documentRecord.id,
              fileName: documentRecord.file_name,
              fileType: documentRecord.file_type,
              sizeBytes: buffer.length,
              filePath: documentRecord.file_path,
              clientType: "server",
              loadedAt: new Date().toISOString(),
              source: "storage_download_and_parse",
              raw: text,
            },
          },
          currentStatus: "Document loaded and parsed successfully. Starting analysis...",
          isAnalyzingRfp: true,
        },
      });
    } catch (e) {
      // Handle parsing errors separately
      logger.error(
        "[DocumentLoaderNode] Raw parsing/conversion error object:",
        e
      );
      const detailMessage =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : JSON.stringify(e);

      // Mark parsing as failed in the database
      try {
        await ProposalDocumentService.markParsingFailed(
          documentRecord.id,
          detailMessage
        );
      } catch (updateError) {
        logger.warn(
          `Failed to mark parsing as failed for document: ${documentRecord.id}`,
          {
            error:
              updateError instanceof Error
                ? updateError.message
                : String(updateError),
          }
        );
      }

      return createErrorCommand(
        state,
        ErrorType.PARSING_ERROR,
        detailMessage || "Error parsing document content or converting data",
        rfpId,
        clientType
      );
    }
  } catch (error) {
    // Handle any unexpected errors in the document loading process
    logger.error(
      `[DocumentLoaderNode] Unexpected error during document loading:`,
      {
        error: error instanceof Error ? error.message : String(error),
        rfpId,
        clientType,
      }
    );

    const errorMessage = error instanceof Error ? error.message : String(error);
    return createErrorCommand(
      state,
      ErrorType.UNKNOWN,
      errorMessage,
      rfpId,
      clientType
    );
  }
};

// Note: routeAfterDocumentLoading function removed - documentLoader now uses Command pattern
// for integrated state updates and routing decisions within the node itself
