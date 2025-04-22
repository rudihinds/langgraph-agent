/**
 * Debug file for testing proposal-generation graph imports
 */

try {
  console.log("Attempting to import proposal-generation module...");

  // Try to import the module
  const proposalGen = await import("./agents/proposal-generation/index.js");

  console.log("Successfully imported proposal-generation module:");
  console.log("Available exports:", Object.keys(proposalGen));

  // Try to create a graph
  if (proposalGen.createProposalGenerationGraph) {
    console.log("Testing graph creation...");
    try {
      const graph = proposalGen.createProposalGenerationGraph("test-user-id");
      console.log("Graph created successfully:", graph ? "true" : "false");
    } catch (graphError) {
      console.error("Error creating graph:", graphError);
    }
  } else {
    console.error(
      "createProposalGenerationGraph function not found in exports"
    );
  }
} catch (importError) {
  console.error("Error importing proposal-generation module:");
  console.error(importError);
}
