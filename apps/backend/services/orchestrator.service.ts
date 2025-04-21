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

import {
  StateGraph,
  CompiledStateGraph,
  Checkpoint,
  CheckpointMetadata,
} from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";
import { BaseMessage } from "@langchain/core/messages";
import {
  OverallProposalState,
  InterruptStatus,
  InterruptMetadata,
  UserFeedback,
  SectionType,
  SectionProcessingStatus,
} from "../state/modules/types.js";
import { FeedbackType } from "../lib/types/feedback.js";
import { BaseCheckpointSaver } from "@langchain/langgraph";
import { Logger, LogLevel } from "../lib/logger.js";
import { v4 as uuidv4 } from "uuid";
import {
  ProcessingStatus,
  InterruptProcessingStatus,
  LoadingStatus,
} from "../state/modules/constants.js";
import { DependencyService } from "./DependencyService.js"; // Import the DependencyService

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
  private dependencyService: DependencyService; // Add DependencyService

  /**
   * Creates a new OrchestratorService
   *
   * @param graph The ProposalGenerationGraph instance (compiled or uncompiled)
   * @param checkpointer The checkpointer for state persistence
   */
  constructor(
    graph: AnyStateGraph,
    checkpointer: BaseCheckpointSaver,
    dependencyMapPath?: string // Optional path to dependency map
  ) {
    this.graph = graph;
    this.checkpointer = checkpointer;
    this.logger = Logger.getInstance();
    this.dependencyService = new DependencyService(dependencyMapPath); // Initialize DependencyService

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
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: threadId },
    });
    const state = checkpoint?.channel_values as
      | OverallProposalState
      | undefined;

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
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: threadId },
    });
    const state = checkpoint?.channel_values as
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

  /**
   * Extracts detailed information about the current interrupt
   *
   * @param threadId The thread ID to check
   * @returns Interrupt details or null if no interrupt
   */
  async getInterruptDetails(
    threadId: string
  ): Promise<InterruptDetails | null> {
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: threadId },
    });
    const state = checkpoint?.channel_values as
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

  /**
   * Gets the content being evaluated in the current interrupt
   *
   * @param threadId The thread ID to check
   * @returns The content reference and actual content
   */
  async getInterruptContent(
    threadId: string
  ): Promise<{ reference: string; content: any } | null> {
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: threadId },
    });
    const state = checkpoint?.channel_values as
      | OverallProposalState
      | undefined;

    const details = await this.getInterruptDetails(threadId);

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

  /**
   * Gets the current state of a proposal
   *
   * @param threadId The thread ID to retrieve state for
   * @returns The current proposal state
   */
  async getState(threadId: string): Promise<OverallProposalState> {
    const checkpoint = await this.checkpointer.get({
      configurable: { thread_id: threadId },
    });
    const state = checkpoint?.channel_values as
      | OverallProposalState
      | undefined;
    if (!state) {
      throw new Error(`State not found for thread ${threadId}`);
    }
    return state;
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
    const preparedState = await this.prepareFeedbackForProcessing(
      threadId,
      feedbackType
    );

    return {
      success: true,
      message: `Feedback (${feedbackType}) processed successfully`,
      status: preparedState.interruptStatus.processingStatus || undefined,
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
          ProcessingStatus.APPROVED
        );
        break;

      case FeedbackType.REVISE:
        // Mark the content for revision
        updatedState = this.updateContentStatus(
          updatedState,
          contentRef,
          ProcessingStatus.EDITED
        );
        break;

      case FeedbackType.REGENERATE:
        // Mark the content as stale to trigger regeneration
        updatedState = this.updateContentStatus(
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
    if (
      state.interruptStatus.processingStatus !==
      InterruptProcessingStatus.PENDING
    ) {
      this.logger.warn(
        `Unexpected processing status when resuming: ${state.interruptStatus.processingStatus}`
      );
    }

    // Prepare LangGraph config with thread_id for execution
    const config: RunnableConfig = { configurable: { thread_id: proposalId } };
    if (!config.configurable?.thread_id) {
      throw new Error(
        "Thread ID is missing in config for resumeAfterFeedback."
      );
    }

    try {
      // Cast to CompiledStateGraph to access proper methods
      const compiledGraph = this.graph as CompiledStateGraph<
        OverallProposalState,
        Partial<OverallProposalState>,
        "__start__"
      >;

      this.logger.info(
        `Resuming graph after feedback (${state.userFeedback.type}) for thread ${proposalId}`
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
      const result = await compiledGraph.invoke({}, config);

      this.logger.info(`Graph resumed successfully for thread ${proposalId}`);

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

  /**
   * Mark dependent sections as stale after a section has been edited
   * This implements the dependency chain management from AGENT_ARCHITECTURE.md
   *
   * @param state The current proposal state
   * @param editedSectionId The section that was edited
   * @returns Updated state with stale sections
   */
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
      await this.saveState(updatedState);

      return updatedState;
    } catch (error) {
      this.logger.error(
        `Error marking dependent sections as stale: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Handle stale section decision (keep or regenerate)
   *
   * @param threadId The thread ID
   * @param sectionId The section ID to handle
   * @param decision Keep or regenerate the stale section
   * @param guidance Optional guidance for regeneration
   * @returns Updated state
   */
  async handleStaleDecision(
    threadId: string,
    sectionId: SectionType,
    decision: "keep" | "regenerate",
    guidance?: string
  ): Promise<OverallProposalState> {
    // Get current state
    const state = await this.getState(threadId);

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

      // Update state
      const updatedState = {
        ...state,
        sections: sectionsCopy,
      };

      // Save the updated state
      await this.saveState(updatedState);

      return updatedState;
    } else {
      // Set to queued for regeneration
      sectionsCopy.set(sectionId, {
        ...section,
        status: ProcessingStatus.QUEUED,
        previousStatus: undefined, // Clear previousStatus
      });

      this.logger.info(`Regenerating section ${sectionId}`);

      // Update messages with guidance if provided
      let updatedMessages = [...state.messages];

      if (guidance) {
        // Create a properly formatted message that matches BaseMessage structure
        const guidanceMessage = {
          content: guidance,
          additional_kwargs: {
            type: "regeneration_guidance",
            sectionId: sectionId,
          },
          name: undefined,
          id: [],
          type: "human",
          example: false,
        };

        updatedMessages.push(guidanceMessage as unknown as BaseMessage);

        this.logger.info(
          `Added regeneration guidance for section ${sectionId}`
        );
      }

      // Update state
      const updatedState = {
        ...state,
        sections: sectionsCopy,
        messages: updatedMessages,
      };

      // Save the updated state
      await this.saveState(updatedState);

      return updatedState;
    }
  }

  /**
   * Get all stale sections in the proposal
   *
   * @param threadId The thread ID
   * @returns Array of stale section IDs
   */
  async getStaleSections(threadId: string): Promise<SectionType[]> {
    const state = await this.getState(threadId);
    const staleSections: SectionType[] = [];

    state.sections.forEach((section, sectionId) => {
      if (section.status === ProcessingStatus.STALE) {
        staleSections.push(sectionId as SectionType);
      }
    });

    return staleSections;
  }

  /**
   * Helper method to save state via checkpointer
   *
   * @param state The state to save
   */
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

  /**
   * After editing a section, mark dependent sections as stale
   *
   * @param threadId The thread ID
   * @param editedSectionId The section that was edited
   * @returns Updated state with stale sections
   */
  async handleSectionEdit(
    threadId: string,
    editedSectionId: SectionType,
    newContent: string
  ): Promise<OverallProposalState> {
    // Get current state
    const state = await this.getState(threadId);

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
    const updatedState = {
      ...state,
      sections: sectionsCopy,
    };

    // Save the state
    await this.saveState(updatedState);

    // Mark dependent sections as stale
    return this.markDependentSectionsAsStale(updatedState, editedSectionId);
  }

  /**
   * Starts a new proposal generation process
   *
   * @param rfpData Either a string with the RFP content or an object with structured RFP data
   * @param userId Optional user ID for multi-tenant isolation
   * @returns Object containing the threadId and initial state
   */
  async startProposalGeneration(
    rfpData:
      | string
      | { text: string; fileName?: string; metadata?: Record<string, any> },
    userId?: string
  ): Promise<{ threadId: string; state: OverallProposalState }> {
    const threadId = uuidv4();
    const logger = this.logger.child({ threadId });

    logger.info("Starting proposal generation with RFP data", {
      dataType: typeof rfpData === "string" ? "string" : "structured",
      userId,
    });

    // Create initial state with proper enum values
    const initialState: OverallProposalState = {
      rfpDocument: {
        id: uuidv4(),
        ...(typeof rfpData === "string" ? { text: rfpData } : { ...rfpData }),
        status: LoadingStatus.LOADED, // Use enum value
      },
      researchResults: {},
      researchStatus: ProcessingStatus.NOT_STARTED, // Use enum value
      solutionResults: {},
      solutionStatus: ProcessingStatus.NOT_STARTED, // Use enum value
      connectionsStatus: ProcessingStatus.NOT_STARTED, // Use enum value
      sections: new Map(),
      requiredSections: [],
      interruptStatus: {
        isInterrupted: false,
        interruptionPoint: null,
        feedback: null,
        processingStatus: null,
      },
      currentStep: null,
      activeThreadId: threadId,
      messages: [],
      errors: [],
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      status: ProcessingStatus.NOT_STARTED, // Use enum value
    };

    if (userId) {
      initialState.userId = userId;
    }

    // Create a checkpoint for the initial state
    const checkpoint: Checkpoint = {
      state: initialState,
      edges: {},
      config: {},
    };

    const metadata: CheckpointMetadata = {
      source: "orchestrator",
      step: "initializeState",
      writes: 1,
      parents: [],
    };

    // Persist the initial state
    try {
      await this.checkpointer.put(threadId, checkpoint, metadata);
      logger.info("Persisted initial state", { threadId });
    } catch (error) {
      logger.error("Failed to persist initial state", {
        error: (error as Error).message,
        threadId,
      });
      throw error;
    }

    // Start the graph execution
    try {
      const stream = await this.graph.runStreamed({
        configurable: {
          thread_id: threadId,
        },
      });

      for await (const _chunk of stream) {
        // We're not using the streaming output here, just making sure the execution starts
      }

      logger.info("Started graph execution", { threadId });

      // Return the thread ID and initial state
      return { threadId, state: initialState };
    } catch (error) {
      logger.error("Failed to start graph execution", {
        error: (error as Error).message,
        threadId,
      });
      throw error;
    }
  }
}
