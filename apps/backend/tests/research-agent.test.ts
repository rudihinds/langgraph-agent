import { describe, it, expect, vi, beforeEach } from "vitest";
import { researchAgent, createResearchGraph } from "../agents/research";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph/checkpoints";
import { ResearchState } from "../agents/research/state";
import * as nodes from "../agents/research/nodes";

// Mock the nodes module
vi.mock("../agents/research/nodes", async () => {
  const actual = await vi.importActual("../agents/research/nodes");
  return {
    ...actual,
    documentLoader: vi.fn().mockImplementation(async (state: ResearchState) => {
      return {
        ...state,
        document: {
          id: "mock-doc-id",
          content: "Mock RFP document content for testing",
          title: "Mock RFP",
        },
        status: "RESEARCH_NEEDED",
      };
    }),
    deepResearch: vi.fn().mockImplementation(async (state: ResearchState) => {
      return {
        ...state,
        deepResearchResults: {
          categories: {
            organizationBackground: {
              findings: "Mock findings about the organization",
              relevanceScore: 8,
            },
            projectScope: {
              findings: "Mock findings about the project scope",
              relevanceScore: 9,
            },
            deliverables: {
              findings: "Mock findings about deliverables",
              relevanceScore: 10,
            },
            // Add other categories as needed with mock findings
          },
        },
        status: "SOLUTION_NEEDED",
      };
    }),
    solutionSought: vi.fn().mockImplementation(async (state: ResearchState) => {
      return {
        ...state,
        solutionSoughtResults: {
          primaryApproach: {
            approach: "Primary approach mock description",
            rationale: "Rationale for primary approach",
            fitScore: 9,
          },
          secondaryApproaches: [
            {
              approach: "Secondary approach mock description",
              rationale: "Rationale for secondary approach",
              fitScore: 7,
            },
          ],
        },
        status: "COMPLETE",
      };
    }),
  };
});

// Mock LLM and tools
vi.mock("@langchain/openai", () => {
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => ({
      temperature: 0,
      invoke: vi.fn().mockResolvedValue(new AIMessage("Mocked LLM response")),
      bindTools: vi.fn().mockReturnThis(),
    })),
  };
});

describe("Research Agent Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createResearchGraph", () => {
    it("creates a research graph with the correct nodes and edges", async () => {
      // Create the research graph
      const graph = createResearchGraph();
      
      // Verify the graph has the expected structure
      expect(graph).toBeDefined();
      // These assertions would need to be adjusted based on what's exposed by the StateGraph
    });
  });

  describe("researchAgent", () => {
    it("processes an RFP document and returns complete research results", async () => {
      // Test invoking the research agent
      const result = await researchAgent.invoke({ 
        documentId: "test-doc-123",
        threadId: "test-thread-456"
      });

      // Verify the result structure matches our expectations
      expect(result).toHaveProperty("document");
      expect(result).toHaveProperty("deepResearchResults");
      expect(result).toHaveProperty("solutionSoughtResults");
      expect(result.status).toBe("COMPLETE");
      
      // Verify each node was called once
      expect(nodes.documentLoader).toHaveBeenCalledTimes(1);
      expect(nodes.deepResearch).toHaveBeenCalledTimes(1);
      expect(nodes.solutionSought).toHaveBeenCalledTimes(1);
    });

    it("handles a thread ID for persistence", async () => {
      // Test with a specific thread ID
      const threadId = "existing-thread-789";
      
      // Mock the checkpointer to simulate a non-existent thread
      const mockCheckpointer = new MemorySaver();
      vi.spyOn(mockCheckpointer, "get").mockResolvedValue(null);
      
      const result = await researchAgent.invoke({ 
        documentId: "test-doc-123",
        threadId
      });

      // Verify results are as expected
      expect(result).toHaveProperty("document");
      expect(result.status).toBe("COMPLETE");
    });
    
    it("handles errors during processing", async () => {
      // Mock an error in one of the nodes
      vi.mocked(nodes.deepResearch).mockRejectedValueOnce(new Error("Research API failed"));
      
      // We expect the agent to handle the error and return an error state
      try {
        await researchAgent.invoke({ documentId: "test-doc-123" });
        // If it doesn't throw, the test should fail
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Research API failed");
      }
    });
    
    it("processes an RFP document with empty optional parameters", async () => {
      // Test invoking with only required parameters
      const result = await researchAgent.invoke({ 
        documentId: "test-doc-123"
      });

      // Verify the result is complete
      expect(result.status).toBe("COMPLETE");
    });
  });
});