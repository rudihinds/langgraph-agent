# Progressive Search Abstraction

## Overview
We've successfully abstracted the progressive search pattern from a hardcoded "find people → extract names → search LinkedIn" implementation to a flexible, configurable framework that supports any multi-phase search workflow.

## Architecture

### 1. Progressive Search Framework (`progressive-search-framework.ts`)
The core abstraction that defines:
- **Three-phase pattern**: Discovery → Extraction → Deep-dive
- **Configurable components**: Search queries, entity extractors, validation rules, enrichment fields
- **Quality assessment**: Built-in quality tracking for each phase
- **Error handling**: Multiple strategies (fail, continue, retry, fallback)

### 2. Progressive Search Integration (`progressive-search-integration.ts`)
Bridges the framework with LangGraph:
- **Registry pattern**: Maps topics to search configurations
- **Dynamic selection**: Automatically chooses progressive search when appropriate
- **State integration**: Converts between LangGraph state and search context
- **Guidance generation**: Provides phase-specific instructions to the LLM

### 3. Pre-built Configurations
Ready-to-use configurations for common patterns:

#### People Search
```typescript
"decision makers" → PEOPLE_SEARCH_CONFIG
- Discovery: Find team/about/leadership pages
- Extraction: Extract names, titles, departments
- Deep-dive: Search LinkedIn profiles, gather experience
```

#### Product Search
```typescript
"products and services" → PRODUCT_SEARCH_CONFIG
- Discovery: Find product/solution pages
- Extraction: Extract product names, categories
- Deep-dive: Research features, pricing, reviews
```

#### Vendor Search
```typescript
"vendor relationships" → VENDOR_SEARCH_CONFIG
- Discovery: Find procurement/contract pages
- Extraction: Extract vendor names, contract values
- Deep-dive: Research capabilities, certifications
```

## Usage Examples

### 1. Adding a New Progressive Search Pattern

```typescript
// Define entity types
interface NewsItem {
  headline: string;
  date: string;
  source: string;
}

interface EnrichedNewsItem extends NewsItem {
  sentiment: string;
  impact: string[];
  relatedCompanies: string[];
}

// Create configuration
const NEWS_SEARCH_CONFIG: ProgressiveSearchConfig<any, NewsItem, EnrichedNewsItem> = {
  discovery: {
    searchQueries: (ctx) => [
      `"${ctx.baseQuery}" news announcements ${new Date().getFullYear()}`,
      `"${ctx.baseQuery}" press releases`
    ],
    sourcePatterns: [
      { urlPattern: /\/(news|press|announcements)/i, priority: 10 }
    ],
    minSources: 5,
    maxSources: 20,
    qualityThreshold: { minScore: 0.6, minConfidence: 0.5, minCompleteness: 0.4 }
  },
  extraction: {
    entityExtractor: {
      extract: async (source) => extractNewsItems(source),
      confidence: (item) => item.date ? 0.9 : 0.5
    },
    validationRules: [
      { name: "hasDate", validate: (item) => !!item.date, severity: "error" }
    ],
    deduplicationStrategy: {
      generateKey: (item) => item.headline.toLowerCase()
    },
    minEntities: 10,
    maxEntities: 50
  },
  deepDive: {
    searchTemplate: (item) => [
      { template: `"${item.headline}" impact analysis`, requiredFields: ["impact"], optional: false }
    ],
    enrichmentFields: [
      {
        fieldName: "sentiment",
        extractor: async (item, sources) => analyzeSentiment(sources),
        required: false
      }
    ],
    parallelism: 5,
    timeoutMs: 30000,
    qualityThreshold: { minScore: 0.7, minConfidence: 0.6, minCompleteness: 0.5 }
  },
  global: {
    maxRetries: 2,
    errorHandling: "continue"
  }
};

// Register with the system
const registry = ProgressiveSearchRegistry.getInstance();
registry.registerConfig("news_search", NEWS_SEARCH_CONFIG);
registry.mapTopicToConfig("strategic initiatives", "news_search");
registry.mapTopicToConfig("recent announcements", "news_search");
```

### 2. Using Progressive Search in Research Agent

The research agent now automatically:
1. Checks if a topic supports progressive search
2. Generates appropriate guidance for each phase
3. Recommends the correct search strategy
4. Tracks quality and triggers phase transitions

```typescript
// The integration handles all of this automatically:
const progressiveIntegration = createProgressiveSearchIntegration();

// Generate guidance for current topics
const guidance = progressiveIntegration.generateProgressiveGuidance(
  topicsToSearch,
  state
);

// Check if we should use progressive search
const check = progressiveIntegration.shouldUseProgressiveSearch(
  topic,
  searchCount,
  quality,
  state
);

// Get recommended strategy for current phase
const strategy = progressiveIntegration.recommendSearchStrategy(topic, state);
```

### 3. Custom Configuration at Runtime

```typescript
// Override specific settings for a search
const peopleSearcher = createPeopleSearcher({
  discovery: {
    maxSources: 30  // Increase for comprehensive search
  },
  deepDive: {
    parallelism: 10  // Speed up enrichment
  }
});
```

## Benefits of the Abstraction

### 1. **Reusability**
- Same pattern works for people, products, vendors, news, competitors, etc.
- No code duplication between different search types

### 2. **Maintainability**
- Add new search patterns without modifying core logic
- Configuration changes don't require code changes

### 3. **Flexibility**
- Configure thresholds, parallelism, and strategies per use case
- Override settings at runtime based on context

### 4. **Testability**
- Test each configuration independently
- Mock extractors and enrichers for unit tests
- Validate phase transitions separately

### 5. **Extensibility**
- Easy to add new entity types
- Custom extractors for specialized content
- Plugin architecture for enrichment sources

## Migration Path

To migrate existing searches to progressive:

1. Define entity types (discovery, extracted, enriched)
2. Create configuration with appropriate patterns
3. Register with the progressive search registry
4. Map relevant topics to the configuration
5. The system handles the rest automatically

## Future Enhancements

1. **Machine Learning Integration**
   - Learn optimal search patterns from successful searches
   - Automatically adjust quality thresholds

2. **Caching Layer**
   - Cache discovery results for repeated searches
   - Share extracted entities across searches

3. **Parallel Phase Execution**
   - Run discovery for multiple topics simultaneously
   - Pipeline extraction while discovery continues

4. **Dynamic Configuration**
   - Adjust configuration based on RFP requirements
   - User preferences for search depth/quality

This abstraction transforms progressive search from a specific implementation detail into a powerful, reusable pattern that can enhance any multi-phase information gathering workflow.