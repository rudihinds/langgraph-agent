# RFP Chat Initialization Plan

> This document outlines the implementation plan for incorporating user authentication and RFP document loading into the chat workflow.

## Current Architecture Analysis

Based on the codebase review:

- [x] Analyze chat agent state awareness and workflow guidance capabilities
- [x] Review documentLoaderNode integration requirements
- [x] Examine graph structure for node and workflow integration
- [x] Verify Supabase storage setup for proposal documents

## Implementation Plan

### Phase 1: User-Guided Document Loading

1. **Update Document Loader Node**

   - [x] Modify `documentLoaderNode` to accept `rfpId` from state

   ```typescript
   // In documentLoaderNode.ts
   export async function documentLoaderNode(state) {
     // Use rfpId from state, or fallback to env var for testing
     const rfpId =
       state.rfpId ||
       process.env.TEST_RFP_ID ||
       "f3001786-9f37-437e-814e-170c77b9b748";

     try {
       // Get document from storage
       const { data, error } = await downloadFileWithRetry({
         bucketName: "proposal-documents",
         path: `${rfpId}/${state.documentName || "document.pdf"}`,
       });

       if (error) throw error;

       // Process the document
       const text = await extractTextFromPdf(data);
       return {
         rfpDocument: { status: "loaded", text, id: rfpId },
         rfpId, // Store ID in state for future reference
       };
     } catch (error) {
       return {
         rfpDocument: {
           status: "error",
           error: error.message,
         },
       };
     }
   }
   ```

2. **Enhance Chat Agent for Document Loading**

   - [x] Update `chatAgentNode` to detect and guide users through document loading
   - [x] Add welcome message for new threads
   - [x] Ensure the agent can recognize "start research" intent and trigger document loading

3. **Update Graph Initialization**

   - [x] Modify createProposalGenerationGraph to accept rfpId parameter

   ```typescript
   // In createProposalGenerationGraph function
   function createProposalGenerationGraph(
     userId: string = ENV.TEST_USER_ID,
     proposalId?: string,
     rfpId?: string // Add this parameter
   ) {
     // Rest of function unchanged, just pass rfpId to initial state
     // when creating the graph
   }
   ```

### Phase 2: Proposal API Integration

1. **Create Proposal Management Endpoints**

   - [x] Implement `/api/rfp/start` endpoint:

     ```typescript
     // Create a new proposal and initialize chat thread
     router.post("/start", async (req, res) => {
       const { title, rfpDocumentId, userId } = req.body;

       // Create proposal in database
       const { data: proposal, error } = await serverSupabase
         .from("proposals")
         .insert({
           title,
           rfp_document_id: rfpDocumentId,
           user_id: userId,
           status: "draft",
         })
         .select()
         .single();

       if (error) return res.status(500).json({ error: error.message });

       // Initialize orchestrator with thread ID = proposal ID
       const orchestrator = getOrchestrator(proposal.id);
       await orchestrator.initialize({
         userId,
         proposalId: proposal.id,
         rfpId: rfpDocumentId,
       });

       return res.json({
         success: true,
         threadId: proposal.id,
         proposalId: proposal.id,
       });
     });
     ```

   - [x] Implement `/api/rfp/continue/:proposalId` endpoint:

     ```typescript
     // Resume an existing proposal
     router.get("/continue/:proposalId", async (req, res) => {
       const { proposalId } = req.params;
       const { userId } = req.query;

       // Verify user has access to this proposal
       const { data, error } = await serverSupabase
         .from("proposals")
         .select("*")
         .eq("id", proposalId)
         .eq("user_id", userId)
         .single();

       if (error || !data) {
         return res.status(404).json({ error: "Proposal not found" });
       }

       return res.json({
         success: true,
         threadId: proposalId,
         proposalId,
         status: data.status,
       });
     });
     ```

2. **Update Chat Endpoint**

   - [x] Modify `/api/rfp/chat` to handle both new and existing threads:

     ```typescript
     router.post("/", async (req, res) => {
       const { threadId, message, rfpId } = req.body;

       if (!threadId) {
         return res.status(400).json({ error: "Missing threadId" });
       }

       // Get orchestrator with optional rfpId
       const orchestrator = getOrchestrator(threadId, rfpId);

       // Process message
       const result = await orchestrator.processChatMessage(message);

       return res.json(result);
     });
     ```

3. **Enhance Orchestrator Service**

   - [x] Update initialization method to handle rfpId:

   ```typescript
   // In OrchestratorService
   async initialize({ userId, proposalId, rfpId }) {
     const checkpointer = createCheckpointer({
       userId,
       proposalId
     });

     // Check if state already exists
     const existingState = await checkpointer.get();
     if (existingState) {
       return { threadId: proposalId, existing: true };
     }

     // Create graph with rfpId in initial state
     const graph = createProposalGenerationGraph(userId, proposalId, rfpId);

     // Initialize with empty messages array
     const initialState = {
       userId,
       proposalId,
       rfpId,
       messages: []
     };

     await checkpointer.put(initialState);

     return { threadId: proposalId, existing: false };
   }
   ```

### Phase 3: User Experience Refinement

1. **Contextual Guidance (Completed)**

   - [x] Implement context-aware guidance through system prompts

   ```typescript
   // In chatAgentNode.ts - Already implemented through dynamic system prompts
   // Enhanced document status check with more detailed state detection
   let documentStatus = "";
   if (state.rfpDocument) {
     switch (state.rfpDocument.status) {
       case "loaded":
         documentStatus =
           "The document has been successfully loaded and is ready for analysis.";
         break;
       case "loading":
         documentStatus =
           "The document is currently being loaded. The user should wait until it completes.";
         break;
       case "error":
         documentStatus = `There was an error loading the document: ${(state.rfpDocument as any).error || "Unknown error"}. The user may need to try again or provide a different document.`;
         break;
       default:
         documentStatus =
           "No document has been loaded yet. The user needs to provide an RFP document ID or upload one.";
     }
   } else {
     documentStatus =
       "No document information is available. The user needs to provide an RFP document ID or upload one.";
   }

   // Include document status in system prompt - this drives context-aware responses
   const systemPrompt = `You are a helpful assistant for a proposal generation system. 
   
   DOCUMENT STATUS:
   ${documentStatus}
   
   // Rest of the prompt with workflow guidance...
   `;
   ```

2. **Progress Tracking**

   - [ ] Update proposal status as workflow progresses:

     ```typescript
     // In relevant nodes
     async function updateProposalStatus(proposalId, status) {
       return await serverSupabase
         .from("proposals")
         .update({ status })
         .eq("id", proposalId);
     }

     // Call in appropriate nodes, e.g., after research completes
     ```

3. **Error Handling & Recovery**

   - [x] Implement document loading recovery:
     ```typescript
     // In documentLoaderNode.ts
     if (error) {
       return {
         rfpDocument: {
           status: "error",
           error: error.message,
           suggestions: [
             "Check if document exists in storage",
             "Verify file format is supported",
             "Try uploading the document again",
           ],
         },
       };
     }
     ```

## Testing Strategy

1. **Unit Tests**

   - [x] Test permission validation and error handling
   - [x] Verify welcome message generation for different states
   - [x] Test chat intent detection and routing for document loading

2. **Integration Tests**

   - [x] Verify end-to-end flow from proposal creation to chat
   - [x] Test resuming existing proposals
   - [x] Test error recovery flows for rfpId issues

3. **Manual Testing**
   - [ ] Create test scripts for manual verification
   - [ ] Test with sample RFP IDs to verify proper initialization

## Implementation Timeline

- **Phase 1:** 2-3 days
- **Phase 2:** 2-3 days
- **Phase 3:** 1-2 days

Total estimated time: 5-8 days

## Test Cases for Implementation

### Phase 1: Document Loader Node Tests

1. **Test rfpId Acceptance:**

   - [x] Test when rfpId is provided in state - should use provided rfpId
   - [x] Test fallback to environment variable when rfpId not in state
   - [x] Test default ID fallback when neither state nor env var has rfpId
   - [x] Test handling of empty string or null rfpId values - should use fallbacks properly

2. **Test Error Handling:**
   - [x] Verify error response includes appropriate suggestions
   - [x] Test error object in state has the correct structure with status="error"
   - [x] Test recovery path instructions in error responses are actionable and clear

### Phase 2: Chat Agent RFP Guidance Tests

1. **Test Document Status Detection:**

   - [x] Test chat agent with loaded document - should provide research guidance
   - [x] Test chat agent with loading document - should indicate waiting status
   - [x] Test chat agent with document error - should suggest troubleshooting
   - [x] Test chat agent with no document - should guide to document loading

2. **Test Intent Recognition:**

   - [x] Test load_document intent detection with explicit mentions ("upload document")
   - [x] Test load_document intent with implicit indications ("start proposal")
   - [x] Test routing to appropriate next step based on detected intent

3. **Test System Prompt Enhancement:**
   - [x] Test prompt generation with different document statuses
   - [x] Verify document context inclusion in system prompts
   - [x] Test document-specific guidance in generated responses

### Phase 3: API Integration Tests

1. **Test Continue Endpoint:**

   - [x] Test successful continue with valid proposalId
   - [x] Test with invalid/non-existent proposalId - should return 404
   - [x] Test with unauthorized user - should deny access
   - [x] Test with authenticated user - should return correct proposal status and rfpId

2. **Test Routing Logic:**

   - [x] Verify correct routing from document loader back to chat agent
   - [x] Test conditional edge from chat agent to document loader
   - [x] Test complete flow: chat → document loader → research

3. **Test Authentication:**
   - [x] Test continue endpoint with no userId - should check only existence
   - [x] Test continue endpoint with userId - should verify access rights
   - [ ] Test error handling for database connection issues

### Phase 4: Essential End-to-End Flow Tests

1. **Test User Experience Flow:**

   - [x] Start new proposal, verify document guidance in welcome message
   - [x] Resume existing proposal with loaded document, verify welcome message adapts
   - [x] Test conversation continuity across different workflow stages

2. **Test Integration Edge Cases:**
   - [x] Test with malformed rfpId format
   - [x] Test graceful fallbacks when services are unavailable
