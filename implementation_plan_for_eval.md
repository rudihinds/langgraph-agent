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

### HITL Configuration

- [x] Create example of evaluation nodes as interrupt points
- [x] Provide example implementation of interrupt handlers
- [ ] Integrate with actual Orchestrator implementation

## Orchestrator Integration

### Interrupt Handling

- [x] Create example implementation of processing evaluation interrupts
- [x] Demonstrate user feedback handling implementation
- [x] Show state transition logic for evaluation results
- [ ] Integrate with actual Orchestrator Service

### Dependency Management

- [ ] Integrate with dependency tracking system
- [ ] Implement stale marking for dependent sections

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
  - [x] `evaluationNodeFactory.test.ts` - Tests for the factory functionality
  - [x] `contentExtractors.test.ts` - Tests for content extraction functions
  - [x] `evaluationCriteria.test.ts` - Tests for criteria loading and validation
  - [x] `stateManagement.test.ts` - Tests for state compatibility and updates
  - [x] `errorHandling.test.ts` - Tests for error conditions and recovery

### Integration Tests

- [ ] Test node interaction with LangGraph
- [ ] Test full evaluation workflows
- [ ] Test Orchestrator integration

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

- Completed implementation of `EvaluationNodeFactory` class:
  - Created factory methods for all evaluation types (research, solution, connection pairs)
  - Implemented section-specific evaluation node creation with the `createSectionEvaluationNode` method
  - Added funder-solution alignment evaluation node creation
  - Fixed criteria path handling to properly resolve JSON files
  - Added tests for factory functionality
- Created example implementations demonstrating how to integrate evaluation nodes:
  - Created `sectionEvaluationNodes.ts` showing how to create evaluation nodes for different section types
  - Created `graphIntegration.ts` demonstrating how to integrate evaluation nodes into the main graph
  - Provided examples of conditional routing based on evaluation results
  - Demonstrated how to handle human-in-the-loop evaluation interactions
- Completed all content extractors:
  - Implemented funder-solution alignment content extractor
  - Created section-specific extractors for problem statement, methodology, budget, timeline, and conclusion
  - Added support for custom validation and preprocessing in extractors

## Next Steps

1. **Integrate with actual proposal generation graph**:

   - Apply the patterns from the example implementations to the actual graph
   - Add evaluation nodes at appropriate points in the content generation flow
   - Implement conditional routing based on evaluation results
   - Configure interrupt handling for human review

2. **Integrate with actual Orchestrator Service**:

   - Implement the resume-after-evaluation pattern in the Orchestrator
   - Add support for human feedback processing
   - Implement state updates based on evaluation results
   - Add dependency tracking for sections that fail evaluation

3. **Implement UI components for evaluation results**:

   - Create components to display evaluation scores and feedback
   - Implement feedback collection forms for human evaluation
   - Add visualizations for evaluation results
   - Create responsive UI for evaluation workflow

4. **Apply testing best practices to remaining tests**:
   - Implement proper module mocking with `vi.hoisted()`
   - Create proper test state interfaces that match production types
   - Use the standardized mock patterns for fs, path, and custom modules
   - Split large test files into focused, maintainable components
   - Add explicit type assertions where necessary to maintain type safety
   - Ensure test organization follows the established patterns
