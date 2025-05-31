/**
 * Master Orchestrator Node Tests
 *
 * Comprehensive test suite for the Master Orchestrator Node implementation.
 * Tests RFP analysis, workflow decisions, HITL integration, and error handling.
 */

import { test, expect, describe, beforeEach, vi, MockedFunction } from "vitest";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import {
  masterOrchestratorNode,
  routeAfterMasterOrchestrator,
  awaitStrategicPrioritiesNode,
} from "../master_orchestrator.js";
import {
  OverallProposalState,
  ProcessingStatus,
  ComplexityLevel,
  WorkflowApproach,
  InterruptProcessingStatus,
  RFPDocument,
  InterruptStatus,
} from "@/state/modules/types.js";
import { ENV } from "../../../../../lib/config/env.js";

// Mock the ChatAnthropic implementation
vi.mock("@langchain/anthropic", () => ({
  ChatAnthropic: vi.fn(),
}));

// Mock the logger
vi.mock("@/lib/logger.js", () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

// Mock ENV configuration
vi.mock("../../../../../lib/config/env.js", () => ({
  ENV: {
    ANTHROPIC_API_KEY: "test-api-key",
  },
}));

// Mock interrupt function
vi.mock("@langchain/langgraph", () => ({
  interrupt: vi.fn(),
}));

describe("Master Orchestrator Node", () => {
  let mockLLM: {
    invoke: MockedFunction<any>;
  };

  let baseState: OverallProposalState;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup mock LLM
    mockLLM = {
      invoke: vi.fn(),
    };

    (ChatAnthropic as any).mockImplementation(() => mockLLM);

    // Create base state for testing
    const now = new Date().toISOString();
    baseState = {
      userId: "test-user",
      sessionId: "test-session",
      proposalId: "test-proposal",
      createdAt: now,
      updatedAt: now,
      rfpDocument: {
        raw: "Request for Proposal for technology consulting services in healthcare sector. Complex requirements include HIPAA compliance, integration with existing systems, and 24/7 support capabilities.",
        parsed: {
          sections: ["Executive Summary", "Technical Approach"],
          requirements: ["HIPAA compliance", "System integration"],
          evaluationCriteria: ["Technical competence", "Cost effectiveness"],
        },
        metadata: {
          title: "Healthcare Technology RFP",
          organization: "Test Healthcare",
          submissionDeadline: "2024-03-01",
          pageLimit: 10,
          formatRequirements: ["PDF format"],
        },
      },
      rfpProcessingStatus: ProcessingStatus.LOADED,
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
      lastUpdatedAt: now,
      status: ProcessingStatus.LOADED,
    };
  });

  describe("RFP Analysis and Workflow Decision", () => {
    test("should analyze simple RFP and recommend accelerated approach", async () => {
      // Mock LLM response for simple RFP
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          rfp_analysis: {
            industry: "Technology",
            specialization: "Basic consulting",
            complexity: "Simple",
            complexity_factors: [
              "Straightforward requirements",
              "Standard timeline",
            ],
            contract_value_estimate: "$50,000 - $100,000",
            timeline_pressure: "Low",
            strategic_focus: ["Technical competence", "Cost effectiveness"],
            submission_requirements: {
              page_limit: 10,
              sections_required: ["Executive Summary", "Technical Approach"],
              attachments_needed: ["Team Resumes"],
            },
          },
          user_approach_selection: {
            selected_agents: ["Enhanced Research", "Solution Decoder"],
            research_depth: "Basic",
            custom_focus_areas: ["Technical delivery"],
          },
          early_risk_assessment: [
            {
              risk: "Timeline compression",
              severity: "Low",
              mitigation: "Standard project management",
              confidence: 0.8,
            },
          ],
          confidence_score: 0.85,
        }),
      });

      const result = await masterOrchestratorNode(baseState);

      expect(result.planningIntelligence?.rfpCharacteristics).toBeDefined();
      expect(result.planningIntelligence.rfpCharacteristics.industry).toBe(
        "Technology"
      );
      expect(result.planningIntelligence.rfpCharacteristics.complexity).toBe(
        "simple"
      );

      expect(result.adaptiveWorkflow?.selectedApproach).toBe("accelerated");
      expect(result.adaptiveWorkflow.activeAgentSet).toEqual([
        "Enhanced Research",
        "Solution Decoder",
      ]);

      expect(result.userCollaboration?.userQueries).toHaveLength(1);
      expect(result.userCollaboration.userQueries[0].question).toContain(
        "accelerated approach"
      );

      expect(result.currentPhase).toBe("planning");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toBeInstanceOf(AIMessage);
    });

    test("should analyze complex RFP and recommend comprehensive approach", async () => {
      // Update RFP to be more complex
      baseState.rfpDocument.text =
        "Comprehensive enterprise healthcare system integration with multi-vendor compatibility, extensive regulatory compliance, custom development requirements, and 18-month implementation timeline with multiple stakeholder groups.";

      // Mock LLM response for complex RFP
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          rfp_analysis: {
            industry: "Healthcare",
            specialization: "Enterprise system integration",
            complexity: "Complex",
            complexity_factors: [
              "Multi-vendor integration",
              "Regulatory compliance",
              "Long timeline",
            ],
            contract_value_estimate: "$2,000,000 - $5,000,000",
            timeline_pressure: "High",
            strategic_focus: [
              "Regulatory compliance",
              "Integration expertise",
              "Change management",
            ],
            submission_requirements: {
              page_limit: 50,
              sections_required: [
                "Executive Summary",
                "Technical Approach",
                "Compliance Plan",
                "Risk Management",
              ],
              attachments_needed: [
                "SOC2 Certification",
                "HIPAA Compliance",
                "Reference Letters",
              ],
            },
          },
          user_approach_selection: {
            selected_agents: [
              "Enhanced Research",
              "Industry Specialist",
              "Competitive Intelligence",
              "Requirement Analysis",
              "Evaluation Prediction",
              "Solution Decoder",
              "Strategic Positioning",
            ],
            research_depth: "Deep",
            custom_focus_areas: [
              "Regulatory compliance",
              "Integration challenges",
            ],
          },
          early_risk_assessment: [
            {
              risk: "Regulatory compliance complexity",
              severity: "High",
              mitigation: "Engage compliance specialist early",
              confidence: 0.9,
            },
          ],
          confidence_score: 0.75,
        }),
      });

      const result = await masterOrchestratorNode(baseState);

      expect(result.planningIntelligence?.rfpCharacteristics?.complexity).toBe(
        "complex"
      );
      expect(result.adaptiveWorkflow?.selectedApproach).toBe("comprehensive");
      expect(result.adaptiveWorkflow?.activeAgentSet).toHaveLength(7);
      expect(
        result.planningIntelligence?.earlyRiskAssessment?.[0]?.severity
      ).toBe("High");
    });

    test("should handle standard complexity with balanced approach", async () => {
      // Mock LLM response for medium complexity
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          rfp_analysis: {
            industry: "Government",
            specialization: "Public sector consulting",
            complexity: "Medium",
            complexity_factors: [
              "Government procedures",
              "Multiple stakeholders",
            ],
            contract_value_estimate: "$200,000 - $500,000",
            timeline_pressure: "Medium",
            strategic_focus: ["Government experience", "Process improvement"],
            submission_requirements: {
              page_limit: 25,
              sections_required: [
                "Executive Summary",
                "Technical Approach",
                "Past Performance",
              ],
              attachments_needed: [
                "GSA Schedule",
                "Past Performance References",
              ],
            },
          },
          user_approach_selection: {
            selected_agents: [
              "Enhanced Research",
              "Industry Specialist",
              "Requirement Analysis",
              "Solution Decoder",
              "Strategic Positioning",
            ],
            research_depth: "Standard",
            custom_focus_areas: ["Government processes"],
          },
          early_risk_assessment: [
            {
              risk: "Government approval delays",
              severity: "Medium",
              mitigation: "Build in approval buffer time",
              confidence: 0.7,
            },
          ],
          confidence_score: 0.8,
        }),
      });

      const result = await masterOrchestratorNode(baseState);

      expect(result.adaptiveWorkflow?.selectedApproach).toBe("standard");
      expect(result.adaptiveWorkflow?.activeAgentSet).toHaveLength(5);
      expect(result.planningIntelligence?.rfpCharacteristics?.industry).toBe(
        "Government"
      );
    });
  });

  describe("Error Handling", () => {
    test("should handle LLM analysis failure gracefully", async () => {
      // Mock LLM to throw error
      mockLLM.invoke.mockRejectedValue(new Error("API connection failed"));

      const result = await masterOrchestratorNode(baseState);

      // Should provide fallback analysis
      expect(result.planningIntelligence?.rfpCharacteristics?.industry).toBe(
        "Other"
      );
      expect(result.planningIntelligence?.rfpCharacteristics?.complexity).toBe(
        "medium"
      );
      expect(result.adaptiveWorkflow?.selectedApproach).toBe("standard");
      expect(
        result.planningIntelligence?.earlyRiskAssessment?.[0]?.risk
      ).toContain("Analysis system error");
      expect(
        result.planningIntelligence?.rfpCharacteristics?.confidenceScore
      ).toBe(0.3);
    });

    test("should handle malformed LLM response", async () => {
      // Mock LLM to return invalid JSON
      mockLLM.invoke.mockResolvedValue({
        content: "This is not valid JSON for analysis",
      });

      const result = await masterOrchestratorNode(baseState);

      // Should provide fallback analysis
      expect(result.planningIntelligence?.rfpCharacteristics?.industry).toBe(
        "Other"
      );
      expect(result.adaptiveWorkflow?.selectedApproach).toBe("standard");
    });

    test("should handle missing RFP text", async () => {
      // Remove RFP text
      baseState.rfpDocument.text = "";

      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          rfp_analysis: {
            industry: "Other",
            specialization: "General",
            complexity: "Medium",
            complexity_factors: ["No RFP content available"],
            contract_value_estimate: "Unknown",
            timeline_pressure: "Medium",
            strategic_focus: ["Best practices"],
            submission_requirements: {
              page_limit: "not_specified",
              sections_required: ["Executive Summary"],
              attachments_needed: [],
            },
          },
          user_approach_selection: {
            selected_agents: ["Enhanced Research"],
            research_depth: "Basic",
            custom_focus_areas: [],
          },
          early_risk_assessment: [],
          confidence_score: 0.3,
        }),
      });

      const result = await masterOrchestratorNode(baseState);

      expect(
        result.planningIntelligence?.rfpCharacteristics?.confidenceScore
      ).toBeLessThan(0.5);
      expect(
        result.planningIntelligence?.rfpCharacteristics?.complexityFactors
      ).toContain("No RFP content available");
    });
  });

  describe("User Collaboration Integration", () => {
    test("should create strategic priorities user query", async () => {
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          rfp_analysis: {
            industry: "Technology",
            specialization: "Cloud migration",
            complexity: "Medium",
            complexity_factors: ["Cloud architecture", "Data migration"],
            contract_value_estimate: "$300,000",
            timeline_pressure: "Medium",
            strategic_focus: ["Cloud expertise", "Migration experience"],
            submission_requirements: {
              page_limit: 20,
              sections_required: ["Technical Approach", "Migration Plan"],
              attachments_needed: ["Cloud Certifications"],
            },
          },
          user_approach_selection: {
            selected_agents: ["Enhanced Research", "Solution Decoder"],
            research_depth: "Standard",
            custom_focus_areas: ["Cloud migration"],
          },
          early_risk_assessment: [],
          confidence_score: 0.8,
        }),
      });

      const result = await masterOrchestratorNode(baseState);

      const userQuery = result.userCollaboration?.userQueries?.[0];
      expect(userQuery).toBeDefined();
      expect(userQuery?.question).toContain("strategic priorities");
      expect(userQuery?.options).toContain("Market differentiation");
      expect(userQuery?.options).toContain("Technical excellence");
      expect(userQuery?.multiSelect).toBe(true);
      expect(userQuery?.context).toBeDefined();
      expect(userQuery?.context?.rfp_analysis).toBeDefined();
    });

    test("should include existing user collaboration data", async () => {
      // Add existing user collaboration data
      baseState.userCollaboration = {
        strategicPriorities: ["Innovation focus"],
        competitiveAdvantages: ["AI expertise"],
        riskFactors: [],
        userQueries: [
          {
            id: "existing-query",
            question: "Previous question",
            options: ["Option 1"],
            timestamp: "2024-01-01T00:00:00Z",
            response: "Previous response",
          },
        ],
        expertiseContributions: [],
        feedbackHistory: {},
        preferredApproach: "standard",
      };

      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          rfp_analysis: {
            industry: "Technology",
            specialization: "AI consulting",
            complexity: "Simple",
            complexity_factors: ["Standard AI implementation"],
            contract_value_estimate: "$100,000",
            timeline_pressure: "Low",
            strategic_focus: ["AI expertise"],
            submission_requirements: {
              page_limit: 15,
              sections_required: ["AI Approach"],
              attachments_needed: [],
            },
          },
          user_approach_selection: {
            selected_agents: ["Enhanced Research"],
            research_depth: "Standard",
            custom_focus_areas: [],
          },
          early_risk_assessment: [],
          confidence_score: 0.85,
        }),
      });

      const result = await masterOrchestratorNode(baseState);

      expect(result.userCollaboration?.userQueries).toHaveLength(2);
      expect(result.userCollaboration?.strategicPriorities).toContain(
        "Innovation focus"
      );
      expect(result.userCollaboration?.competitiveAdvantages).toContain(
        "AI expertise"
      );
    });
  });

  describe("State Management", () => {
    test("should preserve existing state fields", async () => {
      // Add existing planning intelligence
      baseState.planningIntelligence = {
        rfpCharacteristics: {
          industry: "Existing",
          specialization: "Previous analysis",
          complexity: "simple",
          complexityFactors: ["Previous factor"],
          contractValueEstimate: "$50,000",
          timelinePressure: "Low",
          strategicFocus: ["Previous focus"],
          submissionRequirements: {
            page_limit: 10,
            sections_required: ["Previous section"],
            attachments_needed: [],
          },
          confidenceScore: 0.5,
        },
      };

      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          rfp_analysis: {
            industry: "Technology",
            specialization: "New analysis",
            complexity: "Medium",
            complexity_factors: ["New factor"],
            contract_value_estimate: "$200,000",
            timeline_pressure: "Medium",
            strategic_focus: ["New focus"],
            submission_requirements: {
              page_limit: 20,
              sections_required: ["New section"],
              attachments_needed: [],
            },
          },
          user_approach_selection: {
            selected_agents: ["Enhanced Research"],
            research_depth: "Standard",
            custom_focus_areas: [],
          },
          early_risk_assessment: [],
          confidence_score: 0.8,
        }),
      });

      const result = await masterOrchestratorNode(baseState);

      // Should update RFP characteristics but preserve other planning intelligence
      expect(result.planningIntelligence?.rfpCharacteristics?.industry).toBe(
        "Technology"
      );
      expect(
        result.planningIntelligence?.rfpCharacteristics?.specialization
      ).toBe("New analysis");
    });

    test("should set current phase and step correctly", async () => {
      mockLLM.invoke.mockResolvedValue({
        content: JSON.stringify({
          rfp_analysis: {
            industry: "Technology",
            specialization: "Software development",
            complexity: "Simple",
            complexity_factors: ["Standard requirements"],
            contract_value_estimate: "$75,000",
            timeline_pressure: "Low",
            strategic_focus: ["Technical delivery"],
            submission_requirements: {
              page_limit: 15,
              sections_required: ["Technical Approach"],
              attachments_needed: [],
            },
          },
          user_approach_selection: {
            selected_agents: ["Enhanced Research"],
            research_depth: "Basic",
            custom_focus_areas: [],
          },
          early_risk_assessment: [],
          confidence_score: 0.8,
        }),
      });

      const result = await masterOrchestratorNode(baseState);

      expect(result.currentPhase).toBe("planning");
      expect(result.currentStep).toBe("master_orchestrator_analysis");
    });
  });
});

describe("Master Orchestrator Routing", () => {
  let baseState: OverallProposalState;

  beforeEach(() => {
    baseState = {
      userId: "test-user",
      sessionId: "test-session",
      proposalId: "test-proposal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rfpDocument: {
        raw: "Request for Proposal for technology consulting services in healthcare sector. Complex requirements include HIPAA compliance, integration with existing systems, and 24/7 support capabilities.",
        parsed: {
          sections: ["Executive Summary", "Technical Approach"],
          requirements: ["HIPAA compliance", "System integration"],
          evaluationCriteria: ["Technical competence", "Cost effectiveness"],
        },
        metadata: {
          title: "Healthcare Technology RFP",
          organization: "Test Healthcare",
          submissionDeadline: "2024-03-01",
          pageLimit: 10,
          formatRequirements: ["PDF format"],
        },
      },
      rfpProcessingStatus: ProcessingStatus.LOADED,
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
      status: ProcessingStatus.LOADED,
    };
  });

  describe("routeAfterMasterOrchestrator", () => {
    test("should route to await_strategic_priorities when user query pending", () => {
      baseState.userCollaboration = {
        strategicPriorities: [],
        competitiveAdvantages: [],
        riskFactors: [],
        userQueries: [
          {
            id: "pending-query",
            question: "What are your priorities?",
            options: ["Option 1", "Option 2"],
            timestamp: "2024-01-01T00:00:00Z",
            // No response - still pending
          },
        ],
        expertiseContributions: [],
        feedbackHistory: {},
      };

      const nextNode = routeAfterMasterOrchestrator(baseState);
      expect(nextNode).toBe("await_strategic_priorities");
    });

    test("should route to enhanced_research when included in active agents", () => {
      baseState.adaptiveWorkflow = {
        selectedApproach: "standard",
        activeAgentSet: ["Enhanced Research", "Solution Decoder"],
        complexityLevel: "medium",
        skipReasons: {},
        currentPhase: "planning",
        phaseCompletionStatus: {},
        adaptationTriggers: [],
      };

      baseState.userCollaboration = {
        strategicPriorities: [],
        competitiveAdvantages: [],
        riskFactors: [],
        userQueries: [
          {
            id: "answered-query",
            question: "What are your priorities?",
            options: ["Option 1", "Option 2"],
            timestamp: "2024-01-01T00:00:00Z",
            response: "Option 1",
          },
        ],
        expertiseContributions: [],
        feedbackHistory: {},
      };

      const nextNode = routeAfterMasterOrchestrator(baseState);
      expect(nextNode).toBe("enhanced_research");
    });

    test("should route to solution_decoder when enhanced_research not in active agents", () => {
      baseState.adaptiveWorkflow = {
        selectedApproach: "accelerated",
        activeAgentSet: ["Solution Decoder"],
        complexityLevel: "simple",
        skipReasons: {},
        currentPhase: "planning",
        phaseCompletionStatus: {},
        adaptationTriggers: [],
      };

      const nextNode = routeAfterMasterOrchestrator(baseState);
      expect(nextNode).toBe("solution_decoder");
    });

    test("should fallback to deep_research when no specific workflow", () => {
      baseState.adaptiveWorkflow = {
        selectedApproach: "custom",
        activeAgentSet: [],
        complexityLevel: "medium",
        skipReasons: {},
        currentPhase: "planning",
        phaseCompletionStatus: {},
        adaptationTriggers: [],
      };

      const nextNode = routeAfterMasterOrchestrator(baseState);
      expect(nextNode).toBe("deep_research");
    });
  });
});

describe("Await Strategic Priorities Node", () => {
  let baseState: OverallProposalState;

  beforeEach(() => {
    baseState = {
      userId: "test-user",
      sessionId: "test-session",
      proposalId: "test-proposal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rfpDocument: {
        raw: "Request for Proposal for technology consulting services in healthcare sector. Complex requirements include HIPAA compliance, integration with existing systems, and 24/7 support capabilities.",
        parsed: {
          sections: ["Executive Summary", "Technical Approach"],
          requirements: ["HIPAA compliance", "System integration"],
          evaluationCriteria: ["Technical competence", "Cost effectiveness"],
        },
        metadata: {
          title: "Healthcare Technology RFP",
          organization: "Test Healthcare",
          submissionDeadline: "2024-03-01",
          pageLimit: 10,
          formatRequirements: ["PDF format"],
        },
      },
      rfpProcessingStatus: ProcessingStatus.LOADED,
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
      status: ProcessingStatus.LOADED,
    };
    baseState.userCollaboration = {
      strategicPriorities: [],
      competitiveAdvantages: [],
      riskFactors: [],
      userQueries: [
        {
          id: "strategic-query",
          question: "What are your strategic priorities?",
          options: ["Market differentiation", "Cost optimization"],
          timestamp: "2024-01-01T00:00:00Z",
        },
      ],
      expertiseContributions: [],
      feedbackHistory: {},
    };
  });

  test("should set interrupt status for HITL", async () => {
    const result = await awaitStrategicPrioritiesNode(baseState);

    expect(result.currentStep).toBe("awaiting_strategic_priorities");
    expect(result.interruptStatus?.isInterrupted).toBe(true);
    expect(result.interruptStatus?.interruptionPoint).toBe(
      "strategic_priorities"
    );
    expect(result.interruptStatus?.processingStatus).toBe("PENDING");
  });

  test("should include user query in interrupt metadata", async () => {
    const result = await awaitStrategicPrioritiesNode(baseState);

    expect(result.interruptStatus?.metadata?.latestQuery).toBeDefined();
    expect(result.interruptStatus?.metadata?.latestQuery.question).toContain(
      "strategic priorities"
    );
    expect(result.interruptStatus?.metadata?.availableOptions).toContain(
      "Market differentiation"
    );
  });
});
