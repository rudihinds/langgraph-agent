/**
 * Intelligence Formatter Node
 * 
 * Takes the search results from state (not messages) and formats them
 * into a human-readable executive briefing.
 */

import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { createModel } from "@/lib/llm/model-factory.js";

// Initialize LLM for formatting
const model = createModel();

/**
 * Intelligence Formatter Node
 * 
 * Uses searchResults from state instead of parsing messages.
 * This keeps the data flow clean and avoids token bloat.
 */
export async function intelligenceFormatter(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<{
  intelligenceBriefing?: any;
  intelligenceSynthesis?: string;
  intelligenceGatheringStatus?: ProcessingStatus;
  currentStatus?: string;
  messages?: any[];
  errors?: string[];
}> {
  console.log("\n[Intelligence Formatter] ========== FORMATTING PHASE ==========");
  console.log("[Intelligence Formatter] Starting to format research results");
  
  const company = state.company || "";
  const industry = state.industry || "";
  
  console.log(`[Intelligence Formatter] Company: "${company}", Industry: "${industry}"`);
  
  // Emit formatting status
  if (config?.writer) {
    config.writer({
      message: "Compiling intelligence briefing..."
    });
  }
  
  try {
    // Use searchResults directly from state
    const searchResults = state.searchResults || [];
    const searchQueries = state.searchQueries || [];
    const searchAttempts = state.searchAttempts || [];
    const adaptiveConfig = state.adaptiveResearchConfig;
    
    console.log(`[Intelligence Formatter] Data Summary:`);
    console.log(`  - Total search results: ${searchResults.length}`);
    console.log(`  - Total search queries: ${searchQueries.length}`);
    console.log(`  - Search attempts tracked: ${searchAttempts.length}`);
    
    // Analyze search quality across all topics
    const topicQualityAnalysis: Record<string, { 
      bestQuality: number; 
      attempts: number; 
      hasMinimumData: boolean;
      gaps: string[];
    }> = {};
    
    // Analyze each topic's search quality
    if (adaptiveConfig?.topics) {
      for (const topicConfig of adaptiveConfig.topics) {
        const topicAttempts = searchAttempts.filter(a => a.topic === topicConfig.topic);
        const bestQuality = Math.max(...topicAttempts.map(a => a.resultQuality.overall), 0);
        
        topicQualityAnalysis[topicConfig.topic] = {
          bestQuality,
          attempts: topicAttempts.length,
          hasMinimumData: bestQuality >= topicConfig.minimumQualityThreshold,
          gaps: []
        };
        
        // Identify specific gaps
        if (topicAttempts.length > 0) {
          const lastAttempt = topicAttempts[topicAttempts.length - 1];
          const breakdown = lastAttempt.resultQuality.breakdown;
          
          if (!breakdown?.hasOfficialSources) {
            topicQualityAnalysis[topicConfig.topic].gaps.push("No official sources found");
          }
          if (!breakdown?.hasRecentInfo) {
            topicQualityAnalysis[topicConfig.topic].gaps.push("No recent information available");
          }
          if (lastAttempt.resultQuality.resultCount === 0) {
            topicQualityAnalysis[topicConfig.topic].gaps.push("No results found");
          }
        }
      }
    }
    
    // Log quality analysis summary
    console.log(`\n[Intelligence Formatter] Quality Analysis by Topic:`);
    for (const [topic, analysis] of Object.entries(topicQualityAnalysis)) {
      console.log(`  - ${topic}:`);
      console.log(`    • Best quality: ${analysis.bestQuality.toFixed(2)}`);
      console.log(`    • Attempts: ${analysis.attempts}`);
      console.log(`    • Has minimum data: ${analysis.hasMinimumData ? "Yes" : "No"}`);
      if (analysis.gaps.length > 0) {
        console.log(`    • Gaps: ${analysis.gaps.join(", ")}`);
      }
    }
    
    if (searchResults.length === 0) {
      return {
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        currentStatus: "No research results found to format",
        messages: [new AIMessage({
          content: "No research results were found. Please try searching again.",
          name: "intelligenceFormatter"
        })],
        errors: ["No search results available"]
      };
    }
    
    // Format search results for LLM processing
    const formattedResults = searchResults.map((sr, index) => {
      // Add defensive checks for missing properties
      const results = sr.results || [];
      const sources = results.map((r: any) => ({
        title: r.title || 'Untitled',
        url: r.url || '',
        snippet: r.content?.substring(0, 200) || ''
      }));
      
      return {
        searchNumber: index + 1,
        query: sr.query || 'Unknown query',
        answer: sr.answer || 'No answer provided',
        resultCount: results.length,
        sources: sources.slice(0, 3) // Top 3 sources per search
      };
    });
    
    // Create comprehensive briefing prompt
    const systemPrompt = `You are an expert intelligence analyst creating an executive briefing for ${company} in the ${industry} sector.

You have completed ${searchResults.length} searches covering:
${state.researchTopics?.covered?.join(', ') || 'various topics'}

IMPORTANT CONTEXT:
Some research areas had limited public data available. You must acknowledge these gaps transparently while providing maximum value from available information.

Create a comprehensive, actionable intelligence briefing that will inform our proposal strategy.`;

    // Build quality summary for the prompt
    let qualitySummary = "\n\nDATA QUALITY ANALYSIS:\n";
    for (const [topic, analysis] of Object.entries(topicQualityAnalysis)) {
      qualitySummary += `- ${topic}: ${analysis.hasMinimumData ? 'Adequate' : 'Limited'} data`;
      qualitySummary += ` (quality: ${analysis.bestQuality.toFixed(2)}, attempts: ${analysis.attempts})`;
      if (analysis.gaps.length > 0) {
        qualitySummary += `\n  Gaps: ${analysis.gaps.join(', ')}`;
      }
      qualitySummary += '\n';
    }

    const humanPrompt = `Based on the following research results, create an executive intelligence briefing:

SEARCH QUERIES PERFORMED:
${searchQueries.join('\n')}
${qualitySummary}

RESEARCH RESULTS:
${JSON.stringify(formattedResults, null, 2)}

Create a structured briefing that:
1. Executive Summary (3-5 key insights OR acknowledge data limitations)
2. Strategic Initiatives & Priorities (based on available data)
3. Current Vendor Landscape (note if limited visibility)
4. Procurement Patterns & History (highlight gaps if present)
5. Key Decision Makers (suggest alternative approaches if data is scarce)
6. Opportunities & Risks (including risks from information gaps)
7. Recommended Proposal Strategy (adapted to available intelligence)
8. Intelligence Gaps & Next Steps (be specific about what's missing)

CRITICAL: 
- Be transparent about data limitations
- Distinguish between confirmed facts and reasonable assumptions
- Suggest primary research methods for gaps (networking, direct contact, etc.)
- Provide actionable recommendations despite limitations`;

    // Generate the briefing
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ], config);
    
    const briefingContent = typeof response.content === 'string' 
      ? response.content 
      : 'Unable to generate briefing';
    
    // Structure the intelligence briefing
    const intelligenceBriefing = {
      company,
      industry,
      searchesPerformed: searchResults.length,
      topicsCovered: state.researchTopics?.covered || [],
      keyFindings: extractKeyFindings(briefingContent),
      fullBriefing: briefingContent,
      dataQuality: topicQualityAnalysis,
      totalSearchAttempts: searchAttempts.length,
      adaptiveStrategiesUsed: [...new Set(searchAttempts.map(a => a.strategy))],
      timestamp: new Date().toISOString()
    };
    
    console.log("\n[Intelligence Formatter] Successfully created intelligence briefing");
    console.log(`[Intelligence Formatter] Briefing Summary:`);
    console.log(`  - Key findings extracted: ${intelligenceBriefing.keyFindings.length}`);
    console.log(`  - Total searches performed: ${intelligenceBriefing.searchesPerformed}`);
    console.log(`  - Topics covered: ${intelligenceBriefing.topicsCovered.join(", ")}`);
    console.log(`  - Adaptive strategies used: ${intelligenceBriefing.adaptiveStrategiesUsed.join(", ")}`);
    
    // Log data quality warnings
    const lowQualityTopics = Object.entries(topicQualityAnalysis)
      .filter(([_, analysis]) => !analysis.hasMinimumData)
      .map(([topic, _]) => topic);
    
    if (lowQualityTopics.length > 0) {
      console.log(`\n[Intelligence Formatter] ⚠️  Data Quality Warnings:`);
      console.log(`  - Topics with limited data: ${lowQualityTopics.join(", ")}`);
      console.log(`  - Recommendation: Consider primary research methods for these areas`);
    }
    
    console.log(`[Intelligence Formatter] ======================================\n`);
    
    return {
      intelligenceBriefing,
      intelligenceSynthesis: briefingContent,
      intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
      currentStatus: "Intelligence briefing complete",
      messages: [new AIMessage({
        content: briefingContent,
        name: "intelligenceFormatter"
      })]
    };
    
  } catch (error) {
    console.error("[Intelligence Formatter] Error:", error);
    
    // Create fallback briefing with available data
    const fallbackBriefing = createFallbackBriefing(state);
    
    return {
      intelligenceBriefing: fallbackBriefing.briefing,
      intelligenceSynthesis: fallbackBriefing.content,
      intelligenceGatheringStatus: ProcessingStatus.ERROR,
      currentStatus: "Briefing created with limited data",
      messages: [new AIMessage({
        content: fallbackBriefing.content,
        name: "intelligenceFormatter"
      })],
      errors: [`Formatting error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Extract key findings from the briefing content
 */
function extractKeyFindings(briefingContent: string): string[] {
  // Simple extraction - look for numbered items in executive summary
  const lines = briefingContent.split('\n');
  const findings: string[] = [];
  let inSummary = false;
  
  for (const line of lines) {
    if (line.toLowerCase().includes('executive summary') || line.toLowerCase().includes('key insights')) {
      inSummary = true;
      continue;
    }
    
    if (inSummary && line.match(/^\s*\d+\.|^-|^•/)) {
      findings.push(line.trim());
    }
    
    if (findings.length >= 5 || (inSummary && line.match(/^#{1,3}\s/))) {
      break;
    }
  }
  
  return findings.slice(0, 5);
}

/**
 * Create a fallback briefing if LLM processing fails
 */
function createFallbackBriefing(state: typeof OverallProposalStateAnnotation.State) {
  const searchResults = state.searchResults || [];
  const company = state.company || "the organization";
  
  const content = `# Intelligence Briefing for ${company}

## Executive Summary
- Completed ${searchResults.length} searches across key intelligence areas
- Gathered information on: ${state.researchTopics?.covered?.join(', ') || 'strategic topics'}
- Analysis based on ${searchResults.reduce((sum, sr) => sum + (sr.results?.length || 0), 0)} sources

## Key Findings

### Search Results Summary
${searchResults.map((sr, idx) => 
  `${idx + 1}. **${sr.query}**
   - ${sr.answer || 'Multiple results found'}
   - ${sr.results.length} sources identified`
).join('\n\n')}

## Recommendations
Based on the available data, we recommend focusing on the specific findings from each search area to build a competitive proposal strategy.

*Note: This is a summary briefing. Full analysis may require additional processing.*`;

  return {
    briefing: {
      company,
      searchesPerformed: searchResults.length,
      topicsCovered: state.researchTopics?.covered || [],
      keyFindings: [`${searchResults.length} searches completed`],
      fullBriefing: content,
      timestamp: new Date().toISOString()
    },
    content
  };
}