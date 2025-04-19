# Current Work Focus

## Implementation of `ProposalGenerationGraph` Core Nodes

We are currently implementing the core nodes of the `ProposalGenerationGraph` for the Proposal Generator Agent. The implementation follows the specifications outlined in `AGENT_ARCHITECTURE.md` and `AGENT_BASESPEC.md`.

### Current Status

✅ Task 16.1: `documentLoaderNode` - Completed with passing unit tests
✅ Task 16.2: `solutionSoughtNode` - Completed with passing unit tests
✅ Task 16.3: `connectionPairsNode` - Completed with passing unit tests
✅ Task 16.4: `evaluateConnectionsNode` - Completed with passing unit tests

### Next Step

Task 16.5: Implement the `sectionManagerNode` - This node will organize the document into sections, manage section statuses, and coordinate section generation.

## Recent Changes

1. Completed the implementation of `connectionPairsNode` (Task 16.3):

   - Created comprehensive test suite covering input validation, agent invocation, response parsing, error handling, and state management
   - Implemented dual-layer parsing approach (JSON primary, regex fallback) for resilient response handling
   - Added detailed error classification and recovery mechanisms
   - Updated implementation plan to reflect completed work

2. Completed the implementation of `evaluateConnectionsNode` (Task 16.4):

   - Developed comprehensive test suite for connection evaluation logic
   - Implemented evaluation criteria based on relevance, alignment, and impact
   - Added human-in-the-loop interruption point for connection review
   - Created detailed error handling patterns consistent with other nodes
   - Updated implementation plan to reflect the completed implementation

3. Made significant progress on fixing the evaluation framework tests:
   - Fixed `evaluationCriteria.test.ts` tests with proper mocking patterns ✅
   - Fixed `errorHandling.test.ts` tests with appropriate assertions ✅
   - Fixed `extractors.test.ts` tests with correct mock implementations ✅
   - Fixed `contentExtractors.test.ts` tests with proper state handling ✅
   - Made progress on `factory.test.ts` (tests pass but has TypeScript linter errors) 🔄
   - Identified issues in `stateManagement.test.ts` (missing function mocks) 🔄

## Next Steps

1. Focus on fixing the remaining evaluation test files:

   - Fix `stateManagement.test.ts` by properly mocking factory methods and content extractors
   - Fix TypeScript linter errors in `factory.test.ts`
   - Complete any remaining evaluation framework test files
   - Update implementation plan with comprehensive test coverage status
   - Begin implementation of `sectionManagerNode` (Task 16.5)

2. Update `OverallProposalState` to fully support the standardized evaluation pattern:

   - Add standardized HITL interruption fields (`interruptStatus` and `interruptMetadata`)
   - Ensure evaluation result fields exist for all content types
   - Add proper typing for evaluation status transitions
   - Update the `SectionData` interface with consistent evaluation fields

3. Create evaluation configuration files:

   - Implement criteria configuration for each content type
   - Develop standardized evaluation prompts
   - Ensure consistent scoring mechanisms

4. Continue following the TDD approach:
   - Write tests first to establish expected behavior
   - Implement functionality to pass the tests
   - Refactor while maintaining test coverage

## Active Decisions & Considerations

### Standardized Evaluation Pattern

We have established a comprehensive evaluation pattern to be used across all evaluation nodes:

1. **Evaluation Result Structure**:

   - Standardized interface with `passed`, `score`, `feedback`, `strengths`, `weaknesses`, and `suggestions`
   - Detailed criteria-specific assessments with individual scores and comments
   - Consistent scoring scale (1-10) with clear threshold for passing (≥7)

2. **HITL Integration**:

   - Standardized `interruptStatus` and `interruptMetadata` fields
   - Consistent approach to pausing execution for human review
   - Clear paths for approval or revision requests

3. **State Management**:
   - Consistent state transitions: queued → running → evaluating → awaiting_review → (approved/revised)
   - Status field naming conventions
   - Clear error propagation

### Test-Driven Development

We continue to follow TDD principles for all node implementations. This approach has proven effective in guiding the development process and ensuring robust implementations with comprehensive test coverage.

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

- Node functions: camelCase verb-noun format (e.g., `connectionPairsNode`, `evaluateConnectionsNode`)
- Status fields: snake_case (e.g., `connectionsStatus`)
- State fields: camelCase (e.g., `connections`, `solutionResults`)

## Implementation Insights

1. **Evaluation Result Structure**: The standardized `EvaluationResult` interface provides a consistent approach to quality assessment across all content types, enabling meaningful comparisons and setting clear quality thresholds.

2. **HITL Integration**: The evaluation pattern establishes a framework for human-in-the-loop review at critical decision points, ensuring quality control while maintaining a consistent user experience.

3. **Criteria Management**: Loading evaluation criteria from configuration files enables flexibility and adaptability while maintaining consistency in the evaluation approach.

4. **Error Categorization**: We've established a consistent pattern for error categorization and handling across nodes, which should be maintained for future implementations.

5. **State Transitions**: The consistent state transition pattern (queued → running → evaluating → awaiting_review/error) provides a clear lifecycle for each node's execution and should be maintained.

## Active Context

## Current Focus

Working on fixing the remaining evaluation framework test files. We've made significant progress with four files now passing, and two files still requiring fixes:

1. **stateManagement.test.ts** (8/9 tests failing):

   - Issues with mock implementation for factory methods like `createResearchEvaluationNode()`
   - Missing proper content extractors for section types like 'problem_statement'
   - Functions returning "is not a function" errors, showing they're not properly mocked

2. **factory.test.ts** (tests pass but has linter errors):
   - TypeScript typing issues with `Mock<any, any>` vs `Mock<any, any, any>`
   - Potential null/undefined handling issues with `overrides` parameter in mocks

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
5. Begin implementation of `sectionManagerNode` (Task 16.5)

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
