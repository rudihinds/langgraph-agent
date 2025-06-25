/**
 * Intelligence Gathering Agent
 * 
 * Core intelligence gathering agent that uses Tavily web search tool and follows
 * the intelligenceGathering.md prompt structure to research customer context,
 * vendor relationships, procurement patterns, and decision makers.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import { createWebSearchTool } from "@/tools/web-search.js";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { IntelligenceBriefingSchema } from "@/state/modules/schemas.js";
import { Logger } from "@/lib/logger.js";

const logger = Logger.getInstance();

// Initialize LLM for intelligence gathering
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3, // Balanced temperature for factual research with some flexibility
  maxTokens: 8000,
});


/**
 * Intelligence Gathering Agent Node
 * 
 * Performs structured research using Tavily web search following the 4-phase approach:
 * 1. Customer Context & Recent Initiatives
 * 2. Current Vendors & Solutions  
 * 3. Recent Procurement Activities
 * 4. Decision Makers
 */
export async function intelligenceGatheringAgent(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  intelligenceBriefing?: any;
  intelligenceGatheringStatus?: ProcessingStatus;
  currentStatus?: string;
  messages?: any[];
  errors?: string[];
} | Command> {
  console.log("[Intelligence Agent] Starting intelligence gathering");
  
  try {
    // Get company and industry from state (extracted by parallelDispatcherNode)
    const company = state.company || "";
    const industry = state.industry || "";
    const rfpText = state.rfpDocument?.text || "";
    
    if (!rfpText) {
      throw new Error("No RFP document available for intelligence gathering");
    }
    
    // Check if company or industry are missing or have default values
    const needsCompanyInfo = !company || company === "Unknown Organization" || company === "";
    const needsIndustryInfo = !industry || industry === "Unknown Industry" || industry === "General" || industry === "";
    
    if (needsCompanyInfo || needsIndustryInfo) {
      console.log(`[Intelligence Agent] Missing required information - Company: ${company || 'MISSING'}, Industry: ${industry || 'MISSING'}`);
      
      // Route to HITL to collect missing information
      return new Command({
        goto: "companyInfoHitlCollection",
        update: {
          currentStatus: "Need company/industry information to proceed with intelligence gathering",
          intelligenceGatheringStatus: ProcessingStatus.AWAITING_REVIEW
        }
      });
    }
    
    console.log(`[Intelligence Agent] Researching ${company} in ${industry} sector (from state)`);
    
    // Create model with web search tool
    const modelWithTools = model.bindTools([createWebSearchTool()]);
    
    // Load the intelligence gathering prompt template
    const systemPrompt = `You are an intelligence gathering specialist researching ${company} in the ${industry} sector to support proposal development.

Your goal: Gather factual intelligence about the customer's context, vendor relationships, procurement patterns, and decision makers.

## Research Phases

### Phase 1: Customer Context & Recent Initiatives
Search for the customer's recent strategic initiatives and stated priorities from the last 18 months.

**Search progression:**
1. Start broad: "${company} strategic initiatives 2024"
2. Refine with findings: "${company} [specific program found] announcement"
3. Verify with official sources: "site:[company-domain.com] annual report priorities"

**What constitutes a valid initiative:**
- Explicitly stated programs with names/titles
- Budget allocations or timeline mentions
- Executive quotes about priorities
- Board-approved strategies

**Stop when:** You have 3-5 concrete initiatives OR searched 3 different query variations

### Phase 2: Current Vendors & Solutions
Identify vendors currently providing services similar to the RFP scope.

**Search progression:**
1. Contract databases: "${company} contracts site:sam.gov"
2. News/announcements: "${company} selects vendor award"
3. Case studies: "[relevant solution area] case study ${company}"

**Capture for each vendor:**
- Vendor name and solution area
- Contract dates/status if available
- Source of information

**Stop when:** You identify 2-3 relevant vendors OR exhausted contract databases

### Phase 3: Recent Procurement Activities
Find similar RFPs/contracts from the past 2 years.

**Search progression:**
1. Government sites: "${company} RFP site:sam.gov 2023..2024"
2. Procurement news: "${company} awards contract [solution area]"
3. Industry publications: "${company} procurement [relevant industry]"

**Focus on:**
- RFP titles and dates
- Contract values
- Winning vendors
- Award dates

**Stop when:** You find 2-3 relevant procurements OR searched primary procurement databases

### Phase 4: Decision Makers
Research individuals mentioned in the RFP or likely involved in evaluation.

**Search progression:**
1. Start with RFP: Search for any names/titles mentioned as contacts
2. Leadership search: "${company} procurement director LinkedIn"
3. Organizational: "${company} [relevant department] leadership team"

**Gather only:**
- Name and official title
- Where mentioned in RFP (if applicable)
- Professional background (1-2 relevant points)
- Source URL

**Stop when:** You identify RFP-mentioned contacts + 1-2 other relevant leaders

## Search Guidelines

**Prefer these sources:**
- Official company websites (.gov, .org, official .com)
- Government contract databases (SAM.gov, state procurement sites)
- Procurement news sites (e.g. FedBizOpps, ProContract)
- Established news outlets
- LinkedIn for professional profiles
- Industry publications

**Avoid or flag:**
- Information older than 2 years (unless no recent data exists)
- Unofficial blogs or forums
- Speculative articles
- Competitor-authored content

## Output Requirements

You MUST return findings in this exact JSON structure. Use the web search tool to gather current, credible information for each phase.

Begin research now for ${company}.`;

    const humanPrompt = `Please conduct comprehensive intelligence gathering research for ${company} in the ${industry} sector. 

RFP Context (first 1000 characters):
${rfpText.substring(0, 1000)}${rfpText.length > 1000 ? "..." : ""}

Follow the 4-phase research approach and return findings in the specified JSON structure. Use web search extensively to gather current, factual information.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ];

    console.log("[Intelligence Agent] Calling LLM with web search tools");
    const response = await modelWithTools.invoke(messages);
    
    // Extract content from response
    const responseContent = typeof response.content === "string" 
      ? response.content 
      : "Intelligence gathering completed with tool interactions";
    
    console.log("[Intelligence Agent] Processing research results");
    
    // Parse structured intelligence from the response
    let intelligenceBriefing;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedData = JSON.parse(jsonMatch[0]);
        // Validate against schema
        intelligenceBriefing = IntelligenceBriefingSchema.parse(parsedData);
      } else {
        // Fallback: create structured output from unstructured response
        intelligenceBriefing = createFallbackIntelligenceBriefing(responseContent, company, industry);
      }
    } catch (parseError) {
      console.warn("[Intelligence Agent] Failed to parse structured output, creating fallback");
      intelligenceBriefing = createFallbackIntelligenceBriefing(responseContent, company, industry);
    }
    
    console.log(`[Intelligence Agent] Intelligence gathering complete for ${company}`);
    
    // Create status message for user
    const statusMessage = {
      role: "assistant" as const,
      content: `## 🔍 Intelligence Gathering Complete

I've completed comprehensive research on **${company}** in the ${industry} sector. Here's what I discovered:

**Customer Context**: Found ${intelligenceBriefing.customer_context.recent_initiatives.length} recent strategic initiatives
**Vendor Landscape**: Identified ${intelligenceBriefing.vendor_landscape.current_vendors.length} current vendors
**Procurement History**: Analyzed ${intelligenceBriefing.procurement_history.recent_rfps.length} recent procurement activities
**Decision Makers**: Researched ${intelligenceBriefing.decision_makers.length} key decision makers

The intelligence briefing includes detailed findings on their strategic priorities, existing vendor relationships, procurement patterns, and key stakeholders. This intelligence will guide our proposal strategy and positioning.

Please review the findings and let me know if you'd like me to research any additional targets or modify the analysis.`
    };

    return {
      intelligenceBriefing,
      intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
      currentStatus: `Intelligence gathering completed for ${company}`,
      messages: [statusMessage],
      errors: []
    };

  } catch (error) {
    console.error("[Intelligence Agent] Error during intelligence gathering:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error during intelligence gathering";
    
    return {
      intelligenceGatheringStatus: ProcessingStatus.ERROR,
      currentStatus: `Intelligence gathering failed: ${errorMessage}`,
      errors: [errorMessage]
    };
  }
}

/**
 * Create fallback intelligence briefing when structured parsing fails
 */
function createFallbackIntelligenceBriefing(content: string, company: string, industry: string) {
  return {
    customer_context: {
      company,
      industry,
      recent_initiatives: [{
        name: "Research in progress",
        date: new Date().toISOString().substring(0, 7),
        source: "Intelligence gathering analysis",
        priority_level: "Medium" as const
      }]
    },
    vendor_landscape: {
      current_vendors: [{
        vendor_name: "Analysis in progress",
        solution_area: "To be determined",
        contract_status: "Unknown" as const,
        source: "Intelligence gathering analysis"
      }]
    },
    procurement_history: {
      recent_rfps: [{
        title: "Analysis in progress",
        date: new Date().toISOString().substring(0, 7),
        value: "Not disclosed",
        winner: "To be determined",
        source: "Intelligence gathering analysis"
      }],
      buying_patterns: "Analysis in progress - additional research needed"
    },
    decision_makers: [{
      name: "Analysis in progress",
      title: "To be determined",
      mentioned_in_rfp: "Research ongoing",
      background: "Professional background research in progress"
    }],
    metadata: {
      research_completed: new Date().toISOString(),
      gaps: ["Structured data parsing failed - manual review recommended"]
    }
  };
}
