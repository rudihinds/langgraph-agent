/**
 * Master Orchestrator Node - First planning agent for RFP complexity analysis and workflow determination
 * Provides strategic direction and user collaboration checkpoints
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import {
  OverallProposalState,
  WorkflowApproach,
  ComplexityLevel,
  WorkflowDecision,
  EarlyRiskAssessment,
  UserQuery,
  PlanningIntelligence,
  UserCollaboration,
  AdaptiveWorkflow,
  InterruptProcessingStatus,
  InterruptStatus,
  InterruptMetadata,
  InterruptReason,
} from "@/state/modules/types.js";
import { Logger } from "@/lib/logger.js";
import { ENV } from "../../../../lib/config/env.js";

const logger = Logger.getInstance();

// Zod schemas for structured LLM output validation
const RFPAnalysisSchema = z.object({
  industry: z.enum([
    "Construction",
    "Technology",
    "Government",
    "Professional Services",
    "Healthcare",
    "Other",
  ]),
  specialization: z.string(),
  complexity: z.enum(["Simple", "Medium", "Complex"]),
  complexity_factors: z.array(z.string()),
  contract_value_estimate: z.string(),
  timeline_pressure: z.enum(["Low", "Medium", "High"]),
  strategic_focus: z.array(z.string()),
  submission_requirements: z.object({
    page_limit: z.union([z.number(), z.literal("not_specified")]),
    sections_required: z.array(z.string()),
    attachments_needed: z.array(z.string()),
  }),
});

const UserApproachSelectionSchema = z.object({
  selected_agents: z.array(z.string()),
  research_depth: z.enum(["Basic", "Standard", "Deep"]),
  custom_focus_areas: z.array(z.string()),
});

const EarlyRiskAssessmentSchema = z.object({
  risk: z.string(),
  severity: z.enum(["Low", "Medium", "High"]),
  mitigation: z.string(),
  confidence: z.number().min(0).max(1),
});

const MasterOrchestratorOutputSchema = z.object({
  rfp_analysis: RFPAnalysisSchema,
  user_approach_selection: UserApproachSelectionSchema,
  early_risk_assessment: z.array(EarlyRiskAssessmentSchema),
  confidence_score: z.number().min(0).max(1),
});

type MasterOrchestratorOutput = z.infer<typeof MasterOrchestratorOutputSchema>;

// LLM instance for strategic analysis
const strategicAnalysisLLM = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.1,
  maxTokens: 4096,
  apiKey: ENV.ANTHROPIC_API_KEY,
});

/**
 * Master Orchestrator prompt template for RFP analysis and workflow determination
 */
const MASTER_ORCHESTRATOR_PROMPT = `You are a strategic RFP analysis expert with deep experience across industries. Analyze this RFP and determine optimal response approaches.

Please analyze this RFP and provide structured analysis in the exact JSON format specified.

Focus on:
1. Industry Classification and specialization with confidence levels
2. Complexity Assessment based on requirements depth, technical complexity, submission requirements
3. Strategic Focus Areas ranked by importance for winning
4. Resource Planning with time estimates
5. Risk Assessment with early warning flags

Respond with valid JSON matching this exact schema:
{
  "industry": "Construction" | "Technology" | "Government" | "Professional Services" | "Healthcare" | "Other",
  "specialization": string,
  "complexity": "Simple" | "Medium" | "Complex",
  "complexity_factors": string[],
  "contract_value_estimate": string,
  "timeline_pressure": "Low" | "Medium" | "High",
  "strategic_focus": string[],
  "submission_requirements": {
    "page_limit": number | "not_specified",
    "sections_required": string[],
    "attachments_needed": string[]
  }
}`;

/**
 * Analyze RFP complexity using LLM
 */
async function analyzeRFPComplexity(
  rfpText: string
): Promise<z.infer<typeof RFPAnalysisSchema>> {
  try {
    logger.info("Sending RFP analysis request to LLM", {
      rfpLength: rfpText.length,
    });

    const response = await strategicAnalysisLLM.invoke([
      {
        role: "system",
        content: MASTER_ORCHESTRATOR_PROMPT,
      },
      {
        role: "user",
        content: `Please analyze this RFP:\n\n${rfpText}`,
      },
    ]);

    let content = response.content as string;

    // Clean up the response (remove markdown formatting if present)
    content = content
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    try {
      const parsedResponse = JSON.parse(content);
      const validatedResult = RFPAnalysisSchema.parse(parsedResponse);

      logger.info("RFP analysis completed successfully", {
        industry: validatedResult.industry,
        complexity: validatedResult.complexity,
        strategicFocus: validatedResult.strategic_focus.length,
      });

      return validatedResult;
    } catch (parseError) {
      logger.warn("Failed to parse LLM response as JSON, attempting fallback", {
        parseError,
        responseLength: content.length,
      });
      throw parseError;
    }
  } catch (error) {
    logger.error("Error in RFP complexity analysis", { error });

    // Return fallback analysis
    return {
      industry: "Other",
      specialization: "General",
      complexity: "Medium",
      complexity_factors: ["Analysis system error"],
      contract_value_estimate: "Not determined",
      timeline_pressure: "Medium",
      strategic_focus: ["Error recovery"],
      submission_requirements: {
        page_limit: "not_specified",
        sections_required: ["Standard sections"],
        attachments_needed: [],
      },
    };
  }
}

/**
 * Determine workflow approach based on analysis
 */
function selectWorkflowApproach(analysis: z.infer<typeof RFPAnalysisSchema>): {
  approach: "accelerated" | "standard" | "comprehensive";
  rationale: string;
  estimatedTime: string;
  agentsRequired: string[];
} {
  if (
    analysis.complexity === "Simple" &&
    analysis.timeline_pressure === "High"
  ) {
    return {
      approach: "accelerated",
      rationale:
        "Simple RFP with high timeline pressure - focusing on core requirements",
      estimatedTime: "2-3 days",
      agentsRequired: ["Enhanced Research Agent", "Solution Decoder Agent"],
    };
  }

  if (
    analysis.complexity === "Complex" ||
    analysis.industry === "Healthcare" ||
    analysis.industry === "Government"
  ) {
    return {
      approach: "comprehensive",
      rationale:
        "Complex RFP requiring thorough analysis and compliance considerations",
      estimatedTime: "1-2 weeks",
      agentsRequired: [
        "Enhanced Research Agent",
        "Industry Specialist Agent",
        "Competitive Intelligence Agent",
        "Requirement Analysis Agent",
        "Solution Decoder Agent",
      ],
    };
  }

  // Default to standard approach
  return {
    approach: "standard",
    rationale: "Balanced approach for medium complexity RFP",
    estimatedTime: "5-7 days",
    agentsRequired: [
      "Enhanced Research Agent",
      "Industry Specialist Agent",
      "Solution Decoder Agent",
    ],
  };
}

/**
 * Create strategic priorities query for user collaboration
 */
function createStrategicPrioritiesQuery(
  analysis: z.infer<typeof RFPAnalysisSchema>,
  workflowDecision: ReturnType<typeof selectWorkflowApproach>
): {
  id: string;
  question: string;
  options: string[];
  multiSelect: boolean;
  context: string;
  timestamp: string;
} {
  return {
    id: `strategic_priorities_${Date.now()}`,
    question: `Based on our analysis, we recommend a ${workflowDecision.approach} approach for this ${analysis.industry} RFP. What should be our strategic priorities?`,
    options: [
      "Win at competitive cost",
      "Demonstrate technical excellence",
      "Highlight compliance expertise",
      "Emphasize past performance",
      "Focus on innovation",
      "Prioritize risk mitigation",
    ],
    multiSelect: true,
    context: `Complexity: ${analysis.complexity}, Timeline Pressure: ${analysis.timeline_pressure}, Strategic Focus: ${analysis.strategic_focus.join(", ")}`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Master Orchestrator Node - Main implementation
 */
export async function masterOrchestratorNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  try {
    logger.info("Starting Master Orchestrator analysis", {
      userId: state.userId,
      proposalId: state.proposalId,
    });

    // Extract RFP text from state
    const rfpText = state.rfpDocument?.raw || "";
    if (!rfpText.trim()) {
      logger.warn("No RFP text found in state");
      return {
        currentPhase: "planning",
        currentStep: "master_orchestrator_analysis",
        errors: [...(state.errors || []), "No RFP document found in state"],
        lastUpdatedAt: new Date().toISOString(),
      };
    }

    // Analyze RFP complexity
    const rfpAnalysis = await analyzeRFPComplexity(rfpText);

    // Determine workflow approach
    const workflowDecision = selectWorkflowApproach(rfpAnalysis);

    // Create strategic priorities query
    const strategicQuery = createStrategicPrioritiesQuery(
      rfpAnalysis,
      workflowDecision
    );

    // Update state with analysis results
    const updatedState: Partial<OverallProposalState> = {
      currentPhase: "planning",
      currentStep: "master_orchestrator_analysis",
      adaptiveWorkflow: {
        selectedApproach: workflowDecision.approach,
        activeAgentSet: workflowDecision.agentsRequired,
        complexityLevel: rfpAnalysis.complexity.toLowerCase() as
          | "simple"
          | "moderate"
          | "complex",
        skipReasons: {},
        currentPhase: "planning",
        phaseCompletionStatus: {
          planning: false,
          writing: false,
          complete: false,
        },
        adaptationTriggers: [
          {
            trigger: "master_orchestrator_analysis",
            reason: workflowDecision.rationale,
            timestamp: new Date().toISOString(),
            actionTaken: `Selected ${workflowDecision.approach} approach`,
          },
        ],
      },
      planningIntelligence: {
        ...state.planningIntelligence,
        rfpCharacteristics: {
          industry: rfpAnalysis.industry,
          specialization: rfpAnalysis.specialization,
          complexity: rfpAnalysis.complexity as "Simple" | "Medium" | "Complex",
          complexityFactors: rfpAnalysis.complexity_factors,
          contractValueEstimate: rfpAnalysis.contract_value_estimate,
          timelinePressure: rfpAnalysis.timeline_pressure,
          strategicFocus: rfpAnalysis.strategic_focus,
          submissionRequirements: {
            pageLimit: rfpAnalysis.submission_requirements.page_limit,
            sectionsRequired:
              rfpAnalysis.submission_requirements.sections_required,
            attachmentsNeeded:
              rfpAnalysis.submission_requirements.attachments_needed,
          },
        },
      },
      userCollaboration: {
        ...state.userCollaboration,
        strategicPriorities: state.userCollaboration?.strategicPriorities || [],
        competitiveAdvantages:
          state.userCollaboration?.competitiveAdvantages || [],
        riskFactors: state.userCollaboration?.riskFactors || [],
        userQueries: [
          ...(state.userCollaboration?.userQueries || []),
          strategicQuery,
        ],
        expertiseContributions:
          state.userCollaboration?.expertiseContributions || [],
        feedbackHistory: state.userCollaboration?.feedbackHistory || {},
      },
      messages: [
        ...state.messages,
        new AIMessage(
          `🎯 **Master Orchestrator Analysis Complete**\n\n` +
            `**RFP Analysis:**\n` +
            `- Industry: ${rfpAnalysis.industry} (${rfpAnalysis.specialization})\n` +
            `- Complexity: ${rfpAnalysis.complexity}\n` +
            `- Timeline Pressure: ${rfpAnalysis.timeline_pressure}\n\n` +
            `**Recommended Approach:** ${workflowDecision.approach.toUpperCase()}\n` +
            `- Estimated Time: ${workflowDecision.estimatedTime}\n` +
            `- Agents Required: ${workflowDecision.agentsRequired.join(", ")}\n` +
            `- Rationale: ${workflowDecision.rationale}\n\n` +
            `**Next Step:** Please review and confirm your strategic priorities.`
        ),
      ],
      lastUpdatedAt: new Date().toISOString(),
    };

    logger.info("Master Orchestrator analysis completed", {
      approach: workflowDecision.approach,
      complexity: rfpAnalysis.complexity,
      industry: rfpAnalysis.industry,
    });

    return updatedState;
  } catch (error) {
    logger.error("Error in Master Orchestrator node", { error });
    return {
      currentPhase: "planning",
      currentStep: "master_orchestrator_analysis",
      errors: [
        ...(state.errors || []),
        `Master Orchestrator processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
      lastUpdatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Route after Master Orchestrator based on state
 */
export function routeAfterMasterOrchestrator(
  state: OverallProposalState
): string {
  // Check if there are pending user queries that need strategic priorities input
  const hasStrategicPrioritiesQuery =
    state.userCollaboration?.userQueries?.some((query) =>
      query.question.includes("strategic priorities")
    );

  if (hasStrategicPrioritiesQuery) {
    return "awaiting_strategic_priorities";
  }

  // Check if we have an adaptive workflow with active agents
  if (state.adaptiveWorkflow?.activeAgentSet) {
    const activeAgents = state.adaptiveWorkflow.activeAgentSet;

    // Route based on which agents are active
    if (activeAgents.includes("Enhanced Research Agent")) {
      return "enhanced_research";
    }

    if (activeAgents.includes("Solution Decoder Agent")) {
      return "solution_decoder";
    }

    // Fallback to deep research for comprehensive approach
    if (state.adaptiveWorkflow.selectedApproach === "comprehensive") {
      return "deep_research";
    }
  }

  // Check for errors
  if (state.errors && state.errors.length > 0) {
    logger.warn("Master Orchestrator had errors, routing to research");
    return "error";
  }

  // Default fallback
  return "research";
}

/**
 * Await Strategic Priorities Node - HITL for user input
 */
export async function awaitStrategicPrioritiesNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  logger.info("Awaiting strategic priorities from user");

  // Get the latest strategic priorities query
  const latestQuery = state.userCollaboration?.userQueries?.find((query) =>
    query.question.includes("strategic priorities")
  );

  // Set up interrupt status for HITL
  const interruptStatus: InterruptStatus = {
    isInterrupted: true,
    interruptionPoint: "strategic_priorities_input",
    processingStatus: null,
    feedback: null,
  };

  // Set up interrupt metadata
  const interruptMetadata: InterruptMetadata = {
    reason: InterruptReason.CONTENT_REVIEW,
    nodeId: "awaitStrategicPriorities",
    timestamp: new Date().toISOString(),
    contentReference: "strategic_priorities_selection",
    evaluationResult: {
      latestQuery,
      requiredInput: "strategic_priorities_selection",
      context:
        "User needs to select strategic priorities for proposal approach",
    },
  };

  // Use LangGraph's interrupt mechanism
  interrupt({
    message: "Strategic priorities input required",
    metadata: interruptMetadata,
  });

  return {
    currentStep: "awaiting_strategic_priorities",
    interruptStatus,
    interruptMetadata,
    lastUpdatedAt: new Date().toISOString(),
  };
}
