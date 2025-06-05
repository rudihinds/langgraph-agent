/**
 * RFP Analyzer Node - Focused RFP analysis for complexity assessment and strategic insights
 * Follows LangGraph pattern: nodes do work, edges handle orchestration
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import {
  OverallProposalState,
  InterruptReason,
} from "@/state/modules/types.js";

// Create logger instance directly to avoid import issues
const logger = {
  info: (message: string, meta?: any) =>
    console.log(`[INFO] ${message}`, meta || ""),
  error: (message: string, meta?: any) =>
    console.error(`[ERROR] ${message}`, meta || ""),
  warn: (message: string, meta?: any) =>
    console.warn(`[WARN] ${message}`, meta || ""),
  debug: (message: string, meta?: any) =>
    console.debug(`[DEBUG] ${message}`, meta || ""),
};

// Direct environment variable access
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Zod schemas for structured LLM output validation
const RfpAnalysisSchema = z.object({
  industry: z.enum([
    "Construction",
    "Technology",
    "Government",
    "Professional Services",
    "Healthcare",
    "Education",
    "Finance",
    "Manufacturing",
    "Other",
  ]),
  specialization: z.string().min(1),
  complexity: z.enum(["Simple", "Medium", "Complex"]),
  complexityFactors: z.array(z.string()),
  contractValueEstimate: z.string(),
  timelinePressure: z.enum(["Low", "Medium", "High"]),
  strategicFocus: z.array(z.string()),
  submissionRequirements: z.object({
    pageLimit: z.union([z.number().positive(), z.literal("not_specified")]),
    sectionsRequired: z.array(z.string()),
    attachmentsNeeded: z.array(z.string()),
  }),
  riskIndicators: z.array(
    z.object({
      risk: z.string(),
      severity: z.enum(["Low", "Medium", "High", "Critical"]),
      category: z.enum([
        "Technical",
        "Compliance",
        "Competitive",
        "Timeline",
        "Financial",
      ]),
    })
  ),
});

const StrategicInsightsSchema = z.object({
  keyOpportunities: z.array(z.string()),
  competitiveFactors: z.array(z.string()),
  requirementPriorities: z.array(
    z.object({
      requirement: z.string(),
      priority: z.enum(["Critical", "High", "Medium", "Low"]),
      rationale: z.string(),
    })
  ),
  funderSignals: z.array(
    z.object({
      signal: z.string(),
      interpretation: z.string(),
      confidence: z.number().min(0).max(1),
    })
  ),
});

type RfpAnalysisResult = z.infer<typeof RfpAnalysisSchema>;
type StrategicInsights = z.infer<typeof StrategicInsightsSchema>;

// LLM instance with appropriate settings for analysis
const analysisLlm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.1,
  maxTokens: 4096,
  apiKey: ANTHROPIC_API_KEY,
});

// Specialized LLM instance for question generation
const questionLlm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.3, // For consistency in question generation
  maxTokens: 1024,
  apiKey: ANTHROPIC_API_KEY,
});

/**
 * RFP Analysis prompt template
 */
const RFP_ANALYSIS_PROMPT = `You are an expert RFP analyst specializing in rapid assessment of procurement documents across industries.

Analyze this RFP document and provide structured analysis focused on:

1. **Industry Classification**: Determine the primary industry and specific specialization
2. **Complexity Assessment**: Evaluate based on technical requirements, compliance needs, and submission complexity
3. **Strategic Factors**: Identify timeline pressures, key focus areas, and submission requirements
4. **Risk Indicators**: Flag potential risks by category and severity

Provide your analysis in valid JSON format matching this exact schema:

{
  "industry": "Construction" | "Technology" | "Government" | "Professional Services" | "Healthcare" | "Education" | "Finance" | "Manufacturing" | "Other",
  "specialization": "string describing the specific sub-domain",
  "complexity": "Simple" | "Medium" | "Complex", 
  "complexityFactors": ["factor1", "factor2"],
  "contractValueEstimate": "string estimate with reasoning",
  "timelinePressure": "Low" | "Medium" | "High",
  "strategicFocus": ["focus1", "focus2"], 
  "submissionRequirements": {
    "pageLimit": number | "not_specified",
    "sectionsRequired": ["section1", "section2"],
    "attachmentsNeeded": ["attachment1", "attachment2"]
  },
  "riskIndicators": [
    {
      "risk": "description of risk",
      "severity": "Low" | "Medium" | "High" | "Critical",
      "category": "Technical" | "Compliance" | "Competitive" | "Timeline" | "Financial"
    }
  ]
}`;

/**
 * Strategic insights extraction prompt
 */
const STRATEGIC_INSIGHTS_PROMPT = `Based on your RFP analysis, provide strategic insights that will guide our proposal approach.

Focus on extracting:
1. **Key Opportunities**: What advantages can we leverage?
2. **Competitive Factors**: What will differentiate winning proposals?
3. **Requirement Priorities**: Which requirements carry the most weight?
4. **Funder Signals**: What does the language reveal about their preferences?

Provide insights in this JSON format:

{
  "keyOpportunities": ["opportunity1", "opportunity2"],
  "competitiveFactors": ["factor1", "factor2"], 
  "requirementPriorities": [
    {
      "requirement": "requirement description",
      "priority": "Critical" | "High" | "Medium" | "Low",
      "rationale": "why this priority level"
    }
  ],
  "funderSignals": [
    {
      "signal": "language or pattern observed",
      "interpretation": "what this suggests about funder priorities", 
      "confidence": 0.0 to 1.0
    }
  ]
}`;

/**
 * Dynamic question generation prompt template
 */
const QUESTION_GENERATION_PROMPT = `You are an expert at creating strategic questions for RFP analysis collaboration. Generate a focused question that helps users validate and refine the analysis based on the specific RFP context.

Consider these factors when crafting the question:
- Industry type and specialization requirements
- RFP complexity level and key factors
- Top strategic opportunities identified
- Critical risk indicators found
- Timeline pressures and constraints

Create a question that:
1. Is specific to this RFP's industry and context
2. Focuses on the most critical strategic decisions
3. Offers meaningful choices for the user
4. Uses appropriate industry terminology
5. Addresses the highest-impact areas identified

Return ONLY the question text - no explanations or additional formatting.

Examples of good contextual questions:
- Construction/Infrastructure: "Which safety compliance frameworks should we prioritize given the high-risk work environment?"
- Technology/Software: "Should we emphasize our cloud security certifications or our rapid deployment capabilities?"
- Government/Healthcare: "Which regulatory compliance areas deserve the most attention in our response strategy?"
- Professional Services: "Should we lead with our industry expertise or our cost-effectiveness positioning?"`;

/**
 * Analyze RFP document for industry, complexity, and strategic factors
 */
async function analyzeRfpDocument(rfpText: string): Promise<RfpAnalysisResult> {
  try {
    logger.info("Starting RFP document analysis", {
      rfpLength: rfpText.length,
    });

    const response = await analysisLlm.invoke([
      { role: "system", content: RFP_ANALYSIS_PROMPT },
      { role: "user", content: `Analyze this RFP:\n\n${rfpText}` },
    ]);

    const content = (response.content as string)
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsedResponse = JSON.parse(content);
    const validatedResult = RfpAnalysisSchema.parse(parsedResponse);

    logger.info("RFP analysis completed", {
      industry: validatedResult.industry,
      complexity: validatedResult.complexity,
      riskCount: validatedResult.riskIndicators.length,
    });

    return validatedResult;
  } catch (error) {
    logger.error("RFP analysis failed", { error });

    // Return minimal fallback analysis
    return {
      industry: "Other",
      specialization: "General",
      complexity: "Medium",
      complexityFactors: ["Analysis system error - manual review required"],
      contractValueEstimate: "Unable to determine",
      timelinePressure: "Medium",
      strategicFocus: ["Error recovery", "Manual review needed"],
      submissionRequirements: {
        pageLimit: "not_specified",
        sectionsRequired: ["Standard sections"],
        attachmentsNeeded: [],
      },
      riskIndicators: [
        {
          risk: "Analysis system failure - requires manual assessment",
          severity: "High",
          category: "Technical",
        },
      ],
    };
  }
}

/**
 * Extract strategic insights from the analyzed RFP
 */
async function extractStrategicInsights(
  rfpText: string,
  analysis: RfpAnalysisResult
): Promise<StrategicInsights> {
  try {
    const response = await analysisLlm.invoke([
      { role: "system", content: STRATEGIC_INSIGHTS_PROMPT },
      {
        role: "user",
        content: `RFP Analysis: ${JSON.stringify(analysis, null, 2)}\n\nOriginal RFP:\n${rfpText}`,
      },
    ]);

    const content = (response.content as string)
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsedResponse = JSON.parse(content);
    return StrategicInsightsSchema.parse(parsedResponse);
  } catch (error) {
    logger.error("Strategic insights extraction failed", { error });

    return {
      keyOpportunities: ["Manual strategy development required"],
      competitiveFactors: ["Standard competitive analysis needed"],
      requirementPriorities: [
        {
          requirement: "All requirements require manual prioritization",
          priority: "High",
          rationale: "Automatic analysis failed",
        },
      ],
      funderSignals: [
        {
          signal: "Analysis system error",
          interpretation: "Manual document review required",
          confidence: 0.0,
        },
      ],
    };
  }
}

/**
 * Generate user collaboration checkpoint for strategic validation
 */
async function createStrategicValidationCheckpoint(
  analysis: RfpAnalysisResult,
  insights: StrategicInsights
) {
  // Generate contextual question using LLM intelligence
  const contextualQuestion = await generateContextualQuestion(
    analysis,
    insights
  );

  return {
    checkpointType: "strategic_validation",
    analysisResults: {
      industry: analysis.industry,
      complexity: analysis.complexity,
      timelinePressure: analysis.timelinePressure,
      keyRisks: analysis.riskIndicators.filter(
        (r) => r.severity === "High" || r.severity === "Critical"
      ),
    },
    strategicRecommendations: {
      topOpportunities: insights.keyOpportunities.slice(0, 3),
      criticalRequirements: insights.requirementPriorities.filter(
        (r) => r.priority === "Critical"
      ),
      confidenceLevel:
        insights.funderSignals.reduce(
          (avg, signal) => avg + signal.confidence,
          0
        ) / insights.funderSignals.length,
    },
    userQuestions: [
      {
        id: `strategic_priorities_${Date.now()}`,
        question: contextualQuestion,
        options: insights.keyOpportunities,
        multiSelect: true,
        context: `${analysis.industry} - ${analysis.complexity} complexity - ${analysis.timelinePressure} timeline pressure`,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Generate contextual question based on RFP analysis using LLM intelligence
 */
async function generateContextualQuestion(
  analysis: RfpAnalysisResult,
  insights: StrategicInsights
): Promise<string> {
  try {
    const context = `
RFP ANALYSIS CONTEXT:
Industry: ${analysis.industry}
Specialization: ${analysis.specialization}
Complexity: ${analysis.complexity}
Timeline Pressure: ${analysis.timelinePressure}

TOP OPPORTUNITIES:
${insights.keyOpportunities
  .slice(0, 3)
  .map((opp, i) => `${i + 1}. ${opp}`)
  .join("\n")}

KEY RISK FACTORS:
${analysis.riskIndicators
  .filter((r) => r.severity === "High" || r.severity === "Critical")
  .slice(0, 3)
  .map((risk, i) => `${i + 1}. ${risk.risk} (${risk.category})`)
  .join("\n")}

COMPETITIVE FACTORS:
${insights.competitiveFactors
  .slice(0, 3)
  .map((factor, i) => `${i + 1}. ${factor}`)
  .join("\n")}
`;

    const response = await questionLlm.invoke([
      { role: "system", content: QUESTION_GENERATION_PROMPT },
      { role: "user", content: context },
    ]);

    const question = (response.content as string).trim();

    logger.info("Generated contextual question", {
      industry: analysis.industry,
      complexity: analysis.complexity,
      questionLength: question.length,
    });

    return question;
  } catch (error) {
    logger.error("Failed to generate contextual question", { error });

    // Intelligent fallback based on industry and complexity
    const industryQuestions = {
      Construction:
        "Which safety and compliance priorities should guide our proposal strategy?",
      Technology:
        "Should we emphasize our technical capabilities or implementation expertise?",
      Government:
        "Which regulatory compliance areas should we prioritize in our response?",
      Healthcare:
        "How should we balance clinical expertise with operational efficiency?",
      "Professional Services":
        "Should we lead with industry experience or cost-effectiveness?",
      Education:
        "Which educational outcomes and methodologies should we emphasize?",
      Finance:
        "How should we balance regulatory compliance with innovative solutions?",
      Manufacturing:
        "Should we focus on quality standards or production efficiency?",
    };

    return (
      industryQuestions[analysis.industry as keyof typeof industryQuestions] ||
      "Based on this RFP analysis, which strategic priorities should we emphasize?"
    );
  }
}

/**
 * RFP Analyzer Node - Main implementation
 * Focuses purely on analysis work, lets conditional edges handle orchestration
 */
export async function rfpAnalyzerNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  try {
    logger.info("Starting RFP analysis", {
      userId: state.userId,
      proposalId: state.proposalId,
      hasRfpDocument: !!state.rfpDocument?.raw,
    });

    // Validate RFP document exists
    const rfpText = state.rfpDocument?.raw;
    if (!rfpText?.trim()) {
      logger.warn("No RFP document found");
      return {
        currentStep: "rfp_analysis_failed",
        errors: [
          ...(state.errors || []),
          "No RFP document provided for analysis",
        ],
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    // Perform RFP analysis
    const rfpAnalysis = await analyzeRfpDocument(rfpText);

    // Extract strategic insights
    const strategicInsights = await extractStrategicInsights(
      rfpText,
      rfpAnalysis
    );

    // Create user collaboration checkpoint
    const collaborationCheckpoint = await createStrategicValidationCheckpoint(
      rfpAnalysis,
      strategicInsights
    );

    // Update state with analysis results - no orchestration decisions here
    const updatedState: Partial<OverallProposalState> = {
      currentStep: "rfp_analysis_complete",
      planningIntelligence: {
        ...state.planningIntelligence,
        rfpCharacteristics: {
          industry: rfpAnalysis.industry,
          specialization: rfpAnalysis.specialization,
          complexity: rfpAnalysis.complexity,
          complexityFactors: rfpAnalysis.complexityFactors,
          contractValueEstimate: rfpAnalysis.contractValueEstimate,
          timelinePressure: rfpAnalysis.timelinePressure,
          strategicFocus: rfpAnalysis.strategicFocus,
          submissionRequirements: {
            pageLimit: rfpAnalysis.submissionRequirements.pageLimit,
            sectionsRequired:
              rfpAnalysis.submissionRequirements.sectionsRequired,
            attachmentsNeeded:
              rfpAnalysis.submissionRequirements.attachmentsNeeded,
          },
        },
        earlyRiskAssessment: {
          riskIndicators: rfpAnalysis.riskIndicators.map((risk) => ({
            risk: risk.risk,
            severity: risk.severity,
            category: risk.category,
          })),
          strategicInsights: {
            keyOpportunities: strategicInsights.keyOpportunities,
            competitiveFactors: strategicInsights.competitiveFactors,
            requirementPriorities: strategicInsights.requirementPriorities.map(
              (req) => ({
                requirement: req.requirement,
                priority: req.priority,
                rationale: req.rationale,
              })
            ),
            funderSignals: strategicInsights.funderSignals.map((signal) => ({
              signal: signal.signal,
              interpretation: signal.interpretation,
              confidence: signal.confidence,
            })),
          },
          analysisConfidence:
            strategicInsights.funderSignals.reduce(
              (avg, s) => avg + s.confidence,
              0
            ) / strategicInsights.funderSignals.length,
          requiresUserValidation: true,
        },
      },
      userCollaboration: {
        ...state.userCollaboration,
        userQueries: [
          ...(state.userCollaboration?.userQueries || []),
          ...collaborationCheckpoint.userQuestions,
        ],
        strategicRecommendations: {
          topOpportunities:
            collaborationCheckpoint.strategicRecommendations.topOpportunities,
          criticalRequirements:
            collaborationCheckpoint.strategicRecommendations.criticalRequirements.map(
              (req) => ({
                requirement: req.requirement,
                priority: req.priority,
                rationale: req.rationale,
              })
            ),
          confidenceLevel:
            collaborationCheckpoint.strategicRecommendations.confidenceLevel,
        },
      },
      messages: [
        ...state.messages,
        new AIMessage(
          `## RFP Analysis Complete\n\n` +
            `**Industry:** ${rfpAnalysis.industry} (${rfpAnalysis.specialization})\n` +
            `**Complexity:** ${rfpAnalysis.complexity}\n` +
            `**Timeline Pressure:** ${rfpAnalysis.timelinePressure}\n` +
            `**Key Opportunities:** ${strategicInsights.keyOpportunities.slice(0, 3).join(", ")}\n\n` +
            `${rfpAnalysis.riskIndicators.length > 0 ? `**Risk Indicators:** ${rfpAnalysis.riskIndicators.length} identified\n\n` : ""}` +
            `Ready for strategic validation and workflow planning.`
        ),
      ],
      lastUpdatedAt: new Date().toISOString(),
    };

    logger.info("RFP analysis completed successfully", {
      industry: rfpAnalysis.industry,
      complexity: rfpAnalysis.complexity,
      riskCount: rfpAnalysis.riskIndicators.length,
      opportunityCount: strategicInsights.keyOpportunities.length,
    });

    return updatedState;
  } catch (error) {
    logger.error("RFP analyzer node failed", { error });

    return {
      currentStep: "rfp_analysis_failed",
      errors: [
        ...(state.errors || []),
        `RFP analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Conditional edge function for routing after RFP analysis
 * This is where orchestration logic belongs in LangGraph
 */
export function routeAfterRfpAnalysis(state: OverallProposalState): string {
  // Check for analysis failures
  if (state.currentStep === "rfp_analysis_failed" || state.errors?.length) {
    return "error_recovery";
  }

  // Check if user validation is required
  const hasUnrespondedQueries = state.userCollaboration?.userQueries?.some(
    (query) => !query.response
  );

  if (hasUnrespondedQueries) {
    return "strategic_validation_checkpoint";
  }

  // Analysis complete and validated - route based on complexity
  const complexity = state.planningIntelligence?.rfpCharacteristics?.complexity;
  const riskCount =
    state.planningIntelligence?.earlyRiskAssessment?.riskIndicators?.length ||
    0;

  // High complexity or high risk count suggests comprehensive approach
  if (complexity === "Complex" || riskCount > 3) {
    return "comprehensive_research_planning";
  }

  // Medium complexity suggests standard approach
  if (complexity === "Medium") {
    return "standard_research_planning";
  }

  // Simple complexity suggests accelerated approach
  return "accelerated_research_planning";
}

/**
 * Strategic validation checkpoint for user collaboration
 * Handles both original and refined strategic queries
 */
export async function strategicValidationCheckpoint(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  // Find ANY strategic query that needs a response (original or refined)
  const latestQuery = state.userCollaboration?.userQueries?.find(
    (query) =>
      !query.response &&
      (query.id.includes("strategic_priorities") ||
        query.id.includes("refined_strategic_priorities"))
  );

  if (!latestQuery) {
    return { currentStep: "strategic_validation_complete" };
  }

  // Use interrupt for human-in-the-loop validation
  const userResponse = interrupt({
    type: "strategic_validation",
    question: latestQuery.question,
    options: latestQuery.options,
    context: latestQuery.context,
    metadata: {
      reason: InterruptReason.CONTENT_REVIEW,
      nodeId: "strategicValidationCheckpoint",
      timestamp: new Date().toISOString(),
      contentReference: latestQuery.id.includes("refined")
        ? "refined_strategic_priorities"
        : "strategic_priorities",
    },
  });

  // This will be populated when user responds and graph resumes
  return {
    currentStep: "awaiting_strategic_validation",
    interruptStatus: {
      isInterrupted: true,
      interruptionPoint: "strategic_validation",
      feedback: null,
      processingStatus: null,
    },
    lastUpdatedAt: new Date().toISOString(),
  };
}
