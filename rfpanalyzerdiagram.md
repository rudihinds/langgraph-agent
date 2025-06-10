graph TD
    START([🚀 START]) --> rfpAnalyzer[🔍 RFP Analyzer<br/>• Deep industry analysis<br/>• Strategic insights extraction<br/>• Risk assessment<br/>• Confidence scoring]
    
    rfpAnalyzer --> routeAnalysis{Analysis<br/>Complete?}
    routeAnalysis -->|❌ Errors| errorRecovery[🛠️ Error Recovery<br/>• Graceful error handling<br/>• User notification<br/>• Recovery strategies]
    routeAnalysis -->|✅ Success| strategicValidation[⭐ Strategic Validation Checkpoint<br/>• Rich analysis presentation<br/>• User collaboration interface<br/>• Multiple response options<br/>• Custom input capability]
    
    errorRecovery --> END([❌ END - Error])
    
    strategicValidation --> validationRoute{User Response<br/>Received?}
    validationRoute -->|⏳ Waiting| strategicValidation
    validationRoute -->|✅ Received| userFeedbackProcessor[🧠 User Feedback Processor<br/>• Intelligent interpretation<br/>• Sentiment analysis<br/>• Insight extraction<br/>• Collaboration tracking]
    
    userFeedbackProcessor --> feedbackRoute{User<br/>Satisfaction?}
    
    feedbackRoute -->|😊 Satisfied| researchPlanning[📋 Research Planning<br/>• Intelligent research strategy<br/>• User insight integration<br/>• Timeline estimation<br/>• Next phase preparation]
    
    feedbackRoute -->|🔧 Needs Refinement| checkRefinementLimit{Refinement Limit<br/>Reached?}
    checkRefinementLimit -->|No| analysisRefinement[🎯 Analysis Refinement<br/>• LLM-based improvement<br/>• User feedback integration<br/>• Confidence enhancement<br/>• Quality optimization]
    checkRefinementLimit -->|Yes| refinementLimitHandler[⚠️ Refinement Limit Handler<br/>• Professional limit notification<br/>• Final choice presentation<br/>• Escalation options]
    
    feedbackRoute -->|🔄 Needs Restart| restartAnalysis[🔄 Restart Analysis<br/>• Clean state reset<br/>• Fresh approach<br/>• User communication]
    
    analysisRefinement --> strategicValidation
    restartAnalysis --> rfpAnalyzer
    
    refinementLimitHandler --> limitRoute{Final<br/>Decision?}
    limitRoute -->|Accept| researchPlanning
    limitRoute -->|Restart| restartAnalysis
    
    researchPlanning --> CONTINUE([🎯 CONTINUE TO<br/>RESEARCH PHASE])
    
    classDef premiumNode fill:#e3f2fd,stroke:#1565c0,stroke-width:3px,color:#000,font-weight:bold
    classDef userNode fill:#f3e5f5,stroke:#7b1fa2,stroke-width:3px,color:#000,font-weight:bold
    classDef decisionNode fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#000
    classDef startEndNode fill:#e8f5e8,stroke:#2e7d32,stroke-width:3px,color:#000,font-weight:bold
    classDef errorNode fill:#ffebee,stroke:#c62828,stroke-width:2px,color:#000
    
    class rfpAnalyzer,researchPlanning premiumNode
    class strategicValidation,userFeedbackProcessor,analysisRefinement userNode
    class routeAnalysis,validationRoute,feedbackRoute,checkRefinementLimit,limitRoute decisionNode
    class START,CONTINUE,END startEndNode
    class errorRecovery,refinementLimitHandler errorNode