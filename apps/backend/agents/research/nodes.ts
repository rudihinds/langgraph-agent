/**
 * Research Agent Nodes
 *
 * This file contains the node implementations for the research phase of proposal generation:
 * - documentLoaderNode: Loads and parses RFP documents
 * - researchNode: Performs deep research analysis on the RFP document
 * - solutionSoughtNode: Identifies the solution being sought by the funder
 * - connectionPairsNode: Identifies connections between funder priorities and applicant capabilities
 */

import {
  HumanMessage,
  BaseMessage,
  SystemMessage,
  AIMessage,
} from "@langchain/core/messages";
import { Logger } from "../../lib/logger.js";
import { parseRfpFromBuffer } from "../../lib/parsers/rfp.js";
import {
  listFilesWithRetry,
  downloadFileWithRetry,
} from "../../lib/supabase/supabase-runnable.js";
import { getFileExtension } from "../../lib/utils/files.js";
import {
  createDeepResearchAgent,
  createSolutionSoughtAgent,
} from "./agents.js";
import { Buffer } from "buffer";

// Import state and type definitions
import {
  OverallProposalState,
  ProcessingStatus,
  LoadingStatus,
  InterruptReason,
} from "../../state/proposal.state.js";

// Import the prompt strings
import { deepResearchPrompt, solutionSoughtPrompt } from "./prompts/index.js";

// Initialize logger
const logger = Logger.getInstance();

/**
 * Document loader node
 *
 * Retrieves a document from Supabase storage by ID, parses it,
 * and updates the state with its content or any errors encountered.
 *
 * @param state Current proposal state
 * @returns Updated partial state with document content or error information
 */
export async function documentLoaderNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Starting document loader node", {
    threadId: state.activeThreadId,
  });

  // Validate document ID exists in state
  const documentId = state.rfpDocument?.id;
  if (!documentId) {
    logger.warn("No document ID found in state", {
      threadId: state.activeThreadId,
    });
    return {
      errors: [
        ...state.errors,
        "No document ID found in state, cannot load document",
      ],
      rfpDocument: {
        ...state.rfpDocument,
        status: LoadingStatus.ERROR,
      },
    };
  }

  // Update status to loading
  logger.info(`Loading document with ID: ${documentId}`, {
    threadId: state.activeThreadId,
  });

  try {
    // Update state to indicate loading has started
    const bucketName = "proposal-documents";

    // List files to get metadata
    const fileObjects = await listFilesWithRetry.invoke({
      bucketName,
      path: "",
    });

    // Find the file that matches the document_id
    const file = fileObjects.find((f) => f.name.includes(documentId));
    if (!file) {
      logger.error(`File not found for document: ${documentId}`, {
        threadId: state.activeThreadId,
      });
      return {
        errors: [...state.errors, `File not found for document: ${documentId}`],
        rfpDocument: {
          ...state.rfpDocument,
          status: LoadingStatus.ERROR,
        },
      };
    }

    const documentPath = file.name;
    logger.info(`Found document at path: ${documentPath}`, {
      threadId: state.activeThreadId,
    });

    // Download the file
    logger.info(`Downloading document from path: ${documentPath}`, {
      threadId: state.activeThreadId,
    });
    const fileBlob = await downloadFileWithRetry.invoke({
      bucketName,
      path: documentPath,
    });

    // Determine file type by extension
    const fileExtension = getFileExtension(documentPath);

    // Parse the document based on file type
    logger.info(`Parsing document with extension: ${fileExtension}`, {
      threadId: state.activeThreadId,
    });

    // Convert Blob to Buffer for parsing
    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use the correct parsing function
    const parsedDocument = await parseRfpFromBuffer(
      buffer,
      fileExtension,
      documentPath
    );

    // Update state with document content and metadata
    logger.info(`Successfully parsed document`, {
      threadId: state.activeThreadId,
    });

    return {
      rfpDocument: {
        id: documentId,
        fileName: documentPath,
        text: parsedDocument.text,
        metadata: parsedDocument.metadata || {},
        status: LoadingStatus.LOADED,
      },
      messages: [
        ...state.messages,
        new SystemMessage({
          content: `Document "${documentPath}" successfully loaded and parsed.`,
        }),
      ],
    };
  } catch (error: any) {
    logger.error(`Error loading document: ${error.message}`, {
      error,
      threadId: state.activeThreadId,
    });

    // Handle specific error cases
    if (error.statusCode === 404) {
      return {
        errors: [...state.errors, `File not found for document: ${documentId}`],
        rfpDocument: {
          ...state.rfpDocument,
          status: LoadingStatus.ERROR,
        },
      };
    } else if (error.statusCode === 403) {
      return {
        errors: [
          ...state.errors,
          `Permission denied when trying to access document: ${documentId}`,
        ],
        rfpDocument: {
          ...state.rfpDocument,
          status: LoadingStatus.ERROR,
        },
      };
    }

    // Generic error handling
    return {
      errors: [...state.errors, `Error loading document: ${error.message}`],
      rfpDocument: {
        ...state.rfpDocument,
        status: LoadingStatus.ERROR,
      },
    };
  }
}

/**
 * Deep research node
 *
 * Invokes the deep research agent to analyze RFP documents
 * and extract structured information
 *
 * @param state Current proposal state
 * @returns Updated partial state with research results or error information
 */
export async function researchNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Starting research node", { threadId: state.activeThreadId });

  if (!state.rfpDocument?.text) {
    const errorMsg = "RFP document text is missing in state for research.";
    logger.error(errorMsg, { threadId: state.activeThreadId });
    return {
      errors: [...state.errors, errorMsg],
      researchStatus: ProcessingStatus.ERROR,
      messages: [
        ...state.messages,
        new SystemMessage({
          content: "Research failed: Missing RFP document text.",
        }),
      ],
    };
  }

  // Update status to running
  logger.info("Setting research status to running", {
    threadId: state.activeThreadId,
  });

  try {
    // Interpolate the RFP text into the prompt template
    const formattedPrompt = deepResearchPrompt.replace(
      "${state.rfpDocument.text}",
      state.rfpDocument.text
    );

    // Create and invoke the deep research agent
    logger.info("Creating research agent", { threadId: state.activeThreadId });
    const agent = createDeepResearchAgent();

    logger.info("Invoking research agent", { threadId: state.activeThreadId });
    const result = await agent.invoke({
      messages: [new HumanMessage(formattedPrompt)],
    });

    // Parse the JSON response from the agent
    const lastMessage = result.messages[result.messages.length - 1];

    // Basic check for JSON content
    let jsonContent;
    try {
      const content = lastMessage.content as string;
      // Check if the response looks like JSON
      const trimmedContent = content.trim();
      if (!trimmedContent.startsWith("{") && !trimmedContent.startsWith("[")) {
        throw new Error("Response doesn't appear to be JSON");
      }

      jsonContent = JSON.parse(content);
      logger.info("Successfully parsed research results", {
        threadId: state.activeThreadId,
      });
    } catch (parseError: any) {
      logger.error("Failed to parse JSON response from research agent", {
        content: lastMessage.content,
        error: parseError,
        threadId: state.activeThreadId,
      });
      return {
        researchStatus: ProcessingStatus.ERROR,
        errors: [
          ...state.errors,
          `Failed to parse research results: ${parseError.message}`,
        ],
        messages: [
          ...state.messages,
          new SystemMessage({
            content: "Research failed: Invalid JSON response format.",
          }),
          // Include the problematic message for debugging
          new AIMessage({ content: lastMessage.content as string }),
        ],
      };
    }

    // Return updated state with research results
    logger.info("Research completed successfully", {
      threadId: state.activeThreadId,
    });
    return {
      researchResults: jsonContent,
      researchStatus: ProcessingStatus.READY_FOR_EVALUATION,
      messages: [
        ...state.messages,
        ...result.messages,
        new SystemMessage({
          content: "Research analysis completed. Ready for evaluation.",
        }),
      ],
    };
  } catch (error: any) {
    // Handle error cases
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to perform research: ${errorMessage}`, {
      threadId: state.activeThreadId,
    });

    return {
      researchStatus: ProcessingStatus.ERROR,
      errors: [...state.errors, `Failed to perform research: ${errorMessage}`],
      messages: [
        ...state.messages,
        new SystemMessage({
          content: `Research failed: ${errorMessage}`,
        }),
      ],
    };
  }
}

/**
 * Solution Sought node
 *
 * Analyzes RFP and research results to identify the core problem
 * and desired solution characteristics.
 *
 * @param state Current proposal state
 * @returns Updated state with solution analysis or error information
 */
export async function solutionSoughtNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Entering solutionSoughtNode", {
    threadId: state.activeThreadId,
  });

  // Input Validation
  if (!state.rfpDocument?.text) {
    const errorMsg = "[solutionSoughtNode] Missing RFP text in state.";
    logger.error(errorMsg, { threadId: state.activeThreadId });
    return {
      solutionStatus: ProcessingStatus.ERROR,
      errors: [...state.errors, errorMsg],
      messages: [
        ...state.messages,
        new SystemMessage({
          content: "Solution analysis failed: Missing RFP document text.",
        }),
      ],
    };
  }

  // Validate research results
  if (!state.researchResults) {
    const errorMsg = "[solutionSoughtNode] Missing research results in state.";
    logger.error(errorMsg, { threadId: state.activeThreadId });
    return {
      solutionStatus: ProcessingStatus.ERROR,
      errors: [...state.errors, errorMsg],
      messages: [
        ...state.messages,
        new SystemMessage({
          content: "Solution analysis failed: Missing research results.",
        }),
      ],
    };
  }

  // Update status to running
  logger.info("Setting solutionStatus to running", {
    threadId: state.activeThreadId,
  });

  try {
    // Create solution sought agent
    logger.info("Creating solution sought agent", {
      threadId: state.activeThreadId,
    });
    const agent = createSolutionSoughtAgent();

    // Format prompt with RFP text and research results
    const formattedPrompt = solutionSoughtPrompt
      .replace("${state.rfpDocument.text}", state.rfpDocument.text)
      .replace(
        "${JSON.stringify(state.deepResearchResults)}",
        JSON.stringify(state.researchResults)
      );

    const message = new HumanMessage({ content: formattedPrompt });

    // Invoke agent with the formatted prompt
    logger.info("Invoking solution sought agent", {
      threadId: state.activeThreadId,
    });

    // Use a timeout to prevent hanging on long-running LLM requests
    const timeoutMs = 60000; // 60 seconds
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
      agent.invoke({ messages: [message] }),
      timeoutPromise,
    ]);

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
        solutionStatus: ProcessingStatus.ERROR,
        errors: [...state.errors, errorMsg],
        messages: [
          ...state.messages,
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
        solutionStatus: ProcessingStatus.ERROR,
        errors: [...state.errors, errorMsg],
        messages: [
          ...state.messages,
          new SystemMessage({
            content: "Solution analysis failed: Invalid JSON response format.",
          }),
          new AIMessage({ content: lastMessage.content }),
        ],
      };
    }

    // Return updated state with solution results
    logger.info("Solution analysis completed successfully", {
      threadId: state.activeThreadId,
    });

    return {
      solutionStatus: ProcessingStatus.READY_FOR_EVALUATION,
      solutionResults: parsedResults,
      messages: [
        ...state.messages,
        new AIMessage({ content: lastMessage.content }),
        new SystemMessage({
          content: "Solution analysis successful. Ready for evaluation.",
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
      solutionStatus: ProcessingStatus.ERROR,
      errors: [...state.errors, errorMsg],
      messages: [
        ...state.messages,
        new SystemMessage({
          content: `Solution analysis failed: ${error.message}`,
        }),
      ],
    };
  }
}

/**
 * Connection Pairs node
 *
 * Identifies connections between funder priorities and applicant capabilities
 * based on the research and solution analysis.
 *
 * @param state Current proposal state
 * @returns Updated state with connection pairs or error information
 */
export async function connectionPairsNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Entering connectionPairsNode", {
    threadId: state.activeThreadId,
  });

  // Input validation
  if (!state.solutionResults) {
    const errorMsg = "[connectionPairsNode] Missing solution results in state.";
    logger.error(errorMsg, { threadId: state.activeThreadId });
    return {
      connectionsStatus: ProcessingStatus.ERROR,
      errors: [...state.errors, errorMsg],
      messages: [
        ...state.messages,
        new SystemMessage({
          content:
            "Connection pairs analysis failed: Missing solution results.",
        }),
      ],
    };
  }

  // For now, we'll simulate the connection pairs analysis
  // In a real implementation, this would call a dedicated agent

  // Mock response - replace with actual implementation
  const mockConnections = [
    {
      funderPriority: "Evidence-based approaches",
      applicantCapability:
        "Research-backed methodology with 5 published studies",
      strength: "High",
      evidence:
        "Our team has published 5 peer-reviewed studies on our approach",
    },
    {
      funderPriority: "Community engagement",
      applicantCapability:
        "Established partnerships with 12 community organizations",
      strength: "Medium",
      evidence: "We have formal MOUs with 12 local organizations",
    },
    {
      funderPriority: "Sustainable impact",
      applicantCapability:
        "Self-funding model established in 3 previous projects",
      strength: "High",
      evidence: "Previous projects achieved sustainability within 18 months",
    },
  ];

  logger.info("Connection pairs analysis completed", {
    threadId: state.activeThreadId,
  });

  return {
    connections: mockConnections,
    connectionsStatus: ProcessingStatus.READY_FOR_EVALUATION,
    messages: [
      ...state.messages,
      new SystemMessage({
        content: "Connection pairs analysis completed. Ready for evaluation.",
      }),
    ],
  };
}

/**
 * Evaluate Research node
 *
 * Performs evaluation of research results to ensure quality
 * and provides feedback for improvement if needed.
 *
 * This node is responsible for triggering the HITL interrupt
 * for research review, as per architectural design.
 *
 * @param state Current proposal state
 * @returns Updated state with evaluation results and HITL interrupt
 */
export async function evaluateResearchNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Evaluating research results", {
    threadId: state.activeThreadId,
  });

  if (!state.researchResults) {
    logger.warn("No research results found to evaluate.", {
      threadId: state.activeThreadId,
    });
    return {
      researchStatus: ProcessingStatus.ERROR,
      errors: [...state.errors, "No research results found to evaluate."],
    };
  }

  // In a real implementation, this would call a model to evaluate the research
  // Here we're returning a placeholder evaluation

  const evaluation = {
    score: 8.5,
    passed: true,
    feedback:
      "The research analysis is comprehensive and insightful, covering key aspects of the RFP.",
    categories: {
      comprehensiveness: {
        score: 9,
        feedback: "Excellent coverage of all required areas.",
      },
      accuracy: {
        score: 8,
        feedback: "Generally accurate with minor improvements possible.",
      },
      actionability: {
        score: 8.5,
        feedback: "Insights are highly actionable for proposal development.",
      },
    },
  };

  // Set interrupt metadata to provide context for the UI
  // THIS is where the HITL interrupt should be triggered, not in the research node
  return {
    researchEvaluation: evaluation,
    researchStatus: ProcessingStatus.AWAITING_REVIEW,
    messages: [
      ...state.messages,
      new SystemMessage({
        content: "Research evaluation completed. Please review the results.",
      }),
    ],
    interruptMetadata: {
      reason: InterruptReason.EVALUATION_NEEDED,
      nodeId: "evaluateResearchNode",
      timestamp: new Date().toISOString(),
      contentReference: "research",
      evaluationResult: evaluation,
    },
    interruptStatus: {
      isInterrupted: true,
      interruptionPoint: "evaluateResearch",
      feedback: null,
      processingStatus: null,
    },
  };
}

/**
 * Evaluate Solution node
 *
 * Performs evaluation of solution results to ensure quality
 * and provides feedback for improvement if needed.
 *
 * This node is responsible for triggering the HITL interrupt
 * for solution review, as per architectural design.
 *
 * @param state Current proposal state
 * @returns Updated state with evaluation results and HITL interrupt
 */
export async function evaluateSolutionNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Evaluating solution results", {
    threadId: state.activeThreadId,
  });

  if (!state.solutionResults) {
    logger.warn("No solution results found to evaluate.", {
      threadId: state.activeThreadId,
    });
    return {
      solutionStatus: ProcessingStatus.ERROR,
      errors: [...state.errors, "No solution results found to evaluate."],
    };
  }

  // In a real implementation, this would call a model to evaluate the solution
  // Here we're returning a placeholder evaluation

  const evaluation = {
    score: 8.0,
    passed: true,
    feedback:
      "The solution analysis is well-aligned with the RFP requirements and identifies key opportunities.",
    categories: {
      alignment: {
        score: 8.5,
        feedback: "Excellent alignment with funder priorities.",
      },
      feasibility: {
        score: 7.5,
        feedback:
          "Implementation approach is realistic but could be more detailed.",
      },
      innovation: {
        score: 8.0,
        feedback:
          "Solution offers novel approaches to the identified challenges.",
      },
    },
  };

  // Set interrupt metadata to provide context for the UI
  return {
    solutionEvaluation: evaluation,
    solutionStatus: ProcessingStatus.AWAITING_REVIEW,
    messages: [
      ...state.messages,
      new SystemMessage({
        content: "Solution evaluation completed. Please review the results.",
      }),
    ],
    interruptMetadata: {
      reason: InterruptReason.EVALUATION_NEEDED,
      nodeId: "evaluateSolutionNode",
      timestamp: new Date().toISOString(),
      contentReference: "solution",
      evaluationResult: evaluation,
    },
    interruptStatus: {
      isInterrupted: true,
      interruptionPoint: "evaluateSolution",
      feedback: null,
      processingStatus: null,
    },
  };
}

/**
 * Evaluate Connections node
 *
 * Performs evaluation of connection pairs to ensure quality
 * and provides feedback for improvement if needed.
 *
 * This node is responsible for triggering the HITL interrupt
 * for connections review, as per architectural design.
 *
 * @param state Current proposal state
 * @returns Updated state with evaluation results and HITL interrupt
 */
export async function evaluateConnectionsNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Evaluating connection pairs", {
    threadId: state.activeThreadId,
  });

  if (!state.connections || state.connections.length === 0) {
    logger.warn("No connection pairs found to evaluate.", {
      threadId: state.activeThreadId,
    });
    return {
      connectionsStatus: ProcessingStatus.ERROR,
      errors: [...state.errors, "No connection pairs found to evaluate."],
    };
  }

  // In a real implementation, this would call a model to evaluate the connections
  // Here we're returning a placeholder evaluation

  const evaluation = {
    score: 7.5,
    passed: true,
    feedback:
      "The connection pairs effectively link funder priorities with applicant capabilities, providing a solid foundation for the proposal.",
    categories: {
      relevance: {
        score: 8.0,
        feedback: "Connections are directly relevant to funder goals.",
      },
      strength: {
        score: 7.0,
        feedback: "Evidence for capabilities could be stronger in some areas.",
      },
      coverage: {
        score: 7.5,
        feedback:
          "Most major funder priorities are addressed with appropriate capabilities.",
      },
    },
  };

  // Set interrupt metadata to provide context for the UI
  return {
    connectionsEvaluation: evaluation,
    connectionsStatus: ProcessingStatus.AWAITING_REVIEW,
    messages: [
      ...state.messages,
      new SystemMessage({
        content:
          "Connection pairs evaluation completed. Please review the results.",
      }),
    ],
    interruptMetadata: {
      reason: InterruptReason.EVALUATION_NEEDED,
      nodeId: "evaluateConnectionsNode",
      timestamp: new Date().toISOString(),
      contentReference: "connections",
      evaluationResult: evaluation,
    },
    interruptStatus: {
      isInterrupted: true,
      interruptionPoint: "evaluateConnections",
      feedback: null,
      processingStatus: null,
    },
  };
}
