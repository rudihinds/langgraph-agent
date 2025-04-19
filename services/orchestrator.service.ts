import { BaseCheckpointSaver } from "@langchain/langgraph/checkpoint";
import { OverallProposalState } from "../state/proposal.state";
import dependencyMap, { getDependencyMap } from "../config/dependencies";

// Types for feedback handling
type EvaluationFeedback = {
  action: "approve" | "revise";
  contentType: string;
  sectionId?: string;
  revisionGuidance?: string;
  comments?: string;
};

type StaleDecision = {
  action: "regenerate" | "keep";
  contentType: string;
  sectionId: string;
  regenerationGuidance?: string;
  comments?: string;
};

type ContentEdit = {
  contentType: string;
  sectionId: string;
  content: string;
};

/**
 * Orchestrator service for managing proposal generation
 */
export class OrchestratorService {
  private checkpointer: BaseCheckpointSaver;
  private graphExecutor: any; // Replace with proper type when available

  constructor(checkpointer: BaseCheckpointSaver, graphExecutor: any) {
    this.checkpointer = checkpointer;
    this.graphExecutor = graphExecutor;
  }

  /**
   * Handles user feedback for evaluation results
   *
   * @param threadId The ID of the thread to update
   * @param feedback The user feedback for the evaluation
   * @returns The updated state after handling feedback
   */
  async handleEvaluationFeedback(
    threadId: string,
    feedback: EvaluationFeedback
  ): Promise<OverallProposalState> {
    // Get the current state
    const state = await this.checkpointer.get(threadId);

    // Create a deep copy of state to avoid mutating the original
    const newState = JSON.parse(JSON.stringify(state)) as OverallProposalState;

    // Determine which part of the state to update
    let contentToUpdate;
    if (feedback.contentType === "connection_pairs") {
      contentToUpdate = newState.connections;
    } else if (
      feedback.contentType === "section" ||
      feedback.contentType === "research" ||
      feedback.contentType === "solution"
    ) {
      const sectionId = feedback.sectionId || feedback.contentType;
      contentToUpdate = newState.sections.get(sectionId);
    }

    if (!contentToUpdate) {
      throw new Error(
        `Cannot find content of type ${feedback.contentType} ${feedback.sectionId ? `with ID ${feedback.sectionId}` : ""}`
      );
    }

    // Update content status based on feedback action
    if (feedback.action === "approve") {
      contentToUpdate.status = "approved";
    } else if (feedback.action === "revise") {
      contentToUpdate.status = "revision_requested";
    }

    // Add message to state for the agent
    newState.messages = newState.messages || [];

    const message = {
      role: "user",
      content:
        feedback.comments ||
        feedback.revisionGuidance ||
        (feedback.action === "approve"
          ? "The evaluation results have been approved."
          : "Please revise based on the evaluation results."),
      metadata: {
        contentType: feedback.contentType,
        sectionId: feedback.sectionId,
        action: feedback.action,
        timestamp: new Date().toISOString(),
      },
    };

    newState.messages.push(message);

    // Clear interrupt status and metadata
    newState.interruptStatus = null;
    newState.interruptMetadata = null;

    // Save the updated state
    await this.checkpointer.put(threadId, newState);

    // Resume the graph execution
    await this.graphExecutor.resume(threadId);

    return newState;
  }

  /**
   * Handles content edits and marks dependent sections as stale
   *
   * @param threadId The ID of the thread to update
   * @param editData The content edit data
   * @returns The updated state after applying edits
   */
  async handleContentEdit(
    threadId: string,
    editData: ContentEdit
  ): Promise<OverallProposalState> {
    // Get the current state
    const state = await this.checkpointer.get(threadId);

    // Create a deep copy of state to avoid mutating the original
    const newState = JSON.parse(JSON.stringify(state)) as OverallProposalState;

    // Determine the section ID
    const sectionId = editData.sectionId;

    // Update the content
    if (editData.contentType === "connection_pairs") {
      if (!newState.connections) {
        newState.connections = {};
      }
      newState.connections.content = editData.content;
      newState.connections.status = "edited";
    } else {
      const sectionsCopy = new Map(newState.sections);
      if (!sectionsCopy.has(sectionId)) {
        sectionsCopy.set(sectionId, {});
      }
      const section = sectionsCopy.get(sectionId);
      sectionsCopy.set(sectionId, {
        ...section,
        content: editData.content,
        status: "edited",
      });
      newState.sections = sectionsCopy;
    }

    // Mark dependent sections as stale
    this.markDependentSectionsAsStale(newState, sectionId);

    // Add message to state for the edit
    newState.messages = newState.messages || [];
    newState.messages.push({
      role: "user",
      content: `Content for ${sectionId} has been edited.`,
      metadata: {
        contentType: editData.contentType,
        sectionId: sectionId,
        action: "edit",
        timestamp: new Date().toISOString(),
      },
    });

    // Save the updated state
    await this.checkpointer.put(threadId, newState);

    return newState;
  }

  /**
   * Handles user decision for stale content (keep or regenerate)
   *
   * @param threadId The ID of the thread to update
   * @param decision The user decision for stale content
   * @returns The updated state after handling the decision
   */
  async handleStaleDecision(
    threadId: string,
    decision: StaleDecision
  ): Promise<OverallProposalState> {
    // Get the current state
    const state = await this.checkpointer.get(threadId);

    // Create a deep copy of state to avoid mutating the original
    const newState = JSON.parse(JSON.stringify(state)) as OverallProposalState;

    // Determine which part of the state to update
    let contentToUpdate;
    if (decision.contentType === "connection_pairs") {
      contentToUpdate = newState.connections;
    } else {
      contentToUpdate = newState.sections.get(decision.sectionId);
    }

    if (!contentToUpdate) {
      throw new Error(
        `Cannot find content of type ${decision.contentType} with ID ${decision.sectionId}`
      );
    }

    // Update content status based on decision
    if (decision.action === "regenerate") {
      contentToUpdate.status = "queued";

      // Add regeneration guidance message if provided
      if (decision.regenerationGuidance) {
        newState.messages = newState.messages || [];
        newState.messages.push({
          role: "user",
          content: decision.regenerationGuidance,
          metadata: {
            contentType: decision.contentType,
            sectionId: decision.sectionId,
            action: "regenerate",
            timestamp: new Date().toISOString(),
          },
        });
      }
    } else if (decision.action === "keep") {
      contentToUpdate.status = "approved";

      // Add message for keeping content if comments provided
      if (decision.comments) {
        newState.messages = newState.messages || [];
        newState.messages.push({
          role: "user",
          content: decision.comments,
          metadata: {
            contentType: decision.contentType,
            sectionId: decision.sectionId,
            action: "keep",
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    // Save the updated state
    await this.checkpointer.put(threadId, newState);

    // Resume the graph execution
    await this.graphExecutor.resume(threadId);

    return newState;
  }

  /**
   * Marks sections dependent on the edited section as stale
   *
   * @param state The state to update
   * @param editedSectionId The ID of the edited section
   * @private
   */
  private markDependentSectionsAsStale(
    state: OverallProposalState,
    editedSectionId: string
  ): void {
    const dependencies = getDependencyMap();
    const sectionsToProcess = [editedSectionId];
    const processedSections = new Set<string>();

    // Process sections in a breadth-first manner to find all dependent sections
    while (sectionsToProcess.length > 0) {
      const currentSection = sectionsToProcess.shift()!;

      if (processedSections.has(currentSection)) {
        continue;
      }

      processedSections.add(currentSection);

      // Find all sections that depend on the current section
      Object.entries(dependencies).forEach(([section, deps]) => {
        if (
          deps.includes(currentSection) &&
          !processedSections.has(section) &&
          section !== editedSectionId
        ) {
          // If the section is approved, mark it as stale
          const sectionData = state.sections.get(section);
          if (sectionData?.status === "approved") {
            const sectionsCopy = new Map(state.sections);
            sectionsCopy.set(section, {
              ...sectionData,
              status: "stale",
            });
            state.sections = sectionsCopy;
          }

          // Add the section to process its dependents
          sectionsToProcess.push(section);
        }
      });
    }
  }
}
