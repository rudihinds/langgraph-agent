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
- [ ] Support for resume processing (handled by Orchestrator)

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

## Graph Integration

### Node Registration

- [ ] Add evaluation nodes to the graph
- [ ] Connect with appropriate edges
- [ ] Implement conditional routing

### HITL Configuration

- [ ] Register evaluation nodes as interrupt points
- [ ] Configure interrupt handlers

## Orchestrator Integration

### Interrupt Handling

- [ ] Update Orchestrator to process evaluation interrupts
- [ ] Implement user feedback handling
- [ ] Add state transition logic

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

### Integration Tests

- [ ] Test node interaction with LangGraph
- [ ] Test full evaluation workflows
- [ ] Test Orchestrator integration

## Documentation

### Code Documentation

- [x] Add JSDoc comments to all functions
- [x] Document evaluation node parameters
- [x] Document state transitions
- [x] Document content extractors

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
- [ ] Create factory-based evaluator node implementations
- [ ] Finalize integration with Orchestrator Service

## Recent Progress

- Fixed core test issues in the evaluation framework and node implementation:
  - Updated `ResultValidator` type to properly handle both boolean returns and object returns with valid/error properties
  - Implemented proper error handling for unknown types throughout the codebase
  - Fixed interrupt handling logic to ensure that `interruptStatus` and `interruptMetadata` are correctly set according to the `OverallProposalState` interface
  - Tests are now passing, with only expected warnings about missing criteria files
- Completed all criteria configuration JSON files for the different evaluation types:
  - Research evaluation criteria
  - Solution evaluation criteria
  - Connection pairs evaluation criteria
  - Problem statement evaluation criteria
  - Additional section-specific criteria
- Implemented content extractors for all evaluation types:
  - Created dedicated extractors.ts file for specialized extractors
  - Implemented research content extractor with validation
  - Implemented solution content extractor with validation
  - Implemented connection pairs content extractor with pair-level validation
  - Created a generic section content extractor with a factory function
  - Added specialized extractors for each section type
  - Added funder-solution alignment content extractor for evaluating solution alignment with funder priorities
  - Created comprehensive tests for all extractors
- Created all needed prompts for generation and evaluation:
  - Organized generation prompts in `/prompts/generation/` directory
  - Organized evaluation prompts in `/prompts/evaluation/` directory
  - Created specialized evaluation prompts for research, solution, and connection pairs
  - Implemented a flexible section evaluation template system with section-specific criteria areas
  - Added funder-solution alignment evaluation prompt

## Next Steps

1. Implement the remaining evaluation node factory implementations
2. Integrate the evaluation nodes with the main graph
3. Test the integration with the Orchestrator Service

## Specialized Evaluations

### Funder-Solution Alignment Evaluation

- [x] Define criteria configuration in `config/evaluation/criteria/funder_solution_alignment.json`
- [x] Create specialized prompt template in `prompts/evaluation/funderSolutionAlignment.ts`
- [x] Implement content extractor that combines solution and research data in `evaluation/extractors.ts`
- [x] Add tests for the funder-solution alignment content extractor
- [ ] Create factory-based evaluation node implementation
