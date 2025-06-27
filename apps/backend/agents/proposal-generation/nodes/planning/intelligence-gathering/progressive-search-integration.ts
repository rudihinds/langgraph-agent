/**
 * Progressive Search Integration for LangGraph
 * 
 * Bridges the abstract progressive search framework with LangGraph's
 * state management and tool execution patterns.
 */

import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import {
  ProgressiveSearchConfig,
  ProgressiveSearchExecutor,
  SearchContext,
  SearchPhaseResult,
  PEOPLE_SEARCH_CONFIG,
  PRODUCT_SEARCH_CONFIG,
  VENDOR_SEARCH_CONFIG,
  createPeopleSearcher,
  createProductSearcher,
  createVendorSearcher,
} from "./progressive-search-framework.js";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { SearchStrategy } from "@/state/modules/types.js";
import { getIntelligenceSearchTool } from "@/tools/intelligence-search.js";
import { getIntelligenceExtractTool } from "@/tools/intelligence-extract.js";

/**
 * Registry of progressive search configurations mapped to topics
 */
export class ProgressiveSearchRegistry {
  private static instance: ProgressiveSearchRegistry;
  private configs: Map<string, ProgressiveSearchConfig<any, any, any>> = new Map();
  private topicMappings: Map<string, string> = new Map();

  private constructor() {
    // Initialize with default configurations
    this.registerDefaultConfigs();
  }

  static getInstance(): ProgressiveSearchRegistry {
    if (!ProgressiveSearchRegistry.instance) {
      ProgressiveSearchRegistry.instance = new ProgressiveSearchRegistry();
    }
    return ProgressiveSearchRegistry.instance;
  }

  private registerDefaultConfigs(): void {
    // Register pre-built configurations
    this.configs.set("people_search", PEOPLE_SEARCH_CONFIG);
    this.configs.set("product_search", PRODUCT_SEARCH_CONFIG);
    this.configs.set("vendor_search", VENDOR_SEARCH_CONFIG);

    // Map topics to configurations
    this.topicMappings.set("key decision makers and leadership", "people_search");
    this.topicMappings.set("decision makers", "people_search");
    this.topicMappings.set("leadership", "people_search");
    this.topicMappings.set("team members", "people_search");
    
    this.topicMappings.set("products and services", "product_search");
    this.topicMappings.set("solutions", "product_search");
    this.topicMappings.set("offerings", "product_search");
    
    this.topicMappings.set("vendor relationships", "vendor_search");
    this.topicMappings.set("current vendors", "vendor_search");
    this.topicMappings.set("procurement patterns", "vendor_search");
    this.topicMappings.set("contracts", "vendor_search");
  }

  /**
   * Register a custom progressive search configuration
   */
  registerConfig(name: string, config: ProgressiveSearchConfig<any, any, any>): void {
    this.configs.set(name, config);
  }

  /**
   * Map a topic to a configuration
   */
  mapTopicToConfig(topic: string, configName: string): void {
    this.topicMappings.set(topic.toLowerCase(), configName);
  }

  /**
   * Get configuration for a topic
   */
  getConfigForTopic(topic: string): ProgressiveSearchConfig<any, any, any> | null {
    const configName = this.topicMappings.get(topic.toLowerCase());
    if (!configName) return null;
    return this.configs.get(configName) || null;
  }

  /**
   * Check if a topic supports progressive search
   */
  supportsProgressiveSearch(topic: string): boolean {
    return this.topicMappings.has(topic.toLowerCase());
  }
}

/**
 * Integration point for progressive search with LangGraph state
 */
export class ProgressiveSearchIntegration {
  private registry = ProgressiveSearchRegistry.getInstance();

  /**
   * Determine if progressive search should be used for a topic
   */
  shouldUseProgressiveSearch(
    topic: string,
    searchCount: number,
    resultQuality: number,
    state: typeof OverallProposalStateAnnotation.State
  ): { useProgressive: boolean; reason: string } {
    // Check if topic has a progressive search configuration
    if (!this.registry.supportsProgressiveSearch(topic)) {
      return { 
        useProgressive: false, 
        reason: "No progressive search configuration for this topic" 
      };
    }

    // Check quality thresholds
    const searchAttempts = state.searchAttempts || [];
    const topicAttempts = searchAttempts.filter(a => a.topic === topic);
    
    // Always use progressive for supported topics on first attempt
    if (topicAttempts.length === 0) {
      return {
        useProgressive: true,
        reason: "First search attempt - using progressive approach"
      };
    }

    // Use progressive if quality is low after standard attempts
    const lastAttempt = topicAttempts[topicAttempts.length - 1];
    if (lastAttempt.resultQuality.overall < 0.5 && topicAttempts.length < 3) {
      return {
        useProgressive: true,
        reason: `Low quality (${lastAttempt.resultQuality.overall.toFixed(2)}) - switching to progressive`
      };
    }

    return {
      useProgressive: false,
      reason: "Standard search producing adequate results"
    };
  }

  /**
   * Generate progressive search guidance for the LLM
   */
  generateProgressiveGuidance(
    topics: string[],
    state: typeof OverallProposalStateAnnotation.State
  ): string {
    const progressiveTopics = topics.filter(t => this.registry.supportsProgressiveSearch(t));
    
    if (progressiveTopics.length === 0) {
      return "";
    }

    let guidance = "\n\nPROGRESSIVE SEARCH STRATEGY:\n";
    guidance += "Progressive search uses a 3-phase approach: Discovery → Extraction → Deep-Dive\n";
    
    for (const topic of progressiveTopics) {
      const config = this.registry.getConfigForTopic(topic);
      if (!config) continue;

      // Check if we're in discovery phase
      const topicResults = state.searchResults?.filter(sr => 
        sr.query.toLowerCase().includes(topic.toLowerCase())
      ) || [];

      const extractedUrls = state.extractedUrls || [];
      const topicExtractableUrls = this.identifyExtractableSources(topicResults, topic);
      const unextractedUrls = topicExtractableUrls.filter(url => !extractedUrls.includes(url));

      if (topicResults.length === 0) {
        guidance += `\n${topic.toUpperCase()} - PHASE 1: DISCOVERY
ACTION REQUIRED: Use "discovery" strategy with simple company name search
- Search query example: "${state.company || 'Company'} ${this.getSimpleTopicTerm(topic)}"
- Goal: Find the organization's main pages that list ${topic}
- Look for: ${this.getDiscoveryHints(topic)}
- Success indicator: URLs containing /team, /people, /leadership, /partners, etc.\n`;
      } else if (unextractedUrls.length > 0) {
        guidance += `\n${topic.toUpperCase()} - PHASE 2: EXTRACTION ⚠️ PRIORITY
ACTION REQUIRED: Use intelligence_extract tool IMMEDIATELY on these URLs:
${unextractedUrls.slice(0, 3).map((url, idx) => `  ${idx + 1}. ${url}`).join('\n')}

EXTRACTION COMMAND EXAMPLE:
Tool: intelligence_extract
Arguments: {
  "url": "${unextractedUrls[0]}",
  "topic": "${topic}",
  "extractionType": "${this.getExtractionType(topic)}"
}

- Extract all names, titles, and relevant entities
- After extraction, you'll search for individual entities\n`;
      } else if (topicResults.length > 0 && extractedUrls.length > 0) {
        // Simpler check: do we have extracted entities for this topic?
        const topicEntities = (state.extractedEntities || []).filter(e => 
          e.topic.toLowerCase().includes(topic.toLowerCase())
        );
        
        if (topicEntities.length > 0) {
          // We have extracted entities for this topic - check if we've searched for them
          const unsearchedEntities = topicEntities.filter(e => !e.searched);
          
          if (unsearchedEntities.length > 0) {
            guidance += `\n${topic.toUpperCase()} - PHASE 3: DEEP-DIVE
ACTION REQUIRED: Search for the entities you extracted!

Based on your extraction, you should have found names of people, organizations, or products.
Now search for them individually:

SEARCH EXAMPLES:
- For people: "Sarah Johnson Social Finance LinkedIn"
- For people: "Michael Chen CTO Social Finance"
- For organizations: "Microsoft partnership Social Finance"

Use "individual" strategy for these searches.
Create 2-3 searches for the most important entities you extracted.

ENTITIES TO SEARCH:
${unsearchedEntities.slice(0, 3).map(e => 
  `- ${e.name}${e.type === 'person' && e.title ? ` (${e.title})` : ''}`
).join('\n')}\n`;
          } else {
            guidance += `\n${topic.toUpperCase()} - COMPLETED ✓
- Discovery: Found relevant pages (${topicResults.length} searches)
- Extraction: Extracted ${topicEntities.length} entities
- Deep-dive: Searched for all entities
- All phases complete for this topic\n`;
          }
        } else {
          // URLs exist but not extracted yet for this topic
          const remainingUrls = topicExtractableUrls.filter(url => !extractedUrls.includes(url));
          if (remainingUrls.length > 0) {
            guidance += `\n${topic.toUpperCase()} - PHASE 2: EXTRACTION NEEDED
Found pages but haven't extracted from them yet.
Use intelligence_extract on: ${remainingUrls[0]}\n`;
          }
        }
      } else {
        guidance += `\n${topic.toUpperCase()} - CONTINUE DISCOVERY:
- No extractable sources found yet
- Try "expanded" strategy with broader terms
- Consider "source_specific" for LinkedIn or industry sites\n`;
      }
    }

    return guidance;
  }

  /**
   * Convert state search results to progressive search context
   */
  createSearchContext(
    state: typeof OverallProposalStateAnnotation.State
  ): SearchContext {
    return {
      domain: this.extractDomain(state),
      baseQuery: state.company || "",
      additionalContext: {
        industry: state.industry,
        rfpId: state.rfpAnalysisId,
        searchHistory: state.searchQueries || []
      },
      previousResults: this.convertStateToPreviousResults(state)
    };
  }

  /**
   * Execute progressive search for a topic
   */
  async executeProgressiveSearch(
    topic: string,
    state: typeof OverallProposalStateAnnotation.State,
    config?: any
  ): Promise<Command> {
    const searchConfig = this.registry.getConfigForTopic(topic);
    if (!searchConfig) {
      throw new Error(`No progressive search configuration for topic: ${topic}`);
    }

    // Create appropriate executor based on configuration type
    let executor: ProgressiveSearchExecutor<any, any, any>;
    
    if (searchConfig === PEOPLE_SEARCH_CONFIG) {
      executor = createPeopleSearcher(config?.overrides);
    } else if (searchConfig === PRODUCT_SEARCH_CONFIG) {
      executor = createProductSearcher(config?.overrides);
    } else if (searchConfig === VENDOR_SEARCH_CONFIG) {
      executor = createVendorSearcher(config?.overrides);
    } else {
      executor = new ProgressiveSearchExecutor(searchConfig);
    }

    // Execute search
    const context = this.createSearchContext(state);
    const results = await executor.execute(context);

    // Convert results to LangGraph Command
    return this.createCommandFromResults(results, topic, state);
  }

  /**
   * Generate search strategy recommendation based on progressive phase
   */
  recommendSearchStrategy(
    topic: string,
    state: typeof OverallProposalStateAnnotation.State
  ): SearchStrategy {
    const topicResults = state.searchResults?.filter(sr => 
      sr.query.toLowerCase().includes(topic.toLowerCase())
    ) || [];

    if (topicResults.length === 0) {
      return "discovery"; // Start with discovery
    }

    const hasExtractableSources = topicResults.some(sr => 
      sr.results?.some((r: any) => this.isExtractableSource(r.url))
    );

    if (hasExtractableSources) {
      return "individual"; // Move to individual searches after extraction
    }

    // Try alternative strategies if discovery didn't work
    const attemptCount = state.searchAttempts?.filter(a => a.topic === topic).length || 0;
    
    if (attemptCount === 1) return "expanded";
    if (attemptCount === 2) return "source_specific";
    if (attemptCount === 3) return "alternative";
    
    return "refined";
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private getDiscoveryHints(topic: string): string {
    const hints: Record<string, string> = {
      "decision makers": "team pages, about us, leadership, board of directors",
      "vendor relationships": "partners page, case studies, integrations, customers",
      "products": "products page, solutions, services, offerings catalog",
      "procurement": "contracts page, awards, vendor directory"
    };

    for (const [key, value] of Object.entries(hints)) {
      if (topic.toLowerCase().includes(key)) {
        return value;
      }
    }

    return "relevant listing pages";
  }

  private getSimpleTopicTerm(topic: string): string {
    const terms: Record<string, string> = {
      "decision makers": "leadership",
      "vendor": "partners",
      "procurement": "contracts",
      "strategic": "strategy"
    };

    for (const [key, value] of Object.entries(terms)) {
      if (topic.toLowerCase().includes(key)) {
        return value;
      }
    }

    return "information";
  }

  private getExtractionType(topic: string): string {
    if (topic.toLowerCase().includes("decision makers") || topic.toLowerCase().includes("leadership")) {
      return "people";
    }
    if (topic.toLowerCase().includes("vendor") || topic.toLowerCase().includes("partner")) {
      return "organizations";
    }
    if (topic.toLowerCase().includes("product") || topic.toLowerCase().includes("service")) {
      return "products";
    }
    return "entities";
  }

  private identifyExtractableSources(
    searchResults: any[],
    topic: string
  ): string[] {
    const extractable: string[] = [];
    
    for (const sr of searchResults) {
      if (!sr.results) continue;
      
      for (const result of sr.results) {
        if (this.isExtractableSource(result.url) && 
            this.isRelevantToTopic(result, topic)) {
          extractable.push(result.url);
        }
      }
    }

    return [...new Set(extractable)]; // Deduplicate
  }

  private isExtractableSource(url: string): boolean {
    const urlLower = url.toLowerCase();
    
    // Match the patterns from research-agent.ts
    return (
      // Team/Leadership pages
      urlLower.includes('/people') ||
      urlLower.includes('/team') ||
      urlLower.includes('/teams') ||
      urlLower.includes('/about') ||
      urlLower.includes('/leadership') ||
      urlLower.includes('/who-we-are') ||
      urlLower.includes('/staff') ||
      urlLower.includes('/board') ||
      // Partner/Vendor pages
      urlLower.includes('/partner') ||
      urlLower.includes('/vendor') ||
      urlLower.includes('/supplier') ||
      urlLower.includes('/customer') ||
      // LinkedIn
      urlLower.includes('linkedin.com/in/') ||
      urlLower.includes('linkedin.com/company/') ||
      // TheOrg.com
      urlLower.includes('theorg.com') ||
      // Products/Services
      urlLower.includes('/product') ||
      urlLower.includes('/service') ||
      urlLower.includes('/solution')
    );
  }

  private isRelevantToTopic(result: any, topic: string): boolean {
    const content = `${result.title} ${result.snippet}`.toLowerCase();
    const topicWords = topic.toLowerCase().split(/\s+/);
    
    return topicWords.some(word => content.includes(word));
  }

  private extractDomain(state: typeof OverallProposalStateAnnotation.State): string {
    // Try to extract from previous search results
    const urls = state.searchResults?.flatMap(sr => 
      sr.results?.map((r: any) => r.url) || []
    ) || [];

    for (const url of urls) {
      const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
      if (match && match[1].includes(state.company?.toLowerCase() || "")) {
        return match[1];
      }
    }

    // Fallback to company name
    const company = state.company || "";
    return company.toLowerCase().replace(/\s+/g, "") + ".com";
  }

  private convertStateToPreviousResults(
    state: typeof OverallProposalStateAnnotation.State
  ): SearchPhaseResult[] {
    // Convert state search results to progressive search format
    // This is a simplified conversion - enhance as needed
    return [];
  }

  private createCommandFromResults(
    results: SearchPhaseResult<any>,
    topic: string,
    state: typeof OverallProposalStateAnnotation.State
  ): Command {
    // Update state with progressive search results
    const enrichedData = {
      topic,
      entities: results.entities,
      sources: results.sources.length,
      quality: results.quality,
      metadata: results.metadata
    };

    return new Command({
      goto: "intelligenceFormatter", // or continue with more searches
      update: {
        messages: [
          new ToolMessage({
            content: `Progressive search completed for ${topic}: Found ${results.entities.length} entities with quality score ${results.quality.score.toFixed(2)}`,
            tool_call_id: "progressive_search",
          })
        ],
        searchResults: [{
          query: `Progressive search: ${topic}`,
          results: results.sources,
          answer: JSON.stringify(enrichedData),
          timestamp: new Date().toISOString()
        }],
        researchTopics: {
          needed: state.researchTopics?.needed || [],
          covered: [...(state.researchTopics?.covered || []), topic]
        }
      }
    });
  }
}

/**
 * Factory function to create integration instance
 */
export function createProgressiveSearchIntegration(): ProgressiveSearchIntegration {
  return new ProgressiveSearchIntegration();
}

/**
 * Check if a search strategy is part of progressive search
 */
export function isProgressiveStrategy(strategy: SearchStrategy): boolean {
  return ["discovery", "individual"].includes(strategy);
}

/**
 * Get the next progressive search phase
 */
export function getNextProgressivePhase(
  currentPhase: "discovery" | "extraction" | "deepDive"
): "extraction" | "deepDive" | "complete" {
  switch (currentPhase) {
    case "discovery":
      return "extraction";
    case "extraction":
      return "deepDive";
    case "deepDive":
      return "complete";
    default:
      return "complete";
  }
}