/**
 * Process Feedback Node
 *
 * Processes user feedback from HITL interruptions and updates state accordingly.
 * This node handles approval, revision requests, and content edits from users.
 */
import { OverallProposalStateAnnotation } from "../../../state/modules/annotations.js";
import {
  ProcessingStatus,
  InterruptProcessingStatus,
  FeedbackType,
} from "../../../state/modules/constants.js";
import { HumanMessage } from "@langchain/core/messages";

/**
 * Interface for user feedback structure
 */
export interface UserFeedback {
  type: FeedbackType | string;
  comments: string;
  editedContent?: string;
  customInstructions?: string;
}

/**
 * Interface for transient routing information
 * This isn't stored in state but used for routing decision
 */
interface TransientRoutingInfo {
  feedbackDestination: string;
}

/**
 * Processes user feedback and updates state accordingly
 *
 * @param state Current proposal state
 * @returns Updated state with processed feedback and cleared interrupt status
 */
export async function processFeedbackNode(
  state: typeof OverallProposalStateAnnotation.State
): Promise<
  Partial<typeof OverallProposalStateAnnotation.State> & TransientRoutingInfo
> {
  // If no feedback is present, just return state unchanged
  if (!state.userFeedback) {
    return { feedbackDestination: "continue" };
  }

  const { interruptStatus, interruptMetadata } = state;
  const { type, comments, editedContent, customInstructions } =
    state.userFeedback;

  // Add feedback to messages for context preservation
  const messages = [...(state.messages || [])];
  messages.push(
    new HumanMessage(
      `Feedback: ${comments}${customInstructions ? `\nInstructions: ${customInstructions}` : ""}`
    )
  );

  // Base state updates - always clear interrupt status and add messages
  const stateUpdates: Partial<typeof OverallProposalStateAnnotation.State> &
    TransientRoutingInfo = {
    messages,
    interruptStatus: {
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: InterruptProcessingStatus.PROCESSED,
    },
    // Clear user feedback to prevent reprocessing
    userFeedback: null,
    // Default destination
    feedbackDestination: "continue",
  };

  // Determine feedback destination based on metadata
  if (interruptMetadata) {
    const { contentType, sectionType } = interruptMetadata;

    // For approve feedback, we usually continue to next step
    if (type === FeedbackType.APPROVE || type === "approve") {
      stateUpdates.feedbackDestination = "continue";
    }
    // For revise or edit feedback, route back to the appropriate node
    else if (
      (type === FeedbackType.REVISE ||
        type === "revise" ||
        type === FeedbackType.EDIT ||
        type === "edit") &&
      (contentType || sectionType)
    ) {
      // Route based on content type
      if (contentType === "research") {
        stateUpdates.feedbackDestination = "research";
        // Mark research for regeneration
        stateUpdates.researchStatus = ProcessingStatus.QUEUED;
      } else if (contentType === "solution") {
        stateUpdates.feedbackDestination = "solution_content";
        // Mark solution for regeneration
        stateUpdates.solutionStatus = ProcessingStatus.QUEUED;
      } else if (contentType === "connections") {
        stateUpdates.feedbackDestination = "connections";
        // Mark connections for regeneration
        stateUpdates.connectionsStatus = ProcessingStatus.QUEUED;
      }
      // If it's a section, use the section type as destination
      else if (sectionType) {
        stateUpdates.feedbackDestination = sectionType;

        // Update the section status if it exists
        if (state.sections) {
          const sections = new Map(state.sections);
          const section = sections.get(sectionType);

          if (section) {
            // If user provided edited content, update it
            if (type === FeedbackType.EDIT && editedContent) {
              sections.set(sectionType, {
                ...section,
                content: editedContent,
                status: ProcessingStatus.QUEUED,
                feedback: comments,
                customInstructions,
              });
            } else {
              // Just mark for regeneration
              sections.set(sectionType, {
                ...section,
                status: ProcessingStatus.QUEUED,
                feedback: comments,
                customInstructions,
              });
            }

            stateUpdates.sections = sections;
          }
        }
      }
    }
  }

  // Add timestamp of processing to the state
  stateUpdates.lastUpdatedAt = new Date().toISOString();

  return stateUpdates;
}
