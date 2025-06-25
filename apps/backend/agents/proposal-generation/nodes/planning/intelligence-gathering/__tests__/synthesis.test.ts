/**
 * Intelligence Synthesis Tests
 * Tests for the intelligence synthesis functionality using reusable synthesis agent
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { intelligenceGatheringSynthesis } from "../synthesis.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { createIntelligenceSynthesisAgent } from "@/lib/langgraph/common/synthesis-agent.js";

// Mock dependencies
vi.mock("@langchain/anthropic");
vi.mock("@/lib/langgraph/common/synthesis-agent.js", () => ({
  createIntelligenceSynthesisAgent: vi.fn(),
}));

describe("Intelligence Gathering Synthesis", () => {
  const mockSynthesisAgent = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock synthesis agent creation
    (createIntelligenceSynthesisAgent as any).mockReturnValue(
      mockSynthesisAgent
    );
  });

  describe("successful synthesis", () => {
    it("should synthesize intelligence data successfully", async () => {
      const mockState = {
        intelligenceBriefing: {
          customer_context: {
            company: "TechCorp Inc",
            industry: "Software Development",
            recent_initiatives: [
              {
                name: "Digital Transformation",
                date: "2024-01",
                source: "Annual Report",
                priority_level: "High",
              },
            ],
          },
          vendor_landscape: {
            current_vendors: [
              {
                vendor_name: "CloudVendor Inc",
                solution_area: "Cloud Infrastructure",
                contract_status: "Active",
                source: "Contract database",
              },
            ],
          },
          procurement_history: {
            recent_rfps: [
              {
                title: "Cloud Services RFP",
                date: "2023-12",
                value: "$500K",
                winner: "CloudVendor Inc",
                source: "SAM.gov",
              },
            ],
            buying_patterns: "Prefers established vendors",
          },
          decision_makers: [
            {
              name: "John Smith",
              title: "CTO",
              mentioned_in_rfp: "Section 1.2",
              background: "15 years in tech leadership",
            },
          ],
          metadata: {
            research_completed: "2024-01-15T10:00:00Z",
            gaps: [],
          },
        },
      };

      const synthesizedResult = {
        intelligenceBriefing: mockState.intelligenceBriefing,
        intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
        messages: [
          {
            role: "assistant",
            content: "Intelligence synthesis completed successfully",
          },
        ],
      };

      mockSynthesisAgent.mockResolvedValue(synthesizedResult);

      const result = await intelligenceGatheringSynthesis(mockState as any);

      expect(result).toEqual({
        ...synthesizedResult,
        currentStatus: "Intelligence synthesis completed",
      });

      expect(createIntelligenceSynthesisAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: "claude-3-5-sonnet-20241022",
          temperature: 0.2,
          maxTokens: 6000,
        })
      );

      expect(mockSynthesisAgent).toHaveBeenCalledWith(mockState);
    });

    it("should handle synthesis with custom research data", async () => {
      const mockState = {
        intelligenceBriefing: {
          customer_context: {
            company: "HealthCorp",
            industry: "Healthcare",
            recent_initiatives: [],
          },
          vendor_landscape: { current_vendors: [] },
          procurement_history: { recent_rfps: [], buying_patterns: "" },
          decision_makers: [],
          metadata: {
            research_completed: "2024-01-15T10:00:00Z",
            gaps: [],
            custom_research: [
              {
                request: "Research AI partnerships",
                findings: "Partnership with AI Solutions Inc for ML platform",
                timestamp: "2024-01-15T11:00:00Z",
              },
            ],
          },
        },
      };

      const synthesizedResult = {
        intelligenceBriefing: {
          ...mockState.intelligenceBriefing,
          metadata: {
            ...mockState.intelligenceBriefing.metadata,
            synthesis_insights: ["Custom research reveals strong AI focus"],
          },
        },
        intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
        messages: [
          {
            role: "assistant",
            content: "Intelligence synthesis with custom research completed",
          },
        ],
      };

      mockSynthesisAgent.mockResolvedValue(synthesizedResult);

      const result = await intelligenceGatheringSynthesis(mockState as any);

      expect(result.intelligenceBriefing.metadata.custom_research).toHaveLength(
        1
      );
      expect(mockSynthesisAgent).toHaveBeenCalledWith(mockState);
    });
  });

  describe("error handling", () => {
    it("should handle missing intelligence briefing", async () => {
      const mockState = {};

      const result = await intelligenceGatheringSynthesis(mockState as any);

      expect(result).toEqual({
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        currentStatus:
          "Intelligence synthesis failed: No intelligence data available for synthesis",
        errors: ["No intelligence data available for synthesis"],
      });

      expect(mockSynthesisAgent).not.toHaveBeenCalled();
    });

    it("should handle synthesis agent errors", async () => {
      const mockState = {
        intelligenceBriefing: {
          customer_context: { company: "Test Corp", industry: "Tech" },
        },
      };

      mockSynthesisAgent.mockRejectedValue(
        new Error("Synthesis processing failed")
      );

      const result = await intelligenceGatheringSynthesis(mockState as any);

      expect(result).toEqual({
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        currentStatus:
          "Intelligence synthesis failed: Synthesis processing failed",
        errors: ["Synthesis processing failed"],
      });
    });

    it("should handle synthesis agent returning undefined", async () => {
      const mockState = {
        intelligenceBriefing: {
          customer_context: { company: "Test Corp", industry: "Tech" },
        },
      };

      mockSynthesisAgent.mockResolvedValue(undefined);

      const result = await intelligenceGatheringSynthesis(mockState as any);

      expect(result).toEqual({
        currentStatus: "Intelligence synthesis completed",
      });
    });
  });

  describe("synthesis agent configuration", () => {
    it("should create synthesis agent with correct configuration", async () => {
      const mockState = {
        intelligenceBriefing: {
          customer_context: { company: "Test Corp", industry: "Tech" },
        },
      };

      mockSynthesisAgent.mockResolvedValue({
        intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
      });

      await intelligenceGatheringSynthesis(mockState as any);

      expect(createIntelligenceSynthesisAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          modelName: "claude-3-5-sonnet-20241022",
          temperature: 0.2,
          maxTokens: 6000,
        })
      );
    });

    it("should pass state correctly to synthesis agent", async () => {
      const complexState = {
        intelligenceBriefing: {
          customer_context: {
            company: "Complex Corp",
            industry: "Multi-Industry",
            recent_initiatives: [
              {
                name: "Initiative 1",
                date: "2024-01",
                source: "Source 1",
                priority_level: "High",
              },
              {
                name: "Initiative 2",
                date: "2023-12",
                source: "Source 2",
                priority_level: "Medium",
              },
            ],
          },
          vendor_landscape: {
            current_vendors: [
              {
                vendor_name: "Vendor A",
                solution_area: "Area A",
                contract_status: "Active",
                source: "DB",
              },
              {
                vendor_name: "Vendor B",
                solution_area: "Area B",
                contract_status: "Expiring",
                source: "DB",
              },
            ],
          },
          procurement_history: {
            recent_rfps: [
              {
                title: "RFP 1",
                date: "2023-11",
                value: "$1M",
                winner: "Vendor A",
                source: "SAM",
              },
            ],
            buying_patterns: "Complex procurement patterns",
          },
          decision_makers: [
            {
              name: "Person 1",
              title: "CTO",
              mentioned_in_rfp: "Sec 1",
              background: "Tech background",
            },
          ],
          metadata: {
            research_completed: "2024-01-15T10:00:00Z",
            gaps: ["Gap 1", "Gap 2"],
          },
        },
        additionalField: "should not affect synthesis",
      };

      mockSynthesisAgent.mockResolvedValue({
        intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
      });

      await intelligenceGatheringSynthesis(complexState as any);

      expect(mockSynthesisAgent).toHaveBeenCalledWith(complexState);
    });
  });
});
