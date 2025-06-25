/**
 * Custom Researcher Node
 *
 * Generic research node that performs targeted research based on user requests.
 * Uses web search tools to gather additional intelligence on specific topics
 * identified by users during the HITL review process.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { createWebSearchTool } from "@/tools/web-search.js";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";

// Initialize LLM for custom research
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.4, // Balanced temperature for research flexibility
  maxTokens: 6000,
});

/**
 * Extract research context from user feedback and existing intelligence
 */
function extractResearchContext(
  state: typeof OverallProposalStateAnnotation.State
): {
  existingIntelligence: string;
  userRequest: string;
  company: string;
  industry: string;
} {
  const intelligenceBriefing = state.intelligenceBriefing;
  const userFeedback = state.intelligenceHumanReview?.feedback || "";

  const company =
    intelligenceBriefing?.customer_context?.company || "Unknown Organization";
  const industry =
    intelligenceBriefing?.customer_context?.industry || "Unknown Industry";

  const existingIntelligence = intelligenceBriefing
    ? JSON.stringify(intelligenceBriefing, null, 2)
    : "No existing intelligence available";

  return {
    existingIntelligence,
    userRequest: userFeedback,
    company,
    industry,
  };
}

/**
 * Custom Researcher Node
 *
 * Performs targeted research based on user requests during HITL review.
 * Integrates findings with existing intelligence briefing.
 */
export async function customResearcherNode(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  intelligenceBriefing?: any;
  intelligenceGatheringStatus?: ProcessingStatus;
  currentStatus?: string;
  messages?: any[];
  errors?: string[];
}> {
  console.log("[Custom Researcher] Starting targeted research");

  try {
    // Extract research context
    const { existingIntelligence, userRequest, company, industry } =
      extractResearchContext(state);

    if (!userRequest) {
      throw new Error("No user research request provided");
    }

    console.log(
      `[Custom Researcher] Researching: ${userRequest} for ${company}`
    );

    // Create model with web search tool
    const modelWithTools = model.bindTools([createWebSearchTool()]);

    const systemPrompt = `You are a specialized research agent conducting targeted intelligence gathering based on specific user requests.

## Research Context:
- Organization: ${company}
- Industry: ${industry}
- User Request: ${userRequest}

## Research Guidelines:

1. **Focus on User Request**: Prioritize the specific research areas requested by the user
2. **Complement Existing Intelligence**: Build upon existing findings rather than duplicating them
3. **Use Credible Sources**: Prefer official sources, government databases, established news outlets
4. **Provide Evidence**: Include source URLs and specific evidence for all findings
5. **Structure Results**: Organize findings to integrate seamlessly with existing intelligence

## Search Strategy:

1. **Targeted Queries**: Use specific search terms related to the user's request
2. **Multiple Angles**: Approach the research from different perspectives
3. **Recent Information**: Focus on information from the last 2 years unless historical context is needed
4. **Verification**: Cross-reference findings across multiple sources when possible

## Output Requirements:

Provide research findings that can be integrated into the existing intelligence briefing. Focus on:
- Specific answers to the user's research request
- Additional context that enhances existing intelligence
- New insights that weren't captured in the initial research
- Source attribution for all findings

Use web search extensively to gather current, factual information related to the user's specific request.`;

    const humanPrompt = `Please conduct targeted research based on this user request: "${userRequest}"

Current Intelligence Context:
${existingIntelligence}

Focus your research on addressing the user's specific request while complementing the existing intelligence. Use web search to gather current, credible information.

Provide findings in a structured format that can be integrated with the existing intelligence briefing.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt),
    ];

    console.log("[Custom Researcher] Calling LLM with web search tools");
    const response = await modelWithTools.invoke(messages);

    // Extract content from response
    const responseContent =
      typeof response.content === "string"
        ? response.content
        : "Custom research completed with tool interactions";

    console.log("[Custom Researcher] Processing research results");

    // Integrate findings with existing intelligence briefing
    const updatedIntelligence = integrateResearchFindings(
      state.intelligenceBriefing,
      responseContent,
      userRequest
    );

    console.log(
      `[Custom Researcher] Custom research complete for: ${userRequest}`
    );

    // Create status message for user
    const statusMessage = {
      role: "assistant" as const,
      content: `## 🔍 Additional Research Complete

I've completed targeted research based on your request: **"${userRequest}"**

**Research Focus**: ${userRequest}
**Organization**: ${company}
**Industry**: ${industry}

The additional research findings have been integrated with the existing intelligence briefing. Key new insights include:

${responseContent.substring(0, 500)}${responseContent.length > 500 ? "..." : ""}

The updated intelligence briefing now includes this additional research. Please review the enhanced findings.`,
    };

    return {
      intelligenceBriefing: updatedIntelligence,
      intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
      currentStatus: `Custom research completed: ${userRequest}`,
      messages: [statusMessage],
      errors: [],
    };
  } catch (error) {
    console.error("[Custom Researcher] Error during custom research:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error during custom research";

    return {
      intelligenceGatheringStatus: ProcessingStatus.ERROR,
      currentStatus: `Custom research failed: ${errorMessage}`,
      errors: [errorMessage],
    };
  }
}

/**
 * Integrate research findings with existing intelligence briefing
 */
function integrateResearchFindings(
  existingIntelligence: any,
  researchFindings: string,
  userRequest: string
): any {
  if (!existingIntelligence) {
    // If no existing intelligence, create basic structure
    return {
      customer_context: {
        company: "Research Target",
        industry: "Unknown",
        recent_initiatives: [],
      },
      vendor_landscape: {
        current_vendors: [],
      },
      procurement_history: {
        recent_rfps: [],
        buying_patterns: researchFindings,
      },
      decision_makers: [],
      metadata: {
        research_completed: new Date().toISOString(),
        gaps: [],
        custom_research: [
          {
            request: userRequest,
            findings: researchFindings,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    };
  }

  // Add custom research to metadata
  const updatedIntelligence = { ...existingIntelligence };

  if (!updatedIntelligence.metadata.custom_research) {
    updatedIntelligence.metadata.custom_research = [];
  }

  updatedIntelligence.metadata.custom_research.push({
    request: userRequest,
    findings: researchFindings,
    timestamp: new Date().toISOString(),
  });

  // Update research completed timestamp
  updatedIntelligence.metadata.research_completed = new Date().toISOString();

  return updatedIntelligence;
}
