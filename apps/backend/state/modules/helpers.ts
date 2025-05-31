import {
  PlanningIntelligence,
  UserCollaboration,
  AdaptiveWorkflow,
  RFPCharacteristics,
  ResearchResults,
  UserQuery,
  ExpertiseContribution,
} from "./types.js";
import {
  ComplexityLevel,
  TimelinePressure,
  ProposalApproach,
  PHASES,
  COMPLEXITY_LEVELS,
  PHASE_STATUSES,
} from "./constants.js";

/**
 * Creates an initial planning intelligence structure with minimal data
 */
export function createInitialPlanningIntelligence(): Partial<PlanningIntelligence> {
  return {
    rfpCharacteristics: createInitialRFPCharacteristics(),
    researchIntelligence: createInitialResearchResults(),
    industryAnalysis: {
      mandatoryCompliance: [],
      professionalQualifications: [],
      technicalStandards: [],
      commonOversights: [],
      evaluationBenchmarks: {
        technicalCompetence: "",
        complianceDemonstration: "",
        qualityIndicators: [],
      },
      industryConfidence: 0,
    },
    competitiveIntel: {
      likelyCompetitors: [],
      marketPositioning: {
        positioningGaps: [],
        differentiationOpportunities: [],
        competitiveAdvantagesAvailable: [],
      },
      pricingIntelligence: {
        typicalRange: "",
        pricingStrategies: [],
        costFactors: [],
        valuePositioningOpportunities: [],
      },
      winningStrategies: [],
      competitiveThreats: [],
      competitiveConfidence: 0,
    },
    requirementAnalysis: {
      explicitRequirements: [],
      implicitRequirements: [],
      requirementPriorities: [],
      requirementInterdependencies: [],
      complianceRoadmap: {
        criticalPathRequirements: [],
        earlyActionItems: [],
        documentationNeeded: [],
      },
      analysisConfidence: 0,
    },
    evaluationPrediction: {
      evaluationStages: [],
      realVsStatedWeighting: {
        statedWeights: {},
        predictedActualWeights: {},
        weightingRationale: {},
      },
      eliminationFactors: [],
      decisionProcess: {
        primaryEvaluators: [],
        decisionMakers: [],
        influenceFactors: [],
        politicalConsiderations: [],
      },
      scoringMethodology: {
        scoringApproach: "",
        evaluatorPriorities: [],
        tieBreakingFactors: [],
        commonPointDeductions: [],
      },
      successFactors: [],
      predictionConfidence: 0,
    },
    strategicApproach: {
      selectedApproach: "standard",
      alternativeApproaches: [],
      strategicFramework: {
        positioningStatement: "",
        valueProposition: "",
        primaryMessage: "",
        supportingMessages: [],
        winThemes: [],
      },
      proofPointStrategy: [],
      competitiveDifferentiation: {
        uniqueStrengths: [],
        competitiveAdvantages: [],
        marketPositioning: "",
        differentiationSustainability: "",
      },
      riskMitigation: [],
      messagingFramework: {
        keyTerminology: [],
        toneAndStyle: "",
        emphasisAreas: [],
        consistencyGuidelines: [],
      },
      strategyConfidence: 0,
    },
    solutionRequirements: {
      realPriorities: [],
      optimalSolutionApproach: {
        methodology: "",
        keyComponents: [],
        differentiatingFactors: [],
        successMetrics: [],
      },
      successCriteria: [],
      riskFactors: [],
      competitiveRequirements: {
        mustHaves: [],
        differentiators: [],
        tableStakes: [],
      },
      solutionConfidence: 0,
    },
  };
}

/**
 * Creates an initial RFP characteristics structure with default values
 */
export function createInitialRFPCharacteristics(): RFPCharacteristics {
  return {
    industry: "",
    specialization: "",
    complexity: ComplexityLevel.MEDIUM,
    complexityFactors: [],
    contractValueEstimate: "",
    timelinePressure: TimelinePressure.MEDIUM,
    strategicFocus: [],
    submissionRequirements: {
      pageLimit: "not_specified",
      sectionsRequired: [],
      attachmentsNeeded: [],
    },
  };
}

/**
 * Creates an initial research results structure with default values
 */
export function createInitialResearchResults(): ResearchResults {
  return {
    funderIntelligence: {
      organizationalPriorities: [],
      decisionMakers: [],
      recentAwards: [],
      redFlags: [],
      languagePreferences: {
        preferredTerminology: [],
        organizationalTone: "",
        valuesEmphasis: [],
      },
    },
    researchConfidence: 0,
    additionalResearchRequested: {
      requested: false,
      focusAreas: [],
      researchType: "deep_dive",
      rationale: "",
    },
  };
}

/**
 * Creates initial user collaboration structure
 */
export function createInitialUserCollaboration(): UserCollaboration {
  return {
    strategicPriorities: [],
    competitiveAdvantages: [],
    riskFactors: [],
    userQueries: [],
    expertiseContributions: [],
    feedbackHistory: {},
    preferredApproach: undefined,
  };
}

/**
 * Creates initial adaptive workflow structure
 */
export function createInitialAdaptiveWorkflow(): AdaptiveWorkflow {
  return {
    selectedApproach: "standard",
    activeAgentSet: [],
    complexityLevel: "moderate",
    skipReasons: {},
    currentPhase: "planning",
    phaseCompletionStatus: {},
    adaptationTriggers: [],
  };
}

/**
 * Adds a user query to the collaboration state
 */
export function addUserQuery(
  collaboration: UserCollaboration,
  question: string,
  options: string[]
): UserCollaboration {
  const newQuery: UserQuery = {
    id: `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    question,
    options,
    timestamp: new Date().toISOString(),
  };

  return {
    ...collaboration,
    userQueries: [...collaboration.userQueries, newQuery],
  };
}

/**
 * Adds an expertise contribution to the collaboration state
 */
export function addExpertiseContribution(
  collaboration: UserCollaboration,
  type: "correction" | "addition" | "insight" | "preference",
  subject: string,
  content: string,
  confidence: "High" | "Medium" | "Low",
  agentId: string
): UserCollaboration {
  const newContribution: ExpertiseContribution = {
    id: `contrib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    subject,
    content,
    timestamp: new Date().toISOString(),
    agentId,
    confidence,
  };

  return {
    ...collaboration,
    expertiseContributions: [
      ...collaboration.expertiseContributions,
      newContribution,
    ],
  };
}

/**
 * Updates phase status in adaptive workflow
 */
export function updatePhaseStatus(
  workflow: AdaptiveWorkflow,
  phase: string,
  completed: boolean
): AdaptiveWorkflow {
  return {
    ...workflow,
    phaseCompletionStatus: {
      ...workflow.phaseCompletionStatus,
      [phase]: completed,
    },
  };
}

/**
 * Adds an adaptation trigger to the workflow
 */
export function addAdaptationTrigger(
  workflow: AdaptiveWorkflow,
  trigger: string,
  reason: string,
  actionTaken: string
): AdaptiveWorkflow {
  const newTrigger = {
    trigger,
    reason,
    timestamp: new Date().toISOString(),
    actionTaken,
  };

  return {
    ...workflow,
    adaptationTriggers: [...workflow.adaptationTriggers, newTrigger],
  };
}
