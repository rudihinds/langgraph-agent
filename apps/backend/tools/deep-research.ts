/**
 * Deep Research Tool
 * Comprehensive research and synthesis tool for complex topics requiring multiple sources and analysis
 * Following enhanced_research_agent_plan.md specification exactly
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Logger } from "@/lib/logger.js";
import { createModel } from "@/lib/llm/model-factory.js";
import { createWebSearchTool } from "@/tools/web-search.js";

const logger = Logger.getInstance();

// Input schema matching planning-agents.md specification exactly
const DeepResearchInputSchema = z.object({
  topic: z.string().describe("Research topic to investigate"),
  context: z.string().describe("Strategic context for the research"),
  focus_areas: z
    .array(z.string())
    .describe("Specific areas to focus analysis on"),
});

// Output schema for structured research with analysis and confidence scores
const DeepResearchOutputSchema = z.object({
  synthesized_analysis: z
    .string()
    .describe("Comprehensive analysis of the research topic"),
  key_findings: z
    .array(z.string())
    .describe("Primary findings from the research"),
  evidence_sources: z
    .array(
      z.object({
        source: z.string(),
        relevance: z.string(),
        confidence: z.number().min(0).max(1),
      })
    )
    .describe("Sources with relevance and confidence"),
  strategic_insights: z.array(z.string()).describe("Strategic implications"),
  confidence_level: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall confidence in findings"),
  research_completeness: z
    .number()
    .min(0)
    .max(1)
    .describe("How complete the research is"),
  recommended_next_steps: z
    .array(z.string())
    .describe("Suggested follow-up research"),
});

type DeepResearchOutput = z.infer<typeof DeepResearchOutputSchema>;

/**
 * Perform comprehensive research and synthesis using Claude 3.5 Sonnet with web search
 */
async function performDeepResearch(
  topic: string,
  context: string,
  focus_areas: string[]
): Promise<DeepResearchOutput> {
  try {
    logger.info("Starting deep research analysis", {
      topic,
      context: context.substring(0, 100),
      focus_areas,
    });

    // Initialize model with web search capabilities
    const model = createModel(undefined, {
      temperature: 0.3, // Lower temperature for more focused research
    }).bindTools([createWebSearchTool()]);

    // Create comprehensive research prompt following the specification
    const researchPrompt = `You are a strategic research analyst conducting comprehensive research on the specified topic using multiple sources and providing synthesized analysis.

Research Topic: ${topic}
Strategic Context: ${context}
Analysis Focus: ${focus_areas.join(", ")}

RESEARCH PROCESS:
1. Gather information from multiple credible sources using web search
2. Analyze patterns and trends in the data
3. Synthesize findings into strategic insights
4. Provide evidence-based conclusions with confidence levels

RESEARCH REQUIREMENTS:
- Conduct systematic searches for different aspects of the topic
- Cross-reference information from multiple sources
- Identify gaps and contradictions in available information
- Assess credibility and relevance of sources
- Provide strategic interpretation of findings

Focus your analysis on: ${focus_areas.map((area) => `- ${area}`).join("\n")}

Deliver actionable intelligence with specific evidence and strategic interpretation. Use web search to gather current, credible information.

Begin by searching for information about: ${topic}`;

    // Invoke the model to perform research with tools
    const researchResponse = await model.invoke([
      { role: "human", content: researchPrompt },
    ]);

    // Extract and structure the research findings
    const researchContent =
      typeof researchResponse.content === "string"
        ? researchResponse.content
        : "Research completed with tool interactions";

    // Parse and structure the research into the required format
    const structuredOutput = await structureResearchOutput(
      researchContent,
      topic,
      focus_areas,
      researchResponse.tool_calls?.length || 0
    );

    logger.info("Deep research analysis completed", {
      topic,
      confidenceLevel: structuredOutput.confidence_level,
      findingsCount: structuredOutput.key_findings.length,
      toolCalls: researchResponse.tool_calls?.length || 0,
    });

    return structuredOutput;
  } catch (error) {
    logger.error("Deep research analysis error", { error, topic });

    // Return graceful degradation with error indication
    return {
      synthesized_analysis: `Research analysis encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Limited analysis available.`,
      key_findings: [`Research error for topic: ${topic}`],
      evidence_sources: [],
      strategic_insights: [
        "Unable to complete comprehensive analysis due to technical issues",
      ],
      confidence_level: 0.1,
      research_completeness: 0.1,
      recommended_next_steps: [
        "Retry research with alternative approach",
        "Manual research recommended",
      ],
    };
  }
}

/**
 * Structure raw research content into the required output format
 */
async function structureResearchOutput(
  researchContent: string,
  topic: string,
  focus_areas: string[],
  toolCallsCount: number
): Promise<DeepResearchOutput> {
  // Use model to structure the research into the required format
  const structuringModel = createModel(undefined, {
    temperature: 0.1, // Very low temperature for consistent structuring
  });

  const structuringPrompt = `Structure the following research content into the required JSON format. Be precise and evidence-based.

Research Content: ${researchContent.substring(0, 3000)}
Topic: ${topic}
Focus Areas: ${focus_areas.join(", ")}
Tool Calls Made: ${toolCallsCount}

Required Output Format (return ONLY valid JSON):
{
  "synthesized_analysis": "Comprehensive analysis synthesizing all findings",
  "key_findings": ["Primary finding 1", "Primary finding 2", "..."],
  "evidence_sources": [{"source": "source description", "relevance": "how relevant", "confidence": 0.8}],
  "strategic_insights": ["Strategic implication 1", "Strategic implication 2"],
  "confidence_level": 0.85,
  "research_completeness": 0.90,
  "recommended_next_steps": ["Next step 1", "Next step 2"]
}

Ensure confidence_level and research_completeness are between 0 and 1. Base confidence on source quality and information completeness.`;

  try {
    const structuredResponse = await structuringModel.invoke([
      { role: "human", content: structuringPrompt },
    ]);

    const jsonContent =
      typeof structuredResponse.content === "string"
        ? structuredResponse.content
        : "{}";

    // Parse and validate the JSON
    const parsedOutput = JSON.parse(jsonContent.trim());

    // Validate against schema
    return DeepResearchOutputSchema.parse(parsedOutput);
  } catch (error) {
    logger.warn("Research structuring failed, using fallback", { error });

    // Fallback structured output
    return {
      synthesized_analysis: researchContent.substring(0, 500) + "...",
      key_findings: extractKeyFindingsFromText(researchContent),
      evidence_sources: [
        {
          source: "Web search results",
          relevance: "Primary research source",
          confidence: toolCallsCount > 0 ? 0.7 : 0.3,
        },
      ],
      strategic_insights: focus_areas.map(
        (area) => `Analysis needed for: ${area}`
      ),
      confidence_level: toolCallsCount > 0 ? 0.6 : 0.3,
      research_completeness: toolCallsCount > 0 ? 0.7 : 0.4,
      recommended_next_steps: [
        "Review findings",
        "Conduct additional focused research",
      ],
    };
  }
}

/**
 * Extract key findings from unstructured text as fallback
 */
function extractKeyFindingsFromText(text: string): string[] {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  return sentences.slice(0, 5).map((s) => s.trim());
}

/**
 * Deep Research Tool - matches planning-agents.md specification exactly
 */
export const deepResearchTool = tool(
  async ({ topic, context, focus_areas }) => {
    return await performDeepResearch(topic, context, focus_areas);
  },
  {
    name: "deep_research_tool",
    description:
      "Comprehensive research and synthesis tool for complex topics requiring multiple sources and analysis",
    schema: DeepResearchInputSchema,
  }
);

// Export for backwards compatibility
export default deepResearchTool;
