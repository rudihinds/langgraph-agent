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
}
