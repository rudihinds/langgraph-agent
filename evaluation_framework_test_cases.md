# Test Cases for Standardized Evaluation Framework

This document outlines a comprehensive set of test cases for validating the standardized evaluation framework as specified in `spec_eval_linear.md`.

## 1. Core Component Tests

### 1.1. Evaluation Node Factory Tests

#### Test Case 1.1.1: Basic Factory Functionality

- **Description**: Verify that the factory correctly generates an evaluation node function
- **Input**: Minimal valid EvaluationNodeOptions
- **Expected**: Function returned matching the EvaluationNodeFunction signature
- **Validation**: Type checking and function call succeeds

#### Test Case 1.1.2: Configuration Parameter Passing

- **Description**: Verify that all configuration options are correctly applied
- **Input**: EvaluationNodeOptions with all fields specified
- **Expected**: Generated node uses all specified options
- **Validation**: Mock the node's inner functions and verify they're called with correct parameters

#### Test Case 1.1.3: Default Parameter Handling

- **Description**: Verify that optional parameters use sensible defaults when not specified
- **Input**: EvaluationNodeOptions with only required fields
- **Expected**: Node uses default values for missing options
- **Validation**: Check that passingThreshold defaults to 0.7, etc.

### 1.2. Evaluation Result Interface Tests

#### Test Case 1.2.1: Zod Schema Validation (Valid)

- **Description**: Verify that valid evaluation results pass schema validation
- **Input**: Complete EvaluationResult object with all required fields
- **Expected**: Validation passes without errors
- **Validation**: Schema parse returns the same object without throwing

#### Test Case 1.2.2: Zod Schema Validation (Invalid)

- **Description**: Verify that invalid evaluation results fail schema validation
- **Input**: EvaluationResult with missing required fields
- **Expected**: Validation throws with specific error messages
- **Validation**: Check error message includes details about missing fields

#### Test Case 1.2.3: Score Calculation Helpers

- **Description**: Verify helper functions for score calculations
- **Input**: Various criteria scores with different weights
- **Expected**: Correct weighted average calculation
- **Validation**: Compare against manually calculated values

### 1.3. Criteria Configuration Tests

#### Test Case 1.3.1: Criteria Loading

- **Description**: Verify that criteria configuration files load correctly
- **Input**: Path to valid criteria configuration file
- **Expected**: Parsed EvaluationCriteria object
- **Validation**: Check that all fields are correctly loaded

#### Test Case 1.3.2: Criteria Validation

- **Description**: Verify that invalid criteria configurations are rejected
- **Input**: Malformed criteria configuration
- **Expected**: Validation error with specific message
- **Validation**: Check error message includes details about validation failure

#### Test Case 1.3.3: Default Criteria Fallback

- **Description**: Verify fallback to default criteria when specific criteria unavailable
- **Input**: Path to non-existent criteria file
- **Expected**: Default criteria loaded instead
- **Validation**: Check returned criteria matches default structure

## 2. Node Execution Flow Tests

### 2.1. Input Validation Tests

#### Test Case 2.1.1: Missing Content Validation

- **Description**: Verify proper handling of missing content to evaluate
- **Input**: State with missing content for evaluation
- **Expected**: Error state with appropriate message
- **Validation**: Check status is 'error' and error message indicates missing content

#### Test Case 2.1.2: Malformed Content Validation

- **Description**: Verify proper handling of malformed content
- **Input**: State with malformed content structure
- **Expected**: Error state with appropriate message
- **Validation**: Check error message indicates structural problems

#### Test Case 2.1.3: Valid Content Acceptance

- **Description**: Verify acceptance of valid content
- **Input**: State with properly structured content
- **Expected**: Processing continues without validation errors
- **Validation**: Check that next steps in flow are reached

### 2.2. State Update Tests

#### Test Case 2.2.1: Initial Status Update

- **Description**: Verify status updated to 'evaluating' during processing
- **Input**: Valid state with queued content
- **Expected**: Status field updated to 'evaluating'
- **Validation**: Check returned state has updated status

#### Test Case 2.2.2: Evaluation Result Storage

- **Description**: Verify evaluation results stored in correct state field
- **Input**: State after successful evaluation
- **Expected**: Result field populated with evaluation data
- **Validation**: Check returned state has evaluation results in the specified field

#### Test Case 2.2.3: Multiple Field Updates

- **Description**: Verify multiple state fields updated correctly
- **Input**: Valid state before evaluation
- **Expected**: Status, result, interrupt flag, and messages all updated
- **Validation**: Check all fields have expected values in returned state

### 2.3. Agent/LLM Invocation Tests

#### Test Case 2.3.1: Proper Prompt Construction

- **Description**: Verify evaluation prompt correctly constructed
- **Input**: Content and criteria configuration
- **Expected**: Properly formatted prompt with content and criteria
- **Validation**: Check prompt string contains expected sections

#### Test Case 2.3.2: Agent Call Parameters

- **Description**: Verify agent called with correct parameters
- **Input**: Constructed prompt and model configuration
- **Expected**: Agent invoke method called with these parameters
- **Validation**: Mock agent and verify calls

#### Test Case 2.3.3: Timeout Protection

- **Description**: Verify timeout protection for LLM calls
- **Input**: Configuration causing a slow response
- **Expected**: Timeout error after 60 seconds
- **Validation**: Check that long-running calls are terminated with timeout error

### 2.4. Response Processing Tests

#### Test Case 2.4.1: Successful JSON Parsing

- **Description**: Verify successful parsing of JSON response
- **Input**: Valid JSON string from LLM
- **Expected**: Structured evaluation result object
- **Validation**: Check parsed object has expected structure

#### Test Case 2.4.2: Score Calculation

- **Description**: Verify correct calculation of overall score
- **Input**: Individual criterion scores and weights
- **Expected**: Weighted average overall score
- **Validation**: Compare against manually calculated result

#### Test Case 2.4.3: Pass/Fail Determination

- **Description**: Verify correct pass/fail status based on thresholds
- **Input**: Scores near threshold boundaries
- **Expected**: Correct passed boolean value
- **Validation**: Test various score combinations against threshold

## 3. HITL Integration Tests

### 3.1. Interrupt Triggering Tests

#### Test Case 3.1.1: Interrupt Flag Setting

- **Description**: Verify isInterrupted flag set correctly
- **Input**: State after evaluation completion
- **Expected**: isInterrupted = true
- **Validation**: Check returned state has interrupt flag

#### Test Case 3.1.2: Interrupt Metadata Structure

- **Description**: Verify interrupt metadata structured correctly
- **Input**: Completed evaluation
- **Expected**: Metadata with content type, evaluation data, and actions
- **Validation**: Check all required fields present in metadata

#### Test Case 3.1.3: UI Presentation Data

- **Description**: Verify UI-specific fields in metadata
- **Input**: Completed evaluation
- **Expected**: Title and description fields with proper content
- **Validation**: Check fields have expected human-readable content

### 3.2. Feedback Processing Tests

#### Test Case 3.2.1: Approval Handling

- **Description**: Verify proper handling of approval action
- **Input**: User feedback with approve action
- **Expected**: Status updated to 'approved'
- **Validation**: Check status field after processing

#### Test Case 3.2.2: Revision Handling

- **Description**: Verify proper handling of revision action
- **Input**: User feedback with revise action and comments
- **Expected**: Status updated to 'revision_requested', comments captured
- **Validation**: Check status and that feedback is incorporated

#### Test Case 3.2.3: Edit Handling

- **Description**: Verify proper handling of edit action
- **Input**: User feedback with edit action and content changes
- **Expected**: Status updated to 'edited', content updated
- **Validation**: Check status and content changes

### 3.3. Dependency Tracking Tests

#### Test Case 3.3.1: Dependent Content Marking

- **Description**: Verify dependents marked as stale after edits
- **Input**: Edit to content with dependents
- **Expected**: Dependent sections marked as 'stale'
- **Validation**: Check status of dependent sections

#### Test Case 3.3.2: Dependency Chain Propagation

- **Description**: Verify changes propagate through dependency chain
- **Input**: Edit to content with multi-level dependencies
- **Expected**: All dependent content marked appropriately
- **Validation**: Check status of all dependencies at various levels

## 4. State Management Tests

### 4.1. Status Transition Tests

#### Test Case 4.1.1: Complete Status Cycle

- **Description**: Verify all status transitions in typical flow
- **Input**: Series of state updates and user actions
- **Expected**: Status transitions through all expected values
- **Validation**: Check status after each transition

#### Test Case 4.1.2: Error Status Handling

- **Description**: Verify error status correctly set and maintained
- **Input**: Conditions causing evaluation error
- **Expected**: Status set to 'error' and maintained until explicitly changed
- **Validation**: Check status persists through state updates

#### Test Case 4.1.3: Concurrent Status Fields

- **Description**: Verify multiple content type statuses managed independently
- **Input**: Updates to different content types
- **Expected**: Each status field updated independently
- **Validation**: Check all status fields have expected values

### 4.2. Message Management Tests

#### Test Case 4.2.1: Message Appending

- **Description**: Verify messages appended correctly
- **Input**: State with existing messages
- **Expected**: New messages added to end of array
- **Validation**: Check final message array structure

#### Test Case 4.2.2: System Message Formatting

- **Description**: Verify system messages properly formatted
- **Input**: Various evaluation outcomes
- **Expected**: Consistently formatted system messages
- **Validation**: Check message content follows expected pattern

#### Test Case 4.2.3: Error Message Integration

- **Description**: Verify error messages added to both errors and messages
- **Input**: Error condition during evaluation
- **Expected**: Error details in both arrays
- **Validation**: Check both arrays contain error information

## 5. Error Handling Tests

### 5.1. Input Error Tests

#### Test Case 5.1.1: Empty Content Handling

- **Description**: Verify handling of empty content
- **Input**: State with empty content field
- **Expected**: Appropriate error with message about empty content
- **Validation**: Check error message specificity

#### Test Case 5.1.2: Invalid Content Structure Handling

- **Description**: Verify handling of improperly structured content
- **Input**: Content missing required fields
- **Expected**: Validation error with details about missing fields
- **Validation**: Check error identifies specific structural issues

### 5.2. LLM Error Tests

#### Test Case 5.2.1: API Error Handling

- **Description**: Verify handling of API errors from LLM
- **Input**: Mock LLM that throws API error
- **Expected**: Graceful error handling with user-friendly message
- **Validation**: Check error state preserves technical details but presents friendly message

#### Test Case 5.2.2: Timeout Handling

- **Description**: Verify handling of LLM timeouts
- **Input**: Mock LLM that doesn't respond in time
- **Expected**: Timeout error after 60 seconds
- **Validation**: Check timeout detected and appropriate error set

#### Test Case 5.2.3: Content Policy Violation

- **Description**: Verify handling of content policy violations
- **Input**: Content causing policy violation in LLM
- **Expected**: Specific error about policy violation
- **Validation**: Check error message explains the issue

### 5.3. Processing Error Tests

#### Test Case 5.3.1: Malformed LLM Response

- **Description**: Verify handling of non-JSON LLM responses
- **Input**: LLM response that isn't valid JSON
- **Expected**: Parsing error with details
- **Validation**: Check error message includes response excerpt

#### Test Case 5.3.2: Schema Validation Failure

- **Description**: Verify handling of responses missing required fields
- **Input**: JSON response missing required evaluation fields
- **Expected**: Validation error with details about missing fields
- **Validation**: Check error points to specific missing fields

#### Test Case 5.3.3: Calculation Error Handling

- **Description**: Verify handling of errors during score calculation
- **Input**: Invalid score values causing calculation errors
- **Expected**: Appropriate error with details
- **Validation**: Check error explains the calculation issue

## 6. Configuration System Tests

### 6.1. Criteria Configuration Tests

#### Test Case 6.1.1: Valid Configuration Loading

- **Description**: Verify loading valid criteria configuration
- **Input**: Path to valid configuration file
- **Expected**: Properly parsed configuration object
- **Validation**: Check all fields loaded correctly

#### Test Case 6.1.2: Missing Configuration Handling

- **Description**: Verify handling of missing configuration files
- **Input**: Path to non-existent file
- **Expected**: Fallback to default with warning
- **Validation**: Check default configuration used and warning logged

#### Test Case 6.1.3: Malformed Configuration Handling

- **Description**: Verify handling of malformed configuration files
- **Input**: Path to syntactically invalid JSON
- **Expected**: Error with details about parsing issue
- **Validation**: Check error message includes location of syntax error

### 6.2. Prompt Template Tests

#### Test Case 6.2.1: Template Loading

- **Description**: Verify loading of prompt templates
- **Input**: Path to template file
- **Expected**: Loaded template string
- **Validation**: Check template content loaded correctly

#### Test Case 6.2.2: Template Variable Substitution

- **Description**: Verify template variables correctly substituted
- **Input**: Template with variables and values to substitute
- **Expected**: Complete prompt with variables replaced
- **Validation**: Check all variables replaced with correct values

#### Test Case 6.2.3: Custom Template Override

- **Description**: Verify custom template overrides default
- **Input**: Configuration with custom template specified
- **Expected**: Custom template used instead of default
- **Validation**: Check final prompt matches custom template

## 7. Integration Tests

### 7.1. Graph Integration Tests

#### Test Case 7.1.1: Node Registration

- **Description**: Verify node correctly registered in graph
- **Input**: Graph and evaluation node
- **Expected**: Node accessible in graph by name
- **Validation**: Check node can be retrieved from graph

#### Test Case 7.1.2: Edge Connection

- **Description**: Verify edges correctly connected
- **Input**: Graph with nodes and edge definitions
- **Expected**: Proper edge connections between nodes
- **Validation**: Check graph structure has expected edges

#### Test Case 7.1.3: Conditional Routing

- **Description**: Verify conditional routing based on evaluation
- **Input**: Various evaluation outcomes
- **Expected**: Next step determined by evaluation result
- **Validation**: Check different paths taken based on outcome

### 7.2. HITL Configuration Tests

#### Test Case 7.2.1: Interrupt Registration

- **Description**: Verify evaluation nodes registered for interrupts
- **Input**: Graph with interrupt configuration
- **Expected**: Evaluation nodes in interrupt list
- **Validation**: Check compiled graph has correct interrupt points

#### Test Case 7.2.2: Interrupt Triggering

- **Description**: Verify interrupts triggered at evaluation completion
- **Input**: Completed evaluation
- **Expected**: Execution paused for user input
- **Validation**: Check graph execution state shows waiting for interrupt

### 7.3. Orchestrator Integration Tests

#### Test Case 7.3.1: Orchestrator Handling of Evaluation Results

- **Description**: Verify orchestrator correctly processes evaluation results
- **Input**: State with completed evaluation
- **Expected**: Orchestrator extracts and processes results
- **Validation**: Check orchestrator's internal state updated

#### Test Case 7.3.2: User Feedback Processing

- **Description**: Verify orchestrator correctly applies user feedback
- **Input**: User feedback actions and comments
- **Expected**: State updated according to feedback
- **Validation**: Check state changes match expected changes for feedback

#### Test Case 7.3.3: Dependency Management

- **Description**: Verify orchestrator correctly manages dependencies
- **Input**: Edit to content with dependencies
- **Expected**: Dependent content marked appropriately
- **Validation**: Check dependent content status updates

## 8. End-to-End Workflow Tests

### 8.1. Full Evaluation Cycle Tests

#### Test Case 8.1.1: Successful Evaluation and Approval

- **Description**: Verify complete cycle from content generation to approval
- **Input**: Generated content, evaluation, and approval action
- **Expected**: Content progresses through all states to approved
- **Validation**: Check final state has approved status and complete data

#### Test Case 8.1.2: Evaluation, Revision and Re-evaluation

- **Description**: Verify revision cycle with re-evaluation
- **Input**: Content, evaluation, revision request, updated content, re-evaluation
- **Expected**: Content goes through revision cycle with appropriate state changes
- **Validation**: Check state transitions and final approved state

#### Test Case 8.1.3: Error Recovery

- **Description**: Verify recovery from errors during evaluation
- **Input**: Scenario causing evaluation error, then fix and retry
- **Expected**: Error handled, then successful completion after fix
- **Validation**: Check error states and recovery to normal flow

### 8.2. Performance Tests

#### Test Case 8.2.1: Large Content Handling

- **Description**: Verify performance with large content
- **Input**: Very large content document
- **Expected**: Successful evaluation within reasonable time
- **Validation**: Check processing time and memory usage

#### Test Case 8.2.2: Multiple Concurrent Evaluations

- **Description**: Verify system handles multiple evaluations
- **Input**: Multiple evaluation requests concurrently
- **Expected**: All evaluations complete successfully
- **Validation**: Check all evaluations complete with correct results

#### Test Case 8.2.3: Long-Running Evaluation Sessions

- **Description**: Verify stability during long sessions
- **Input**: Extended session with multiple evaluation cycles
- **Expected**: Consistent performance throughout
- **Validation**: Check for memory leaks or performance degradation
