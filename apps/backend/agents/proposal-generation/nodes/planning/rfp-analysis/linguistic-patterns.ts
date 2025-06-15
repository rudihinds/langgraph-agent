/**
 * Linguistic Patterns Analysis Agent
 * 
 * Performs sophisticated linguistic pattern analysis to extract strategic signals
 * from RFP language that reveal evaluator priorities and decision-making styles.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { OverallProposalStateAnnotation } from "@/state/modules/annotations.js";
import { ProcessingStatus } from "@/state/modules/types.js";

// Initialize LLM for linguistic analysis
const model = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.2, // Lower temperature for analytical consistency
  maxTokens: 8000,
});

// Schema for structured linguistic analysis output
const LinguisticAnalysisSchema = z.object({
  analysis_metadata: z.object({
    document_length_words: z.number(),
    sections_analyzed: z.number(),
    analysis_confidence: z.number().min(0).max(1),
    linguistic_complexity_score: z.enum(["Simple", "Medium", "Complex"])
  }),
  high_frequency_terms: z.array(z.object({
    term: z.string(),
    frequency: z.number(),
    sections_appearing: z.array(z.string()),
    contexts: z.array(z.string()),
    strategic_signal: z.enum([
      "past_performance_priority",
      "innovation_openness", 
      "risk_aversion",
      "collaboration_focus"
    ]),
    confidence: z.number().min(0).max(1),
    supporting_quotes: z.array(z.string())
  })),
  modal_verb_hierarchy: z.object({
    elimination_criteria: z.array(z.object({
      requirement: z.string(),
      modal_verb: z.enum(["must", "shall", "required"]),
      source_location: z.string(),
      exact_quote: z.string(),
      criticality_score: z.number().min(1).max(10)
    })),
    scoring_criteria: z.array(z.object({
      requirement: z.string(),
      modal_verb: z.enum(["should", "preferred", "desired"]),
      source_location: z.string(),
      exact_quote: z.string(),
      priority_weight: z.enum(["High", "Medium", "Low"]),
      competitive_advantage_potential: z.number().min(1).max(10)
    })),
    differentiator_opportunities: z.array(z.object({
      opportunity: z.string(),
      modal_verb: z.enum(["may", "could", "optional"]),
      source_location: z.string(),
      exact_quote: z.string(),
      bonus_point_potential: z.enum(["High", "Medium", "Low"])
    }))
  }),
  sentence_complexity_analysis: z.array(z.object({
    requirement: z.string(),
    sentence_length: z.number(),
    complexity_score: z.number().min(1).max(10),
    detail_level: z.enum(["High", "Medium", "Low"]),
    criticality_inference: z.enum(["Critical", "Important", "Standard"]),
    source_location: z.string()
  })),
  emphasis_patterns: z.array(z.object({
    requirement: z.string(),
    emphasis_indicators: z.array(z.enum([
      "early_positioning",
      "formatting", 
      "repetition",
      "section_heading"
    ])),
    emphasis_score: z.number().min(1).max(10),
    true_priority_assessment: z.enum(["Critical", "High", "Medium", "Low"]),
    stated_weight_discrepancy: z.enum([
      "Higher than stated",
      "Matches stated", 
      "Lower than stated"
    ]),
    supporting_evidence: z.array(z.string())
  })),
  linguistic_insights: z.object({
    overall_tone: z.enum(["Formal", "Professional", "Collaborative", "Technical"]),
    decision_making_indicators: z.object({
      risk_tolerance: z.enum(["High", "Medium", "Low"]),
      innovation_openness: z.enum(["High", "Medium", "Low"]),
      detail_orientation: z.enum(["High", "Medium", "Low"])
    }),
    language_patterns: z.array(z.object({
      pattern: z.string(),
      frequency: z.number(),
      strategic_implication: z.string(),
      confidence: z.number().min(0).max(1)
    }))
  })
});

/**
 * Linguistic Patterns Analysis Node
 */
export async function linguisticPatternsNode(
  state: typeof OverallProposalStateAnnotation.State
): Promise<{
  linguisticAnalysis?: any;
  currentStatus?: string;
  errors?: string[];
}> {
  console.log("[Linguistic Patterns Agent] Starting analysis");

  try {
    const rfpText = state.rfpDocument?.text;
    if (!rfpText) {
      throw new Error("No RFP document text available for analysis");
    }

    // Create system prompt with instructions
    const systemPrompt = `You are an elite linguistic analysis specialist with 15+ years of experience in document pattern recognition and competitive intelligence extraction.

Your task is to perform comprehensive linguistic pattern analysis of the RFP document to extract strategic signals that inform proposal positioning.

## Analysis Requirements:

1. **High-Frequency Term Analysis**: Identify terms appearing across multiple sections and classify their strategic signals
2. **Modal Verb Hierarchy**: Map all modal verbs to understand requirement priorities  
3. **Sentence Complexity Analysis**: Correlate complexity with requirement importance
4. **Emphasis Pattern Detection**: Identify structural emphasis indicators

## Quality Standards:
- Include exact quotes and source locations for all findings
- Provide confidence scores based on evidence strength
- Ensure comprehensive coverage of the document
- Support all strategic implications with linguistic evidence

Analyze the following RFP document systematically and provide your findings in the specified JSON format.`;

    const humanPrompt = `Please analyze this RFP document for linguistic patterns:

${rfpText}

Provide a comprehensive linguistic analysis following the framework outlined in your instructions.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(humanPrompt)
    ];

    // Call LLM with structured output
    const structuredLlm = model.withStructuredOutput(LinguisticAnalysisSchema, {
      name: "LinguisticAnalysis"
    });

    console.log("[Linguistic Patterns Agent] Calling LLM for analysis");
    const analysis = await structuredLlm.invoke(messages);

    console.log(`[Linguistic Patterns Agent] Analysis complete. Found ${analysis.high_frequency_terms.length} high-frequency terms, ${analysis.modal_verb_hierarchy.elimination_criteria.length} elimination criteria`);

    return {
      linguisticAnalysis: analysis,
      currentStatus: "Linguistic pattern analysis complete"
    };

  } catch (error) {
    console.error("[Linguistic Patterns Agent] Analysis failed:", error);
    return {
      errors: [`Linguistic pattern analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      currentStatus: "Linguistic pattern analysis failed"
    };
  }
}