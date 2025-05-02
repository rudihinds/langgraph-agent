/**
 * Document Loader Node
 *
 * Loads RFP documents from storage with authentication support.
 * This node handles retrieving document content from Supabase storage,
 * supporting both authenticated and server-side access patterns.
 */
import { OverallProposalState, LoadingStatus } from "@/state/proposal.state.js";
import { serverSupabase } from "../../../lib/supabase/client.js";
import { parseRfpFromBuffer } from "../../../lib/parsers/rfp.js";
import { Logger } from "../../../lib/logger.js";

const logger = Logger.getInstance();
const BUCKET_NAME = "proposal-documents";
const DEFAULT_FORMAT = "pdf";

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
  UNKNOWN = "unknown",
}

/**
 * Creates an error state for document loading
 *
 * @param state Current state
 * @param errorType Type of error that occurred
 * @param errorMessage Detailed error message
 * @param clientType Client used during the operation
 * @returns Updated state with error information
 */
function createErrorState(
  state: OverallProposalState,
  errorType: ErrorType,
  errorMessage: string,
  clientType?: ClientType
): Partial<OverallProposalState> {
  logger.error(`Document loading error: ${errorType} - ${errorMessage}`, {
    rfpId: state.rfpDocument?.id,
    clientType,
  });

  return {
    rfpDocument: {
      ...state.rfpDocument,
      status: LoadingStatus.ERROR,
      metadata: {
        errorType,
        error: errorMessage,
        clientType,
        timestamp: new Date().toISOString(),
      },
    },
  };
}

/**
 * Document Loader Node
 *
 * Loads and processes RFP documents from storage with authentication support.
 * Uses the authenticated client from context when available, falling back to
 * server client when needed.
 *
 * @param state Current proposal state
 * @param context Optional context containing authenticated client and user info
 * @returns Updated state with document content or error information
 */
export const documentLoaderNode = async (
  state: OverallProposalState,
  context?: { supabase?: StorageClient; user?: { id: string } }
): Promise<Partial<OverallProposalState>> => {
  // Extract rfpId from state
  const rfpId = state.rfpDocument?.id;

  // Validate that we have an rfpId to work with
  if (!rfpId) {
    return createErrorState(
      state,
      ErrorType.MISSING_INPUT,
      "Missing rfpId in state"
    );
  }

  // Determine which client to use (authenticated or server)
  const storageClient = context?.supabase || serverSupabase;
  const clientType: ClientType = context?.supabase ? "authenticated" : "server";
  const documentPath = `${rfpId}/document.${DEFAULT_FORMAT}`;

  try {
    logger.info(`Loading document: ${documentPath}`, {
      rfpId,
      clientType,
      userId: context?.user?.id,
    });

    // Download document from storage
    const { data, error } = await storageClient.storage
      .from(BUCKET_NAME)
      .download(documentPath);

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

      return createErrorState(state, errorType, error.message, clientType);
    }

    // Process document data
    if (!data) {
      return createErrorState(
        state,
        ErrorType.DOCUMENT_NOT_FOUND,
        "No data returned from storage",
        clientType
      );
    }

    // Convert data to ArrayBuffer and parse
    try {
      const buffer = await data.arrayBuffer();
      const { text, metadata: docMetadata } = await parseRfpFromBuffer(
        buffer,
        DEFAULT_FORMAT
      );

      logger.info(`Document loaded successfully: ${documentPath}`, {
        rfpId,
        clientType,
        format: DEFAULT_FORMAT,
      });

      // Return successful load state
      return {
        rfpDocument: {
          ...state.rfpDocument,
          status: LoadingStatus.LOADED,
          text,
          metadata: {
            ...docMetadata,
            clientType,
            loadedAt: new Date().toISOString(),
          },
        },
      };
    } catch (e) {
      // Handle parsing errors separately
      return createErrorState(
        state,
        ErrorType.PARSING_ERROR,
        e.message || "Error parsing document content",
        clientType
      );
    }
  } catch (error) {
    // Handle unexpected errors
    return createErrorState(
      state,
      ErrorType.UNKNOWN,
      error.message || "Unknown error during document loading",
      clientType
    );
  }
};
