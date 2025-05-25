import { describe, it, expect, vi, beforeEach } from "vitest";
import { researchAgent } from "../agents/research";
import { SupabaseCheckpointer } from "../lib/persistence/supabase-checkpointer";
import { AIMessage } from "@langchain/core/messages";
import { Checkpoint } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

// Mock environment variables
process.env.DATABASE_URL = "postgres://fake:fake@localhost:5432/fake_db";
process.env.SUPABASE_URL = "https://fake-supabase-url.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
process.env.SUPABASE_ANON_KEY = "fake-anon-key";

// Mock the Supabase client
vi.mock("../lib/supabase/client.ts", () => {
  return {
    serverSupabase: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi
            .fn()
            .mockResolvedValue({ data: { path: "test-path" }, error: null }),
          getPublicUrl: vi
            .fn()
            .mockReturnValue({ data: { publicUrl: "https://test-url.com" } }),
        }),
      },
    },
    createSupabaseClient: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    }),
  };
});

// Mock the message pruning
vi.mock("../lib/state/messages.js", () => {
  return {
    pruneMessageHistory: vi.fn().mockImplementation((messages) => messages),
  };
});

// Mock Logger
vi.mock("@/lib/logger.js", () => {
  return {
    Logger: {
      getInstance: vi.fn().mockReturnValue({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    },
  };
});

// Mock pdf-parse to prevent it from trying to load test files
vi.mock("pdf-parse", () => {
  return {
    default: vi.fn().mockResolvedValue({
      text: "Mocked PDF content for testing",
      numpages: 5,
      info: { Title: "Test Document", Author: "Test Author" },
      metadata: {},
      version: "1.10.100",
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

vi.mock("@/lib/persistence/supabase-checkpointer", () => {
  return {
    SupabaseCheckpointer: vi.fn().mockImplementation(() => {
      return {
        get: vi.fn(),
        put: vi.fn().mockResolvedValue(undefined),
        list: vi.fn().mockResolvedValue([]),
        getNamespaces: vi.fn().mockResolvedValue([]),
        getUserCheckpoints: vi.fn().mockResolvedValue([]),
        getProposalCheckpoints: vi.fn().mockResolvedValue([]),
        updateSessionActivity: vi.fn().mockResolvedValue(undefined),
        generateThreadId: vi.fn().mockResolvedValue("test-thread-id"),
        config: { configurable: {} },
      };
    }),
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
      expect(
        result.deepResearchResults.categories.organizationBackground
      ).toBeDefined();

      // Check that solution was generated
      expect(result.solutionSoughtResults).toBeDefined();
      expect(result.solutionSoughtResults.primaryApproach).toBeDefined();
      expect(result.solutionSoughtResults.secondaryApproaches).toBeDefined();
      expect(
        result.solutionSoughtResults.secondaryApproaches.length
      ).toBeGreaterThan(0);
    });

    it("can resume from a persisted state", async () => {
      // --- Simulate initial run (implicitly done by mocking put/get later) ---
      // We assume some initial state was previously saved for 'test-resumption-thread'

      // --- Setup Mock for Resumption ---
      const { SupabaseCheckpointer } = await import(
        "@/lib/persistence/supabase-checkpointer"
      );
      const mockedCheckpointerInstance = new SupabaseCheckpointer({});

      // Define the state to resume from (e.g., after query generation)
      const resumeState: ResearchState = {
        documentId: "test-doc-123",
        originalRfp: "Test RFP content",
        parsedRfp: { purpose: "Test purpose", scope: "Test scope" },
        researchQueries: ["query1", "query2"],
        solutionSoughtResults: undefined,
        painPointsResults: undefined,
        currentMandatesResults: undefined,
        evaluationCriteriaResults: undefined,
        timelineResults: undefined,
        messages: [] as BaseMessage[],
        status: "QUERIES_GENERATED",
        errors: [],
        userId: "test-user",
        proposalId: "test-proposal",
      };

      const resumeCheckpoint: Checkpoint = {
        v: 1,
        ts: new Date().toISOString(),
        channel_values: { ...resumeState },
        channel_versions: {},
        versions_seen: {},
      };

      // Mock the 'get' method to return the resume state
      (mockedCheckpointerInstance.get as vi.Mock).mockResolvedValueOnce(
        resumeCheckpoint
      );

      // --- Mock Supabase interactions (already partially done in beforeAll/beforeEach) ---
      // Ensure Supabase client mocks are correctly set up if needed for resumption logic
      // (Current mocks seem okay for put/upsert/delete, GET might be needed if agent logic calls it)
      // Example (if needed):
      // mockSupabaseClient.from('proposal_checkpoints').select.mockResolvedValueOnce({ data: [resumeCheckpoint], error: null });

      // Run the research agent with the same thread ID
      const result = await researchAgent.invoke({
        documentId: "test-doc-123",
        threadId: "test-resumption-thread",
      });

      // Verify it completed from where it left off
      // The final status depends on the full graph logic after QUERIES_GENERATED
      // Assuming it runs research and completes:
      expect(result.status).toBe("COMPLETE");
      expect(result.solutionSoughtResults).toBeDefined();
      expect(result.researchQueries).toEqual(["query1", "query2"]);

      // Verify checkpointer 'get' was called
      expect(mockedCheckpointerInstance.get).toHaveBeenCalledWith({
        configurable: { thread_id: "test-resumption-thread" },
      });
    });
  });
});
