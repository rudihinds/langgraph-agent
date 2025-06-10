/**
 * RFP Analyzer Node - Focused RFP analysis for complexity assessment and strategic insights
 * Follows LangGraph pattern: nodes do work, edges handle orchestration
 */

import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import { OverallProposalState, InterruptReason } from "@/state/modules/types.js";
import { Logger } from "@/lib/logger.js";
import { ENV } from "@/lib/config/env.js";

const logger = Logger.getInstance();

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
    "Other"
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
    attachmentsNeeded: z.array(z.string())
  }),
  riskIndicators: z.array(z.object({
    risk: z.string(),
    severity: z.enum(["Low", "Medium", "High", "Critical"]),
    category: z.enum(["Technical", "Compliance", "Competitive", "Timeline", "Financial"])
  }))
});

const StrategicInsightsSchema = z.object({
  keyOpportunities: z.array(z.string()),
  competitiveFactors: z.array(z.string()),
  requirementPriorities: z.array(z.object({
    requirement: z.string(),
    priority: z.enum(["Critical", "High", "Medium", "Low"]),
    rationale: z.string()
  })),
  funderSignals: z.array(z.object({
    signal: z.string(),
    interpretation: z.string(),
    confidence: z.number().min(0).max(1)
  }))
});

type RfpAnalysisResult = z.infer<typeof RfpAnalysisSchema>;
type StrategicInsights = z.infer<typeof StrategicInsightsSchema>;

// LLM instance with appropriate settings for analysis
const analysisLlm = new ChatAnthropic({
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.1,
  maxTokens: 4096,
  apiKey: ENV.ANTHROPIC_API_KEY,
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
 * Analyze RFP document for industry, complexity, and strategic factors
 */
async function analyzeRfpDocument(rfpText: string): Promise<RfpAnalysisResult> {
  try {
    logger.info("Starting RFP document analysis", { rfpLength: rfpText.length });

    const response = await analysisLlm.invoke([
      { role: "system", content: RFP_ANALYSIS_PROMPT },
      { role: "user", content: `Analyze this RFP:\n\n${rfpText}` }
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
      riskCount: validatedResult.riskIndicators.length
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
        attachmentsNeeded: []
      },
      riskIndicators: [{
        risk: "Analysis system failure - requires manual assessment",
        severity: "High",
        category: "Technical"
      }]
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
        content: `RFP Analysis: ${JSON.stringify(analysis, null, 2)}\n\nOriginal RFP:\n${rfpText}` 
      }
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
      requirementPriorities: [{
        requirement: "All requirements require manual prioritization",
        priority: "High",
        rationale: "Automatic analysis failed"
      }],
      funderSignals: [{
        signal: "Analysis system error",
        interpretation: "Manual document review required",
        confidence: 0.0
      }]
    };
  }
}

/**
 * Generate user collaboration checkpoint for strategic validation
 */
function createStrategicValidationCheckpoint(
  analysis: RfpAnalysisResult,
  insights: StrategicInsights
) {
  return {
    checkpointType: "strategic_validation",
    analysisResults: {
      industry: analysis.industry,
      complexity: analysis.complexity,
      timelinePressure: analysis.timelinePressure,
      keyRisks: analysis.riskIndicators.filter(r => r.severity === "High" || r.severity === "Critical")
    },
    strategicRecommendations: {
      topOpportunities: insights.keyOpportunities.slice(0, 3),
      criticalRequirements: insights.requirementPriorities.filter(r => r.priority === "Critical"),
      confidenceLevel: insights.funderSignals.reduce((avg, signal) => avg + signal.confidence, 0) / insights.funderSignals.length
    },
    userQuestions: [
      {
        id: `strategic_priorities_${Date.now()}`,
        question: "Based on this RFP analysis, which strategic priorities should we emphasize?",
        options: insights.keyOpportunities,
        multiSelect: true,
        context: `${analysis.industry} - ${analysis.complexity} complexity - ${analysis.timelinePressure} timeline pressure`,
        timestamp: new Date().toISOString()
      }
    ]
  };
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
      hasRfpDocument: !!state.rfpDocument?.raw
    });

    // Validate RFP document exists
    const rfpText = state.rfpDocument?.raw;
    if (!rfpText?.trim()) {
      logger.warn("No RFP document found");
      return {
        currentStep: "rfp_analysis_failed",
        errors: [...(state.errors || []), "No RFP document provided for analysis"],
        lastUpdatedAt: new Date().toISOString()
      };
    }

    // Perform RFP analysis
    const rfpAnalysis = await analyzeRfpDocument(rfpText);
    
    // Extract strategic insights
    const strategicInsights = await extractStrategicInsights(rfpText, rfpAnalysis);
    
    // Create user collaboration checkpoint
    const collaborationCheckpoint = createStrategicValidationCheckpoint(rfpAnalysis, strategicInsights);

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
          submissionRequirements: rfpAnalysis.submissionRequirements
        },
        earlyRiskAssessment: {
          riskIndicators: rfpAnalysis.riskIndicators,
          strategicInsights: strategicInsights,
          analysisConfidence: strategicInsights.funderSignals.reduce((avg, s) => avg + s.confidence, 0) / strategicInsights.funderSignals.length,
          requiresUserValidation: true
        }
      },
      userCollaboration: {
        ...state.userCollaboration,
        userQueries: [
          ...(state.userCollaboration?.userQueries || []),
          ...collaborationCheckpoint.userQuestions
        ],
        strategicRecommendations: collaborationCheckpoint.strategicRecommendations
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
        )
      ],
      lastUpdatedAt: new Date().toISOString()
    };

    logger.info("RFP analysis completed successfully", {
      industry: rfpAnalysis.industry,
      complexity: rfpAnalysis.complexity,
      riskCount: rfpAnalysis.riskIndicators.length,
      opportunityCount: strategicInsights.keyOpportunities.length
    });

    return updatedState;

  } catch (error) {
    logger.error("RFP analyzer node failed", { error });
    
    return {
      currentStep: "rfp_analysis_failed",
      errors: [
        ...(state.errors || []),
        `RFP analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`
      ],
      lastUpdatedAt: new Date().toISOString()
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
    query => !query.response
  );
  
  if (hasUnrespondedQueries) {
    return "strategic_validation_checkpoint";
  }

  // Analysis complete and validated - route based on complexity
  const complexity = state.planningIntelligence?.rfpCharacteristics?.complexity;
  const riskCount = state.planningIntelligence?.earlyRiskAssessment?.riskIndicators?.length || 0;
  
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
 */
export async function strategicValidationCheckpoint(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  
  const latestQuery = state.userCollaboration?.userQueries?.find(
    query => !query.response
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
      contentReference: "strategic_priorities"
    }
  });

  // This will be populated when user responds and graph resumes
  return {
    currentStep: "awaiting_strategic_validation",
    interruptStatus: {
      isInterrupted: true,
      interruptionPoint: "strategic_validation",
      feedback: null,
      processingStatus: null
    },
    lastUpdatedAt: new Date().toISOString()
  };
}

// the types need to have consistent camel case and match the new nodes as we build them out:
/**
 * Type definitions for the proposal generation system
 * Consistent JavaScript camelCase naming throughout
 */
import { BaseMessage } from "@langchain/core/messages";
import {
  LoadingStatus,
  ProcessingStatus,
  SectionType,
  FeedbackType,
  InterruptReason,
  InterruptProcessingStatus,
} from "./constants.js";

// Re-export constants with proper naming
export { LoadingStatus, ProcessingStatus, SectionType, FeedbackType, InterruptReason, InterruptProcessingStatus };

/**
 * Status type for sections - alias to ProcessingStatus for semantic clarity
 */
export type SectionProcessingStatus = ProcessingStatus;

/**
 * Interrupt-related interfaces for HITL capabilities
 */
export interface InterruptStatus {
  isInterrupted: boolean;
  interruptionPoint: string | null;
  feedback: {
    type: FeedbackType | null;
    content: string | null;
    timestamp: string | null;
  } | null;
  processingStatus: InterruptProcessingStatus | null;
}

export interface InterruptMetadata {
  reason: InterruptReason;
  nodeId: string;
  timestamp: string;
  contentReference?: string;
  evaluationResult?: any;
}

export interface UserFeedback {
  type: FeedbackType;
  comments?: string;
  specificEdits?: Record<string, any>;
  timestamp: string;
}

/**
 * Evaluation and quality assessment interfaces
 */
export interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: string;
  categories?: Record<string, {
    score: number;
    feedback: string;
  }>;
}

export interface SectionData {
  id: string;
  title?: string;
  content: string;
  status: SectionProcessingStatus;
  previousStatus?: SectionProcessingStatus;
  evaluation?: EvaluationResult | null;
  lastUpdated: string;
  lastError?: string;
}

export interface SectionToolInteraction {
  hasPendingToolCalls: boolean;
  messages: BaseMessage[];
  lastUpdated: string;
}

/**
 * Organization and participant interfaces
 */
export interface Funder {
  name?: string;
  description?: string;
  priorities?: string[];
}

export interface Applicant {
  name?: string;
  expertise?: string[];
  experience?: string;
}

export interface WordLength {
  min?: number;
  max?: number;
  target?: number;
}

/**
 * User interaction and intent interfaces
 */
export type UserCommand =
  | "regenerateSection"
  | "modifySection" 
  | "approveSection"
  | "askQuestion"
  | "loadDocument"
  | "help"
  | "other";

export interface UserIntent {
  command: UserCommand;
  targetSection?: string;
  requestDetails?: string;
}

/**
 * Enhanced Planning Intelligence interfaces with consistent naming
 */
export interface RfpCharacteristics {
  industry: string;
  specialization: string;
  complexity: "Simple" | "Medium" | "Complex";
  complexityFactors: string[];
  contractValueEstimate: string;
  timelinePressure: "Low" | "Medium" | "High";
  strategicFocus: string[];
  submissionRequirements: {
    pageLimit: number | "not_specified";
    sectionsRequired: string[];
    attachmentsNeeded: string[];
  };
}

export interface EarlyRiskAssessment {
  riskIndicators: Array<{
    risk: string;
    severity: "Low" | "Medium" | "High" | "Critical";
    category: "Technical" | "Compliance" | "Competitive" | "Timeline" | "Financial";
  }>;
  strategicInsights?: {
    keyOpportunities: string[];
    competitiveFactors: string[];
    requirementPriorities: Array<{
      requirement: string;
      priority: "Critical" | "High" | "Medium" | "Low";
      rationale: string;
    }>;
    funderSignals: Array<{
      signal: string;
      interpretation: string;
      confidence: number;
    }>;
  };
  analysisConfidence: number;
  requiresUserValidation: boolean;
}

export interface ResearchIntelligence {
  funderIntelligence: {
    organizationalPriorities: Array<{
      priority: string;
      evidence: string;
      userValidation: "confirmed" | "corrected" | "unknown";
      strategicImportance: "High" | "Medium" | "Low";
      confidence: number;
    }>;
    decisionMakers: Array<{
      name: string;
      title: string;
      background: string;
      userCorrections: string;
      influenceLevel: "High" | "Medium" | "Low";
      strategicNotes: string;
    }>;
    recentAwards: Array<{
      winner: string;
      project: string;
      awardDate: string;
      winningFactors: string[];
      lessonsLearned: string;
    }>;
    redFlags: Array<{
      flag: string;
      evidence: string;
      mitigationStrategy: string;
      severity: "Critical" | "High" | "Medium";
    }>;
    languagePreferences: {
      preferredTerminology: string[];
      organizationalTone: string;
      valuesEmphasis: string[];
    };
  };
  researchConfidence: number;
  additionalResearchRequested: {
    requested: boolean;
    focusAreas: string[];
    researchType: "deepDive" | "specialist";
    rationale: string;
  };
}

export interface IndustryInsights {
  mandatoryCompliance: Array<{
    requirement: string;
    regulationSource: string;
    complianceMethod: string;
    verificationNeeded: string;
    userNotes: string;
  }>;
  professionalQualifications: Array<{
    qualification: string;
    requiredFor: string;
    certificationBody: string;
    typicalCostTime: string;
  }>;
  technicalStandards: Array<{
    standard: string;
    application: string;
    performanceBenchmark: string;
    measurementMethod: string;
  }>;
  commonOversights: Array<{
    oversight: string;
    frequency: "Very Common" | "Common" | "Occasional";
    impact: "Elimination" | "Point Deduction" | "Competitive Disadvantage";
    preventionMethod: string;
    userExperience: string;
  }>;
  evaluationBenchmarks: {
    technicalCompetence: string;
    complianceDemonstration: string;
    qualityIndicators: string[];
  };
  industryConfidence: number;
}

export interface CompetitiveAnalysis {
  likelyCompetitors: Array<{
    name: string;
    probability: "High" | "Medium" | "Low";
    strengths: string[];
    weaknesses: string[];
    typicalPositioning: string;
    pastPerformanceWithFunder: string;
    userInsights: string;
  }>;
  marketPositioning: {
    positioningGaps: string[];
    differentiationOpportunities: string[];
    competitiveAdvantagesAvailable: string[];
  };
  pricingIntelligence: {
    typicalRange: string;
    pricingStrategies: string[];
    costFactors: string[];
    valuePositioningOpportunities: string[];
  };
  winningStrategies: Array<{
    strategy: string;
    successExamples: string;
    applicability: "High" | "Medium" | "Low";
  }>;
  competitiveThreats: Array<{
    threat: string;
    competitor: string;
    mitigation: string;
    urgency: "High" | "Medium" | "Low";
  }>;
  competitiveConfidence: number;
}

export interface RequirementMapping {
  explicitRequirements: Array<{
    requirement: string;
    sourceLocation: string;
    exactLanguage: string;
    category: "Technical" | "Administrative" | "Qualification" | "Performance";
    mandatoryLevel: "Mandatory" | "Optional" | "Preferred";
    complianceMethod: string;
    verificationNeeded: string;
  }>;
  implicitRequirements: Array<{
    requirement: string;
    sourceBasis: "Industry Standard" | "Funder Pattern" | "User Intelligence" | "Regulatory Compliance";
    rationale: string;
    recommendedApproach: string;
    riskIfMissed: "High" | "Medium" | "Low";
  }>;
  requirementPriorities: Array<{
    requirementId: string;
    priorityScore: number;
    priorityBasis: string;
    competitiveImportance: "Critical" | "Important" | "Standard";
  }>;
  requirementInterdependencies: Array<{
    primaryRequirement: string;
    dependentRequirements: string[];
    relationshipType: "Prerequisite" | "Supporting" | "Alternative";
  }>;
  complianceRoadmap: {
    criticalPathRequirements: string[];
    earlyActionItems: string[];
    documentationNeeded: string[];
  };
  analysisConfidence: number;
}

export interface EvaluationCriteria {
  evaluationStages: Array<{
    stage: string;
    purpose: string;
    timeline: string;
    criteria: string[];
    eliminationPotential: boolean;
  }>;
  realVsStatedWeighting: {
    statedWeights: Record<string, number>;
    predictedActualWeights: Record<string, number>;
    weightingRationale: Record<string, string>;
  };
  eliminationFactors: Array<{
    factor: string;
    stage: string;
    evidence: string;
    mitigation: string;
  }>;
  decisionProcess: {
    primaryEvaluators: string[];
    decisionMakers: string[];
    influenceFactors: string[];
    politicalConsiderations: string[];
  };
  scoringMethodology: {
    scoringApproach: string;
    evaluatorPriorities: string[];
    tieBreakingFactors: string[];
    commonPointDeductions: string[];
  };
  successFactors: Array<{
    factor: string;
    importance: "Critical" | "Important" | "Helpful";
    evidenceNeeded: string;
    competitiveAdvantagePotential: boolean;
  }>;
  predictionConfidence: number;
}

export interface StrategyDecision {
  selectedApproach: WorkflowType;
  alternativeApproaches: Array<{
    name: string;
    methodology: string;
    competitivePositioning: string;
    tradeOffs: string[];
    bestFor: string;
  }>;
  strategicFramework: {
    positioningStatement: string;
    valueProposition: string;
    primaryMessage: string;
    supportingMessages: string[];
    winThemes: string[];
  };
  proofPointStrategy: Array<{
    claim: string;
    evidence: string;
    source: string;
    competitiveAdvantage: string;
    strength: "Strong" | "Moderate" | "Adequate";
  }>;
  competitiveDifferentiation: {
    uniqueStrengths: string[];
    competitiveAdvantages: string[];
    marketPositioning: string;
    differentiationSustainability: string;
  };
  riskMitigation: Array<{
    concern: string;
    mitigationMessage: string;
    supportingEvidence: string;
    confidenceLevel: number;
  }>;
  messagingFramework: {
    keyTerminology: string[];
    toneAndStyle: string;
    emphasisAreas: string[];
    consistencyGuidelines: string[];
  };
  strategyConfidence: number;
}

export interface SolutionSpecification {
  realPriorities: Array<{
    priority: string;
    importanceWeight: number;
    evidenceBasis: string;
    requiredApproach: string;
  }>;
  optimalSolutionApproach: {
    methodology: string;
    keyComponents: string[];
    differentiatingFactors: string[];
    successMetrics: string[];
  };
  successCriteria: Array<{
    criterion: string;
    measurementMethod: string;
    targetPerformance: string;
    competitiveBenchmark: string;
  }>;
  riskFactors: Array<{
    risk: string;
    impact: "Elimination" | "Significant" | "Moderate";
    mitigationRequired: string;
    monitoringNeeded: boolean;
  }>;
  competitiveRequirements: {
    mustHaves: string[];
    differentiators: string[];
    tableStakes: string[];
  };
  solutionConfidence: number;
}

/**
 * Consolidated planning intelligence interface
 */
export interface PlanningIntelligence {
  rfpCharacteristics?: RfpCharacteristics;
  earlyRiskAssessment?: EarlyRiskAssessment;
  researchIntelligence?: ResearchIntelligence;
  industryAnalysis?: IndustryInsights;
  competitiveIntel?: CompetitiveAnalysis;
  requirementAnalysis?: RequirementMapping;
  evaluationPrediction?: EvaluationCriteria;
  strategicApproach?: StrategyDecision;
  solutionRequirements?: SolutionSpecification;
}

/**
 * User collaboration interfaces
 */
export interface UserQuery {
  id: string;
  question: string;
  options: string[];
  multiSelect?: boolean;
  context?: string;
  timestamp: string;
  response?: string;
  responseTimestamp?: string;
}

export interface ExpertiseContribution {
  id: string;
  type: "correction" | "addition" | "insight" | "preference";
  subject: string;
  content: string;
  timestamp: string;
  agentId: string;
  confidence: "High" | "Medium" | "Low";
}

export interface UserCollaboration {
  strategicPriorities?: string[];
  competitiveAdvantages?: string[];
  riskFactors?: string[];
  userQueries?: UserQuery[];
  expertiseContributions?: ExpertiseContribution[];
  feedbackHistory?: Record<string, any>;
  preferredApproach?: string;
  strategicRecommendations?: {
    topOpportunities: string[];
    criticalRequirements: Array<{
      requirement: string;
      priority: "Critical" | "High" | "Medium" | "Low";
      rationale: string;
    }>;
    confidenceLevel: number;
  };
}

/**
 * Workflow and processing interfaces
 */
export type WorkflowType = "accelerated" | "standard" | "comprehensive" | "custom";

export interface AdaptiveWorkflow {
  selectedApproach: WorkflowType;
  activeAgentSet: string[];
  complexityLevel: "simple" | "moderate" | "complex";
  skipReasons: Record<string, string>;
  currentPhase: "planning" | "writing" | "complete";
  phaseCompletionStatus: Record<string, boolean>;
  adaptationTriggers: Array<{
    trigger: string;
    reason: string;
    timestamp: string;
    actionTaken: string;
  }>;
}

/**
 * Document and section interfaces
 */
export interface RfpDocument {
  raw: string;
  parsed?: {
    sections: string[];
    requirements: string[];
    evaluationCriteria: string[];
  };
  metadata?: {
    title: string;
    organization: string;
    submissionDeadline: string;
    pageLimit: number;
    formatRequirements: string[];
  };
}

export interface ProposalSection {
  id: string;
  title: string;
  content: string;
  status: ProcessingStatus;
  requirements: string[];
  evidence: string[];
  wordCount: number;
  lastUpdated: string;
}

export interface SectionEvaluationResults {
  sectionId: string;
  score: number;
  feedback: string;
  requirementsCovered: string[];
  improvementSuggestions: string[];
  evaluatedAt: string;
}

/**
 * Main state interface for the proposal generation system
 */
export interface OverallProposalState {
  // Core identification and metadata
  userId: string;
  sessionId: string;
  proposalId: string;
  createdAt: string;
  updatedAt: string;

  // Document handling
  rfpDocument?: RfpDocument;
  rfpProcessingStatus?: ProcessingStatus;

  // Enhanced Planning Intelligence (replaces old research/solution/connections)
  planningIntelligence?: PlanningIntelligence;
  userCollaboration?: UserCollaboration;
  adaptiveWorkflow?: AdaptiveWorkflow;
  currentPhase?: "planning" | "writing" | "complete";

  // Section processing
  sections?: Record<string, ProposalSection>;
  sectionDiscoveryStatus?: ProcessingStatus;
  currentSectionBeingProcessed?: string;
  requiredSections?: SectionType[];

  // Section generation and evaluation
  evaluationStatus?: ProcessingStatus;
  evaluationResults?: SectionEvaluationResults;
  evaluationCriteria?: EvaluationCriteria;

  // Tool interaction tracking per section
  sectionToolMessages?: Record<string, SectionToolInteraction>;

  // Participant information
  funder?: Funder;
  applicant?: Applicant;
  wordLength?: WordLength;

  // HITL Interrupt handling
  interruptStatus?: InterruptStatus;
  interruptMetadata?: InterruptMetadata;
  userFeedback?: UserFeedback;

  // Workflow tracking
  currentStep?: string | null;
  activeThreadId?: string;

  // Communication and errors
  messages: BaseMessage[];
  errors?: string[];

  // Chat router fields
  intent?: UserIntent;

  // Metadata
  projectName?: string;
  lastUpdatedAt: string;

  // Overall status
  status?: ProcessingStatus;

  // Legacy fields for backward compatibility (will be removed)
  researchResults?: any;
  researchStatus?: ProcessingStatus;
  researchEvaluation?: EvaluationResult | null;
  solutionResults?: Record<string, any>;
  solutionStatus?: ProcessingStatus;
  solutionEvaluation?: EvaluationResult | null;
  connections?: any[];
  connectionsStatus?: ProcessingStatus;
  connectionsEvaluation?: EvaluationResult | null;
}

