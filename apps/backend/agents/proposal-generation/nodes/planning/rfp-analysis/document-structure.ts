/**
 * Document Structure Analysis Agent
 * 
 * Analyzes document architecture to uncover hidden priorities, identify structural
 * emphasis patterns, and detect requirements buried in administrative sections.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";

// Initialize LLM for document structure analysis
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.2, // Low temperature for consistent structural analysis
  maxTokens: 8000,
});

// Schema for structured document structure analysis output
const DocumentStructureSchema = z.object({
  document_metadata: z.object({
    total_pages: z.number(),
    total_sections: z.number(),
    appendices_count: z.number(),
    structural_complexity: z.enum(["Simple", "Moderate", "Complex"]),
    organization_quality: z.enum(["Clear", "Adequate", "Confusing"])
  }),
  section_weight_analysis: z.array(z.object({
    section_name: z.string(),
    stated_weight_percentage: z.number(),
    actual_content_pages: z.number(),
    detail_level: z.enum(["High", "Medium", "Low"]),
    requirement_density: z.number(),
    true_priority_assessment: z.enum(["Critical", "High", "Medium", "Low"]),
    weight_discrepancy: z.enum(["Significantly Higher", "Moderately Higher", "Matches", "Lower"]),
    discrepancy_evidence: z.array(z.string()),
    strategic_implications: z.string()
  })),
  cross_reference_patterns: z.array(z.object({
    requirement_theme: z.string(),
    mention_locations: z.array(z.object({
      section: z.string(),
      page: z.number(),
      context: z.string(),
      emphasis_level: z.enum(["High", "Medium", "Low"])
    })),
    variation_analysis: z.string(),
    consistency_assessment: z.enum(["Highly Consistent", "Mostly Consistent", "Some Variations", "Significant Variations"]),
    strategic_importance: z.enum(["Critical", "High", "Medium", "Low"]),
    integration_complexity: z.enum(["Simple", "Moderate", "Complex"])
  })),
  hidden_requirements: z.array(z.object({
    requirement: z.string(),
    location_type: z.enum(["Appendix", "Terms and Conditions", "Administrative Section", "Boilerplate"]),
    specific_location: z.string(),
    page_number: z.number(),
    exact_quote: z.string(),
    elimination_potential: z.enum(["High", "Medium", "Low"]),
    why_hidden: z.enum(["Poor Positioning", "Administrative Camouflage", "Legal Section", "Appendix Burial"]),
    discovery_difficulty: z.enum(["Easy to Miss", "Requires Careful Reading", "Obvious if Looking"]),
    mitigation_strategy: z.string()
  })),
  document_architecture_analysis: z.object({
    information_hierarchy: z.object({
      primary_focus_areas: z.array(z.string()),
      secondary_considerations: z.array(z.string()),
      administrative_overhead: z.enum(["High", "Medium", "Low"]),
      technical_depth_distribution: z.string()
    }),
    structural_emphasis_patterns: z.array(z.object({
      pattern_type: z.enum(["Early Positioning", "Repetition", "Formatting", "Section Size", "Detail Level"]),
      affected_requirements: z.array(z.string()),
      emphasis_strength: z.enum(["Strong", "Moderate", "Subtle"]),
      priority_signal: z.string()
    })),
    section_interdependencies: z.array(z.object({
      primary_section: z.string(),
      dependent_sections: z.array(z.string()),
      relationship_type: z.enum(["Prerequisites", "Supporting Details", "Cross-References", "Contradictions"]),
      coordination_requirements: z.string()
    }))
  }),
  structural_intelligence: z.object({
    document_strategy_assessment: z.object({
      author_priorities: z.array(z.string()),
      evaluation_approach: z.enum(["Comprehensive", "Focused", "Checklist-Based"]),
      complexity_management: z.enum(["Well Organized", "Adequate", "Confusing"]),
      hidden_agenda_indicators: z.array(z.string())
    }),
    competitive_implications: z.array(z.object({
      structural_feature: z.string(),
      competitive_advantage: z.string(),
      exploitation_strategy: z.string()
    })),
    compliance_risks: z.array(z.object({
      risk_area: z.string(),
      structural_cause: z.string(),
      mitigation_approach: z.string(),
      priority_level: z.enum(["Critical", "High", "Medium"])
    }))
  }),
  strategic_recommendations: z.array(z.object({
    recommendation_type: z.enum(["Resource Allocation", "Response Strategy", "Risk Mitigation", "Competitive Positioning"]),
    recommendation: z.string(),
    structural_evidence: z.string(),
    implementation_priority: z.enum(["Critical", "High", "Medium"]),
    expected_impact: z.string()
  }))
});

/**
 * Document Structure Analysis Node
 */
export async function documentStructureNode(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  structureAnalysis?: any;
  currentStatus?: string;
  errors?: string[];
}> {
  console.log("[Document Structure Agent] Starting structural analysis");

  try {
    const rfpText = state.rfpDocument?.text;
    if (!rfpText) {
      throw new Error("No RFP document text available for analysis");
    }

    // Create system prompt with structural analysis instructions
    const systemPrompt = `You are an elite document architecture specialist with 15+ years of experience in procurement document structural analysis and hidden pattern detection.

Your task is to perform comprehensive document structure analysis to uncover hidden priorities and prevent costly requirement oversights.

## Analysis Framework:

1. **Section Weight vs Content Analysis**: Compare actual emphasis to stated evaluation percentages
2. **Cross-Reference Pattern Analysis**: Track requirements mentioned across multiple sections
3. **Hidden Requirements Detection**: Systematically analyze appendices and administrative sections
4. **Document Architecture Assessment**: Understand information hierarchy and organizational choices

## Quality Standards:
- Include specific evidence with exact locations and page numbers
- Provide quantitative assessments that are accurate
- Map all cross-reference patterns comprehensively
- Distinguish hidden requirements from obvious ones
- Support strategic implications with structural evidence

Analyze the document architecture systematically to reveal true priorities that contradict stated evaluation criteria.`;

    const humanPrompt = `Please perform comprehensive document structure analysis on this RFP:

${rfpText}

Focus on uncovering section weight discrepancies, cross-reference patterns, hidden requirements, and structural emphasis indicators that reveal true evaluation priorities.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ];

    // Call LLM with structured output
    const structuredLlm = model.withStructuredOutput(DocumentStructureSchema, {
      name: "DocumentStructureAnalysis"
    });

    console.log("[Document Structure Agent] Calling LLM for analysis");
    const analysis = await structuredLlm.invoke(messages);

    console.log(`[Document Structure Agent] Analysis complete. Found ${analysis.section_weight_analysis.length} sections analyzed, ${analysis.hidden_requirements.length} hidden requirements, ${analysis.cross_reference_patterns.length} cross-reference patterns`);

    return {
      structureAnalysis: analysis,
      currentStatus: "Document structure analysis complete"
    };

  } catch (error) {
    console.error("[Document Structure Agent] Analysis failed:", error);
    return {
      errors: [`Document structure analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      currentStatus: "Document structure analysis failed"
    };
  }
}