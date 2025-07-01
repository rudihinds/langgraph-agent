/**
 * Utility functions for processing tool results in parallel intelligence agents
 */

import { ToolMessage } from "@langchain/core/messages";

/**
 * Extract tool results from messages and organize them by type
 */
export function extractToolResults(messages: any[]) {
  const toolMessages = messages.filter(m => m.constructor.name === 'ToolMessage') as ToolMessage[];
  const results = { 
    queries: [] as string[], 
    searchResults: [] as any[], // Changed to store formatted search results
    urls: [] as string[], 
    entities: [] as any[],
    insights: [] as any[]
  };
  
  for (const msg of toolMessages) {
    try {
      // Tool results are stored in the content field
      let data;
      try {
        data = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
      } catch (parseError) {
        // Skip non-JSON messages (likely error messages)
        console.log("Skipping non-JSON tool message:", msg.content);
        continue;
      }
      
      // Log what we extracted for debugging
      console.log(`[Tool Results] Extracted from ${msg.name || 'unknown'}:`, {
        hasQuery: !!data.query,
        resultsCount: data.results?.length || 0,
        hasAnswer: !!data.answer,
        urlsCount: (data.promisingUrls?.length || 0) + (data.url ? 1 : 0),
        entitiesCount: data.entities?.length || 0,
        insightsCount: data.insights?.length || 0
      });
      
      // Store the complete formatted search result (matching intelligence-search format)
      if (data.query && data.results && data.answer) {
        results.searchResults.push({
          query: data.query,
          results: data.results,
          answer: data.answer,
          timestamp: data.timestamp || new Date().toISOString()
        });
      }
      
      // Also extract individual components for backward compatibility
      if (data.query && typeof data.query === 'string') {
        results.queries.push(data.query);
      }
      
      if (data.promisingUrls && Array.isArray(data.promisingUrls)) {
        results.urls.push(...data.promisingUrls);
      }
      
      if (data.entities && Array.isArray(data.entities)) {
        results.entities.push(...data.entities);
      }
      
      if (data.url && typeof data.url === 'string') {
        results.urls.push(data.url);
      }
      
      if (data.insights && Array.isArray(data.insights)) {
        results.insights.push(...data.insights);
      }
      
    } catch (error) {
      console.error("Error parsing tool message:", error, "Content:", msg.content);
    }
  }
  
  // Remove duplicates
  results.urls = Array.from(new Set(results.urls));
  results.queries = Array.from(new Set(results.queries));
  
  return results;
}

/**
 * Mark entities as searched when they've been processed by deep-dive tools
 */
export function markEntitiesAsSearched(entities: any[], searchedEntityNames: string[]) {
  return entities.map(entity => ({
    ...entity,
    searched: searchedEntityNames.includes(entity.name) || entity.searched
  }));
}

/**
 * Merge tool results into existing research state with deduplication
 */
export function mergeToolResults(currentResearch: any, toolResults: any) {
  // Merge URLs with deduplication
  const existingUrls = currentResearch.extractedUrls || [];
  const newUrls = toolResults.urls || [];
  const mergedUrls = [...existingUrls];
  
  newUrls.forEach((url: string) => {
    if (!mergedUrls.includes(url)) {
      mergedUrls.push(url);
    }
  });
  
  // Merge entities with deduplication by name
  const existingEntities = currentResearch.extractedEntities || [];
  const newEntities = toolResults.entities || [];
  const mergedEntities = [...existingEntities];
  
  newEntities.forEach((newEntity: any) => {
    const existingIndex = mergedEntities.findIndex(
      (existing: any) => existing.name.toLowerCase() === newEntity.name.toLowerCase()
    );
    
    if (existingIndex >= 0) {
      // Merge with existing entity, preserving both old and new data
      mergedEntities[existingIndex] = {
        ...mergedEntities[existingIndex],
        ...newEntity,
        // Preserve description if it exists in either
        description: newEntity.description || mergedEntities[existingIndex].description,
        // Preserve searched status if already searched
        searched: mergedEntities[existingIndex].searched || newEntity.searched
      };
    } else {
      // Add new entity
      mergedEntities.push(newEntity);
    }
  });
  
  return {
    ...currentResearch,
    searchQueries: [
      ...(currentResearch.searchQueries || []), 
      ...toolResults.queries
    ],
    searchResults: [
      ...(currentResearch.searchResults || []), 
      ...toolResults.searchResults
    ],
    extractedUrls: mergedUrls,
    extractedEntities: mergedEntities,
    insights: [
      ...(currentResearch.insights || []),
      ...(toolResults.insights || [])
    ]
  };
}