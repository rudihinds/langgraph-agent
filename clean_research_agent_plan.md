# Research Agent Implementation Plan - Core MVP Functionality

## Phase 1: Core LangGraph Framework Setup

1. Set up LangGraph project structure

   - ✅ Create research directory following LangGraph patterns
   - ✅ Set up core LangGraph dependencies
   - ✅ Configure LangGraph and OpenAI environment variables

2. Implement prompt templates as LangGraph system messages
   - ✅ Create prompt templates file with all prompt templates
   - ✅ Implement deepResearchPrompt for deep analysis of RFP documents
   - ✅ Implement solutionSoughtPrompt for identifying the funder's desired solution approach

## Phase 2: LangGraph State Definition

1. Implement state with LangGraph Annotations

   - ✅ Create ResearchStateAnnotation using Annotation.Root
   - ✅ Implement messagesStateReducer for conversation history
   - ✅ Define custom reducers for research results

2. Configure essential document state

   - ✅ Define rfpDocument annotation for storing document text
   - ✅ Create state tracking for research progress

3. Configure persistence layer
   - ✅ Implement checkpointer configuration
   - ✅ Set up thread_id management according to our project standards
   - ✅ Configure message history management strategy

## Phase 3: LangGraph Agent Implementation

1. Implement tool definitions with LangGraph tool() function

   - ✅ Create web search tool for deep research agent
   - ✅ Implement deep research tool for solution sought agent

2. Create ReAct agents using LangGraph createReactAgent
   - ✅ Configure deepResearchAgent with LLM models
   - ✅ Implement solutionSoughtAgent with LLM models
   - ✅ Bind tools to respective agents

## Phase 4: LangGraph Node Implementation

1. Create document loader node

   - ✅ Create document loader node structure
   - ✅ Implement Supabase integration for document retrieval
   - ✅ Create basic document parsing functionality
     - ✅ Implemented PDF parsing with pdf.js
     - ✅ Added text and markdown support
     - ✅ Created metadata extraction (page count, word count, etc.)
     - ✅ Created parser tests

2. Implement agent nodes

   - ✅ Create deepResearchNode that invokes the agent
   - ✅ Implement solutionSoughtNode with proper input handling
   - ✅ Add basic error handling
     - ✅ Simple try/catch patterns with logging

3. Create frontend and API integration
   - ✅ Create API endpoint for parsing RFP documents
   - ✅ Implement RFP uploader component
   - ✅ Create RFP upload page

## Phase 5: LangGraph Assembly

1. Create the Research StateGraph

   - ✅ Implement main graph with StateGraph constructor
   - ✅ Configure nodes and edges with proper typing
   - ✅ Define conditional transitions with addConditionalEdges

2. Configure basic subgraph interface

   - ✅ Implement compile() with proper options
   - ✅ Create simple invoke() wrapper for external calls

3. Set up basic integration with orchestrator

   - ✅ Define clear input/output contracts for subgraph in [`apps/backend/agents/research/index.ts`](apps/backend/agents/research/index.ts)
   - ✅ Implement initial graph communication in [`apps/backend/agents/index.ts`](apps/backend/agents/index.ts)

## Phase 6: Essential Testing

1. Implement basic LangGraph unit tests

   - ✅ Test state annotations and reducers
   - ⬜ Verify agent tool usage
   - ✅ Create basic node tests (document loader node)

2. Add simple integration test
   - ✅ Test complete subgraph with sample input

## What's Next (MVP Launch Ready)

1. **Fix Path Resolution in Tests**
   - ⬜ Update import path from `@/lib/logger.js` to relative path `../../lib/logger.js` in tests
