/**
 * Calculate proposal progress based on section statuses
 * @param sectionStatus Record of section IDs to their statuses
 * @returns Percentage of completion (0-100)
 */
export function calculateProgress(
  sectionStatus: Record<string, string>
): number {
  if (!sectionStatus || Object.keys(sectionStatus).length === 0) {
    return 0;
  }

  const sections = Object.values(sectionStatus);
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
