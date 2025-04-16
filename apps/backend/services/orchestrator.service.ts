/**
 * OrchestratorService
 *
 * Manages interactions between the ProposalGenerationGraph, EditorAgent, and Persistent Checkpointer
 * as specified in AGENT_ARCHITECTURE.md and AGENT_BASESPEC.md.
 *
 * This service provides methods for:
 * - Starting and resuming proposal generation
 * - Handling HITL interrupts and gathering user feedback
 * - Managing proposal state persistence via the Checkpointer
 */

import { StateGraph } from "@langchain/langgraph";
import {
  OverallProposalState,
  InterruptStatus,
  InterruptMetadata,
  UserFeedback,
  ProcessingStatus,
  SectionType,
  FeedbackType,
  SectionProcessingStatus,
} from "../state/modules/types.js";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import { Logger, LogLevel } from "../lib/logger.js";

/**
 * Details about an interrupt that can be provided to the UI
 */
export interface InterruptDetails {
  nodeId: string;
  reason: string;
  contentReference: string;
  timestamp: string;
  evaluationResult?: any;
}

/**
 * OrchestratorService class
 * Implements the Orchestrator pattern described in AGENT_BASESPEC.md
 */
export class OrchestratorService {
  private graph: StateGraph<OverallProposalState>;
  private checkpointer: BaseCheckpointSaver;
  private logger: Logger;

  /**
   * Creates a new OrchestratorService
   *
   * @param graph The ProposalGenerationGraph instance
   * @param checkpointer The checkpointer for state persistence
   */
  constructor(
    graph: StateGraph<OverallProposalState>,
    checkpointer: BaseCheckpointSaver
  ) {
    this.graph = graph;
    this.checkpointer = checkpointer;
    this.logger = Logger.getInstance();
    this.logger.setLogLevel(LogLevel.INFO);
  }

  /**
   * Detects if the graph has paused at an interrupt point
   *
   * @param threadId The thread ID to check
   * @returns True if the graph is interrupted
   */
  async detectInterrupt(threadId: string): Promise<boolean> {
    // Get the latest state from the checkpointer
    const state = (await this.checkpointer.get(
      threadId
    )) as OverallProposalState;

    // Check if state is interrupted
    return state?.interruptStatus?.isInterrupted === true;
  }

  /**
   * Handles an interrupt from the proposal generation graph
   *
   * @param threadId The thread ID of the interrupted graph
   * @returns The current state with interrupt details
   */
  async handleInterrupt(threadId: string): Promise<OverallProposalState> {
    // Get the latest state via checkpointer
    const state = (await this.checkpointer.get(
      threadId
    )) as OverallProposalState;

    // Verify interrupt status
    if (!state?.interruptStatus?.isInterrupted) {
      throw new Error("No interrupt detected in the current state");
    }

    // Verify expected state status
    if (state.status !== "awaiting_review") {
      this.logger.warn(
        `Unexpected state status during interrupt: ${state.status}`
      );
    }

    // Log the interrupt for debugging/auditing
    this.logger.info(
      `Interrupt detected at ${state.interruptStatus.interruptionPoint}`
    );

    return state;
  }

  /**
   * Extracts detailed information about the current interrupt
   *
   * @param threadId The thread ID to check
   * @returns Interrupt details or null if no interrupt
   */
  async getInterruptDetails(
    threadId: string
  ): Promise<InterruptDetails | null> {
    const state = (await this.checkpointer.get(
      threadId
    )) as OverallProposalState;

    if (!state?.interruptStatus?.isInterrupted || !state.interruptMetadata) {
      return null;
    }

    return {
      nodeId: state.interruptMetadata.nodeId,
      reason: state.interruptMetadata.reason,
      contentReference: state.interruptMetadata.contentReference || "",
      timestamp: state.interruptMetadata.timestamp,
      evaluationResult: state.interruptMetadata.evaluationResult,
    };
  }

  /**
   * Gets the content being evaluated in the current interrupt
   *
   * @param threadId The thread ID to check
   * @returns The content reference and actual content
   */
  async getInterruptContent(
    threadId: string
  ): Promise<{ reference: string; content: any } | null> {
    const state = (await this.checkpointer.get(
      threadId
    )) as OverallProposalState;
    const details = await this.getInterruptDetails(threadId);

    if (!details || !details.contentReference) return null;

    // Extract the relevant content based on contentReference
    switch (details.contentReference) {
      case "research":
        return {
          reference: "research",
          content: state.researchResults,
        };
      case "solution":
        return {
          reference: "solution",
          content: state.solutionResults,
        };
      case "connections":
        return {
          reference: "connections",
          content: state.connections,
        };
      default:
        // Handle section references
        if (state.sections.has(details.contentReference as SectionType)) {
          return {
            reference: details.contentReference,
            content: state.sections.get(
              details.contentReference as SectionType
            ),
          };
        }
        return null;
    }
  }

  /**
   * Gets the current state of a proposal
   *
   * @param threadId The thread ID to retrieve state for
   * @returns The current proposal state
   */
  async getState(threadId: string): Promise<OverallProposalState> {
    return (await this.checkpointer.get(threadId)) as OverallProposalState;
  }

  /**
   * Submits user feedback during an interrupt for review of content
   *
   * @param threadId The thread ID of the interrupted proposal
   * @param feedback User feedback object containing type, comments, etc.
   * @returns Updated state with the feedback incorporated
   */
  async submitFeedback(
    threadId: string,
    feedback: UserFeedback
  ): Promise<OverallProposalState> {
    // Get the current state
    const state = await this.getState(threadId);

    // Verify there is an active interrupt
    if (!state?.interruptStatus?.isInterrupted) {
      throw new Error("Cannot submit feedback when no interrupt is active");
    }

    // Validate feedback type
    if (!["approve", "revise", "regenerate"].includes(feedback.type)) {
      throw new Error(`Invalid feedback type: ${feedback.type}`);
    }

    // Create updated state with feedback
    const updatedState: OverallProposalState = {
      ...state,
      interruptStatus: {
        ...state.interruptStatus,
        feedback: {
          type: feedback.type,
          content: feedback.comments || null,
          timestamp: feedback.timestamp || new Date().toISOString(),
        },
        processingStatus: "pending",
      },
      userFeedback: feedback,
    };

    // Persist the updated state
    await this.checkpointer.put(threadId, updatedState);
    this.logger.info(
      `User feedback (${feedback.type}) submitted for thread ${threadId}`
    );

    // Prepare state based on feedback type
    return this.prepareFeedbackForProcessing(threadId, feedback.type);
  }

  /**
   * Prepares state for processing based on feedback type
   *
   * @param threadId The thread ID of the proposal
   * @param feedbackType Type of feedback provided
   * @returns State prepared for resumption
   */
  private async prepareFeedbackForProcessing(
    threadId: string,
    feedbackType: FeedbackType
  ): Promise<OverallProposalState> {
    // Get latest state with feedback incorporated
    const state = await this.getState(threadId);
    let updatedState: OverallProposalState = { ...state };

    // Get the content reference from interrupt metadata
    const contentRef = state.interruptMetadata?.contentReference;

    switch (feedbackType) {
      case "approve":
        // Mark the relevant content as approved
        updatedState = this.updateContentStatus(
          updatedState,
          contentRef,
          "approved"
        );
        break;

      case "revise":
        // Mark the content for revision
        updatedState = this.updateContentStatus(
          updatedState,
          contentRef,
          "needs_revision"
        );
        break;

      case "regenerate":
        // Mark the content as stale to trigger regeneration
        updatedState = this.updateContentStatus(
          updatedState,
          contentRef,
          "stale"
        );
        break;
    }

    // Persist the updated state
    await this.checkpointer.put(threadId, updatedState);
    return updatedState;
  }

  /**
   * Updates the status of a specific content reference based on feedback
   *
   * @param state The current state
   * @param contentRef The content reference (research, solution, section, etc.)
   * @param status The new status to apply
   * @returns Updated state with the content status changed
   */
  private updateContentStatus(
    state: OverallProposalState,
    contentRef?: string,
    status?: ProcessingStatus | SectionProcessingStatus
  ): OverallProposalState {
    if (!contentRef || !status) {
      return state;
    }

    // Create a new state object to avoid mutation
    let updatedState = { ...state };

    // Update state based on content type
    if (contentRef === "research") {
      updatedState.researchStatus = status as ProcessingStatus;
    } else if (contentRef === "solution") {
      updatedState.solutionStatus = status as ProcessingStatus;
    } else if (contentRef === "connections") {
      updatedState.connectionsStatus = status as ProcessingStatus;
    } else {
      // Try to handle as a section reference
      try {
        const sectionType = contentRef as SectionType;
        if (updatedState.sections.has(sectionType)) {
          // Get the existing section
          const section = updatedState.sections.get(sectionType);

          if (section) {
            // Create updated section with new status
            const updatedSection = {
              ...section,
              status: status as SectionProcessingStatus,
              lastUpdated: new Date().toISOString(),
            };

            // Create new sections map to maintain immutability
            const newSections = new Map(updatedState.sections);
            newSections.set(sectionType, updatedSection);

            // Update the state with the new sections map
            updatedState.sections = newSections;
          }
        }
      } catch (e) {
        this.logger.error(`Failed to update status for content: ${contentRef}`);
      }
    }

    return updatedState;
  }

  /**
   * Resume the graph execution after feedback has been processed
   *
   * @param threadId The thread ID of the interrupted proposal
   * @returns Promise that resolves when the graph resumes successfully
   */
  async resumeAfterFeedback(threadId: string): Promise<void> {
    // Get the current state
    const state = await this.getState(threadId);

    // Validate the state has feedback that needs processing
    if (!state?.userFeedback) {
      throw new Error("Cannot resume: no user feedback found in state");
    }

    // Check that the processing status is correct
    if (state.interruptStatus.processingStatus !== "pending") {
      this.logger.warn(
        `Unexpected processing status when resuming: ${state.interruptStatus.processingStatus}`
      );
    }

    // Update the interrupt status to indicate processing is happening
    const updatedState: OverallProposalState = {
      ...state,
      interruptStatus: {
        ...state.interruptStatus,
        processingStatus: "processing_feedback",
      },
    };

    // Persist the updated state
    await this.checkpointer.put(threadId, updatedState);
    this.logger.info(`Resuming graph after feedback for thread ${threadId}`);

    try {
      // Resume the graph execution
      await this.graph.resume(threadId);
      this.logger.info(`Graph resumed successfully for thread ${threadId}`);
    } catch (error) {
      this.logger.error(`Error resuming graph: ${error}`);

      // Update state to indicate failure
      const errorState: OverallProposalState = {
        ...updatedState,
        interruptStatus: {
          ...updatedState.interruptStatus,
          processingStatus: "failed",
        },
        errors: [
          ...(updatedState.errors || []),
          `Failed to resume graph: ${error}`,
        ],
      };

      await this.checkpointer.put(threadId, errorState);
      throw error;
    }
  }
}
