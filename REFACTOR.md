# LangGraph Agent Refactoring Plan

This document outlines the refactoring plan to align the codebase with the architecture defined in `AGENT_ARCHITECTURE.md` and `AGENT_BASESPEC.md`.

## Refactoring Tasks

### 1. State Management Alignment (Task #11)
- Update the state interface to match the `OverallProposalState` definition
- Implement comprehensive annotations and reducers
- Create Zod schemas for validation
- Ensure immutable state updates

### 2. Orchestrator Service Enhancement (Task #12)
- Define comprehensive `OrchestratorService` with session management
- Implement dependency tracking and management
- Support non-sequential editing
- Create methods for managing workflow state and user interactions

### 3. Persistence Layer Refinement (Task #13)
- Enhance Supabase checkpointer implementation
- Create proper database schema and migration scripts
- Implement Row Level Security policies
- Ensure proper error handling and retry logic

### 4. Graph Structure Refinement (Task #14)
- Update `ProposalGenerationGraph` definition
- Implement proper routing functions
- Configure HITL interrupt points
- Implement conditional edges based on evaluation results

### 5. Node Implementation (Task #15)
- Create or update node functions for document processing
- Implement requirement analysis nodes
- Update section generation nodes
- Ensure nodes work within the updated graph structure

### 6. Editor Agent Implementation (Task #16)
- Create `EditorAgentService` for non-sequential edits
- Implement section revision management
- Maintain proposal consistency
- Add dependency analysis capabilities

### 7. API Layer Enhancement (Pending)
- Implement Express.js API endpoints
- Add authentication middleware
- Add validation for requests/responses
- Implement error handling

### 8. Testing Implementation (Pending)
- Add unit tests for all components
- Add integration tests for key workflows
- Test HITL interrupts and resumption

## Implementation Priority

1. State interface and annotations (foundation)
2. Persistence layer (for state saving/loading)
3. Graph structure (core workflow)
4. Orchestrator service (coordination)
5. Node implementation (processing logic)
6. Editor agent (non-sequential editing)
7. API layer (external interface)
8. Testing (quality assurance)

## Dependency Map

The refactoring tasks should be approached in an order that respects their dependencies:

```
State Management ──────┐
                       ├──► Graph Structure ───┐
Persistence Layer ─────┘                       │
                                               ├──► Node Implementation ───┐
                                               │                           │
Orchestrator Service ───────────────────────┬──┘                           ├──► API Layer
                                            │                              │
Editor Agent Implementation ────────────────┴──────────────────────────────┘
```

## Guiding Principles

1. **Strict Type Safety**: Use TypeScript interfaces and Zod validation throughout.
2. **Immutable State Updates**: All state modifications use proper reducers.
3. **File Size Limit**: Keep files under 300 lines of code.
4. **Comprehensive Documentation**: JSDoc for all functions, classes, and interfaces.
5. **Test-Driven Development**: Write tests concurrently with implementation.
6. **Error Handling**: Consistent error handling throughout the codebase.

## Expected Outcomes

After completing this refactoring plan, the codebase will:

1. Align with the architecture defined in the specification documents
2. Support non-sequential editing of proposal sections
3. Implement proper HITL workflow with interrupts and resumption
4. Provide comprehensive testing coverage
5. Ensure data security with proper authentication and authorization
6. Support robust error handling and recovery