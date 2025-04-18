/**
 * Helper functions for extracting structured information from LLM responses
 * 
 * These functions parse text content from LLM responses to extract
 * specific information patterns for state management.
 */

/**
 * Extract funder information from research
 * @param {string} text Research text
 * @returns {string} Extracted funder info
 */
export function extractFunderInfo(text) {
  const funders = text.match(/funder:(.*?)(?=\n\n|\n$|$)/is);
  return funders ? funders[1].trim() : "";
}

/**
 * Extract solution sought from text
 * @param {string} text Text containing solution information
 * @returns {string} Extracted solution sought
 */
export function extractSolutionSought(text) {
  const solution = text.match(/solution sought:(.*?)(?=\n\n|\n$|$)/is);
  return solution ? solution[1].trim() : "";
}

/**
 * Extract connection pairs from text
 * @param {string} text Text containing connection information
 * @returns {string[]} Array of connection pairs
 */
export function extractConnectionPairs(text) {
  // First try to parse as JSON
  try {
    // Check if text contains a JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const jsonData = JSON.parse(jsonMatch[0]);
      
      // If JSON contains connection_pairs array
      if (jsonData.connection_pairs && Array.isArray(jsonData.connection_pairs)) {
        return jsonData.connection_pairs.map(pair => 
          `${pair.category}: ${pair.funder_element.description} aligns with ${pair.applicant_element.description} - ${pair.connection_explanation}`
        );
      }
    }
  } catch (error) {
    // JSON parsing failed, continue with regex approach
    console.log("JSON parsing failed, using regex fallback");
  }
  
  // Fallback to original regex approach
  const connectionText = text.match(/connection pairs:(.*?)(?=\n\n|\n$|$)/is);
  if (!connectionText) return [];

  // Split by numbered items or bullet points
  const connections = connectionText[1]
    .split(/\n\s*[\d\.\-\*]\s*/)
    .map(item => item.trim())
    .filter(item => item.length > 0);

  return connections;
}

/**
 * Helper function to extract section name from message
 * @param {string} messageContent Message content
 * @returns {string} Section name
 */
export function getSectionToGenerate(messageContent) {
  // Extract section name using regex
  const sectionMatch =
    messageContent.match(/generate section[:\s]+([^"\n.]+)/i) ||
    messageContent.match(/write section[:\s]+([^"\n.]+)/i) ||
    messageContent.match(/section[:\s]+"([^"]+)"/i);

  if (sectionMatch && sectionMatch[1]) {
    return sectionMatch[1].trim();
  }

  // Default section if none specified
  return "Project Description";
}