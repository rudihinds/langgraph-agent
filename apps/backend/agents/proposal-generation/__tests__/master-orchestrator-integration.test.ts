import { describe, it, expect, vi, beforeEach } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import {
  masterOrchestratorNode,
  routeAfterMasterOrchestrator,
  awaitStrategicPrioritiesNode,
} from "../nodes/planning/master_orchestrator.js";
import {
  OverallProposalState,
  ProcessingStatus,
} from "@/state/proposal.state.js";

// Mock the interrupt function with hoisting
const mockInterrupt = vi.hoisted(() => vi.fn());

// Create hoisted mocks with proper LangGraph support
const mockLLM = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

const mockCreateChatModel = vi.hoisted(() => vi.fn());

// Mock LangGraph with importOriginal to preserve actual functionality
vi.mock("@langchain/langgraph", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@langchain/langgraph")>();
  return {
    ...actual,
    interrupt: vi.fn(),
  };
});

// Mock Anthropic
vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => mockLLM),
}));

// Mock logger
vi.mock("@/lib/logger.js", () => ({
  Logger: {
    getInstance: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// Mock createChatModel
vi.mock("@/lib/llm/factory.js", () => ({
  createChatModel: mockCreateChatModel.mockReturnValue(mockLLM),
}));

describe("Master Orchestrator Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default successful LLM responses
    mockLLM.invoke.mockResolvedValue({
      content: JSON.stringify({
        industry: "Technology",
        specialization: "Software Development",
        complexity: "Medium",
        complexity_factors: ["Multiple stakeholders", "Technical integration"],
        contract_value_estimate: "$100,000 - $500,000",
        timeline_pressure: "Medium",
        strategic_focus: ["Technical excellence", "Cost effectiveness"],
        submission_requirements: {
          page_limit: 20,
          sections_required: ["Executive Summary", "Technical Approach"],
          attachments_needed: ["Company brochure", "Past performance"],
        },
      }),
    });
  });

  describe("RFP Analysis Flow", () => {
    it("should analyze RFP complexity and create strategic priorities query", async () => {
      // Create initial state
      const initialState: OverallProposalState = {
        userId: "test-user",
        sessionId: "test-session",
        proposalId: "test-proposal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rfpDocument: {
          raw: "Test RFP content for software development project",
          parsed: {
            sections: ["Requirements", "Evaluation"],
            requirements: ["Technical expertise", "Timeline"],
            evaluationCriteria: ["Cost", "Quality"],
          },
          metadata: {
            title: "Software Development RFP",
            organization: "Test Organization",
            submissionDeadline: "2024-12-31",
            pageLimit: 20,
            formatRequirements: ["PDF format"],
          },
        },
        rfpProcessingStatus: ProcessingStatus.COMPLETE,
        researchStatus: ProcessingStatus.NOT_STARTED,
        solutionStatus: ProcessingStatus.NOT_STARTED,
        connectionsStatus: ProcessingStatus.NOT_STARTED,
        sections: {},
        sectionDiscoveryStatus: ProcessingStatus.NOT_STARTED,
        evaluationStatus: ProcessingStatus.NOT_STARTED,
        requiredSections: [],
        interruptStatus: {
          isInterrupted: false,
          interruptionPoint: null,
          feedback: null,
          processingStatus: null,
        },
        currentStep: null,
        activeThreadId: "test-thread",
        messages: [],
        errors: [],
        lastUpdatedAt: new Date().toISOString(),
        status: ProcessingStatus.NOT_STARTED,
      };

      // Execute the master orchestrator node
      const result = await masterOrchestratorNode(initialState);

      // Verify the result structure
      expect(result).toBeDefined();
      expect(result.planningIntelligence).toBeDefined();
      expect(result.userCollaboration).toBeDefined();
      expect(result.adaptiveWorkflow).toBeDefined();

      // Verify RFP analysis was performed
      expect(mockLLM.invoke).toHaveBeenCalled();

      // Verify strategic priorities query was created
      expect(result.userCollaboration?.userQueries).toBeDefined();
      expect(result.userCollaboration.userQueries.length).toBeGreaterThan(0);

      const query = result.userCollaboration.userQueries[0];
      expect(query.question).toContain("strategic priorities");
      expect(query.options).toBeDefined();
      expect(query.options.length).toBeGreaterThan(0);
    });

    it("should handle LLM errors gracefully with fallback analysis", async () => {
      // Mock LLM to throw an error
      mockLLM.invoke.mockRejectedValue(new Error("LLM service unavailable"));

      // Create initial state
      const initialState: OverallProposalState = {
        userId: "test-user",
        sessionId: "test-session",
        proposalId: "test-proposal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rfpDocument: {
          raw: "Test RFP content",
          parsed: {
            sections: ["Requirements"],
            requirements: ["Basic requirement"],
            evaluationCriteria: ["Cost"],
          },
          metadata: {
            title: "Test RFP",
            organization: "Test Org",
            submissionDeadline: "2024-12-31",
            pageLimit: 10,
            formatRequirements: [],
          },
        },
        rfpProcessingStatus: ProcessingStatus.COMPLETE,
        researchStatus: ProcessingStatus.NOT_STARTED,
        solutionStatus: ProcessingStatus.NOT_STARTED,
        connectionsStatus: ProcessingStatus.NOT_STARTED,
        sections: {},
        sectionDiscoveryStatus: ProcessingStatus.NOT_STARTED,
        evaluationStatus: ProcessingStatus.NOT_STARTED,
        requiredSections: [],
        interruptStatus: {
          isInterrupted: false,
          interruptionPoint: null,
          feedback: null,
          processingStatus: null,
        },
        currentStep: null,
        activeThreadId: "test-thread",
        messages: [],
        errors: [],
        lastUpdatedAt: new Date().toISOString(),
        status: ProcessingStatus.NOT_STARTED,
      };

      // Execute the master orchestrator node
      const result = await masterOrchestratorNode(initialState);

      // Verify fallback behavior
      expect(result.planningIntelligence?.rfpCharacteristics.industry).toBe(
        "Other"
      );
      expect(result.planningIntelligence?.rfpCharacteristics.complexity).toBe(
        "Medium"
      );
      expect(result.adaptiveWorkflow?.selectedApproach).toBe("standard");
    });
  });

  describe("Routing Logic", () => {
    it("should route to await strategic priorities after master orchestrator", () => {
      const state: OverallProposalState = {
        userId: "test-user",
        sessionId: "test-session",
        proposalId: "test-proposal",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        rfpDocument: {
          raw: "Test RFP",
          parsed: { sections: [], requirements: [], evaluationCriteria: [] },
          metadata: {
            title: "Test",
            organization: "Test Org",
            submissionDeadline: "2024-12-31",
            pageLimit: 10,
            formatRequirements: [],
          },
        },
        rfpProcessingStatus: ProcessingStatus.COMPLETE,
        researchStatus: ProcessingStatus.NOT_STARTED,
        solutionStatus: ProcessingStatus.NOT_STARTED,
        connectionsStatus: ProcessingStatus.NOT_STARTED,
        sections: {},
        sectionDiscoveryStatus: ProcessingStatus.NOT_STARTED,
        evaluationStatus: ProcessingStatus.NOT_STARTED,
        requiredSections: [],
        interruptStatus: {
          isInterrupted: false,
          interruptionPoint: null,
          feedback: null,
          processingStatus: null,
        },
        currentStep: null,
        activeThreadId: "test-thread",
        messages: [],
        errors: [],
        lastUpdatedAt: new Date().toISOString(),
        status: ProcessingStatus.NOT_STARTED,
        userCollaboration: {
          strategicPriorities: [],
          competitiveAdvantages: [],
          riskFactors: [],
          userQueries: [
            {
              id: "1",
              question: "What are your strategic priorities for this proposal?",
              options: ["Quality", "Speed", "Cost"],
              timestamp: new Date().toISOString(),
            },
          ],
          expertiseContributions: [],
          feedbackHistory: {},
        },
        adaptiveWorkflow: {
          selectedApproach: "standard",
          activeAgentSet: ["Enhanced Research Agent"],
          complexityLevel: "moderate",
          skipReasons: {},
          currentPhase: "planning",
          phaseCompletionStatus: {},
          adaptationTriggers: [],
        },
      };

      const nextRoute = routeAfterMasterOrchestrator(state);
      expect(nextRoute).toBe("awaiting_strategic_priorities");
    });
  });
});
