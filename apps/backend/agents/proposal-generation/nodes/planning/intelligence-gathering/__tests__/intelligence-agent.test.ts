/**
 * Intelligence Gathering Agent Tests
 * Tests for the core intelligence gathering agent implementation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { intelligenceGatheringAgent } from "../intelligence-agent.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { ChatAnthropic } from "@langchain/anthropic";
import { createWebSearchTool } from "@/tools/web-search.js";

// Mock dependencies
vi.mock("@langchain/anthropic");
vi.mock("@/tools/web-search.js");
vi.mock("@/state/modules/schemas.js", () => ({
  IntelligenceBriefingSchema: {
    parse: vi.fn((data) => data),
  },
}));

describe("Intelligence Gathering Agent", () => {
  const mockLlmInvoke = vi.fn();
  const mockBindTools = vi.fn();
  const mockWebSearchTool = vi.fn();

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

    // Mock web search tool
    (createWebSearchTool as any).mockReturnValue(mockWebSearchTool);
  });

  describe("successful intelligence gathering", () => {
    it("should gather intelligence and return structured briefing", async () => {
      const mockState = {
        rfpDocument: {
          text: "Organization: Acme Corp\nIndustry: Technology\nThis is a sample RFP document for testing purposes.",
          metadata: {
            organization: "Acme Corp",
          },
        },
      };

      const mockIntelligenceBriefing = {
        customer_context: {
          company: "Acme Corp",
          industry: "Technology",
          recent_initiatives: [
            {
              name: "Digital Transformation Initiative",
              date: "2024-01",
              source: "Annual Report 2024",
              priority_level: "High",
            },
          ],
        },
        vendor_landscape: {
          current_vendors: [
            {
              vendor_name: "TechVendor Inc",
              solution_area: "Cloud Services",
              contract_status: "Active",
              source: "Contract database",
            },
          ],
        },
        procurement_history: {
          recent_rfps: [
            {
              title: "Cloud Infrastructure RFP",
              date: "2023-12",
              value: "$500K",
              winner: "TechVendor Inc",
              source: "SAM.gov",
            },
          ],
          buying_patterns:
            "Prefers established vendors with proven track record",
        },
        decision_makers: [
          {
            name: "John Smith",
            title: "CTO",
            mentioned_in_rfp: "Section 1.2",
            background: "15 years experience in technology leadership",
          },
        ],
        metadata: {
          research_completed: "2024-01-15T10:00:00Z",
          gaps: [],
        },
      };

      // Mock LLM response with structured intelligence
      mockLlmInvoke.mockResolvedValue({
        content: JSON.stringify(mockIntelligenceBriefing),
      });

      const result = await intelligenceGatheringAgent(mockState as any);

      expect(result).toEqual({
        intelligenceBriefing: mockIntelligenceBriefing,
        intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
        currentStatus: "Intelligence gathering completed for Acme Corp",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            content: expect.stringContaining("Intelligence Gathering Complete"),
          }),
        ]),
        errors: [],
      });

      expect(mockBindTools).toHaveBeenCalledWith([mockWebSearchTool]);
      expect(mockLlmInvoke).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "human" }),
        ])
      );
    });

    it("should handle unstructured LLM response with fallback", async () => {
      const mockState = {
        rfpDocument: {
          text: "Organization: Test Corp\nIndustry: Healthcare",
          metadata: {
            organization: "Test Corp",
          },
        },
      };

      // Mock LLM response without valid JSON
      mockLlmInvoke.mockResolvedValue({
        content: "This is unstructured research content without JSON",
      });

      const result = await intelligenceGatheringAgent(mockState as any);

      expect(result.intelligenceGatheringStatus).toBe(
        ProcessingStatus.COMPLETE
      );
      expect(result.intelligenceBriefing).toBeDefined();
      expect(result.intelligenceBriefing.customer_context.company).toBe(
        "Test Corp"
      );
      expect(result.intelligenceBriefing.customer_context.industry).toBe(
        "Healthcare"
      );
      expect(result.intelligenceBriefing.metadata.gaps).toContain(
        "Structured data parsing failed - manual review recommended"
      );
    });
  });

  describe("error handling", () => {
    it("should handle missing RFP document", async () => {
      const mockState = {
        rfpDocument: null,
      };

      const result = await intelligenceGatheringAgent(mockState as any);

      expect(result).toEqual({
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        currentStatus:
          "Intelligence gathering failed: No RFP document available for intelligence gathering",
        errors: ["No RFP document available for intelligence gathering"],
      });
    });

    it("should handle LLM invocation errors", async () => {
      const mockState = {
        rfpDocument: {
          text: "Sample RFP content",
          metadata: {
            organization: "Test Corp",
          },
        },
      };

      mockLlmInvoke.mockRejectedValue(new Error("LLM service unavailable"));

      const result = await intelligenceGatheringAgent(mockState as any);

      expect(result).toEqual({
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        currentStatus: "Intelligence gathering failed: LLM service unavailable",
        errors: ["LLM service unavailable"],
      });
    });
  });

  describe("company extraction", () => {
    it("should extract company and industry from RFP text", async () => {
      const mockState = {
        rfpDocument: {
          text: `Organization: Global Healthcare Systems
Industry: Healthcare Technology
Department: IT Procurement
This RFP is for cloud infrastructure services.`,
          metadata: {},
        },
      };

      mockLlmInvoke.mockResolvedValue({
        content: JSON.stringify({
          customer_context: {
            company: "Global Healthcare Systems",
            industry: "Healthcare Technology",
            recent_initiatives: [],
          },
          vendor_landscape: { current_vendors: [] },
          procurement_history: { recent_rfps: [], buying_patterns: "" },
          decision_makers: [],
          metadata: { research_completed: "", gaps: [] },
        }),
      });

      const result = await intelligenceGatheringAgent(mockState as any);

      expect(result.intelligenceGatheringStatus).toBe(
        ProcessingStatus.COMPLETE
      );
      expect(result.currentStatus).toContain("Global Healthcare Systems");
    });

    it("should handle missing organization information", async () => {
      const mockState = {
        rfpDocument: {
          text: "This is an RFP without clear organization information.",
          metadata: {},
        },
      };

      mockLlmInvoke.mockResolvedValue({
        content: "Unstructured response",
      });

      const result = await intelligenceGatheringAgent(mockState as any);

      expect(result.intelligenceGatheringStatus).toBe(
        ProcessingStatus.COMPLETE
      );
      expect(result.intelligenceBriefing.customer_context.company).toBe(
        "Unknown Organization"
      );
      expect(result.intelligenceBriefing.customer_context.industry).toBe(
        "Unknown Industry"
      );
    });
  });
});
