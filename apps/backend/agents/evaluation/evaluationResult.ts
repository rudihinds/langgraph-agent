import { z } from "zod";

/**
 * Schema for individual criterion score
 */
export const criterionScoreSchema = z
  .number()
  .min(0, "Score must be at least 0")
  .max(1, "Score must be at most 1");

/**
 * Schema for evaluation results, enforcing the required structure
 */
export const evaluationResultSchema = z.object({
  passed: z.boolean(),
  timestamp: z.string().datetime().optional(),
  evaluator: z.union([z.literal("ai"), z.literal("human"), z.string()]),
  overallScore: criterionScoreSchema,
  scores: z.record(z.string(), criterionScoreSchema),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
  feedback: z.string(),
  rawResponse: z.any().optional(),
});

/**
 * Type definition for evaluation results
 */
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;

/**
 * Calculate a weighted average overall score from individual criteria scores
 * @param scores Object containing criterion scores
 * @param weights Object containing criterion weights (should sum to 1.0)
 * @returns Weighted average score (0.0-1.0)
 */
export function calculateOverallScore(
  scores: Record<string, number>,
  weights: Record<string, number>
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const criterionId in scores) {
    if (weights[criterionId]) {
      weightedSum += scores[criterionId] * weights[criterionId];
      totalWeight += weights[criterionId];
    }
  }

  // If no weights found or total is 0, use simple average
  if (totalWeight === 0) {
    const values = Object.values(scores);
    return values.reduce((sum, score) => sum + score, 0) / values.length;
  }

  return weightedSum / totalWeight;
}

/**
 * Determine if an evaluation passes based on criteria thresholds
 * @param scores Individual criterion scores
 * @param criteria Evaluation criteria configuration
 * @returns Whether the evaluation passed
 */
export function determinePassFailStatus(
  scores: Record<string, number>,
  criteria: any
): boolean {
  // Check if any critical criteria fail
  const criticalFailure = criteria.criteria
    .filter((criterion: any) => criterion.isCritical)
    .some((criterion: any) => {
      const score = scores[criterion.id];
      return score < criterion.passingThreshold;
    });

  if (criticalFailure) {
    return false;
  }

  // Calculate overall score
  const weights = Object.fromEntries(
    criteria.criteria.map((criterion: any) => [criterion.id, criterion.weight])
  );

  const overallScore = calculateOverallScore(scores, weights);

  // Check against overall threshold
  return overallScore >= criteria.passingThreshold;
}
