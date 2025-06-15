/**
 * Competitive Intelligence Synthesis Agent
 * 
 * Synthesizes outputs from all 4 analysis agents into actionable competitive
 * intelligence strategies, identifying critical risks and high-impact opportunities.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";

// Initialize LLM for synthesis analysis
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.2, // Lower temperature for consistent strategic synthesis
  maxTokens: 8000,
});

// Schema for structured synthesis output
const SynthesisSchema = z.object({
  synthesis_metadata: z.object({
    agent_inputs_processed: z.number(),
    cross_correlation_confidence: z.number().min(0).max(1),
    strategy_complexity: z.enum(["Simple", "Moderate", "Complex"]),
    competitive_landscape: z.enum(["Clear Advantage", "Competitive", "Highly Competitive"]),
    win_probability_assessment: z.number().min(0).max(1)
  }),
  intelligence_convergence: z.object({
    reinforced_signals: z.array(z.object({
      signal: z.string(),
      supporting_agents: z.array(z.string()),
      convergence_strength: z.enum(["Strong", "Moderate", "Weak"]),
      strategic_importance: z.enum(["Critical", "High", "Medium"]),
      evidence_summary: z.string()
    })),
    conflicting_signals: z.array(z.object({
      conflict_description: z.string(),
      agent_positions: z.record(z.string()),
      resolution_approach: z.string(),
      final_assessment: z.string()
    })),
    intelligence_gaps: z.array(z.object({
      gap_area: z.string(),
      impact_on_strategy: z.enum(["High", "Medium", "Low"]),
      information_needed: z.string(),
      gathering_approach: z.string()
    }))
  }),
  critical_elimination_risks: z.array(z.object({
    risk_id: z.string(),
    risk_description: z.string(),
    probability: z.enum(["High", "Medium", "Low"]),
    impact: z.enum(["Elimination", "Scoring Penalty", "Competitive Disadvantage"]),
    source_analysis: z.array(z.string()),
    mitigation_strategy: z.string(),
    mitigation_complexity: z.enum(["Simple", "Moderate", "Complex"]),
    mitigation_priority: z.enum(["Critical", "High", "Medium"]),
    early_warning_indicators: z.array(z.string()),
    resources_required: z.string()
  })),
  highest_scoring_opportunities: z.array(z.object({
    opportunity_id: z.string(),
    opportunity_description: z.string(),
    scoring_potential: z.enum(["High", "Medium", "Low"]),
    effort_required: z.enum(["Low", "Medium", "High"]),
    roi_assessment: z.enum(["Excellent", "Good", "Fair"]),
    source_analysis: z.array(z.string()),
    implementation_approach: z.string(),
    competitive_advantage: z.enum(["Unique", "Difficult to Replicate", "Standard"]),
    resources_required: z.string(),
    success_metrics: z.array(z.string())
  })),
  integrated_strategy: z.object({
    overall_positioning: z.string(),
    core_value_proposition: z.string(),
    primary_win_themes: z.array(z.object({
      theme: z.string(),
      supporting_evidence: z.array(z.string()),
      implementation_approach: z.string(),
      competitive_differentiation: z.string()
    })),
    response_tone_and_style: z.object({
      formality_level: z.enum(["Formal", "Professional", "Collaborative"]),
      technical_depth: z.enum(["High", "Balanced", "Business Focused"]),
      innovation_emphasis: z.enum(["High", "Balanced", "Proven Solutions"]),
      rationale: z.string()
    }),
    proposal_architecture_recommendations: z.object({
      section_emphasis_strategy: z.string(),
      content_allocation_guidance: z.string(),
      cross_reference_approach: z.string(),
      differentiation_placement: z.string()
    })
  }),
  competitive_dynamics: z.object({
    likely_competitor_approaches: z.array(z.object({
      competitor_type: z.enum(["Incumbent", "Large Integrator", "Specialist", "Low-Cost Provider"]),
      likely_strategy: z.string(),
      strengths: z.array(z.string()),
      vulnerabilities: z.array(z.string()),
      counter_strategy: z.string()
    })),
    market_positioning_strategy: z.object({
      positioning_category: z.enum(["Premium", "Value", "Specialist", "Partnership"]),
      differentiation_approach: z.string(),
      competitive_moat: z.string(),
      messaging_strategy: z.string()
    }),
    white_space_opportunities: z.array(z.object({
      opportunity: z.string(),
      evidence: z.string(),
      exploitation_strategy: z.string(),
      competitive_advantage_potential: z.enum(["High", "Medium", "Low"])
    }))
  }),
  implementation_roadmap: z.object({
    immediate_actions: z.array(z.object({
      action: z.string(),
      urgency_reason: z.string(),
      responsible_party: z.string(),
      completion_timeline: z.string(),
      dependencies: z.array(z.string())
    })),
    proposal_development_priorities: z.array(z.object({
      priority: z.string(),
      rationale: z.string(),
      resource_allocation: z.enum(["Heavy", "Moderate", "Light"]),
      success_criteria: z.string()
    })),
    risk_monitoring_checkpoints: z.array(z.object({
      checkpoint: z.string(),
      timing: z.string(),
      monitoring_criteria: z.string(),
      escalation_triggers: z.array(z.string())
    }))
  }),
  executive_summary: z.object({
    key_insights: z.array(z.string()),
    critical_actions: z.array(z.string()),
    win_probability_factors: z.object({
      positive_factors: z.array(z.string()),
      risk_factors: z.array(z.string()),
      overall_assessment: z.string()
    }),
    strategic_recommendation: z.string()
  })
});

/**
 * Synthesis Analysis Node
 */
export async function synthesisNode(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  synthesisAnalysis?: any;
  rfpProcessingStatus?: ProcessingStatus;
  currentStatus?: string;
  errors?: string[];
}> {
  console.log("[Synthesis Agent] Starting competitive intelligence synthesis");

  try {
    // Check all analyses are complete
    if (!state.linguisticAnalysis || !state.requirementsAnalysis || 
        !state.structureAnalysis || !state.strategicAnalysis) {
      throw new Error("Not all analysis agents have completed. Cannot perform synthesis.");
    }

    console.log("[Synthesis Agent] All 4 agent analyses found. Beginning synthesis");

    // Create system prompt with synthesis instructions
    const systemPrompt = `You are an elite competitive intelligence strategist with 15+ years of experience in procurement strategy synthesis and win-loss analysis.

Your task is to synthesize multi-agent intelligence outputs into actionable competitive strategies that maximize win probability while minimizing elimination risks.

## Synthesis Framework:

1. **Cross-Agent Pattern Correlation**: Identify convergence, conflicts, and gaps across analyses
2. **Elimination Risk Assessment**: Prioritize risks by probability and impact with mitigation strategies
3. **Scoring Opportunity Optimization**: Extract highest-impact opportunities with implementation guidance
4. **Strategic Recommendation Integration**: Create holistic strategies with implementation roadmaps

## Quality Standards:
- Every strategic recommendation must be supported by evidence from multiple agent analyses
- Cross-agent correlations must be verified and explicitly documented
- Conflict resolutions must be logically sound and evidence-based
- Implementation recommendations must be specific, actionable, and time-sequenced

Synthesize intelligence systematically to create actionable competitive strategies.`;

    const humanPrompt = `Please synthesize the following multi-agent RFP analysis results into comprehensive competitive intelligence:

## Agent 1 - Linguistic Analysis:
${JSON.stringify(state.linguisticAnalysis, null, 2)}

## Agent 2 - Requirements Analysis:
${JSON.stringify(state.requirementsAnalysis, null, 2)}

## Agent 3 - Document Structure Analysis:
${JSON.stringify(state.structureAnalysis, null, 2)}

## Agent 4 - Strategic Signals Analysis:
${JSON.stringify(state.strategicAnalysis, null, 2)}

Provide a comprehensive synthesis that integrates all insights into actionable competitive strategy with elimination risk mitigation and scoring opportunity optimization.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ];

    // Call LLM with structured output
    const structuredLlm = model.withStructuredOutput(SynthesisSchema, {
      name: "CompetitiveIntelligenceSynthesis"
    });

    console.log("[Synthesis Agent] Calling LLM for synthesis");
    const synthesis = await structuredLlm.invoke(messages);

    console.log(`[Synthesis Agent] Synthesis complete. Identified ${synthesis.critical_elimination_risks.length} critical risks, ${synthesis.highest_scoring_opportunities.length} high-scoring opportunities`);

    return {
      synthesisAnalysis: synthesis,
      rfpProcessingStatus: ProcessingStatus.AWAITING_REVIEW,
      currentStatus: "RFP analysis synthesis complete - ready for human review"
    };

  } catch (error) {
    console.error("[Synthesis Agent] Synthesis failed:", error);
    return {
      errors: [`Competitive intelligence synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      rfpProcessingStatus: ProcessingStatus.ERROR,
      currentStatus: "RFP analysis synthesis failed"
    };
  }
}