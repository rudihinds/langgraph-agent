# Evaluation Framework Implementation Plan

This implementation plan outlines the tasks required to build the standardized evaluation framework as specified in `spec_eval_linear.md`. The plan is based on the architecture documents and existing implementation details.

## Core Framework Components

### Evaluation Result Interface

- [x] Define `EvaluationResult` interface
- [x] Implement Zod schema validation with `EvaluationResultSchema`
- [x] Create utility functions for score calculations (`calculateOverallScore`)

### Evaluation Criteria Configuration

- [x] Define `EvaluationCriteria` interface
- [x] Implement Zod schema validation with `EvaluationCriteriaSchema`
- [x] Create `loadCriteriaConfiguration` function
- [x] Implement default criteria fallback (`DEFAULT_CRITERIA`)
- [x] Create criteria configuration JSON files for each content type:
  - [x] `/config/evaluation/criteria/research.json`
  - [x] `/config/evaluation/criteria/solution.json`
  - [x] `/config/evaluation/criteria/connection_pairs.json`
  - [x] `/config/evaluation/criteria/problem_statement.json`
  - [x] Additional section-specific criteria files

### Evaluation Node Factory

- [x] Implement `createEvaluationNode` factory function
- [x] Support content extraction options
- [x] Integrate criteria loading
- [x] Add comprehensive error handling
- [x] Implement proper timeout protection (60-second default)
- [x] Create standardized prompt construction
- [x] Support custom validation logic
- [x] Fix type issues with `ResultValidator` to properly handle object and boolean returns
- [x] Implement `EvaluationNodeFactory` class with factory methods for different evaluation types

## Node Execution Flow Implementation

### Input Validation

- [x] Validate existence of content
- [x] Add content format validation
- [x] Implement state readiness checks

### Status Management

- [x] Update content-specific status
- [x] Implement all required status transitions

### LLM Integration

- [x] Configure ChatOpenAI model integration
- [x] Implement error handling for LLM errors
- [x] Add structured prompt templates
- [x] Create response parsing and validation
- [x] Proper handling of unknown error types

### HITL Integration

- [x] Set interrupt flag in state
- [x] Add appropriate interrupt metadata
- [x] Include content reference in metadata
- [x] Structure interrupt metadata according to `OverallProposalState` requirements
- [x] Support for resume processing (implemented in example integration)

### State Management

- [x] Update evaluation result field
- [x] Update status field
- [x] Add messages for users
- [x] Record errors on failure
- [x] Support interrupt metadata
- [x] Proper updating of `interruptStatus` object

## Content Extractors

- [x] Create dedicated file for content extractors
- [x] Implement research content extractor
- [x] Implement solution content extractor
- [x] Implement connection pairs content extractor
- [x] Implement section content extractors
- [x] Create section extractor factory function for generating section-specific extractors
- [x] Create tests for all content extractors
- [x] Implement funder-solution alignment content extractor

## Specific Node Implementations

### Research Evaluation Node

- [x] Create using the factory pattern
- [x] Create specialized prompt for research evaluation
- [x] Add research-specific criteria configuration
- [x] Implement research-specific content extraction

### Solution Evaluation Node

- [x] Create using the factory pattern
- [x] Create specialized prompt for solution evaluation
- [x] Add solution-specific criteria configuration
- [x] Implement solution-specific content extraction

### Connection Pairs Evaluation Node

- [x] Create using the factory pattern
- [x] Create specialized prompt for connections evaluation
- [x] Add connections-specific criteria configuration
- [x] Implement connections-specific content extraction

### Section Evaluation Nodes

- [x] Create factory-based implementations for each section type
- [x] Create specialized prompts for section evaluation
- [x] Add section-specific criteria configurations
- [x] Implement section-specific content extractors
- [x] Create example implementation for section evaluation node integration

### Funder-Solution Alignment Evaluation Node

- [x] Create using the factory pattern
- [x] Create specialized prompt for funder-solution alignment evaluation
- [x] Add funder-solution alignment criteria configuration
- [x] Implement funder-solution alignment content extraction

## Graph Integration

### Node Registration

- [x] Create example implementation of adding evaluation nodes to the graph
- [x] Demonstrate connecting with appropriate edges
- [x] Provide example of conditional routing implementation
- [ ] Integrate with actual proposal generation graph

#### Implementation Tasks

1. **Create Integration Utilities**:

   - [ ] Implement `routeAfterEvaluation` conditional function in `apps/backend/agents/proposal_generation/conditionals.ts`
   - [ ] Create `addEvaluationNode` helper function in `apps/backend/agents/proposal_generation/evaluation_integration.ts`
   - [ ] Write tests for conditional routing function
   - [ ] Write tests for node registration helper

2. **Update Graph Definition**:
   - [ ] Modify `apps/backend/agents/proposal_generation/graph.ts` to use evaluation node integration
   - [ ] Add evaluation nodes for each content type (research, solution, connections, sections)
   - [ ] Configure proper interrupt points for all evaluation nodes
   - [ ] Add conditional edges for handling evaluation results

### HITL Configuration

- [x] Create example of evaluation nodes as interrupt points
- [x] Provide example implementation of interrupt handlers
- [ ] Integrate with actual Orchestrator implementation

#### Implementation Tasks

1. **Configure HITL in Graph**:

   - [ ] Update `graph.compiler.interruptAfter()` configuration to include all evaluation nodes
   - [ ] Create tests to verify interrupt configuration
   - [ ] Implement proper interrupt metadata structure for evaluations

2. **HITL User Interface Integration**:
   - [ ] Define UI component requirements for displaying evaluation results
   - [ ] Specify available actions for different evaluation statuses
   - [ ] Document UI state management for interrupt handling

## Orchestrator Integration

### Interrupt Handling

- [x] Create example implementation of processing evaluation interrupts
- [x] Demonstrate user feedback handling implementation
- [x] Show state transition logic for evaluation results
- [ ] Integrate with actual Orchestrator Service

#### Implementation Tasks

1. **Implement Orchestrator Methods**:

   - [ ] Create `handleEvaluationFeedback` method in `OrchestratorService`
   - [ ] Implement logic for processing approval, revision, and edit actions
   - [ ] Add state transition handling for evaluation results
   - [ ] Add tests for all feedback handling paths

2. **API Integration**:
   - [ ] Define API routes for handling evaluation feedback
   - [ ] Implement request validation for evaluation feedback
   - [ ] Create handlers for connecting API to Orchestrator

### Dependency Management

- [ ] Integrate with dependency tracking system
- [ ] Implement stale marking for dependent sections

#### Implementation Tasks

1. **Dependency Tracking**:

   - [ ] Implement `markDependentSectionsAsStale` in `OrchestratorService`
   - [ ] Create utility to load dependency map from configuration
   - [ ] Add tests for dependency tracking logic
   - [ ] Implement helper for detecting affected sections

2. **Stale Content Management**:

   - [ ] Create `handleStaleDecision` method in `OrchestratorService`
   - [ ] Implement "keep" vs. "regenerate" logic
   - [ ] Add support for regeneration guidance in messages
   - [ ] Update graph to use regeneration guidance when available

3. **Generator Node Updates**:
   - [ ] Modify all generator nodes to check for guidance in `state.messages`
   - [ ] Implement guidance parsing and incorporation
   - [ ] Add tests for regeneration with guidance
   - [ ] Ensure guidance is removed from messages after use

## Testing

### Unit Tests

- [x] Test `EvaluationResult` schema validation
- [x] Test score calculation logic
- [x] Test criteria loading
- [x] Test basic evaluation node functionality
- [x] Test evaluation node error handling
- [x] Test timeout behavior
- [x] Test HITL integration
- [x] Fix mock implementation for custom validation to ensure proper handling of both boolean and object returns
- [x] Test content extractors for various input scenarios

### Vitest Testing Best Practices

#### Module Mocking

- [x] Use `vi.hoisted()` for all mock definitions to avoid reference errors
- [x] Ensure path mocks include both named exports and default export
- [x] Reset mocks in `beforeEach`/`afterEach` hooks to ensure clean test state
- [x] For modules with default exports, mock both default and named exports
- [x] Use control variables to adjust mock behavior between different test cases
- [x] Properly structure fs/path mocks to simulate file system operations

#### TypeScript Integration

- [x] Create proper test state interfaces that match actual state structure
- [x] Use type assertions strategically to satisfy TypeScript without compromising test value
- [x] Import actual state types from source files when possible
- [x] For partial test states, use `as` type assertions to cast to required interface types
- [x] Use explicit indexing notation for accessing properties on test objects (e.g., `state.sections['research']`)
- [x] Define comprehensive interfaces for test objects that mirror production interfaces

#### Test Organization

- [x] Split tests into logical components with focused test files
- [x] Use nested `describe` blocks for better test organization
- [x] Create setup/teardown routines with `beforeEach`/`afterEach`
- [x] Use descriptive test names that specify behavior, not implementation
- [x] Organize tests from simple to complex scenarios

### Comprehensive Test Coverage

#### State Structure Tests

- [x] Create proper mock state objects that match `OverallProposalState` interface

  - [x] Include all required fields (sections, statuses, messages, errors)
  - [x] Mirror the exact structure of nested fields (e.g., `sections[sectionId].content`)
  - [x] Use correct field types to catch type mismatch issues
  - [x] Test with complete state and minimal valid state

- [x] Verify state field access

  - [x] Test content extractors can access specific state fields
  - [x] Test compatibility with nested state properties
  - [x] Verify correct handling of optional fields

- [x] Validate state updates
  - [x] Test that nodes properly update status fields
  - [x] Verify result fields are populated correctly
  - [x] Confirm error messages are added to the correct fields
  - [x] Test that interrupt flags are properly set
  - [x] Verify interrupt metadata format and content

#### Core Processing Tests

- [x] Test with actual criteria files

  - [x] Load criteria files from `/config/evaluation/criteria/`
  - [x] Test all content types (research, solution, sections)
  - [x] Verify error handling when criteria file is missing
  - [x] Test fallback to default criteria

- [x] Verify content extraction

  - [x] Test extractors with different state structures
  - [x] Verify handling of empty/missing content
  - [x] Test extraction of structured content (JSON)
  - [x] Test extraction of text content

- [x] Test evaluation process

  - [x] Verify status transitions
  - [x] Test score calculations based on criteria weights
  - [x] Verify pass/fail determination based on thresholds
  - [x] Test application of critical criteria rules

- [x] Test HITL integration
  - [x] Verify interrupt flag is set
  - [x] Test interrupt metadata structure
  - [x] Test metadata includes correct content references
  - [x] Verify available actions match expected options

#### Error Handling Tests

- [x] Test missing content scenarios

  - [x] Verify error handling when content is empty
  - [x] Test error handling when content field is missing
  - [x] Verify error handling when content is malformed
  - [x] Test custom validation error handling

- [x] Test LLM interaction errors

  - [x] Test handling of timeout errors
  - [x] Verify error handling for API failures
  - [x] Test handling of malformed LLM responses
  - [x] Verify recovery from transient errors

- [x] Test error reporting and propagation
  - [x] Verify errors are added to state.errors array
  - [x] Test error message format and content
  - [x] Verify error status is set correctly
  - [x] Test error information is available to the Orchestrator

### Test File Structure

- [x] Split tests across multiple files to improve maintainability:
  - [x] `evaluationCriteria.test.ts` - Tests for criteria loading and validation ✅ **(COMPLETED)**
  - [x] `contentExtractors.test.ts` - Tests for content extraction functions ✅ **(COMPLETED)**
  - [x] `evaluationNodeFactory.test.ts` - Tests for the factory functionality ✅ **(COMPLETED)**
  - [x] `stateManagement.test.ts` - Tests for state compatibility and updates ✅ **(COMPLETED)**
  - [x] `errorHandling.test.ts` - Tests for error conditions and recovery ✅ **(COMPLETED)**
  - [x] `extractors.test.ts` - Tests for content extractors ✅ **(COMPLETED)**
  - [x] `factory.test.ts` - Tests for factory implementation ✅ **(COMPLETED)**
  - [x] `evaluationFramework.test.ts` - Tests for core framework components ✅ **(COMPLETED)**
  - [x] `evaluationNodeEnhancements.test.ts` - Tests for enhanced node functionality ✅ **(COMPLETED)**

### Integration Tests

- [ ] Test node interaction with LangGraph
- [ ] Test full evaluation workflows
- [ ] Test Orchestrator integration

#### Integration Test Implementation

1. **Graph Integration Tests**:

   - [ ] Create test for registering evaluation nodes within the graph
   - [ ] Test conditional routing based on evaluation results
   - [ ] Verify proper state updates through node execution
   - [ ] Test interrupt point configuration

2. **Orchestrator Integration Tests**:
   - [ ] Test evaluation feedback processing
   - [ ] Test dependency tracking with evaluation-based edits
   - [ ] Verify stale section handling
   - [ ] Test regeneration with guidance

### Test Mocking Guidelines

- [x] Follow these mocking patterns for consistent test implementation:

  - [x] Use `vi.hoisted()` for all mock definitions to avoid reference errors
  - [x] For file system operations, mock both path and fs modules comprehensively
  - [x] For path module, include both default export and named exports in mock
  - [x] Use control variables (e.g., `mockShouldFail = true/false`) to control mock behavior between tests
  - [x] Reset all mocks and control variables in `beforeEach`/`afterEach` hooks
  - [x] For complex return values, explicitly type the mock implementation
  - [x] Use `mockImplementation()` over `mockReturnValue()` for conditional logic in mocks

- [x] Standard mock patterns to use:

  ```typescript
  // Path module mocking
  const pathMock = vi.hoisted(() => ({
    resolve: vi.fn(),
    default: { resolve: vi.fn() },
  }));
  vi.mock("path", () => pathMock);

  // FS module mocking
  const fsMock = vi.hoisted(() => ({
    promises: {
      access: vi.fn(),
      readFile: vi.fn(),
    },
  }));
  vi.mock("fs", () => fsMock);

  // Testing module with control variables
  let mockShouldFail = false;
  const moduleMock = vi.hoisted(() => ({
    someFunction: vi.fn().mockImplementation(() => {
      if (mockShouldFail) throw new Error("Test error");
      return "success";
    }),
  }));
  vi.mock("./module-path", () => moduleMock);

  beforeEach(() => {
    mockShouldFail = false;
    vi.clearAllMocks();
  });
  ```

## Documentation

### Code Documentation

- [x] Add JSDoc comments to all functions
- [x] Document evaluation node parameters
- [x] Document state transitions
- [x] Document content extractors
- [x] Create example implementations for section evaluation integration

### User Documentation

- [ ] Create configuration guide for custom criteria
- [ ] Document evaluation prompt customization
- [ ] Add examples for all evaluation scenarios
- [ ] Create architecture diagrams for integration workflow

## Performance Optimization

- [x] Implement timeout handling for evaluation operations
- [ ] Implement caching for criteria loading
- [ ] Optimize prompt templates for token efficiency
- [ ] Add monitoring for evaluation times

## Final Checklist

- [x] Fix type issues with `ResultValidator` to support both boolean and object returns
- [x] Ensure proper error handling for unknown types
- [x] Implement content extractors for all evaluation types
- [x] Create factory-based evaluator node implementations for all content types
- [x] Create examples showing integration with graph and Orchestrator
- [ ] Finalize integration with actual Orchestrator Service and proposal generation graph

## Recent Progress

- All 9 evaluation test files are now passing:

  - `evaluationCriteria.test.ts` - 13 tests passed
  - `evaluationNodeFactory.test.ts` - 7 tests passed
  - `evaluationFramework.test.ts` - 12 tests passed
  - `stateManagement.test.ts` - 9 tests passed
  - `evaluationNodeEnhancements.test.ts` - 10 tests passed
  - `contentExtractors.test.ts` - 17 tests passed
  - `extractors.test.ts` - 36 tests passed
  - `factory.test.ts` - 10 tests passed
  - `errorHandling.test.ts` - 20 tests passed
  - Total: 134 tests passing across 9 test files

- Fixed all testing issues:
  - Addressed mock implementation issues with proper `vi.hoisted()` usage
  - Resolved TypeScript typing issues for factory and state mocks
  - Fixed path module mocking to include both named exports and default export
  - Implemented proper state structure for test objects

## Current Focus and Next Steps

1. **Graph Integration Development**:

   - Implement conditional routing function (`routeAfterEvaluation`)
   - Create node registration helper (`addEvaluationNode`)
   - Update main graph to integrate evaluation nodes
   - Configure HITL interrupt points

2. **Orchestrator Integration Development**:

   - Implement evaluation feedback handling
   - Create dependency tracking system
   - Add support for regeneration guidance
   - Update generator nodes to use guidance from messages

3. **Final Testing and Documentation**:
   - Create integration tests for graph interaction
   - Test full workflows with evaluation, feedback, and regeneration
   - Complete user documentation for evaluation configuration
   - Create architecture diagrams showing the evaluation flow
