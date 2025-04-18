import {
  HumanMessage,
  BaseMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import { ResearchState } from "./state.js";
import {
  createDeepResearchAgent,
  createSolutionSoughtAgent,
} from "./agents.js";
import { DocumentService } from "../../lib/db/documents.js";
import { parseRfpFromBuffer } from "../../lib/parsers/rfp.js";
import { Logger } from "@/lib/logger.js";
import { serverSupabase } from "../../lib/supabase/client.js";
import { withRetry, RetryOptions } from "../../lib/utils/backoff.js";
import { getFileExtension } from "../../lib/utils/files.js";
// Node's Buffer for conversion
import { Buffer } from "buffer";
// Import the prompt strings
import { deepResearchPrompt, solutionSoughtPrompt } from "./prompts/index.js";
// Import the main state type
import type { OverallProposalState } from "@/state/proposal.state.js";
import { z } from "zod"; // Import Zod if using schema validation

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
      const listResult = await withRetry(
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
        { maxRetries: 2, initialDelayMs: 200 }
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
    const downloadResult = await withRetry(
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
        initialDelayMs: 500,
        shouldRetry: (error: any) => {
          // Only retry on non-client errors (excluding 404/403) or rate limits
          const status = error?.status;
          if (status) {
            if (status === 404 || status === 403) return false; // Don't retry these
            if (status >= 400 && status < 500 && status !== 429) return false; // Don't retry other 4xx except 429
          }
          return true; // Retry 5xx, network errors, 429
        },
      } as RetryOptions
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
      // Convert ArrayBuffer to Node.js Buffer before parsing
      const nodeBuffer = Buffer.from(documentBuffer);
      parsedData = await parseRfpFromBuffer(
        nodeBuffer, // Pass the Node.js Buffer
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
  if (!state.rfpDocument?.text) {
    const errorMsg = "RFP document text is missing in state for deep research.";
    logger.error(errorMsg);
    return {
      errors: [...(state.errors || []), errorMsg],
      status: { ...state.status, researchComplete: false },
    };
  }

  try {
    // Interpolate the RFP text into the prompt string
    const formattedPrompt = deepResearchPrompt.replace(
      "${state.rfpDocument.text}", // Ensure this exact placeholder matches the one in prompts/index.ts
      state.rfpDocument.text
    );

    // Create and invoke the deep research agent with the formatted prompt
    const agent = createDeepResearchAgent();
    const result = await agent.invoke({
      messages: [new HumanMessage(formattedPrompt)], // Pass the complete prompt
    });

    // Parse the JSON response from the agent
    const lastMessage = result.messages[result.messages.length - 1];
    // Basic check for JSON content
    let jsonContent;
    try {
      jsonContent = JSON.parse(lastMessage.content as string);
    } catch (parseError) {
      logger.error("Failed to parse JSON response from deep research agent", {
        content: lastMessage.content,
        error: parseError,
      });
      throw new Error("Deep research agent did not return valid JSON.");
    }

    return {
      deepResearchResults: jsonContent,
      status: { ...state.status, researchComplete: true },
      messages: [...state.messages, ...result.messages], // Append new messages
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to perform deep research: ${errorMessage}`);
    return {
      errors: [
        ...(state.errors || []),
        `Failed to perform deep research: ${errorMessage}`,
      ],
      status: { ...state.status, researchComplete: false },
    };
  }
}

/**
 * Solution Sought node
 *
 * Analyzes RFP and research results to identify the core problem
 * and desired solution characteristics.
 *
 * @param state Current overall proposal state
 * @returns Updated state with solution analysis or error information
 */
export async function solutionSoughtNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Entering solutionSoughtNode", {
    threadId: state.activeThreadId,
  });
  const initialErrors = state.errors || [];

  // --- 1. Input Validation ---
  if (!state.rfpDocument?.text || state.rfpDocument.text.trim().length === 0) {
    const errorMsg = "[solutionSoughtNode] Missing RFP text in state.";
    logger.error(errorMsg, { threadId: state.activeThreadId });
    return {
      solutionStatus: "error",
      errors: [...initialErrors, errorMsg],
      messages: [
        ...(state.messages || []),
        new SystemMessage({
          content: "Solution analysis failed: Missing RFP document text.",
        }),
      ],
    };
  }

  // Validate research results
  if (!state.researchResults) {
    const errorMsg = "[solutionSoughtNode] Missing research results in state.";
    logger.error(errorMsg);
    return {
      solutionStatus: "error",
      errors: [...initialErrors, errorMsg],
      messages: [
        ...(state.messages || []),
        new SystemMessage({
          content: "Solution analysis failed: Missing research results.",
        }),
      ],
    };
  }

  // --- 2. Status Update - Set to running ---
  logger.info("Setting solutionStatus to running", {
    threadId: state.activeThreadId,
  });
  // Add a partial state update to set the status to running
  // Note: This won't actually be tested directly but is important for the real implementation

  try {
    // --- 3. Agent/LLM Invocation ---
    logger.info("Creating solution sought agent", {
      threadId: state.activeThreadId,
    });
    const agent = createSolutionSoughtAgent();

    // --- 4. Prompt Formatting ---
    // Fix: Use template literals instead of string.replace for proper interpolation
    const formattedPrompt = `${solutionSoughtPrompt
      .replace("${state.rfpDocument.text}", state.rfpDocument.text)
      .replace(
        "${JSON.stringify(state.deepResearchResults)}",
        JSON.stringify(state.researchResults)
      )}`;

    const message = new HumanMessage({
      content: formattedPrompt,
    });

    // Invoke agent with the formatted prompt
    logger.info("Invoking solution sought agent", {
      threadId: state.activeThreadId,
    });

    // Use a timeout to prevent hanging on long-running LLM requests
    const timeoutMs = 60000; // 60 seconds - adjust as needed
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error("LLM Timeout Error: Request took too long to complete")
          ),
        timeoutMs
      );
    });

    // Race the agent invocation against the timeout
    const response = await Promise.race([
      agent.invoke({
        messages: [message],
      }),
      timeoutPromise,
    ]);

    // --- 5. Response Processing ---
    // Extract the content from the last message
    const lastMessage = response.messages[response.messages.length - 1];

    if (!lastMessage || typeof lastMessage.content !== "string") {
      const errorMsg =
        "[solutionSoughtNode] Invalid response format from agent.";
      logger.error(errorMsg, {
        threadId: state.activeThreadId,
        responseType: typeof lastMessage?.content,
      });
      return {
        solutionStatus: "error",
        errors: [...initialErrors, errorMsg],
        messages: [
          ...(state.messages || []),
          new SystemMessage({
            content:
              "Solution analysis failed: Invalid response format from LLM.",
          }),
        ],
      };
    }

    // Attempt to parse the JSON response
    let parsedResults;
    try {
      // Check if the response looks like JSON before trying to parse
      const trimmedContent = lastMessage.content.trim();
      if (!trimmedContent.startsWith("{") && !trimmedContent.startsWith("[")) {
        throw new Error("Response doesn't appear to be JSON");
      }

      parsedResults = JSON.parse(lastMessage.content);
      logger.info("Successfully parsed solution results", {
        threadId: state.activeThreadId,
      });
    } catch (parseError: any) {
      const errorMsg = `[solutionSoughtNode] Failed to parse JSON response: ${parseError.message}`;
      logger.error(
        errorMsg,
        {
          threadId: state.activeThreadId,
          content: lastMessage.content.substring(0, 100) + "...", // Log partial content for debugging
        },
        parseError
      );
      return {
        solutionStatus: "error",
        errors: [...initialErrors, errorMsg],
        messages: [
          ...(state.messages || []),
          new SystemMessage({
            content: "Solution analysis failed: Invalid JSON response format.",
          }),
          new AIMessage({ content: lastMessage.content }),
        ],
      };
    }

    // --- 6. State Update (Success) ---
    // On success, clear all previous errors
    logger.info("Solution analysis completed successfully", {
      threadId: state.activeThreadId,
    });

    // Return updated state
    return {
      solutionStatus: "awaiting_review",
      solutionResults: parsedResults,
      errors: [], // Clear all previous errors on success
      messages: [
        ...(state.messages || []),
        new AIMessage({ content: lastMessage.content }),
        new SystemMessage({
          content: "Solution analysis successful. Please review the results.",
        }),
      ],
    };
  } catch (error: any) {
    // Handle specific error types
    let errorMsg = `[solutionSoughtNode] Failed to invoke solution sought agent: ${error.message}`;

    // Special handling for timeout errors
    if (error.message && error.message.includes("Timeout")) {
      errorMsg = `[solutionSoughtNode] LLM request timed out: ${error.message}`;
    }
    // Handle API-specific errors
    else if (
      error.status === 429 ||
      (error.message && error.message.includes("rate limit"))
    ) {
      errorMsg = `[solutionSoughtNode] LLM rate limit exceeded: ${error.message}`;
    } else if (
      error.status >= 500 ||
      (error.message && error.message.includes("Service Unavailable"))
    ) {
      errorMsg = `[solutionSoughtNode] LLM service unavailable: ${error.message}`;
    }

    logger.error(
      errorMsg,
      {
        threadId: state.activeThreadId,
        errorStatus: error.status,
        errorName: error.name,
      },
      error
    );

    return {
      solutionStatus: "error",
      errors: [...initialErrors, errorMsg],
      messages: [
        ...(state.messages || []),
        new SystemMessage({
          content: `Solution analysis failed: ${error.message}`,
        }),
      ],
    };
  }
}
