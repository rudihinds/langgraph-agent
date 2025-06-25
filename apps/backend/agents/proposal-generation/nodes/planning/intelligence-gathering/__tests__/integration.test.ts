/**
 * Intelligence Gathering Integration Tests
 * Tests for the complete intelligence gathering workflow integration
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { intelligenceGatheringAgent } from "../intelligence-agent.js";
import { intelligenceGatheringSynthesis } from "../synthesis.js";
import { customResearcherNode } from "../custom-researcher.js";
import { intelligenceModificationAgent } from "../modification-agent.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { createIntelligenceSynthesisAgent } from "@/lib/langgraph/common/synthesis-agent.js";

// Mock dependencies
vi.mock("@langchain/anthropic");
vi.mock("@/tools/web-search.js");
vi.mock("@/lib/langgraph/common/synthesis-agent.js", () => ({
  createIntelligenceSynthesisAgent: vi.fn(),
}));
vi.mock("@/state/modules/schemas.js", () => ({
  IntelligenceBriefingSchema: {
    parse: vi.fn((data) => data),
  },
}));

describe("Intelligence Gathering Integration", () => {
  const mockLlmInvoke = vi.fn();
  const mockBindTools = vi.fn();
  const mockSynthesisAgent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock ChatAnthropic with proper structure
    const mockModel = {
      bindTools: mockBindTools,
    };

    mockBindTools.mockReturnValue({
      invoke: mockLlmInvoke,
    });

    (ChatAnthropic as any).mockImplementation(() => mockModel);

    // Mock synthesis agent
    (createIntelligenceSynthesisAgent as any).mockReturnValue(
      mockSynthesisAgent
    );
  });

  describe("complete workflow", () => {
    it("should execute full intelligence gathering workflow", async () => {
      // Initial state
      const initialState = {
        rfpDocument: {
          text: "Organization: TechCorp Inc\nIndustry: Software Development\nRFP for cloud infrastructure services.",
          metadata: {
            organization: "TechCorp Inc",
          },
        },
      };

      // Mock intelligence gathering response
      const mockIntelligenceBriefing = {
        customer_context: {
          company: "TechCorp Inc",
          industry: "Software Development",
          recent_initiatives: [
            {
              name: "Cloud Migration Initiative",
              date: "2024-01",
              source: "Company Blog",
              priority_level: "High",
            },
          ],
        },
        vendor_landscape: {
          current_vendors: [
            {
              vendor_name: "CloudProvider Inc",
              solution_area: "Infrastructure",
              contract_status: "Active",
              source: "Contract database",
            },
          ],
        },
        procurement_history: {
          recent_rfps: [
            {
              title: "Infrastructure Modernization RFP",
              date: "2023-11",
              value: "$1.2M",
              winner: "CloudProvider Inc",
              source: "Public records",
            },
          ],
          buying_patterns: "Prefers proven cloud solutions with strong support",
        },
        decision_makers: [
          {
            name: "Sarah Johnson",
            title: "CTO",
            mentioned_in_rfp: "Section 2.1",
            background: "Former AWS architect with 10+ years experience",
          },
        ],
        metadata: {
          research_completed: "2024-01-15T10:00:00Z",
          gaps: [],
        },
      };

      mockLlmInvoke.mockResolvedValue({
        content: JSON.stringify(mockIntelligenceBriefing),
      });

      // Step 1: Intelligence Gathering
      const gatheringResult = await intelligenceGatheringAgent(
        initialState as any
      );

      expect(gatheringResult.intelligenceGatheringStatus).toBe(
        ProcessingStatus.COMPLETE
      );
      expect(gatheringResult.intelligenceBriefing).toEqual(
        mockIntelligenceBriefing
      );

      // Step 2: Synthesis
      const stateAfterGathering = {
        ...initialState,
        ...gatheringResult,
      };

      mockSynthesisAgent.mockResolvedValue({
        intelligenceBriefing: mockIntelligenceBriefing,
        intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
        messages: [
          {
            role: "assistant",
            content: "Intelligence synthesis completed",
          },
        ],
      });

      const synthesisResult = await intelligenceGatheringSynthesis(
        stateAfterGathering as any
      );

      expect(synthesisResult.intelligenceGatheringStatus).toBe(
        ProcessingStatus.COMPLETE
      );
      expect(mockSynthesisAgent).toHaveBeenCalledWith(stateAfterGathering);
    });

    it("should handle modification workflow", async () => {
      const stateWithIntelligence = {
        intelligenceBriefing: {
          customer_context: {
            company: "TechCorp Inc",
            industry: "Software Development",
            recent_initiatives: [],
          },
          vendor_landscape: { current_vendors: [] },
          procurement_history: { recent_rfps: [], buying_patterns: "" },
          decision_makers: [],
          metadata: { research_completed: "", gaps: [] },
        },
        intelligenceHumanReview: {
          feedback: "Add more details about their recent acquisitions",
          action: "modify",
          timestamp: "2024-01-15T10:00:00Z",
        },
      };

      const modifiedIntelligence = {
        ...stateWithIntelligence.intelligenceBriefing,
        customer_context: {
          ...stateWithIntelligence.intelligenceBriefing.customer_context,
          recent_initiatives: [
            {
              name: "Acquisition of StartupCorp",
              date: "2023-12",
              source: "Press Release",
              priority_level: "High",
            },
          ],
        },
        metadata: {
          ...stateWithIntelligence.intelligenceBriefing.metadata,
          last_modified: "2024-01-15T11:00:00Z",
          modification_history: [
            {
              timestamp: "2024-01-15T11:00:00Z",
              user_feedback: "Add more details about their recent acquisitions",
              modification_type: "user_requested",
            },
          ],
        },
      };

      mockLlmInvoke.mockResolvedValue(modifiedIntelligence);

      const modificationResult = await intelligenceModificationAgent(
        stateWithIntelligence as any
      );

      expect(modificationResult.intelligenceGatheringStatus).toBe(
        ProcessingStatus.IN_PROGRESS
      );
      expect(
        modificationResult.intelligenceBriefing.metadata.modification_history
      ).toHaveLength(1);
      expect(
        modificationResult.intelligenceBriefing.customer_context
          .recent_initiatives
      ).toHaveLength(1);
    });

    it("should handle custom research workflow", async () => {
      const stateWithIntelligence = {
        intelligenceBriefing: {
          customer_context: {
            company: "TechCorp Inc",
            industry: "Software Development",
            recent_initiatives: [],
          },
          vendor_landscape: { current_vendors: [] },
          procurement_history: { recent_rfps: [], buying_patterns: "" },
          decision_makers: [],
          metadata: { research_completed: "2024-01-15T10:00:00Z", gaps: [] },
        },
        intelligenceHumanReview: {
          feedback: "Research their partnerships with AI companies",
          action: "research_other_targets",
          timestamp: "2024-01-15T10:00:00Z",
        },
      };

      mockLlmInvoke.mockResolvedValue({
        content:
          "Partnership with AI Solutions Inc for machine learning platform development. Announced $5M investment in Q4 2023.",
      });

      const customResearchResult = await customResearcherNode(
        stateWithIntelligence as any
      );

      expect(customResearchResult.intelligenceGatheringStatus).toBe(
        ProcessingStatus.COMPLETE
      );
      expect(
        customResearchResult.intelligenceBriefing.metadata.custom_research
      ).toHaveLength(1);
      expect(
        customResearchResult.intelligenceBriefing.metadata.custom_research[0]
      ).toEqual(
        expect.objectContaining({
          request: "Research their partnerships with AI companies",
          findings: expect.stringContaining("AI Solutions Inc"),
        })
      );
    });
  });

  describe("error handling in workflow", () => {
    it("should handle synthesis errors gracefully", async () => {
      const stateWithIntelligence = {
        intelligenceBriefing: {
          customer_context: { company: "Test Corp", industry: "Tech" },
        },
      };

      mockSynthesisAgent.mockRejectedValue(new Error("Synthesis failed"));

      const synthesisResult = await intelligenceGatheringSynthesis(
        stateWithIntelligence as any
      );

      expect(synthesisResult.intelligenceGatheringStatus).toBe(
        ProcessingStatus.ERROR
      );
      expect(synthesisResult.errors).toContain("Synthesis failed");
    });

    it("should handle missing intelligence briefing in synthesis", async () => {
      const stateWithoutIntelligence = {};

      const synthesisResult = await intelligenceGatheringSynthesis(
        stateWithoutIntelligence as any
      );

      expect(synthesisResult.intelligenceGatheringStatus).toBe(
        ProcessingStatus.ERROR
      );
      expect(synthesisResult.errors).toContain(
        "No intelligence data available for synthesis"
      );
    });
  });

  describe("state transitions", () => {
    it("should maintain state consistency through workflow", async () => {
      const initialState = {
        rfpDocument: {
          text: "Organization: TestCorp\nIndustry: Finance",
          metadata: { organization: "TestCorp" },
        },
        userId: "user123",
        sessionId: "session456",
      };

      mockLlmInvoke.mockResolvedValue({
        content: JSON.stringify({
          customer_context: {
            company: "TestCorp",
            industry: "Finance",
            recent_initiatives: [],
          },
          vendor_landscape: { current_vendors: [] },
          procurement_history: { recent_rfps: [], buying_patterns: "" },
          decision_makers: [],
          metadata: { research_completed: "", gaps: [] },
        }),
      });

      const result = await intelligenceGatheringAgent(initialState as any);

      // Verify that original state fields are preserved
      expect(result).not.toHaveProperty("userId");
      expect(result).not.toHaveProperty("sessionId");

      // Verify that intelligence-specific fields are added
      expect(result).toHaveProperty("intelligenceBriefing");
      expect(result).toHaveProperty("intelligenceGatheringStatus");
      expect(result).toHaveProperty("currentStatus");
      expect(result).toHaveProperty("messages");
      expect(result).toHaveProperty("errors");
    });
  });
});
