/**
 * Competitive Intelligence Synthesis Agent
 * 
 * Synthesizes outputs from all 4 analysis agents into actionable competitive
 * intelligence strategies, identifying critical risks and high-impact opportunities.
 */

import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { createModel } from "@/lib/llm/model-factory.js";

// Initialize LLM for synthesis analysis
const model = createModel(undefined, {
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
  state: typeof OverallProposalStateAnnotation.State,
  config?: LangGraphRunnableConfig
): Promise<{
  synthesisAnalysis?: any;
  rfpProcessingStatus?: ProcessingStatus;
  currentStatus?: string;
  messages?: any[];
  errors?: string[];
}> {
  console.log("[Synthesis Agent] Starting competitive intelligence synthesis");
  
  // Emit status
  if (config?.writer) {
    config.writer({
      message: "Synthesizing analysis results into competitive intelligence..."
    });
  }

  try {
    // Check if we have partial synthesis metadata
    const partialSynthesis = state.synthesisAnalysis?.partial;
    const partialMetadata = state.synthesisAnalysis?.metadata;
    
    // Count available analyses
    const availableAnalyses = [
      state.linguisticAnalysis,
      state.requirementsAnalysis,
      state.structureAnalysis,
      state.strategicAnalysis
    ].filter(Boolean);
    
    // If we're in partial synthesis mode, check if we have enough data
    if (partialSynthesis && availableAnalyses.length < 2) {
      console.log("[Synthesis Agent] Not enough data for partial synthesis (need at least 2 analyses)");
      return {
        synthesisAnalysis: {
          type: "insufficient_data",
          availableCount: availableAnalyses.length,
          message: "Insufficient analysis data for synthesis",
          recommendation: "Manual review required"
        },
        currentStatus: "Synthesis skipped - insufficient data"
      };
    }
    
    // Original check for complete synthesis
    if (!partialSynthesis && (!state.linguisticAnalysis || !state.requirementsAnalysis || 
        !state.structureAnalysis || !state.strategicAnalysis)) {
      throw new Error("Not all analysis agents have completed. Cannot perform synthesis.");
    }

    console.log(`[Synthesis Agent] ${partialSynthesis ? 'Partial' : 'Full'} synthesis with ${availableAnalyses.length}/4 analyses`);

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

    // Adjust prompt based on partial vs full synthesis
    const synthesisContext = partialSynthesis 
      ? `\n\nNOTE: This is a PARTIAL SYNTHESIS. Only ${availableAnalyses.length} out of 4 analyses completed successfully:\n${partialMetadata?.completedAnalyses?.join(', ') || 'Unknown'}.\n\nAdapt your synthesis accordingly and note any limitations due to missing data.`
      : '';
    
    const humanPrompt = `Please synthesize the following multi-agent RFP analysis results into comprehensive competitive intelligence:${synthesisContext}

## Agent 1 - Linguistic Analysis:
${state.linguisticAnalysis ? JSON.stringify(state.linguisticAnalysis, null, 2) : '[ANALYSIS FAILED OR NOT AVAILABLE]'}

## Agent 2 - Requirements Analysis:
${state.requirementsAnalysis ? JSON.stringify(state.requirementsAnalysis, null, 2) : '[ANALYSIS FAILED OR NOT AVAILABLE]'}

## Agent 3 - Document Structure Analysis:
${state.structureAnalysis ? JSON.stringify(state.structureAnalysis, null, 2) : '[ANALYSIS FAILED OR NOT AVAILABLE]'}

## Agent 4 - Strategic Signals Analysis:
${state.strategicAnalysis ? JSON.stringify(state.strategicAnalysis, null, 2) : '[ANALYSIS FAILED OR NOT AVAILABLE]'}

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

    // Add partial synthesis indicator if applicable
    const synthesisStatus = partialSynthesis 
      ? `⚠️ PARTIAL ANALYSIS (${availableAnalyses.length}/4 agents completed)`
      : '✅ COMPLETE ANALYSIS';
    
    // Create AI message with synthesis summary for user review
    const synthesisDisplayText = `## 🎯 RFP Analysis ${partialSynthesis ? 'Partial Results' : 'Complete'}

**Status:** ${synthesisStatus}

**Executive Summary:**
${synthesis.executive_summary.strategic_recommendation}

**🔍 Key Insights:**
${synthesis.executive_summary.key_insights.map(insight => `• ${insight}`).join('\n')}

**⚠️ Critical Elimination Risks (${synthesis.critical_elimination_risks.length}):**
${synthesis.critical_elimination_risks.slice(0, 3).map(risk => `• **${risk.risk_id}**: ${risk.risk_description} (Impact: ${risk.impact})`).join('\n')}

**🚀 High-Scoring Opportunities (${synthesis.highest_scoring_opportunities.length}):**
${synthesis.highest_scoring_opportunities.slice(0, 3).map(opp => `• **${opp.opportunity_id}**: ${opp.opportunity_description} (Potential: ${opp.scoring_potential})`).join('\n')}

**📋 Immediate Actions Required:**
${synthesis.implementation_roadmap.immediate_actions.slice(0, 3).map(action => `• ${action.action} (${action.urgency_reason})`).join('\n')}

**Win Probability Assessment:** ${synthesis.executive_summary.win_probability_factors.overall_assessment}

Ready for your review and feedback on this comprehensive analysis.`;

    return {
      synthesisAnalysis: {
        ...synthesis,
        partial: partialSynthesis,
        metadata: partialSynthesis ? partialMetadata : undefined
      },
      rfpProcessingStatus: ProcessingStatus.AWAITING_REVIEW,
      currentStatus: "RFP analysis synthesis complete - ready for human review",
      messages: [new AIMessage(synthesisDisplayText)]
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