# Current Work Focus

## Implementation of `ProposalGenerationGraph` Core Nodes

We are currently implementing the core nodes of the `ProposalGenerationGraph` for the Proposal Generator Agent. The implementation follows the specifications outlined in `AGENT_ARCHITECTURE.md` and `AGENT_BASESPEC.md`.

### Completed: Research Phase

✅ Task 16.1: `documentLoaderNode` - Document retrieval from Supabase storage
✅ Task 16.2: `researchNode` - Deep research analysis of RFP documents
✅ Task 16.3: `solutionSoughtNode` - Identification of solution requirements
✅ Task 16.4: `connectionPairsNode` - Mapping funder priorities to capabilities
✅ Task 16.5: `evaluateResearchNode` - Research quality evaluation with HITL review
✅ Task 16.6: `evaluateSolutionNode` - Solution analysis evaluation with HITL review
✅ Task 16.7: `evaluateConnectionsNode` - Connection pairs evaluation with HITL review

### Current Progress: Section Generation Phase

✅ Task 7.1: `sectionManagerNode` - Organization of document sections, management of section dependencies, and prioritization using topological sorting.

In Progress:

Task 17.2: Implement the `problemStatementNode` - Generate the problem statement section based on research and solution analysis.

Task 17.3: Implement the `methodologyNode` - Generate the methodology section based on solution and connection analysis.

Task 17.4: Implement the `budgetNode` - Generate the budget section aligned with methodology.

Task 17.5: Implement the `timelineNode` - Generate the timeline section aligned with methodology and budget.

Task 17.6: Implement the `conclusionNode` - Generate the conclusion section summarizing the proposal.

## Recent Changes

1. Completed the implementation of the section manager node:

   - Created a modular implementation in `apps/backend/agents/proposal-generation/nodes/section_manager.ts`
   - Implemented dependency resolution for sections using topological sorting
   - Added section prioritization based on dependencies
   - Implemented clean section status management
   - Verified the section manager correctly handles all section types defined in the SectionType enum
   - Ensured proper initialization of section data with appropriate metadata

2. Completed the implementation of the problem statement node:

   - Created a comprehensive implementation in `nodes/problem_statement.ts`
   - Integrated with LangChain for LLM-based section generation
   - Used structured output parsing with Zod schema validation
   - Implemented context window management for large inputs
   - Added comprehensive error handling and test coverage

3. Updated node exports and references:
   - Moved from monolithic implementation in nodes.js to modular files
   - Updated exports to reference the new implementations
   - Maintained backward compatibility with existing graph structure

## Next Steps

1. Continue implementing the remaining section generation nodes:

   - Start with methodology node (Task 17.3)
   - Follow with budget, timeline, and conclusion nodes
   - Implement section-specific evaluation nodes following established patterns
   - Create section-specific evaluation criteria

2. Update graph routing logic to support section generation flow:

   - Implement conditional routing based on section dependencies
   - Create a priority-based selection mechanism for the next section to generate
   - Ensure proper handling of stale sections and regeneration requirements
   - Add comprehensive error handling for the section generation flow

3. Enhance HITL integration for section reviews:
   - Implement section-specific feedback handling
   - Add support for section regeneration with user guidance
   - Create interfaces for section editing and regeneration

## Active Decisions & Considerations

### Modular Node Implementation

We've adopted a more modular approach to node implementation:

1. **Directory Structure**:

   - Each major node gets its own file in the `nodes/` directory
   - Tests for each node are in `nodes/__tests__/` directory
   - Common utilities and helpers remain in shared locations

2. **Export Pattern**:

   - Export node functions from their individual files
   - Re-export from the main nodes.js file for backward compatibility
   - Use named exports to maintain clear function naming

3. **Import Patterns**:
   - Use `@/` path aliases for imports from shared directories
   - Use relative imports for closely related files

### Section Management Strategy

The section management strategy has been implemented with the following approach:

1. **Section Types and Dependencies**:

   - Each section type is defined in the SectionType enum
   - Dependencies between sections are defined in the section manager
   - Topological sorting is used to determine generation order

2. **Section Status Management**:

   - Sections progress through states: QUEUED → RUNNING → READY_FOR_EVALUATION → AWAITING_REVIEW → APPROVED/EDITED/STALE
   - Only sections that are QUEUED or STALE are regenerated
   - Existing approved sections are preserved

3. **Section Data Structure**:
   - Each section has a standardized data structure
   - Includes content, status, title, and metadata
   - Timestamps for creation and updates
   - Error tracking for failed generations

### LLM Integration Patterns

For LLM-based section generation, we've established these patterns:

1. **Prompt Design**:

   - Clear, structured prompts with specific instructions
   - Context provided from RFP, research, and connections
   - Output format expectations clearly defined
   - Examples where needed for complex formats

2. **Output Parsing**:

   - Zod schemas for structured validation
   - Type-safe output extraction
   - Error handling for malformed outputs
   - Fallback strategies for parsing failures

3. **Context Window Management**:
   - Truncation of large inputs to fit context windows
   - Prioritization of most relevant content
   - Maintenance of key context even with truncation
   - Logging of truncation for debugging

### Error Handling Patterns

A consistent error handling pattern has emerged across node implementations:

1. Early validation of required inputs
2. Specific classification of different error types (missing input, LLM API errors, parsing errors)
3. Custom error messages with node-specific prefixes
4. State updates to reflect error conditions
5. Preservation of raw responses for debugging

### State Management

The state management follows established patterns:

1. Status transitions (queued → running → evaluating → awaiting_review/error)
2. Immutable state updates
3. Detailed message logging
4. Clear error propagation

### Naming Consistency

We maintain consistent naming conventions:

- Node functions: camelCase verb-noun format (e.g., `sectionManagerNode`, `problemStatementNode`)
- Status fields: snake_case (e.g., `connectionsStatus`)
- State fields: camelCase (e.g., `connections`, `solutionResults`)
- File names: snake_case (e.g., `section_manager.ts`, `problem_statement.ts`)

## Implementation Insights

1. **Modular Architecture Benefits**: Moving to a more modular architecture with dedicated files for each node has significantly improved:

   - Code organization and readability
   - Test isolation and specificity
   - Maintainability and extensibility
   - Clarity of responsibility

2. **Topological Sorting for Dependencies**: Using topological sorting for section dependencies ensures:

   - Sections are generated in the correct order
   - No circular dependencies can occur
   - The system is extensible to new section types
   - Generation order is deterministic

3. **Structured Output Parsing**: Using Zod schemas for structured output parsing provides:

   - Type-safe extraction of LLM outputs
   - Clear validation errors for debugging
   - Documentation of expected output formats
   - Runtime validation matching TypeScript types

4. **Context Window Management**: Managing context windows for LLM inputs ensures:

   - Reliable operation with large documents
   - Optimal use of the LLM's context window
   - Prioritization of the most relevant information
   - Graceful handling of oversized inputs

5. **Comprehensive Testing**: Our test approach verifies:
   - Happy path functionality
   - Error handling and recovery
   - State transitions and updates
   - Integration with other components

## Active Context

## Current Focus

We've successfully implemented the section manager node and problem statement node, and are now focusing on implementing the remaining section generation nodes. We've established solid patterns for:

1. **Section Generation**:

   - LLM integration for content generation
   - Structured output parsing with Zod schemas
   - Context window management for large inputs
   - Comprehensive error handling

2. **Section Management**:
   - Dependency resolution using topological sorting
   - Section status management
   - Section data structure standardization
   - Error tracking and logging

The established patterns should be applied consistently to the remaining section generators (methodology, budget, timeline, conclusion) with section-specific adjustments to prompts and output schemas.

## Recent Changes

- Successfully fixed and verified passing tests for `evaluationCriteria.test.ts`, `errorHandling.test.ts`, `extractors.test.ts`, and `contentExtractors.test.ts`
- Fixed mock implementations for filesystem operations
- Implemented proper mock patterns for the factory implementation
- Corrected assertion patterns for error handling tests

## Vitest Testing Learnings

We've uncovered several important learnings about effective Vitest testing:

1. **Proper Module Mocking**:

   - `vi.mock()` is hoisted to the top of the file automatically
   - Use `vi.hoisted(() => { return {...} })` to define mocks before they're used in `vi.mock()`
   - When mocking a module with default export, include both `default: {...}` and individual exports
   - ES modules require different mocking approaches than CommonJS modules
   - Always mock path module with both named exports and default export:
     ```typescript
     const pathMock = vi.hoisted(() => ({
       resolve: vi.fn(),
       default: { resolve: vi.fn() },
     }));
     vi.mock("path", () => pathMock);
     ```

2. **TypeScript Type Safety in Tests**:

   - Create test state interfaces that properly match the actual state structure
   - Use type assertions where necessary to satisfy TypeScript without compromising test value
   - Define proper interfaces for test states that match production state structures
   - Import actual state types from the source files when possible
   - For partial test states, consider using type assertions to cast `TestState as OverallProposalState` where needed
   - When targeting specific fields, use explicit indexing notation (e.g., `state.sections['research']`) to avoid type errors

3. **Mocking Best Practices**:

   - Keep mocks simple and focused on the specific needs of each test
   - Reset mocks before/after each test to ensure clean state
   - For path module, ensure both `default.resolve` and `resolve` are mocked
   - Implement mock behavior that matches the expected behavior of production code
   - Use control variables to adjust mock behavior between tests:

     ```typescript
     let mockShouldFail = false;
     const myMock = vi.hoisted(() => ({
       someFunction: vi.fn().mockImplementation(() => {
         if (mockShouldFail) throw new Error("Test error");
         return "success";
       }),
     }));

     beforeEach(() => {
       mockShouldFail = false;
     });
     ```

4. **Testing Implementation Challenges**:

   - Test files can get long - consider splitting into multiple files (e.g., factory tests, content extractor tests)
   - Ensure tests verify actual behavior, not just that mocks were called
   - Test both happy paths and error handling
   - Verify that state transformations are handled correctly
   - Ensure proper error propagation from nested functions
   - For complex node functions, test the individual components separately before testing the node as a whole

5. **Vitest-specific Patterns**:

   - Use `vi.hoisted()` for defining mocks to avoid reference errors
   - Understand hoisting behavior: `vi.mock()` calls are automatically hoisted but the mock implementations need to be defined using `vi.hoisted()`
   - Use `beforeEach` and `afterEach` to reset mock state between tests
   - Structure tests with nested `describe` blocks for better organization
   - Use `vi.spyOn` for functions that need to be monitored but not completely mocked
   - For Node.js built-ins like `fs` and `path`, create comprehensive mocks that mimic the module's behavior
   - When dealing with complex return types from functions, explicitly type the mock implementations

6. **File System and Path Mocking**:
   - Always use `vi.hoisted()` for fs/path mocks to ensure they're defined before use
   - For `fs` module, mock both the promises API and the callback API if both are used
   - For `path` module, ensure the mock includes both the named exports and the default export
   - When mocking file existence checks, use control variables to simulate different file system states:
     ```typescript
     let fileExists = true;
     const fsMock = vi.hoisted(() => ({
       promises: {
         access: vi.fn().mockImplementation(() => {
           if (!fileExists) throw new Error("File not found");
           return Promise.resolve();
         }),
         readFile: vi.fn().mockResolvedValue("file content"),
       },
     }));
     ```

## Current Test Status

| Test File                    | Status | Issues                                        |
| ---------------------------- | ------ | --------------------------------------------- |
| `evaluationCriteria.test.ts` | ✅     | Fixed and passing                             |
| `errorHandling.test.ts`      | ✅     | Fixed and passing                             |
| `extractors.test.ts`         | ✅     | Fixed and passing                             |
| `contentExtractors.test.ts`  | ✅     | Fixed and passing                             |
| `factory.test.ts`            | 🔄     | Tests pass but linter errors need fixing      |
| `stateManagement.test.ts`    | ❌     | 8/9 tests failing, mock implementation issues |

## Next Steps

1. Fix `stateManagement.test.ts` by properly mocking factory methods and content extractors
2. Fix TypeScript linter errors in `factory.test.ts`
3. Complete any remaining evaluation framework test files
4. Update implementation plan with comprehensive test coverage status
5. Begin implementation of `sectionManagerNode` (Task 17.1)

## Important Patterns and Preferences

- Separate test files by logical component (factory, extractors, criteria loading)
- Create proper test state objects that match the actual state structure
- Test both successful and error cases
- Verify state transformations and error propagation
- Use `vi.hoisted()` consistently for all mock definitions
- Reset mock state between tests using `beforeEach` and `afterEach` hooks

## Learning and Insights

Most difficult aspects of the testing process:

- Getting mocking right with TypeScript and ES modules
- Ensuring tests don't just verify mocks but actual behavior
- Creating test states that properly reflect production state structure
- Balancing comprehensive testing with maintainable test files
- Properly handling hoisting in Vitest to avoid reference errors
- Managing type compatibility between test state objects and production state interfaces

## Comprehensive Guide to Vitest Testing

Based on our recent experience with fixing evaluation framework tests, we've compiled a comprehensive guide to Vitest testing best practices that will be valuable for all future testing efforts:

### 1. Module Mocking Strategy

#### Basic Module Mocking

```typescript
// Define mocks using vi.hoisted to avoid reference errors
const mocks = vi.hoisted(() => ({
  someFunction: vi.fn().mockReturnValue("mocked result"),
  anotherFunction: vi.fn().mockResolvedValue({ data: "async result" }),
}));

// Mock the module - this is automatically hoisted to the top
vi.mock("../path/to/module", () => ({
  someFunction: mocks.someFunction,
  anotherFunction: mocks.anotherFunction,
}));
```

#### Mocking ES Modules with Default Exports

```typescript
// Must include both default and named exports
const moduleMock = vi.hoisted(() => ({
  default: {
    mainFunction: vi.fn(),
    helperFunction: vi.fn(),
  },
  namedExport1: vi.fn(),
  namedExport2: vi.fn(),
}));

vi.mock("../module-with-default", () => moduleMock);
```

#### Testing-Only Modules

For testing-specific mocks that don't exist in the real codebase:

```typescript
// Define a test-only mock module
const testUtilsMock = vi.hoisted(() => ({
  testHelper: vi.fn(),
}));

// Add to global scope for test
globalThis.testUtils = testUtilsMock;
```

### 2. File System and Path Mocking

File system mocking is particularly error-prone. Use these consistent patterns:

```typescript
// Path module - always mock both default export and named exports
const pathMock = vi.hoisted(() => ({
  resolve: vi.fn((...segments) => segments.join("/")),
  join: vi.fn((...segments) => segments.join("/")),
  dirname: vi.fn((p) => p.split("/").slice(0, -1).join("/")),
  default: {
    resolve: vi.fn((...segments) => segments.join("/")),
    join: vi.fn((...segments) => segments.join("/")),
    dirname: vi.fn((p) => p.split("/").slice(0, -1).join("/")),
  },
}));

vi.mock("path", () => pathMock);

// FS module - mock both promises and callback APIs
const fsMock = vi.hoisted(() => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}));

vi.mock("fs", () => fsMock);
```

### 3. Dynamic Mock Behavior

Use control variables to adjust mock behavior between tests:

```typescript
// Control variable pattern
let fileExists = true;
let fileContent = '{"valid": "json"}';

const fsMock = vi.hoisted(() => ({
  promises: {
    access: vi.fn().mockImplementation(() => {
      if (!fileExists) throw new Error("File not found");
      return Promise.resolve();
    }),
    readFile: vi.fn().mockImplementation(() => {
      if (!fileExists) throw new Error("File not found");
      return Promise.resolve(fileContent);
    }),
  },
}));

// Reset control variables before each test
beforeEach(() => {
  fileExists = true;
  fileContent = '{"valid": "json"}';
  vi.clearAllMocks();
});

// In specific tests
it("handles missing files", async () => {
  fileExists = false;
  // Test expects error to be handled
});

it("handles malformed JSON", async () => {
  fileContent = "{ invalid json";
  // Test expects parsing error to be handled
});
```

### 4. TypeScript Integration

TypeScript and Vitest require special care to ensure type safety:

```typescript
// Type the mock functions and return values
type MockReadFileFunc = (path: string) => Promise<string>;
type MockCalculateScoreFunc = (
  criteria: Criterion[],
  scores: Record<string, number>
) => number;

// Explicitly type the mock object
const mocks = {
  readFile: vi.fn<[string], Promise<string>>(),
  calculateScore: vi.fn<[Criterion[], Record<string, number>], number>(),
};

// Implement with proper types
mocks.readFile.mockImplementation((path: string): Promise<string> => {
  // Implementation
  return Promise.resolve("content");
});

mocks.calculateScore.mockImplementation(
  (criteria: Criterion[], scores: Record<string, number>): number => {
    // Implementation
    return 0.75;
  }
);
```

### 5. Test Organization

Structure tests for maintainability:

```typescript
describe("ComponentName", () => {
  // Common setup
  beforeEach(() => {
    // Reset mocks, set up test environment
  });

  describe("Functionality Group 1", () => {
    it("handles the happy path", () => {
      // Test normal operation
    });

    it("handles edge case 1", () => {
      // Test specific edge case
    });
  });

  describe("Error Handling", () => {
    it("handles missing inputs", () => {
      // Test error condition
    });

    it("handles API failures", () => {
      // Test error condition
    });
  });
});
```

### 6. State Verification

Test complex state transformations thoroughly:

```typescript
it("properly updates state with evaluation results", async () => {
  // Arrange: Create initial state
  const initialState = {
    evaluationStatus: "running",
    evaluationResults: null,
    messages: [],
    errors: [],
  };

  // Act: Call function under test
  const updatedState = await evaluateNode(initialState);

  // Assert: Check all relevant state changes
  expect(updatedState.evaluationStatus).toBe("awaiting_review");
  expect(updatedState.evaluationResults).not.toBeNull();
  expect(updatedState.evaluationResults?.passed).toBe(true);
  expect(updatedState.evaluationResults?.score).toBeGreaterThanOrEqual(0.7);
  expect(updatedState.messages.length).toBeGreaterThan(0);
  expect(updatedState.errors.length).toBe(0);
});
```

### 7. Testing Asynchronous Code

Properly handle async testing:

```typescript
it("properly handles async operations", async () => {
  // Use .mockResolvedValue for Promises
  mockApiCall.mockResolvedValue({ data: "result" });

  // Test async function
  const result = await asyncFunction();

  // Assertions
  expect(result).toBeDefined();

  // Verify Promise chain completion
  expect(mockApiCall).toHaveBeenCalledTimes(1);
});

it("handles async errors correctly", async () => {
  // Use .mockRejectedValue for Promise rejections
  mockApiCall.mockRejectedValue(new Error("API failed"));

  // Test with expect-throws for async functions
  await expect(asyncFunction()).rejects.toThrow("API failed");

  // Or test error handling behavior
  const result = await asyncFunctionWithErrorHandling();
  expect(result.error).toBeDefined();
  expect(result.error.message).toContain("API failed");
});
```

### 8. Complex Mock Implementation

For mocks with complex behavior:

```typescript
// Mock with conditional behavior
mocks.validateContent.mockImplementation((content, validators) => {
  // Handle different content types
  if (!content) {
    return { valid: false, errors: ["Content is required"] };
  }

  // Handle different validator types
  if (validators.includes("json")) {
    try {
      JSON.parse(content);
      return { valid: true };
    } catch (e) {
      return { valid: false, errors: ["Invalid JSON"] };
    }
  }

  // Default behavior
  return { valid: true };
});
```

### 9. Mocking Global Objects

When you need to mock global objects:

```typescript
// Process, console, etc.
const originalProcess = { ...process };
const originalConsole = { ...console };

beforeEach(() => {
  // Use Object.defineProperty to mock globals
  Object.defineProperty(global, "process", {
    value: {
      ...process,
      cwd: vi.fn().mockReturnValue("/test/path"),
      env: { ...process.env, NODE_ENV: "test" },
    },
  });

  Object.defineProperty(global, "console", {
    value: {
      ...console,
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  });
});

afterEach(() => {
  // Restore original globals
  Object.defineProperty(global, "process", {
    value: originalProcess,
  });

  Object.defineProperty(global, "console", {
    value: originalConsole,
  });
});
```

### 10. Testing Best Practices

1. **Testing Hierarchy**:

   - Write unit tests for individual functions, components, and nodes
   - Write integration tests for workflows and interactions between components
   - Focus on behavior, not implementation details

2. **Test Isolation**:

   - Each test should be independent - reset state between tests
   - Avoid test order dependencies
   - Use beforeEach to set up a clean test environment

3. **Comprehensive Test Coverage**:

   - Test happy paths (normal operation)
   - Test boundary conditions (min/max values, empty arrays, etc.)
   - Test error paths (missing inputs, API failures, etc.)
   - Test performance considerations (timeouts, rate limits)
   - Test edge cases specific to your domain (unusual input formats, etc.)

4. **Test Readability**:
   - Use descriptive test names that explain the behavior being tested
   - Follow the Arrange-Act-Assert pattern for clarity
   - Include comments for complex test logic
   - Group related tests with describe blocks

By following these patterns and practices, we can maintain high-quality tests across the codebase, ensuring robustness and reliability of our implementation.

## Recent Vitest Testing Insights (Evaluation Framework)

During our recent work on fixing the evaluation framework tests, we discovered several important patterns:

### Error Message Testing Patterns

- Tests expecting error messages should check for string contents rather than object structures:

  ```typescript
  // Better approach:
  expect(result.errors[0]).toBe("research: empty content");

  // Instead of:
  expect(result.errors[0]).toEqual({ type: "EMPTY_CONTENT", message: "..." });
  ```

- For partial string matching, use `toContain()` or string includes:
  ```typescript
  expect(result.errors[0]).toContain("validation error");
  ```

### TypeScript Null/Undefined Handling

- Use null coalescing for arrays that might be undefined in assertions:
  ```typescript
  expect(result.errors || []).toEqual([]);
  ```
- Use optional chaining for deep object property access in tests:
  ```typescript
  expect(result.sections?.research?.status).toBe("error");
  ```
- When checking deep nested properties that might not exist, use safe patterns:
  ```typescript
  expect(result.sections?.research?.evaluationResult?.errors?.[0]).toContain(
    "empty content"
  );
  ```

### Mocking Error Conditions

- When testing error handling, use simple mock implementations that return null or throw errors:
  ```typescript
  mocks.extractContent.mockReturnValueOnce(null);
  ```
- For testing validation failures, configure mocks to return appropriate errors:
  ```typescript
  mockValidator.mockReturnValueOnce({
    success: false,
    error: "validation error: malformed content",
  });
  ```

### State Preparation for Error Tests

- Create dedicated test states for error scenarios with predictable structures
- Include minimal valid structure to focus on the specific error case being tested
- Reset mocks between tests to prevent unintended interference

_This document reflects the immediate working context, recent activities, and near-term goals. It should be updated frequently._
