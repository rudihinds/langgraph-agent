/**
 * Reusable Synthesis Agent
 * 
 * Generic synthesis agent that can be configured for different workflows to synthesize
 * various types of analysis results into structured outputs. Follows LangGraph patterns
 * for reusability across multiple agent workflows.
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

/**
 * Configuration for synthesis agent
 */
export interface SynthesisAgentConfig<TState, TOutput> {
  nodeName: string;
  llm: ChatAnthropic;
  systemPrompt: string;
  outputSchema: z.ZodSchema<TOutput>;
  contextExtractor: (state: TState) => string;
  stateUpdater: (output: TOutput) => Partial<TState>;
  statusField?: keyof TState;
  outputField: keyof TState;
}

/**
 * Create a reusable synthesis agent node
 */
export function createSynthesisAgent<TState, TOutput>(
  config: SynthesisAgentConfig<TState, TOutput>
) {
  return async function synthesisAgent(state: TState): Promise<Partial<TState>> {
    console.log(`[${config.nodeName}] Starting synthesis`);
    
    try {
      // Extract context from state
      const context = config.contextExtractor(state);
      
      if (!context) {
        throw new Error("No context available for synthesis");
      }
      
      // Create synthesis prompt
      const humanPrompt = `Please synthesize the following analysis results:

${context}

Follow the system instructions to create a comprehensive synthesis.`;

      const messages = [
        new SystemMessage(config.systemPrompt),
        new HumanMessage(humanPrompt)
      ];

      // Call LLM with structured output
      const structuredLlm = config.llm.withStructuredOutput(config.outputSchema, {
        name: config.nodeName
      });

      console.log(`[${config.nodeName}] Calling LLM for synthesis`);
      const synthesis = await structuredLlm.invoke(messages);

      console.log(`[${config.nodeName}] Synthesis complete`);

      // Update state with synthesis result
      const stateUpdates = config.stateUpdater(synthesis);
      
      // Add status update if specified
      if (config.statusField) {
        (stateUpdates as any)[config.statusField] = "complete";
      }

      return stateUpdates;

    } catch (error) {
      console.error(`[${config.nodeName}] Error during synthesis:`, error);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown synthesis error";
      
      const errorUpdates: Partial<TState> = {};
      if (config.statusField) {
        (errorUpdates as any)[config.statusField] = "error";
      }
      
      return {
        ...errorUpdates,
        errors: [`${config.nodeName}: ${errorMessage}`]
      } as Partial<TState>;
    }
  };
}

/**
 * Intelligence Gathering Synthesis Configuration
 * 
 * Pre-configured synthesis agent for intelligence gathering workflows
 */
export function createIntelligenceSynthesisAgent<TState extends {
  intelligenceBriefing?: any;
  intelligenceGatheringStatus?: any;
  messages?: any[];
  errors?: string[];
}>(llm: ChatAnthropic) {
  
  const systemPrompt = `You are an intelligence synthesis specialist. Your task is to analyze and synthesize intelligence gathering results into a comprehensive, actionable intelligence briefing.

## Synthesis Framework:

1. **Data Validation**: Verify the completeness and reliability of gathered intelligence
2. **Pattern Recognition**: Identify key patterns in customer behavior, vendor relationships, and procurement activities
3. **Strategic Insights**: Extract actionable insights for proposal positioning and strategy
4. **Gap Analysis**: Identify information gaps that may require additional research
5. **Risk Assessment**: Highlight potential risks and opportunities based on the intelligence

## Output Requirements:

Synthesize all available intelligence into a structured briefing that includes:
- Customer context with validated strategic initiatives
- Vendor landscape analysis with competitive positioning insights
- Procurement pattern analysis with strategic implications
- Decision maker profiles with engagement strategies
- Metadata including confidence levels and research gaps

Focus on actionable intelligence that directly supports proposal development and competitive positioning.`;

  return createSynthesisAgent({
    nodeName: "IntelligenceSynthesis",
    llm,
    systemPrompt,
    outputSchema: z.object({
      customer_context: z.object({
        company: z.string(),
        industry: z.string(),
        recent_initiatives: z.array(z.object({
          name: z.string(),
          date: z.string(),
          source: z.string(),
          priority_level: z.enum(["High", "Medium", "Low"]),
        })),
      }),
      vendor_landscape: z.object({
        current_vendors: z.array(z.object({
          vendor_name: z.string(),
          solution_area: z.string(),
          contract_status: z.enum(["Active", "Expiring", "Unknown"]),
          source: z.string(),
        })),
      }),
      procurement_history: z.object({
        recent_rfps: z.array(z.object({
          title: z.string(),
          date: z.string(),
          value: z.string(),
          winner: z.string(),
          source: z.string(),
        })),
        buying_patterns: z.string(),
      }),
      decision_makers: z.array(z.object({
        name: z.string(),
        title: z.string(),
        mentioned_in_rfp: z.string(),
        background: z.string(),
      })),
      metadata: z.object({
        research_completed: z.string(),
        gaps: z.array(z.string()),
      }),
    }),
    contextExtractor: (state: TState) => {
      // Extract intelligence data from state for synthesis
      const briefing = state.intelligenceBriefing;
      if (!briefing) {
        return "";
      }
      
      return `Intelligence Briefing Data:
${JSON.stringify(briefing, null, 2)}

Please synthesize this intelligence into a comprehensive, validated briefing with strategic insights.`;
    },
    stateUpdater: (output) => ({
      intelligenceBriefing: output,
      intelligenceGatheringStatus: "complete" as any,
      messages: [{
        role: "assistant" as const,
        content: `## 📊 Intelligence Synthesis Complete

I've synthesized the intelligence gathering results into a comprehensive briefing:

**Customer Analysis**: Validated ${output.customer_context.recent_initiatives.length} strategic initiatives
**Vendor Intelligence**: Analyzed ${output.vendor_landscape.current_vendors.length} current vendor relationships  
**Procurement Insights**: Synthesized ${output.procurement_history.recent_rfps.length} procurement activities
**Stakeholder Mapping**: Profiled ${output.decision_makers.length} key decision makers

The intelligence briefing provides actionable insights for proposal positioning, competitive strategy, and stakeholder engagement. All findings have been validated and structured for strategic use.

Please review the synthesized intelligence briefing.`
      }]
    }),
    statusField: "intelligenceGatheringStatus" as keyof TState,
    outputField: "intelligenceBriefing" as keyof TState
  });
}

/**
 * Generic Research Synthesis Configuration
 * 
 * Pre-configured synthesis agent for general research workflows
 */
export function createResearchSynthesisAgent<TState extends {
  researchResults?: any;
  researchStatus?: any;
  messages?: any[];
  errors?: string[];
}>(
  llm: ChatAnthropic,
  outputSchema: z.ZodSchema<any>,
  systemPrompt: string,
  contextExtractor: (state: TState) => string,
  outputField: keyof TState,
  statusField?: keyof TState
) {
  return createSynthesisAgent({
    nodeName: "ResearchSynthesis",
    llm,
    systemPrompt,
    outputSchema,
    contextExtractor,
    stateUpdater: (output) => ({
      [outputField]: output,
      messages: [{
        role: "assistant" as const,
        content: "Research synthesis completed. Please review the synthesized results."
      }]
    } as Partial<TState>),
    statusField,
    outputField
  });
}
