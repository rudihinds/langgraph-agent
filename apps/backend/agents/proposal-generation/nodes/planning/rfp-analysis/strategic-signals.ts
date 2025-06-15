/**
 * Strategic Signals Analysis Agent
 * 
 * Extracts decision-making style indicators, organizational culture signals,
 * and competitive positioning opportunities to enable culturally-aligned proposals.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";

// Initialize LLM for strategic signal analysis
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3, // Moderate temperature for strategic interpretation
  maxTokens: 8000,
});

// Schema for structured strategic signals analysis output
const StrategicSignalsSchema = z.object({
  analysis_metadata: z.object({
    signal_confidence_score: z.number().min(0).max(1),
    cultural_clarity_assessment: z.enum(["High", "Medium", "Low"]),
    strategic_complexity: z.enum(["Simple", "Moderate", "Complex"]),
    positioning_opportunity_count: z.number()
  }),
  decision_making_style: z.object({
    innovation_tolerance: z.object({
      level: z.enum(["High", "Medium", "Low"]),
      confidence: z.number().min(0).max(1),
      supporting_evidence: z.array(z.object({
        signal_type: z.enum(["Language Pattern", "Emphasis Pattern", "Requirement Type"]),
        evidence: z.string(),
        source_location: z.string(),
        weight: z.enum(["Strong", "Moderate", "Weak"])
      })),
      strategic_implications: z.string()
    }),
    risk_appetite: z.object({
      level: z.enum(["High", "Medium", "Low"]),
      confidence: z.number().min(0).max(1),
      supporting_evidence: z.array(z.object({
        signal_type: z.string(),
        evidence: z.string(),
        source_location: z.string(),
        weight: z.enum(["Strong", "Moderate", "Weak"])
      })),
      strategic_implications: z.string()
    }),
    collaboration_preference: z.object({
      level: z.enum(["High", "Medium", "Low"]),
      confidence: z.number().min(0).max(1),
      supporting_evidence: z.array(z.object({
        signal_type: z.string(),
        evidence: z.string(),
        source_location: z.string(),
        weight: z.enum(["Strong", "Moderate", "Weak"])
      })),
      strategic_implications: z.string()
    }),
    decision_speed_preference: z.object({
      preference: z.enum(["Rapid", "Balanced", "Deliberate"]),
      confidence: z.number().min(0).max(1),
      supporting_evidence: z.array(z.string()),
      strategic_implications: z.string()
    })
  }),
  organizational_culture_indicators: z.object({
    formality_level: z.object({
      assessment: z.enum(["Formal", "Professional", "Entrepreneurial"]),
      confidence: z.number().min(0).max(1),
      cultural_signals: z.array(z.object({
        indicator: z.string(),
        evidence: z.string(),
        interpretation: z.string()
      }))
    }),
    technical_vs_business_focus: z.object({
      orientation: z.enum(["Technical Dominant", "Balanced", "Business Dominant"]),
      confidence: z.number().min(0).max(1),
      focus_indicators: z.array(z.object({
        signal: z.string(),
        evidence: z.string(),
        source_location: z.string()
      }))
    }),
    compliance_vs_results_orientation: z.object({
      orientation: z.enum(["Compliance Focused", "Balanced", "Results Focused"]),
      confidence: z.number().min(0).max(1),
      orientation_signals: z.array(z.object({
        signal: z.string(),
        evidence: z.string(),
        interpretation: z.string()
      }))
    })
  }),
  win_theme_signals: z.array(z.object({
    theme: z.string(),
    frequency: z.number(),
    strength: z.enum(["High", "Medium", "Low"]),
    context_locations: z.array(z.object({
      section: z.string(),
      context: z.string(),
      emphasis_level: z.enum(["High", "Medium", "Low"])
    })),
    positioning_opportunity: z.string(),
    competitive_advantage_potential: z.enum(["High", "Medium", "Low"]),
    implementation_strategy: z.string()
  })),
  competitive_positioning_intelligence: z.object({
    incumbent_advantage_signals: z.array(z.object({
      signal: z.string(),
      evidence: z.string(),
      advantage_type: z.enum(["Relationship", "Knowledge", "Process", "Technical"]),
      neutralization_strategy: z.string()
    })),
    market_positioning_preferences: z.array(z.object({
      preference: z.string(),
      evidence: z.string(),
      positioning_opportunity: z.string()
    })),
    differentiation_opportunities: z.array(z.object({
      opportunity_area: z.string(),
      signal_evidence: z.string(),
      competitive_potential: z.enum(["High", "Medium", "Low"]),
      approach_strategy: z.string()
    })),
    competition_style_indicators: z.object({
      competition_type: z.enum(["Feature Competition", "Value Competition", "Relationship Competition"]),
      evidence: z.array(z.string()),
      strategic_response: z.string()
    })
  }),
  strategic_recommendations: z.array(z.object({
    recommendation_category: z.enum(["Positioning", "Tone", "Approach", "Emphasis"]),
    recommendation: z.string(),
    supporting_signals: z.array(z.string()),
    implementation_priority: z.enum(["Critical", "High", "Medium"]),
    expected_impact: z.string(),
    risk_if_ignored: z.enum(["High", "Medium", "Low"])
  }))
});

/**
 * Strategic Signals Analysis Node
 */
export async function strategicSignalsNode(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  strategicAnalysis?: any;
  currentStatus?: string;
  errors?: string[];
}> {
  console.log("[Strategic Signals Agent] Starting signal extraction");

  try {
    const rfpText = state.rfpDocument?.text;
    if (!rfpText) {
      throw new Error("No RFP document text available for analysis");
    }

    // Create system prompt with strategic analysis instructions
    const systemPrompt = `You are an elite strategic intelligence specialist with 15+ years of experience in organizational behavior analysis and procurement psychology.

Your task is to extract strategic signals embedded in RFP language that reveal evaluator decision-making styles, organizational culture, and competitive positioning opportunities.

## Analysis Framework:

1. **Decision-Making Style Assessment**: Innovation tolerance, risk appetite, collaboration preference, decision speed
2. **Organizational Culture Signal Analysis**: Formality level, technical vs business focus, compliance vs results orientation
3. **Win Theme Signal Identification**: Value proposition signals, competitive advantage indicators, stakeholder priorities
4. **Competitive Positioning Intelligence**: Incumbent advantages, market positioning, differentiation opportunities

## Quality Standards:
- Include specific evidence with exact quotes and source locations
- Provide confidence scores that reflect evidence strength and consistency
- Base cultural assessments on objective linguistic and structural indicators
- Ensure strategic implications are actionable and specific
- Distinguish between strong signals and weak indicators

Extract strategic signals systematically to enable culturally-aligned response development and competitive positioning optimization.`;

    const humanPrompt = `Please perform comprehensive strategic signal extraction on this RFP:

${rfpText}

Analyze decision-making styles, organizational culture, win themes, and competitive positioning opportunities to inform proposal strategy and positioning.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ];

    // Call LLM with structured output
    const structuredLlm = model.withStructuredOutput(StrategicSignalsSchema, {
      name: "StrategicSignalsAnalysis"
    });

    console.log("[Strategic Signals Agent] Calling LLM for analysis");
    const analysis = await structuredLlm.invoke(messages);

    console.log(`[Strategic Signals Agent] Analysis complete. Found ${analysis.win_theme_signals.length} win themes, ${analysis.competitive_positioning_intelligence.differentiation_opportunities.length} differentiation opportunities`);

    return {
      strategicAnalysis: analysis,
      currentStatus: "Strategic signals analysis complete"
    };

  } catch (error) {
    console.error("[Strategic Signals Agent] Analysis failed:", error);
    return {
      errors: [`Strategic signals analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      currentStatus: "Strategic signals analysis failed"
    };
  }
}