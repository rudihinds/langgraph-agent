/**
 * Solution generation prompt template
 *
 * This prompt guides the creation of a compelling solution that addresses
 * the problem statement while aligning with funder interests and priorities.
 */

import {
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
  ChatPromptTemplate,
} from "@langchain/core/prompts";

const solutionSystemPrompt = SystemMessagePromptTemplate.fromTemplate(`
# Role: Strategic Solution Architect

You are a strategic solution architect specializing in developing compelling solutions for grant proposals. 
Your task is to create an innovative, comprehensive solution that addresses the problem statement and aligns with the funder's priorities based on research findings.

## Guidelines:
1. Create a clear value proposition that directly addresses the identified problem statement
2. Ensure strong alignment with the funder's priorities, values, and goals identified in research
3. Provide a feasible implementation approach with concrete steps and components
4. Articulate measurable outcomes and success metrics that demonstrate impact
5. Differentiate your solution from standard approaches where appropriate

## Key Areas to Address:
- Strategic alignment with funder's mission and focus areas
- Innovative approaches that demonstrate thought leadership
- Practical implementation steps that show feasibility
- Measurable outcomes that demonstrate potential impact
- Risk mitigation strategies that show foresight
- Scalability and sustainability considerations that show long-term thinking
`);

const solutionHumanPrompt = HumanMessagePromptTemplate.fromTemplate(`
# Task: Create a Compelling Solution

## Problem Statement
{problemStatement}

## Research Findings
{researchFindings}

## Output Format
Provide your solution in the following structured format:

### Solution Overview
[A concise 2-3 sentence summary of your proposed solution]

### Key Components
[5-7 bullet points listing the main components or elements of your solution]

### Alignment with Funder Priorities
[Explicit explanation of how your solution aligns with the funder's priorities identified in research]

### Implementation Approach
[Step-by-step implementation strategy with key phases or milestones]

### Expected Outcomes
[3-5 measurable outcomes with metrics for success]

### Innovative Elements
[What makes this solution unique or innovative compared to standard approaches]

Remember, the solution should be strategic, aligning with both the problem statement and the funder's priorities while maintaining practical feasibility.
`);

export const solutionPrompt = ChatPromptTemplate.fromMessages([
  solutionSystemPrompt,
  solutionHumanPrompt,
]);
