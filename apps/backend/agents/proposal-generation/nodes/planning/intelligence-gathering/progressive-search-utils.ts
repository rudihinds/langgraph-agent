/**
 * Progressive Search Utilities
 * 
 * Implements the two-phase progressive search approach:
 * 1. Discovery: Find organization pages (team, about, people)
 * 2. Extraction: Extract names and search for individuals
 */

// Progressive search utilities - no imports needed for now

/**
 * Patterns to identify team/people pages from URLs and titles
 */
const TEAM_PAGE_PATTERNS = [
  /\/(?:team|people|leadership|about|staff|directors|board|management|executives)(?:\/|$|\?|#)/i,
  /(?:meet|our)[\s-](?:team|people|leadership|staff)/i,
  /(?:who[\s-]we[\s-]are|about[\s-]us)/i
];

/**
 * Patterns to identify company domain URLs
 */
const COMPANY_DOMAIN_PATTERNS = [
  /^https?:\/\/(?:www\.)?([^\/]+)$/,
  /^https?:\/\/(?:www\.)?([^\/]+)\/(?:about|team|people|leadership)/
];

/**
 * Check if a URL is likely a team/people page
 */
export function isTeamPage(url: string, title?: string): boolean {
  // Check URL patterns
  for (const pattern of TEAM_PAGE_PATTERNS) {
    if (pattern.test(url)) return true;
  }
  
  // Check title if available
  if (title) {
    const lowerTitle = title.toLowerCase();
    if (
      lowerTitle.includes("team") ||
      lowerTitle.includes("people") ||
      lowerTitle.includes("leadership") ||
      lowerTitle.includes("staff") ||
      lowerTitle.includes("who we are")
    ) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract company domain from search results
 */
export function extractCompanyDomain(searchResults: any[]): string | null {
  if (!searchResults || searchResults.length === 0) return null;
  
  // Look for official company pages
  for (const result of searchResults) {
    const url = result.url || "";
    
    // Check if it's likely the company's main site
    for (const pattern of COMPANY_DOMAIN_PATTERNS) {
      const match = url.match(pattern);
      if (match) {
        const domain = match[1];
        // Basic validation - should have at least one dot
        if (domain.includes(".")) {
          console.log(`[Progressive Search] Found company domain: ${domain}`);
          return domain;
        }
      }
    }
  }
  
  return null;
}

/**
 * Identify team pages from search results
 */
export function findTeamPages(searchResults: any[]): string[] {
  const teamPages: string[] = [];
  
  for (const result of searchResults) {
    const url = result.url || "";
    const title = result.title || "";
    
    if (isTeamPage(url, title)) {
      teamPages.push(url);
      console.log(`[Progressive Search] Found team page: ${title} - ${url}`);
    }
  }
  
  return teamPages;
}

/**
 * Extract name patterns from content
 * This is a simple implementation - in production, you'd use NER
 */
export function extractNamesFromContent(content: string): string[] {
  const names: Set<string> = new Set();
  
  // Common patterns for names in team pages
  const namePatterns = [
    // Name, Title pattern
    /([A-Z][a-z]+ (?:[A-Z]\. )?[A-Z][a-z]+)(?:,\s*(?:CEO|CFO|CTO|Director|Manager|President|Vice President|VP|Head of|Chief))/g,
    // Title: Name pattern  
    /(?:CEO|CFO|CTO|Director|Manager|President|Vice President|VP|Head of|Chief)[:\s]+([A-Z][a-z]+ (?:[A-Z]\. )?[A-Z][a-z]+)/g,
    // Name in heading tags (assuming cleaned content)
    /<h[1-6][^>]*>([A-Z][a-z]+ (?:[A-Z]\. )?[A-Z][a-z]+)<\/h[1-6]>/g
  ];
  
  for (const pattern of namePatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const name = match[1].trim();
      // Basic validation - should be 2-4 words
      const words = name.split(/\s+/);
      if (words.length >= 2 && words.length <= 4) {
        names.add(name);
      }
    }
  }
  
  return Array.from(names);
}

/**
 * Score names by importance based on title/context
 */
export function scoreNamesByImportance(
  namesWithContext: Array<{ name: string; context: string }>
): Array<{ name: string; score: number }> {
  const scores: Map<string, number> = new Map();
  
  const titleScores: Record<string, number> = {
    "ceo": 10,
    "chief executive": 10,
    "president": 9,
    "cto": 8,
    "cfo": 8,
    "chief": 8,
    "vice president": 7,
    "vp": 7,
    "director": 6,
    "head of": 6,
    "manager": 5,
    "lead": 4
  };
  
  for (const { name, context } of namesWithContext) {
    let score = 1; // Base score
    const lowerContext = context.toLowerCase();
    
    // Check for title keywords
    for (const [title, titleScore] of Object.entries(titleScores)) {
      if (lowerContext.includes(title)) {
        score = Math.max(score, titleScore);
      }
    }
    
    scores.set(name, score);
  }
  
  return Array.from(scores.entries())
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Determine if progressive search should be activated
 */
export function shouldUseProgressiveSearch(
  topic: string,
  searchCount: number,
  resultQuality: number
): boolean {
  // Always use for decision makers topics
  if (topic.toLowerCase().includes("decision makers") || 
      topic.toLowerCase().includes("leadership")) {
    return true;
  }
  
  // Use if quality is low after initial searches
  if (searchCount >= 2 && resultQuality < 0.4) {
    return true;
  }
  
  return false;
}

/**
 * Generate individual search queries for extracted names
 */
export function generateIndividualSearchQueries(
  names: string[],
  company: string,
  maxQueries: number = 3
): Array<{ name: string; query: string }> {
  // Take top names up to maxQueries
  const topNames = names.slice(0, maxQueries);
  
  return topNames.map(name => ({
    name,
    query: `"${name}" "${company}" LinkedIn profile`
  }));
}

/**
 * Analyze if we have enough information for a topic
 */
export function hasAdequateTopicCoverage(
  topic: string,
  searchResults: any[]
): boolean {
  const requiredInfo: Record<string, string[]> = {
    "decision makers": ["names", "titles", "backgrounds"],
    "strategic initiatives": ["goals", "priorities", "recent announcements"],
    "vendor relationships": ["partners", "technology stack", "integrations"],
    "procurement patterns": ["contracts", "awards", "spending"]
  };
  
  const normalizedTopic = topic.toLowerCase();
  const required = requiredInfo[normalizedTopic] || [];
  
  // Check if we have the required information
  let coverage = 0;
  for (const req of required) {
    // Simple heuristic - check if relevant content exists
    const hasInfo = searchResults.some(result => {
      const content = (result.content || "").toLowerCase();
      return content.includes(req);
    });
    if (hasInfo) coverage++;
  }
  
  return coverage >= required.length * 0.7; // 70% coverage threshold
}