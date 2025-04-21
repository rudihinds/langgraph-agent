/**
 * Routes graph execution after processing user feedback
 *
 * @param {object} state - The current state
 * @returns {string} The next node destination key based on feedback
 */
export function routeAfterFeedback(state) {
  // First priority: check for explicit routing destination
  if (state.feedbackDestination) {
    return state.feedbackDestination;
  }

  // If no destination is explicitly set, check feedback type
  if (state.userFeedback && state.interruptMetadata) {
    const { type } = state.userFeedback;
    const { contentType, sectionType } = state.interruptMetadata;

    // If feedback is "approve", continue to next section
    if (type === "approve") {
      return "continue";
    }

    // If feedback is "revise", route to appropriate generation node
    if (type === "revise" || type === "edit") {
      // Route based on what content needs revision
      if (contentType === "research") return "research";
      if (contentType === "solution_content") return "solution_content";
      if (contentType === "connections") return "connections";

      // If it's a section, route to the appropriate section node
      if (sectionType) {
        return sectionType;
      }
    }
  }

  // Default: continue to next section if we can't determine a specific route
  return "continue";
}
