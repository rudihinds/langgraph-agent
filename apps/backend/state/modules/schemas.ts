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
  ProposalApproach,
  AgentRole,
  PHASE_STATUSES,
  PHASES,
  COMPLEXITY_LEVELS,
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

/**
 * Schema for section data validation
 */
export const sectionDataSchema = z.object({
  id: z.nativeEnum(SectionType),
  title: z.string().optional(),
  content: z.string(),
  status: z.nativeEnum(ProcessingStatus),
  evaluation: evaluationResultSchema.nullable().optional(),
  lastUpdated: z.string(),
});

/**
 * Schema for RFP document validation
 */
export const rfpDocumentSchema = z.object({
  id: z.string(),
  fileName: z.string().optional(),
  text: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  status: z.nativeEnum(LoadingStatus),
});

/**
 * Main Zod schema for validation of proposal state
 */
export const OverallProposalStateSchema = z.object({
  rfpDocument: rfpDocumentSchema,
  researchResults: z.record(z.any()).optional(),
  researchStatus: z.nativeEnum(ProcessingStatus),
  researchEvaluation: evaluationResultSchema.nullable().optional(),
  solutionResults: z.record(z.any()).optional(),
  solutionStatus: z.nativeEnum(ProcessingStatus),
  solutionEvaluation: evaluationResultSchema.nullable().optional(),
  connections: z.array(z.any()).optional(),
  connectionsStatus: z.nativeEnum(ProcessingStatus),
  connectionsEvaluation: evaluationResultSchema.nullable().optional(),

  // We use a custom validation for the Map type since Zod doesn't have direct Map support
  sections: z
    .custom<Map<SectionType, any>>(
      (val) => val instanceof Map,
      "Sections must be a Map object."
    )
    .refine(
      (map) => {
        // Validate each entry in the map
        for (const [key, value] of map.entries()) {
          // 1. Validate Key: Check if the key is a valid SectionType enum value
          if (!Object.values(SectionType).includes(key as SectionType)) {
            return false; // Invalid key
          }

          // 2. Validate Value: Check if the value conforms to SectionData structure
          if (
            !value ||
            typeof value.id !== "string" ||
            value.id !== key || // Ensure section id matches the map key
            typeof value.content !== "string" ||
            typeof value.status !== "string" || // Basic check for status string
            typeof value.lastUpdated !== "string" ||
            (value.evaluation !== undefined &&
              value.evaluation !== null &&
              typeof value.evaluation.score !== "number") // Basic check for evaluation
          ) {
            return false; // Invalid value structure
          }
        }
        return true; // All entries are valid
      },
      {
        message:
          "Sections Map contains invalid keys (must be SectionType) or values (must conform to SectionData).",
      }
    ),
  requiredSections: z.array(z.nativeEnum(SectionType)),

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

  // Tool message tracking per section
  sectionToolMessages: z
    .record(z.string(), sectionToolInteractionSchema)
    .optional(),

  // Metadata fields for proposal sections
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

  currentStep: z.string().nullable(),
  activeThreadId: z.string(),
  messages: z.array(z.any()), // BaseMessage is complex to validate with Zod
  errors: z.array(z.string()),
  projectName: z.string().optional(),
  userId: z.string().optional(),
  createdAt: z.string(),
  lastUpdatedAt: z.string(),
  status: z.nativeEnum(ProcessingStatus),
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

// Research Results schema
export const ResearchResultsSchema = z.object({
  funderIntelligence: z.object({
    organizationalPriorities: z.array(
      z.object({
        priority: z.string(),
        evidence: z.string(),
        userValidation: z.nativeEnum(UserValidation),
        strategicImportance: z.nativeEnum(StrategicImportance),
      })
    ),
    pastAwardPatterns: z.array(
      z.object({
        pattern: z.string(),
        evidence: z.string(),
        confidenceLevel: z.nativeEnum(ConfidenceLevel),
      })
    ),
    evaluationCriteria: z.array(
      z.object({
        criterion: z.string(),
        weight: z.number(),
        evaluationFocus: z.string(),
      })
    ),
  }),
  marketAnalysis: z.object({
    marketTrends: z.array(z.string()),
    competitiveLandscape: z.array(z.string()),
    opportunityAreas: z.array(z.string()),
  }),
  techRequirements: z.object({
    coreRequirements: z.array(z.string()),
    preferredSolutions: z.array(z.string()),
    constraints: z.array(z.string()),
  }),
});

// Strategy Planning schema
export const StrategyPlanningSchema = z.object({
  differentiationStrategy: z.array(
    z.object({
      approach: z.string(),
      rationale: z.string(),
      riskAssessment: z.nativeEnum(RiskLevel),
    })
  ),
  valueProposition: z.object({
    coreValue: z.string(),
    supportingEvidence: z.array(z.string()),
    competitiveAdvantage: z.string(),
  }),
  riskMitigation: z.array(
    z.object({
      risk: z.string(),
      mitigation: z.string(),
      priority: z.nativeEnum(StrategicImportance),
    })
  ),
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
  preferredApproach: z.nativeEnum(ProposalApproach).optional(),
});

// Adaptive Workflow schema
export const AdaptiveWorkflowSchema = z.object({
  selectedApproach: z.nativeEnum(ProposalApproach),
  activeAgentSet: z.array(z.nativeEnum(AgentRole)),
  complexityLevel: z.enum([
    COMPLEXITY_LEVELS.MINIMAL,
    COMPLEXITY_LEVELS.MODERATE,
    COMPLEXITY_LEVELS.COMPREHENSIVE,
  ]),
  skipReasons: z.record(z.string()),
  currentPhase: z.enum([PHASES.PLANNING, PHASES.WRITING, PHASES.COMPLETE]),
  phaseCompletionStatus: z.record(
    z.enum([
      PHASE_STATUSES.NOT_STARTED,
      PHASE_STATUSES.IN_PROGRESS,
      PHASE_STATUSES.COMPLETED,
      PHASE_STATUSES.SKIPPED,
    ])
  ),
  adaptationTriggers: z.array(
    z.object({
      trigger: z.string(),
      reason: z.string(),
      timestamp: z.string(),
      actionTaken: z.string(),
    })
  ),
});

// Full Planning Intelligence schema
export const PlanningIntelligenceSchema = z.object({
  rfpCharacteristics: RFPCharacteristicsSchema,
  researchIntelligence: ResearchResultsSchema,
  industryAnalysis: z.object({
    industryTrends: z.array(z.string()),
    marketDynamics: z.array(z.string()),
    competitiveFactors: z.array(z.string()),
  }),
  competitiveIntel: z.object({
    competitors: z.array(
      z.object({
        name: z.string(),
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
        winProbability: z.nativeEnum(ConfidenceLevel),
      })
    ),
    marketPosition: z.string(),
    differentiationOpportunities: z.array(z.string()),
  }),
  requirementAnalysis: z.object({
    technicalRequirements: z.array(z.string()),
    businessRequirements: z.array(z.string()),
    complianceRequirements: z.array(z.string()),
    evaluationCriteria: z.array(z.string()),
  }),
  evaluationPrediction: z.object({
    scoringModel: z.record(z.number()),
    winProbability: z.number(),
    riskFactors: z.array(z.string()),
    mitigationStrategies: z.array(z.string()),
  }),
  strategicApproach: StrategyPlanningSchema,
  solutionRequirements: z.object({
    coreComponents: z.array(z.string()),
    integrationPoints: z.array(z.string()),
    deliverables: z.array(z.string()),
    timeline: z.record(z.string()),
  }),
});
