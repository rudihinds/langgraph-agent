# Parallel Intelligence Gathering Refactor Plan

## Overview

Refactor the intelligence gathering system from a single sequential research agent to parallel topic-specific agents, following the successful pattern used in RFP analysis.

## Current Problems with Sequential Approach

1. **Complexity Overload**: Single agent managing all topics, phases, and state
2. **Recursion Limits**: Sequential processing accumulates recursion count across all topics
3. **Cross-Topic Confusion**: Entities and URLs getting mixed between topics
4. **Poor Parallelism**: Everything happens one at a time
5. **Hard to Debug**: Complex state tracking across multiple concerns

## Proposed Parallel Architecture

### High-Level Flow

```
intelligenceDispatcher
    ├─→ strategicInitiativesAgent ─┐
    ├─→ vendorRelationshipsAgent  ─┤
    ├─→ procurementPatternsAgent  ─┼─→ intelligenceSynchronizer → intelligenceFormatter → HITL
    └─→ decisionMakersAgent       ─┘
```

### Tool Architecture

Each topic agent will have access to 3 distinct Tavily tools optimized for each search phase:

1. **Discovery Tool** - Find listing pages and main sources
   - Broad search parameters
   - Focus on finding URLs with lists (team pages, partner pages, etc.)
   - Lower result count, higher relevance threshold

2. **Extraction Tool** - Extract structured data from specific URLs
   - Uses Tavily Extract API
   - Pulls names, titles, organizations, products from pages
   - Returns structured entities ready for deep-dive

3. **Deep-Dive Tool** - Research individual entities
   - Narrow, specific searches (e.g., "John Smith LinkedIn")
   - Higher result count for comprehensive coverage
   - Source-specific parameters (LinkedIn, news sites, etc.)

### Detailed Component Design

#### 1. Intelligence Dispatcher Node

**Purpose**: Orchestrate parallel intelligence gathering across all topics

**State Updates**:
```typescript
{
  intelligenceGatheringStatus: ProcessingStatus.RUNNING,
  currentStatus: "Dispatching parallel intelligence gathering...",
  parallelIntelligenceState: {
    strategicInitiatives: { status: "pending" },
    vendorRelationships: { status: "pending" },
    procurementPatterns: { status: "pending" },
    decisionMakers: { status: "pending" }
  }
}
```

**Routing**: Uses Send API to dispatch all 4 agents in parallel

#### 2. Topic-Specific Agent Architecture

Each topic follows a ReAct pattern with its own agent, tool node, and conditional router:

```
strategicInitiativesAgent → shouldContinue → strategicInitiativesTools → strategicInitiativesAgent
                                          ↘
                                            intelligenceSynchronizer
```

##### Strategic Initiatives Agent

**Graph Components**:
1. **Agent Node**: `strategicInitiativesAgent` - Makes decisions about next search
2. **Tool Node**: `strategicInitiativesTools` - Executes the 3 Tavily tools
3. **Router**: `strategicInitiativesShouldContinue` - Routes between tools and synchronizer

**State Fields**:
```typescript
{
  strategicInitiativesResearch: {
    iteration: number,
    searchQueries: string[],
    searchResults: any[],
    extractedUrls: string[],
    extractedInsights: {
      initiatives: string[],
      priorities: string[],
      timelines: string[]
    },
    quality: number,
    lastAction: "discovery" | "extraction" | "deepDive" // For debugging, not control
  }
}
```

**Tools Configuration**:
```typescript
const strategicDiscoveryTool = new TavilySearch({
  name: "strategic_discovery",
  maxResults: 5,
  searchDepth: "basic",
  topic: "news"
});

const strategicExtractTool = new TavilyExtract({
  name: "strategic_extract",
  extractionDepth: "advanced"
});

const strategicDeepDiveTool = new TavilySearch({
  name: "strategic_deepdive",
  maxResults: 10,
  searchDepth: "advanced"
});

const strategicInitiativesTools = new ToolNode([
  strategicDiscoveryTool,
  strategicExtractTool,
  strategicDeepDiveTool
]);
```

**shouldContinue Router Logic**:
```typescript
function strategicInitiativesShouldContinue(state) {
  const research = state.strategicInitiativesResearch;
  const config = state.adaptiveResearchConfig?.topics?.find(
    t => t.topic === "strategic initiatives and priorities"
  );
  
  // Check if we've hit max attempts
  if (research.iteration >= (config?.maxAttempts || 3)) {
    return "synchronizer";
  }
  
  // Check if quality threshold is met
  if (research.quality >= (config?.minimumQualityThreshold || 0.5)) {
    return "synchronizer";
  }
  
  // Otherwise, let the agent continue
  return END; // Agent will decide next action
}
```

**Agent Prompt Structure**:
```
You are a strategic initiatives researcher for {company} in {industry}.

CURRENT STATE:
- Iteration: {iteration}
- URLs discovered: {extractedUrls.length}
- Entities extracted: {extractedInsights.initiatives.length}
- Current quality score: {quality}
- Minimum quality threshold: {minimumQualityThreshold}

AVAILABLE TOOLS:
- strategic_discovery: Find pages about strategy and initiatives
- strategic_extract: Extract initiatives from specific URLs 
- strategic_deepdive: Research specific initiatives in detail

YOUR GOAL:
Gather comprehensive intelligence about strategic initiatives until you reach a quality score of {minimumQualityThreshold} or higher.

DECISION MAKING:
- If you need to find sources → use strategic_discovery
- If you have promising URLs → use strategic_extract to get structured data
- If you have extracted entities → use strategic_deepdive to research them individually
- You decide the best approach based on what you've gathered so far

The system will stop you after {maxAttempts} attempts or when quality threshold is met.
Make each search count - quality over quantity.
```

##### Vendor Relationships Agent

**State Fields**:
```typescript
{
  vendorRelationshipsResearch: {
    iteration: number,
    searchQueries: string[],
    searchResults: any[],
    extractedUrls: string[],
    extractedVendors: Array<{
      name: string,
      type: string,
      relationship: string
    }>,
    quality: number
  }
}
```

**Focus**: Partners, vendors, integrations, technology stack

##### Procurement Patterns Agent

**State Fields**:
```typescript
{
  procurementPatternsResearch: {
    iteration: number,
    searchQueries: string[],
    searchResults: any[],
    extractedUrls: string[],
    extractedContracts: Array<{
      vendor: string,
      amount: string,
      date: string,
      type: string
    }>,
    quality: number
  }
}
```

**Focus**: Government contracts, RFP history, spending patterns
**Special Sources**: sam.gov, usaspending.gov

##### Decision Makers Agent

**State Fields**:
```typescript
{
  decisionMakersResearch: {
    iteration: number,
    searchQueries: string[],
    searchResults: any[],
    extractedUrls: string[],
    extractedPeople: Array<{
      name: string,
      title: string,
      linkedinUrl?: string,
      background?: string
    }>,
    quality: number
  }
}
```

**Focus**: Leadership team, key executives, board members
**Progressive Search**: Team pages → Extract names → LinkedIn searches

#### 3. Intelligence Synchronizer

**Purpose**: Wait for all parallel agents to complete or timeout

**Logic**:
```typescript
function shouldProceedToSynthesis(state) {
  const topics = [
    state.strategicInitiativesResearch,
    state.vendorRelationshipsResearch,
    state.procurementPatternsResearch,
    state.decisionMakersResearch
  ];
  
  // Check if all complete or timed out
  const allComplete = topics.every(t => 
    t?.phase === "complete" || t?.quality > 0.6
  );
  
  // Or if we've been running too long (e.g., 10 iterations)
  const timeout = state.intelligenceIterations > 10;
  
  return allComplete || timeout;
}
```

#### 4. Modified Intelligence Formatter

Update to pull from parallel state fields instead of centralized arrays.

## Tool Implementation Details

### Important: Package Selection

Based on current best practices:
- **Preferred**: `import { TavilySearch } from "@langchain/tavily"`
- **Fallback if issues**: `import { TavilySearchResults } from "@langchain/community/tools/tavily_search"`

Note: The community package may still be used in examples, but `@langchain/tavily` is the recommended approach.

### Creating the 3-Tool Pattern

Each topic agent needs its own set of 3 tools that return Command objects to update state:

```typescript
// tools/parallel-intelligence-tools.ts

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Command } from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import { TavilySearch } from "@langchain/tavily";  // Or TavilySearchResults from community if needed

// Factory function to create topic-specific tools
export function createTopicTools(topic: string) {
  // 1. Discovery Tool - Find listing pages
  const discoveryTool = tool(
    async ({ query }: { query: string }, config) => {
      const tavily = new TavilySearch({
        maxResults: 5,
        includeAnswer: true,
        includeRawContent: true,
      });
      
      const searchResult = await tavily.invoke({ query });
      const results = typeof searchResult === 'string' 
        ? JSON.parse(searchResult) 
        : searchResult;
      
      // Find promising URLs for extraction
      const promisingUrls = identifyPromisingUrls(results, topic);
      
      // Return Command to update state
      return new Command({
        update: {
          [`${topic}Research`]: {
            searchQueries: [query],
            searchResults: results,
            promisingUrls,
            lastAction: "discovery"
          },
          messages: [
            new ToolMessage({
              content: `Found ${results.length} results with ${promisingUrls.length} promising URLs`,
              tool_call_id: config.toolCall?.id || "",
            })
          ]
        }
      });
    },
    {
      name: `${topic}_discovery`,
      description: `Find main pages and sources about ${topic}`,
      schema: z.object({
        query: z.string().describe("Simple discovery query")
      })
    }
  );

  // 2. Extraction Tool - Extract from URLs
  const extractionTool = tool(
    async ({ url, extractionType }: { url: string; extractionType: string }, config) => {
      // Note: Tavily Extract API is not yet in LangChain.js
      // Workaround: Use targeted search on the specific URL
      const tavily = new TavilySearch({
        maxResults: 1,
        includeRawContent: true,
        includeDomains: [new URL(url).hostname]
      });
      
      const extracted = await tavily.invoke({ query: url });
      const content = typeof extracted === 'string' 
        ? JSON.parse(extracted) 
        : extracted;
      
      // Parse entities based on extraction type
      const entities = await parseEntitiesFromContent(content, extractionType);
      
      // Limit entities to prevent excessive deep-dive searches
      const MAX_ENTITIES_PER_EXTRACTION = 5;
      const limitedEntities = entities.slice(0, MAX_ENTITIES_PER_EXTRACTION);
      
      return new Command({
        update: {
          [`${topic}Research`]: {
            extractedUrls: [url],
            extractedEntities: limitedEntities,
            lastAction: "extraction"
          },
          messages: [
            new ToolMessage({
              content: `Extracted ${limitedEntities.length} ${extractionType} from ${url}`,
              tool_call_id: config.toolCall?.id || "",
            })
          ]
        }
      });
    },
    {
      name: `${topic}_extract`,
      description: `Extract structured data from URLs for ${topic}`,
      schema: z.object({
        url: z.string().url(),
        extractionType: z.enum(["people", "organizations", "products", "auto"])
      })
    }
  );

  // 3. Deep-Dive Tool - Research entities
  const deepDiveTool = tool(
    async ({ entity, entityType }: { entity: string; entityType: string }, config) => {
      const domains = getDomainsForEntityType(entityType);
      const tavily = new TavilySearch({
        maxResults: 10,
        includeAnswer: true,
        ...(domains.length > 0 && { includeDomains: domains })
      });
      
      const query = buildEntityQuery(entity, entityType);
      const searchResult = await tavily.invoke({ query });
      const results = typeof searchResult === 'string' 
        ? JSON.parse(searchResult) 
        : searchResult;
      
      // Extract key insights about the entity
      const insights = extractEntityInsights(results, entity, entityType);
      
      return new Command({
        update: {
          [`${topic}Research`]: {
            entitySearches: [{ entity, results: insights }],
            lastAction: "deepDive"
          },
          messages: [
            new ToolMessage({
              content: `Deep-dive on ${entity}: Found ${insights.length} key insights`,
              tool_call_id: config.toolCall?.id || "",
            })
          ]
        }
      });
    },
    {
      name: `${topic}_deepdive`,
      description: `Deep research on specific ${topic} entities`,
      schema: z.object({
        entity: z.string(),
        entityType: z.enum(["person", "organization", "product", "initiative"])
      })
    }
  );

  return [discoveryTool, extractionTool, deepDiveTool];
}

// Helper functions using LLM for intelligent decisions
async function identifyPromisingUrls(results: any[], topic: string): Promise<string[]> {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307",
    temperature: 0,
  });
  
  // Define schema for structured output
  const UrlAnalysisSchema = z.object({
    urls: z.array(z.object({
      url: z.string(),
      relevanceScore: z.number().min(0).max(1),
      reasoning: z.string()
    })).describe("Top 3 URLs worth extracting, ordered by relevance")
  });
  
  const structuredModel = model.withStructuredOutput(UrlAnalysisSchema);
  
  const prompt = `Analyze these search results to find URLs worth extracting detailed information from.
Topic: ${topic}

Search Results:
${results.map((r, i) => `${i+1}. Title: ${r.title || 'No title'}
   URL: ${r.url}
   Snippet: ${r.snippet || r.content?.substring(0, 200) || 'No snippet'}`).join('\n\n')}

For the topic "${topic}", identify URLs most likely to contain:
- Structured lists of relevant entities (people, organizations, products)
- Primary sources with detailed information
- Official pages rather than aggregators or news summaries

Consider these examples (but adapt based on the actual topic):
- For leadership/decision makers: team pages, about us sections, board member lists
- For vendors/partnerships: partner directories, integration pages, customer showcases  
- For strategic initiatives: official strategy documents, investor relations, company announcements
- For procurement: government contract databases, award notices, vendor registrations

Score each URL from 0-1 based on likelihood of containing extractable structured data.`;

  try {
    const response = await structuredModel.invoke(prompt);
    // Return top 2 URLs per topic to prevent excessive extractions
    return response.urls
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 2)  // Changed from 3 to 2
      .map(item => item.url);
  } catch (error) {
    console.error("Error identifying promising URLs:", error);
    // Simple fallback
    return results.slice(0, 2).map(r => r.url);  // Changed from 3 to 2
  }
}

async function parseEntitiesFromContent(content: any, extractionType: string): Promise<any[]> {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307", 
    temperature: 0,
  });
  
  // Dynamic schema based on extraction type
  const entitySchemas = {
    people: z.object({
      entities: z.array(z.object({
        name: z.string(),
        title: z.string().optional(),
        department: z.string().optional(),
        linkedIn: z.string().optional(),
        type: z.literal("person")
      }))
    }),
    organizations: z.object({
      entities: z.array(z.object({
        name: z.string(),
        relationship: z.string().optional(),
        description: z.string().optional(),
        website: z.string().optional(),
        type: z.literal("organization")
      }))
    }),
    products: z.object({
      entities: z.array(z.object({
        name: z.string(),
        category: z.string().optional(),
        description: z.string().optional(),
        type: z.literal("product")
      }))
    }),
    auto: z.object({
      entities: z.array(z.object({
        name: z.string(),
        type: z.enum(["person", "organization", "product", "initiative"]),
        metadata: z.record(z.string()).optional()
      }))
    })
  };
  
  const schema = entitySchemas[extractionType] || entitySchemas.auto;
  const structuredModel = model.withStructuredOutput(schema);
  
  const prompt = `Extract structured entities from this content.
Extraction type: ${extractionType}

Content:
${JSON.stringify(content, null, 2)}

Extract all relevant ${extractionType} with as much detail as available.`;

  try {
    const response = await structuredModel.invoke(prompt);
    return response.entities;
  } catch (error) {
    console.error("Error parsing entities:", error);
    return [];
  }
}

async function buildEntityQuery(entity: string, entityType: string, context: any): Promise<string> {
  const model = new ChatAnthropic({
    modelName: "claude-3-haiku-20240307",
    temperature: 0,
  });
  
  const QuerySchema = z.object({
    query: z.string().max(100).describe("Optimized search query"),
    searchDomains: z.array(z.string()).optional().describe("Recommended domains to search")
  });
  
  const structuredModel = model.withStructuredOutput(QuerySchema);
  
  const prompt = `Generate an optimal search query for researching this entity.

Entity: ${entity}
Entity Type: ${entityType}
Company Context: ${context.company || 'Unknown'}
Industry: ${context.industry || 'Unknown'}

Create a focused query that will find:
- For people: Professional profiles, recent roles, background
- For organizations: Partnerships, collaborations, business relationships
- For products: Features, reviews, implementations
- For initiatives: Goals, timelines, outcomes

Keep the query under 100 characters and natural-sounding.
Suggest specific domains if relevant (e.g., linkedin.com for people).`;

  try {
    const response = await structuredModel.invoke(prompt);
    // Store domains for use in search configuration
    if (response.searchDomains) {
      context.suggestedDomains = response.searchDomains;
    }
    return response.query;
  } catch (error) {
    console.error("Error building entity query:", error);
    // Simple fallback
    return `${entity} ${context.company || ''}`.trim();
  }
}

function extractEntityInsights(results: any[], entity: string, entityType: string): any[] {
  // Process search results to extract key insights
  // This remains a simple function as it's just data transformation
  return results.map(r => ({
    source: r.url,
    title: r.title,
    insight: r.snippet || r.content?.substring(0, 300),
    relevance: r.title?.toLowerCase().includes(entity.toLowerCase()) ? 'high' : 'medium'
  }));
}
```

### Tool Node Configuration

```typescript
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { createTopicTools } from "./tools/parallel-intelligence-tools.js";

// Create tools for each topic
const strategicTools = createTopicTools("strategic_initiatives");
const vendorTools = createTopicTools("vendor_relationships");
const procurementTools = createTopicTools("procurement_patterns");
const decisionTools = createTopicTools("decision_makers");

// Create ToolNode instances
const strategicToolNode = new ToolNode(strategicTools);
const vendorToolNode = new ToolNode(vendorTools);
const procurementToolNode = new ToolNode(procurementTools);
const decisionToolNode = new ToolNode(decisionTools);
```

## Implementation Steps

### Phase 1: Create New Nodes (Week 1)

1. Create `parallel-intelligence/` directory structure
2. Implement `intelligence-dispatcher.ts`
3. Implement 4 topic agent files:
   - `strategic-initiatives-agent.ts`
   - `vendor-relationships-agent.ts`
   - `procurement-patterns-agent.ts`
   - `decision-makers-agent.ts`
4. Implement `intelligence-synchronizer.ts`

### Phase 2: Update State (Week 1)

1. Add new parallel state fields to annotations
2. Keep existing fields for backwards compatibility
3. Add migration logic in dispatcher

### Phase 3: Update Graph

#### Graph Architecture

Following the RFP analysis pattern, each topic gets its own ReAct subgraph:

```typescript
// Main parallel dispatch
proposalGenerationGraph.addNode(NODES.INTEL_DISPATCHER, intelligenceDispatcher);

// Strategic Initiatives Subgraph
proposalGenerationGraph.addNode(NODES.STRATEGIC_AGENT, strategicInitiativesAgent);
proposalGenerationGraph.addNode(NODES.STRATEGIC_TOOLS, strategicToolNode); // ToolNode instance

// Vendor Relationships Subgraph  
proposalGenerationGraph.addNode(NODES.VENDOR_AGENT, vendorRelationshipsAgent);
proposalGenerationGraph.addNode(NODES.VENDOR_TOOLS, vendorToolNode); // ToolNode instance

// Procurement Patterns Subgraph
proposalGenerationGraph.addNode(NODES.PROCUREMENT_AGENT, procurementPatternsAgent);
proposalGenerationGraph.addNode(NODES.PROCUREMENT_TOOLS, procurementToolNode); // ToolNode instance

// Decision Makers Subgraph
proposalGenerationGraph.addNode(NODES.DECISION_AGENT, decisionMakersAgent);
proposalGenerationGraph.addNode(NODES.DECISION_TOOLS, decisionToolNode); // ToolNode instance

// Synchronizer
proposalGenerationGraph.addNode(NODES.INTEL_SYNCHRONIZER, intelligenceSynchronizer);

// Edges - Parallel dispatch using Send API
proposalGenerationGraph.addConditionalEdges(
  NODES.INTEL_DISPATCHER,
  parallelIntelligenceRouter // Returns Send commands to all 4 agents
);

// Each agent has its own ReAct loop
// Strategic Initiatives
proposalGenerationGraph.addConditionalEdges(
  NODES.STRATEGIC_AGENT,
  strategicInitiativesShouldContinue,
  {
    synchronizer: NODES.INTEL_SYNCHRONIZER
    // Note: No 'tools' route here - agent handles tool calls via AIMessage
  }
);
// Tools always return to agent
proposalGenerationGraph.addEdge(NODES.STRATEGIC_TOOLS, NODES.STRATEGIC_AGENT);

// Vendor Relationships
proposalGenerationGraph.addConditionalEdges(
  NODES.VENDOR_AGENT,
  vendorRelationshipsShouldContinue,
  {
    synchronizer: NODES.INTEL_SYNCHRONIZER
  }
);
proposalGenerationGraph.addEdge(NODES.VENDOR_TOOLS, NODES.VENDOR_AGENT);

// Procurement Patterns
proposalGenerationGraph.addConditionalEdges(
  NODES.PROCUREMENT_AGENT,
  procurementPatternsShouldContinue,
  {
    synchronizer: NODES.INTEL_SYNCHRONIZER
  }
);
proposalGenerationGraph.addEdge(NODES.PROCUREMENT_TOOLS, NODES.PROCUREMENT_AGENT);

// Decision Makers
proposalGenerationGraph.addConditionalEdges(
  NODES.DECISION_AGENT,
  decisionMakersShouldContinue,
  {
    synchronizer: NODES.INTEL_SYNCHRONIZER
  }
);
proposalGenerationGraph.addEdge(NODES.DECISION_TOOLS, NODES.DECISION_AGENT);

// Synchronizer to formatter
proposalGenerationGraph.addEdge(NODES.INTEL_SYNCHRONIZER, NODES.INTELLIGENCE_FORMATTER);
```

#### How Tool Execution Works

The agents don't route to tools via conditional edges. Instead:

1. **Agent generates tool calls**: The agent returns an AIMessage with tool_calls
2. **LangGraph handles routing**: When an AIMessage has tool_calls, LangGraph automatically routes to the ToolNode
3. **ToolNode executes**: The ToolNode runs the tools and generates ToolMessages
4. **Return to agent**: The edge from ToolNode back to agent ensures the loop continues

Example agent implementation:
```typescript
export async function strategicInitiativesAgent(state, config) {
  const model = new ChatAnthropic({ modelName: "claude-3-5-sonnet-20241022" });
  
  // Bind the 3 tools
  const tools = createTopicTools("strategic_initiatives");
  const modelWithTools = model.bindTools(tools);
  
  // Generate response with tool calls
  const response = await modelWithTools.invoke([
    new SystemMessage(agentPrompt),
    new HumanMessage("Research strategic initiatives")
  ]);
  
  // Return the AIMessage with tool_calls
  // LangGraph will automatically route to ToolNode if tool_calls exist
  return { messages: [response] };
}
```

#### Parallel Router Implementation

```typescript
function parallelIntelligenceRouter(state) {
  // Dispatch all 4 agents in parallel
  return [
    new Send(NODES.STRATEGIC_AGENT, state),
    new Send(NODES.VENDOR_AGENT, state),
    new Send(NODES.PROCUREMENT_AGENT, state),
    new Send(NODES.DECISION_AGENT, state),
  ];
}
```

### Phase 4: Testing & Verification

1. Test parallel execution with real examples
2. Verify state management and synchronization
3. Monitor recursion depth and token usage
4. Validate quality thresholds are working

## Benefits of This Approach

1. **Natural Parallelism**: All topics research simultaneously
2. **Isolated State**: Each agent manages only its topic
3. **Clear Phases**: Each agent internally handles its 3-phase progression
4. **Recursion Limits**: Each agent gets its own recursion budget
5. **Easy Debugging**: Can trace individual topic workflows
6. **Flexible Quality**: Can proceed when "good enough" across topics

## Example Execution Flow

```
1. User provides company "Acme Corporation"
2. Dispatcher creates 4 parallel searches
3. Each agent independently decides its approach:
   - May start with discovery searches
   - When it finds good URLs, switches to extraction
   - After extracting entities, researches them individually
   - Continues until quality threshold met or max attempts reached
4. Synchronizer waits for all agents to complete
5. Formatter creates unified briefing
6. HITL review as before
```

## Implementation Strategy

1. **Build Fresh**: Create new parallel implementation alongside existing
2. **Test Thoroughly**: Validate with multiple real-world examples
3. **Replace When Ready**: Switch over once parallel version is proven
4. **Clean Up**: Remove old sequential implementation after switch

## Code Structure

```
apps/backend/agents/proposal-generation/nodes/planning/
├── intelligence-gathering/          # Existing sequential (deprecated)
└── parallel-intelligence/          # New parallel implementation
    ├── index.ts                   # Exports all nodes
    ├── intelligence-dispatcher.ts  # Orchestrator
    ├── agents/
    │   ├── strategic-initiatives.ts
    │   ├── vendor-relationships.ts
    │   ├── procurement-patterns.ts
    │   └── decision-makers.ts
    ├── intelligence-synchronizer.ts
    └── types.ts                   # Shared types
```

## State Interface Updates

```typescript
// Add to annotations.ts
export const ParallelIntelligenceAnnotation = Annotation.Root({
  parallelIntelligenceState: Annotation<{
    strategicInitiatives: TopicState,
    vendorRelationships: TopicState,
    procurementPatterns: TopicState,
    decisionMakers: TopicState
  }>,
  
  // Individual topic research states
  strategicInitiativesResearch: Annotation<TopicResearch>,
  vendorRelationshipsResearch: Annotation<TopicResearch>,
  procurementPatternsResearch: Annotation<TopicResearch>,
  decisionMakersResearch: Annotation<TopicResearch>,
});

interface TopicState {
  status: "pending" | "running" | "complete" | "error";
  quality?: number;
  errorMessage?: string;
}

interface TopicResearch {
  searchQueries: string[];
  searchResults: any[];
  extractedUrls: string[];
  extractedEntities: any[];
  quality: number;
  attempts: number;
  lastAction?: "discovery" | "extraction" | "deepDive"; // For debugging only
}
```

## Success Metrics

1. **Reduced Execution Time**: Parallel should be 3-4x faster
2. **Better Quality**: Each topic gets focused attention
3. **Lower Recursion**: No single topic hits limits
4. **Clearer Results**: Each topic has dedicated state
5. **Easier Maintenance**: Simpler, focused agents

## Risks & Mitigations

1. **Risk**: State explosion
   - **Mitigation**: Careful state design, reuse types

2. **Risk**: Coordination complexity
   - **Mitigation**: Simple synchronizer pattern from RFP

3. **Risk**: Tool rate limits
   - **Mitigation**: Built-in delays, respect API limits

4. **Risk**: Incomplete topics
   - **Mitigation**: Quality thresholds, timeout handling

## Summary: Key Advantages of 3-Tool Parallel Architecture

### 1. **Clear Phase Separation**
- Each tool is optimized for its specific phase
- No confusion about which tool to use when
- Natural progression: discovery → extraction → deep-dive

### 2. **Parallel Execution Benefits**
- All 4 topics research simultaneously
- Each gets dedicated recursion budget (10 iterations each)
- Total time: ~10 iterations vs 40+ sequential

### 3. **Simplified Agent Logic**
- Each agent only worries about its own topic
- No cross-topic state management
- Clear shouldContinue conditions per topic

### 4. **Tool Specialization**
- Discovery tool: Optimized for finding listing pages
- Extraction tool: Purpose-built for structured data extraction
- Deep-dive tool: Configured for entity-specific research

### 5. **Graph Clarity**
- Each topic has its own ReAct loop
- Synchronizer provides single coordination point
- Follows proven RFP analysis pattern

### 6. **Debugging Advantages**
- Can trace individual topic workflows
- Each agent's decision-making is autonomous
- State is isolated per topic

## Example Tool Usage Flow (Agent-Driven)

```
Strategic Agent might choose:
Iteration 1: strategic_discovery("Acme Corp strategic priorities")
Iteration 2: strategic_extract({url: "acmecorp.com/strategy", type: "auto"})
Iteration 3: strategic_deepdive({entity: "Digital Transformation", type: "initiative"})
Iteration 4: strategic_deepdive({entity: "Cloud Migration", type: "initiative"})
[Stops at quality threshold 0.7]

Vendor Agent might choose:
Iteration 1: vendor_discovery("Acme Corp technology partners")
Iteration 2: vendor_discovery("Acme Corp vendor ecosystem") // Not satisfied with first results
Iteration 3: vendor_extract({url: "acmecorp.com/partners", type: "organizations"})
Iteration 4: vendor_deepdive({entity: "Microsoft", type: "organization"})
[Continues until quality threshold]

Decision Makers Agent might choose:
Iteration 1: decision_discovery("Acme Corp executive team")
Iteration 2: decision_extract({url: "acmecorp.com/leadership", type: "people"})
Iteration 3: decision_deepdive({entity: "Jane Smith CEO", type: "person"})
Iteration 4: decision_extract({url: "acmecorp.com/board", type: "people"}) // Found another source
[Each agent makes its own decisions based on results]
```

## Next Steps

1. Review and approve this plan
2. Create feature branch `parallel-intelligence`
3. Implement tool factory function first
4. Start with dispatcher and one agent (e.g., decision makers)
5. Test single agent flow end-to-end
6. Add remaining 3 agents
7. Test parallel execution with real examples
8. Deploy behind feature flag