/**
 * Intelligence Synchronizer Node
 * 
 * Consolidates results from all parallel agents and routes to the formatter.
 * 
 * IMPORTANT: LangGraph's execution model (Bulk Synchronous Parallel) ensures
 * this node only runs AFTER all parallel agents have completed. We don't need
 * to manually check completion status - LangGraph handles the synchronization.
 */

import { Command, LangGraphRunnableConfig } from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { ParallelIntelligenceState } from "./types.js";

/**
 * Intelligence Synchronizer Node
 * 
 * This node aggregates results from all 4 parallel agents:
 * - Strategic Initiatives
 * - Vendor Relationships  
 * - Procurement Patterns
 * - Decision Makers
 * 
 * Since all agents route to this synchronizer, LangGraph ensures they've all
 * completed before this node executes. This is similar to a "sink" node in
 * the fan-out/fan-in pattern.
 */
export async function intelligenceSynchronizer(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<Command> {
  console.log("[Intelligence Synchronizer] Aggregating results from all parallel agents");
  
  const parallelState = state.parallelIntelligenceState as ParallelIntelligenceState;
  
  if (!parallelState) {
    console.error("[Intelligence Synchronizer] No parallel state found");
    return new Command({
      goto: "intelligenceFormatter",
      update: {
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        errors: ["No parallel intelligence state found"],
      },
    });
  }
  
  // Log final status of all agents (they've all completed at this point)
  const agentStatuses = {
    strategic: parallelState.strategicInitiatives?.status || "unknown",
    vendor: parallelState.vendorRelationships?.status || "unknown",
    procurement: parallelState.procurementPatterns?.status || "unknown",
    decision: parallelState.decisionMakers?.status || "unknown",
  };
  
  console.log("[Intelligence Synchronizer] Final agent statuses:", agentStatuses);
  
  // Calculate overall quality metrics
  const qualityScores = [
    parallelState.strategicInitiatives?.quality || 0,
    parallelState.vendorRelationships?.quality || 0,
    parallelState.procurementPatterns?.quality || 0,
    parallelState.decisionMakers?.quality || 0,
  ];
  
  const overallQuality = qualityScores.reduce((sum, q) => sum + q, 0) / 4;
  
  console.log(`[Intelligence Synchronizer] Overall quality: ${overallQuality.toFixed(2)}`);
  console.log(`[Intelligence Synchronizer] Individual qualities:`, {
    strategic: parallelState.strategicInitiatives?.quality?.toFixed(2) || "0.00",
    vendor: parallelState.vendorRelationships?.quality?.toFixed(2) || "0.00",
    procurement: parallelState.procurementPatterns?.quality?.toFixed(2) || "0.00",
    decision: parallelState.decisionMakers?.quality?.toFixed(2) || "0.00",
  });
  
  // Log total iterations for monitoring
  const totalIterations = [
    state.strategicInitiativesResearch?.iteration || 0,
    state.vendorRelationshipsResearch?.iteration || 0,
    state.procurementPatternsResearch?.iteration || 0,
    state.decisionMakersResearch?.iteration || 0,
  ].reduce((sum, iter) => sum + iter, 0);
  
  console.log(`[Intelligence Synchronizer] Total iterations across all agents: ${totalIterations}`);
  
  // Emit status
  if (config?.writer) {
    config.writer({
      message: `Intelligence gathering complete. Overall quality: ${(overallQuality * 100).toFixed(0)}%`,
    });
  }
  
  // Update research topics covered based on quality thresholds
  const coveredTopics: string[] = [];
  const adaptiveConfig = state.adaptiveResearchConfig;
  
  if (adaptiveConfig?.topics) {
    for (const topicConfig of adaptiveConfig.topics) {
      let topicQuality = 0;
      
      switch (topicConfig.topic) {
        case "strategic initiatives and priorities":
          topicQuality = state.strategicInitiativesResearch?.quality || 0;
          break;
        case "current vendor relationships":
          topicQuality = state.vendorRelationshipsResearch?.quality || 0;
          break;
        case "procurement patterns and history":
          topicQuality = state.procurementPatternsResearch?.quality || 0;
          break;
        case "key decision makers and leadership":
          topicQuality = state.decisionMakersResearch?.quality || 0;
          break;
      }
      
      if (topicQuality >= topicConfig.minimumQualityThreshold) {
        coveredTopics.push(topicConfig.topic);
      }
    }
  }
  
  // Aggregate all results - searchResults now contains properly formatted data
  const allSearchQueries = [
    ...(state.strategicInitiativesResearch?.searchQueries || []),
    ...(state.vendorRelationshipsResearch?.searchQueries || []),
    ...(state.procurementPatternsResearch?.searchQueries || []),
    ...(state.decisionMakersResearch?.searchQueries || []),
  ];
  
  // searchResults now contains objects with {query, results, answer, timestamp}
  const allSearchResults = [
    ...(state.strategicInitiativesResearch?.searchResults || []),
    ...(state.vendorRelationshipsResearch?.searchResults || []),
    ...(state.procurementPatternsResearch?.searchResults || []),
    ...(state.decisionMakersResearch?.searchResults || []),
  ];
  
  console.log(`[Intelligence Synchronizer] Aggregated search results:`, {
    totalSearchResults: allSearchResults.length,
    firstResult: allSearchResults[0] ? {
      hasQuery: !!allSearchResults[0].query,
      hasResults: !!allSearchResults[0].results,
      hasAnswer: !!allSearchResults[0].answer,
      resultsCount: allSearchResults[0].results?.length || 0
    } : 'No results'
  });
  
  const allExtractedUrls = [
    ...(state.strategicInitiativesResearch?.extractedUrls || []),
    ...(state.vendorRelationshipsResearch?.extractedUrls || []),
    ...(state.procurementPatternsResearch?.extractedUrls || []),
    ...(state.decisionMakersResearch?.extractedUrls || []),
  ];
  
  const allExtractedEntities = [
    ...(state.strategicInitiativesResearch?.extractedEntities || []),
    ...(state.vendorRelationshipsResearch?.extractedEntities || []),
    ...(state.procurementPatternsResearch?.extractedEntities || []),
    ...(state.decisionMakersResearch?.extractedEntities || []),
  ];

  // Route to formatter
  return new Command({
    goto: "intelligenceFormatter",
    update: {
      researchTopics: {
        needed: state.researchTopics?.needed || [],
        covered: coveredTopics,
      },
      // Update shared fields for backward compatibility
      searchQueries: allSearchQueries,
      searchResults: allSearchResults,
      extractedUrls: [...new Set(allExtractedUrls)], // Deduplicate
      extractedEntities: allExtractedEntities,
      currentStatus: `Parallel research complete - formatting ${allSearchResults.length} total results`,
      intelligenceGatheringStatus: ProcessingStatus.RUNNING,
    },
  });
}