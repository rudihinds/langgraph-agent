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

1. Enhanced and Refactored Authentication Middleware with Token Refresh:

   - Improved code organization and maintainability through functional decomposition
   - Extracted token extraction, error response creation, and token expiration processing into separate functions
   - Enhanced error handling with standardized response formats
   - Improved logging with consistent structure and more detailed context
   - Renamed constants for better clarity (TOKEN_REFRESH_RECOMMENDATION_THRESHOLD_SECONDS)
   - Added comprehensive README.md documentation in the middleware directory
   - Added long-term improvement tasks to TASK.md for future enhancements
   - Cleaned up backend-auth.md documentation by removing excessive code snippets
   - All tests continue to pass after refactoring

2. Implemented Token Refresh Handling in Authentication Middleware:

   - Enhanced the auth middleware to detect expired tokens and calculate token expiration time
   - Added a `refresh_required` flag to 401 responses for expired tokens
   - Implemented token expiration calculation for valid tokens
   - Added `tokenExpiresIn` and `tokenRefreshRecommended` properties to request object
   - Created comprehensive JSDoc documentation for all authentication middleware functions
   - Developed a detailed README.md for the middleware directory
   - Created a standard pattern for token refresh that can be reused across the application

3. Implemented Rate Limiting Middleware:

   - Created IP-based rate limiting middleware for API protection
   - Implemented configurable time window and request limits
   - Added automatic cleanup to prevent memory leaks
   - Created clear error responses for rate-limited requests
   - Added comprehensive logging for rate limiting events
   - Documented near-term and long-term improvement plans in TASK.md
   - Completed tests verifying rate limiting functionality
   - Applied middleware to API routes with appropriate configuration

4. Implemented Request Timeout Handling:

   - Created timeout middleware for long-running operations
   - Added configurable timeout thresholds for different request types
   - Implemented graceful termination of stalled requests
   - Created clear error responses for timed-out operations
   - Added detailed logging for request timeouts
   - Updated backend-auth.md to reflect completed implementation
   - Integrated with existing authentication and rate limiting middleware

5. Implemented Token Refresh Header in Route Handlers:

   - Created comprehensive tests for token refresh header functionality in chat routes
   - Implemented the token refresh awareness in the chat router
   - Added the `X-Token-Refresh-Recommended` header when tokens are nearing expiration
   - Created proper TypeScript interfaces for authenticated requests
   - Added detailed logging for token refresh recommendations
   - Followed TDD approach with Red-Green-Refactor cycle
   - Completed full implementation of Route Handler token refresh requirements
   - All tests passing with both positive and negative cases covered

6. Completed the implementation of the section manager node:

   - Created a modular implementation in `apps/backend/agents/proposal-generation/nodes/section_manager.ts`
   - Implemented dependency resolution for sections using topological sorting
   - Added section prioritization based on dependencies
   - Implemented clean section status management
   - Verified the section manager correctly handles all section types defined in the SectionType enum
   - Ensured proper initialization of section data with appropriate metadata

7. Completed the implementation of the problem statement node:

   - Created a comprehensive implementation in `nodes/problem_statement.ts`
   - Integrated with LangChain for LLM-based section generation
   - Used structured output parsing with Zod schema validation
   - Implemented context window management for large inputs
   - Added comprehensive error handling and test coverage

8. Updated node exports and references:

   - Moved from monolithic implementation in nodes.js to modular files
   - Updated exports to reference the new implementations
   - Maintained backward compatibility with existing graph structure

9. Completed the RFP document integration implementation:

   - Successfully implemented document loading with rfpId from state
   - Enhanced documentLoaderNode with proper error handling
   - Added fallback mechanisms for document retrieval
   - Created comprehensive test suite for document loading
   - All RFP integration tests are now passing

10. Completed document loader implementation and critical analysis:

- Implemented a robust document loader node with authentication support
- Added proper error handling and classification for various failure scenarios
- Implemented client type tracking (authenticated vs. server)
- Added comprehensive tests for various edge cases and error conditions
- Created standardized error pattern with ErrorType enumeration
- Identified and documented potential improvements in security, performance, and scalability
- Added document metadata support including client type and timestamps
- All tests for document loader functionality are now passing

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

4. Address document loader security and performance improvements:
   - Implement document size validation and limits to prevent memory issues
   - Add rfpId validation and sanitization to prevent path traversal vulnerabilities
   - Support multiple documents per RFP for real-world use cases
   - Consider implementing a caching strategy for frequently accessed documents
   - Implement retry strategies for transient errors
   - Move toward streaming document processing for large files

## Active Decisions & Considerations

### Authentication Token Refresh Strategy

We've implemented a proactive token refresh approach in the authentication middleware:

1. **Token Refresh Thresholds**:

   - A threshold constant `TOKEN_REFRESH_THRESHOLD_SECONDS = 600` (10 minutes) defines when tokens should be refreshed
   - Tokens with less than 10 minutes before expiration are flagged for refresh
   - This balances security with user experience by preventing unnecessary refreshes

2. **Expiration Metadata**:

   - `req.tokenExpiresIn`: Number of seconds until token expiration
   - `req.tokenRefreshRecommended`: Boolean flag indicating if token refresh is recommended
   - This metadata allows route handlers to make informed decisions about token refresh

3. **Expired Token Handling**:

   - Expired tokens return a 401 response with `refresh_required: true`
   - This special flag helps clients distinguish between expired tokens and other auth errors
   - Enables frontend to implement automatic token refresh and request retry

4. **Client Integration**:
   - Frontend can add token refresh logic for proactive and reactive refresh scenarios
   - Response headers (e.g., `X-Token-Refresh-Recommended`) can be used to signal refresh needs
   - This pattern avoids unnecessary interruptions to the user experience

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

5. **Token Refresh Benefits**: Our token refresh approach provides:
   - Enhanced security by detecting and handling expired tokens
   - Improved user experience through proactive refresh before expiration
   - Clear client-side integration patterns
   - Standardized error handling for authentication

## Authentication Middleware Implementation

✅ The token refresh handling in the authentication middleware is now fully implemented, tested, and documented.
✅ The rate limiting middleware is now fully implemented, tested, and documented with improvement plans.
✅ The request timeout handling is now fully implemented, tested, and documented.
✅ The token refresh header functionality in route handlers is now fully implemented, tested, and documented.

### Current Implementation

We have successfully implemented the following:

1. **Token Validation**:

   - Validates JWT tokens from the Authorization header
   - Creates authenticated Supabase client for the user
   - Attaches user data and client to the request object
   - Comprehensive error handling for invalid tokens

2. **Token Expiration Detection**:

   - Calculates remaining time until token expiration
   - Adds expiration metadata to the request object:
     - `req.tokenExpiresIn`: Seconds until token expiration
     - `req.tokenRefreshRecommended`: Boolean flag for tokens nearing expiration
   - Flags tokens close to expiration for proactive refresh (10-minute threshold)
   - Automatically sets `X-Token-Refresh-Recommended` header for at-risk tokens
   - Special handling for already expired tokens with `refresh_required` flag

3. **Edge Case Handling**:

   - Graceful handling of missing session data
   - Proper handling of tokens with missing expiration timestamp
   - Consistent error messages for different failure modes
   - Detailed logging for authentication events

4. **Rate Limiting**:

   - IP-based request tracking and rate enforcement
   - Configurable time window and request limits
   - Automatic cleanup of old request data
   - Standardized 429 responses with retry information
   - Comprehensive logging for rate-limited requests
   - Memory-efficient implementation
   - Clear improvement roadmap for scaling

5. **Request Timeout Handling**:

   - Configurable timeout thresholds for different request types
   - Graceful termination of stalled requests
   - Well-structured error responses for timed-out operations
   - Integration with authentication flow
   - Detailed logging for tracking timeout patterns
   - Support for client notification of approaching timeouts

6. **Route Handler Token Refresh**:

   - Implementation of `X-Token-Refresh-Recommended` header in route handlers
   - TypeScript interfaces for authenticated requests
   - Proper check for token refresh recommendation from middleware
   - Detailed logging of token expiration information
   - Comprehensive test coverage for various scenarios
   - Clean implementation following TDD principles

7. **Code Organization**:

   - Refactored into helper functions for better maintainability
   - Consistent error response creation
   - Proper middleware integration with Express.js
   - Clear separation of concerns

8. **Documentation**:
   - Comprehensive JSDoc comments for all functions
   - Detailed README.md in the middleware directory
   - Usage examples for route handlers
   - Implementation guidance for client-side token refresh
   - Rate limiting improvement roadmap in TASK.md

### Testing Results

The comprehensive test suite for authentication is now passing, including:

- ✅ Valid token authentication tests
- ✅ Invalid token rejection tests
- ✅ Expired token handling tests
- ✅ Missing auth header tests
- ✅ Token expiration calculation tests
- ✅ Edge case handling tests (missing session data, missing expiration time)
- ✅ Error response structure tests
- ✅ Integration with document loading tests
- ✅ Route handler token refresh header tests

### Implementation Insights

1. **Functional Decomposition**: Breaking down the middleware into focused helper functions improved code readability and maintainability.

2. **Standardized Error Responses**: Using a consistent error response structure makes it easier for clients to handle different authentication scenarios.

3. **Proactive Token Refresh**: Detecting tokens close to expiration allows for a better user experience by preventing unexpected session terminations.

4. **Resilient Edge Case Handling**: Gracefully handling missing session data or expiration timestamps ensures the middleware doesn't break the request flow in non-standard scenarios.

5. **Clear Client Integration Patterns**: The README documentation provides clear guidance for client-side token refresh implementation.

6. **TDD Approach Benefits**: Following a Test-Driven Development approach led to cleaner code, better separation of concerns, and more comprehensive test coverage.

## Node Status

| Node                 | Status      | Notes                    |
| -------------------- | ----------- | ------------------------ |
| documentLoaderNode   | Complete    | Updated to handle rfpId  |
| deepResearchNode     | Complete    | No changes needed        |
| solutionSoughtNode   | Complete    | No changes needed        |
| problemStatementNode | Complete    | No changes needed        |
| chatAgentNode        | In Progress | Adding document guidance |
| methodologyNode      | Complete    | No changes needed        |
| budgetNode           | Complete    | No changes needed        |
| timelineNode         | Complete    | No changes needed        |

## Graph Updates

The proposal generation graph now accepts an `rfpId` parameter during initialization:

```typescript
export const createProposalGenerationGraph = async (
  rfpId?: string,
  userId?: string
) => {
  // Create a new StateGraph with OverallProposalState
  const graph = new StateGraph<ProposalStateAnnotation>({
    channels: {
      messages: messagesStateReducer,
    },
  });

  // Register nodes...

  // Initialize state with rfpId if provided
  const initialState: Partial<OverallProposalState> = {
    rfpId: rfpId || process.env.DEFAULT_RFP_ID || "default",
    userId: userId || "test-user",
    status: "not_started",
    sections: new Map(),
    errors: [],
  };

  // Add the checkpointer
  const checkpointer = createCheckpointer();

  // Compile the graph
  return {
    graph: graph.compile(),
    checkpointer,
    initialState,
  };
};
```

## Orchestrator Service Updates

The Orchestrator Service has been enhanced to handle rfpId:

```typescript
export class OrchestratorService {
  // ...

  async startProposalGeneration({
    rfpId,
    userId,
  }: StartProposalOptions): Promise<string> {
    try {
      // Initialize graph with rfpId and userId
      const { graph, checkpointer, initialState } =
        await createProposalGenerationGraph(rfpId, userId);

      // Generate a unique thread ID for this proposal
      const threadId = uuidv4();

      // Start the graph with initial state
      const runner = await graph.start({
        checkpointer,
        threadId,
        state: initialState,
      });

      // Return the thread ID for future reference
      return threadId;
    } catch (error) {
      logger.error(`Failed to start proposal generation: ${error.message}`);
      throw new Error(
        `Orchestrator failed to start proposal generation: ${error.message}`
      );
    }
  }

  // ...
}
```

## API Updates

Express handlers have been updated to accept rfpId:

```typescript
// Start a new proposal generation with rfpId
router.post("/api/rfp/start", async (req, res) => {
  try {
    const { rfpId, userId } = req.body;

    // Validate required parameters
    if (!rfpId) {
      return res.status(400).json({
        error: "Missing required rfpId parameter",
      });
    }

    // Call orchestrator with rfpId
    const threadId = await orchestratorService.startProposalGeneration({
      rfpId,
      userId,
    });

    return res.status(200).json({ threadId });
  } catch (error) {
    logger.error("Error starting proposal generation:", error);
    return res.status(500).json({
      error: "Failed to start proposal generation",
      details: error.message,
    });
  }
});
```

## Active Decisions

1. **State-Based rfpId**:

   - The primary source of truth for the RFP document is the `rfpId` in the state object
   - Default fallbacks are provided for testing (env variable and 'default')
   - All nodes that need to reference the RFP should get it from state

2. **Document Storage Pattern**:

   - RFP documents are stored in the "proposal-documents" bucket
   - Path format: `{rfpId}/document.pdf`
   - Future: Support for multiple document formats

3. **API Design Considerations**:
   - Separate endpoints for starting and continuing proposals
   - Clear parameter validation
   - Enhanced authentication for document access

## Next Steps

1. Complete the chat agent updates for document guidance
2. Finish the continue endpoint with proper authentication
3. Create comprehensive test suite for RFP document integration
4. Implement frontend components for document selection

## Implementation Insights

1. **State Propagation**:

   - Ensure rfpId is properly propagated through the entire state lifecycle
   - Use state reducers for immutable updates

2. **Error Handling Pattern**:

   - Always add timestamped errors to the errors array
   - Include recovery suggestions when possible
   - Maintain detailed error contexts

3. **API Authentication**:
   - Protect document access with proper authentication
   - Validate user permissions for document access

## Testing Strategy

### Unit Tests

- Test document loader with various rfpId scenarios
- Test error handling for missing documents
- Test successful document loading

### Integration Tests

- Verify rfpId propagation through the graph
- Test API endpoints with valid and invalid parameters
- Test state persistence with rfpId

### End-to-End Tests

- Complete proposal generation flow with rfpId
- User interaction with document selection
- Error recovery scenarios

## Important Learnings

1. **Explicit State Management**:

   - Always explicitly define and type state parameters
   - Use clear default values and fallbacks

2. **Document Loading Challenges**:

   - Handle various document formats
   - Consider document size limits
   - Implement robust error recovery

3. **API Design**:

   - Use clear naming conventions
   - Implement proper parameter validation
   - Provide helpful error messages

4. **Authentication Middleware Design**:
   - Use functional decomposition for clarity and testability
   - Add comprehensive logging for security events
   - Implement clear error patterns for different auth scenarios
   - Consider both security and user experience in token refresh design
