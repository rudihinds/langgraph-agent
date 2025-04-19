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
 * Key areas to assess in a problem statement section
 */
export const problemStatementKeyAreas = `
- **Clarity**: Is the problem clearly defined and easy to understand?
- **Relevance**: Is the problem relevant to the funder's priorities and interests?
- **Evidence**: Is the problem supported by data, research, or other evidence?
- **Scope**: Is the scope of the problem appropriately defined (neither too broad nor too narrow)?
- **Urgency**: Is the urgency or importance of addressing the problem effectively conveyed?
- **Context**: Is sufficient background information provided to understand the problem's origins and context?
- **Impact**: Is the impact of the problem on stakeholders clearly articulated?
- **Solvability**: Does the problem statement suggest the problem is solvable within the proposed project scope?
`;

/**
 * Key areas to assess in a solution section
 */
export const solutionKeyAreas = `
- **Alignment with Funder Priorities**: Does the solution directly address what the funder is looking for based on the research and solution sought analysis?
- **Responsiveness**: Does the solution directly respond to the identified problem?
- **Innovation**: Does the solution offer innovative or fresh approaches while remaining feasible?
- **Feasibility**: Is the solution realistic and achievable given the constraints and resources?
- **Completeness**: Does the solution address all key aspects of the problem?
- **Scalability**: Does the solution have potential for growth or broader impact?
- **Evidence-Based**: Is the solution grounded in evidence, best practices, or proven approaches?
- **Impact**: Does the solution clearly articulate the expected outcomes and benefits?
`;

/**
 * Key areas to assess in a methodology section
 */
export const methodologyKeyAreas = `
- **Clarity**: Are the methods and approaches clearly described?
- **Feasibility**: Are the proposed methods realistic and achievable?
- **Appropriateness**: Are the methods appropriate for addressing the stated problem and achieving the desired outcomes?
- **Innovation**: Does the methodology incorporate innovative approaches where beneficial?
- **Completeness**: Does the methodology address all necessary aspects of implementing the solution?
- **Specificity**: Are specific activities, processes, and tools identified?
- **Evidence-Based Practices**: Are the methods grounded in research, best practices, or proven approaches?
- **Risk Management**: Are potential challenges identified with appropriate mitigation strategies?
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
 * Get the evaluation prompt for a specific section type by injecting the appropriate key areas
 */
export function getSectionEvaluationPrompt(sectionType: string): string {
  let keyAreas: string;

  switch (sectionType) {
    case "problem_statement":
      keyAreas = problemStatementKeyAreas;
      break;
    case "solution":
      keyAreas = solutionKeyAreas;
      break;
    case "methodology":
      keyAreas = methodologyKeyAreas;
      break;
    case "budget":
      keyAreas = budgetKeyAreas;
      break;
    case "timeline":
      keyAreas = timelineKeyAreas;
      break;
    case "conclusion":
      keyAreas = conclusionKeyAreas;
      break;
    default:
      keyAreas = `- **Relevance**: Is the content relevant to this section's purpose?
- **Completeness**: Does the section cover all necessary elements?
- **Clarity**: Is the content clear and easy to understand?
- **Coherence**: Does the section flow logically and connect well with other sections?`;
  }

  return sectionEvaluationPrompt.replace("${KEY_AREAS_TO_ASSESS}", keyAreas);
}
