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

/**
 * Status definitions for different components of the proposal state
 */
// These type exports maintain backward compatibility while we transition to enums
export { LoadingStatus, ProcessingStatus };

/**
 * Status type for sections - alias to ProcessingStatus for semantic clarity
 */
export type SectionProcessingStatus = ProcessingStatus;

/**
 * Interrupt-related type definitions for HITL capabilities
 */
export { InterruptReason, FeedbackType, SectionType };

/**
 * Data structure to track interrupt status
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

/**
 * Metadata about an interrupt event
 */
export interface InterruptMetadata {
  reason: InterruptReason;
  nodeId: string;
  timestamp: string;
  contentReference?: string; // Section ID or content type being evaluated
  evaluationResult?: any;
}

/**
 * Interface for user feedback structure
 */
export interface UserFeedback {
  type: FeedbackType;
  comments?: string;
  specificEdits?: Record<string, any>;
  timestamp: string;
}

/**
 * Section types enumeration for typed section references
 */
// Re-exported above in line 23

/**
 * Evaluation result structure for quality checks
 */
export interface EvaluationResult {
  score: number;
  passed: boolean;
  feedback: string;
  categories?: {
    [category: string]: {
      score: number;
      feedback: string;
    };
  };
}

/**
 * Structure for individual proposal sections
 */
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

/**
 * Interface for tracking tool calls and results per section
 */
export interface SectionToolInteraction {
  hasPendingToolCalls: boolean;
  messages: BaseMessage[];
  lastUpdated: string;
}

/**
 * Funder information type
 */
export interface Funder {
  name?: string;
  description?: string;
  priorities?: string[];
}

/**
 * Applicant information type
 */
export interface Applicant {
  name?: string;
  expertise?: string[];
  experience?: string;
}

/**
 * Word length constraints for sections
 */
export interface WordLength {
  min?: number;
  max?: number;
  target?: number;
}

/**
 * Add intent command enumeration type
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
    category:
      | "Technical"
      | "Compliance"
      | "Competitive"
      | "Timeline"
      | "Financial";
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
    sourceBasis:
      | "Industry Standard"
      | "Funder Pattern"
      | "User Intelligence"
      | "Regulatory Compliance";
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
  refinementIteration?: number;
  maxRefinements?: number;
  lastFeedbackProcessed?: {
    timestamp: string;
    sentiment: string;
    engagementLevel: string;
    confidence: number;
  };
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
export type WorkflowType =
  | "accelerated"
  | "standard"
  | "comprehensive"
  | "custom";

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

// Re-export InterruptProcessingStatus for use in other files
export { InterruptProcessingStatus };

// Add missing type definitions for proposal generation
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

export interface GenerationApproach {
  type: "standard" | "accelerated" | "comprehensive";
  description: string;
  estimatedTime: string;
  agentsInvolved: string[];
}

/**
 * Master Orchestrator specific types for workflow decision making
 */
export type ComplexityLevel = "simple" | "moderate" | "complex";

export type WorkflowApproach = "accelerated" | "standard" | "comprehensive";

export interface WorkflowDecision {
  approach: WorkflowApproach;
  rationale: string;
  agentsRequired: string[];
  riskFactors: string[];
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

  // Feedback processing state
  feedbackProcessing?: {
    lastProcessedFeedback?: any;
    processingTimestamp?: string;
    nextAction?: string;
    requiresLimitCheck?: boolean;
  };

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
