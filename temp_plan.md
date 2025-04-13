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
- ⬜ Add tool result caching layer in [`apps/backend/lib/tools/cache.ts`](apps/backend/lib/tools/cache.ts)

2. Create ReAct agents using LangGraph createReactAgent

- ✅ Configure deepResearchAgent with LLM models in [`apps/backend/agents/research/agents.ts`](apps/backend/agents/research/agents.ts)
- ✅ Implement solutionSoughtAgent with LLM models in [`apps/backend/agents/research/agents.ts`](apps/backend/agents/research/agents.ts)
- ✅ Bind tools to respective agents

## Phase 4: LangGraph Node Implementation

### Tasks

1. Create document loader node

- ✅ Create document loader node structure in [`apps/backend/agents/research/nodes.ts`](apps/backend/agents/research/nodes.ts)
- ⬜ Implement Supabase integration for document retrieval in [`apps/backend/lib/db/documents.ts`](apps/backend/lib/db/documents.ts)
- ⬜ Create basic document parsing functionality in [`apps/backend/lib/parsers/rfp.ts`](apps/backend/lib/parsers/rfp.ts)

2. Implement agent nodes

- ✅ Create deepResearchNode that invokes the agent in [`apps/backend/agents/research/nodes.ts`](apps/backend/agents/research/nodes.ts)
- ✅ Implement solutionSoughtNode with proper input handling in [`apps/backend/agents/research/nodes.ts`](apps/backend/agents/research/nodes.ts)
- ✅ Add error handling according to our established patterns

## Phase 5: LangGraph Assembly

### Tasks

1. Create the Research StateGraph

- ✅ Implement main graph with StateGraph constructor in [`apps/backend/agents/research/index.ts`](apps/backend/agents/research/index.ts)
- ✅ Configure nodes and edges with proper typing
- ✅ Define conditional transitions with addConditionalEdges
- ⬜ Implement error recovery strategies in [`apps/backend/agents/research/error-handlers.ts`](apps/backend/agents/research/error-handlers.ts)

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

## Phase 8: Performance Optimization

### Tasks

1. Optimize LangGraph execution

- ✅ Implement caching for expensive operations in [`apps/backend/lib/state/messages.ts`](apps/backend/lib/state/messages.ts)
- ⬜ Add batch processing for document chunks in [`apps/backend/lib/parsers/batch.ts`](apps/backend/lib/parsers/batch.ts)
- ⬜ Optimize state serialization for large documents in [`apps/backend/lib/state/serialization.ts`](apps/backend/lib/state/serialization.ts)
- ⬜ Implement Send API for parallel document processing in [`apps/backend/lib/llm/send-api.ts`](apps/backend/lib/llm/send-api.ts)

2. Add advanced safeguards

- ⬜ Implement timeout handling with LangGraph cancellation in [`apps/backend/lib/errors/timeout.ts`](apps/backend/lib/errors/timeout.ts)
- ⬜ Add circuit breakers for API dependencies in [`apps/backend/lib/errors/circuit-breaker.ts`](apps/backend/lib/errors/circuit-breaker.ts)
- ⬜ Create graceful termination mechanisms in [`apps/backend/lib/errors/termination.ts`](apps/backend/lib/errors/termination.ts)

## Phase 9: Enhanced Observability

### Tasks

1. Add comprehensive LangSmith tracing

- ⬜ Configure detailed tracing for all LLM calls in [`apps/backend/lib/tracing/langsmith.ts`](apps/backend/lib/tracing/langsmith.ts)
- ⬜ Implement tool execution tracing in [`apps/backend/lib/tracing/tools.ts`](apps/backend/lib/tracing/tools.ts)
- ⬜ Add custom trace metadata for debugging in [`apps/backend/lib/tracing/metadata.ts`](apps/backend/lib/tracing/metadata.ts)

2. Implement advanced logging

- ✅ Create structured logging for graph execution in [`apps/backend/lib/state/supabase.ts`](apps/backend/lib/state/supabase.ts)
- ⬜ Add performance metrics collection in [`apps/backend/lib/metrics/performance.ts`](apps/backend/lib/metrics/performance.ts)
- ⬜ Implement execution visualization in [`apps/backend/lib/visualization/execution.ts`](apps/backend/lib/visualization/execution.ts)

## Phase 10: Comprehensive Testing

### Tasks

1. Add advanced testing scenarios

- ✅ Test with various document formats and sizes in [`apps/backend/tests/supabase-checkpointer.test.ts`](apps/backend/tests/supabase-checkpointer.test.ts)
- ⬜ Implement performance testing under load in [`apps/backend/agents/research/__tests__/performance.test.ts`](apps/backend/agents/research/__tests__/performance.test.ts)
- ⬜ Add security and permission testing in [`apps/backend/agents/research/__tests__/security.test.ts`](apps/backend/agents/research/__tests__/security.test.ts)

2. Create robust test fixtures

- ✅ Build comprehensive mock suite for dependencies in [`apps/backend/tests/supabase-checkpointer.test.ts`](apps/backend/tests/supabase-checkpointer.test.ts)
- ⬜ Create realistic test scenarios in [`apps/backend/agents/research/__tests__/fixtures/index.ts`](apps/backend/agents/research/__tests__/fixtures/index.ts)

## Phase 11: Documentation & Maintenance

### Tasks

1. Create comprehensive documentation

- ✅ Document LangGraph patterns used in [`apps/backend/agents/README.md`](apps/backend/agents/README.md)
- ⬜ Create detailed architecture diagrams in [`docs/architecture/research-agent.md`](docs/architecture/research-agent.md)
- ✅ Add usage examples and tutorials in [`apps/backend/agents/README.md`](apps/backend/agents/README.md)

2. Implement maintenance processes

- ⬜ Create monitoring dashboards in [`monitoring/dashboards/research.json`](monitoring/dashboards/research.json)
- ⬜ Define alert thresholds in [`monitoring/alerts/research.json`](monitoring/alerts/research.json)
- ⬜ Design update procedures in [`docs/operations/updates.md`](docs/operations/updates.md)

## Phase 12: Enhanced Persistence Implementation

### Tasks

1. Implement Supabase-based LangGraph persistence

- ✅ Create Supabase table schema for proposal sessions

  - ✅ Create `proposal_checkpoints` table with proper indexes in Supabase
  - ✅ Implement Row Level Security policies for checkpoint data
  - ✅ Add metadata columns for tracking session status

- ✅ Implement SupabaseCheckpointer class in [`apps/backend/lib/state/supabase.ts`](apps/backend/lib/state/supabase.ts)

  - ✅ Implement `get` method with error handling and retries
  - ✅ Implement `put` method with transaction support
  - ✅ Implement `delete` method for cleanup
  - ✅ Add connection pooling for performance
  - ✅ Add metrics tracking for persistence operations

- ✅ Update research agent to use SupabaseCheckpointer in [`apps/backend/agents/research/index.ts`](apps/backend/agents/research/index.ts)
  - ✅ Replace MemorySaver with SupabaseCheckpointer
  - ✅ Configure proper thread_id generation tied to proposals
  - ✅ Add error handling for persistence failures

2. Implement message history management

- ✅ Create message pruning utilities in [`apps/backend/lib/state/messages.ts`](apps/backend/lib/state/messages.ts)

  - ✅ Implement `pruneMessageHistory` function based on token count or message age
  - ⬜ Create conversation summarization for long-running sessions
  - ✅ Add support for truncating messages while preserving context

- ⬜ Implement efficient message serialization in [`apps/backend/lib/state/serialization.ts`](apps/backend/lib/state/serialization.ts)
  - ⬜ Add compression for large message payloads
  - ⬜ Implement Zod validation for message structure
  - ⬜ Create token estimation utilities

3. Enhance session management

- ✅ Implement session recovery flow in [`apps/backend/agents/research/index.ts`](apps/backend/agents/research/index.ts)

  - ✅ Create robust error categorization for checkpoint errors
  - ✅ Implement automatic retry with exponential backoff
  - ✅ Add logging for recovery attempts

- ✅ Create session tracking utilities in [`apps/backend/lib/state/supabase.ts`](apps/backend/lib/state/supabase.ts)
  - ✅ Implement thread_id generation with consistent format
  - ✅ Add session metadata tracking (start time, last access, etc.)
  - ⬜ Create scheduled cleanup for abandoned sessions

4. Create frontend integration

- ⬜ Implement session persistence indicators in UI [`apps/web/src/components/research/SessionStatus.tsx`](apps/web/src/components/research/SessionStatus.tsx)

  - ⬜ Add visual indicators for saving/loading state
  - ⬜ Create error handling for persistence failures
  - ⬜ Implement session recovery UI

- ⬜ Update research agent API with persistence support in [`apps/web/src/app/api/research/route.ts`](apps/web/src/app/api/research/route.ts)
  - ⬜ Add thread_id management in API routes
  - ⬜ Implement session continuation endpoints
  - ⬜ Create error handling for session recovery

## Phase 13: Error Handling Integration (NEW)

### Tasks

1. Integrate with advanced error handling system

- ⬜ Implement integration with error classification system in [`apps/backend/lib/llm/error-classification.ts`](apps/backend/lib/llm/error-classification.ts)
  - ⬜ Update SupabaseCheckpointer to use error categories
  - ⬜ Create specific error handling for CHECKPOINT_ERROR category
  - ⬜ Add error event tracking for persistence operations

2. Implement advanced node error handling

- ⬜ Integrate with createAdvancedNodeErrorHandler from [`apps/backend/lib/llm/node-error-handler.ts`](apps/backend/lib/llm/node-error-handler.ts)
  - ⬜ Configure retry policies for research nodes
  - ⬜ Implement fallback behaviors for persistence failures
  - ⬜ Set up error propagation and handling

3. Add timeout management

- ⬜ Integrate with TimeoutManager from [`apps/backend/lib/llm/timeout-manager.ts`](apps/backend/lib/llm/timeout-manager.ts)
  - ⬜ Configure appropriate timeouts for research operations
  - ⬜ Add cancellation support for hanging operations
  - ⬜ Implement graceful termination for timed-out sessions

## Phase 14: Streaming Integration (NEW)

### Tasks

1. Implement streaming for persistence operations

- ⬜ Integrate with streaming components from [`apps/backend/lib/llm/streaming`](apps/backend/lib/llm/streaming)
  - ⬜ Create streaming updates for persistence operations
  - ⬜ Implement real-time status feedback during saves/loads
  - ⬜ Add streaming error reporting for persistence failures

2. Enhance user experience with streaming

- ⬜ Create UI components for streaming persistence status
  - ⬜ Implement real-time saving indicators
  - ⬜ Add progress updates for long-running operations
  - ⬜ Create error notifications with recovery options
