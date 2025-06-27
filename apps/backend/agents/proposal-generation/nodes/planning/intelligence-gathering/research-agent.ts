/**
 * Research Agent Node
 *
 * Intelligence gathering agent that uses the Command pattern for explicit flow control.
 * The agent examines state to determine whether to search more or format results.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";
import { Command, LangGraphRunnableConfig } from "@langchain/langgraph";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus, SearchStrategy } from "@/state/modules/types.js";
import { getIntelligenceSearchTool } from "@/tools/intelligence-search.js";
import { getIntelligenceExtractTool } from "@/tools/intelligence-extract.js";
import {
  assessSearchQuality,
  selectSearchStrategy,
  adaptSearchQuery,
} from "./adaptive-search-utils.js";
import {
  createProgressiveSearchIntegration,
} from "./progressive-search-integration.js";

/**
 * Helper function to determine which topic a URL relates to
 */
function determineTopicForUrl(result: any, topics: string[]): string | null {
  const url = result.url?.toLowerCase() || '';
  const title = result.title?.toLowerCase() || '';
  const content = `${url} ${title}`;
  
  // Map URL patterns to topics
  if (content.includes('leadership') || content.includes('team') || 
      content.includes('about') || content.includes('executive') ||
      content.includes('linkedin.com/in/')) {
    return topics.find(t => t.includes('decision makers')) || null;
  }
  
  if (content.includes('partner') || content.includes('vendor') ||
      content.includes('supplier') || content.includes('integration')) {
    return topics.find(t => t.includes('vendor')) || null;
  }
  
  if (content.includes('product') || content.includes('service') ||
      content.includes('solution') || content.includes('offering')) {
    return topics.find(t => t.includes('product') || t.includes('service')) || null;
  }
  
  if (content.includes('contract') || content.includes('procurement') ||
      content.includes('award') || content.includes('rfp')) {
    return topics.find(t => t.includes('procurement')) || null;
  }
  
  if (content.includes('strategy') || content.includes('initiative') ||
      content.includes('priority') || content.includes('plan')) {
    return topics.find(t => t.includes('strategic')) || null;
  }
  
  return null;
}

// Initialize LLM for research agent
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3, // Lower temperature for focused research
  maxTokens: 4000,
});

/**
 * Research Agent Node
 *
 * This agent uses Command with goto for explicit routing:
 * 1. Checks if company info is needed -> goto companyInfoHitlCollection
 * 2. Initializes research topics on first run
 * 3. Checks if research is complete -> goto intelligenceFormatter
 * 4. Generates tool calls for searches -> goto intelligenceTools
 * 5. All routing is explicit via Command pattern
 */
export async function researchAgent(
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<
  | Command
  | {
      researchTopics?: any;
      currentStatus?: string;
      intelligenceGatheringStatus?: ProcessingStatus;
      errors?: string[];
    }
> {
  console.log("[Research Agent] Starting intelligence research");
  
  const company = state.company || "";
  const industry = state.industry || "";
  const rfpText = state.rfpDocument?.text || "";
  
  console.log(`[Research Agent] Company: "${company}", Industry: "${industry}"`);

  // Emit initial status
  if (config?.writer) {
    config.writer({
      message: `Analyzing intelligence requirements for ${company || "organization"}...`,
    });
  }

  // Check if we need company/industry info first
  if (
    !company ||
    company === "Unknown Organization" ||
    company === "" ||
    !industry ||
    industry === "Unknown Industry" ||
    industry === "General" ||
    industry === ""
  ) {
    console.log(
      "[Research Agent] Missing company/industry info - routing to HITL collection"
    );
    return new Command({
      goto: "companyInfoHitlCollection",
      update: {
        currentStatus: "Need company information before research",
        intelligenceGatheringStatus: ProcessingStatus.RUNNING,
      },
    });
  }

  // Validation
  if (!rfpText) {
    return new Command({
      goto: "intelligenceFormatter", // Skip to formatter with error
      update: {
        errors: ["No RFP document available for intelligence gathering"],
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        currentStatus: "Missing RFP document",
      },
    });
  }

  // Initialize topics on first run
  if (!state.researchTopics?.needed?.length) {
    console.log("[Research Agent] Initializing research topics");
    console.log("[Research Agent] Topics to research:");
    const topics = [
      "strategic initiatives and priorities",
      "current vendor relationships",
      "procurement patterns and history",
      "key decision makers and leadership",
    ];
    topics.forEach((topic, idx) => {
      console.log(`  ${idx + 1}. ${topic}`);
    });
    
    // Use Command to update state and route back to self
    return new Command({
      goto: "researchAgent", // Route back to self to continue
      update: {
        researchTopics: {
          needed: [
            "strategic initiatives and priorities",
            "current vendor relationships",
            "procurement patterns and history",
            "key decision makers and leadership",
          ],
          covered: [],
        },
        adaptiveResearchConfig: {
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
        },
        intelligenceGatheringStatus: ProcessingStatus.RUNNING,
        currentStatus: "Planning research strategy...",
      },
    });
  }

  // Analyze previous search quality to determine topic coverage
  const searchAttempts = state.searchAttempts || [];
  const adaptiveConfig = state.adaptiveResearchConfig;
  
  // Get search count early since we need it for URL identification
  const searchCount = state.searchQueries?.length || 0;
  
  // Track promising URLs from previous searches for extraction
  const promisingUrls: { url: string; topic: string; title: string }[] = [];
  const extractedUrls = state.extractedUrls || [];
  
  // Update covered topics based on quality thresholds
  const qualifiedCoveredTopics: string[] = [...state.researchTopics.covered];
  if (adaptiveConfig?.topics && searchAttempts.length > 0) {
    for (const topicConfig of adaptiveConfig.topics) {
      const topicAttempts = searchAttempts.filter(a => a.topic === topicConfig.topic);
      if (topicAttempts.length > 0) {
        const bestQuality = Math.max(...topicAttempts.map(a => a.resultQuality.overall));
        if (bestQuality >= topicConfig.minimumQualityThreshold && 
            !qualifiedCoveredTopics.includes(topicConfig.topic)) {
          qualifiedCoveredTopics.push(topicConfig.topic);
        }
      }
    }
  }
  
  // Identify promising URLs from search results that haven't been extracted yet
  // Group by topic to limit URLs per topic
  const urlsByTopic = new Map<string, { url: string; topic: string; title: string }[]>();
  
  if (state.searchResults && searchCount > 0) {  // Changed from > 2 to > 0
    for (const sr of state.searchResults.slice(-3)) { // Last 3 search results
      if (sr.results) {
        for (const result of sr.results) {
          // Check if URL is promising and not already extracted
          if (result.url && !extractedUrls.includes(result.url)) {
            const urlLower = result.url.toLowerCase();
            const titleLower = (result.title || '').toLowerCase();
            
            const isPromising = 
              // Team/Leadership pages - improved patterns
              urlLower.includes('/people') ||
              urlLower.includes('/team') ||
              urlLower.includes('/teams') ||  // Added plural
              urlLower.includes('/about') ||
              urlLower.includes('/leadership') ||
              urlLower.includes('/who-we-are') ||
              urlLower.includes('/staff') ||
              urlLower.includes('/board') ||
              // Partner/Vendor pages
              urlLower.includes('/partner') ||  // Catches /partners and /our-partners
              urlLower.includes('/vendor') ||
              urlLower.includes('/supplier') ||
              urlLower.includes('/customer') ||
              // LinkedIn
              urlLower.includes('linkedin.com/in/') ||
              urlLower.includes('linkedin.com/company/') ||
              // TheOrg.com (common for team pages)
              urlLower.includes('theorg.com') ||
              // Title matching
              (titleLower && (
                titleLower.includes('team') ||
                titleLower.includes('leadership') ||
                titleLower.includes('partner') ||
                titleLower.includes('executive') ||
                titleLower.includes('board') ||
                titleLower.includes('who we are')
              ));
              
            if (isPromising) {
              // Determine which topic this URL relates to
              const topic = determineTopicForUrl(result, state.researchTopics.needed);
              // Remove the coverage check - allow extraction even for "covered" topics
              if (topic) {
                // Group URLs by topic
                if (!urlsByTopic.has(topic)) {
                  urlsByTopic.set(topic, []);
                }
                urlsByTopic.get(topic)!.push({
                  url: result.url,
                  topic: topic,
                  title: result.title || ''
                });
              }
            }
          }
        }
      }
    }
  }
  
  // Limit to top 2 URLs per topic to prevent excessive extractions
  const MAX_URLS_PER_TOPIC = 2;
  for (const urls of urlsByTopic.values()) {
    // Take only the first 2 URLs for each topic
    const limitedUrls = urls.slice(0, MAX_URLS_PER_TOPIC);
    promisingUrls.push(...limitedUrls);
  }
  
  console.log(`[Research Agent] Promising URLs for extraction: ${promisingUrls.length}`);
  promisingUrls.slice(0, 3).forEach(({url, topic}) => {
    console.log(`  - ${topic}: ${url}`);
  });

  // Determine uncovered topics (those not meeting quality threshold)
  const uncoveredTopics = state.researchTopics.needed.filter(
    (topic) => !qualifiedCoveredTopics.includes(topic)
  );
  
  console.log(`[Research Agent] Search Progress Summary:`);
  console.log(`  - Total searches completed: ${state.searchQueries?.length || 0}`);
  console.log(`  - Total results gathered: ${state.searchResults?.length || 0}`);
  console.log(`  - Search attempts with quality tracking: ${searchAttempts.length}`);
  
  // Check if any covered topics had poor quality and need retry
  const topicsNeedingRetry: string[] = [];
  if (adaptiveConfig?.topics) {
    for (const topicConfig of adaptiveConfig.topics) {
      const topicAttempts = searchAttempts.filter(
        (attempt) => attempt.topic === topicConfig.topic
      );
      
      if (topicAttempts.length > 0) {
        const lastAttempt = topicAttempts[topicAttempts.length - 1];
        const quality = lastAttempt.resultQuality;
        
        // Check if quality is below threshold and we haven't exceeded max attempts
        if (
          quality.overall < topicConfig.minimumQualityThreshold &&
          topicAttempts.length < topicConfig.maxAttempts &&
          !uncoveredTopics.includes(topicConfig.topic)
        ) {
          topicsNeedingRetry.push(topicConfig.topic);
          console.log(
            `[Research Agent] Topic "${topicConfig.topic}" needs retry - quality ${quality.overall.toFixed(2)} below threshold ${topicConfig.minimumQualityThreshold}`
          );
          console.log(`    - Attempts so far: ${topicAttempts.length}/${topicConfig.maxAttempts}`);
          console.log(`    - Last strategy used: ${lastAttempt.strategy}`);
          console.log(`    - Result count: ${lastAttempt.resultQuality.resultCount}`);
        } else if (quality.overall >= topicConfig.minimumQualityThreshold) {
          console.log(
            `[Research Agent] Topic "${topicConfig.topic}" has adequate quality: ${quality.overall.toFixed(2)}`
          );
        }
      }
    }
  }

  // Combine uncovered topics with those needing retry
  const topicsToSearch = [...uncoveredTopics, ...topicsNeedingRetry];
  
  console.log(`[Research Agent] Topics Status:`);
  console.log(`  - Uncovered topics: ${uncoveredTopics.length > 0 ? uncoveredTopics.join(", ") : "None"}`);
  console.log(`  - Topics needing retry: ${topicsNeedingRetry.length > 0 ? topicsNeedingRetry.join(", ") : "None"}`);
  console.log(`  - Total topics to search: ${topicsToSearch.length}`);

  // Check if research is complete or if we should force completion
  const MAX_SEARCHES = 20; // Hard limit to prevent excessive searching
  const MAX_TOTAL_ATTEMPTS = 25; // Total attempts across all topics
  
  // Calculate total attempts across all topics
  const totalAttempts = searchAttempts.length;
  
  // Check if all topics have reached their max attempts
  const allTopicsExhausted = adaptiveConfig?.topics.every(topicConfig => {
    const topicAttempts = searchAttempts.filter(a => a.topic === topicConfig.topic);
    return topicAttempts.length >= topicConfig.maxAttempts;
  });

  if (topicsToSearch.length === 0 || searchCount >= MAX_SEARCHES || 
      totalAttempts >= MAX_TOTAL_ATTEMPTS || allTopicsExhausted) {
    console.log(
      `[Research Agent] Research complete - ${searchCount} searches performed, ${totalAttempts} total attempts`
    );
    if (searchCount >= MAX_SEARCHES) {
      console.log(`[Research Agent] Stopped due to reaching max searches limit (${MAX_SEARCHES})`);
    }
    if (totalAttempts >= MAX_TOTAL_ATTEMPTS) {
      console.log(`[Research Agent] Stopped due to reaching max total attempts limit (${MAX_TOTAL_ATTEMPTS})`);
    }
    if (allTopicsExhausted) {
      console.log(`[Research Agent] Stopped due to all topics reaching their max attempts`);
    }
    console.log(`[Research Agent] Final Quality Summary:`);
    
    // Log final quality for each topic
    if (adaptiveConfig?.topics) {
      adaptiveConfig.topics.forEach(topicConfig => {
        const topicAttempts = searchAttempts.filter(a => a.topic === topicConfig.topic);
        if (topicAttempts.length > 0) {
          const bestQuality = Math.max(...topicAttempts.map(a => a.resultQuality.overall));
          console.log(`  - ${topicConfig.topic}: ${bestQuality.toFixed(2)} (${topicAttempts.length} attempts)`);
        }
      });
    }

    // Emit completion status
    if (config?.writer) {
      config.writer({
        message: "Research phase complete, preparing briefing...",
      });
    }

    return new Command({
      goto: "intelligenceFormatter",
      update: {
        researchTopics: {
          needed: state.researchTopics.needed,
          covered: qualifiedCoveredTopics, // Update with topics that met quality thresholds
        },
        currentStatus: `Research complete for ${company} - formatting ${state.searchResults?.length || 0} results`,
        intelligenceGatheringStatus: ProcessingStatus.RUNNING,
      },
    });
  }

  try {
    // Check if we should do extraction phase (progressive search)
    const shouldExtract = searchCount > 0 && state.searchResults?.length > 0 && promisingUrls.length > 0;
    
    // Use progressive search integration for dynamic topic handling
    const progressiveIntegration = createProgressiveSearchIntegration();
    let progressiveSearchGuidance = "";
    
    // Check each topic for progressive search opportunities
    // Include ALL topics, not just topicsToSearch, to enable progressive search on covered topics
    const allTopics = state.researchTopics.needed || [];
    const progressiveGuidance = progressiveIntegration.generateProgressiveGuidance(
      allTopics,  // Changed from topicsToSearch to allTopics
      state
    );
    
    if (progressiveGuidance) {
      progressiveSearchGuidance = progressiveGuidance;
      console.log("[Research Agent] Progressive search guidance generated");
    }
    
    // Force extraction if we have promising URLs (regardless of retry status)
    const forceExtraction = promisingUrls.length > 0;
    
    console.log(`[Research Agent] Search Phase: ${shouldExtract || forceExtraction ? "EXTRACTION" : "DISCOVERY"}`);
    console.log(`[Research Agent] Available tools: ${shouldExtract || forceExtraction ? "search + extract" : "search only"}`);
    console.log(`[Research Agent] Force extraction: ${forceExtraction} (${promisingUrls.length} promising URLs)`);
    
    // Build adaptive search guidance
    let adaptiveGuidance = "";
    if (topicsNeedingRetry.length > 0) {
      adaptiveGuidance = "\n\nADAPTIVE SEARCH NEEDED:\n";
      for (const topic of topicsNeedingRetry) {
        const topicConfig = adaptiveConfig?.topics.find(t => t.topic === topic);
        const topicAttempts = searchAttempts.filter(a => a.topic === topic);
        const lastAttempt = topicAttempts[topicAttempts.length - 1];
        
        // Check if we should use progressive search for this topic
        const progressiveCheck = progressiveIntegration.shouldUseProgressiveSearch(
          topic,
          searchCount,
          lastAttempt.resultQuality.overall,
          state
        );
        
        let strategy: SearchStrategy;
        if (progressiveCheck.useProgressive) {
          strategy = progressiveIntegration.recommendSearchStrategy(topic, state);
          console.log(`[Research Agent] ${progressiveCheck.reason}`);
        } else {
          strategy = selectSearchStrategy(
            topic,
            topicAttempts,
            topicConfig?.preferredStrategies as any
          );
        }
        
        console.log(`[Research Agent] Adaptive strategy for "${topic}": ${strategy}`);
        console.log(`  - Previous strategies tried: ${topicAttempts.map(a => a.strategy).join(", ")}`);
        
        adaptiveGuidance += `- ${topic}: Previous search had low quality (${lastAttempt.resultQuality.overall.toFixed(2)}). Try ${strategy} approach.\n`;
      }
    }

    // Create dynamic system prompt based on state
    const systemPrompt = `You are an expert intelligence analyst researching ${company} in the ${industry} sector.

RESEARCH PROGRESS:
- Topics to research: ${state.researchTopics.needed.join(", ")}
- Topics completed successfully: ${state.researchTopics.covered.filter(t => !topicsNeedingRetry.includes(t)).join(", ") || "None"}
- Topics needing better results: ${topicsNeedingRetry.join(", ") || "None"}
- Searches completed: ${searchCount}
- Results gathered: ${state.searchResults?.length || 0}

TOPICS TO SEARCH: ${topicsToSearch.join(", ")}

IMPORTANT: Each search tool call MUST include the "topic" parameter that matches the specific topic you are researching. The topics available are:
${topicsToSearch.map(topic => `- "${topic}"`).join('\n')}

${adaptiveGuidance}

SEARCH STRATEGIES:
- discovery: Find organization's main website and relevant pages (progressive search phase 1)
- standard: Direct search for the topic
- expanded: Broader terms, include related concepts  
- refined: More specific, add company/industry context
- alternative: Use different phrasing or synonyms
- source_specific: Target specific sites (sam.gov, linkedin.com, etc.)
- temporal_extended: Expand date range for historical context
- inferential: Look for indirect/related information
- individual: Search for specific entity (progressive search phase 3)

PROGRESSIVE SEARCH:
The system supports multi-phase progressive search for certain topics:
1. Discovery: Find listing pages (team, products, vendors)
2. Extraction: Extract entities from those pages
3. Deep-dive: Research individual entities

Topics with progressive search: decision makers, vendor relationships, products

QUERY GENERATION RULES:
- Keep queries SHORT and SIMPLE (maximum 50 characters)
- Use natural language - Tavily works best with conversational queries
- DO NOT use advanced search operators (site:, filetype:, OR, AND, quotes, date ranges)
- Focus on the essence of what you're looking for

GOOD QUERY EXAMPLES:
Strategic initiatives:
  • "Apple strategic priorities"
  • "Microsoft strategy 2024"
  • "Tesla future plans"
  
Leadership/Decision makers:
  • "Amazon leadership team"
  • "Google executives"
  • "Netflix board directors"
  
Vendor relationships:
  • "IBM technology partners"
  • "Oracle vendor ecosystem"
  • "Salesforce partnerships"
  
Procurement patterns:
  • "Boeing government contracts"
  • "Lockheed procurement history"
  • "Accenture contract awards"

BAD QUERY EXAMPLES (DO NOT USE):
  ❌ "Apple Inc" "strategic priorities" "annual report" site:apple.com 2023..2024
  ❌ "Microsoft Corporation" AND ("leadership" OR "executives") filetype:pdf
  ❌ "Tesla Motors" procurement contracts site:sam.gov OR site:usaspending.gov
  
Remember: Simple, natural queries work best!

INSTRUCTIONS:
- Create up to 3 parallel searches for different topics
- Each search should target a specific topic from the TOPICS TO SEARCH list
- Ensure each tool call includes the correct topic parameter matching what you're researching
- For retry topics, consider why previous searches had low quality and adjust accordingly
- Focus on quality over quantity - better to do fewer, more targeted searches
- For progressive search topics: Follow the phase guidance (discovery → extraction → deep-dive)
- Most importantly: Generate queries that are contextually appropriate for each topic
${shouldExtract || forceExtraction ? `
- EXTRACTION PHASE: You have access to intelligence_extract tool
- Review previous search results and identify promising URLs
- Use extract tool on LinkedIn profiles, company pages, or specific articles
- Focus extraction on topics with low quality scores
- PRIORITIZE EXTRACTION over new searches when you have promising URLs` : ''}
${state.extractedUrls?.length > 0 ? `
- DEEP-DIVE PHASE: You have already extracted from ${state.extractedUrls.length} URLs
- Check the extraction results for names and entities
- Use "individual" strategy to search for specific people/organizations you extracted
- Example: "Sarah Johnson Social Finance LinkedIn"` : ''}

PREVIOUS SEARCHES:
${state.searchQueries?.slice(-5).join("\n") || "None yet"}`;

    // Add extraction guidance if in extraction phase
    let extractionContext = "";
    if (shouldExtract || forceExtraction) {
      if (promisingUrls.length > 0) {
        extractionContext = `

EXTRACTION PRIORITY - USE THE EXTRACT TOOL NOW:
You have ${promisingUrls.length} promising URLs to extract detailed information from.

TOP EXTRACTION TARGETS:
${promisingUrls.slice(0, 3).map(({url, topic, title}, idx) => 
  `${idx + 1}. Topic: "${topic}"
   URL: ${url}
   Title: ${title || 'N/A'}
   Extraction type: ${topic.includes('decision makers') ? 'people' : topic.includes('vendor') ? 'organizations' : 'auto'}`
).join('\n\n')}

EXTRACTION COMMAND EXAMPLE:
Tool: intelligence_extract
Arguments: {
  "url": "${promisingUrls[0]?.url || ''}",
  "topic": "${promisingUrls[0]?.topic || ''}",
  "extractionType": "${promisingUrls[0]?.topic.includes('decision makers') ? 'people' : 'auto'}"
}

CRITICAL INSTRUCTIONS:
1. STOP searching and START extracting - use intelligence_extract tool on these URLs NOW
2. Extract structured data about people, partnerships, or relevant entities
3. Each extraction will give you names/entities to search for in phase 3
4. Do NOT do more general searches until you've extracted from these URLs

IMPORTANT: You MUST use the extract tool on at least one of these URLs before doing any more searches!`;
      } else {
        // This shouldn't happen now, but keep as fallback
        extractionContext = `

Note: No promising URLs identified yet. Continue with discovery searches to find extractable sources like team pages, partner pages, or LinkedIn profiles.`;
      }
    }

    // Check for unsearched extracted entities
    const extractedEntities = state.extractedEntities || [];
    const unsearchedEntities = extractedEntities.filter(e => !e.searched);
    let entitySearchContext = "";
    
    if (unsearchedEntities.length > 0 && !forceExtraction) {
      // Group entities by type
      const peopleEntities = unsearchedEntities.filter(e => e.type === "person").slice(0, 3);
      const orgEntities = unsearchedEntities.filter(e => e.type === "organization").slice(0, 2);
      
      if (peopleEntities.length > 0 || orgEntities.length > 0) {
        entitySearchContext = `

PHASE 3 - DEEP-DIVE ON EXTRACTED ENTITIES:
You have extracted ${unsearchedEntities.length} entities that need individual searches.

${peopleEntities.length > 0 ? `KEY PEOPLE TO SEARCH:
${peopleEntities.map((e, idx) => 
  `${idx + 1}. ${e.name}${e.title ? ` (${e.title})` : ''} - Topic: ${e.topic}`
).join('\n')}

Search examples:
- "${peopleEntities[0]?.name} ${company} LinkedIn"
- "${peopleEntities[0]?.name} ${peopleEntities[0]?.title || 'executive'}"` : ''}

${orgEntities.length > 0 ? `ORGANIZATIONS TO RESEARCH:
${orgEntities.map((e, idx) => 
  `${idx + 1}. ${e.name} - Topic: ${e.topic}`
).join('\n')}

Search examples:
- "${orgEntities[0]?.name} partnership ${company}"
- "${orgEntities[0]?.name} contract ${company}"` : ''}

Use "individual" strategy for people searches. Create 2-3 searches for the most important entities.`;
      }
    }

    const humanPrompt = `Continue researching ${company}. ${
      forceExtraction
        ? 'IMPORTANT: Use the intelligence_extract tool on the promising URLs listed above BEFORE doing new searches.' 
        : unsearchedEntities.length > 0
        ? 'IMPORTANT: Search for the extracted entities listed above using individual searches.'
        : 'Create searches for the specific topics listed above.'
    }${extractionContext}${entitySearchContext}${progressiveSearchGuidance}`;

    // Emit planning status
    if (config?.writer) {
      config.writer({
        message: "Planning research strategy...",
      });
    }

    // Bind appropriate tools
    const tools = (shouldExtract || forceExtraction)
      ? [getIntelligenceSearchTool(), getIntelligenceExtractTool()]
      : [getIntelligenceSearchTool()];
    
    console.log(`[Research Agent] Binding tools: ${tools.map(t => t.name).join(', ')}`);
    const modelWithTools = model.bindTools(tools);
    const response = await modelWithTools.invoke(
      [new SystemMessage(systemPrompt), new HumanMessage(humanPrompt)],
      config
    );

    // Check if model generated tool calls
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(
        `[Research Agent] Generated ${response.tool_calls.length} search queries`
      );

      // Log the queries for debugging
      response.tool_calls.forEach((call: any, index: number) => {
        console.log(
          `  ${index + 1}. ${call.name}: ${JSON.stringify(call.args)}`
        );
      });

      // Emit status about planned searches
      if (config?.writer) {
        config.writer({
          message: `Executing ${response.tool_calls.length} targeted searches...`,
        });
      }

      // Extract topics that are actually being researched from tool calls
      const topicsBeingResearched: string[] = [];
      
      // Log the actual queries being executed
      console.log(`[Research Agent] Tool calls details:`);
      response.tool_calls.forEach((call: any, idx: number) => {
        const args = call.args || {};
        console.log(`  ${idx + 1}. Query: "${args.query || 'No query'}"`);
        if (args.strategy) console.log(`     Strategy: ${args.strategy}`);
        if (args.topic) {
          console.log(`     Topic: ${args.topic}`);
          // Add unique topics from all research topics (not just topicsToSearch)
          const allTopics = state.researchTopics?.needed || [];
          if (allTopics.includes(args.topic) && !topicsBeingResearched.includes(args.topic)) {
            topicsBeingResearched.push(args.topic);
          }
        }
      });

      // Route to tools with state updates
      console.log(`[Research Agent] Routing to intelligenceTools`);
      console.log(`[Research Agent] Topics being researched: ${topicsBeingResearched.join(", ")}`);
      
      // Don't mark topics as covered yet - wait until we check quality
      return new Command({
        goto: "intelligenceTools",
        update: {
          messages: [response], // Include AIMessage for tool execution
          currentStatus: `Researching: ${topicsBeingResearched.join(", ")}`,
          intelligenceGatheringStatus: ProcessingStatus.RUNNING,
        },
      });
    } else {
      // No tool calls generated - something went wrong
      console.log(
        "[Research Agent] No tool calls generated - may have hit an issue"
      );

      return new Command({
        goto: "intelligenceFormatter",
        update: {
          messages: [response],
          currentStatus:
            "Unable to generate more searches, proceeding to format results",
          intelligenceGatheringStatus: ProcessingStatus.RUNNING,
        },
      });
    }
  } catch (error) {
    console.error("[Research Agent] Error during research:", error);

    // Route to formatter with error
    return new Command({
      goto: "intelligenceFormatter",
      update: {
        messages: [
          new AIMessage({
            content: `Research error: ${error instanceof Error ? error.message : "Unknown error"}. Proceeding with ${state.searchResults?.length || 0} results gathered so far.`,
            name: "researchAgent",
          }),
        ],
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        currentStatus: "Research error - proceeding to format",
        errors: [
          `Research error: ${error instanceof Error ? error.message : "Unknown error"}`,
        ],
      },
    });
  }
}
