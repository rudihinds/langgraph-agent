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

4. **Add comprehensive testing**:
   - Create integration tests for the full evaluation workflow
   - Test the graph with evaluation nodes
   - Verify checkpoint persistence of evaluation results
   - Test HITL evaluation review process
