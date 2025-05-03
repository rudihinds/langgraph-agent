/**
 * Calculate proposal progress based on sections or overall proposal data
 * @param proposal Proposal object or section status record
 * @returns Percentage of completion (0-100)
 */
export function calculateProgress(proposal: any): number {
  // Handle case where proposal is a Record<string, string> (section status map)
  if (proposal && typeof proposal === "object" && !Array.isArray(proposal)) {
    // Case 1: If it has a sections property (database proposal object)
    if (proposal.sections && typeof proposal.sections === "object") {
      const sectionStatuses = Object.values(proposal.sections);
      const totalSections = sectionStatuses.length;

      if (totalSections === 0) return 0;

      const completedSections = sectionStatuses.filter(
        (section: any) => section.status === "completed"
      ).length;

      const inProgressSections = sectionStatuses.filter(
        (section: any) => section.status === "in_progress"
      ).length;

      // Completed sections count fully, in progress ones count as half-completed
      const progress =
        (completedSections + inProgressSections * 0.5) / totalSections;

      return Math.round(progress * 100);
    }

    // Case 2: If it has a status property (database proposal object without sections)
    if (proposal.status) {
      switch (proposal.status) {
        case "completed":
          return 100;
        case "submitted":
          return 100;
        case "in_progress":
          return 50;
        case "draft":
        default:
          return 25;
      }
    }

    // Case 3: It's a sectionStatus map (original implementation)
    if (Object.keys(proposal).length === 0) {
      return 0;
    }

    const sections = Object.values(proposal);
    const totalSections = sections.length;

    if (totalSections === 0) return 0;

    const completedSections = sections.filter(
      (status) => status === "completed"
    ).length;

    const inProgressSections = sections.filter(
      (status) => status === "in_progress"
    ).length;

    // Completed sections count fully, in progress ones count as half-completed
    const progress =
      (completedSections + inProgressSections * 0.5) / totalSections;

    return Math.round(progress * 100);
  }

  // Default case: Return 0 for null, undefined, or non-object values
  return 0;
}
