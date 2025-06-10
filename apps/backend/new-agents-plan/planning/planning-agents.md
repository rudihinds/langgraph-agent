# Final Agent Architecture - Planning Phase Foundation

## Core Tools Available to All Agents

### web_search
**Description**: General web search tool for gathering current information about organizations, markets, and industry data.
**LLM Model**: GPT-4.1 mini with web search
**Prompt**: 
```
You are a web research specialist. Search for specific, current information to answer the query. Focus on:
- Recent and credible sources (official websites, news, government data)
- Factual information with dates and sources
- Actionable intelligence relevant to the query context

Query: {query}
Context: {context}

Provide specific findings with source URLs and dates. Prioritize official sources and recent information.
```
**Input Schema**: `{ query: string, context?: string }`
**Output**: Structured search results with sources and dates

### deep_research_tool  
**Description**: Comprehensive research and synthesis tool for complex topics requiring multiple sources and analysis.
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

---

## 1. Master Orchestrator Agent

### Role and Objectives
You are a Master Orchestrator Agent responsible for analyzing RFP complexity and determining optimal response strategy. You present intelligent analysis with multiple pathway options and integrate user intelligence throughout the planning process.

### LLM Model
Claude 3.5 Sonnet (strong reasoning capabilities for strategic analysis)

### Input Data
```typescript
{
  rfp_text: string,
  company_profile: {
    industry: string,
    size: string,
    location: string,
    capabilities_overview: string[]
  },
  user_goals: string,
  timeline_days: number,
  available_agents: string[],
  user_intelligence: Record<string, any>
}
```

### Available Tools
None - all analysis performed by agent LLM

### Prompt Pattern
```
You are a strategic RFP analysis expert with deep experience across industries. Analyze this RFP and determine optimal response approaches with user control options.

RFP Content: {rfp_text}
Company Profile: {company_profile.industry}, {company_profile.size}, {company_profile.location}
Company Capabilities: {company_profile.capabilities_overview}
User Goals: {user_goals}
Timeline: {timeline_days} days
Available Specialists: {available_agents}
User Intelligence: {user_intelligence}

ANALYSIS REQUIREMENTS:
1. Industry Classification and specialization with confidence levels
2. Complexity Assessment based on requirements depth, technical complexity, submission requirements
3. Strategic Focus Areas ranked by importance for winning
4. Multiple Approach Options: Accelerated (1-2 agents), Standard (4-5 agents), Comprehensive (all agents)
5. Resource Planning with time estimates for each approach
6. Risk Assessment with early warning flags

APPROACH PRESENTATION:
- Recommended approach with clear rationale
- Alternative approaches with trade-offs explained
- Custom agent selection option with specialist descriptions
- User intelligence integration opportunities
- Resource allocation transparency

Present analysis through interrupt() with approach selection options and intelligence gathering opportunities.
```

### Output Format
```json
{
  "rfp_analysis": {
    "industry": "Construction" | "Technology" | "Government" | "Professional Services" | "Healthcare",
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
  },
  "user_approach_selection": {
    "selected_agents": string[],
    "research_depth": "Basic" | "Standard" | "Deep",
    "custom_focus_areas": string[]
  },
  "early_risk_assessment": Array<{
    "risk": string,
    "severity": "Low" | "Medium" | "High",
    "mitigation": string,
    "confidence": number
  }>,
  "confidence_score": number
}
```

---

## 2. Enhanced Research Agent

### Role and Objectives
You are an Enhanced Research Agent responsible for gathering strategic intelligence about the funding organization. You stream discoveries in real-time and can trigger additional research or reassessment based on findings.

### LLM Model
Claude 3.5 Sonnet (strong synthesis capabilities for research analysis)

### Input Data
```typescript
{
  funder_name: string,
  rfp_analysis: {
    industry: string,
    specialization: string,
    strategic_focus: string[],
    complexity: string
  },
  user_approach_selection: {
    research_depth: string,
    custom_focus_areas: string[]
  },
  user_intelligence: Record<string, any>,
  research_iterations: number
}
```

### Available Tools
- `web_search`: For basic funder information and recent activities
- `deep_research_tool`: For comprehensive analysis of funder patterns and priorities

### Prompt Pattern
```
You are a strategic intelligence analyst specializing in funder research with real-time discovery capabilities.

Target Funder: {funder_name}
Industry Context: {rfp_analysis.industry} - {rfp_analysis.specialization}
Strategic Focus Areas: {rfp_analysis.strategic_focus}
Research Depth: {user_approach_selection.research_depth}
User Intelligence Available: {user_intelligence}
Research Iteration: {research_iterations}

RESEARCH STRATEGY:
1. Start with web_search for recent funder activity, integrating any user intelligence about recent changes
2. Use deep_research_tool for comprehensive analysis, focusing on user-specified areas of interest
3. Stream discoveries as they're found for real-time user awareness
4. Evaluate if complexity discovered matches initial assessment

INTELLIGENCE PRIORITIES:
- Organizational values and actual decision patterns vs. stated priorities
- Key decision makers, backgrounds, and recent changes (integrate user corrections)
- Recent procurement awards and winning strategies
- Language preferences and communication patterns
- Red flags, elimination factors, and political considerations
- Complexity indicators that might require approach reassessment

DISCOVERY EVALUATION:
- If findings reveal significantly higher complexity than assessed, set additional_research_requested
- If organizational structure/priorities differ fundamentally from RFP implications, trigger reassessment_requested
- Present findings via interrupt() for user validation and intelligence enhancement

Provide actionable intelligence that enables competitive advantage while identifying when approach adjustment is needed.
```

### Tool Usage
```typescript
// Tool 1: Basic funder research with user context
web_search({
  query: `${funder_name} recent awards procurement 2024 2025`,
  context: `${rfp_analysis.industry} ${user_intelligence.funder_context || ''}`
})

// Tool 2: Deep analysis incorporating user intelligence
deep_research_tool({
  topic: `${funder_name} decision making patterns and organizational priorities`,
  context: `${rfp_analysis.strategic_focus.join(', ')} with user insights: ${user_intelligence.decision_maker_updates || ''}`,
  focus_areas: [...rfp_analysis.strategic_focus, ...user_approach_selection.custom_focus_areas]
})
```

### Output Format
```json
{
  "funder_intelligence": {
    "organizational_priorities": Array<{
      "priority": string,
      "evidence": string,
      "user_validation": "confirmed" | "corrected" | "unknown",
      "strategic_importance": "High" | "Medium" | "Low",
      "confidence": number
    }>,
    "decision_makers": Array<{
      "name": string,
      "title": string,
      "background": string,
      "user_corrections": string,
      "influence_level": "High" | "Medium" | "Low",
      "strategic_notes": string
    }>,
    "recent_awards": Array<{
      "winner": string,
      "project": string,
      "award_date": string,
      "winning_factors": string[],
      "lessons_learned": string
    }>,
    "red_flags": Array<{
      "flag": string,
      "evidence": string,
      "mitigation_strategy": string,
      "severity": "Critical" | "High" | "Medium"
    }>,
    "language_preferences": {
      "preferred_terminology": string[],
      "organizational_tone": string,
      "values_emphasis": string[]
    }
  },
  "additional_research_requested": {
    "requested": boolean,
    "focus_areas": string[],
    "research_type": "deep_dive" | "specialist",
    "rationale": string
  },
  "reassessment_requested": {
    "requested": boolean,
    "reason": string,
    "new_complexity_assessment": string
  },
  "research_confidence": number
}
```

---

## 3. Deep Dive Research Agent

### Role and Objectives
You are a Deep Dive Research Agent deployed when initial research reveals additional complexity or specific focus areas requiring enhanced investigation.

### LLM Model
Claude 3.5 Sonnet (comprehensive analysis capabilities)

### Input Data
```typescript
{
  additional_research_requested: {
    focus_areas: string[],
    research_type: string,
    rationale: string
  },
  funder_intelligence: object,
  user_intelligence: Record<string, any>
}
```

### Available Tools
- `deep_research_tool`: For intensive research on specific focus areas

### Prompt Pattern
```
You are a specialized deep dive researcher focusing on specific intelligence gaps identified during initial research.

Focus Areas: {additional_research_requested.focus_areas}
Research Type: {additional_research_requested.research_type}
Initial Findings: {funder_intelligence}
User Intelligence: {user_intelligence}
Research Rationale: {additional_research_requested.rationale}

DEEP DIVE OBJECTIVES:
1. Intensive research on specified focus areas using deep_research_tool
2. Fill intelligence gaps identified during initial research
3. Validate or refute initial findings with additional evidence
4. Integrate user intelligence to guide research direction
5. Provide enhanced confidence levels for critical findings

Focus on areas where additional depth will significantly improve strategic positioning and competitive advantage.
```

### Output Format
```json
{
  "enhanced_intelligence": {
    "focus_area_findings": Record<string, {
      "detailed_analysis": string,
      "additional_evidence": string[],
      "confidence_improvement": number,
      "strategic_implications": string[]
    }>,
    "validated_findings": string[],
    "refuted_findings": string[],
    "new_discoveries": string[]
  },
  "research_confidence": number
}
```

---

## 4. Reassessment Orchestrator Agent

### Role and Objectives
You are a Reassessment Orchestrator Agent deployed when research discoveries indicate the initial RFP assessment was significantly incorrect, requiring strategy adjustment.

### LLM Model
Claude 3.5 Sonnet (strategic reasoning for approach revision)

### Input Data
```typescript
{
  rfp_analysis: object,
  funder_intelligence: object,
  industry_requirements: object,
  competitive_landscape: object,
  reassessment_requested: {
    reason: string,
    new_complexity_assessment: string,
    requesting_agent: string
  },
  user_intelligence: Record<string, any>
}
```

### Available Tools
None - performs analysis using provided intelligence

### Prompt Pattern
```
You are a strategic reassessment expert responsible for revising approach when research reveals fundamental changes needed.

Original Assessment: {rfp_analysis}
Research Discoveries: {funder_intelligence}, {industry_requirements}, {competitive_landscape}
Reassessment Trigger: {reassessment_requested.reason}
New Complexity Indication: {reassessment_requested.new_complexity_assessment}
User Intelligence: {user_intelligence}

REASSESSMENT PROCESS:
1. Compare original assessment with research discoveries
2. Identify specific areas where assessment was incorrect
3. Develop revised strategy recommendations
4. Present changes via interrupt() for user approval
5. Update approach selection and agent deployment as needed

Focus on strategic implications of assessment changes and their impact on competitive positioning.
```

### Output Format
```json
{
  "revised_assessment": {
    "complexity_change": "increased" | "decreased" | "different_type",
    "industry_refinement": string,
    "strategic_focus_updates": string[],
    "approach_recommendations": {
      "additional_agents_needed": string[],
      "research_depth_adjustment": string,
      "timeline_impact": string
    }
  },
  "strategy_impact": {
    "major_changes_required": string[],
    "competitive_implications": string[],
    "risk_profile_changes": string[]
  }
}
```

---

## 5. Industry Specialist Agent

### Role and Objectives
You are an Industry Specialist Agent responsible for identifying sector-specific requirements, standards, and compliance frameworks with enhanced user intelligence integration.

### LLM Model
Claude 3.5 Sonnet with web search (domain expertise with current information)

### Input Data
```typescript
{
  rfp_analysis: {
    industry: string,
    specialization: string,
    strategic_focus: string[]
  },
  user_intelligence: Record<string, any>
}
```

### Available Tools
- `web_search`: For current industry standards and regulatory requirements
- `deep_research_tool`: For comprehensive industry analysis and best practices

### Prompt Pattern
```
You are an industry compliance and standards expert specializing in {rfp_analysis.industry} with deep knowledge of {rfp_analysis.specialization}.

Industry Focus: {rfp_analysis.industry}
Specialization: {rfp_analysis.specialization}  
Strategic Context: {rfp_analysis.strategic_focus}
User Intelligence: {user_intelligence}

RESEARCH PRIORITIES:
1. Use web_search for current regulatory frameworks, incorporating user knowledge of recent changes
2. Use deep_research_tool for comprehensive analysis of industry best practices
3. Integrate user intelligence about specific industry considerations or recent developments

ANALYSIS REQUIREMENTS:
- Mandatory compliance frameworks and regulatory requirements
- Professional certifications, licenses, and qualification standards
- Technical performance benchmarks and quality standards
- Industry-specific evaluation criteria and success metrics
- Common proposal failures and oversight areas (enhanced by user experience)
- Current trends affecting requirements and expectations

Focus on requirements that could eliminate proposals if missed, enhanced by user industry knowledge.
```

### Output Format
```json
{
  "industry_requirements": {
    "mandatory_compliance": Array<{
      "requirement": string,
      "regulation_source": string,
      "compliance_method": string,
      "verification_needed": string,
      "user_notes": string
    }>,
    "professional_qualifications": Array<{
      "qualification": string,
      "required_for": string,
      "certification_body": string,
      "typical_cost_time": string
    }>,
    "technical_standards": Array<{
      "standard": string,
      "application": string,
      "performance_benchmark": string,
      "measurement_method": string
    }>,
    "common_oversights": Array<{
      "oversight": string,
      "frequency": "Very Common" | "Common" | "Occasional",
      "impact": "Elimination" | "Point Deduction" | "Competitive Disadvantage",
      "prevention_method": string,
      "user_experience": string
    }>,
    "evaluation_benchmarks": {
      "technical_competence": string,
      "compliance_demonstration": string,
      "quality_indicators": string[]
    }
  },
  "industry_confidence": number
}
```

---

## 6. Competitive Intelligence Agent

### Role and Objectives
You are a Competitive Intelligence Agent responsible for analyzing the competitive landscape using enhanced funder intelligence and user market knowledge.

### LLM Model
Claude 3.5 Sonnet with web search (analytical capabilities with current market data)

### Input Data
```typescript
{
  funder_name: string,
  rfp_analysis: {
    industry: string,
    specialization: string,
    contract_value_estimate: string
  },
  funder_intelligence: {
    recent_awards: Array<{
      winner: string,
      project: string,
      winning_factors: string[]
    }>
  },
  user_intelligence: Record<string, any>
}
```

### Available Tools
- `web_search`: For competitor identification and basic capability research
- `deep_research_tool`: For comprehensive competitive analysis and market intelligence

### Prompt Pattern
```
You are a competitive intelligence analyst specializing in procurement and market analysis with user market insights.

Target Opportunity: {funder_name} - {rfp_analysis.specialization}
Market Context: {rfp_analysis.industry}
Contract Value: {rfp_analysis.contract_value_estimate}
Historical Winners: {funder_intelligence.recent_awards}
User Market Intelligence: {user_intelligence}

INTELLIGENCE OBJECTIVES:
1. Use web_search to identify likely competitors, incorporating user knowledge of market players
2. Use deep_research_tool for comprehensive competitive analysis
3. Integrate user insights about competitor strengths/weaknesses and recent market changes

ANALYSIS FOCUS:
- Likely competitors based on funder patterns, project scope, and user market knowledge
- Competitor strengths, weaknesses, and positioning strategies (enhanced by user insights)
- Pricing patterns and market rates for similar projects
- Competitive advantages available and market positioning gaps
- Recent competitive outcomes and lessons learned
- Market trends affecting competitive dynamics

Provide actionable competitive intelligence enhanced by user market knowledge.
```

### Output Format
```json
{
  "competitive_landscape": {
    "likely_competitors": Array<{
      "name": string,
      "probability": "High" | "Medium" | "Low",
      "strengths": string[],
      "weaknesses": string[],
      "typical_positioning": string,
      "past_performance_with_funder": string,
      "user_insights": string
    }>,
    "market_positioning": {
      "positioning_gaps": string[],
      "differentiation_opportunities": string[],
      "competitive_advantages_available": string[]
    },
    "pricing_intelligence": {
      "typical_range": string,
      "pricing_strategies": string[],
      "cost_factors": string[],
      "value_positioning_opportunities": string[]
    },
    "winning_strategies": Array<{
      "strategy": string,
      "success_examples": string,
      "applicability": "High" | "Medium" | "Low"
    }>,
    "competitive_threats": Array<{
      "threat": string,
      "competitor": string,
      "mitigation": string,
      "urgency": "High" | "Medium" | "Low"
    }>
  },
  "competitive_confidence": number
}
```

---

## 7. Requirement Analysis Agent

### Role and Objectives
You are a Requirement Analysis Agent responsible for comprehensive extraction and analysis of all RFP requirements enhanced by user intelligence and research findings.

### LLM Model
Claude 3.5 Sonnet (excellent at systematic analysis and requirement extraction)

### Input Data
```typescript
{
  rfp_text: string,
  funder_intelligence: {
    organizational_priorities: Array<object>,
    red_flags: Array<object>
  },
  industry_requirements: {
    mandatory_compliance: Array<object>,
    common_oversights: Array<object>
  },
  user_intelligence: Record<string, any>,
  research_iterations: number
}
```

### Available Tools
None - performs comprehensive analysis using provided intelligence and RFP text

### Prompt Pattern
```
You are a requirements analysis expert specializing in comprehensive requirement extraction enhanced by intelligence synthesis.

RFP Document: {rfp_text}
Funder Priorities: {funder_intelligence.organizational_priorities}
Funder Red Flags: {funder_intelligence.red_flags}
Industry Standards: {industry_requirements.mandatory_compliance}
Common Oversights: {industry_requirements.common_oversights}
User Intelligence: {user_intelligence}
Research Context: Enhanced by {research_iterations} research iterations

ANALYSIS PROCESS:
1. Systematically extract all explicit requirements from RFP text with exact source locations
2. Identify implicit requirements based on funder intelligence, industry standards, and user knowledge
3. Categorize requirements by type, mandatory level, and strategic importance
4. Prioritize requirements based on funder behavior patterns and user insights
5. Map requirement interdependencies and compliance verification methods
6. Integrate user intelligence about unstated expectations or recent requirement changes

REQUIREMENT CATEGORIES:
- Explicit: Directly stated in RFP with specific language and location
- Implicit: Unstated but expected based on industry standards or funder patterns
- Hidden: Requirements discoverable only through intelligence analysis
- User-Identified: Requirements or nuances identified through user experience

Ensure comprehensive coverage with no missed requirements and accurate priority ranking based on all available intelligence.
```

### Output Format
```json
{
  "comprehensive_requirements": {
    "explicit_requirements": Array<{
      "requirement": string,
      "source_location": string,
      "exact_language": string,
      "category": "Technical" | "Administrative" | "Qualification" | "Performance",
      "mandatory_level": "Mandatory" | "Optional" | "Preferred",
      "compliance_method": string,
      "verification_needed": string
    }>,
    "implicit_requirements": Array<{
      "requirement": string,
      "source_basis": "Industry Standard" | "Funder Pattern" | "User Intelligence" | "Regulatory Compliance",
      "rationale": string,
      "recommended_approach": string,
      "risk_if_missed": "High" | "Medium" | "Low"
    }>,
    "requirement_priorities": Array<{
      "requirement_id": string,
      "priority_score": number,
      "priority_basis": string,
      "competitive_importance": "Critical" | "Important" | "Standard"
    }>,
    "requirement_interdependencies": Array<{
      "primary_requirement": string,
      "dependent_requirements": string[],
      "relationship_type": "Prerequisite" | "Supporting" | "Alternative"
    }>
  },
  "compliance_roadmap": {
    "critical_path_requirements": string[],
    "early_action_items": string[],
    "documentation_needed": string[]
  },
  "analysis_confidence": number
}
```

---

## 8. Evaluation Prediction Agent

### Role and Objectives
You are an Evaluation Prediction Agent responsible for predicting how proposals will actually be evaluated versus stated criteria, enhanced by comprehensive intelligence.

### LLM Model
Claude 3.5 Sonnet (strong analytical reasoning for pattern recognition)

### Input Data
```typescript
{
  rfp_text: string,
  funder_intelligence: {
    organizational_priorities: Array<object>,
    recent_awards: Array<object>,
    decision_makers: Array<object>
  },
  comprehensive_requirements: {
    explicit_requirements: Array<object>,
    requirement_priorities: Array<object>
  },
  user_intelligence: Record<string, any>
}
```

### Available Tools
None - performs analysis using provided intelligence and stated evaluation criteria

### Prompt Pattern
```
You are an evaluation methodology expert specializing in predicting actual vs. stated decision-making processes.

RFP Evaluation Criteria: Extract from {rfp_text}
Funder Priorities: {funder_intelligence.organizational_priorities}
Historical Patterns: {funder_intelligence.recent_awards}
Decision Makers: {funder_intelligence.decision_makers}
Requirements Analysis: {comprehensive_requirements.requirement_priorities}
User Intelligence: {user_intelligence}

PREDICTION METHODOLOGY:
1. Extract stated evaluation criteria and weighting from RFP
2. Analyze funder intelligence to identify real vs. stated priorities
3. Predict evaluation sequence, elimination factors, and scoring methodology
4. Identify key decision points and stakeholder influence patterns
5. Forecast success factors based on historical patterns and decision maker backgrounds
6. Integrate user knowledge of evaluation processes or political considerations

ANALYSIS FOCUS:
- Real vs. stated criteria weighting based on funder behavior and user insights
- Evaluation stages and elimination thresholds
- Decision-making timeline and critical approval points
- Evaluator priorities and scoring biases (informed by user experience)
- Political considerations and stakeholder influence
- Success factors that differentiate winning proposals

Base predictions on evidence from all intelligence sources, not generic evaluation practices.
```

### Output Format
```json
{
  "evaluation_prediction": {
    "evaluation_stages": Array<{
      "stage": string,
      "purpose": string,
      "timeline": string,
      "criteria": string[],
      "elimination_potential": boolean
    }>,
    "real_vs_stated_weighting": {
      "stated_weights": Record<string, number>,
      "predicted_actual_weights": Record<string, number>,
      "weighting_rationale": Record<string, string>
    },
    "elimination_factors": Array<{
      "factor": string,
      "stage": string,
      "evidence": string,
      "mitigation": string
    }>,
    "decision_process": {
      "primary_evaluators": string[],
      "decision_makers": string[],
      "influence_factors": string[],
      "political_considerations": string[]
    },
    "scoring_methodology": {
      "scoring_approach": string,
      "evaluator_priorities": string[],
      "tie_breaking_factors": string[],
      "common_point_deductions": string[]
    },
    "success_factors": Array<{
      "factor": string,
      "importance": "Critical" | "Important" | "Helpful",
      "evidence_needed": string,
      "competitive_advantage_potential": boolean
    }>
  },
  "prediction_confidence": number
}
```

---

## 9. Solution Decoder Agent

### Role and Objectives
You are a Solution Decoder Agent responsible for synthesizing all intelligence into clear solution requirements and optimal approach, with support for strategic exploration.

### LLM Model
Claude 3.5 Sonnet (excellent synthesis and strategic reasoning capabilities)

### Input Data
```typescript
{
  comprehensive_requirements: object,
  funder_intelligence: object,
  evaluation_prediction: object,
  competitive_landscape: object,
  industry_requirements: object,
  user_intelligence: Record<string, any>
}
```

### Available Tools
None - performs synthesis using all provided intelligence

### Prompt Pattern
```
You are a solution strategy expert specializing in translating requirements and intelligence into winning solution approaches with strategic alternatives.

Requirements Analysis: {comprehensive_requirements.requirement_priorities}
Funder Priorities: {funder_intelligence.organizational_priorities}
Evaluation Reality: {evaluation_prediction.real_vs_stated_weighting}
Competitive Context: {competitive_landscape.market_positioning}
Industry Standards: {industry_requirements.evaluation_benchmarks}
Success Factors: {evaluation_prediction.success_factors}
Elimination Risks: {evaluation_prediction.elimination_factors}
User Intelligence: {user_intelligence}

SYNTHESIS REQUIREMENTS:
1. Integrate all intelligence sources to identify real solution priorities vs. stated requirements
2. Determine optimal solution approach that maximizes winning probability
3. Generate alternative strategic approaches for user exploration
4. Define success criteria and competitive positioning requirements
5. Identify risk factors and mitigation strategies
6. Establish solution framework that aligns with funder values and decision patterns

STRATEGIC EXPLORATION:
- Develop multiple viable approaches with different competitive positioning
- Present approaches via interrupt() for user selection or exploration
- Support checkpointing for alternative approach comparison
- Enable combination of elements from different approaches

Focus on actionable solution direction that addresses real priorities and competitive requirements while offering strategic flexibility.
```

### Output Format
```json
{
  "solution_requirements": {
    "real_priorities": Array<{
      "priority": string,
      "importance_weight": number,
      "evidence_basis": string,
      "required_approach": string
    }>,
    "optimal_solution_approach": {
      "methodology": string,
      "key_components": string[],
      "differentiating_factors": string[],
      "success_metrics": string[]
    },
    "alternative_approaches": Array<{
      "name": string,
      "methodology": string,
      "competitive_positioning": string,
      "trade_offs": string[],
      "best_for": string
    }>,
    "success_criteria": Array<{
      "criterion": string,
      "measurement_method": string,
      "target_performance": string,
      "competitive_benchmark": string
    }>,
    "risk_factors": Array<{
      "risk": string,
      "impact": "Elimination" | "Significant" | "Moderate",
      "mitigation_required": string,
      "monitoring_needed": boolean
    }>,
    "competitive_requirements": {
      "must_haves": string[],
      "differentiators": string[],
      "table_stakes": string[]
    }
  },
  "exploration_mode": {
    "active": boolean,
    "available_approaches": string[],
    "comparison_framework": object
  },
  "solution_confidence": number
}
```

---

## 10. Strategic Exploration Hub Agent

### Role and Objectives
You are a Strategic Exploration Hub Agent responsible for managing user exploration of alternative strategic approaches using checkpointing and comparison frameworks.

### LLM Model
Claude 3.5 Sonnet (strategic analysis and comparison capabilities)

### Input Data
```typescript
{
  solution_requirements: {
    alternative_approaches: Array<object>,
    optimal_solution_approach: object
  },
  exploration_mode: {
    current_approach: string,
    comparison_framework: object
  },
  user_intelligence: Record<string, any>
}
```

### Available Tools
- `company_knowledge_rag`: For finding capabilities that match different strategic approaches

### Prompt Pattern
```
You are a strategic exploration expert enabling user comparison and selection of alternative approaches.

Available Approaches: {solution_requirements.alternative_approaches}
Current Exploration: {exploration_mode.current_approach}
Comparison Framework: {exploration_mode.comparison_framework}
User Intelligence: {user_intelligence}

EXPLORATION PROCESS:
1. Use company_knowledge_rag to find capabilities matching current approach
2. Develop positioning framework for current approach
3. Present approach summary with navigation options
4. Enable comparison with other approaches using checkpointing
5. Support combination of elements from different approaches

NAVIGATION OPTIONS:
- Explore next alternative approach
- Modify current approach based on user insights
- Combine elements from multiple approaches
- Select current approach and proceed
- Return to baseline for different exploration path

Focus on helping user understand trade-offs and competitive implications of each approach.
```

### Output Format
```json
{
  "current_approach_analysis": {
    "approach_name": string,
    "positioning_preview": string,
    "competitive_advantages": string[],
    "implementation_requirements": string[],
    "success_probability": number
  },
  "comparison_data": {
    "vs_other_approaches": object,
    "trade_off_analysis": object,
    "user_preference_alignment": object
  },
  "navigation_options": {
    "available_actions": string[],
    "recommended_next_step": string,
    "checkpoint_references": string[]
  }
}
```

---

## 11. Strategic Positioning Agent

### Role and Objectives
You are a Strategic Positioning Agent responsible for developing winning positioning and messaging strategy based on selected solution approach and comprehensive intelligence.

### LLM Model
Claude 3.5 Sonnet (strong strategic thinking and messaging capabilities)

### Input Data
```typescript
{
  solution_requirements: {
    real_priorities: Array<object>,
    optimal_solution_approach: object,
    competitive_requirements: object
  },
  competitive_landscape: {
    likely_competitors: Array<object>,
    market_positioning: object,
    competitive_threats: Array<object>
  },
  funder_intelligence: {
    language_preferences: object
  },
  user_intelligence: Record<string, any>
}
```

### Available Tools
- `company_knowledge_rag`: For finding relevant company capabilities and proof points

### Prompt Pattern
```
You are a strategic positioning expert specializing in competitive differentiation and value proposition development.

Solution Priorities: {solution_requirements.real_priorities}
Selected Approach: {solution_requirements.optimal_solution_approach}
Competitive Context: {competitive_landscape.market_positioning}
Funder Language: {funder_intelligence.language_preferences}
Required Differentiators: {solution_requirements.competitive_requirements}
User Intelligence: {user_intelligence}

POSITIONING PROCESS:
1. Use company_knowledge_rag to find capabilities matching solution priorities and competitive requirements
2. Develop strategic positioning framework that differentiates against competitors
3. Create value propositions using funder's preferred language and values
4. Build proof point strategy with specific company evidence
5. Design risk mitigation messaging for potential concerns
6. Present positioning via interrupt() for user refinement

STRATEGIC FRAMEWORK:
- Positioning statement that clearly differentiates from competitors
- Value propositions in funder's priority language and terminology
- Key message hierarchy aligned with real priorities and evaluation weighting
- Proof point strategy with specific, quantifiable company evidence
- Win themes that resonate with funder values and decision makers
- Risk mitigation messaging that addresses elimination factors

Enable iterative refinement based on user feedback and market knowledge.
```

### Tool Usage
```typescript
// Search for relevant company capabilities
company_knowledge_rag({
  query: solution_requirements.real_priorities.map(p => p.priority).join(' '),
  context: solution_requirements.optimal_solution_approach.methodology,
  evidence_type: "projects metrics testimonials qualifications"
})
```

### Output Format
```json
{
  "strategic_framework": {
    "positioning_statement": string,
    "value_proposition": string,
    "primary_message": string,
    "supporting_messages": string[],
    "win_themes": string[]
  },
  "proof_point_strategy": Array<{
    "claim": string,
    "evidence": string,
    "source": string,
    "competitive_advantage": string,
    "strength": "Strong" | "Moderate" | "Adequate"
  }>,
  "competitive_differentiation": {
    "unique_strengths": string[],
    "competitive_advantages": string[],
    "market_positioning": string,
    "differentiation_sustainability": string
  },
  "risk_mitigation": Array<{
    "concern": string,
    "mitigation_message": string,
    "supporting_evidence": string,
    "confidence_level": number
  }>,
  "messaging_framework": {
    "key_terminology": string[],
    "tone_and_style": string,
    "emphasis_areas": string[],
    "consistency_guidelines": string[]
  },
  "strategy_confidence": number
}
```

---

## State Graph Structure

### Main State Annotation
```typescript
const PlanningPhaseAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  
  // Phase tracking
  current_phase: Annotation<string>,
  planning_complete: Annotation<boolean>,
  
  // User intelligence and control
  user_intelligence: Annotation<Record<string, any>>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({})
  }),
  user_approach_selection: Annotation<{
    selected_agents: string[],
    research_depth: string,
    custom_focus_areas: string[]
  }>,
  available_agents: Annotation<string[]>({
    default: () => ["enhanced_research", "industry_specialist", "competitive_intelligence", 
                   "requirement_analysis", "evaluation_prediction", "solution_decoder", "strategic_positioning"]
  }),
  
  // Dynamic flow control
  additional_research_requested: Annotation<{
    requested: boolean,
    focus_areas: string[],
    research_type: string,
    requesting_agent: string
  }>({
    default: () => ({ requested: false, focus_areas: [], research_type: "", requesting_agent: "" })
  }),
  reassessment_requested: Annotation<{
    requested: boolean,
    reason: string,
    requesting_agent: string,
    new_complexity_assessment: string
  }>({
    default: () => ({ requested: false, reason: "", requesting_agent: "", new_complexity_assessment: "" })
  }),
  research_iterations: Annotation<number>({
    default: () => 0
  }),
  
  // Orchestrator outputs
  rfp_analysis: Annotation<{
    industry: string,
    specialization: string,
    complexity: string,
    complexity_factors: string[],
    contract_value_estimate: string,
    timeline_pressure: string,
    strategic_focus: string[],
    submission_requirements: {
      page_limit: number | "not_specified",
      sections_required: string[],
      attachments_needed: string[]
    }
  }>,
  early_risk_assessment: Annotation<Array<{
    risk: string,
    severity: string,
    mitigation: string,
    confidence: number
  }>>,
  
  // Research agent outputs
  funder_intelligence: Annotation<{
    organizational_priorities: Array<{
      priority: string,
      evidence: string,
      user_validation: string,
      strategic_importance: string,
      confidence: number
    }>,
    decision_makers: Array<{
      name: string,
      title: string,
      background: string,
      user_corrections: string,
      influence_level: string,
      strategic_notes: string
    }>,
    recent_awards: Array<{
      winner: string,
      project: string,
      award_date: string,
      winning_factors: string[],
      lessons_learned: string
    }>,
    red_flags: Array<{
      flag: string,
      evidence: string,
      mitigation_strategy: string,
      severity: string
    }>,
    language_preferences: {
      preferred_terminology: string[],
      organizational_tone: string,
      values_emphasis: string[]
    }
  }>,
  
  industry_requirements: Annotation<{
    mandatory_compliance: Array<{
      requirement: string,
      regulation_source: string,
      compliance_method: string,
      verification_needed: string,
      user_notes: string
    }>,
    professional_qualifications: Array<{
      qualification: string,
      required_for: string,
      certification_body: string,
      typical_cost_time: string
    }>,
    technical_standards: Array<{
      standard: string,
      application: string,
      performance_benchmark: string,
      measurement_method: string
    }>,
    common_oversights: Array<{
      oversight: string,
      frequency: string,
      impact: string,
      prevention_method: string,
      user_experience: string
    }>,
    evaluation_benchmarks: {
      technical_competence: string,
      compliance_demonstration: string,
      quality_indicators: string[]
    }
  }>,
  
  competitive_landscape: Annotation<{
    likely_competitors: Array<{
      name: string,
      probability: string,
      strengths: string[],
      weaknesses: string[],
      typical_positioning: string,
      past_performance_with_funder: string,
      user_insights: string
    }>,
    market_positioning: {
      positioning_gaps: string[],
      differentiation_opportunities: string[],
      competitive_advantages_available: string[]
    },
    pricing_intelligence: {
      typical_range: string,
      pricing_strategies: string[],
      cost_factors: string[],
      value_positioning_opportunities: string[]
    },
    winning_strategies: Array<{
      strategy: string,
      success_examples: string,
      applicability: string
    }>,
    competitive_threats: Array<{
      threat: string,
      competitor: string,
      mitigation: string,
      urgency: string
    }>
  }>,
  
  // Analysis agent outputs
  comprehensive_requirements: Annotation<{
    explicit_requirements: Array<{
      requirement: string,
      source_location: string,
      exact_language: string,
      category: string,
      mandatory_level: string,
      compliance_method: string,
      verification_needed: string
    }>,
    implicit_requirements: Array<{
      requirement: string,
      source_basis: string,
      rationale: string,
      recommended_approach: string,
      risk_if_missed: string
    }>,
    requirement_priorities: Array<{
      requirement_id: string,
      priority_score: number,
      priority_basis: string,
      competitive_importance: string
    }>,
    requirement_interdependencies: Array<{
      primary_requirement: string,
      dependent_requirements: string[],
      relationship_type: string
    }>
  }>,
  
  evaluation_prediction: Annotation<{
    evaluation_stages: Array<{
      stage: string,
      purpose: string,
      timeline: string,
      criteria: string[],
      elimination_potential: boolean
    }>,
    real_vs_stated_weighting: {
      stated_weights: Record<string, number>,
      predicted_actual_weights: Record<string, number>,
      weighting_rationale: Record<string, string>
    },
    elimination_factors: Array<{
      factor: string,
      stage: string,
      evidence: string,
      mitigation: string
    }>,
    decision_process: {
      primary_evaluators: string[],
      decision_makers: string[],
      influence_factors: string[],
      political_considerations: string[]
    },
    scoring_methodology: {
      scoring_approach: string,
      evaluator_priorities: string[],
      tie_breaking_factors: string[],
      common_point_deductions: string[]
    },
    success_factors: Array<{
      factor: string,
      importance: string,
      evidence_needed: string,
      competitive_advantage_potential: boolean
    }>
  }>,
  
  solution_requirements: Annotation<{
    real_priorities: Array<{
      priority: string,
      importance_weight: number,
      evidence_basis: string,
      required_approach: string
    }>,
    optimal_solution_approach: {
      methodology: string,
      key_components: string[],
      differentiating_factors: string[],
      success_metrics: string[]
    },
    alternative_approaches: Array<{
      name: string,
      methodology: string,
      competitive_positioning: string,
      trade_offs: string[],
      best_for: string
    }>,
    success_criteria: Array<{
      criterion: string,
      measurement_method: string,
      target_performance: string,
      competitive_benchmark: string
    }>,
    risk_factors: Array<{
      risk: string,
      impact: string,
      mitigation_required: string,
      monitoring_needed: boolean
    }>,
    competitive_requirements: {
      must_haves: string[],
      differentiators: string[],
      table_stakes: string[]
    }
  }>,
  
  exploration_mode: Annotation<{
    active: boolean,
    current_approach: string,
    available_approaches: string[],
    comparison_framework: object,
    baseline_checkpoint: string
  }>({
    default: () => ({ active: false, current_approach: "", available_approaches: [], comparison_framework: {}, baseline_checkpoint: "" })
  }),
  
  // Strategic outputs
  strategic_framework: Annotation<{
    positioning_statement: string,
    value_proposition: string,
    primary_message: string,
    supporting_messages: string[],
    win_themes: string[]
  }>,
  
  proof_point_strategy: Annotation<Array<{
    claim: string,
    evidence: string,
    source: string,
    competitive_advantage: string,
    strength: string
  }>>,
  
  competitive_differentiation: Annotation<{
    unique_strengths: string[],
    competitive_advantages: string[],
    market_positioning: string,
    differentiation_sustainability: string
  }>,
  
  risk_mitigation: Annotation<Array<{
    concern: string,
    mitigation_message: string,
    supporting_evidence: string,
    confidence_level: number
  }>>,
  
  messaging_framework: Annotation<{
    key_terminology: string[],
    tone_and_style: string,
    emphasis_areas: string[],
    consistency_guidelines: string[]
  }>,
  
  // User interactions
  user_approvals: Annotation<Record<string, boolean>>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({})
  }),
  user_modifications: Annotation<Record<string, any>>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({})
  })
})
```

### Graph Flow Structure
```typescript
const planningGraph = new StateGraph(PlanningPhaseAnnotation)
  // Core orchestration
  .addNode("master_orchestrator", masterOrchestratorAgent)
  .addNode("reassessment_orchestrator", reassessmentOrchestratorAgent)
  
  // Research phase
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
  .addNode("planning_complete", planningCompleteNode)
  
  // Flow definition with conditional routing
  .addEdge(START, "master_orchestrator")
  .addConditionalEdges("master_orchestrator", routeAfterOrchestration)
  .addConditionalEdges("enhanced_research", routeAfterEnhancedResearch)
  .addEdge("deep_dive_research", "industry_specialist")
  .addEdge("industry_specialist", "competitive_intelligence")
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

### Key Routing Functions
```typescript
// Extract funder name utility function
const extractFunderName = (rfpText: string): string => {
  // Implementation: regex patterns or simple LLM call to extract organization name
  // Returns the primary funding organization name from RFP text
}

// Route after orchestrator based on user approval
const routeAfterOrchestration = (state: typeof PlanningPhaseAnnotation.State) => {
  if (state.user_approvals.orchestrator_analysis) {
    return "enhanced_research";
  }
  return "master_orchestrator"; // Loop back for revisions
}

// Route after enhanced research based on requests
const routeAfterEnhancedResearch = (state: typeof PlanningPhaseAnnotation.State) => {
  if (state.additional_research_requested.requested && state.user_approvals.additional_research) {
    return "deep_dive_research";
  }
  if (state.reassessment_requested.requested && state.user_approvals.reassessment) {
    return "reassessment_orchestrator";
  }
  return "industry_specialist";
}

// Route after requirement analysis
const routeAfterRequirementAnalysis = (state: typeof PlanningPhaseAnnotation.State) => {
  if (state.reassessment_requested.requested && state.user_approvals.reassessment) {
    return "reassessment_orchestrator";
  }
  return "evaluation_prediction";
}

// Route after solution decoding for exploration
const routeAfterSolutionDecoding = (state: typeof PlanningPhaseAnnotation.State) => {
  if (state.exploration_mode.active) {
    return "strategic_exploration_hub";
  }
  return "strategic_positioning";
}

// Route after positioning
const routeAfterPositioning = (state: typeof PlanningPhaseAnnotation.State) => {
  if (state.user_approvals.positioning_refinement_requested) {
    return "strategic_positioning"; // Loop for refinement
  }
  return "planning_complete";
}

// Route exploration paths
const routeExplorationPath = (state: typeof PlanningPhaseAnnotation.State) => {
  const action = state.user_modifications.exploration_action;
  if (action === "explore_next" || action === "modify_approach") {
    return "strategic_exploration_hub"; // Continue exploration
  }
  if (action === "select_approach") {
    return "strategic_positioning"; // Finalize with selected approach
  }
  if (action === "return_baseline") {
    // Use checkpointing to return to baseline - handled by LangGraph
    return "solution_decoder";
  }
  return "planning_complete";
}

// Route after reassessment
const routeAfterReassessment = (state: typeof PlanningPhaseAnnotation.State) => {
  const changes = state.user_modifications.reassessment_changes;
  if (changes.restart_research) {
    return "enhanced_research"; // Restart with new approach
  }
  if (changes.continue_with_updates) {
    return "requirement_analysis"; // Continue with updated context
  }
  return "planning_complete"; // User decided to proceed as-is
}
```

This foundation provides complete architectural specifications for implementing the planning phase with dynamic user collaboration, intelligent adaptability, and natural flow using native LangGraph patterns.