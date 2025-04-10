/**
 * Reducer functions for managing complex state updates in the proposal agent system
 */

/**
 * Reducer for connection pairs that handles deduplication and merging
 * 
 * @param {Array} current - The current array of connection pairs
 * @param {Array} update - New connection pairs to be added or merged
 * @returns {Array} Updated array of connection pairs
 */
export function connectionPairsReducer(current, update) {
  // Create a map of existing pairs by id for quick lookup
  const existingPairsMap = new Map();
  current.forEach(pair => existingPairsMap.set(pair.id, pair));
  
  // Process each update pair
  update.forEach(updatePair => {
    // If pair with same id exists, merge with preference for higher confidence
    if (existingPairsMap.has(updatePair.id)) {
      const existingPair = existingPairsMap.get(updatePair.id);
      
      // Only update if new pair has higher confidence
      if (updatePair.confidenceScore > existingPair.confidenceScore) {
        existingPairsMap.set(updatePair.id, {
          ...existingPair,
          ...updatePair,
          // Preserve source information in a meaningful way
          source: updatePair.source 
            ? (existingPair.source 
                ? `${existingPair.source}, ${updatePair.source}`
                : updatePair.source)
            : existingPair.source
        });
      }
    } else {
      // If new pair, simply add it
      existingPairsMap.set(updatePair.id, updatePair);
    }
  });
  
  // Convert map back to array
  return Array.from(existingPairsMap.values());
}

/**
 * Reducer for section content that handles versioning and updates
 * 
 * @param {Object} current - The current map of section content by name
 * @param {Object|Array} update - Updated section content
 * @returns {Object} Updated map of section content
 */
export function proposalSectionsReducer(current, update) {
  // Create a new map to avoid mutating the original
  const updatedSections = { ...current };
  
  // Handle both single section updates and multiple section updates
  const sectionsToUpdate = Array.isArray(update) 
    ? update 
    : [update];
  
  sectionsToUpdate.forEach(section => {
    const sectionName = section.name;
    
    if (updatedSections[sectionName]) {
      // If section exists, increment version and update content
      updatedSections[sectionName] = {
        ...updatedSections[sectionName],
        ...section,
        version: (updatedSections[sectionName].version || 0) + 1,
        lastUpdated: new Date().toISOString()
      };
    } else {
      // If new section, initialize with version 1
      updatedSections[sectionName] = {
        ...section,
        version: 1,
        lastUpdated: new Date().toISOString()
      };
    }
  });
  
  return updatedSections;
}

/**
 * Reducer for research data that merges new findings with existing data
 * 
 * @param {Object|null} current - The current research data
 * @param {Object} update - New research findings
 * @returns {Object} Updated research data
 */
export function researchDataReducer(current, update) {
  if (!current) {
    return {
      keyFindings: update.keyFindings || [],
      funderPriorities: update.funderPriorities || [],
      ...update
    };
  }

  // Create new object with merged arrays for list properties
  return {
    keyFindings: [...new Set([...current.keyFindings, ...(update.keyFindings || [])])],
    funderPriorities: [...new Set([...current.funderPriorities, ...(update.funderPriorities || [])])],
    // Merge other properties, preferring the update values
    fundingHistory: update.fundingHistory || current.fundingHistory,
    relevantProjects: update.relevantProjects || current.relevantProjects,
    competitiveAnalysis: update.competitiveAnalysis || current.competitiveAnalysis,
    additionalNotes: update.additionalNotes || current.additionalNotes
  };
}

/**
 * Reducer for solution requirements that handles merging and prioritization
 * 
 * @param {Object|null} current - The current solution requirements
 * @param {Object} update - New or updated solution requirements
 * @returns {Object} Updated solution requirements
 */
export function solutionRequirementsReducer(current, update) {
  if (!current) {
    return {
      primaryGoals: update.primaryGoals || [],
      constraints: update.constraints || [],
      successMetrics: update.successMetrics || [],
      ...update
    };
  }

  // Merge arrays and deduplicate
  return {
    primaryGoals: [...new Set([...current.primaryGoals, ...(update.primaryGoals || [])])],
    secondaryObjectives: [...new Set([
      ...(current.secondaryObjectives || []), 
      ...(update.secondaryObjectives || [])
    ])],
    constraints: [...new Set([...current.constraints, ...(update.constraints || [])])],
    successMetrics: [...new Set([...current.successMetrics, ...(update.successMetrics || [])])],
    preferredApproaches: [...new Set([
      ...(current.preferredApproaches || []), 
      ...(update.preferredApproaches || [])
    ])],
    explicitExclusions: [...new Set([
      ...(current.explicitExclusions || []), 
      ...(update.explicitExclusions || [])
    ])]
  };
}