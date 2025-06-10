/**
 * Zod schemas for state validation in the proposal generation system
 */
import { z } from "zod";
import {
  SectionType,
  LoadingStatus,
  ProcessingStatus,
  InterruptReason,
  FeedbackType,
  InterruptProcessingStatus,
  ComplexityLevel,
  TimelinePressure,
  StrategicImportance,
  UserValidation,
  ConfidenceLevel,
  RiskLevel,
} from "./constants.js";

/**
 * Create a Zod schema for the feedback type
 */
export const feedbackTypeSchema = z.nativeEnum(FeedbackType);

/**
 * Define the Zod schema for InterruptStatus
 */
export const interruptStatusSchema = z.object({
  isInterrupted: z.boolean(),
  interruptionPoint: z.string().nullable(),
  feedback: z
    .object({
      type: feedbackTypeSchema.nullable(),
      content: z.string().nullable(),
      timestamp: z.string().nullable(),
    })
    .nullable(),
  processingStatus: z.nativeEnum(InterruptProcessingStatus).nullable(),
});

/**
 * Define the evaluation result schema
 */
export const evaluationResultSchema = z.object({
  score: z.number(),
  passed: z.boolean(),
  feedback: z.string(),
  categories: z
    .record(
      z.object({
        score: z.number(),
        feedback: z.string(),
      })
    )
    .optional(),
});

/**
 * Zod schema for user feedback
 */
export const userFeedbackSchema = z.object({
  type: feedbackTypeSchema,
  comments: z.string().optional(),
  specificEdits: z.record(z.any()).optional(),
  timestamp: z.string(),
});

/**
 * Schema for section tool interaction
 */
export const sectionToolInteractionSchema = z.object({
  hasPendingToolCalls: z.boolean(),
  messages: z.array(z.any()), // BaseMessage array
  lastUpdated: z.string(),
});

// RFP Characteristics schema
export const RFPCharacteristicsSchema = z.object({
  industry: z.string(),
  specialization: z.string(),
  complexity: z.nativeEnum(ComplexityLevel),
  complexityFactors: z.array(z.string()),
  contractValueEstimate: z.string(),
  timelinePressure: z.nativeEnum(TimelinePressure),
  strategicFocus: z.array(z.string()),
  submissionRequirements: z.object({
    pageLimit: z.union([z.number(), z.literal("not_specified")]),
    sectionsRequired: z.array(z.string()),
    attachmentsNeeded: z.array(z.string()),
  }),
});

// Research Results schema - Fixed to match TypeScript interface
export const ResearchResultsSchema = z.object({
  funderIntelligence: z.object({
    organizationalPriorities: z.array(
      z.object({
        priority: z.string(),
        evidence: z.string(),
        userValidation: z.nativeEnum(UserValidation),
        strategicImportance: z.nativeEnum(StrategicImportance),
        confidence: z.number(),
      })
    ),
    decisionMakers: z.array(
      z.object({
        name: z.string(),
        title: z.string(),
        background: z.string(),
        userCorrections: z.string(),
        influenceLevel: z.enum(["High", "Medium", "Low"]),
        strategicNotes: z.string(),
      })
    ),
    recentAwards: z.array(
      z.object({
        winner: z.string(),
        project: z.string(),
        awardDate: z.string(),
        winningFactors: z.array(z.string()),
        lessonsLearned: z.string(),
      })
    ),
    redFlags: z.array(
      z.object({
        flag: z.string(),
        evidence: z.string(),
        mitigationStrategy: z.string(),
        severity: z.enum(["Critical", "High", "Medium"]),
      })
    ),
    languagePreferences: z.object({
      preferredTerminology: z.array(z.string()),
      organizationalTone: z.string(),
      valuesEmphasis: z.array(z.string()),
    }),
  }),
  researchConfidence: z.number(),
  additionalResearchRequested: z.object({
    requested: z.boolean(),
    focusAreas: z.array(z.string()),
    researchType: z.enum(["deep_dive", "specialist"]),
    rationale: z.string(),
  }),
});

// Industry Analysis schema
export const IndustryAnalysisSchema = z.object({
  mandatoryCompliance: z.array(
    z.object({
      requirement: z.string(),
      regulationSource: z.string(),
      complianceMethod: z.string(),
      verificationNeeded: z.string(),
      userNotes: z.string(),
    })
  ),
  professionalQualifications: z.array(
    z.object({
      qualification: z.string(),
      requiredFor: z.string(),
      certificationBody: z.string(),
      typicalCostTime: z.string(),
    })
  ),
  technicalStandards: z.array(
    z.object({
      standard: z.string(),
      application: z.string(),
      performanceBenchmark: z.string(),
      measurementMethod: z.string(),
    })
  ),
  commonOversights: z.array(
    z.object({
      oversight: z.string(),
      frequency: z.enum(["Very Common", "Common", "Occasional"]),
      impact: z.enum([
        "Elimination",
        "Point Deduction",
        "Competitive Disadvantage",
      ]),
      preventionMethod: z.string(),
      userExperience: z.string(),
    })
  ),
  evaluationBenchmarks: z.object({
    technicalCompetence: z.string(),
    complianceDemonstration: z.string(),
    qualityIndicators: z.array(z.string()),
  }),
  industryConfidence: z.number(),
});

// Competitive Analysis schema
export const CompetitiveAnalysisSchema = z.object({
  likelyCompetitors: z.array(
    z.object({
      name: z.string(),
      probability: z.enum(["High", "Medium", "Low"]),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      typicalPositioning: z.string(),
      pastPerformanceWithFunder: z.string(),
      userInsights: z.string(),
    })
  ),
  marketPositioning: z.object({
    positioningGaps: z.array(z.string()),
    differentiationOpportunities: z.array(z.string()),
    competitiveAdvantagesAvailable: z.array(z.string()),
  }),
  pricingIntelligence: z.object({
    typicalRange: z.string(),
    pricingStrategies: z.array(z.string()),
    costFactors: z.array(z.string()),
    valuePositioningOpportunities: z.array(z.string()),
  }),
  winningStrategies: z.array(
    z.object({
      strategy: z.string(),
      successExamples: z.string(),
      applicability: z.enum(["High", "Medium", "Low"]),
    })
  ),
  competitiveThreats: z.array(
    z.object({
      threat: z.string(),
      competitor: z.string(),
      mitigation: z.string(),
      urgency: z.enum(["High", "Medium", "Low"]),
    })
  ),
  competitiveConfidence: z.number(),
});

// Requirement Analysis schema
export const RequirementAnalysisSchema = z.object({
  explicitRequirements: z.array(
    z.object({
      requirement: z.string(),
      sourceLocation: z.string(),
      exactLanguage: z.string(),
      category: z.enum([
        "Technical",
        "Administrative",
        "Qualification",
        "Performance",
      ]),
      mandatoryLevel: z.enum(["Mandatory", "Optional", "Preferred"]),
      complianceMethod: z.string(),
      verificationNeeded: z.string(),
    })
  ),
  implicitRequirements: z.array(
    z.object({
      requirement: z.string(),
      sourceBasis: z.enum([
        "Industry Standard",
        "Funder Pattern",
        "User Intelligence",
        "Regulatory Compliance",
      ]),
      rationale: z.string(),
      recommendedApproach: z.string(),
      riskIfMissed: z.enum(["High", "Medium", "Low"]),
    })
  ),
  requirementPriorities: z.array(
    z.object({
      requirementId: z.string(),
      priorityScore: z.number(),
      priorityBasis: z.string(),
      competitiveImportance: z.enum(["Critical", "Important", "Standard"]),
    })
  ),
  requirementInterdependencies: z.array(
    z.object({
      primaryRequirement: z.string(),
      dependentRequirements: z.array(z.string()),
      relationshipType: z.enum(["Prerequisite", "Supporting", "Alternative"]),
    })
  ),
  complianceRoadmap: z.object({
    criticalPathRequirements: z.array(z.string()),
    earlyActionItems: z.array(z.string()),
    documentationNeeded: z.array(z.string()),
  }),
  analysisConfidence: z.number(),
});

// Evaluation Criteria schema
export const EvaluationCriteriaSchema = z.object({
  evaluationStages: z.array(
    z.object({
      stage: z.string(),
      purpose: z.string(),
      timeline: z.string(),
      criteria: z.array(z.string()),
      eliminationPotential: z.boolean(),
    })
  ),
  realVsStatedWeighting: z.object({
    statedWeights: z.record(z.number()),
    predictedActualWeights: z.record(z.number()),
    weightingRationale: z.record(z.string()),
  }),
  eliminationFactors: z.array(
    z.object({
      factor: z.string(),
      stage: z.string(),
      evidence: z.string(),
      mitigation: z.string(),
    })
  ),
  decisionProcess: z.object({
    primaryEvaluators: z.array(z.string()),
    decisionMakers: z.array(z.string()),
    influenceFactors: z.array(z.string()),
    politicalConsiderations: z.array(z.string()),
  }),
  scoringMethodology: z.object({
    scoringApproach: z.string(),
    evaluatorPriorities: z.array(z.string()),
    tieBreakingFactors: z.array(z.string()),
    commonPointDeductions: z.array(z.string()),
  }),
  successFactors: z.array(
    z.object({
      factor: z.string(),
      importance: z.enum(["Critical", "Important", "Helpful"]),
      evidenceNeeded: z.string(),
      competitiveAdvantagePotential: z.boolean(),
    })
  ),
  predictionConfidence: z.number(),
});

// Strategy Decision schema
export const StrategyDecisionSchema = z.object({
  selectedApproach: z.enum([
    "standard",
    "accelerated",
    "comprehensive",
    "minimal",
  ]),
  alternativeApproaches: z.array(
    z.object({
      name: z.string(),
      methodology: z.string(),
      competitivePositioning: z.string(),
      tradeOffs: z.array(z.string()),
      bestFor: z.string(),
    })
  ),
  strategicFramework: z.object({
    positioningStatement: z.string(),
    valueProposition: z.string(),
    primaryMessage: z.string(),
    supportingMessages: z.array(z.string()),
    winThemes: z.array(z.string()),
  }),
  proofPointStrategy: z.array(
    z.object({
      claim: z.string(),
      evidence: z.string(),
      source: z.string(),
      competitiveAdvantage: z.string(),
      strength: z.enum(["Strong", "Moderate", "Adequate"]),
    })
  ),
  competitiveDifferentiation: z.object({
    uniqueStrengths: z.array(z.string()),
    competitiveAdvantages: z.array(z.string()),
    marketPositioning: z.string(),
    differentiationSustainability: z.string(),
  }),
  riskMitigation: z.array(
    z.object({
      concern: z.string(),
      mitigationMessage: z.string(),
      supportingEvidence: z.string(),
      confidenceLevel: z.number(),
    })
  ),
  messagingFramework: z.object({
    keyTerminology: z.array(z.string()),
    toneAndStyle: z.string(),
    emphasisAreas: z.array(z.string()),
    consistencyGuidelines: z.array(z.string()),
  }),
  strategyConfidence: z.number(),
});

// Solution Spec schema
export const SolutionSpecSchema = z.object({
  realPriorities: z.array(
    z.object({
      priority: z.string(),
      importanceWeight: z.number(),
      evidenceBasis: z.string(),
      requiredApproach: z.string(),
    })
  ),
  optimalSolutionApproach: z.object({
    methodology: z.string(),
    keyComponents: z.array(z.string()),
    differentiatingFactors: z.array(z.string()),
    successMetrics: z.array(z.string()),
  }),
  successCriteria: z.array(
    z.object({
      criterion: z.string(),
      measurementMethod: z.string(),
      targetPerformance: z.string(),
      competitiveBenchmark: z.string(),
    })
  ),
  riskFactors: z.array(
    z.object({
      risk: z.string(),
      impact: z.enum(["Elimination", "Significant", "Moderate"]),
      mitigationRequired: z.string(),
      monitoringNeeded: z.boolean(),
    })
  ),
  competitiveRequirements: z.object({
    mustHaves: z.array(z.string()),
    differentiators: z.array(z.string()),
    tableStakes: z.array(z.string()),
  }),
  solutionConfidence: z.number(),
});

// Full Planning Intelligence schema - Built from component schemas
export const PlanningIntelligenceSchema = z.object({
  rfpCharacteristics: RFPCharacteristicsSchema,
  researchIntelligence: ResearchResultsSchema,
  industryAnalysis: IndustryAnalysisSchema,
  competitiveIntel: CompetitiveAnalysisSchema,
  requirementAnalysis: RequirementAnalysisSchema,
  evaluationPrediction: EvaluationCriteriaSchema,
  strategicApproach: StrategyDecisionSchema,
  solutionRequirements: SolutionSpecSchema,
});

// User Collaboration schema
export const UserCollaborationSchema = z.object({
  strategicPriorities: z.array(z.string()),
  competitiveAdvantages: z.array(z.string()),
  riskFactors: z.array(z.string()),
  userQueries: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      options: z.array(z.string()),
      timestamp: z.string(),
      response: z.string().optional(),
      responseTimestamp: z.string().optional(),
    })
  ),
  expertiseContributions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(["correction", "addition", "insight", "preference"]),
      subject: z.string(),
      content: z.string(),
      timestamp: z.string(),
      agentId: z.string(),
      confidence: z.enum(["High", "Medium", "Low"]),
    })
  ),
  feedbackHistory: z.record(z.any()),
  preferredApproach: z.string().optional(),
});

// Adaptive Workflow schema
export const AdaptiveWorkflowSchema = z.object({
  selectedApproach: z.enum([
    "accelerated",
    "standard",
    "comprehensive",
    "custom",
  ]),
  activeAgentSet: z.array(z.string()),
  complexityLevel: z.enum(["simple", "moderate", "complex"]),
  skipReasons: z.record(z.string()),
  currentPhase: z.enum(["planning", "writing", "complete"]),
  phaseCompletionStatus: z.record(z.boolean()),
  adaptationTriggers: z.array(
    z.object({
      trigger: z.string(),
      reason: z.string(),
      timestamp: z.string(),
      actionTaken: z.string(),
    })
  ),
});

// Main State Schema - Complete and aligned with TypeScript interface
export const OverallProposalStateSchema = z.object({
  // Core identification and metadata
  userId: z.string(),
  sessionId: z.string(),
  proposalId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),

  // Document handling
  rfpDocument: z.object({
    raw: z.string(),
    parsed: z.object({
      sections: z.array(z.string()),
      requirements: z.array(z.string()),
      evaluationCriteria: z.array(z.string()),
    }),
    metadata: z.object({
      title: z.string(),
      organization: z.string(),
      submissionDeadline: z.string(),
      pageLimit: z.number(),
      formatRequirements: z.array(z.string()),
    }),
  }),
  rfpProcessingStatus: z.nativeEnum(ProcessingStatus),

  // Research phase
  researchResults: z
    .object({
      sectionId: z.string(),
      score: z.number(),
      feedback: z.string(),
      requirementsCovered: z.array(z.string()),
      improvementSuggestions: z.array(z.string()),
      evaluatedAt: z.string(),
    })
    .optional(),
  researchStatus: z.nativeEnum(ProcessingStatus),
  researchEvaluation: evaluationResultSchema.nullable().optional(),

  // Solution sought phase
  solutionResults: z.record(z.any()).optional(),
  solutionStatus: z.nativeEnum(ProcessingStatus),
  solutionEvaluation: evaluationResultSchema.nullable().optional(),

  // Connection pairs phase
  connections: z.array(z.any()).optional(),
  connectionsStatus: z.nativeEnum(ProcessingStatus),
  connectionsEvaluation: evaluationResultSchema.nullable().optional(),

  // Section processing - Fixed to use Record matching TypeScript interface
  sections: z.record(
    z.string(),
    z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      status: z.nativeEnum(ProcessingStatus),
      requirements: z.array(z.string()),
      evidence: z.array(z.string()),
      wordCount: z.number(),
      lastUpdated: z.string(),
    })
  ),

  sectionDiscoveryStatus: z.nativeEnum(ProcessingStatus),
  currentSectionBeingProcessed: z.string().optional(),

  // Section generation and evaluation
  evaluationStatus: z.nativeEnum(ProcessingStatus),
  evaluationResults: z
    .object({
      sectionId: z.string(),
      score: z.number(),
      feedback: z.string(),
      requirementsCovered: z.array(z.string()),
      improvementSuggestions: z.array(z.string()),
      evaluatedAt: z.string(),
    })
    .optional(),

  // Enhanced Planning Intelligence
  planningIntelligence: PlanningIntelligenceSchema.optional(),
  userCollaboration: UserCollaborationSchema.optional(),
  adaptiveWorkflow: AdaptiveWorkflowSchema.optional(),
  currentPhase: z.enum(["planning", "writing", "complete"]).optional(),

  // Proposal sections
  requiredSections: z.array(z.nativeEnum(SectionType)),
  sectionToolMessages: z
    .record(z.string(), sectionToolInteractionSchema)
    .optional(),

  // Fields for applicant and funder info
  funder: z
    .object({
      name: z.string().optional(),
      description: z.string().optional(),
      priorities: z.array(z.string()).optional(),
    })
    .optional(),

  applicant: z
    .object({
      name: z.string().optional(),
      expertise: z.array(z.string()).optional(),
      experience: z.string().optional(),
    })
    .optional(),

  wordLength: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      target: z.number().optional(),
    })
    .optional(),

  // HITL interrupt validation
  interruptStatus: interruptStatusSchema,
  interruptMetadata: z
    .object({
      reason: z.nativeEnum(InterruptReason),
      nodeId: z.string(),
      timestamp: z.string(),
      contentReference: z.string().optional(),
      evaluationResult: z.any().optional(),
    })
    .optional(),
  userFeedback: userFeedbackSchema.optional(),

  // Workflow tracking
  activeThreadId: z.string(),

  // Communication and errors
  messages: z.array(z.any()), // BaseMessage is complex to validate with Zod
  errors: z.array(z.string()),

  // Chat router fields
  intent: z
    .object({
      command: z.enum([
        "regenerate_section",
        "modify_section",
        "approve_section",
        "ask_question",
        "load_document",
        "help",
        "other",
      ]),
      targetSection: z.string().optional(),
      request_details: z.string().optional(),
    })
    .optional(),

  // Evaluation configuration
  evaluationCriteria: EvaluationCriteriaSchema.optional(),

  // Metadata
  projectName: z.string().optional(),
  lastUpdatedAt: z.string(),

  // Status for the overall proposal generation process
  status: z.nativeEnum(ProcessingStatus),
});
