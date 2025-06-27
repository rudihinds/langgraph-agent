/**
 * Adaptive Search Utilities
 * 
 * Provides functions for search quality assessment and strategy adaptation
 * to improve intelligence gathering when initial searches return inadequate data.
 */

import { SearchStrategy, SearchQualityScore, SearchAttempt } from "@/state/modules/types.js";

/**
 * Assess the quality of search results
 */
export function assessSearchQuality(
  results: any[],
  query: string,
  topic: string
): SearchQualityScore {
  console.log(`[Quality Assessment] Evaluating results for topic: "${topic}"`);
  
  // Count results
  const resultCount = results?.length || 0;
  
  // Calculate relevance based on keyword matching
  const relevance = calculateRelevance(results, query, topic);
  
  // Assess source credibility
  const sourceCredibility = assessSourceCredibility(results);
  
  // Evaluate completeness
  const completeness = evaluateCompleteness(results, topic);
  
  // Calculate overall score
  const overall = (relevance * 0.4 + sourceCredibility * 0.3 + completeness * 0.3);
  
  return {
    overall,
    resultCount,
    relevance,
    sourceCredibility,
    completeness,
    breakdown: {
      hasOfficialSources: checkOfficialSources(results),
      hasRecentInfo: checkRecency(results),
      coversKeyAspects: completeness > 0.5,
      meetsMinimumThreshold: overall > 0.3
    }
  };
}

/**
 * Select the next search strategy based on previous attempts
 */
export function selectSearchStrategy(
  topic: string,
  previousAttempts: SearchAttempt[],
  preferredStrategies: SearchStrategy[] = []
): SearchStrategy {
  // If no previous attempts, start with standard
  if (previousAttempts.length === 0) {
    return preferredStrategies[0] || "standard";
  }
  
  const lastAttempt = previousAttempts[previousAttempts.length - 1];
  const lastQuality = lastAttempt.resultQuality;
  
  // Analyze failure patterns
  if (lastQuality.resultCount === 0) {
    // No results - try expanding or alternative phrasing
    return hasTriedStrategy(previousAttempts, "expanded") ? "alternative" : "expanded";
  }
  
  if (lastQuality.relevance < 0.3) {
    // Low relevance - try refining or source-specific
    return hasTriedStrategy(previousAttempts, "refined") ? "source_specific" : "refined";
  }
  
  if (!lastQuality.breakdown?.hasRecentInfo) {
    // No recent info - extend temporal range
    return "temporal_extended";
  }
  
  if (!lastQuality.breakdown?.hasOfficialSources) {
    // No official sources - try source-specific search
    return "source_specific";
  }
  
  // If quality is still low, try inferential approach
  if (lastQuality.overall < 0.5) {
    return "inferential";
  }
  
  // Default to next preferred strategy not yet tried
  for (const strategy of preferredStrategies) {
    if (!hasTriedStrategy(previousAttempts, strategy)) {
      return strategy;
    }
  }
  
  return "alternative";
}

/**
 * Generate an adapted search query based on strategy
 */
export function adaptSearchQuery(
  originalQuery: string,
  topic: string,
  strategy: SearchStrategy,
  context: { company?: string; industry?: string }
): string {
  switch (strategy) {
    case "discovery":
      return generateDiscoveryQuery(context.company || "", topic);
    
    case "expanded":
      return expandQuery(originalQuery, topic, context);
    
    case "refined":
      return refineQuery(originalQuery, topic, context);
    
    case "alternative":
      return generateAlternativeQuery(originalQuery, topic);
    
    case "source_specific":
      return addSourceSpecificTerms(originalQuery, topic);
    
    case "temporal_extended":
      return extendTemporalRange(originalQuery);
    
    case "inferential":
      return generateInferentialQuery(originalQuery, topic, context);
    
    case "individual":
      return generateIndividualQuery(originalQuery, context.company || "");
    
    default:
      return originalQuery;
  }
}

// Helper functions

function getCompanyVariations(company: string): string {
  // Remove common suffixes
  const baseName = company.replace(/\s+(Limited|Ltd|Inc|LLC|Corp|Corporation|Company|Co\.)$/i, '').trim();
  
  // Create variations
  const variations = [
    `"${company}"`,
    `"${baseName}"`
  ];
  
  // Add common abbreviations if applicable
  if (company.includes("Corporation")) {
    variations.push(`"${baseName} Corp"`);
  }
  if (company.includes("Limited")) {
    variations.push(`"${baseName} Ltd"`);
  }
  
  return `(${variations.join(" OR ")})`;
}

function calculateRelevance(results: any[], query: string, topic: string): number {
  if (!results || results.length === 0) return 0;
  
  const queryTerms = query.toLowerCase().split(/\s+/);
  const topicTerms = topic.toLowerCase().split(/\s+/);
  const allTerms = [...new Set([...queryTerms, ...topicTerms])];
  
  let relevanceScore = 0;
  for (const result of results) {
    const content = (result.content || "").toLowerCase();
    const title = (result.title || "").toLowerCase();
    const text = content + " " + title;
    
    const matchCount = allTerms.filter(term => text.includes(term)).length;
    relevanceScore += matchCount / allTerms.length;
  }
  
  return Math.min(relevanceScore / results.length, 1);
}

function assessSourceCredibility(results: any[]): number {
  if (!results || results.length === 0) return 0;
  
  const credibleDomains = [
    '.gov', '.edu', '.org', 
    'reuters.com', 'bloomberg.com', 'wsj.com',
    'linkedin.com', 'crunchbase.com'
  ];
  
  let credibilityScore = 0;
  for (const result of results) {
    const url = (result.url || "").toLowerCase();
    if (credibleDomains.some(domain => url.includes(domain))) {
      credibilityScore += 1;
    }
  }
  
  return Math.min(credibilityScore / results.length, 1);
}

function evaluateCompleteness(results: any[], topic: string): number {
  if (!results || results.length === 0) return 0;
  
  // Key aspects based on topic
  const topicAspects: Record<string, string[]> = {
    "strategic initiatives": ["goals", "priorities", "strategy", "initiative", "plan"],
    "vendor relationships": ["vendor", "supplier", "partner", "contract", "provider"],
    "procurement patterns": ["rfp", "bid", "contract", "award", "procurement"],
    "decision makers": ["executive", "director", "manager", "chief", "lead"]
  };
  
  const aspects = topicAspects[topic.toLowerCase()] || [];
  if (aspects.length === 0) return 0.5; // Default for unknown topics
  
  const combinedContent = results.map(r => 
    ((r.content || "") + " " + (r.title || "")).toLowerCase()
  ).join(" ");
  
  const foundAspects = aspects.filter(aspect => 
    combinedContent.includes(aspect)
  ).length;
  
  return foundAspects / aspects.length;
}

function checkOfficialSources(results: any[]): boolean {
  if (!results || results.length === 0) return false;
  
  const officialDomains = ['.gov', 'sam.gov', 'usaspending.gov'];
  return results.some(result => {
    const url = (result.url || "").toLowerCase();
    return officialDomains.some(domain => url.includes(domain));
  });
}

function checkRecency(results: any[]): boolean {
  if (!results || results.length === 0) return false;
  
  const currentYear = new Date().getFullYear();
  const recentYears = [currentYear, currentYear - 1, currentYear - 2];
  
  return results.some(result => {
    const content = (result.content || "") + " " + (result.title || "");
    return recentYears.some(year => content.includes(year.toString()));
  });
}

function hasTriedStrategy(attempts: SearchAttempt[], strategy: SearchStrategy): boolean {
  return attempts.some(attempt => attempt.strategy === strategy);
}

function expandQuery(query: string, topic: string, context: any): string {
  // Keep it simple - just add topic context to company name
  const company = context.company || query;
  const cleanCompany = company.replace(/\s+(Limited|Ltd|Inc|LLC|Corp|Corporation|Company|Co\.)$/i, '').trim();
  
  // Map topics to simple additional terms
  const topicTerms: Record<string, string> = {
    "strategic initiatives": "strategy",
    "vendor relationships": "partners",
    "procurement patterns": "contracts",
    "decision makers": "leadership",
    "key decision makers": "executives"
  };
  
  const normalizedTopic = topic.toLowerCase();
  const term = topicTerms[normalizedTopic] || topicTerms[normalizedTopic.replace(" and ", " ")] || "information";
  
  // Keep under 50 chars
  const result = `${cleanCompany} ${term}`.substring(0, 50);
  return result.trim();
}

function refineQuery(query: string, topic: string, context: any): string {
  const currentYear = new Date().getFullYear();
  const company = context.company || query;
  const cleanCompany = company.replace(/\s+(Limited|Ltd|Inc|LLC|Corp|Corporation|Company|Co\.)$/i, '').trim();
  
  // Add year for recency
  const result = `${cleanCompany} ${currentYear}`.substring(0, 50);
  return result.trim();
}

function generateAlternativeQuery(query: string, topic: string): string {
  // Try a different angle for the topic
  const alternatives: Record<string, string> = {
    "strategic initiatives": "future plans",
    "vendor relationships": "partnerships",
    "procurement patterns": "contracts",
    "decision makers": "management",
    "key decision makers": "board"
  };
  
  const normalizedTopic = topic.toLowerCase();
  const altTerm = alternatives[normalizedTopic] || alternatives[normalizedTopic.replace(" and ", " ")] || "news";
  
  // Extract company from query
  const words = query.split(' ');
  const company = words.slice(0, 2).join(' ');
  
  const result = `${company} ${altTerm}`.substring(0, 50);
  return result.trim();
}

function addSourceSpecificTerms(query: string, topic: string): string {
  // Return the query as-is since we'll use includeDomains parameter instead
  // Domain filtering is now handled in the search tool configuration
  return query;
}

function extendTemporalRange(query: string): string {
  const currentYear = new Date().getFullYear();
  // Simple year addition
  return `${query} ${currentYear - 1} ${currentYear}`;
}

function generateInferentialQuery(query: string, topic: string, context: any): string {
  // Look for industry-level information when company-specific fails
  const industry = context.industry || "business";
  const company = context.company || query;
  
  // Try industry + topic pattern
  const result = `${industry} ${topic}`.substring(0, 50);
  return result.trim();
}

/**
 * Generate discovery query for finding organization pages
 * Used in phase 1 to locate the company's main website and team pages
 */
function generateDiscoveryQuery(company: string, topic: string): string {
  // For discovery, just use company name - let Tavily do the work
  const cleanCompany = company.replace(/\s+(Limited|Ltd|Inc|LLC|Corp|Corporation|Company|Co\.)$/i, '').trim();
  
  // Keep it very simple for discovery phase
  const result = cleanCompany.substring(0, 50);
  return result.trim();
}

/**
 * Generate query for searching specific individuals
 * Used in phase 2 after extracting names from organization pages
 */
function generateIndividualQuery(name: string, company: string): string {
  // Simple query for individual searches
  const result = `${name} ${company} LinkedIn`.substring(0, 50);
  return result.trim();
}