/**
 * LangGraph state annotations for the proposal generation system
 */
import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import {
  OverallProposalState,
  InterruptStatus,
  SectionType,
  SectionData,
  InterruptMetadata,
  UserFeedback,
  ProcessingStatus,
  LoadingStatus,
  EvaluationResult,
} from "./types.js";
import {
  sectionsReducer,
  errorsReducer,
  lastValueReducer,
  lastValueWinsReducerStrict,
  createdAtReducer,
  lastUpdatedAtReducer,
  interruptStatusReducer,
} from "./reducers.js";

/**
 * State annotations for proposal generation, defining default values and reducers
 * Using the newer Annotation.Root pattern for improved type safety and consistency
 */
export const OverallProposalStateAnnotation = Annotation.Root({
  // Document handling
  rfpDocument: Annotation<{
    id: string;
    fileName?: string;
    text?: string;
    metadata?: Record<string, any>;
    status: LoadingStatus;
  }>({
    default: () => ({
      id: "",
      status: "not_started" as LoadingStatus,
    }),
    value: (existing, newValue) => ({ ...existing, ...newValue }),
  }),

  // RFP processing status
  rfpProcessingStatus: Annotation<ProcessingStatus>({
    default: () => ProcessingStatus.QUEUED,
    value: lastValueWinsReducerStrict,
  }),

  // Feedback intent for RFP analysis routing
  feedbackIntent: Annotation<"approve" | "refine" | "reject" | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Research phase
  researchResults: Annotation<Record<string, any> | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),
  researchStatus: Annotation<ProcessingStatus>({
    default: () => ProcessingStatus.QUEUED,
    value: lastValueWinsReducerStrict,
  }),
  researchEvaluation: Annotation<EvaluationResult | null | undefined>({
    default: () => undefined,
    value: lastValueReducer,
  }),

  // Solution sought phase
  solutionResults: Annotation<Record<string, any> | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),
  solutionStatus: Annotation<ProcessingStatus>({
    default: () => ProcessingStatus.QUEUED,
    value: lastValueWinsReducerStrict,
  }),
  solutionEvaluation: Annotation<EvaluationResult | null | undefined>({
    default: () => undefined,
    value: lastValueReducer,
  }),

  // Connection pairs phase
  connections: Annotation<any[] | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),
  connectionsStatus: Annotation<ProcessingStatus>({
    default: () => ProcessingStatus.QUEUED,
    value: lastValueWinsReducerStrict,
  }),
  connectionsEvaluation: Annotation<EvaluationResult | null | undefined>({
    default: () => undefined,
    value: lastValueReducer,
  }),

  // Proposal sections
  sections: Annotation<Map<SectionType, SectionData>>({
    default: () => new Map(),
    value: sectionsReducer,
  }),
  requiredSections: Annotation<SectionType[]>({
    default: () => [],
    value: (existing, newValue) => newValue ?? existing,
  }),

  // HITL Interrupt handling
  interruptStatus: Annotation<InterruptStatus>({
    default: () => ({
      isInterrupted: false,
      interruptionPoint: null,
      feedback: null,
      processingStatus: null,
    }),
    value: interruptStatusReducer,
  }),
  interruptMetadata: Annotation<InterruptMetadata | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),
  userFeedback: Annotation<UserFeedback | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Workflow tracking
  activeThreadId: Annotation<string>({
    // No default as this is required at creation time
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Communication and errors
  messages: Annotation<BaseMessage[]>({
    default: () => [],
    reducer: messagesStateReducer,
  }),
  errors: Annotation<string[]>({
    default: () => [],
    value: errorsReducer,
  }),

  // Intent parsed from chat interactions
  intent: Annotation<OverallProposalState["intent"] | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Metadata
  projectName: Annotation<string | undefined>({
    default: () => undefined,
    value: lastValueReducer,
  }),
  userId: Annotation<string | undefined>({
    default: () => undefined,
    value: lastValueReducer,
  }),
  
  // Company and industry information extracted from RFP
  company: Annotation<string>({
    default: () => "",
    value: lastValueReducer,
  }),
  industry: Annotation<string>({
    default: () => "",
    value: lastValueReducer,
  }),
  createdAt: Annotation<string>({
    default: () => new Date().toISOString(),
    value: createdAtReducer,
  }),
  lastUpdatedAt: Annotation<string>({
    default: () => new Date().toISOString(),
    value: lastUpdatedAtReducer,
  }),

  // Status for the overall proposal generation process
  status: Annotation<ProcessingStatus>({
    default: () => ProcessingStatus.QUEUED,
    value: lastValueWinsReducerStrict,
  }),

  // ===== STATUS COMMUNICATION FIELDS (for RFP auto-analysis flow) =====

  // Current status message for UI display
  currentStatus: Annotation<string>({
    reducer: (left, right) => right ?? left ?? "Ready",
    default: () => "Ready",
  }),

  // Boolean flag for RFP analysis state
  isAnalyzingRfp: Annotation<boolean>({
    reducer: (left, right) => right ?? left ?? false,
    default: () => false,
  }),

  // Metadata for RFP context and auto-start information (not message content)
  metadata: Annotation<{
    rfpId?: string;
    autoStarted?: boolean;
    [key: string]: any;
  }>({
    reducer: (left, right) => ({ ...left, ...right }),
    default: () => ({}),
  }),

  // ===== PLANNING PHASE FIELDS (from planning-agents.md specification) =====

  // Enhanced research intelligence
  funder_intelligence: Annotation<
    | {
        organizational_priorities: Array<{
          priority: string;
          evidence: string;
          user_validation: "confirmed" | "corrected" | "unknown";
          strategic_importance: "High" | "Medium" | "Low";
          confidence: number;
        }>;
        decision_makers: Array<{
          name: string;
          title: string;
          background: string;
          user_corrections: string;
          influence_level: "High" | "Medium" | "Low";
          strategic_notes: string;
        }>;
        recent_awards: Array<{
          winner: string;
          project: string;
          award_date: string;
          winning_factors: string[];
          lessons_learned: string;
        }>;
        red_flags: Array<{
          flag: string;
          evidence: string;
          mitigation_strategy: string;
          severity: "Critical" | "High" | "Medium";
        }>;
        language_preferences: {
          preferred_terminology: string[];
          organizational_tone: string;
          values_emphasis: string[];
        };
      }
    | undefined
  >({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Research flow control
  additional_research_requested: Annotation<{
    requested: boolean;
    focus_areas: string[];
    research_type: "deep_dive" | "specialist";
    rationale: string;
  }>({
    default: () => ({
      requested: false,
      focus_areas: [],
      research_type: "deep_dive" as const,
      rationale: "",
    }),
    value: (existing, newValue) => ({ ...existing, ...newValue }),
  }),

  reassessment_requested: Annotation<{
    requested: boolean;
    reason: string;
    new_complexity_assessment: string;
  }>({
    default: () => ({
      requested: false,
      reason: "",
      new_complexity_assessment: "",
    }),
    value: (existing, newValue) => ({ ...existing, ...newValue }),
  }),

  research_confidence: Annotation<number>({
    default: () => 0,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Research iterations tracking
  research_iterations: Annotation<number>({
    default: () => 0,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // ===== PLANNING INTELLIGENCE FIELDS (for RFP analysis) =====

  // Enhanced planning intelligence structure
  planningIntelligence: Annotation<
    OverallProposalState["planningIntelligence"]
  >({
    default: () => undefined,
    value: (existing, newValue) =>
      newValue ? { ...existing, ...newValue } : existing,
  }),

  // User collaboration tracking
  userCollaboration: Annotation<OverallProposalState["userCollaboration"]>({
    default: () => undefined,
    value: (existing, newValue) =>
      newValue ? { ...existing, ...newValue } : existing,
  }),

  // Current phase tracking
  currentPhase: Annotation<"planning" | "writing" | "complete" | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // ===== RFP DOCUMENT ENHANCEMENTS =====
  // (rfpProcessingStatus already defined above)

  // ===== MULTI-AGENT RFP ANALYSIS FIELDS =====

  // Analysis metadata
  rfpAnalysisId: Annotation<string | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  documentMetadata: Annotation<
    | {
        wordCount: number;
        sectionCount: number;
        complexity: "Simple" | "Medium" | "Complex";
      }
    | undefined
  >({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Individual agent analysis results
  linguisticAnalysis: Annotation<Record<string, any> | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  requirementsAnalysis: Annotation<Record<string, any> | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  structureAnalysis: Annotation<Record<string, any> | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  strategicAnalysis: Annotation<Record<string, any> | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Synthesis analysis result
  synthesisAnalysis: Annotation<Record<string, any> | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Human review data for RFP analysis
  rfpHumanReview: Annotation<
    | {
        action: "approve" | "modify" | "reject";
        feedback?: string;
        timestamp: string;
      }
    | undefined
  >({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Final RFP analysis output
  rfpAnalysisOutput: Annotation<Record<string, any> | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // RFP Analysis completion tracking
  rfpAnalysisCompletion: Annotation<{
    linguistic: boolean;
    requirements: boolean;
    structure: boolean;
    strategic: boolean;
  }>({
    default: () => ({
      linguistic: false,
      requirements: false,
      structure: false,
      strategic: false,
    }),
    value: (existing, newValue) => ({ ...existing, ...newValue }),
  }),

  // RFP Analysis failure tracking
  rfpAnalysisFailures: Annotation<string[]>({
    default: () => [],
    value: (existing, newValue) => [...(existing || []), ...(newValue || [])],
  }),

  // RFP Analysis retry tracking
  rfpAnalysisRetryCount: Annotation<number>({
    default: () => 0,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Agents to retry (if any failed)
  rfpAnalysisRetryAgents: Annotation<string[]>({
    default: () => [],
    value: (existing, newValue) => newValue ?? existing,
  }),

  // ===== INTELLIGENCE GATHERING FIELDS =====

  // Intelligence briefing result
  intelligenceBriefing: Annotation<
    OverallProposalState["intelligenceBriefing"]
  >({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Intelligence synthesis - human readable executive briefing
  intelligenceSynthesis: Annotation<string | undefined>({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // Intelligence gathering processing status
  intelligenceGatheringStatus: Annotation<ProcessingStatus>({
    default: () => ProcessingStatus.QUEUED,
    value: lastValueWinsReducerStrict,
  }),
  
  // Track search queries without bloating messages
  searchQueries: Annotation<string[]>({
    default: () => [],
    value: (existing, newValue) => [...(existing || []), ...(newValue || [])]
  }),

  // Store search results separately from messages
  searchResults: Annotation<Array<{
    query: string;
    results: any[];
    answer: string | null;
    timestamp: string;
  }>>({
    default: () => [],
    value: (existing, newValue) => [...(existing || []), ...(newValue || [])]
  }),

  // Track research topics dynamically
  researchTopics: Annotation<{
    needed: string[];
    covered: string[];
  }>({
    default: () => ({ needed: [], covered: [] }),
    value: (existing, newValue) => ({ ...existing, ...newValue })
  }),

  // Track search attempts for adaptive retry logic
  searchAttempts: Annotation<Array<{
    query: string;
    strategy: "standard" | "discovery" | "expanded" | "refined" | "alternative" | "source_specific" | "temporal_extended" | "inferential" | "individual";
    topic: string;
    attemptNumber: number;
    resultQuality: {
      overall: number;
      resultCount: number;
      relevance: number;
      sourceCredibility: number;
      completeness: number;
    };
    timestamp: string;
    error?: string;
  }>>({
    default: () => [],
    value: (existing, newValue) => [...(existing || []), ...(newValue || [])]
  }),

  // Track adaptive research configuration
  adaptiveResearchConfig: Annotation<{
    topics: Array<{
      topic: string;
      priority: "critical" | "high" | "medium" | "low";
      minimumQualityThreshold: number;
      preferredStrategies: string[];
      maxAttempts: number;
      fallbackApproach?: string;
    }>;
    qualityThresholds: {
      minimum: number;
      preferred: number;
    };
  }>({
    default: () => ({
      topics: [],
      qualityThresholds: {
        minimum: 0.3,
        preferred: 0.6
      }
    }),
    value: (existing, newValue) => ({ ...existing, ...newValue })
  }),

  // Track URLs that have been extracted to avoid duplicates
  extractedUrls: Annotation<string[]>({
    default: () => [],
    value: (existing, newValue) => [...new Set([...(existing || []), ...(newValue || [])])]
  }),

  // Track extracted entities for deep-dive searches
  extractedEntities: Annotation<Array<{
    name: string;
    type: "person" | "organization" | "product";
    title?: string;
    topic: string;
    sourceUrl: string;
    searched?: boolean;
  }>>({
    default: () => [],
    value: (existing, newValue) => [...(existing || []), ...(newValue || [])]
  }),

  // Human review data for intelligence gathering
  intelligenceHumanReview: Annotation<
    | {
        action:
          | "approve"
          | "modify"
          | "reject"
          | "ask_question"
          | "research_other_targets";
        feedback?: string;
        timestamp: string;
      }
    | undefined
  >({
    default: () => undefined,
    value: (existing, newValue) => newValue ?? existing,
  }),

  // ===== PARALLEL INTELLIGENCE GATHERING FIELDS =====

  // Parallel intelligence state tracking
  parallelIntelligenceState: Annotation<{
    strategicInitiatives: {
      status: "pending" | "running" | "complete" | "error";
      quality?: number;
      errorMessage?: string;
    };
    vendorRelationships: {
      status: "pending" | "running" | "complete" | "error";
      quality?: number;
      errorMessage?: string;
    };
    procurementPatterns: {
      status: "pending" | "running" | "complete" | "error";
      quality?: number;
      errorMessage?: string;
    };
    decisionMakers: {
      status: "pending" | "running" | "complete" | "error";
      quality?: number;
      errorMessage?: string;
    };
  } | undefined>({
    default: () => undefined,
    value: (existing, newValue) => ({ ...existing, ...newValue })
  }),

  // Individual topic research states
  strategicInitiativesResearch: Annotation<{
    searchQueries: string[];
    searchResults: any[];
    extractedUrls: string[];
    extractedEntities: any[];
    insights?: any[];
    complete?: boolean;
  } | undefined>({
    default: () => undefined,
    value: (existing, newValue) => ({ ...existing, ...newValue })
  }),

  vendorRelationshipsResearch: Annotation<{
    searchQueries: string[];
    searchResults: any[];
    extractedUrls: string[];
    extractedEntities: any[];
    insights?: any[];
    complete?: boolean;
  } | undefined>({
    default: () => undefined,
    value: (existing, newValue) => ({ ...existing, ...newValue })
  }),

  procurementPatternsResearch: Annotation<{
    searchQueries: string[];
    searchResults: any[];
    extractedUrls: string[];
    extractedEntities: any[];
    insights?: any[];
    complete?: boolean;
  } | undefined>({
    default: () => undefined,
    value: (existing, newValue) => ({ ...existing, ...newValue })
  }),

  decisionMakersResearch: Annotation<{
    searchQueries: string[];
    searchResults: any[];
    extractedUrls: string[];
    extractedEntities: any[];
    insights?: any[];
    complete?: boolean;
  } | undefined>({
    default: () => undefined,
    value: (existing, newValue) => ({ ...existing, ...newValue })
  }),
});

// Define a type for accessing the state based on the annotation
export type AnnotatedOverallProposalState =
  typeof OverallProposalStateAnnotation.State;
