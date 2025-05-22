/**
 * DEPRECATED: This service is no longer responsible for managing the main proposal graph or checkpointer.
 * The LangGraph server now handles all stateful graph operations.
 * Methods related to direct LangGraph flow control (interrupts, resume, explicit state save/load for graph operations)
 * are deprecated by commenting them out.
 * Methods containing useful business logic are preserved with comments indicating their value and need for refactoring
 * to align with the new LangGraph server architecture (e.g., for state access).
 * Refactor or remove methods as needed.
 */

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
 * - Processing chat interactions with the proposal generation system
 */

import {
  StateGraph,
  CompiledStateGraph,
  Checkpoint,
  CheckpointMetadata,
  CheckpointTuple,
} from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { BaseMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  OverallProposalState,
  // InterruptStatus, // Related to deprecated interrupt handling
  // InterruptMetadata, // Related to deprecated interrupt handling
  UserFeedback,
  SectionType,
  // SectionProcessingStatus, // Potentially used by business logic if it manipulates section status directly
} from "../state/modules/types.js";
import { FeedbackType } from "../lib/types/feedback.js";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import { Logger, LogLevel } from "../lib/logger.js";
// import { v4 as uuidv4 } from "uuid"; // Potentially unused if no new UUIDs generated here
import {
  ProcessingStatus,
  InterruptProcessingStatus,
  LoadingStatus,
} from "../state/modules/constants.js";
import { DependencyService } from "./DependencyService.js"; // Import the DependencyService
import { constructProposalThreadId } from "../lib/utils/threads.js"; // Import the new utility

/**
 * Details about an interrupt that can be provided to the UI
 */
/* DEPRECATED: Interrupt handling is now managed by the LangGraph server.
export interface InterruptDetails {
  nodeId: string;
  reason: string;
  contentReference: string;
  timestamp: string;
  evaluationResult?: any;
}
*/

/**
 * Type definition for any form of LangGraph state graph, compiled or not
 */
/* DEPRECATED: Graph management is now handled by the LangGraph server.
export type AnyStateGraph<T = OverallProposalState> =
  | StateGraph<T, T, Partial<T>, "__start__">
  | CompiledStateGraph<T, Partial<T>, "__start__">;
*/

/**
 * OrchestratorService class
 * Implements the Orchestrator pattern described in AGENT_BASESPEC.md
 */
export class OrchestratorService {
  private graph: AnyStateGraph; // DEPRECATED: Graph instance managed by LangGraph server
  private checkpointer: BaseCheckpointSaver; // DEPRECATED: Checkpointer interactions managed by LangGraph server
  private logger: Logger;
  private dependencyService: DependencyService; // Add DependencyService

  /**
   * Creates a new OrchestratorService
   *
   * @param graph The ProposalGenerationGraph instance (compiled or uncompiled)
   * @param checkpointer The checkpointer for state persistence
   */
  constructor(
    graph: AnyStateGraph, // DEPRECATED
    checkpointer: BaseCheckpointSaver, // DEPRECATED
    dependencyMapPath?: string // Optional path to dependency map
  ) {
    this.graph = graph; // DEPRECATED
    this.checkpointer = checkpointer; // DEPRECATED
    this.logger = Logger.getInstance();
    this.dependencyService = new DependencyService(dependencyMapPath); // Initialize DependencyService, used by business logic

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
  /* DEPRECATED: Interrupt detection is now managed by the LangGraph server.
  async detectInterrupt(threadId: string): Promise<boolean> {
    // Get the latest state from the checkpointer
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: threadId },
    });
    const state = checkpoint?.channel_values as unknown as
      | OverallProposalState
      | undefined;

    // Check if state is interrupted
    return state?.interruptStatus?.isInterrupted === true;
  }
  */

  /**
   * Handles an interrupt from the proposal generation graph
   *
   * @param threadId The thread ID of the interrupted graph
   * @returns The current state with interrupt details
   */
  /* DEPRECATED: Interrupt handling is now managed by the LangGraph server.
  async handleInterrupt(threadId: string): Promise<OverallProposalState> {
    // Get the latest state via checkpointer
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: threadId },
    });
    const state = checkpoint?.channel_values as unknown as
      | OverallProposalState
      | undefined;

    // Verify state exists
    if (!state) {
      throw new Error(`State not found for thread ${threadId}`);
    }

    // Verify interrupt status
    if (!state.interruptStatus?.isInterrupted) {
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
  */

  /**
   * Extracts detailed information about the current interrupt
   *
   * @param threadId The thread ID to check
   * @returns Interrupt details or null if no interrupt
   */
  /* DEPRECATED: Interrupt detail extraction is now managed by the LangGraph server.
  async getInterruptDetails(
    threadId: string
  ): Promise<InterruptDetails | null> {
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: threadId },
    });
    const state = checkpoint?.channel_values as unknown as
      | OverallProposalState
      | undefined;

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
  */

  /**
   * Gets the content being evaluated in the current interrupt
   *
   * @param threadId The thread ID to check
   * @returns The content reference and actual content
   */
  /* DEPRECATED: Interrupt content retrieval is now managed by the LangGraph server.
  async getInterruptContent(
    threadId: string
  ): Promise<{ reference: string; content: any } | null> {
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: threadId },
    });
    const state = checkpoint?.channel_values as unknown as
      | OverallProposalState
      | undefined;

    const details = await this.getInterruptDetails(threadId); // Relies on deprecated method

    if (!state || !details || !details.contentReference) return null;

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
        if (
          state.sections instanceof Map &&
          state.sections.has(details.contentReference as SectionType)
        ) {
          return {
            reference: details.contentReference,
            content: state.sections.get(
              details.contentReference as SectionType
            ),
          };
        }
        this.logger.warn(
          `Could not find content for reference: ${details.contentReference}`
        );
        return null;
    }
  }
  */

  /**
   * Gets the current state of a proposal
   *
   * @param threadId The thread ID to retrieve state for
   * @returns The current proposal state
   */
  /* DEPRECATED: Direct state retrieval via checkpointer is replaced by LangGraph server APIs.
  async getState(threadId: string): Promise<OverallProposalState> {
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: threadId },
    });
    const state = checkpoint?.channel_values as unknown as
      | OverallProposalState
      | undefined;
    if (!state) {
      throw new Error(`State not found for thread ${threadId}`);
    }
    return state;
  }
  */

  /**
   * Submits user feedback during an interrupt for review of content
   *
   * @param threadId The thread ID for the proposal
   * @param feedback Feedback submission object
   * @returns Status of the feedback submission
   */
  /* DEPRECATED: Feedback submission and graph resumption are managed by the LangGraph server.
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
    const state = await this.getState(threadId); // Relies on deprecated method

    // Verify there is an active interrupt
    if (!state?.interruptStatus?.isInterrupted) {
      throw new Error("Cannot submit feedback when no interrupt is active");
    }

    // Create user feedback object
    const userFeedback: UserFeedback = {
      type: feedbackType,
      comments: comments,
      timestamp: timestamp || new Date().toISOString(),
    };

    // Create updated state with feedback
    const updatedState: OverallProposalState = {
      ...state,
      interruptStatus: {
        ...state.interruptStatus!,
        feedback: {
          type: feedbackType,
          content: comments || null,
          timestamp: userFeedback.timestamp,
        },
        processingStatus: InterruptProcessingStatus.PENDING,
      },
      userFeedback: userFeedback,
    };

    // Prepare checkpoint object for saving
    const config: RunnableConfig = { configurable: { thread_id: threadId } };
    if (!config.configurable?.thread_id) {
      throw new Error(
        "Thread ID is missing in config for submitFeedback checkpoint."
      );
    }
    const checkpointToSave: Checkpoint = {
      v: 1, // Schema version
      id: config.configurable.thread_id, // Use thread_id as checkpoint id
      ts: new Date().toISOString(),
      channel_values: updatedState as any, // Cast as any for now, ensure alignment with StateDefinition later
      channel_versions: {}, // Assuming simple checkpoint structure for now
      versions_seen: {}, // Added missing field
      pending_sends: [], // Added missing field
    };

    // Define the metadata for this external save
    const metadata: CheckpointMetadata = {
      source: "update", // Triggered by external orchestrator update
      step: -1, // Placeholder for external step
      writes: null, // No specific node writes
      parents: {}, // Not a fork
    };

    // Persist the updated state
    await this.checkpointer.put(config, checkpointToSave, metadata, {}); // Pass defined metadata
    this.logger.info(
      `User feedback (${feedbackType}) submitted for thread ${threadId}`
    );

    // Prepare state based on feedback type
    const preparedState = await this.prepareFeedbackForProcessing( // Relies on deprecated method
      threadId,
      feedbackType
    );

    return {
      success: true,
      message: `Feedback (${feedbackType}) processed successfully`,
      status: preparedState.interruptStatus.processingStatus || undefined,
    };
  }
  */

  /**
   * Prepares state for processing based on feedback type
   *
   * @param threadId The thread ID of the proposal
   * @param feedbackType Type of feedback provided
   * @returns State prepared for resumption
   */
  /* DEPRECATED: State preparation for feedback processing is managed by the LangGraph server.
  private async prepareFeedbackForProcessing(
    threadId: string,
    feedbackType: FeedbackType
  ): Promise<OverallProposalState> {
    // Get latest state with feedback incorporated
    const state = await this.getState(threadId); // Relies on deprecated method
    let updatedState: OverallProposalState = { ...state };

    // Get the content reference from interrupt metadata
    const contentRef = state.interruptMetadata?.contentReference;

    switch (feedbackType) {
      case FeedbackType.APPROVE:
        // Mark the relevant content as approved
        updatedState = this.updateContentStatus( // Calls a potentially useful business logic method
          updatedState,
          contentRef,
          ProcessingStatus.APPROVED
        );
        break;

      case FeedbackType.REVISE:
        // Mark the content for revision
        updatedState = this.updateContentStatus( // Calls a potentially useful business logic method
          updatedState,
          contentRef,
          ProcessingStatus.EDITED
        );
        break;

      case FeedbackType.REGENERATE:
        // Mark the content as stale to trigger regeneration
        updatedState = this.updateContentStatus( // Calls a potentially useful business logic method
          updatedState,
          contentRef,
          ProcessingStatus.STALE
        );
        break;
    }

    // Prepare checkpoint object for saving
    const config: RunnableConfig = { configurable: { thread_id: threadId } };
    if (!config.configurable?.thread_id) {
      throw new Error(
        "Thread ID is missing in config for prepareFeedbackForProcessing checkpoint."
      );
    }
    const checkpointToSave: Checkpoint = {
      v: 1, // Schema version
      id: config.configurable.thread_id,
      ts: new Date().toISOString(),
      channel_values: updatedState as any, // Cast as any for now, ensure alignment with StateDefinition later
      channel_versions: {}, // Assuming simple checkpoint structure for now
      versions_seen: {}, // Added missing field
      pending_sends: [], // Added missing field
    };

    // Define the metadata for this external save
    const metadata: CheckpointMetadata = {
      source: "update",
      step: -1,
      writes: null,
      parents: {},
    };

    // Persist the updated state
    await this.checkpointer.put(config, checkpointToSave, metadata, {}); // Pass defined metadata
    return updatedState;
  }
  */

  // BUSINESS LOGIC: This method encapsulates the logic for updating the processing status
  // of specific content types within the proposal state (e.g., research, solution, sections).
  // This logic might be reusable if direct state manipulation for these fields is needed
  // outside the main graph flow, or for adapting to new state structures.
  // It's designed to be immutable.
  private updateContentStatus(
    state: OverallProposalState,
    contentRef?: string,
    status?: ProcessingStatus
  ): OverallProposalState {
    if (!contentRef || !status) {
      return state;
    }

    // Create a new state object to avoid mutation
    let updatedState = { ...state };

    // Update state based on content type
    if (contentRef === "research") {
      updatedState.researchStatus = status;
    } else if (contentRef === "solution") {
      updatedState.solutionStatus = status;
    } else if (contentRef === "connections") {
      updatedState.connectionsStatus = status;
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
              status: status,
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
   * @param threadId The ID of the proposal thread to resume
   * @returns Status object with information about the resume operation
   */
  /* DEPRECATED: Graph resumption is managed by the LangGraph server.
  async resumeAfterFeedback(
    threadId: string
  ): Promise<{ success: boolean; message: string; status?: string }> {
    // Get the current state
    const state = await this.getState(threadId); // Relies on deprecated method

    // Validate the state has feedback that needs processing
    if (!state?.userFeedback) {
      throw new Error("Cannot resume: no user feedback found in state");
    }

    // Check that the processing status is correct
    if (
      state.interruptStatus.processingStatus !==
      InterruptProcessingStatus.PENDING
    ) {
      this.logger.warn(
        `Unexpected processing status when resuming: ${state.interruptStatus.processingStatus}`
      );
    }

    // Prepare LangGraph config with thread_id for execution
    const config: RunnableConfig = { configurable: { thread_id: threadId } };
    if (!config.configurable?.thread_id) {
      throw new Error(
        "Thread ID is missing in config for resumeAfterFeedback."
      );
    }

    try {
      // Cast to CompiledStateGraph to access proper methods
      const compiledGraph = this.graph as CompiledStateGraph< // Relies on deprecated graph property
        OverallProposalState,
        Partial<OverallProposalState>,
        "__start__"
      >;

      this.logger.info(
        `Resuming graph after feedback (${state.userFeedback.type}) for thread ${threadId}`
      );

      // First, update the state with user feedback using updateState
      // This properly registers the feedback in the state without executing a node
      await compiledGraph.updateState(config, {
        interruptStatus: {
          ...state.interruptStatus,
          isInterrupted: false, // Clear interrupt status to allow resumption
          processingStatus: InterruptProcessingStatus.PROCESSED,
        },
        feedbackResult: {
          type: state.userFeedback.type,
          contentReference: state.interruptMetadata?.contentReference,
          timestamp: new Date().toISOString(),
        },
      });

      this.logger.info(`State updated with feedback, resuming execution`);

      // Now resume execution - LangGraph will pick up at the interrupt point and process feedback
      const result = (await compiledGraph.invoke(
        {},
        config
      )) as unknown as OverallProposalState;

      this.logger.info(`Graph resumed successfully for thread ${threadId}`);

      // Check if the resumed execution resulted in another interrupt
      if (result.interruptStatus?.isInterrupted) {
        return {
          success: true,
          message: "Graph execution resumed and reached a new interrupt",
          status: ProcessingStatus.AWAITING_REVIEW, // New interrupt means awaiting review again
        };
      }

      return {
        success: true,
        message: "Graph execution resumed successfully",
        status: result.status,
      };
    } catch (error) {
      this.logger.error(`Error resuming graph: ${error}`);
      throw new Error(`Failed to resume graph execution: ${error}`);
    }
  }
  */

  /**
   * Gets the interrupt status for a specific proposal thread
   *
   * @param threadId The ID of the proposal thread to check
   * @returns Status object with interrupt details
   */
  /* DEPRECATED: Interrupt status checking is managed by the LangGraph server.
  async getInterruptStatus(
    threadId: string
  ): Promise<{ interrupted: boolean; interruptData?: InterruptDetails }> { // InterruptDetails is deprecated
    try {
      // Get current state
      const state = await this.getState(threadId); // Relies on deprecated method

      // Check for interrupts
      const isInterrupted = state?.interruptStatus?.isInterrupted || false;

      // If there's no interrupt, return early
      if (!isInterrupted) {
        return { interrupted: false };
      }

      // Get detailed interrupt information
      const interruptData = await this.getInterruptDetails(threadId); // Relies on deprecated method

      return {
        interrupted: true,
        interruptData: interruptData || undefined,
      };
    } catch (error) {
      this.logger.error(`Error checking interrupt status: ${error}`);
      throw new Error(`Failed to check interrupt status: ${error}`);
    }
  }
  */

  // BUSINESS LOGIC: This method implements the core logic for identifying and marking
  // dependent sections as stale using the DependencyService. This is crucial for
  // maintaining data integrity when sections are edited.
  // NOTE: This method currently relies on `this.saveState()`, which is deprecated.
  // It will require refactoring to use the new LangGraph server's state management APIs for persistence.
  // The `state` parameter is already passed in, which is good.
  async markDependentSectionsAsStale(
    state: OverallProposalState,
    editedSectionId: SectionType
  ): Promise<OverallProposalState> {
    try {
      // Get all sections that depend on the edited section
      const dependentSections =
        this.dependencyService.getAllDependents(editedSectionId);
      this.logger.info(
        `Found ${dependentSections.length} dependent sections for ${editedSectionId}`
      );

      if (dependentSections.length === 0) {
        return state; // No dependent sections, return unchanged state
      }

      // Create a copy of the sections Map
      const sectionsCopy = new Map(state.sections);
      let staleCount = 0;

      // Mark each dependent section as stale if it was previously approved/edited
      dependentSections.forEach((sectionId) => {
        const section = sectionsCopy.get(sectionId);

        if (!section) {
          this.logger.warn(`Dependent section ${sectionId} not found in state`);
          return; // Skip this section
        }

        if (
          section.status === ProcessingStatus.APPROVED ||
          section.status === ProcessingStatus.EDITED
        ) {
          // Store previous status before marking as stale
          sectionsCopy.set(sectionId, {
            ...section,
            status: ProcessingStatus.STALE,
            previousStatus: section.status, // Store previous status for potential fallback
          });
          staleCount++;

          this.logger.info(
            `Marked section ${sectionId} as stale (was ${section.status})`
          );
        }
      });

      this.logger.info(`Marked ${staleCount} dependent sections as stale`);

      // Create updated state with modified sections
      const updatedState = {
        ...state,
        sections: sectionsCopy,
      };

      // Save the updated state
      // await this.saveState(updatedState); // DEPRECATED: Persistence handled by LangGraph server or new mechanism
      this.logger.info(
        "State updated with stale sections, persistence layer needs refactoring."
      );

      return updatedState;
    } catch (error) {
      this.logger.error(
        `Error marking dependent sections as stale: ${(error as Error).message}`
      );
      throw error;
    }
  }

  // BUSINESS LOGIC: Handles user decisions on stale sections (keep or regenerate),
  // updating section status and potentially adding regeneration guidance to messages.
  // This is UI-driven state modification logic.
  // NOTE: This method currently relies on `this.getState()` and `this.saveState()`,
  // which are deprecated. It will require refactoring to fetch state from and persist
  // state to the new LangGraph server's APIs.
  async handleStaleDecision(
    threadId: string,
    sectionId: SectionType,
    decision: "keep" | "regenerate",
    guidance?: string
  ): Promise<OverallProposalState> {
    // Get current state
    // const state = await this.getState(threadId); // DEPRECATED
    // TODO: Refactor to get state from LangGraph server
    throw new Error(
      "handleStaleDecision needs refactoring for state access (getState is deprecated)."
    );
    /*
    // Get the section from the state
    const section = state.sections.get(sectionId);

    if (!section) {
      throw new Error(`Section ${sectionId} not found`);
    }

    if (section.status !== ProcessingStatus.STALE) {
      throw new Error(
        `Cannot handle stale decision for non-stale section ${sectionId}`
      );
    }

    // Create a copy of the sections Map
    const sectionsCopy = new Map(state.sections);
    let updatedMessages = [...state.messages]; // Initialize here for both paths

    if (decision === "keep") {
      // Restore previous status (approved or edited)
      sectionsCopy.set(sectionId, {
        ...section,
        status: section.previousStatus || ProcessingStatus.APPROVED, // Default to APPROVED if no previousStatus
        previousStatus: undefined, // Clear previousStatus
      });

      this.logger.info(
        `Keeping section ${sectionId} with status ${section.previousStatus || ProcessingStatus.APPROVED}`
      );
    } else { // decision === "regenerate"
      // Set to queued for regeneration
      sectionsCopy.set(sectionId, {
        ...section,
        status: ProcessingStatus.QUEUED,
        previousStatus: undefined, // Clear previousStatus
      });

      this.logger.info(`Regenerating section ${sectionId}`);

      if (guidance) {
        const guidanceMessage: BaseMessage = new HumanMessage({
           content: guidance,
           // Langchain HumanMessage doesn't directly support additional_kwargs in constructor in all versions.
           // If needed, this might require a custom message type or different handling.
           // For simplicity, we'll assume content is the primary carrier.
           // additional_kwargs: {
           //   type: "regeneration_guidance",
           //   sectionId: sectionId,
           // },
        });
        // Add custom attributes if necessary after creation, or use a more flexible message structure
        (guidanceMessage as any).additional_kwargs = {
            type: "regeneration_guidance",
            sectionId: sectionId,
        };


        updatedMessages.push(guidanceMessage);

        this.logger.info(
          `Added regeneration guidance for section ${sectionId}`
        );
      }
    }

    // Update state
    const updatedState: OverallProposalState = {
      ...state,
      sections: sectionsCopy,
      messages: updatedMessages,
    };

    // Save the updated state
    // await this.saveState(updatedState); // DEPRECATED
    this.logger.info(
        "State updated for stale decision, persistence layer needs refactoring."
      );


    return updatedState;
    */
  }

  // BUSINESS LOGIC: Queries the state to find all sections currently marked as STALE.
  // This is a direct query on the state's `sections` map.
  // NOTE: This method currently relies on `this.getState()`, which is deprecated.
  // It will require refactoring to fetch state from the new LangGraph server's APIs.
  async getStaleSections(threadId: string): Promise<SectionType[]> {
    // const state = await this.getState(threadId); // DEPRECATED
    // TODO: Refactor to get state from LangGraph server
    throw new Error(
      "getStaleSections needs refactoring for state access (getState is deprecated)."
    );
    /*
    const staleSections: SectionType[] = [];

    state.sections.forEach((section, sectionId) => {
      if (section.status === ProcessingStatus.STALE) {
        staleSections.push(sectionId as SectionType);
      }
    });

    return staleSections;
    */
  }

  /**
   * Helper method to save state via checkpointer
   *
   * @param state The state to save
   */
  /* DEPRECATED: Direct state persistence via checkpointer is replaced by LangGraph server APIs.
  private async saveState(state: OverallProposalState): Promise<void> {
    try {
      // Create config with thread ID
      const config: RunnableConfig = {
        configurable: { thread_id: state.activeThreadId },
      };

      // Create checkpoint object
      const checkpointToSave: Checkpoint = {
        v: 1, // Schema version
        id: state.activeThreadId,
        ts: new Date().toISOString(),
        channel_values: state as any,
        channel_versions: {},
        versions_seen: {},
        pending_sends: [],
      };

      // Define metadata
      const metadata: CheckpointMetadata = {
        source: "update",
        step: -1,
        writes: null,
        parents: {},
      };

      // Persist the state
      await this.checkpointer.put(config, checkpointToSave, metadata, {});
    } catch (error) {
      this.logger.error(`Error saving state: ${(error as Error).message}`);
      throw error;
    }
  }
  */

  // BUSINESS LOGIC: Handles the event of a section being edited. It updates the
  // section's content and status, and then triggers the process to mark dependent
  // sections as stale.
  // NOTE: This method currently relies on `this.getState()` and `this.saveState()`,
  // which are deprecated. It will require refactoring for state access and persistence
  // using the new LangGraph server's APIs. The call to `markDependentSectionsAsStale`
  // also needs consideration for how state is passed and persisted.
  async handleSectionEdit(
    threadId: string,
    editedSectionId: SectionType,
    newContent: string
  ): Promise<OverallProposalState> {
    // Get current state
    // const state = await this.getState(threadId); // DEPRECATED
    // TODO: Refactor to get state from LangGraph server
    throw new Error(
      "handleSectionEdit needs refactoring for state access (getState is deprecated)."
    );
    /*
    // Update the edited section
    const sectionsCopy = new Map(state.sections);
    const section = sectionsCopy.get(editedSectionId);

    if (!section) {
      throw new Error(`Section ${editedSectionId} not found`);
    }

    // Update section with new content and mark as edited
    sectionsCopy.set(editedSectionId, {
      ...section,
      content: newContent,
      status: ProcessingStatus.EDITED,
    });

    // Create updated state
    let updatedState = { // Make it 'let' if markDependentSectionsAsStale modifies it and returns a new one
      ...state,
      sections: sectionsCopy,
    };

    // Save the state (intermediate save before marking dependents)
    // await this.saveState(updatedState); // DEPRECATED
    this.logger.info(
        "State updated after section edit, persistence layer needs refactoring."
      );


    // Mark dependent sections as stale
    // This will internally try to save state again if not refactored.
    updatedState = await this.markDependentSectionsAsStale(updatedState, editedSectionId);
    return updatedState;
    */
  }

  // BUSINESS LOGIC: Initializes a new proposal workflow or retrieves context for an existing one.
  // Key logic includes constructing a composite thread_id using `constructProposalThreadId`
  // and checking for an existing workflow by attempting to retrieve a checkpoint.
  // This is essential for workflow lifecycle management.
  // NOTE: This method uses `this.checkpointer.getTuple()`, a direct checkpointer interaction,
  // which is conceptually deprecated. It needs refactoring to use the LangGraph server's
  // API for checking workflow existence and retrieving initial state.
  async initOrGetProposalWorkflow(
    userId: string,
    rfpId: string
  ): Promise<{
    threadId: string;
    initialState: OverallProposalState | null;
    isNew: boolean;
  }> {
    const threadId = constructProposalThreadId(userId, rfpId);
    this.logger.info(
      `[OrchestratorService] Initializing or getting workflow for threadId: ${threadId}`
    );

    try {
      // const checkpointTuple = (await this.checkpointer.getTuple({ // DEPRECATED checkpointer interaction
      //   configurable: { thread_id: threadId },
      // })) as CheckpointTuple | null | undefined;
      // TODO: Refactor to use LangGraph server API to check for existing workflow/state.
      // For now, assume it's always new or throw error, as checkpointer is deprecated.
      this.logger.warn(
        `[OrchestratorService] Checkpointer interaction in initOrGetProposalWorkflow is deprecated. Assuming new workflow for ${threadId} or needs refactoring.`
      );
      // Placeholder logic:
      const isNewWorkflow = true; // Simulate or throw
      if (isNewWorkflow) {
        this.logger.info(
          `[OrchestratorService] (Refactor Pending) No existing checkpoint for threadId: ${threadId}. New workflow.`
        );
        return {
          threadId,
          initialState: null,
          isNew: true,
        };
      } else {
        // This path would require fetching state via new API
        throw new Error(
          "Existing workflow retrieval in initOrGetProposalWorkflow needs refactoring."
        );
        // this.logger.info(
        //   `[OrchestratorService] (Refactor Pending) Existing checkpoint found for threadId: ${threadId}.`
        // );
        // return {
        //   threadId,
        //   initialState: checkpointTuple.checkpoint
        //     .channel_values as unknown as OverallProposalState,
        //   isNew: false,
        // };
      }
    } catch (error) {
      this.logger.error(
        `[OrchestratorService] Error in initOrGetProposalWorkflow for threadId ${threadId}:`,
        error
      );
      throw error;
    }
  }

  // BUSINESS LOGIC: Defines the initial state structure for a new proposal workflow.
  // This includes setting up initial messages, RFP document placeholders, default statuses,
  // and other essential fields. This initial state definition is critical.
  // NOTE: The graph invocation and subsequent checkpoint retrieval parts of this method
  // are deprecated as the LangGraph server will handle graph execution.
  // The `initialState` object itself remains valuable. This method will need to be
  // refactored to potentially just return this initial state, or to integrate with
  // the new LangGraph server's workflow initiation process.
  async startProposalGeneration(
    threadId: string,
    userId: string,
    rfpId: string
  ): Promise<{
    state: OverallProposalState;
  }> {
    this.logger.info(
      `[OrchestratorService] Defining initial state for new proposal generation for threadId: ${threadId}, RFP ID: ${rfpId}, User ID: ${userId}`
    );

    const initialContent = `System Task: Load RFP document with ID ${rfpId}`;
    const initialMessages: BaseMessage[] = [
      new HumanMessage({ content: initialContent }),
    ];

    // THIS IS THE KEY BUSINESS LOGIC TO PRESERVE: The definition of initialState
    const initialState: OverallProposalState = {
      messages: initialMessages,
      rfpDocument: {
        id: rfpId,
        text: undefined,
        status: LoadingStatus.NOT_STARTED,
        fileName: undefined,
        metadata: undefined,
      },
      intent: {
        command: undefined,
        request_details: undefined,
      },
      researchResults: {
        queries: [],
        results: [],
        status: LoadingStatus.NOT_STARTED,
      },
      researchStatus: ProcessingStatus.NOT_STARTED,
      solutionResults: {
        solution: null,
        status: LoadingStatus.NOT_STARTED,
      },
      solutionStatus: ProcessingStatus.NOT_STARTED,
      connections: [],
      connectionsStatus: ProcessingStatus.NOT_STARTED,
      sections: new Map(),
      requiredSections: [],
      status: ProcessingStatus.RUNNING, // Initial status might be PENDING_START or similar
      currentStep: "workflow_initiation",
      interruptStatus: {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      },
      interruptMetadata: undefined,
      userFeedback: undefined,
      errors: [],
      userId: userId,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      activeThreadId: threadId,
      projectName: undefined,
      researchEvaluation: undefined,
      solutionEvaluation: undefined,
      connectionsEvaluation: undefined,
      sectionToolMessages: undefined,
      funder: undefined,
      applicant: undefined,
      wordLength: undefined,
    };

    this.logger.debug(
      `[OrchestratorService] Defined initial state:`,
      JSON.stringify(initialState, null, 2)
    );

    /* DEPRECATED: Graph invocation and state retrieval now handled by LangGraph server
    const runnableConfig: RunnableConfig = {
      configurable: {
        thread_id: threadId,
      },
      recursionLimit: 100,
    };

    this.logger.info(
      `[OrchestratorService] Invoking graph for new workflow. Thread ID: ${threadId}`
    );

    await (
      this.graph as CompiledStateGraph< // Relies on deprecated graph property
        OverallProposalState,
        Partial<OverallProposalState>
      >
    ).invoke(initialState, runnableConfig);

    this.logger.info(
      `[OrchestratorService] Graph invoked. Fetching resulting checkpoint for thread ID: ${threadId}`
    );

    const checkpoint = await this.checkpointer.get({ // Relies on deprecated checkpointer property
      configurable: { thread_id: threadId },
    });

    if (!checkpoint || !checkpoint.channel_values) {
      this.logger.error(
        `[OrchestratorService] Failed to retrieve checkpoint after initial graph invocation for threadId: ${threadId}`
      );
      throw new Error(
        `Failed to retrieve state after initial graph invocation for threadId: ${threadId}`
      );
    }

    this.logger.info(
      `[OrchestratorService] Successfully started and checkpointed new workflow for threadId: ${threadId}`
    );

    return {
      state: checkpoint.channel_values as unknown as OverallProposalState,
    };
    */

    // TODO: This method should likely now return the `initialState` to be passed to the
    // LangGraph server's API for starting a new workflow, or be removed if the
    // LangGraph client handles initial state construction.
    this.logger.info(
      `[OrchestratorService] Initial state constructed for threadId: ${threadId}. Graph invocation and persistence are now external.`
    );
    return { state: initialState };
  }

  /**
   * Adds a user message to the conversation
   *
   * @param threadId The thread ID for the proposal
   * @param message The user message
   * @returns Updated state with added message
   */
  /* DEPRECATED: Adding messages and invoking graph is managed by the LangGraph server.
  async addUserMessage(
    threadId: string,
    message: string
  ): Promise<OverallProposalState> {
    // Get current state
    const state = await this.getState(threadId); // Relies on deprecated method

    // Create the human message
    const humanMessage = new HumanMessage(message);

    // Update state with new message
    const config: RunnableConfig = { configurable: { thread_id: threadId } };

    // Cast to CompiledStateGraph to access proper methods
    const compiledGraph = this.graph as CompiledStateGraph< // Relies on deprecated graph property
      OverallProposalState,
      Partial<OverallProposalState>,
      "__start__"
    >;

    // Update state with the new message
    await compiledGraph.updateState(config, {
      messages: [humanMessage], // This appends if messages is an accumulator, replaces if not. Check graph logic.
    });

    // Now invoke the graph to process the message
    const result = (await compiledGraph.invoke(
      {}, // Assumes graph picks up state from checkpointer or updated state
      config
    )) as unknown as OverallProposalState;

    return result;
  }
  */

  /**
   * Processes a chat message and returns the response
   *
   * @param threadId The thread ID for the proposal
   * @param message The user message
   * @returns The AI response
   */
  // DEPRECATED: Chat processing, including message handling and graph invocation,
  // is now managed by the LangGraph server.
  // BUSINESS LOGIC NOTE: The concept of `passiveIntents` (e.g., ["ask_question", "help", "other"])
  // for determining if a command was truly "executed" vs. just a query might be useful
  // in interpreting responses or UI behavior elsewhere.
  /*
  async processChatMessage(
    threadId: string,
    message: string
  ): Promise<{ response: string; commandExecuted: boolean }> {
    try {
      // Add the message and process through the graph
      const updatedState = await this.addUserMessage(threadId, message); // Relies on deprecated method

      // Check if a command was executed (intent present and not a passive query)
      const passiveIntents = ["ask_question", "help", "other"] as string[];

      const commandExecuted =
        updatedState.intent?.command !== undefined &&
        !passiveIntents.includes(updatedState.intent.command);

      // Get the AI response from the last message
      const messages = updatedState.messages || [];
      const lastMessage = messages[messages.length - 1];

      if (lastMessage instanceof AIMessage) {
        return {
          response: lastMessage.content.toString(),
          commandExecuted,
        };
      }

      return {
        response: "I'm not sure how to respond to that.",
        commandExecuted: false, // Or based on intent if no AIMessage
      };
    } catch (error) {
      this.logger.error(`Error processing chat message: ${error}`);
      throw error;
    }
  }
  */
}
