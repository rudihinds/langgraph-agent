/**
 * Intelligence Dispatcher Node
 * 
 * Orchestrates parallel intelligence gathering across all topics.
 * Uses the Send API to dispatch 4 agents simultaneously.
 */

import { Command, LangGraphRunnableConfig } from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { ParallelIntelligenceState } from "./types.js";

/**
 * Intelligence Dispatcher Node
 * 
 * This node:
 * 1. Validates prerequisites (company, industry, RFP)
 * 2. Initializes parallel intelligence state
 * 3. Sets up adaptive research configuration
 * 4. Returns Send commands to all 4 agents
 */
export async function intelligenceDispatcher(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<Command | { errors: string[]; intelligenceGatheringStatus: ProcessingStatus }> {
  const timestamp = new Date().toISOString();
  console.log(`[Intelligence Dispatcher] Starting parallel intelligence gathering at ${timestamp}`);
  console.log(`[Intelligence Dispatcher] Current status: ${state.intelligenceGatheringStatus}`);
  console.log(`[Intelligence Dispatcher] Message count: ${state.messages?.length || 0}`);
  
  // Check if intelligence gathering is already running to prevent duplicate dispatches
  if (state.intelligenceGatheringStatus === ProcessingStatus.RUNNING) {
    console.warn("[Intelligence Dispatcher] Intelligence gathering is already running - skipping duplicate dispatch");
    return { errors: [], intelligenceGatheringStatus: ProcessingStatus.RUNNING };
  }
  
  const company = state.company;
  const industry = state.industry;
  const rfpText = state.rfpDocument?.text;
  
  // Validation
  if (!company || !industry || !rfpText) {
    console.error("[Intelligence Dispatcher] Missing required information");
    return {
      errors: [
        "Missing required information for intelligence gathering",
        !company ? "Company name is required" : "",
        !industry ? "Industry is required" : "",
        !rfpText ? "RFP document is required" : "",
      ].filter(Boolean),
      intelligenceGatheringStatus: ProcessingStatus.ERROR,
    };
  }
  
  console.log(`[Intelligence Dispatcher] Company: ${company}, Industry: ${industry}`);
  
  // Initialize parallel intelligence state
  const parallelIntelligenceState: ParallelIntelligenceState = {
    strategicInitiatives: { status: "pending" },
    vendorRelationships: { status: "pending" },
    procurementPatterns: { status: "pending" },
    decisionMakers: { status: "pending" },
  };
  
  // Initialize research topics if not already set
  const researchTopics = state.researchTopics || {
    needed: [
      "strategic initiatives and priorities",
      "current vendor relationships",
      "procurement patterns and history",
      "key decision makers and leadership",
    ],
    covered: [],
  };
  
  // Initialize adaptive research configuration
  const adaptiveResearchConfig = state.adaptiveResearchConfig || {
    topics: [
      {
        topic: "strategic initiatives and priorities",
        priority: "high" as const,
        minimumQualityThreshold: 0.5,
        preferredStrategies: ["standard", "expanded", "source_specific"],
        maxAttempts: 3,
      },
      {
        topic: "current vendor relationships",
        priority: "high" as const,
        minimumQualityThreshold: 0.4,
        preferredStrategies: ["standard", "refined", "inferential"],
        maxAttempts: 3,
      },
      {
        topic: "procurement patterns and history",
        priority: "critical" as const,
        minimumQualityThreshold: 0.6,
        preferredStrategies: ["source_specific", "temporal_extended", "expanded"],
        maxAttempts: 4,
        fallbackApproach: "Check sam.gov and usaspending.gov directly",
      },
      {
        topic: "key decision makers and leadership",
        priority: "medium" as const,
        minimumQualityThreshold: 0.3,
        preferredStrategies: ["discovery", "source_specific", "individual"],
        maxAttempts: 4,
      },
    ],
    qualityThresholds: {
      minimum: 0.3,
      preferred: 0.6,
    },
  };
  
  // Initialize individual topic research states (preserve existing data if any)
  const topicResearchStates = {
    strategicInitiativesResearch: state.strategicInitiativesResearch || {
      iteration: 0,
      searchQueries: [],
      searchResults: [],
      extractedUrls: [],
      extractedEntities: [],
      quality: 0,
      attempts: 0,
    },
    vendorRelationshipsResearch: state.vendorRelationshipsResearch || {
      iteration: 0,
      searchQueries: [],
      searchResults: [],
      extractedUrls: [],
      extractedEntities: [],
      quality: 0,
      attempts: 0,
    },
    procurementPatternsResearch: state.procurementPatternsResearch || {
      iteration: 0,
      searchQueries: [],
      searchResults: [],
      extractedUrls: [],
      extractedEntities: [],
      quality: 0,
      attempts: 0,
    },
    decisionMakersResearch: state.decisionMakersResearch || {
      iteration: 0,
      searchQueries: [],
      searchResults: [],
      extractedUrls: [],
      extractedEntities: [],
      quality: 0,
      attempts: 0,
    },
  };
  
  // Migrate data from existing sequential fields if this is the first run
  if (state.searchResults && state.searchResults.length > 0 && !state.parallelIntelligenceState) {
    console.log("[Intelligence Dispatcher] Migrating data from sequential implementation");
    
    // Copy existing search results and queries to all topic research states
    // This ensures we don't lose any work from the sequential implementation
    const existingData = {
      searchQueries: state.searchQueries || [],
      searchResults: state.searchResults || [],
      extractedUrls: state.extractedUrls || [],
      extractedEntities: state.extractedEntities || [],
    };
    
    // Share the existing data across all topics as a starting point
    Object.keys(topicResearchStates).forEach(key => {
      topicResearchStates[key] = {
        ...topicResearchStates[key],
        ...existingData,
      };
    });
  }
  
  // Emit status
  if (config?.writer) {
    config.writer({
      message: `Dispatching parallel intelligence gathering for ${company}...`,
    });
  }
  
  // Update state and prepare for parallel execution
  const stateUpdates = {
    intelligenceGatheringStatus: ProcessingStatus.RUNNING,
    currentStatus: "Dispatching parallel intelligence gathering...",
    parallelIntelligenceState,
    researchTopics,
    adaptiveResearchConfig,
    company,  // Pass company to subgraphs
    industry, // Pass industry to subgraphs
    ...topicResearchStates,
  };
  
  // Return Command with goto to parallelIntelligenceRouter
  // The router will return Send commands for all 4 agents
  console.log(`[Intelligence Dispatcher] Dispatching to parallel router with ${Object.keys(stateUpdates).length} state updates`);
  return new Command({
    goto: "parallelIntelligenceRouter",
    update: stateUpdates,
  });
}