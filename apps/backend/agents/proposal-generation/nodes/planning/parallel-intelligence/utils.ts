/**
 * Shared utility functions for parallel intelligence agents
 */

/**
 * Calculate quality score for topic research
 * 
 * Quality is based on:
 * - Having search results (0.3)
 * - Finding extractable URLs (0.2)
 * - Extracting entities (0.3)
 * - Good entity coverage (0.2)
 */
export function calculateTopicQuality(research: any): number {
  const hasResults = research.searchResults?.length > 0;
  const hasUrls = research.extractedUrls?.length > 0;
  const hasEntities = research.extractedEntities?.length > 0;
  const entityCount = research.extractedEntities?.length || 0;
  const resultCount = research.searchResults?.length || 0;
  
  // Base quality on progress through the phases
  let quality = 0;
  
  if (hasResults) quality += 0.2;  // Found some results
  if (resultCount > 5) quality += 0.1; // Good result coverage
  if (hasUrls) quality += 0.2;     // Found extractable URLs
  if (hasEntities) quality += 0.3; // Extracted entities
  if (entityCount > 3) quality += 0.2; // Good entity coverage
  
  return Math.min(quality, 1.0);
}