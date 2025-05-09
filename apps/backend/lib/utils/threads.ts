/**
 * Generates a composite thread ID for proposal workflows.
 * This ID is used directly with the LangGraph checkpointer.
 *
 * @param userId - The ID of the user.
 * @param rfpId - The ID of the RFP document or proposal.
 * @returns A string representing the composite thread ID.
 * @throws Error if userId or rfpId is missing.
 */
export function constructProposalThreadId(
  userId: string,
  rfpId: string
): string {
  if (!userId || !rfpId) {
    throw new Error("User ID and RFP ID are required to construct a thread ID");
  }
  // Using '::' as a delimiter that is less common in typical IDs.
  // 'proposal' suffix provides a namespace for this type of thread.
  return `user-${userId}::rfp-${rfpId}::proposal`;
}

/**
 * Parses a composite thread ID to extract user ID and RFP ID.
 *
 * @param threadId - The composite thread ID string.
 * @returns An object containing userId and rfpId, or null if parsing fails.
 */
export function parseProposalThreadId(
  threadId: string
): { userId: string; rfpId: string } | null {
  if (!threadId) {
    return null;
  }
  const parts = threadId.split("::");
  if (
    parts.length === 3 &&
    parts[0].startsWith("user-") &&
    parts[1].startsWith("rfp-") &&
    parts[2] === "proposal"
  ) {
    const userId = parts[0].substring(5); // Length of "user-"
    const rfpId = parts[1].substring(4); // Length of "rfp-"
    if (userId && rfpId) {
      return {
        userId,
        rfpId,
      };
    }
  }
  console.warn(`[parseProposalThreadId] Failed to parse threadId: ${threadId}`);
  return null;
}
