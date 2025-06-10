# Section Writing Phase - LangGraph Agent Architecture (Final)

## Core Tools Available to All Section Agents

### company_knowledge_rag
**Description**: Semantic search tool for finding relevant company capabilities, past performance, and proof points from company knowledge base.
**LLM Model**: GPT-4.0 mini (optimized for vector search)
**Prompt**:
```
You are a company knowledge specialist. Search the company database for information matching the query requirements.

Search Query: {query}
Context Requirements: {context}
Evidence Type Needed: {evidence_type}

Find:
- Relevant project experience and outcomes
- Team qualifications and certifications  
- Performance metrics and testimonials
- Competitive differentiators
- Risk mitigation evidence

Return specific, quantifiable evidence with source references.
```
**Input Schema**: `{ query: string, context: string, evidence_type: string }`
**Output**: Relevant company capabilities with specific evidence

### deep_research_tool
**Description**: Comprehensive research and synthesis tool for gathering supporting evidence and industry benchmarks.
**LLM Model**: Claude 3.5 Sonnet with web search
**Prompt**:
```
You are a strategic research analyst. Conduct comprehensive research on the specified topic using multiple sources and provide synthesized analysis.

Research Topic: {topic}
Strategic Context: {context}
Analysis Focus: {focus_areas}

Process:
1. Gather information from multiple credible sources
2. Analyze patterns and trends in the data
3. Synthesize findings into strategic insights
4. Provide evidence-based conclusions with confidence levels

Deliver actionable intelligence with specific evidence and strategic interpretation.
```
**Input Schema**: `{ topic: string, context: string, focus_areas: string[] }`
**Output**: Synthesized research with analysis and confidence scores

---

## 1. Section Discovery Agent

### Role and Objectives
You are a Section Discovery Agent responsible for analyzing proposal requirements and creating a comprehensive section mapping strategy based on planning intelligence and RFP requirements.

### LLM Model
Claude 3.5 Sonnet (strong analytical reasoning for requirement decomposition)

### Input Data
```typescript
{
  planning_intelligence: {
    comprehensive_requirements: {
      explicit_requirements: Array<object>,
      requirement_priorities: Array<object>
    },
    strategic_framework: {
      positioning_statement: string,
      win_themes: string[]
    },
    funder_intelligence: {
      organizational_priorities: Array<object>
    },
    rfp_analysis: {
      submission_requirements: {
        page_limit: number | "not_specified",
        sections_required: string[]
      }
    }
  },
  available_section_types: string[],
  user_approvals: {
    section_discovery?: boolean
  },
  user_feedback: {
    section_modifications?: object
  }
}
```

### Available Tools
None - performs analysis using provided intelligence and requirements

### Prompt Pattern
```
You are a section mapping specialist responsible for creating optimal proposal structure based on comprehensive intelligence.

Requirements Analysis: {planning_intelligence.comprehensive_requirements.explicit_requirements}
Requirement Priorities: {planning_intelligence.comprehensive_requirements.requirement_priorities}
Strategic Framework: {planning_intelligence.strategic_framework.positioning_statement}
Win Themes: {planning_intelligence.strategic_framework.win_themes}
Funder Priorities: {planning_intelligence.funder_intelligence.organizational_priorities}
Submission Requirements: {planning_intelligence.rfp_analysis.submission_requirements}
Available Section Types: {available_section_types}
User Modifications: {user_feedback.section_modifications}

SECTION MAPPING PROCESS:
1. Identify all required sections from RFP submission requirements
2. Map requirements to optimal section placement for maximum impact
3. Determine section dependencies and logical flow
4. Create section briefings with specific objectives and coverage analysis
5. Present section strategy via interrupt() for user approval and modification

SECTION ANALYSIS REQUIREMENTS:
- Map each requirement to specific section with rationale
- Identify mandatory vs optional sections based on RFP analysis
- Create clear dependencies between sections
- Provide requirement coverage analysis
- Include user intelligence about section preferences

Present comprehensive section strategy for user approval before proceeding to section generation.
```

### Process Flow
1. Analyze planning_intelligence to extract all requirements
2. Map requirements to appropriate section types from available_section_types
3. Identify section dependencies based on content flow
4. Use interrupt() to present findings and await user decision
5. Return state updates based on user choice

### Output Format
```json
{
  "required_sections": string[],
  "section_mapping": Record<string, string>,
  "section_dependencies": Record<string, string[]>,
  "pending_user_interaction": {
    "type": "section_discovery_review",
    "data": {
      "mandatory_sections": string[],
      "optional_sections": string[],
      "requirement_coverage": object
    },
    "options": ["approve", "modify", "add_sections"]
  }
}
```

---

## 2. Section Orchestrator Agent

### Role and Objectives
You are a Section Orchestrator Agent responsible for managing the section writing workflow, determining section readiness based on dependencies, and coordinating parallel section development using Send API.

### LLM Model
Claude 3.5 Sonnet (orchestration and dependency management capabilities)

### Input Data
```typescript
{
  required_sections: string[],
  completed_sections: string[],
  section_dependencies: Record<string, string[]>,
  current_sections_in_progress: string[],
  section_outlines: Record<string, {
    status: "pending" | "approved"
  }>,
  section_content: Record<string, {
    status: "user_review" | "completed" | "revision_requested"
  }>
}
```

### Available Tools
None - performs orchestration using state analysis

### Prompt Pattern
```
You are a section workflow orchestrator responsible for optimal section development coordination.

Required Sections: {required_sections}
Completed Sections: {completed_sections}
Section Dependencies: {section_dependencies}
Sections In Progress: {current_sections_in_progress}
Section Outlines Status: {Object.entries(section_outlines).map(([s, o]) => `${s}: ${o.status}`)}
Section Content Status: {Object.entries(section_content).map(([s, c]) => `${s}: ${c.status}`)}

ORCHESTRATION LOGIC:
1. Analyze section dependencies to determine ready sections
2. Check outline and content status to avoid conflicts
3. Identify parallel processing opportunities for independent sections
4. Manage resource allocation to avoid overwhelming user with reviews
5. Determine when all sections are complete for validation

ROUTING DECISIONS:
- Multiple independent sections ready: Return array of Send objects for parallel processing
- Single section ready: Return single routing destination with section context
- All sections complete: Route to validation phase
- Dependencies blocking: Wait state

Determine optimal next actions based on current workflow state and dependencies.
```

### Process Flow
1. Analyze section dependencies and completion status
2. Identify sections ready for processing (dependencies met, not in progress)
3. Determine if parallel or single processing based on ready sections
4. Return appropriate routing (Send objects or single destination)

### Routing Logic
```typescript
const getReadySections = (state) => {
  return state.required_sections.filter(section => {
    const isCompleted = state.completed_sections.includes(section);
    const isInProgress = state.current_sections_in_progress.includes(section);
    const dependenciesMet = state.section_dependencies[section]?.every(dep => 
      state.completed_sections.includes(dep)
    ) ?? true;
    
    return !isCompleted && !isInProgress && dependenciesMet;
  });
};

// For parallel execution
if (readySections.length > 1) {
  return readySections.map(section => 
    new Send("section_planner", { 
      ...state, 
      current_section: section 
    })
  );
}

// For single execution  
if (readySections.length === 1) {
  return {
    current_section: readySections[0],
    current_sections_in_progress: [...state.current_sections_in_progress, readySections[0]]
  };
}

// For validation
if (state.required_sections.every(s => state.completed_sections.includes(s))) {
  return { current_phase: "validation" };
}
```

### Output Format
**For parallel execution**: Array<Send> objects targeting "section_planner"
**For single execution**: 
```json
{
  "current_section": string,
  "current_sections_in_progress": string[]
}
```
**For validation**:
```json
{
  "current_phase": "validation"
}
```

---

## 3. Section Planner Agent

### Role and Objectives
You are a Section Planner Agent responsible for creating detailed section outlines that align with strategic objectives, address specific requirements, and incorporate appropriate evidence.

### LLM Model
Claude 3.5 Sonnet (strong content planning and structural design capabilities)

### Input Data
```typescript
{
  current_section: string,
  planning_intelligence: {
    comprehensive_requirements: object,
    strategic_framework: object,
    funder_intelligence: object,
    proof_point_strategy: Array<object>
  },
  section_mapping: Record<string, string>,
  user_feedback: Record<string, string>,
  section_outlines: Record<string, object>
}
```

### Available Tools
- `company_knowledge_rag`: For finding specific evidence and proof points
- `deep_research_tool`: For industry benchmarks and supporting evidence

### Prompt Pattern
```
You are a section outline specialist applying proven proposal writing templates to create winning content structure.

Current Section: {current_section}
Section Requirements: {section_mapping[current_section]}
Strategic Framework: {planning_intelligence.strategic_framework.positioning_statement}
Win Themes: {planning_intelligence.strategic_framework.win_themes}
Funder Priorities: {planning_intelligence.funder_intelligence.organizational_priorities}
Proof Points Available: {planning_intelligence.proof_point_strategy}
User Feedback: {user_feedback[current_section]}
Existing Outline: {section_outlines[current_section]}

SECTION PLANNING PROCESS:
1. Apply appropriate section template based on current_section type
2. Use company_knowledge_rag to find specific evidence for key messages
3. Use deep_research_tool for industry context and benchmarks if needed
4. Structure content to maximize strategic impact and requirement coverage
5. Create detailed outline with specific content requirements
6. Present outline via interrupt() for user approval

TEMPLATE APPLICATION:
Apply universal framework principles:
- CLIENT-CENTRIC PERSPECTIVE: Write from client's viewpoint
- VALUE-FIRST APPROACH: Lead with outcomes and benefits
- EVIDENCE MANDATE: Support every claim with specific proof
- QUANTIFICATION REQUIREMENT: Include metrics and timeframes
- INDUSTRY CONTEXTUALIZATION: Apply appropriate sector lens

Create comprehensive outline for user approval before content generation.
```

### Process Flow
1. Extract section requirements from planning intelligence
2. Apply appropriate section template based on current_section
3. Use tools to gather evidence and context if needed
4. Create detailed outline structure
5. Use interrupt() for outline approval
6. Handle revision loops if needed

### Tool Usage
```typescript
// Find evidence for section requirements
company_knowledge_rag({
  query: `${current_section} evidence requirements`,
  context: planning_intelligence.strategic_framework.positioning_statement,
  evidence_type: "projects metrics testimonials qualifications"
})

// Research industry context if needed
deep_research_tool({
  topic: `${current_section} best practices industry standards`,
  context: planning_intelligence.strategic_framework.positioning_statement,
  focus_areas: planning_intelligence.strategic_framework.win_themes
})
```

### Output Format
```json
{
  "section_outlines": {
    "[current_section]": {
      "status": "pending",
      "outline": {
        "sections": Array<{
          "title": string,
          "target_words": number,
          "key_points": string[],
          "evidence_to_include": string[],
          "requirements_covered": string[]
        }>,
        "total_requirements": string[],
        "total_evidence": string[]
      }
    }
  },
  "pending_user_interaction": {
    "type": "outline_review",
    "section": string,
    "data": {
      "outline": object,
      "coverage_analysis": object
    },
    "options": ["approve", "modify", "add_subsection", "reorder"]
  }
}
```

---

## 4. Universal Section Executor Agent

### Role and Objectives
You are a Universal Section Executor Agent responsible for generating high-quality proposal content based on approved outlines, incorporating strategic messaging, and ensuring professional writing standards.

### LLM Model
Claude 3.5 Sonnet (excellent writing capabilities with strategic messaging integration)

### Input Data
```typescript
{
  current_section: string,
  section_outlines: Record<string, {
    outline: {
      sections: Array<object>,
      total_requirements: string[],
      total_evidence: string[]
    }
  }>,
  planning_intelligence: {
    strategic_framework: object,
    funder_intelligence: object,
    competitive_differentiation: object
  },
  user_feedback: Record<string, string>,
  section_content: Record<string, object>,
  gap_context?: {
    missing_requirements: string[],
    target_additions: object
  }
}
```

### Available Tools
- `company_knowledge_rag`: For specific evidence and detailed proof points
- `deep_research_tool`: For additional context or validation when needed

### Prompt Pattern
```
You are a professional proposal writer specializing in {current_section} sections using proven templates and strategic messaging.

Section Outline: {section_outlines[current_section].outline}
Strategic Framework: {planning_intelligence.strategic_framework.positioning_statement}
Win Themes: {planning_intelligence.strategic_framework.win_themes}
Messaging Framework: {planning_intelligence.strategic_framework.messaging_framework}
Funder Language: {planning_intelligence.funder_intelligence.language_preferences}
Funder Priorities: {planning_intelligence.funder_intelligence.organizational_priorities}
Competitive Advantages: {planning_intelligence.competitive_differentiation.unique_strengths}
User Feedback: {user_feedback[current_section]}
Existing Content: {section_content[current_section]}
Gap Context: {gap_context}

WRITING REQUIREMENTS:
Apply the universal framework for ALL content:
1. CLIENT-CENTRIC PERSPECTIVE: Write from client's viewpoint, not vendor's
2. VALUE-FIRST APPROACH: Lead with outcomes and benefits, not features
3. EVIDENCE MANDATE: Support every claim with specific proof
4. QUANTIFICATION REQUIREMENT: Include metrics, percentages, timeframes
5. INDUSTRY CONTEXTUALIZATION: Apply appropriate sector lens

SECTION-SPECIFIC EXECUTION:
For {current_section}, ensure:
- Strategic objective achievement through every paragraph
- Win themes naturally integrated throughout content
- Funder's preferred terminology and communication style
- Competitive differentiation woven into narrative
- Evidence placement for maximum credibility impact
{gap_context ? "- Address specific missing requirements identified in gap context" : ""}

Generate compelling, professional content that advances strategic objectives while addressing all outline requirements.
```

### Process Flow
1. Extract approved outline structure from section_outlines[current_section]
2. Gather additional evidence using tools if needed
3. Generate content following outline specifications
4. Apply quality checks and strategic alignment
5. Use interrupt() for content review
6. Handle revision loops with checkpointing

### Tool Usage
```typescript
// Gather specific evidence for content generation
company_knowledge_rag({
  query: section_outlines[current_section].outline.total_evidence.join(' '),
  context: `${current_section} detailed evidence`,
  evidence_type: "detailed projects metrics testimonials case_studies"
})

// Additional research if gaps identified
if (gap_context) {
  deep_research_tool({
    topic: `${current_section} gap resolution ${gap_context.missing_requirements.join(' ')}`,
    context: planning_intelligence.strategic_framework.positioning_statement,
    focus_areas: gap_context.missing_requirements
  })
}
```

### Output Format
```json
{
  "section_content": {
    "[current_section]": {
      "status": "user_review",
      "content": string,
      "metadata": {
        "requirements_addressed": string[],
        "evidence_used": string[],
        "word_count": number,
        "generation_timestamp": string,
        "funder_alignment_score": number
      }
    }
  },
  "current_sections_in_progress": string[],
  "completed_sections": string[],
  "pending_user_interaction": {
    "type": "content_review",
    "section": string,
    "data": {
      "content": string,
      "summary": string,
      "intelligence_utilized": object
    },
    "options": ["approve", "request_revision", "regenerate"]
  }
}
```

---

## 5. User Interaction Hub Agent

### Role and Objectives
You are a User Interaction Hub Agent responsible for processing all user interactions, managing feedback integration, and routing based on user decisions throughout the section writing process.

### LLM Model
Claude 3.5 Sonnet (strong interaction processing and decision routing capabilities)

### Input Data
```typescript
{
  pending_user_interaction: {
    type: "section_discovery_review" | "outline_review" | "content_review" | "validation_review" | "final_review",
    section?: string,
    data: object,
    options: string[]
  },
  user_response: any, // from interrupt()
  current_section?: string,
  section_outlines: Record<string, object>,
  section_content: Record<string, object>
}
```

### Available Tools
None - processes user interactions and determines routing

### Prompt Pattern
```
You are a user interaction specialist responsible for processing user feedback and determining optimal workflow routing.

Interaction Type: {pending_user_interaction.type}
Section: {pending_user_interaction.section}
Interaction Data: {pending_user_interaction.data}
Available Options: {pending_user_interaction.options}
User Response: {user_response}
Current Section: {current_section}

INTERACTION PROCESSING:
1. Analyze user response for feedback type and intent
2. Extract specific modifications or approvals
3. Update user intelligence with new preferences
4. Determine appropriate next workflow step
5. Clear pending interaction and update state

ROUTING LOGIC BY INTERACTION TYPE:
- section_discovery_review: Update approvals and modifications, route back to discovery
- outline_review: Update outline status and feedback, route to executor or back to planner
- content_review: Update content status and feedback, route to orchestrator or back to executor
- validation_review: Update gap resolution preferences, route to gap resolution or assembly
- final_review: Handle final approval or modification requests

Process user interaction and clear pending state while preserving feedback for future use.
```

### Process Flow
1. Receive user response from interrupt()
2. Analyze response based on interaction type
3. Update appropriate state fields based on user decision
4. Clear pending_user_interaction
5. Return state updates for routing

### Output Format
**For section discovery**:
```json
{
  "user_approvals": { "section_discovery": boolean },
  "user_feedback": { "section_modifications": object },
  "pending_user_interaction": null
}
```

**For outline review**:
```json
{
  "section_outlines": { "[section]": { "status": "approved" | "revision_requested" } },
  "user_feedback": { "[section]": string },
  "pending_user_interaction": null
}
```

**For content review**:
```json
{
  "section_content": { "[section]": { "status": "completed" | "revision_requested" } },
  "completed_sections": string[],
  "user_feedback": { "[section]": string },
  "pending_user_interaction": null
}
```

---

## 6. Simple Validator Agent

### Role and Objectives
You are a Simple Validator Agent responsible for comprehensive proposal validation, identifying gaps in requirement coverage, and ensuring quality standards before final assembly.

### LLM Model
Claude 3.5 Sonnet (strong analytical capabilities for comprehensive validation)

### Input Data
```typescript
{
  section_content: Record<string, {
    content: string,
    metadata: {
      requirements_addressed: string[],
      evidence_used: string[]
    }
  }>,
  planning_intelligence: {
    comprehensive_requirements: {
      explicit_requirements: Array<{
        requirement: string,
        mandatory_level: "Mandatory" | "Optional" | "Preferred"
      }>
    },
    proof_point_strategy: Array<{
      claim: string,
      evidence: string
    }>,
    risk_mitigation: Array<object>
  }
}
```

### Available Tools
None - performs validation using content analysis and requirement mapping

### Prompt Pattern
```
You are a proposal validation specialist responsible for comprehensive quality assurance and gap analysis.

Section Content: {Object.entries(section_content).map(([s, c]) => `${s}: ${c.metadata.requirements_addressed.length} requirements, ${c.metadata.evidence_used.length} evidence points`)}
Explicit Requirements: {planning_intelligence.comprehensive_requirements.explicit_requirements}
Proof Points Available: {planning_intelligence.proof_point_strategy}
Risk Mitigation Required: {planning_intelligence.risk_mitigation}

VALIDATION PROCESS:
1. Analyze requirement coverage across all sections
2. Verify proof point utilization and evidence quality
3. Check for critical requirement gaps (mandatory requirements)
4. Assess risk mitigation coverage
5. Identify unused high-value evidence
6. Present validation findings via interrupt() for user decision

VALIDATION CRITERIA:
- Requirement Coverage: All mandatory requirements addressed
- Evidence Utilization: High-value proof points included
- Critical Coverage: Mission-critical requirements fully addressed
- Risk Coverage: All identified risks properly mitigated

Present comprehensive validation results with gap analysis and recommendations.
```

### Process Flow
1. Extract all requirements from planning_intelligence.comprehensive_requirements
2. Analyze section_content metadata for requirement coverage
3. Check proof_point_strategy utilization
4. Identify critical gaps and missing elements
5. Use interrupt() to present findings and options
6. Return validation results and user interaction

### Output Format
```json
{
  "validation_results": {
    "requirement_coverage": number,
    "critical_coverage": number,
    "evidence_utilization": number,
    "missing_critical_requirements": Array<{
      "requirement": string,
      "severity": "critical" | "important",
      "suggested_section": string
    }>,
    "unused_high_value_evidence": string[],
    "suggestions": string[]
  },
  "pending_user_interaction": {
    "type": "validation_review",
    "data": {
      "coverage_summary": object,
      "gaps": object,
      "suggestions": string[]
    },
    "options": ["address_gaps", "accept_as_is", "proceed_to_assembly"]
  }
}
```

---

## 7. Gap Resolution Orchestrator Agent

### Role and Objectives
You are a Gap Resolution Orchestrator Agent responsible for coordinating targeted improvements to address validation gaps using Send API to route specific sections for revision.

### LLM Model
Claude 3.5 Sonnet (strategic coordination and targeted improvement capabilities)

### Input Data
```typescript
{
  validation_results: {
    missing_critical_requirements: Array<{
      requirement: string,
      severity: "critical" | "important",
      suggested_section: string
    }>
  },
  section_mapping: Record<string, string>,
  section_content: Record<string, object>,
  user_approvals: {
    address_gaps: boolean
  }
}
```

### Available Tools
None - performs orchestration using gap analysis and section mapping

### Prompt Pattern
```
You are a gap resolution coordinator responsible for efficiently addressing proposal validation gaps using Send API.

Missing Requirements: {validation_results.missing_critical_requirements}
Section Mapping: {section_mapping}
Current Section Content: {Object.keys(section_content)}
User Approval: {user_approvals.address_gaps}

GAP RESOLUTION STRATEGY:
1. Group missing requirements by suggested_section from validation results
2. Create specific gap context for each section revision
3. Use Send API to route gaps to appropriate Section Executors
4. Provide detailed target additions for each section
5. Coordinate parallel gap resolution for efficiency

SEND API USAGE:
- Create Send object for each section needing revision
- Include gap_context with specific missing requirements
- Target universal_section_executor for all gap resolutions
- Enable parallel processing of gap fixes

Create targeted resolution plan using Send API for efficient gap addressing.
```

### Process Flow
1. Analyze missing_critical_requirements from validation_results
2. Group requirements by suggested_section
3. Create gap context for each section
4. Return Send objects for parallel gap resolution
5. Update section status for revision tracking

### Routing Logic
```typescript
// Group gaps by section and create Send objects
const gapsBySection = validation_results.missing_critical_requirements.reduce((acc, req) => {
  const section = req.suggested_section;
  if (!acc[section]) acc[section] = [];
  acc[section].push(req);
  return acc;
}, {});

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
);
```

### Output Format
**Returns**: Array<Send> objects to universal_section_executor
**State Updates**:
```json
{
  "section_content": {
    "[section]": { "status": "revision_requested" }
  },
  "user_feedback": {
    "[section]": "Add missing requirements: [list]"
  }
}
```

---

## 8. Proposal Assembly Agent

### Role and Objectives
You are a Proposal Assembly Agent responsible for compiling all approved sections into a cohesive final proposal, generating executive summary, and ensuring professional presentation.

### LLM Model
Claude 3.5 Sonnet (document assembly and executive summary generation capabilities)

### Input Data
```typescript
{
  section_content: Record<string, {
    content: string,
    metadata: object
  }>,
  section_outlines: Record<string, {
    outline: object
  }>,
  planning_intelligence: {
    strategic_framework: {
      positioning_statement: string,
      win_themes: string[],
      value_proposition: string
    },
    messaging_framework: object
  },
  validation_results: {
    requirement_coverage: number,
    evidence_utilization: number
  }
}
```

### Available Tools
- `company_knowledge_rag`: For executive summary supporting evidence
- `deep_research_tool`: For final market context or validation if needed

### Prompt Pattern
```
You are a proposal assembly specialist responsible for creating a cohesive, professional final proposal document.

Section Content: {Object.keys(section_content)}
Strategic Framework: {planning_intelligence.strategic_framework.positioning_statement}
Value Proposition: {planning_intelligence.strategic_framework.value_proposition}
Win Themes: {planning_intelligence.strategic_framework.win_themes}
Messaging Framework: {planning_intelligence.messaging_framework}
Validation Results: Coverage {validation_results.requirement_coverage}%, Evidence Utilization {validation_results.evidence_utilization}%

ASSEMBLY REQUIREMENTS:
1. Compile sections in optimal logical order for maximum impact
2. Generate compelling executive summary using Executive Summary template
3. Ensure narrative flow and consistency between sections
4. Create professional formatting and presentation
5. Generate comprehensive proposal metadata
6. Present final document via interrupt() for user review

EXECUTIVE SUMMARY GENERATION:
Apply Executive Summary template principles:
- CLIENT-CENTRIC PERSPECTIVE: Frame client's problem and solution impact
- VALUE-FIRST APPROACH: Lead with top 3 quantified benefits
- EVIDENCE MANDATE: Include powerful proof point for credibility
- QUANTIFICATION REQUIREMENT: Specific ROI and metrics
- INDUSTRY CONTEXTUALIZATION: Sector-appropriate terminology

Generate comprehensive final proposal with executive summary and metadata.
```

### Process Flow
1. Compile all section content in logical order
2. Generate executive summary using template and tools
3. Ensure narrative consistency across sections
4. Create document metadata and statistics
5. Use interrupt() for final review
6. Prepare download options and final delivery

### Tool Usage
```typescript
// Gather evidence for executive summary
company_knowledge_rag({
  query: planning_intelligence.strategic_framework.win_themes.join(' '),
  context: "executive summary compelling evidence",
  evidence_type: "top_achievements metrics roi_data testimonials"
})

// Final validation research if needed
deep_research_tool({
  topic: "proposal final validation industry context",
  context: planning_intelligence.strategic_framework.positioning_statement,
  focus_areas: ["competitive_advantage", "market_validation"]
})
```

### Output Format
```json
{
  "final_proposal": {
    "document": string,
    "format": "markdown",
    "sections": string[],
    "executive_summary": string,
    "table_of_contents": string
  },
  "proposal_metadata": {
    "total_words": number,
    "sections_included": string[],
    "requirements_coverage": number,
    "evidence_utilization": number,
    "generation_summary": object
  },
  "pending_user_interaction": {
    "type": "final_review",
    "data": {
      "preview": string,
      "metrics": object,
      "download_options": ["pdf", "docx", "markdown"]
    },
    "options": ["download", "make_changes"]
  }
}
```

---

## State Graph Structure with Precise I/O

### Section Writing State Annotation
```typescript
const SectionWritingAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  
  // Planning intelligence (inherited from planning phase)
  planning_intelligence: Annotation<{
    comprehensive_requirements: {
      explicit_requirements: Array<object>,
      requirement_priorities: Array<object>
    },
    strategic_framework: {
      positioning_statement: string,
      win_themes: string[],
      value_proposition: string,
      messaging_framework: object
    },
    funder_intelligence: {
      organizational_priorities: Array<object>,
      language_preferences: object
    },
    proof_point_strategy: Array<{
      claim: string,
      evidence: string,
      competitive_advantage: string
    }>,
    risk_mitigation: Array<object>,
    rfp_analysis: {
      submission_requirements: {
        page_limit: number | "not_specified",
        sections_required: string[]
      }
    },
    competitive_differentiation: {
      unique_strengths: string[]
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
    status: "pending" | "approved",
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
  
  user_approvals: Annotation<Record<string, boolean>>({
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

### Key Routing Functions with I/O Specifications
```typescript
// Route after section discovery based on user approval
const routeAfterSectionDiscovery = (state: typeof SectionWritingAnnotation.State) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub";
  }
  if (state.user_approvals.section_discovery) {
    return "section_orchestrator";
  }
  return "section_discovery"; // Loop for modifications
}

// Route from orchestrator using Send API for parallel processing
const routeFromOrchestrator = (state: typeof SectionWritingAnnotation.State) => {
  if (state.current_phase === "validation") {
    return "simple_validator";
  }
  // Send API routing handled by orchestrator return values
  return "section_planner";
}

// Route after section planner based on outline approval
const routeAfterPlanner = (state: typeof SectionWritingAnnotation.State) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub";
  }
  if (state.section_outlines[state.current_section]?.status === "approved") {
    return "universal_section_executor";
  }
  return "section_planner"; // Loop for revisions
}

// Route after section executor based on content approval
const routeAfterExecutor = (state: typeof SectionWritingAnnotation.State) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub";
  }
  if (state.section_content[state.current_section]?.status === "completed") {
    return "section_orchestrator"; // Return for next section
  }
  return "universal_section_executor"; // Loop for revisions
}

// Route after user interaction based on interaction type
const routeAfterUserInteraction = (state: typeof SectionWritingAnnotation.State) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub"; // Should not happen if properly cleared
  }
  
  // Route based on what was just processed
  if (state.user_approvals.section_discovery !== undefined) {
    return "section_discovery";
  }
  if (state.current_section && state.section_outlines[state.current_section]) {
    if (state.section_outlines[state.current_section].status === "approved") {
      return "universal_section_executor";
    } else {
      return "section_planner";
    }
  }
  if (state.current_section && state.section_content[state.current_section]) {
    if (state.section_content[state.current_section].status === "completed") {
      return "section_orchestrator";
    } else {
      return "universal_section_executor";
    }
  }
  if (state.user_approvals.address_gaps !== undefined) {
    return state.user_approvals.address_gaps ? "gap_resolution_orchestrator" : "proposal_assembly";
  }
  
  return "section_orchestrator"; // Default fallback
}

// Route after validation
const routeAfterValidation = (state: typeof SectionWritingAnnotation.State) => {
  if (state.pending_user_interaction) {
    return "user_interaction_hub";
  }
  
  const criticalGaps = state.validation_results.missing_critical_requirements.filter(
    req => req.severity === "critical"
  );
  if (criticalGaps.length > 0 && state.user_approvals.address_gaps) {
    return "gap_resolution_orchestrator";
  }
  
  return "proposal_assembly";
}

// Route after gap resolution (Send API returns to validator)
const routeAfterGapResolution = (state: typeof SectionWritingAnnotation.State) => {
  return "simple_validator"; // Re-validate after gap fixes
}
```

This final architecture provides accurate variable names, proper state management, correct context passing, and precise I/O specifications that align with the LangGraph framework and proven proposal writing methodologies.