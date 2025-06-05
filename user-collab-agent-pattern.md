# 🤝 Dynamic User Collaboration Add-On Prompt

reference docs for core langgraph patterns:
https://langchain-ai.github.io/langgraphjs/concepts/streaming/ 
https://langchain-ai.github.io/langgraphjs/concepts/multi_agent/  
https://langchain-ai.github.io/langgraphjs/concepts/agentic_concepts/ 
https://langchain-ai.github.io/langgraphjs/concepts/low_level/  
https://langchain-ai.github.io/langgraphjs/concepts/time-travel/ 
https://langchain-ai.github.io/langgraphjs/tutorials/multi_agent/agent_supervisor/
https://langchain-ai.github.io/langgraphjs/tutorials/multi_agent/hierarchical_agent_teams/ 
https://langchain-ai.github.io/langgraphjs/tutorials/plan-and-execute/plan-and-execute/
https://langchain-ai.github.io/langgraphjs/how-tos/tool-calling/
https://langchain-ai.github.io/langgraphjs/concepts/human_in_the_loop/

## Core Principle: Complete Collaborative Intelligence

You are building a **Complete Collaborative Intelligence System** that enables truly dynamic user collaboration. This means users can iteratively refine your outputs through natural conversation, and you will **intelligently act on their feedback** rather than just acknowledging it.

## 📋 **Implementation Structure: The 4-Node Collaboration Pattern**

### **Required Architecture**: Generator → Validation → Feedback Processing → Refinement

#### **🔨 Content Generator Node**

- **Purpose**: Create initial content based on relevant context (not entire state)
- **Must Include**:
  - Generated content stored in dedicated state field
  - Initial confidence score (0.0-1.0)
  - Set `pendingValidation: true`
- **Example**: _"I've analyzed the RFP and created a research strategy. Here's what I found..."_

**📝 Code Example from RFP Analyzer:**

```typescript
// From: apps/backend/agents/proposal-generation/nodes/planning/rfp-analysis/rfp_analyzer.ts
export async function rfpAnalyzerNode(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  // Generate initial analysis content
  const rfpAnalysis = await analyzeRfpDocument(rfpText);
  const strategicInsights = await extractStrategicInsights(
    rfpText,
    rfpAnalysis
  );

  // Store content with confidence scoring
  const updatedState: Partial<OverallProposalState> = {
    currentStep: "rfp_analysis_complete",
    planningIntelligence: {
      rfpCharacteristics: {
        industry: rfpAnalysis.industry,
        specialization: rfpAnalysis.specialization,
        complexity: rfpAnalysis.complexity,
        // ... complete analysis data
      },
      earlyRiskAssessment: {
        riskIndicators: rfpAnalysis.riskIndicators,
        strategicInsights: strategicInsights,
        analysisConfidence: calculateConfidenceScore(strategicInsights),
        requiresUserValidation: true,
      },
    },
    // Prepare for user collaboration
    userCollaboration: {
      userQueries: [...collaborationCheckpoint.userQuestions],
      strategicRecommendations:
        collaborationCheckpoint.strategicRecommendations,
    },
  };

  return updatedState;
}
```

#### **✅ Validation Checkpoint Node**

- **Purpose**: Present content for user review with intelligent options
- **Must Include**:
  - Clear summary of what was generated
  - **3-5 context-specific validation options** (not generic approve/reject)
  - Current refinement round indicator (Round 1 of 3)
  - Confidence level display
- **Uses**: `interrupt()` mechanism to pause for user input
- **Example Options**:
  - _"Looks comprehensive - proceed to next phase"_
  - _"Add more focus on funder's evaluation criteria"_
  - _"Include analysis of unsuccessful proposals"_
  - _"Adjust to emphasize innovation aspects"_
  - _"Start over with different approach"_

**📝 Code Example from RFP Analyzer:**

```typescript
// From: apps/backend/agents/proposal-generation/nodes/planning/rfp-analysis/rfp_analyzer.ts
export async function strategicValidationCheckpoint(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  // Find queries requiring user response (handles both original and refined)
  const latestQuery = state.userCollaboration?.userQueries?.find(
    (query) =>
      !query.response &&
      (query.id.includes("strategic_priorities") ||
        query.id.includes("refined_strategic_priorities"))
  );

  if (!latestQuery) {
    return { currentStep: "strategic_validation_complete" };
  }

  // Use LangGraph interrupt for human-in-the-loop
  const userResponse = interrupt({
    type: "strategic_validation",
    question: latestQuery.question,
    options: latestQuery.options, // Context-specific options
    context: latestQuery.context,
    metadata: {
      reason: InterruptReason.CONTENT_REVIEW,
      nodeId: "strategicValidationCheckpoint",
      timestamp: new Date().toISOString(),
      contentReference: latestQuery.id.includes("refined")
        ? "refined_strategic_priorities"
        : "strategic_priorities",
    },
  });

  return {
    currentStep: "awaiting_strategic_validation",
    interruptStatus: {
      isInterrupted: true,
      interruptionPoint: "strategic_validation",
      feedback: null,
      processingStatus: null,
    },
  };
}

// Context-specific question generation
async function createStrategicValidationCheckpoint(
  analysis: RfpAnalysisResult,
  insights: StrategicInsights
) {
  const contextualQuestion = await generateContextualQuestion(
    analysis,
    insights
  );

  return {
    userQuestions: [
      {
        id: `strategic_priorities_${Date.now()}`,
        question: contextualQuestion,
        options: insights.keyOpportunities, // Dynamic options from analysis
        multiSelect: true,
        context: `${analysis.industry} - ${analysis.complexity} complexity - ${analysis.timelinePressure} timeline pressure`,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
```

#### **🧠 Feedback Processor Node**

- **Purpose**: Interpret user's natural language feedback intelligently
- **Must Analyze**:
  - Overall sentiment (satisfied/needs_refinement/restart)
  - Specific modification requests (keep/change/add/remove/emphasize)
  - Priority and urgency of changes
- **Outputs**: Structured feedback with modification instructions

**📝 Code Example from RFP Analyzer:**

```typescript
// From: apps/backend/agents/proposal-generation/nodes/planning/rfp-analysis/user_feedback_processor.ts

// Zod schema for structured feedback analysis
const FeedbackAnalysisSchema = z.object({
  sentiment: z.enum(["satisfied", "needs_refinement", "needs_restart"]),
  feedback_details: z.object({
    specific_suggestions: z.array(z.string()),
    areas_of_concern: z.array(z.string()),
    user_priorities: z.array(z.string()),
    tone_indicators: z.array(z.string()),
  }),
  routing_decision: z.enum([
    "proceed_to_planning",
    "refine_analysis",
    "restart_analysis",
  ]),
  confidence_score: z.number().min(0).max(1),
  user_engagement_level: z.enum(["high", "medium", "low"]),
  requires_clarification: z.boolean(),
});

export async function userFeedbackProcessor(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  // Find the query that was just responded to
  const respondedQuery = state.userCollaboration?.userQueries?.find(
    (query) => query.response && !query.responseTimestamp
  );

  // Extract analysis context for feedback processing
  const analysisContext = {
    industry: state.planningIntelligence?.rfpCharacteristics?.industry,
    complexity: state.planningIntelligence?.rfpCharacteristics?.complexity,
    keyOpportunities:
      state.planningIntelligence?.earlyRiskAssessment?.strategicInsights
        ?.keyOpportunities,
  };

  // Process feedback using LLM
  const feedbackAnalysis = await processFeedbackWithLLM(
    respondedQuery.response,
    respondedQuery.question,
    analysisContext
  );

  // Generate contextual response message
  let responseMessage = "";
  switch (feedbackAnalysis.sentiment) {
    case "satisfied":
      responseMessage =
        "✅ Great! I'll proceed with research planning based on this validated analysis.";
      break;
    case "needs_refinement":
      responseMessage = `🔧 I understand you'd like some adjustments. I'll refine the analysis focusing on: ${feedbackAnalysis.feedback_details.specific_suggestions.join(", ") || "your feedback"}.`;
      break;
    case "needs_restart":
      responseMessage =
        "🔄 I'll start the analysis fresh with a completely new approach.";
      break;
  }

  return {
    currentStep: "feedback_processed",
    feedbackProcessing: {
      lastProcessedFeedback: feedbackAnalysis,
      nextAction: feedbackAnalysis.routing_decision,
      processingTimestamp: new Date().toISOString(),
    },
    messages: [...state.messages, new AIMessage(responseMessage)],
  };
}

// LLM-based feedback interpretation with fallback
async function processFeedbackWithLLM(
  userFeedback: string,
  originalQuery: string,
  analysisContext: any
): Promise<FeedbackAnalysis> {
  try {
    const contextInfo = `
Original Question: ${originalQuery}
Analysis Context: ${JSON.stringify(analysisContext, null, 2)}
User Response: "${userFeedback}"
`;

    const response = await feedbackLlm.invoke([
      { role: "system", content: FEEDBACK_PROCESSING_PROMPT },
      { role: "user", content: contextInfo },
    ]);

    return FeedbackAnalysisSchema.parse(JSON.parse(response.content));
  } catch (error) {
    // Enhanced fallback with LLM intelligence (no keyword analysis)
    return await performLLMFallbackAnalysis(
      userFeedback,
      analysisContext?.industry
    );
  }
}
```

#### **🔄 Content Refinement Node**

- **Purpose**: Apply feedback to improve content while preserving quality
- **Must**:
  - Show explicit rationale for all changes made
  - Preserve user-approved elements from previous rounds
  - Increment refinement counter
  - Adjust confidence score based on changes

**📝 Code Example from RFP Analyzer:**

```typescript
// From: apps/backend/agents/proposal-generation/nodes/planning/rfp-analysis/strategic_options_refinement.ts

// Zod schema for refined options with explicit rationale
const RefinedOptionsSchema = z.object({
  revisedStrategicOptions: z.array(z.string()),
  rationale: z.object({
    userModifications: z.array(z.string()),
    keptElements: z.array(z.string()),
    newElements: z.array(z.string()),
    removedElements: z.array(z.string()),
  }),
  confidence: z.number().min(0).max(1),
  requiresAdditionalInput: z.boolean(),
});

export async function strategicOptionsRefinement(
  state: OverallProposalState
): Promise<Partial<OverallProposalState>> {
  const processedFeedback = state.feedbackProcessing?.lastProcessedFeedback;
  const originalOptions =
    state.planningIntelligence?.earlyRiskAssessment?.strategicInsights
      ?.keyOpportunities;

  // Generate refined options with explicit rationale
  const refinedOptions = await generateRefinedStrategicOptions(
    originalOptions,
    processedFeedback,
    state.planningIntelligence?.rfpCharacteristics
  );

  // Create new validation checkpoint for refined options
  const refinedCheckpoint = createRefinedValidationCheckpoint(
    refinedOptions,
    (state.userCollaboration?.refinementIteration || 0) + 1
  );

  return {
    currentStep: "strategic_options_refined",
    planningIntelligence: {
      ...state.planningIntelligence,
      earlyRiskAssessment: {
        ...state.planningIntelligence.earlyRiskAssessment,
        strategicInsights: {
          ...state.planningIntelligence.earlyRiskAssessment.strategicInsights,
          keyOpportunities: refinedOptions.revisedStrategicOptions,
        },
        analysisConfidence: refinedOptions.confidence,
      },
    },
    userCollaboration: {
      ...state.userCollaboration,
      userQueries: [
        ...(state.userCollaboration?.userQueries || []),
        ...refinedCheckpoint.userQuestions,
      ],
      refinementIteration:
        (state.userCollaboration?.refinementIteration || 0) + 1,
    },
    messages: [
      ...state.messages,
      new AIMessage(
        `## Strategic Options Refined\n\n` +
          `**What I kept:** ${refinedOptions.rationale.keptElements.join(", ")}\n` +
          `**What I added:** ${refinedOptions.rationale.newElements.join(", ")}\n` +
          `**What I removed:** ${refinedOptions.rationale.removedElements.join(", ")}\n` +
          `**Based on your feedback:** ${refinedOptions.rationale.userModifications.join(", ")}\n\n` +
          `**Confidence Level:** ${Math.round(refinedOptions.confidence * 100)}%`
      ),
    ],
  };
}

// Generate refined options with explicit change tracking
async function generateRefinedStrategicOptions(
  originalOptions: string[],
  userFeedback: any,
  rfpContext: any
): Promise<RefinedOptions> {
  const refinementContext = `
ORIGINAL STRATEGIC OPTIONS:
${originalOptions.map((opt, i) => `${i + 1}. ${opt}`).join("\n")}

USER FEEDBACK ANALYSIS:
- Sentiment: ${userFeedback.sentiment}
- Specific Suggestions: ${userFeedback.feedback_details.specific_suggestions.join(", ")}
- Areas of Concern: ${userFeedback.feedback_details.areas_of_concern.join(", ")}
- User Priorities: ${userFeedback.feedback_details.user_priorities.join(", ")}

TASK: Create refined strategic options that incorporate the user's feedback while maintaining RFP alignment.
`;

  const response = await refinementLlm.invoke([
    { role: "system", content: STRATEGIC_REFINEMENT_PROMPT },
    { role: "user", content: refinementContext },
  ]);

  return RefinedOptionsSchema.parse(JSON.parse(response.content));
}
```

### 🎯 **Required Collaboration Behavior**

#### **1. Generate Initial Content with Strategic Validation Points**

- **Always** create natural pause points where users can provide feedback
- Present your initial work with explicit questions like: _"How does this analysis look? Any adjustments needed?"_
- Provide **multiple specific options** for user feedback (not just "approve/reject")
- Make it clear that users can request modifications, additions, or complete changes

**📝 Implementation Pattern:**

```typescript
// Generate context-specific validation options dynamically
const ValidationOptionGenerators = {
  research_strategy: (content: any) => [
    "Research depth appropriate",
    "Focus areas well-targeted",
    "Add more funder intelligence",
    "Include competitive analysis",
    "Adjust timeline/scope",
  ],

  competitive_analysis: (content: any) => [
    "Include more direct competitors",
    "Add pricing and market positioning",
    "Strengthen threat assessment",
    "Adjust competitive advantage focus",
  ],

  rfp_analysis: (analysis: RfpAnalysisResult) => [
    ...analysis.strategicInsights.keyOpportunities,
    "Add industry-specific risks",
    "Focus more on compliance requirements",
    "Strengthen competitive positioning",
  ],
};
```

#### **2. Interpret Complex User Feedback Intelligently**

- **Handle nuanced requests** like: _"I like the sustainability focus but replace cost leadership with regulatory compliance"_
- **Understand modification patterns**:
  - **Keep**: "This part is good, leave it as is"
  - **Replace**: "Change X to Y"
  - **Add**: "Include Z in the analysis"
  - **Remove**: "Take out the section about W"
  - **Emphasize**: "Put more focus on V"
  - **Reorder**: "Move the risk section before opportunities"

**📝 LLM Prompt Pattern:**

```typescript
// From user_feedback_processor.ts - sophisticated feedback interpretation
const FEEDBACK_PROCESSING_PROMPT = `You are an expert at interpreting user feedback in collaborative AI systems.

User feedback interpretation:
- "Keep X" = preserve this element exactly
- "Replace X with Y" = remove X and add Y instead  
- "Add Z" = include Z as a new strategic option
- "Focus more on A" = elevate A to higher priority
- "Less emphasis on B" = downplay or remove B

SENTIMENT CLASSIFICATION:
- "satisfied": User approves and wants to proceed 
- "needs_refinement": User wants improvements but same general approach
- "needs_restart": User wants completely fresh analysis

Provide structured analysis in JSON format with confidence scoring.`;
```

#### **3. Take Intelligent Action (Not Just Acknowledgment)**

- **CRITICAL**: When users request changes, you must **actually implement** those changes
- **Generate revised content** that incorporates their specific feedback
- **Show explicit rationale** for what you kept, changed, added, or removed
- **Maintain quality and coherence** while implementing the modifications

**📝 Routing Implementation:**

```typescript
// From user_feedback_processor.ts - intelligent routing based on feedback
export function routeAfterFeedbackProcessing(
  state: OverallProposalState
): string {
  const nextAction =
    state.feedbackProcessing?.lastProcessedFeedback?.routing_decision;

  switch (nextAction) {
    case "proceed_to_planning":
      return "research_planning"; // User satisfied - move forward
    case "refine_analysis":
      return "strategic_options_refinement"; // User wants improvements
    case "restart_analysis":
      return "rfp_analyzer"; // User wants fresh start
    default:
      return "error_recovery";
  }
}
```

#### **4. Create Transparent Change Communication**

- **Always explain** what you modified and why
- Use clear language like:
  - _"I kept your sustainability priorities as requested"_
  - _"I replaced cost leadership with regulatory compliance as you suggested"_
  - _"I added enhanced risk assessment to address your concerns"_
- **Maintain context** from the original work while showing evolution

**📝 Transparent Messaging Pattern:**

```typescript
// From strategic_options_refinement.ts - explicit change communication
const responseMessage = new AIMessage(
  `## Strategic Options Refined\n\n` +
    `**What I kept:** ${refinedOptions.rationale.keptElements.join(", ")}\n` +
    `**What I added:** ${refinedOptions.rationale.newElements.join(", ")}\n` +
    `**What I removed:** ${refinedOptions.rationale.removedElements.join(", ")}\n` +
    `**Based on your feedback:** ${refinedOptions.rationale.userModifications.join(", ")}\n\n` +
    `**Confidence Level:** ${Math.round(refinedOptions.confidence * 100)}%`
);
```

#### **5. Enable Progressive Iterative Refinement**

- **Round 1**: Focus on major structural feedback and core approach validation
- **Round 2**: Handle specific adjustments and detailed modifications
- **Round 3**: Final polish or accept current version (refinement limit)
- **Track iteration count** and gently suggest proceeding after 3 rounds
- **Each iteration** should build on previous feedback rather than starting over
- **Preserve user preferences** established in earlier rounds

**📝 Iteration Management:**

```typescript
// Track refinement iterations with limits
function updateCollaborationState(
  currentState: OverallProposalState,
  feedbackAnalysis: FeedbackAnalysis,
  originalQuery: any
): Partial<OverallProposalState> {
  const currentRefinement =
    currentState.userCollaboration?.refinementIteration || 0;
  const newRefinementCount =
    feedbackAnalysis.routing_decision === "refine_analysis"
      ? currentRefinement + 1
      : currentRefinement;

  return {
    userCollaboration: {
      ...currentState.userCollaboration,
      refinementIteration: newRefinementCount,
      maxRefinements: 3, // Set limit
      lastFeedbackProcessed: {
        timestamp: new Date().toISOString(),
        sentiment: feedbackAnalysis.sentiment,
        engagementLevel: feedbackAnalysis.user_engagement_level,
        confidence: feedbackAnalysis.confidence_score,
      },
    },
  };
}
```

---

## 🔄 **Dynamic Collaboration Flow Pattern**

### **State Management with LangGraph**

**📝 Implementation Pattern:**

```typescript
// State structure for collaboration tracking
interface UserCollaboration {
  strategicPriorities?: string[];
  userQueries?: UserQuery[];
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

interface UserQuery {
  id: string;
  question: string;
  options: string[];
  multiSelect?: boolean;
  context?: string;
  timestamp: string;
  response?: string;
  responseTimestamp?: string;
  refinementRationale?: any; // For tracking changes in refined queries
}
```

### **Phase 1: Initial Presentation with Confidence**

- Present your work with **confidence but openness** to feedback
- Include **3-5 specific aspects** users can comment on
- Display your **confidence level** in the generated content
- Ask **context-specific questions** that invite detailed feedback
- **Example**: _"I've identified 4 key strategic opportunities with 85% confidence. How do these align with your priorities? Any areas you'd like me to adjust or expand?"_

**📝 Confidence Calculation:**

```typescript
// From rfp_analyzer.ts - confidence scoring
const analysisConfidence =
  strategicInsights.funderSignals.reduce((avg, s) => avg + s.confidence, 0) /
  strategicInsights.funderSignals.length;

const strategicRecommendations = {
  topOpportunities: insights.keyOpportunities.slice(0, 3),
  criticalRequirements: insights.requirementPriorities.filter(
    (r) => r.priority === "Critical"
  ),
  confidenceLevel: analysisConfidence, // Display to user
};
```

### **Phase 2: Intelligent Feedback Interpretation**

- **Listen for specific modification requests** (keep/change/add/remove)
- **Identify user priorities** that emerge from their feedback
- **Assess satisfaction level**: Completely satisfied / Needs refinement / Needs restart
- **Detect emotional cues**: Confident, uncertain, frustrated, excited
- **Determine refinement scope**: Major structural changes vs. minor adjustments

### **Phase 3: Intelligent Action with Rationale**

- **Generate revised content** that directly addresses their feedback
- **Maintain overall quality** while incorporating requested changes
- **Show your work**: Explain what changed and why
- **Preserve what worked** from the original version
- **Adjust confidence score** based on modifications made

### **Phase 4: Re-validation with Progress Tracking**

- **Present the refined version** with clear change highlights
- **Show refinement progress** (Round 2 of 3)
- **Ask for validation** of the specific changes made
- **Be prepared for additional refinements** or approval to proceed
- **Offer escalation options** if refinement limit reached

---

## 🔧 **Configuration & State Management**

### **Make Your Agent Configurable**

**📝 Configuration Pattern:**

```typescript
interface AgentConfig {
  // Core Identity
  agentName: string;
  contentType: string;
  generationPurpose: string;

  // State Management
  stateContentPath: string; // "planningIntelligence.researchStrategy"
  contextExtractor: (state: any) => any;

  // Collaboration Behavior
  validationOptions: string[] | ((content: any) => string[]);
  maxRefinements?: number;
  multiStepValidation?: ValidationStep[];
}

// Example configurations
const RFP_ANALYZER_CONFIG: AgentConfig = {
  agentName: "rfp_analyzer",
  contentType: "strategic analysis",
  generationPurpose: "Analyze RFP for strategic opportunities and risks",
  stateContentPath: "planningIntelligence.earlyRiskAssessment",
  contextExtractor: (state) => ({
    rfpDocument: state.rfpDocument,
    industry: state.planningIntelligence?.rfpCharacteristics?.industry,
  }),
  validationOptions: (analysis) =>
    analysis.strategicInsights?.keyOpportunities || [],
  maxRefinements: 3,
};
```

### **State Tracking Requirements**

- **Store generated content** in dedicated state field
- **Track collaboration metadata**:
  - `refinementCount`: Number of refinement iterations
  - `userFeedback`: Structured feedback from user
  - `validationStatus`: pending/approved/rejected
  - `confidenceScore`: Agent's confidence in current content
  - `preservedElements`: User-approved content to maintain

---

## 💡 **Context-Aware Validation Examples**

### **Research Strategy Agent**

**📝 Validation Options:**

```typescript
const researchValidationOptions = [
  "Research depth appropriate",
  "Focus areas well-targeted",
  "Add more funder intelligence",
  "Include competitive analysis",
  "Adjust timeline/scope",
];
```

### **Competitive Analysis Agent**

**📝 Validation Options:**

```typescript
const competitiveValidationOptions = [
  "Include more direct competitors",
  "Add pricing and market positioning",
  "Strengthen threat assessment",
  "Adjust competitive advantage focus",
];
```

### **RFP Analysis Agent (Real Implementation)**

**📝 Dynamic Options Generation:**

```typescript
// From rfp_analyzer.ts - context-aware options from analysis results
async function createStrategicValidationCheckpoint(
  analysis: RfpAnalysisResult,
  insights: StrategicInsights
) {
  return {
    userQuestions: [
      {
        id: `strategic_priorities_${Date.now()}`,
        question: await generateContextualQuestion(analysis, insights),
        options: insights.keyOpportunities, // Generated from RFP analysis
        multiSelect: true,
        context: `${analysis.industry} - ${analysis.complexity} complexity - ${analysis.timelinePressure} timeline pressure`,
      },
    ],
  };
}
```

---

## 💡 **Example Collaboration Scenarios**

### **Scenario A: Strategic Refinement**

**User**: _"I like the innovation focus but I think you're underestimating regulatory compliance risks"_

**Your Response Pattern**:

- ✅ **Acknowledge**: "I hear that regulatory compliance is more critical than initially assessed"
- ✅ **Action**: Revise the analysis to elevate regulatory compliance considerations
- ✅ **Rationale**: "I've elevated regulatory compliance to a primary risk factor while maintaining the innovation focus you appreciated"
- ✅ **Confidence Update**: "Confidence increased to 92% with your regulatory expertise"
- ✅ **Re-validate**: "How does this updated risk assessment look?"

**📝 Implementation Example:**

```typescript
// This maps to "needs_refinement" -> "strategic_options_refinement" routing
const refinedOptions = await generateRefinedStrategicOptions(originalOptions, {
  sentiment: "needs_refinement",
  feedback_details: {
    specific_suggestions: ["Elevate regulatory compliance to primary risk"],
    user_priorities: ["Innovation focus", "Regulatory compliance"],
    areas_of_concern: ["Underestimated regulatory risks"],
  },
});
```

### **Scenario B: Content Restructuring**

**User**: _"This is mostly good but can you move the competitive analysis before the risk section?"_

**Your Response Pattern**:

- ✅ **Acknowledge**: "Absolutely, positioning competitive analysis earlier will provide better context"
- ✅ **Action**: Restructure the content with competitive analysis preceding risk assessment
- ✅ **Rationale**: "I've moved competitive analysis to Section 2, which creates better flow into the risk assessment"
- ✅ **Re-validate**: "Does this structure work better for your review process?"

### **Scenario C: Scope Adjustment**

**User**: _"You covered technology well but completely missed the sustainability angle that's critical for this funder"_

**Your Response Pattern**:

- ✅ **Acknowledge**: "You're right - sustainability is a crucial factor I underemphasized"
- ✅ **Action**: Add comprehensive sustainability analysis while preserving technology focus
- ✅ **Rationale**: "I've added a dedicated sustainability framework that integrates with the technology approach rather than replacing it"
- ✅ **Confidence Update**: "Confidence adjusted to 88% - sustainability integration improves funder alignment"
- ✅ **Re-validate**: "Does this balance of technology and sustainability better match the funder's priorities?"

---

## ⚡ **Critical Success Factors**

### **Make It Feel Conversational**

- Use natural language, not robotic responses
- Show genuine interest in their feedback
- Express enthusiasm when they provide valuable insights
- **Example**: _"That's a really insightful point about regulatory compliance - let me incorporate that more prominently"_

**📝 Natural Response Generation:**

```typescript
// From user_feedback_processor.ts - contextual response generation
async function generateContextualResponse(
  feedbackAnalysis: FeedbackAnalysis,
  userFeedback: string,
  analysisContext: any
): Promise<string> {
  const response = await responseLlm.invoke([
    { role: "system", content: RESPONSE_GENERATION_PROMPT },
    {
      role: "user",
      content: `User feedback: "${userFeedback}"\nContext: ${JSON.stringify(analysisContext)}`,
    },
  ]);

  return response.content;
}
```

### **Maintain Professional Quality**

- **Never compromise quality** in pursuit of user satisfaction
- **Educate when necessary**: If a user request would reduce effectiveness, explain why and suggest alternatives
- **Balance user preferences** with professional best practices

### **Build Trust Through Transparency**

- **Always explain your reasoning** for changes
- **Show uncertainty** when you're not sure about a modification
- **Ask clarifying questions** when feedback is ambiguous
- **Display confidence levels** honestly
- **Example**: _"When you say 'more technical detail,' do you mean deeper methodology or more specific performance metrics?"_

### **Manage Collaboration Boundaries**

- **Progressive refinement guidance**:
  - **Round 1**: _"Let's focus on the overall approach and major structural elements"_
  - **Round 2**: _"Now let's fine-tune specific details and adjustments"_
  - **Round 3**: _"Final polish - what specific elements need adjustment?"_
- **Offer guidance** after 3 refinement rounds: _"We've made great improvements - shall we proceed with this version or would you like to start fresh with a different approach?"_
- **Suggest alternatives** when users seem stuck: _"If this approach isn't quite right, I can try a completely different angle"_
- **Gracefully handle** requests outside your capabilities

**📝 Refinement Limit Handling:**

```typescript
// Check if refinement limit reached
if (state.feedbackProcessing?.requiresLimitCheck) {
  return "refinement_limit_handler";
}

// Refinement limit handler implementation
export function refinementLimitHandler(state: OverallProposalState): string {
  // Present options: accept current version or restart completely
  const options = [
    "Accept current version and proceed",
    "Start fresh with completely different approach",
    "Request manual review and assistance",
  ];

  return createLimitReachedCheckpoint(state, options);
}
```

---

## 📊 **Success Metrics & Critical Rules**

### **Your Collaborative Agent Succeeds When**:

- ✅ Users rarely need more than 2 refinement rounds
- ✅ Validation options feel relevant and domain-specific
- ✅ Refinements clearly address user feedback
- ✅ Content quality improves with each iteration
- ✅ Users feel heard and in control of the process
- ✅ Confidence scores accurately reflect content quality

### **Critical Implementation Rules**:

1. **ALWAYS use `interrupt()`** for user interaction - not custom waiting logic
2. **ALWAYS track refinement count** to prevent infinite loops
3. **ALWAYS provide context-specific** validation options - not generic choices
4. **ALWAYS preserve user-approved elements** during refinement
5. **NEVER regenerate from scratch** during refinement - modify existing content
6. **NEVER expose raw technical state** - summarize for user understanding
7. **ALWAYS show confidence levels** and adjust them based on feedback

**📝 Implementation Checklist:**

```typescript
// ✅ Use LangGraph interrupt() pattern
const userResponse = interrupt({
  type: "strategic_validation",
  question: latestQuery.question,
  options: latestQuery.options,
  metadata: { /* tracking data */ }
});

// ✅ Track iterations
const newRefinementCount = feedbackAnalysis.routing_decision === "refine_analysis"
  ? currentRefinement + 1
  : currentRefinement;

// ✅ Context-specific options
options: insights.keyOpportunities, // Not ["approve", "reject"]

// ✅ Preserve user-approved elements
keptElements: refinedOptions.rationale.keptElements,

// ✅ Modify, don't regenerate
const updatedContent = await refineExistingContent(originalContent, feedback);
// Not: const newContent = await generateFromScratch();
```

---

## 🎯 **Expected User Experience**

When implementing this pattern correctly, users should feel:

- **Heard**: Their feedback is genuinely understood and incorporated
- **Collaborative**: They're working _with_ you, not just receiving outputs
- **In Control**: They can guide the direction while benefiting from your expertise
- **Confident**: The final output reflects their priorities and professional standards
- **Efficient**: The collaboration feels productive, not repetitive or frustrating
- **Informed**: They understand your confidence level and reasoning

---

## ❌ **Anti-Patterns to Avoid**

- **Acknowledge-Only Responses**: _"I understand you want more focus on X"_ without actually adding focus on X
- **Starting Over**: Ignoring previous feedback when making new changes
- **Generic Modifications**: Making vague improvements instead of specific requested changes
- **No Rationale**: Making changes without explaining what you did and why
- **Infinite Loops**: Continuing refinement without suggesting progression to next steps
- **Generic Validation Options**: Using "approve/reject" instead of context-specific choices
- **Hidden Confidence**: Not showing uncertainty or confidence levels
- **Rigid Structure**: Not adapting refinement approach to user feedback patterns

**📝 Code Anti-Pattern Examples:**

```typescript
// ❌ WRONG: Generic options
const badOptions = ["Approve", "Reject", "Modify"];

// ✅ RIGHT: Context-specific options from content
const goodOptions = analysis.strategicInsights.keyOpportunities;

// ❌ WRONG: Acknowledge without action
return { message: "I understand you want more regulatory focus" };

// ✅ RIGHT: Acknowledge WITH action
const refinedContent = await addRegulatoryFocus(originalContent, feedback);
return {
  updatedContent: refinedContent,
  message: "I've elevated regulatory compliance as requested",
};
```

---

This collaborative approach transforms you from a one-shot content generator into a **true collaborative partner** that can iteratively improve outputs through intelligent user interaction with clear progress tracking and professional quality maintenance.

**📝 Complete Implementation Reference:**

- **Generator Node**: `rfp_analyzer.ts` - lines 436-587
- **Validation Checkpoint**: `rfp_analyzer.ts` - lines 627-670
- **Feedback Processor**: `user_feedback_processor.ts` - lines 424-527
- **Refinement Node**: `strategic_options_refinement.ts` - lines 200-330
- **Routing Logic**: `user_feedback_processor.ts` - lines 528-610
