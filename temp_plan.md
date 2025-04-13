# Research Agent Implementation Plan

This document outlines the implementation plan for the Research Agent subgraph using LangGraph.js, focusing on core features first, followed by post-launch improvements.

# CORE IMPLEMENTATION PHASE

The core implementation phase focuses on the essential LangGraph components needed for a functional Research Agent.

## Phase 1: Core LangGraph Framework Setup

### Tasks

1. Set up LangGraph project structure

- ✅ Create [`/apps/backend/agents/research`](apps/backend/agents/research) directory following LangGraph patterns
- ✅ Set up core LangGraph dependencies ([`package.json`](apps/backend/package.json))
- ✅ Configure LangGraph and OpenAI environment variables ([`.env.example`](apps/backend/.env.example))

2. Implement prompt templates as LangGraph system messages

- ✅ Create [`apps/backend/agents/research/prompts/index.ts`](apps/backend/agents/research/prompts/index.ts) with all prompt templates
- ✅ Implement deepResearchPrompt for deep analysis of RFP documents
- ✅ Implement solutionSoughtPrompt for identifying the funder's desired solution approach

## Phase 2: LangGraph State Definition

### Tasks

1. Implement state with LangGraph Annotations

- ✅ Create [`apps/backend/agents/research/state.ts`](apps/backend/agents/research/state.ts) with ResearchStateAnnotation using Annotation.Root
- ✅ Implement messagesStateReducer for conversation history
- ✅ Define custom reducers for research results

2. Configure essential document state

- ✅ Define rfpDocument annotation for storing document text in [`apps/backend/agents/research/state.ts`](apps/backend/agents/research/state.ts)
- ✅ Create state tracking for research progress

3. Configure persistence layer

- ✅ Implement checkpointer configuration in [`apps/backend/agents/research/index.ts`](apps/backend/agents/research/index.ts)
- ✅ Set up thread_id management according to our project standards
- ✅ Configure message history management strategy in [`apps/backend/lib/state/messages.ts`](apps/backend/lib/state/messages.ts)

## Phase 3: LangGraph Agent Implementation

### Tasks

1. Implement tool definitions with LangGraph tool() function

- ✅ Create web search tool for deep research agent in [`apps/backend/agents/research/tools.ts`](apps/backend/agents/research/tools.ts)
- ✅ Implement deep research tool for solution sought agent in [`apps/backend/agents/research/tools.ts`](apps/backend/agents/research/tools.ts)

2. Create ReAct agents using LangGraph createReactAgent

- ✅ Configure deepResearchAgent with LLM models in [`apps/backend/agents/research/agents.ts`](apps/backend/agents/research/agents.ts)
- ✅ Implement solutionSoughtAgent with LLM models in [`apps/backend/agents/research/agents.ts`](apps/backend/agents/research/agents.ts)
- ✅ Bind tools to respective agents

## Phase 4: LangGraph Node Implementation

### Tasks

1. Create document loader node

- ✅ Create document loader node structure in [`apps/backend/agents/research/nodes.ts`](apps/backend/agents/research/nodes.ts)
- ✅ Implement Supabase integration for document retrieval in [`apps/backend/lib/db/documents.ts`](apps/backend/lib/db/documents.ts)
- ✅ Create basic document parsing functionality in [`apps/backend/lib/parsers/rfp.ts`](apps/backend/lib/parsers/rfp.ts)
  - ✅ Implemented PDF parsing with pdf.js
  - ✅ Added text and markdown support
  - ✅ Created metadata extraction (page count, word count, etc.)
  - ✅ Added comprehensive error handling
  - ✅ Created tests in [`apps/backend/lib/parsers/__tests__/rfp.test.ts`](apps/backend/lib/parsers/__tests__/rfp.test.ts)

2. Implement agent nodes

- ✅ Create deepResearchNode that invokes the agent in [`apps/backend/agents/research/nodes.ts`](apps/backend/agents/research/nodes.ts)
- ✅ Implement solutionSoughtNode with proper input handling in [`apps/backend/agents/research/nodes.ts`](apps/backend/agents/research/nodes.ts)
- ✅ Add error handling according to our established patterns
  - ✅ Standardized error handling across all node functions
  - ✅ Added proper typing with unknown error handling
  - ✅ Implemented comprehensive logging

3. Create frontend and API integration

- ✅ Create API endpoint for parsing RFP documents in [`apps/backend/api/rfp/parse.ts`](apps/backend/api/rfp/parse.ts)
- ✅ Implement RFP uploader component in [`apps/frontend/components/RfpUploader.tsx`](apps/frontend/components/RfpUploader.tsx)
- ✅ Create RFP upload page in [`apps/frontend/app/rfp/upload/page.tsx`](apps/frontend/app/rfp/upload/page.tsx)

## Phase 5: LangGraph Assembly

### Tasks

1. Create the Research StateGraph

- ✅ Implement main graph with StateGraph constructor in [`apps/backend/agents/research/index.ts`](apps/backend/agents/research/index.ts)
- ✅ Configure nodes and edges with proper typing
- ✅ Define conditional transitions with addConditionalEdges
<!-- - ⬜ Implement error recovery strategies in [`apps/backend/agents/research/error-handlers.ts`](apps/backend/agents/research/error-handlers.ts) -->

2. Configure basic subgraph interface

- ✅ Implement compile() with proper options in [`apps/backend/agents/research/index.ts`](apps/backend/agents/research/index.ts)
- ✅ Create simple invoke() wrapper for external calls

3. Set up basic integration with orchestrator

- ✅ Define clear input/output contracts for subgraph in [`apps/backend/agents/research/index.ts`](apps/backend/agents/research/index.ts)
- ⬜ Implement initial graph communication in [`apps/backend/agents/index.ts`](apps/backend/agents/index.ts)

## Phase 6: Essential Testing

### Tasks

1. Implement basic LangGraph unit tests

- ✅ Test state annotations and reducers in [`apps/backend/agents/research/__tests__/state.test.ts`](apps/backend/agents/research/__tests__/state.test.ts)
- ⬜ Verify agent tool usage in [`apps/backend/agents/research/__tests__/agents.test.ts`](apps/backend/agents/research/__tests__/agents.test.ts)
- ⬜ Create basic node tests in [`apps/backend/agents/research/__tests__/nodes.test.ts`](apps/backend/agents/research/__tests__/nodes.test.ts)

2. Add simple integration test

- ✅ Test complete subgraph with sample input in [`apps/backend/agents/research/__tests__/index.test.ts`](apps/backend/agents/research/__tests__/index.test.ts)
- ⬜ Verify basic graph execution

# POST-LAUNCH IMPROVEMENTS PHASE

These enhancements can be implemented after the core functionality is working.

## Phase 7: Advanced LangGraph Features

### Tasks

1. Add advanced state management

- ✅ Implement sophisticated error tracking in state in [`apps/backend/agents/research/state.ts`](apps/backend/agents/research/state.ts)
- ✅ Add detailed status tracking for research steps
- ✅ Create checkpointing for long-running research in [`apps/backend/lib/state/supabase.ts`](apps/backend/lib/state/supabase.ts)

2. Enhance document processing

- ⬜ Implement advanced chunking for large documents in [`apps/backend/lib/parsers/chunker.ts`](apps/backend/lib/parsers/chunker.ts)
- ⬜ Create metadata extraction for better context in [`apps/backend/lib/parsers/metadata.ts`](apps/backend/lib/parsers/metadata.ts)

3. Improve agent capabilities

- ⬜ Add more specialized research tools in [`apps/backend/agents/research/tools.ts`](apps/backend/agents/research/tools.ts)
- ⬜ Implement advanced tool selection logic in [`apps/backend/agents/research/agents.ts`](apps/backend/agents/research/agents.ts)

4. Add human-in-the-loop controls

- ⬜ Implement LangGraph's interrupt capability in [`apps/backend/agents/research/index.ts`](apps/backend/agents/research/index.ts)
- ⬜ Add approval workflows for critical findings in [`apps/backend/agents/research/nodes.ts`](apps/backend/agents/research/nodes.ts)
- ⬜ Create feedback incorporation mechanisms in [`apps/backend/agents/research/feedback.ts`](apps/backend/agents/research/feedback.ts)

# WHAT'S NEXT

Based on our progress, the next critical tasks are:

1. **Complete Phase 5: LangGraph Assembly**

   - Implement error recovery strategies in `apps/backend/agents/research/error-handlers.ts`
   - Complete integration with the orchestrator in `apps/backend/agents/index.ts`

2. **Complete Phase 6: Essential Testing**

   - Create tests for agent tool usage in `apps/backend/agents/research/__tests__/agents.test.ts`
   - Implement node tests in `apps/backend/agents/research/__tests__/nodes.test.ts`
   - Verify basic graph execution in integration tests

3. **Begin Phase 7: Advanced Features**

   - Start with document chunking for large documents
   - Add specialized research tools for more sophisticated analysis

4. **Documentation and Optimization**
   - Document the RFP parser API and usage patterns
   - Optimize performance for large documents
   - Add caching for expensive operations
