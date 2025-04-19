import fs from "fs";
import path from "path";
import { z } from "zod";

// Zod schema for individual criterion
const criterionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  passingThreshold: z.number().min(0).max(1),
  weight: z.number().min(0).max(1),
  isCritical: z.boolean().default(false),
  prompt: z.string().optional(),
});

// Zod schema for validation criteria configuration
export const evaluationCriteriaSchema = z.object({
  contentType: z.string(),
  passingThreshold: z.number().min(0).max(1),
  criteria: z.array(criterionSchema),
  instructions: z.string().optional(),
  examples: z
    .array(
      z.object({
        content: z.string(),
        scores: z.record(z.string(), z.number().min(0).max(1)),
        explanation: z.string(),
      })
    )
    .optional(),
});

export type EvaluationCriteria = z.infer<typeof evaluationCriteriaSchema>;
export type Criterion = z.infer<typeof criterionSchema>;

/**
 * Load evaluation criteria from a JSON file
 * @param criteriaPath Path to the criteria JSON file
 * @returns Parsed and validated evaluation criteria
 * @throws Error if file not found or fails validation
 */
export async function loadCriteria(
  criteriaPath: string
): Promise<EvaluationCriteria> {
  try {
    // Get absolute path if relative path provided
    const absPath = path.isAbsolute(criteriaPath)
      ? criteriaPath
      : path.resolve(process.cwd(), criteriaPath);

    // Read and parse the criteria file
    const rawData = await fs.promises.readFile(absPath, "utf-8");
    const parsedData = JSON.parse(rawData);

    // Validate against schema
    const validatedCriteria = evaluationCriteriaSchema.parse(parsedData);

    // Check that weights sum to approximately 1.0
    const sumOfWeights = validatedCriteria.criteria.reduce(
      (sum, criterion) => sum + criterion.weight,
      0
    );

    if (Math.abs(sumOfWeights - 1) > 0.01) {
      console.warn(
        `Warning: Sum of weights (${sumOfWeights}) is not 1.0. This may cause unexpected scoring behavior.`
      );
    }

    return validatedCriteria;
  } catch (error) {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Criteria file not found: ${criteriaPath}`);
      }

      // Handle Zod validation errors
      if (error.name === "ZodError") {
        throw new Error(`Invalid criteria format: ${error.message}`);
      }
    }

    // Re-throw any other errors
    throw error;
  }
}

/**
 * Get default criteria path for a specific content type
 * @param contentType Type of content being evaluated
 * @returns Default path to the criteria file
 */
export function getDefaultCriteriaPath(contentType: string): string {
  return path.resolve(
    process.cwd(),
    "config",
    "evaluation",
    `${contentType.toLowerCase()}_criteria.json`
  );
}

/**
 * Create a formatted prompt section from criteria
 * @param criteria Evaluation criteria object
 * @returns Formatted string for use in prompts
 */
export function formatCriteriaForPrompt(criteria: EvaluationCriteria): string {
  let prompt = `# Evaluation Criteria for ${criteria.contentType}\n\n`;

  if (criteria.instructions) {
    prompt += `${criteria.instructions}\n\n`;
  }

  prompt += `## Individual Criteria:\n\n`;

  criteria.criteria.forEach((criterion) => {
    prompt += `### ${criterion.name} (${criterion.id})${criterion.isCritical ? " [CRITICAL]" : ""}\n`;
    prompt += `${criterion.description}\n`;
    prompt += `Weight: ${(criterion.weight * 100).toFixed(0)}%\n`;
    prompt += `Passing threshold: ${(criterion.passingThreshold * 100).toFixed(0)}%\n\n`;
  });

  prompt += `Overall passing threshold: ${(criteria.passingThreshold * 100).toFixed(0)}%\n\n`;

  return prompt;
}
