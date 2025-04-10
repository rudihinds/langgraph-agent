// Test script for proposal agent
import { runProposalAgent } from "./agents/proposal-agent/graph.js";

// Run a test with a simple query
async function testAgent() {
  try {
    console.log("Testing proposal agent...");
    const result = await runProposalAgent(
      "I need help writing a grant proposal for a community garden project."
    );
    console.log("Test successful! Final messages:", result.messages);
  } catch (error) {
    console.error("Error running agent:", error);
  }
}

testAgent();