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

import { StateGraph, CompiledStateGraph } from "@langchain/langgraph";
import {
  OverallProposalState,
  InterruptStatus,
  InterruptMetadata,
  UserFeedback,
  ProcessingStatus,
  SectionType,
  SectionProcessingStatus,
} from "../state/modules/types.js";
import { FeedbackType } from "../lib/types/feedback.js";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import { Logger, LogLevel } from "../lib/logger.js";
import { v4 as uuidv4 } from "uuid";
import { SectionStatus, ProcessingStatus } from "@/state/modules/constants.js"; // Import enums

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
 * Type definition for any form of LangGraph state graph, compiled or not
 */
export type AnyStateGraph<T = OverallProposalState> =
  | StateGraph<T, T, Partial<T>, "__start__">
  | CompiledStateGraph<T, Partial<T>, "__start__">;

/**
 * OrchestratorService class
 * Implements the Orchestrator pattern described in AGENT_BASESPEC.md
 */
export class OrchestratorService {
  private graph: AnyStateGraph;
  private checkpointer: BaseCheckpointSaver;
  private logger: Logger;

  /**
   * Creates a new OrchestratorService
   *
   * @param graph The ProposalGenerationGraph instance (compiled or uncompiled)
   * @param checkpointer The checkpointer for state persistence
   */
  constructor(graph: AnyStateGraph, checkpointer: BaseCheckpointSaver) {
    this.graph = graph;
    this.checkpointer = checkpointer;
    this.logger = Logger.getInstance();
    // Check if setLogLevel exists before calling (for tests where Logger might be mocked)
    if (typeof this.logger.setLogLevel === "function") {
      this.logger.setLogLevel(LogLevel.INFO);
    }
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
    if (state.status !== ProcessingStatus.AWAITING_REVIEW) {
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
   * @param threadId The thread ID for the proposal
   * @param feedback Feedback submission object
   * @returns Status of the feedback submission
   */
  async submitFeedback(
    threadId: string,
    feedback: {
      type: FeedbackType;
      comments?: string;
      timestamp: string;
      contentReference?: string;
      specificEdits?: Record<string, unknown>;
    }
  ): Promise<{ success: boolean; message: string; status?: string }> {
    const {
      type: feedbackType,
      comments,
      timestamp,
      contentReference,
    } = feedback;

    // Get the current state
    const state = await this.getState(threadId);

    // Verify there is an active interrupt
    if (!state?.interruptStatus?.isInterrupted) {
      throw new Error("Cannot submit feedback when no interrupt is active");
    }

    // Create user feedback object
    const userFeedback: UserFeedback = {
      type: feedbackType,
      comments: comments || null,
      timestamp: timestamp || new Date().toISOString(),
      contentReference:
        contentReference || state.interruptMetadata?.contentReference || null,
    };

    // Create updated state with feedback
    const updatedState: OverallProposalState = {
      ...state,
      interruptStatus: {
        ...state.interruptStatus,
        feedback: {
          type: feedbackType,
          content: comments || null,
          timestamp: userFeedback.timestamp,
        },
        processingStatus: "pending",
      },
      userFeedback: userFeedback,
    };

    // Persist the updated state
    await this.checkpointer.put(threadId, updatedState);
    this.logger.info(
      `User feedback (${feedbackType}) submitted for thread ${threadId}`
    );

    // Prepare state based on feedback type
    const preparedState = await this.prepareFeedbackForProcessing(
      threadId,
      feedbackType
    );

    return {
      success: true,
      message: `Feedback (${feedbackType}) processed successfully`,
      status: preparedState.interruptStatus.processingStatus,
    };
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
      case FeedbackType.APPROVE:
        // Mark the relevant content as approved
        updatedState = this.updateContentStatus(
          updatedState,
          contentRef,
          SectionStatus.APPROVED
        );
        break;

      case FeedbackType.REVISE:
        // Mark the content for revision
        updatedState = this.updateContentStatus(
          updatedState,
          contentRef,
          SectionStatus.EDITED
        );
        break;

      case FeedbackType.REGENERATE:
        // Mark the content as stale to trigger regeneration
        updatedState = this.updateContentStatus(
          updatedState,
          contentRef,
          SectionStatus.STALE
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
   * @param proposalId The ID of the proposal to resume
   * @returns Status object with information about the resume operation
   */
  async resumeAfterFeedback(
    proposalId: string
  ): Promise<{ success: boolean; message: string; status?: string }> {
    // Get the current state
    const state = await this.getState(proposalId);

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
    await this.checkpointer.put(proposalId, updatedState);
    this.logger.info(`Resuming graph after feedback for thread ${proposalId}`);

    try {
      // Resume the graph execution
      await this.graph.resume(proposalId);
      this.logger.info(`Graph resumed successfully for thread ${proposalId}`);

      // Get the latest state after resumption
      const latestState = await this.getState(proposalId);

      return {
        success: true,
        message: "Graph execution resumed successfully",
        status: latestState.status,
      };
    } catch (error) {
      this.logger.error(`Error resuming graph: ${error}`);
      throw new Error(`Failed to resume graph execution: ${error}`);
    }
  }

  /**
   * Gets the interrupt status for a specific proposal
   *
   * @param proposalId The ID of the proposal to check
   * @returns Status object with interrupt details
   */
  async getInterruptStatus(
    proposalId: string
  ): Promise<{ interrupted: boolean; interruptData?: InterruptDetails }> {
    try {
      // Get current state
      const state = await this.getState(proposalId);

      // Check for interrupts
      const isInterrupted = state?.interruptStatus?.isInterrupted || false;

      // If there's no interrupt, return early
      if (!isInterrupted) {
        return { interrupted: false };
      }

      // Get detailed interrupt information
      const interruptData = await this.getInterruptDetails(proposalId);

      return {
        interrupted: true,
        interruptData: interruptData || undefined,
      };
    } catch (error) {
      this.logger.error(`Error checking interrupt status: ${error}`);
      throw new Error(`Failed to check interrupt status: ${error}`);
    }
  }
}
