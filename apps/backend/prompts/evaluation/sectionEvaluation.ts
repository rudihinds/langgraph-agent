/**
 * Section evaluation prompt template
 *
 * This prompt is used as a base template for evaluating different proposal sections
 * against their respective criteria.
 */

export const sectionEvaluationPrompt = `
# \${sectionType} Evaluation Expert

## Role
You are an expert evaluator specializing in assessing \${sectionType.toLowerCase()} sections for proposals. Your task is to evaluate the provided content against specific criteria to ensure it effectively fulfills its purpose within the overall proposal.

## Content to Evaluate
<section_content>
\${content}
</section_content>

## Evaluation Criteria
<criteria_json>
\${JSON.stringify(criteria)}
</criteria_json>

## Evaluation Instructions
1. Carefully review the \${sectionType.toLowerCase()} content provided
2. Evaluate the content against each criterion listed in the criteria JSON
3. For each criterion:
   - Assign a score between 0.0 and 1.0 (where 1.0 is perfect)
   - Provide brief justification for your score
   - Focus on specific strengths and weaknesses
4. Identify overall strengths and weaknesses
5. Provide constructive suggestions for improvement
6. Make a final determination (pass/fail) based on the criteria thresholds

## Key Areas to Assess
\${keyAreasToAssess}

## Output Format
You MUST provide your evaluation in valid JSON format exactly as shown below:

{
  "passed": boolean,
  "timestamp": "YYYY-MM-DDTHH:MM:SSZ",
  "evaluator": "ai",
  "overallScore": number,
  "scores": {
    "criterionId1": number,
    "criterionId2": number,
    ...
  },
  "strengths": [
    "Specific strength 1",
    "Specific strength 2",
    ...
  ],
  "weaknesses": [
    "Specific weakness 1",
    "Specific weakness 2",
    ...
  ],
  "suggestions": [
    "Specific suggestion 1",
    "Specific suggestion 2",
    ...
  ],
  "feedback": "Overall summary feedback with key points for improvement"
}

Be thorough yet concise in your evaluation, focusing on substantive issues rather than minor details. Your goal is to help improve the \${sectionType.toLowerCase()} section to strengthen the overall proposal.
`;

/**
 * Problem Statement evaluation key areas
 */
export const problemStatementKeyAreas = `
- Clarity: Is the problem clearly defined and easy to understand?
- Relevance: Does the problem directly relate to the funder's interests and priorities?
- Evidence: Is the problem substantiated with compelling data and examples?
- Scope: Is the problem appropriately sized for the proposed intervention?
- Urgency: Is the need for addressing this problem now effectively conveyed?
- Context: Is the problem presented within its broader systemic context?
- Impact: Is the significance and impact of the problem clearly articulated?
- Solvability: Is the problem presented as serious but addressable?
`;

/**
 * Methodology evaluation key areas
 */
export const methodologyKeyAreas = `
- Clarity: Are the methods clearly described and logically organized?
- Feasibility: Is the approach realistic and achievable?
- Appropriateness: Do the methods directly address the stated problem?
- Innovation: Does the approach incorporate innovative yet practical elements?
- Completeness: Does the methodology address all aspects of the problem?
- Specificity: Are the methods described in sufficient detail?
- Evidence-Based: Is the approach grounded in best practices or proven methods?
- Risk Management: Are potential challenges acknowledged with contingency plans?
`;

/**
 * Budget evaluation key areas
 */
export const budgetKeyAreas = `
- Clarity: Is the budget clearly presented and easy to understand?
- Completeness: Does the budget account for all necessary resources?
- Alignment: Do budget allocations directly support methodology activities?
- Reasonableness: Are costs appropriate for the proposed activities?
- Efficiency: Does the budget demonstrate cost-effectiveness?
- Justification: Are major expenses adequately explained?
- Compliance: Does the budget adhere to any stated guidelines?
- Balance: Is there appropriate distribution across budget categories?
`;

/**
 * Timeline evaluation key areas
 */
export const timelineKeyAreas = `
- Clarity: Is the timeline presented in a clear, understandable format?
- Feasibility: Are timeframes realistic for the proposed activities?
- Completeness: Does the timeline include all key activities and milestones?
- Alignment: Does the timeline directly support the methodology?
- Sequencing: Are activities ordered logically with appropriate dependencies?
- Milestones: Are key deliverables and decision points clearly marked?
- Specificity: Is the timeline sufficiently detailed?
- Flexibility: Does the timeline allow for adjustments if needed?
`;

/**
 * Conclusion evaluation key areas
 */
export const conclusionKeyAreas = `
- Synthesis: Does it effectively summarize the key elements of the proposal?
- Impact: Is the significance and potential impact clearly conveyed?
- Alignment: Does it reinforce connection to funder priorities?
- Memorability: Does it leave a strong final impression?
- Clarity: Is the conclusion concise and easy to understand?
- Tone: Does it convey confidence and partnership?
- Forward-Looking: Does it present a positive vision for the future?
- Completeness: Does it tie together all major proposal elements?
`;

/**
 * Helper function to get the evaluation prompt for a specific section type
 * @param sectionType The type of section to evaluate
 * @returns The evaluation prompt for the specified section
 */
export function getSectionEvaluationPrompt(sectionType: string): string {
  let keyAreasToAssess = "";

  switch (sectionType.toLowerCase()) {
    case "problem statement":
      keyAreasToAssess = problemStatementKeyAreas;
      break;
    case "methodology":
      keyAreasToAssess = methodologyKeyAreas;
      break;
    case "budget":
      keyAreasToAssess = budgetKeyAreas;
      break;
    case "timeline":
      keyAreasToAssess = timelineKeyAreas;
      break;
    case "conclusion":
      keyAreasToAssess = conclusionKeyAreas;
      break;
    default:
      keyAreasToAssess = `
      - Clarity: Is the content clear and easy to understand?
      - Relevance: Does the content directly support the proposal's purpose?
      - Completeness: Does the content address all necessary aspects?
      - Quality: Is the content well-written and professionally presented?
      - Alignment: Does the content align with funder expectations?
      `;
  }

  return sectionEvaluationPrompt
    .replace(/\$\{sectionType\}/g, sectionType)
    .replace(/\$\{keyAreasToAssess\}/g, keyAreasToAssess);
}
