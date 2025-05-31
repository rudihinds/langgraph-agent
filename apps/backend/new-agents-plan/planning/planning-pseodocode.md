# Planning Stage UX Flow - Complete LangGraph Implementation Architecture

## Updated StateGraph Structure

**New State Fields Required:**
```typescript
PlanningPhaseAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  
  // User intelligence integration
  user_intelligence: Annotation<Record<string, any>>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({})
  }),
  
  // User approach control
  user_approach_selection: Annotation<{
    selected_agents: string[],
    research_depth: string,
    custom_focus_areas: string[]
  }>,
  
  // System configuration for dynamic agent selection
  available_agents: Annotation<string[]>({
    default: () => ["enhanced_research", "industry_specialist", "competitive_intelligence", 
                   "requirement_analysis", "evaluation_prediction", "solution_decoder", "strategic_positioning"]
  }),
  
  // Revision and reassessment tracking
  reassessment_requested: Annotation<{
    requested: boolean,
    reason: string,
    requesting_agent: string,
    new_complexity_assessment: string
  }>,
  
  additional_research_requested: Annotation<{
    requested: boolean,
    focus_areas: string[],
    research_type: string,
    requesting_agent: string
  }>,
  
  // Research depth tracking
  current_research_depth: Annotation<string>,
  research_iterations: Annotation<number>,
  
  // All existing fields remain...
})
```

---

## Phase 1: Dynamic Orchestration with State-Driven Routing

**Master Orchestrator Behavior:**
- Performs RFP analysis using internal LLM capabilities
- Presents analysis with `interrupt()` containing available agent options from `state.available_agents`
- User selections update `state.user_approach_selection` and `state.user_intelligence`

**User Intelligence Integration:**
- User insider knowledge stored in `state.user_intelligence.funder_context`, `state.user_intelligence.decision_maker_updates`, etc.
- This state field passed as input context to ALL subsequent agents
- Each agent prompt includes: "User Intelligence Available: {state.user_intelligence}"

**Custom Agent Selection Mechanism:**
- `interrupt()` presents `state.available_agents` as selectable options
- User selections update `state.user_approach_selection.selected_agents`
- `parallelResearchRouter` uses `state.user_approach_selection.selected_agents` instead of hardcoded list

**Routing Mechanism:**
```
routeAfterOrchestration = (state) => {
  if (state.user_approvals.orchestrator_analysis) {
    return "parallel_research_router"
  }
  return "master_orchestrator"  // Loop back for revisions
}
```

---

## Phase 2: Research with Conditional Depth Enhancement

**Enhanced Research Agent Behavior:**
- Streams discoveries using LangGraph's streaming updates
- At completion, evaluates if complexity discovered exceeds initial assessment
- If complexity mismatch detected, updates `state.additional_research_requested`

**Additional Research Depth Mechanism:**
- Enhanced Research Agent sets `state.additional_research_requested.requested = true`
- Includes `focus_areas` needing deeper research and `research_type` (deep_dive/specialist)
- Uses `interrupt()` to present findings and request user approval for additional research

**Conditional Routing After Research:**
```
routeAfterEnhancedResearch = (state) => {
  if (state.additional_research_requested.requested && state.user_approvals.additional_research) {
    return "deep_dive_research_node"
  }
  if (state.reassessment_requested.requested) {
    return "reassessment_orchestrator" 
  }
  return "competitive_intelligence"
}
```

**Deep Dive Research Node:**
- New node that performs enhanced research on `state.additional_research_requested.focus_areas`
- Updates research results in existing state fields
- Increments `state.research_iterations`
- Routes to `competitive_intelligence` when complete

---

## Phase 3: Reassessment Routing Mechanism

**Complexity Reassessment Trigger:**
- Any research agent can set `state.reassessment_requested.requested = true`
- Includes `reason` and `new_complexity_assessment`
- Uses `interrupt()` to present discovery and request user confirmation

**Reassessment Orchestrator Node:**
- New node that inherits from Master Orchestrator but focuses on strategy revision
- Receives all existing research in state plus reassessment context
- Updates `state.rfp_analysis` with new complexity/industry assessment
- May modify `state.user_approach_selection` based on new understanding

**Command Routing Back:**
```
reassessmentOrchestrator = async (state) => {
  newAnalysis = await reanalyzeWithContext(state.rfp_analysis, state.all_research_results)
  
  userDecision = interrupt({
    original_assessment: state.rfp_analysis,
    revised_assessment: newAnalysis,
    recommended_changes: newAnalysis.strategy_changes
  })
  
  return new Command({
    goto: determineRevisedPath(userDecision),
    update: {
      rfp_analysis: newAnalysis,
      reassessment_requested: { requested: false },
      user_approach_selection: userDecision.revised_approach
    }
  })
}
```

---

## Phase 4: Analysis Phase with Iterative Enhancement

**Sequential Analysis Flow:**
- Requirement Analysis → Evaluation Prediction → Solution Decoder
- Each agent receives enhanced context from `state.user_intelligence`
- Each can request additional research via state updates

**Alternative Exploration Using Checkpointing:**
- Solution Decoder creates checkpoint before presenting strategic options
- User exploration of alternatives uses `Command` with `goto` to return to specific checkpoints
- Each alternative path updates temporary state fields for comparison
- Final selection merges chosen approach into main state

**Exploration Routing Pattern:**
```
strategicExplorationRouter = (state) => {
  if (state.exploration_mode.active) {
    return mapApproachToNode(state.exploration_mode.current_approach)
  }
  return "strategic_positioning"
}
```

---

## Updated StateGraph Structure

```typescript
planningGraph = new StateGraph(PlanningPhaseAnnotation)
  // Core orchestration
  .addNode("master_orchestrator", masterOrchestratorAgent)
  .addNode("reassessment_orchestrator", reassessmentOrchestratorAgent)
  
  // Research phase
  .addNode("parallel_research_router", parallelResearchRouter)
  .addNode("enhanced_research", enhancedResearchAgent) 
  .addNode("industry_specialist", industrySpecialistAgent)
  .addNode("competitive_intelligence", competitiveIntelligenceAgent)
  .addNode("deep_dive_research", deepDiveResearchAgent)
  
  // Analysis phase
  .addNode("requirement_analysis", requirementAnalysisAgent)
  .addNode("evaluation_prediction", evaluationPredictionAgent) 
  .addNode("solution_decoder", solutionDecoderAgent)
  
  // Strategic positioning
  .addNode("strategic_positioning", strategicPositioningAgent)
  .addNode("strategic_exploration_hub", strategicExplorationAgent)
  
  // Flow definition with conditional routing
  .addEdge(START, "master_orchestrator")
  .addConditionalEdges("master_orchestrator", routeAfterOrchestration)
  .addEdge("parallel_research_router", "enhanced_research")
  .addConditionalEdges("enhanced_research", routeAfterEnhancedResearch)
  .addEdge("deep_dive_research", "competitive_intelligence")
  .addEdge("competitive_intelligence", "requirement_analysis")
  .addConditionalEdges("requirement_analysis", routeAfterRequirementAnalysis)
  .addEdge("evaluation_prediction", "solution_decoder")
  .addConditionalEdges("solution_decoder", routeAfterSolutionDecoding)
  .addConditionalEdges("strategic_positioning", routeAfterPositioning)
  .addConditionalEdges("strategic_exploration_hub", routeExplorationPath)
  
  // Reassessment routing
  .addConditionalEdges("reassessment_orchestrator", routeAfterReassessment)
  .compile()
```

---

## Key Routing Functions

**User Intelligence Propagation:**
```
routeAfterOrchestration = (state) => {
  // User intelligence in state.user_intelligence automatically available to all subsequent agents
  // No additional mechanism needed - part of shared state
}
```

**Additional Research Handling:**
```
routeAfterEnhancedResearch = (state) => {
  if (state.additional_research_requested.requested) {
    if (state.user_approvals.additional_research) {
      return "deep_dive_research"
    } else {
      return "competitive_intelligence" // Skip additional research
    }
  }
  if (state.reassessment_requested.requested) {
    return "reassessment_orchestrator"
  }
  return "competitive_intelligence"
}
```

**Reassessment Routing:**
```
routeAfterReassessment = (state) => {
  if (state.rfp_analysis.complexity_changed) {
    return "parallel_research_router" // Restart research with new approach
  }
  return "requirement_analysis" // Continue with updated context
}
```

This architecture uses LangGraph's native conditional routing, state management, and Command objects to handle all user interactions and system adaptations without custom mechanisms outside the framework.