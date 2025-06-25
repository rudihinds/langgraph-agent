/**
 * Custom Researcher Node Tests
 * Tests for the custom research functionality based on user requests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { customResearcherNode } from "../custom-researcher.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { ChatAnthropic } from "@langchain/anthropic";
import { createWebSearchTool } from "@/tools/web-search.js";

// Mock dependencies
vi.mock("@langchain/anthropic");
vi.mock("@/tools/web-search.js");

describe("Custom Researcher Node", () => {
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

  describe("successful custom research", () => {
    it("should perform targeted research based on user request", async () => {
      const mockState = {
        intelligenceBriefing: {
          customer_context: {
            company: "Acme Corp",
            industry: "Technology",
            recent_initiatives: [],
          },
          vendor_landscape: { current_vendors: [] },
          procurement_history: { recent_rfps: [], buying_patterns: "" },
          decision_makers: [],
          metadata: { research_completed: "", gaps: [] },
        },
        intelligenceHumanReview: {
          feedback:
            "Research their recent cybersecurity initiatives and partnerships",
          action: "research_other_targets",
          timestamp: "2024-01-15T10:00:00Z",
        },
      };

      const mockResearchFindings =
        "Found recent cybersecurity partnership with SecureVendor Inc announced in Q4 2023. Initiative includes $2M investment in zero-trust architecture.";

      mockLlmInvoke.mockResolvedValue({
        content: mockResearchFindings,
      });

      const result = await customResearcherNode(mockState as any);

      expect(result).toEqual({
        intelligenceBriefing: expect.objectContaining({
          customer_context: {
            company: "Acme Corp",
            industry: "Technology",
            recent_initiatives: [],
          },
          metadata: expect.objectContaining({
            custom_research: expect.arrayContaining([
              expect.objectContaining({
                request:
                  "Research their recent cybersecurity initiatives and partnerships",
                findings: mockResearchFindings,
                timestamp: expect.any(String),
              }),
            ]),
          }),
        }),
        intelligenceGatheringStatus: ProcessingStatus.COMPLETE,
        currentStatus:
          "Custom research completed: Research their recent cybersecurity initiatives and partnerships",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "assistant",
            content: expect.stringContaining("Additional Research Complete"),
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

    it("should integrate findings with existing intelligence", async () => {
      const existingIntelligence = {
        customer_context: {
          company: "Test Corp",
          industry: "Healthcare",
          recent_initiatives: [
            {
              name: "Digital Health Initiative",
              date: "2024-01",
              source: "Press Release",
              priority_level: "High",
            },
          ],
        },
        vendor_landscape: { current_vendors: [] },
        procurement_history: { recent_rfps: [], buying_patterns: "" },
        decision_makers: [],
        metadata: {
          research_completed: "2024-01-15T09:00:00Z",
          gaps: [],
        },
      };

      const mockState = {
        intelligenceBriefing: existingIntelligence,
        intelligenceHumanReview: {
          feedback: "Look into their AI/ML partnerships",
          action: "research_other_targets",
          timestamp: "2024-01-15T10:00:00Z",
        },
      };

      mockLlmInvoke.mockResolvedValue({
        content:
          "Partnership with AI Solutions Inc for machine learning platform implementation.",
      });

      const result = await customResearcherNode(mockState as any);

      expect(result.intelligenceBriefing).toEqual(
        expect.objectContaining({
          customer_context: existingIntelligence.customer_context,
          metadata: expect.objectContaining({
            research_completed: expect.any(String),
            custom_research: expect.arrayContaining([
              expect.objectContaining({
                request: "Look into their AI/ML partnerships",
                findings:
                  "Partnership with AI Solutions Inc for machine learning platform implementation.",
              }),
            ]),
          }),
        })
      );
    });
  });

  describe("error handling", () => {
    it("should handle missing user request", async () => {
      const mockState = {
        intelligenceBriefing: {
          customer_context: { company: "Test Corp", industry: "Tech" },
        },
        intelligenceHumanReview: {
          action: "research_other_targets",
          timestamp: "2024-01-15T10:00:00Z",
          // No feedback field
        },
      };

      const result = await customResearcherNode(mockState as any);

      expect(result).toEqual({
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        currentStatus:
          "Custom research failed: No user research request provided",
        errors: ["No user research request provided"],
      });
    });

    it("should handle LLM invocation errors", async () => {
      const mockState = {
        intelligenceBriefing: {
          customer_context: { company: "Test Corp", industry: "Tech" },
        },
        intelligenceHumanReview: {
          feedback: "Research their partnerships",
          action: "research_other_targets",
          timestamp: "2024-01-15T10:00:00Z",
        },
      };

      mockLlmInvoke.mockRejectedValue(new Error("Network timeout"));

      const result = await customResearcherNode(mockState as any);

      expect(result).toEqual({
        intelligenceGatheringStatus: ProcessingStatus.ERROR,
        currentStatus: "Custom research failed: Network timeout",
        errors: ["Network timeout"],
      });
    });
  });

  describe("research context extraction", () => {
    it("should extract proper context for research", async () => {
      const mockState = {
        intelligenceBriefing: {
          customer_context: {
            company: "Global Corp",
            industry: "Manufacturing",
          },
        },
        intelligenceHumanReview: {
          feedback: "Research their sustainability initiatives",
          action: "research_other_targets",
          timestamp: "2024-01-15T10:00:00Z",
        },
      };

      mockLlmInvoke.mockResolvedValue({
        content: "Sustainability research findings",
      });

      await customResearcherNode(mockState as any);

      const systemPromptCall = mockLlmInvoke.mock.calls[0][0][0];
      expect(systemPromptCall.content).toContain("Global Corp");
      expect(systemPromptCall.content).toContain("Manufacturing");
      expect(systemPromptCall.content).toContain(
        "Research their sustainability initiatives"
      );

      const humanPromptCall = mockLlmInvoke.mock.calls[0][0][1];
      expect(humanPromptCall.content).toContain(
        "Research their sustainability initiatives"
      );
    });

    it("should handle missing intelligence briefing", async () => {
      const mockState = {
        intelligenceHumanReview: {
          feedback: "Research partnerships",
          action: "research_other_targets",
          timestamp: "2024-01-15T10:00:00Z",
        },
      };

      mockLlmInvoke.mockResolvedValue({
        content: "Research findings",
      });

      const result = await customResearcherNode(mockState as any);

      expect(result.intelligenceBriefing).toEqual(
        expect.objectContaining({
          customer_context: {
            company: "Research Target",
            industry: "Unknown",
            recent_initiatives: [],
          },
          metadata: expect.objectContaining({
            custom_research: expect.arrayContaining([
              expect.objectContaining({
                request: "Research partnerships",
                findings: "Research findings",
              }),
            ]),
          }),
        })
      );
    });
  });
});
