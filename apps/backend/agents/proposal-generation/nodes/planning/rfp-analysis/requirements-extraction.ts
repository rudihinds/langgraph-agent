/**
 * Requirements Extraction Analysis Agent
 * 
 * Performs systematic multi-level requirements extraction to identify explicit,
 * derived, unstated, and stakeholder-inferred requirements for complete compliance.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";

// Initialize LLM for requirements analysis
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.1, // Very low temperature for systematic requirement extraction
  maxTokens: 8000,
});

// Schema for structured requirements analysis output
const RequirementsAnalysisSchema = z.object({
  extraction_metadata: z.object({
    total_explicit_requirements: z.number(),
    total_derived_requirements: z.number(),
    total_unstated_requirements: z.number(),
    total_inferred_requirements: z.number(),
    analysis_confidence: z.number().min(0).max(1),
    completeness_score: z.number().min(0).max(1)
  }),
  explicit_requirements: z.array(z.object({
    requirement_id: z.string(),
    description: z.string(),
    category: z.enum(["Technical", "Administrative", "Performance", "Qualification"]),
    mandatory_level: z.enum(["Elimination", "Scoring", "Differentiator"]),
    source_location: z.string(),
    exact_quote: z.string(),
    compliance_complexity: z.enum(["Simple", "Moderate", "Complex"]),
    resource_impact: z.enum(["Low", "Medium", "High"]),
    verification_method: z.string()
  })),
  derived_requirements: z.array(z.object({
    derived_from: z.string(),
    requirement_id: z.string(),
    logical_implication: z.string(),
    necessity_level: z.enum(["Essential", "Likely", "Possible"]),
    rationale: z.string(),
    compliance_dependency: z.string(),
    risk_if_missed: z.enum(["High", "Medium", "Low"])
  })),
  unstated_requirements: z.array(z.object({
    requirement_id: z.string(),
    requirement: z.string(),
    basis: z.enum(["Industry Standard", "Regulatory Compliance", "Best Practice", "Professional Standard"]),
    evidence: z.string(),
    risk_if_missed: z.enum(["High", "Medium", "Low"]),
    typical_expectation: z.enum(["Always Expected", "Usually Expected", "Sometimes Expected"]),
    implementation_impact: z.string()
  })),
  stakeholder_inferred_requirements: z.array(z.object({
    requirement_id: z.string(),
    requirement: z.string(),
    organizational_signal: z.string(),
    political_sensitivity: z.enum(["High", "Medium", "Low"]),
    evidence: z.string(),
    stakeholder_importance: z.enum(["Critical", "Important", "Helpful"]),
    cultural_fit_factor: z.string()
  })),
  requirement_analysis: z.object({
    cross_reference_patterns: z.array(z.object({
      requirement_theme: z.string(),
      related_requirements: z.array(z.string()),
      consistency_assessment: z.enum(["Consistent", "Minor Conflicts", "Major Conflicts"]),
      resolution_needed: z.boolean()
    })),
    compliance_complexity_assessment: z.object({
      high_complexity_requirements: z.array(z.string()),
      moderate_complexity_requirements: z.array(z.string()),
      simple_requirements: z.array(z.string()),
      overall_complexity: z.enum(["Simple", "Moderate", "Complex"])
    }),
    critical_path_analysis: z.array(z.object({
      requirement_id: z.string(),
      dependency_chain: z.array(z.string()),
      timeline_impact: z.string(),
      resource_bottleneck: z.string()
    }))
  }),
  compliance_roadmap: z.object({
    immediate_action_requirements: z.array(z.object({
      requirement_id: z.string(),
      urgency_reason: z.string(),
      lead_time_needed: z.string()
    })),
    documentation_requirements: z.array(z.object({
      requirement_id: z.string(),
      documentation_type: z.string(),
      preparation_complexity: z.enum(["Simple", "Moderate", "Complex"])
    })),
    verification_requirements: z.array(z.object({
      requirement_id: z.string(),
      verification_method: z.string(),
      third_party_validation: z.boolean()
    }))
  })
});

/**
 * Requirements Extraction Analysis Node
 */
export async function requirementsExtractionNode(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  requirementsAnalysis?: any;
  currentStatus?: string;
  errors?: string[];
}> {
  console.log("[Requirements Extraction Agent] Starting multi-level analysis");

  try {
    const rfpText = state.rfpDocument?.text;
    if (!rfpText) {
      throw new Error("No RFP document text available for analysis");
    }

    // Create system prompt with detailed instructions
    const systemPrompt = `You are an elite requirements analysis specialist with 15+ years of experience in systematic requirement decomposition and compliance analysis.

Your task is to perform comprehensive multi-level requirements extraction across four critical levels:

## Analysis Levels:

1. **Explicit Requirements**: Directly stated requirements with clear categorization
2. **Derived Requirements**: Logical implications and dependencies of explicit requirements
3. **Unstated Requirements**: Industry standards, regulatory compliance, and best practices
4. **Stakeholder-Inferred Requirements**: Requirements suggested by organizational context and culture

## Quality Standards:
- Include exact quotes and specific source locations for all explicit requirements
- Show clear logical connections for derived requirements  
- Support unstated requirements with industry standards or regulatory evidence
- Base inferred requirements on objective organizational signals
- Provide realistic complexity assessments and implementation guidance

Extract requirements systematically to ensure comprehensive compliance planning and eliminate costly oversights.`;

    const humanPrompt = `Please perform comprehensive multi-level requirements extraction on this RFP document:

${rfpText}

Analyze across all four levels (explicit, derived, unstated, stakeholder-inferred) and provide your findings in the specified JSON format with complete compliance roadmap.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ];

    // Call LLM with structured output
    const structuredLlm = model.withStructuredOutput(RequirementsAnalysisSchema, {
      name: "RequirementsAnalysis"
    });

    console.log("[Requirements Extraction Agent] Calling LLM for analysis");
    const analysis = await structuredLlm.invoke(messages);

    console.log(`[Requirements Extraction Agent] Analysis complete. Found ${analysis.explicit_requirements.length} explicit, ${analysis.derived_requirements.length} derived, ${analysis.unstated_requirements.length} unstated, ${analysis.stakeholder_inferred_requirements.length} inferred requirements`);

    return {
      requirementsAnalysis: analysis,
      currentStatus: "Requirements extraction complete"
    };

  } catch (error) {
    console.error("[Requirements Extraction Agent] Analysis failed:", error);
    return {
      errors: [`Requirements extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      currentStatus: "Requirements extraction failed"
    };
  }
}