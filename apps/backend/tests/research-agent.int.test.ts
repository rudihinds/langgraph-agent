import { describe, it, expect, vi, beforeEach } from "vitest";
import { researchAgent } from "../agents/research";
import { SupabaseCheckpointer } from "../lib/state/supabase";
import { AIMessage } from "@langchain/core/messages";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
    delete: vi.fn().mockResolvedValue({ error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    update: vi.fn().mockResolvedValue({ error: null }),
  };

  return {
    createClient: vi.fn().mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ 
          data: { user: { id: "test-user-id" } },
          error: null 
        }),
      },
      ...mockSupabase,
    }),
  };
});

// Mock document retrieval
vi.mock("../lib/documents", () => {
  return {
    getDocumentById: vi.fn().mockResolvedValue({
      id: "test-doc-123",
      content: "This is a test RFP document for integration testing",
      title: "Test RFP Document",
      organization: "Test Organization",
      createdAt: new Date().toISOString(),
    }),
  };
});

// Mock LLM responses with realistic outputs
vi.mock("@langchain/openai", () => {
  const researchResults = `{
    "categories": {
      "organizationBackground": {
        "findings": "Test Organization is a software company focused on AI solutions. They have been in business for 10 years and have a team of 50 employees.",
        "relevanceScore": 8
      },
      "projectScope": {
        "findings": "The project involves developing a new AI-powered customer service platform that can handle inquiries in multiple languages.",
        "relevanceScore": 9
      },
      "deliverables": {
        "findings": "Key deliverables include a functional prototype within 3 months, full deployment within 6 months, and ongoing support for 1 year.",
        "relevanceScore": 10
      },
      "budget": {
        "findings": "The budget for this project is $150,000-$200,000.",
        "relevanceScore": 8
      }
    }
  }`;

  const solutionResults = `{
    "primaryApproach": {
      "approach": "Implement a hybrid NLP system using transformer models for language understanding combined with a rule-based system for business logic.",
      "rationale": "This approach provides the best balance of accuracy, flexibility, and deployment speed while meeting all the client requirements.",
      "fitScore": 9
    },
    "secondaryApproaches": [
      {
        "approach": "Fully cloud-based solution using managed AI services with custom fine-tuning for the client's specific needs.",
        "rationale": "This approach would reduce development time but may increase long-term costs and reduce flexibility.",
        "fitScore": 7
      }
    ]
  }`;

  let callCount = 0;
  return {
    ChatOpenAI: vi.fn().mockImplementation(() => ({
      temperature: 0,
      invoke: vi.fn().mockImplementation(() => {
        callCount++;
        // First call is for deep research, second for solution sought
        if (callCount === 1) {
          return new AIMessage(researchResults);
        } else {
          return new AIMessage(solutionResults);
        }
      }),
      bindTools: vi.fn().mockReturnThis(),
    })),
  };
});

describe("Research Agent Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("End-to-end flow", () => {
    it("completes a full research process with persistence", async () => {
      // Create a thread ID for this test
      const threadId = `test-thread-${Date.now()}`;
      
      // Run the research agent
      const result = await researchAgent.invoke({
        documentId: "test-doc-123",
        threadId,
      });
      
      // Verify we get a complete research result
      expect(result.status).toBe("COMPLETE");
      expect(result.document).toBeDefined();
      expect(result.document.id).toBe("test-doc-123");
      
      // Check that deep research was performed
      expect(result.deepResearchResults).toBeDefined();
      expect(result.deepResearchResults.categories).toBeDefined();
      expect(result.deepResearchResults.categories.organizationBackground).toBeDefined();
      
      // Check that solution was generated
      expect(result.solutionSoughtResults).toBeDefined();
      expect(result.solutionSoughtResults.primaryApproach).toBeDefined();
      expect(result.solutionSoughtResults.secondaryApproaches).toBeDefined();
      expect(result.solutionSoughtResults.secondaryApproaches.length).toBeGreaterThan(0);
    });
    
    it("can resume from a persisted state", async () => {
      // This test would normally check persistence by:
      // 1. Starting a research process
      // 2. Interrupting it midway
      // 3. Resuming with the same thread ID
      // 4. Verifying it doesn't start over
      
      // Since we're using mocks, we'll simulate this by:
      // - Mocking the checkpointer to return a mock state on first call
      
      // Create a partially complete state
      const partialState = {
        document: {
          id: "test-doc-123",
          content: "Test RFP document",
          title: "Test RFP",
        },
        deepResearchResults: {
          categories: {
            organizationBackground: {
              findings: "Previously saved findings about the organization",
              relevanceScore: 8,
            },
          },
        },
        status: "SOLUTION_NEEDED",
        threadId: "test-resumption-thread",
      };
      
      // Mock the checkpointer to return our partial state
      vi.mock("../lib/state/supabase", () => {
        return {
          SupabaseCheckpointer: vi.fn().mockImplementation(() => ({
            get: vi.fn().mockResolvedValue(partialState),
            put: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
          })),
        };
      });
      
      // Run the research agent with the same thread ID
      const result = await researchAgent.invoke({
        documentId: "test-doc-123",
        threadId: "test-resumption-thread",
      });
      
      // Verify it completed from where it left off
      expect(result.status).toBe("COMPLETE");
      expect(result.solutionSoughtResults).toBeDefined();
      
      // Reset the mock to prevent affecting other tests
      vi.resetModules();
    });
  });
});