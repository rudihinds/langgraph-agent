/**
 * Test script to verify autonomous agent behavior
 */

import { strategicInitiativesAgent } from "./agents/proposal-generation/nodes/planning/parallel-intelligence/strategic-initiatives-agent.js";
import { OverallProposalStateAnnotation } from "./state/modules/annotations.js";

// Create a mock state
const mockState: typeof OverallProposalStateAnnotation.State = {
  company: "Acme Corp",
  industry: "Technology",
  messages: [],
  strategicInitiativesResearch: {
    searchQueries: ["Acme Corp strategic initiatives 2024"],
    searchResults: [{
      query: "Acme Corp strategic initiatives 2024",
      results: [
        { url: "https://acme.com/strategy", title: "Our Strategic Vision" }
      ],
      answer: "Found strategic vision page"
    }],
    extractedUrls: ["https://acme.com/strategy"],
    extractedEntities: [
      { name: "Digital Transformation Initiative", type: "initiative" },
      { name: "Cloud Migration Strategy", type: "initiative" },
      { name: "AI Integration Program", type: "initiative" }
    ],
  },
  parallelIntelligenceState: {
    strategicInitiatives: { status: "running" }
  }
} as any;

async function testAgent() {
  console.log("\n=== Testing Autonomous Strategic Initiatives Agent ===\n");
  
  // Test 1: Agent with existing research should decide if it needs more
  console.log("Test 1: Agent with existing research (3 initiatives found)");
  const result1 = await strategicInitiativesAgent(mockState);
  console.log("Result:", {
    isComplete: result1.strategicInitiativesResearch?.complete,
    status: result1.parallelIntelligenceState?.strategicInitiatives?.status,
    quality: result1.parallelIntelligenceState?.strategicInitiatives?.quality
  });
  
  // Test 2: Agent with no research should start searching
  console.log("\nTest 2: Agent starting fresh");
  const freshState = {
    ...mockState,
    strategicInitiativesResearch: undefined
  };
  const result2 = await strategicInitiativesAgent(freshState);
  console.log("Result:", {
    isComplete: result2.strategicInitiativesResearch?.complete,
    status: result2.parallelIntelligenceState?.strategicInitiatives?.status
  });
}

// Run the test
testAgent().catch(console.error);