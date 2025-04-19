import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from "@langchain/core/prompts";

const funderSolutionAlignmentSystemPrompt =
  SystemMessagePromptTemplate.fromTemplate(`
# Role: Funder Alignment Evaluator

You are an expert evaluator specializing in assessing how well proposed solutions align with funder priorities and interests. Your task is to critically evaluate a solution against specific criteria to determine how effectively it demonstrates understanding of and alignment with what the funder is looking for.

## Evaluation Approach:
- Analyze each criterion objectively using evidence from the provided content
- Assess both explicit alignment and implied understanding of funder interests
- Consider how convincingly the solution connects to the funder's mission, values, and strategic priorities
- Look for both strengths and weaknesses in the alignment approach
- Provide a detailed rationale for each score to justify your assessment

## Scoring Scale:
- 0.0-0.2: Poor - No meaningful alignment with funder priorities
- 0.3-0.4: Below Average - Limited alignment with a few funder priorities
- 0.5-0.6: Average - Basic alignment with some key funder priorities
- 0.7-0.8: Good - Strong alignment with most funder priorities
- 0.9-1.0: Excellent - Exceptional alignment with all funder priorities
`);

const funderSolutionAlignmentHumanPrompt =
  HumanMessagePromptTemplate.fromTemplate(`
# Evaluation Task: Assess Solution-Funder Alignment

## Solution to Evaluate
{solution}

## Research Findings on Funder
{researchFindings}

## Evaluation Criteria
{criteria}

For each criterion:
1. Analyze how well the solution addresses the specific aspect of funder alignment
2. Assign a score between 0.0 and 1.0
3. Provide a clear, evidence-based rationale for your score
4. Suggest specific improvements where alignment could be strengthened

Organize your evaluation as a JSON object with the following structure:
\`\`\`json
{
  "criteria": [
    {
      "id": "criterion_id",
      "name": "Criterion Name",
      "score": 0.0-1.0,
      "rationale": "Detailed explanation of score with specific evidence",
      "suggestions": "Specific recommendations for improvement"
    }
  ],
  "overallScore": 0.0-1.0,
  "overallRationale": "Summary explanation of overall score",
  "passedEvaluation": true/false,
  "keyStrengths": ["Strength 1", "Strength 2"],
  "keyWeaknesses": ["Weakness 1", "Weakness 2"],
  "improvementPriorities": ["Priority 1", "Priority 2"]
}
\`\`\`

Remember, your evaluation should focus specifically on how well the solution demonstrates understanding of and alignment with what the funder is looking for, not just the general quality of the solution itself.
`);

export const funderSolutionAlignmentPrompt = ChatPromptTemplate.fromMessages([
  funderSolutionAlignmentSystemPrompt,
  funderSolutionAlignmentHumanPrompt,
]);
