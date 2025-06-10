# Section Writing Phase UX Flow - Complete LangGraph Implementation Architecture

## Complete StateGraph Structure with Exact Data Contracts

**State Fields Required (Matching Agent Descriptions):**
```typescript
const SectionWritingAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  
  // Planning intelligence (inherited from planning phase)
  planning_intelligence: Annotation<{
    comprehensive_requirements: {
      explicit_requirements: Array<{
        requirement: string,
        source_location: string,
        exact_language: string,
        category: "Technical" | "Administrative" | "Qualification" | "Performance",
        mandatory_level: "Mandatory" | "Optional" | "Preferred",
        compliance_method: string,
        verification_needed: string
      }>,
      requirement_priorities: Array<{
        requirement_id: string,
        priority_score: number,
        priority_basis: string,
        competitive_importance: "Critical" | "Important" | "Standard"
      }>
    },
    strategic_framework: {
      positioning_statement: string,
      win_themes: string[],
      value_proposition: string,
      messaging_framework: {
        key_terminology: string[],
        tone_and_style: string,
        emphasis_areas: string[],
        consistency_guidelines: string[]
      }
    },
    funder_intelligence: {
      organizational_priorities: Array<{
        priority: string,
        evidence: string,
        user_validation: string,
        strategic_importance: string,
        confidence: number
      }>,
      language_preferences: {
        preferred_terminology: string[],
        organizational_tone: string,
        values_emphasis: string[]
      }
    },
    proof_point_strategy: Array<{
      claim: string,
      evidence: string,
      source: string,
      competitive_advantage: string,
      strength: "Strong" | "Moderate" | "Adequate"
    }>,
    risk_mitigation: Array<{
      concern: string,
      mitigation_message: string,
      supporting_evidence: string,
      confidence_level: number
    }>,
    rfp_analysis: {
      submission_requirements: {
        page_limit: number | "not_specified",
        sections_required: string[],
        attachments_needed: string[]
      }
    },
    competitive_differentiation: {
      unique_strengths: string[],
      competitive_advantages: string[],
      market_positioning: string,
      differentiation_sustainability: string
    }
  }>,
  
  // System configuration
  available_section_types: Annotation<string[]>({
    default: () => ["Executive Summary", "Problem Statement", "Solution/Technical Approach", 
                   "Organizational Capacity", "Past Performance", "Implementation Plan", 
                   "Timeline & Milestones", "Budget & Cost Justification"]
  }),
  
  // Section discovery outputs
  required_sections: Annotation<string[]>,
  section_mapping: Annotation<Record<string, string>>,
  section_dependencies: Annotation<Record<string, string[]>>,
  
  // Section orchestration
  current_section: Annotation<string>,
  completed_sections: Annotation<string[]>({
    reducer: (state, update) => {
      if (Array.isArray(update)) return [...new Set([...state, ...update])];
      return state.includes(update) ? state : [...state, update];
    },
    default: () => []
  }),
  current_sections_in_progress: Annotation<string[]>({
    reducer: (state, update) => {
      if (Array.isArray(update)) return update;
      if (typeof update === 'object') {
        if (update.action === 'add') return [...state, update.section];
        if (update.action === 'remove') return state.filter(s => s !== update.section);
      }
      return state;
    },
    default: () => []
  }),
  current_phase: Annotation<"discovery" | "planning" | "writing" | "validation" | "assembly">,
  
  // Section planning outputs
  section_outlines: Annotation<Record<string, {
    status: "pending" | "approved" | "revision_requested",
    outline: {
      sections: Array<{
        title: string,
        target_words: number,
        key_points: string[],
        evidence_to_include: string[],
        requirements_covered: string[]
      }>,
      total_requirements: string[],
      total_evidence: string[]
    }
  }>>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({})
  }),
  
  // Section content outputs
  section_content: Annotation<Record<string, {
    status: "user_review" | "completed" | "revision_requested",
    content: string,
    metadata: {
      requirements_addressed: string[],
      evidence_used: string[],
      word_count: number,
      generation_timestamp: string,
      funder_alignment_score: number
    }
  }>>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({})
  }),
  
  // User interactions
  pending_user_interaction: Annotation<{
    type: "section_discovery_review" | "outline_review" | "content_review" | "validation_review" | "final_review",
    section?: string,
    data: object,
    options: string[]
  } | null>({
    reducer: (state, update) => update,
    default: () => null
  }),
  
  user_approvals: Annotation<Record<string, boolean | null>>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({})
  }),
  
  user_feedback: Annotation<Record<string, any>>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({})
  }),
  
  // Validation outputs
  validation_results: Annotation<{
    requirement_coverage: number,
    critical_coverage: number,
    evidence_utilization: number,
    missing_critical_requirements: Array<{
      requirement: string,
      severity: "critical" | "important",
      suggested_section: string
    }>,
    unused_high_value_evidence: string[],
    suggestions: string[]
  }>,
  
  // Final assembly outputs
  final_proposal: Annotation<{
    document: string,
    format: "markdown",
    sections: string[],
    executive_summary: string,
    table_of_contents: string
  }>,
  
  proposal_metadata: Annotation<{
    total_words: number,
    sections_included: string[],
    requirements_coverage: number,
    evidence_utilization: number,
    generation_summary: object
  }>
})
```

---

## Phase 1: Section Discovery with State-Driven User Intelligence

**Section Discovery Agent Behavior:**
- Performs section analysis using `state.planning_intelligence` and RFP requirements
- Presents analysis with `interrupt()` containing section strategy from `state.available_section_types`
- User selections update `state.user_approvals.section_discovery` and `state.user_feedback.section_modifications`

**User Intelligence Integration:**
- User section feedback stored in `state.user_feedback.section_modifications`
- Planning intelligence from `state.planning_intelligence` passed as input context to ALL agents
- Each agent prompt includes: "User Feedback: {state.user_feedback}"

**Section Discovery Process:**
```typescript
sectionDiscoveryAgent = async (state) => {
  const sectionStrategy = analyzeSectionRequirements(
    state.planning_intelligence.comprehensive_requirements,
    state.planning_intelligence.rfp_analysis.submission_requirements,
    state.available_section_types
  )
  
  const userDecision = interrupt({
    type: "section_discovery_review",
    data: {
      mandatory_sections: sectionStrategy.mandatory_sections,
      optional_sections: sectionStrategy.optional_sections,
      requirement_coverage: sectionStrategy.coverage_analysis
    },
    options: ["approve", "modify", "add_sections"]
  })
  
  return {
    required_sections: sectionStrategy.required_sections,
    section_mapping: sectionStrategy.section_mapping,
    section_dependencies: sectionStrategy.section_dependencies,
    pending_user_interaction: {
      type: "section_discovery_review",
      data: sectionStrategy,
      options: ["approve", "modify", "add_sections"]
    }
  }
}
```

**Routing Mechanism:**
```typescript
const routeAfterSectionDiscovery = (state) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub"
  }
  if (state.user_approvals.section_discovery) {
    return "section_orchestrator"
  }
  return "section_discovery"  // Loop back for revisions
}
```

---

## Phase 2: Section Orchestration with Send API Parallel Processing

**Section Orchestrator Agent Behavior:**
- Analyzes `state.section_dependencies` and `state.completed_sections` for readiness
- Uses Send API when multiple sections ready for parallel processing
- Updates `state.current_phase` based on completion status

**Parallel Processing Logic:**
```typescript
sectionOrchestratorAgent = async (state) => {
  const readySections = getReadySections(state)
  
  // Check if all sections complete for validation
  if (state.required_sections.every(s => state.completed_sections.includes(s))) {
    return { current_phase: "validation" }
  }
  
  // Parallel execution for multiple ready sections
  if (readySections.length > 1) {
    return readySections.map(section => 
      new Send("section_planner", { 
        ...state, 
        current_section: section,
        current_sections_in_progress: [...state.current_sections_in_progress, section]
      })
    )
  }
  
  // Single section execution
  if (readySections.length === 1) {
    return {
      current_section: readySections[0],
      current_sections_in_progress: [...state.current_sections_in_progress, readySections[0]]
    }
  }
  
  // No sections ready - wait state
  return { current_phase: "waiting" }
}

const getReadySections = (state) => {
  return state.required_sections.filter(section => {
    const isCompleted = state.completed_sections.includes(section)
    const isInProgress = state.current_sections_in_progress.includes(section)
    const dependenciesMet = state.section_dependencies[section]?.every(dep => 
      state.completed_sections.includes(dep)
    ) ?? true
    
    return !isCompleted && !isInProgress && dependenciesMet
  })
}
```

**Conditional Routing After Orchestration:**
```typescript
const routeFromOrchestrator = (state) => {
  if (state.current_phase === "validation") {
    return "simple_validator"
  }
  // Send API routing handled by orchestrator return values
  return "section_planner"
}
```

---

## Phase 3: Section Planning and Content Generation Flow

**Section Planner Agent Behavior:**
- Uses `state.current_section` and `state.planning_intelligence` for outline creation
- Calls tools: `company_knowledge_rag` and `deep_research_tool`
- Updates `state.section_outlines[current_section]` with detailed outline
- Uses `interrupt()` for outline approval

**Section Planning Process:**
```typescript
sectionPlannerAgent = async (state) => {
  const sectionRequirements = state.section_mapping[state.current_section]
  const strategicContext = state.planning_intelligence.strategic_framework
  
  // Gather evidence using tools
  const evidence = await company_knowledge_rag({
    query: `${state.current_section} evidence requirements`,
    context: strategicContext.positioning_statement,
    evidence_type: "projects metrics testimonials qualifications"
  })
  
  const outline = createSectionOutline(
    state.current_section,
    sectionRequirements,
    strategicContext,
    evidence,
    state.user_feedback[state.current_section]
  )
  
  const userApproval = interrupt({
    type: "outline_review",
    section: state.current_section,
    data: {
      outline: outline,
      coverage_analysis: analyzeCoverage(outline, sectionRequirements)
    },
    options: ["approve", "modify", "add_subsection", "reorder"]
  })
  
  return {
    section_outlines: {
      [state.current_section]: {
        status: "pending",
        outline: outline
      }
    },
    pending_user_interaction: {
      type: "outline_review",
      section: state.current_section,
      data: { outline, coverage_analysis: analyzeCoverage(outline, sectionRequirements) },
      options: ["approve", "modify", "add_subsection", "reorder"]
    }
  }
}
```

**Universal Section Executor Process:**
```typescript
universalSectionExecutorAgent = async (state) => {
  const approvedOutline = state.section_outlines[state.current_section].outline
  const strategicFramework = state.planning_intelligence.strategic_framework
  
  // Gather detailed evidence for content generation
  const detailedEvidence = await company_knowledge_rag({
    query: approvedOutline.total_evidence.join(' '),
    context: `${state.current_section} detailed evidence`,
    evidence_type: "detailed projects metrics testimonials case_studies"
  })
  
  // Handle gap context if present
  let gapResearchData = null
  if (state.gap_context) {
    gapResearchData = await deep_research_tool({
      topic: `${state.current_section} gap resolution ${state.gap_context.missing_requirements.join(' ')}`,
      context: strategicFramework.positioning_statement,
      focus_areas: state.gap_context.missing_requirements
    })
  }
  
  const content = generateSectionContent(
    state.current_section,
    approvedOutline,
    strategicFramework,
    detailedEvidence,
    gapResearchData,
    state.user_feedback[state.current_section]
  )
  
  const userReview = interrupt({
    type: "content_review",
    section: state.current_section,
    data: {
      content: content.text,
      summary: content.summary,
      intelligence_utilized: content.metadata
    },
    options: ["approve", "request_revision", "regenerate"]
  })
  
  return {
    section_content: {
      [state.current_section]: {
        status: "user_review",
        content: content.text,
        metadata: {
          requirements_addressed: content.requirements_covered,
          evidence_used: content.evidence_sources,
          word_count: content.word_count,
          generation_timestamp: new Date().toISOString(),
          funder_alignment_score: content.alignment_score
        }
      }
    },
    current_sections_in_progress: state.current_sections_in_progress.filter(s => s !== state.current_section),
    pending_user_interaction: {
      type: "content_review",
      section: state.current_section,
      data: { content: content.text, summary: content.summary, intelligence_utilized: content.metadata },
      options: ["approve", "request_revision", "regenerate"]
    }
  }
}
```

---

## Phase 4: User Interaction Processing and Routing

**User Interaction Hub Agent Process:**
```typescript
userInteractionHubAgent = async (state) => {
  const interaction = state.pending_user_interaction
  const userResponse = await getUserResponse() // from interrupt()
  
  switch (interaction.type) {
    case "section_discovery_review":
      return {
        user_approvals: { section_discovery: userResponse === "approve" },
        user_feedback: { section_modifications: userResponse.modifications || null },
        pending_user_interaction: null
      }
      
    case "outline_review":
      return {
        section_outlines: {
          [interaction.section]: { 
            status: userResponse === "approve" ? "approved" : "revision_requested"
          }
        },
        user_feedback: { [interaction.section]: userResponse.feedback || "" },
        pending_user_interaction: null
      }
      
    case "content_review":
      const isCompleted = userResponse === "approve"
      return {
        section_content: {
          [interaction.section]: { 
            status: isCompleted ? "completed" : "revision_requested"
          }
        },
        completed_sections: isCompleted ? [interaction.section] : [],
        user_feedback: { [interaction.section]: userResponse.feedback || "" },
        pending_user_interaction: null
      }
      
    case "validation_review":
      return {
        user_approvals: { address_gaps: userResponse === "address_gaps" },
        pending_user_interaction: null
      }
      
    default:
      return { pending_user_interaction: null }
  }
}
```

---

## Phase 5: Validation and Gap Resolution with Send API

**Simple Validator Agent Process:**
```typescript
simpleValidatorAgent = async (state) => {
  const allRequirements = state.planning_intelligence.comprehensive_requirements.explicit_requirements
  const sectionContents = state.section_content
  
  const validationResults = performValidation(allRequirements, sectionContents)
  
  const userDecision = interrupt({
    type: "validation_review",
    data: {
      coverage_summary: validationResults.summary,
      gaps: validationResults.missing_critical_requirements,
      suggestions: validationResults.suggestions
    },
    options: ["address_gaps", "accept_as_is", "proceed_to_assembly"]
  })
  
  return {
    validation_results: {
      requirement_coverage: validationResults.requirement_coverage,
      critical_coverage: validationResults.critical_coverage,
      evidence_utilization: validationResults.evidence_utilization,
      missing_critical_requirements: validationResults.missing_critical_requirements,
      unused_high_value_evidence: validationResults.unused_high_value_evidence,
      suggestions: validationResults.suggestions
    },
    pending_user_interaction: {
      type: "validation_review",
      data: validationResults,
      options: ["address_gaps", "accept_as_is", "proceed_to_assembly"]
    }
  }
}
```

**Gap Resolution Orchestrator with Send API:**
```typescript
gapResolutionOrchestratorAgent = async (state) => {
  const missingRequirements = state.validation_results.missing_critical_requirements
  
  // Group gaps by suggested_section
  const gapsBySection = missingRequirements.reduce((acc, req) => {
    const section = req.suggested_section
    if (!acc[section]) acc[section] = []
    acc[section].push(req)
    return acc
  }, {})
  
  // Create Send objects for parallel gap resolution
  return Object.entries(gapsBySection).map(([section, requirements]) =>
    new Send("universal_section_executor", {
      ...state,
      current_section: section,
      gap_context: {
        missing_requirements: requirements.map(r => r.requirement),
        target_additions: {
          requirements: requirements,
          revision_type: "gap_resolution"
        }
      }
    })
  )
}
```

---

## Complete StateGraph Structure

```typescript
const sectionWritingGraph = new StateGraph(SectionWritingAnnotation)
  // Core section workflow
  .addNode("section_discovery", sectionDiscoveryAgent)
  .addNode("section_orchestrator", sectionOrchestratorAgent)
  .addNode("section_planner", sectionPlannerAgent)
  .addNode("universal_section_executor", universalSectionExecutorAgent)
  .addNode("user_interaction_hub", userInteractionHubAgent)
  
  // Validation and gap resolution
  .addNode("simple_validator", simpleValidatorAgent)
  .addNode("gap_resolution_orchestrator", gapResolutionOrchestratorAgent)
  .addNode("proposal_assembly", proposalAssemblyAgent)
  
  // Flow definition with exact routing functions
  .addEdge(START, "section_discovery")
  .addConditionalEdges("section_discovery", routeAfterSectionDiscovery)
  .addConditionalEdges("section_orchestrator", routeFromOrchestrator)
  .addConditionalEdges("section_planner", routeAfterPlanner)
  .addConditionalEdges("universal_section_executor", routeAfterExecutor)
  .addConditionalEdges("user_interaction_hub", routeAfterUserInteraction)
  .addConditionalEdges("simple_validator", routeAfterValidation)
  .addConditionalEdges("gap_resolution_orchestrator", routeAfterGapResolution)
  .addEdge("proposal_assembly", END)
  .compile()
```

---

## Exact Routing Functions (From Agent Descriptions)

```typescript
// Route after section discovery based on user approval
const routeAfterSectionDiscovery = (state: typeof SectionWritingAnnotation.State) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub"
  }
  if (state.user_approvals.section_discovery) {
    return "section_orchestrator"
  }
  return "section_discovery" // Loop for modifications
}

// Route from orchestrator using Send API for parallel processing
const routeFromOrchestrator = (state: typeof SectionWritingAnnotation.State) => {
  if (state.current_phase === "validation") {
    return "simple_validator"
  }
  // Send API routing handled by orchestrator return values
  return "section_planner"
}

// Route after section planner based on outline approval
const routeAfterPlanner = (state: typeof SectionWritingAnnotation.State) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub"
  }
  if (state.section_outlines[state.current_section]?.status === "approved") {
    return "universal_section_executor"
  }
  return "section_planner" // Loop for revisions
}

// Route after section executor based on content approval
const routeAfterExecutor = (state: typeof SectionWritingAnnotation.State) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub"
  }
  if (state.section_content[state.current_section]?.status === "completed") {
    return "section_orchestrator" // Return for next section
  }
  return "universal_section_executor" // Loop for revisions
}

// Route after user interaction based on interaction type
const routeAfterUserInteraction = (state: typeof SectionWritingAnnotation.State) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub" // Should not happen if properly cleared
  }
  
  // Route based on what was just processed
  if (state.user_approvals.section_discovery !== undefined) {
    return "section_discovery"
  }
  if (state.current_section && state.section_outlines[state.current_section]) {
    if (state.section_outlines[state.current_section].status === "approved") {
      return "universal_section_executor"
    } else {
      return "section_planner"
    }
  }
  if (state.current_section && state.section_content[state.current_section]) {
    if (state.section_content[state.current_section].status === "completed") {
      return "section_orchestrator"
    } else {
      return "universal_section_executor"
    }
  }
  if (state.user_approvals.address_gaps !== undefined) {
    return state.user_approvals.address_gaps ? "gap_resolution_orchestrator" : "proposal_assembly"
  }
  
  return "section_orchestrator" // Default fallback
}

// Route after validation
const routeAfterValidation = (state: typeof SectionWritingAnnotation.State) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub"
  }
  
  const criticalGaps = state.validation_results.missing_critical_requirements.filter(
    req => req.severity === "critical"
  )
  if (criticalGaps.length > 0 && state.user_approvals.address_gaps) {
    return "gap_resolution_orchestrator"
  }
  
  return "proposal_assembly"
}

// Route after gap resolution (Send API returns to validator)
const routeAfterGapResolution = (state: typeof SectionWritingAnnotation.State) => {
  return "simple_validator" // Re-validate after gap fixes
}
```

This architecture uses exact variable names and data structures from the agent descriptions, implements LangGraph's native conditional routing, Send API for parallel processing, state management, and interrupt() patterns for user interactions without any custom mechanisms outside the framework.