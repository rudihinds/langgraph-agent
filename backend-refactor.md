# Backend Refactoring Plan

## Overall Goal

Eliminate deprecated services, consolidate duplicate agent implementations, and establish a clean, maintainable backend architecture. This refactoring focuses on removing obsolete LangGraph server code, consolidating agent implementations, cleaning up test structure, and organizing the Express.js business logic layer while maintaining the LangGraph SDK-managed agent execution.

## Key Documentation

- [LangGraph.js Documentation](https://langchain-ai.github.io/langgraphjs/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Project Structure](https://github.com/goldbergyoni/nodebestpractices)
- [TypeScript Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)

## Current Status Summary

- ◻️ Deprecated services cleanup (Phase 1)
- ◻️ Agent consolidation (Phase 2)
- ◻️ Test structure reorganization (Phase 3)
- ◻️ API layer cleanup (Phase 4)
- ◻️ Configuration consolidation (Phase 5)

---

## Phase 1: Remove Deprecated Services (Critical Priority) ✅

### Step 1.1: Remove Deprecated Orchestrator Service ✅

**Issue**: `[dep]orchestrator.service.ts` contains obsolete LangGraph server management code that conflicts with SDK-managed execution.

**Files Affected**:

- `apps/backend/services/[dep]orchestrator.service.ts` (DELETE)
- Any imports referencing this service

**Action Items**:

1. ◻️ Search for all imports: `grep -r "\[dep\]orchestrator" apps/backend/`
2. ◻️ Verify no active usage in Express routes or other services
3. ◻️ Remove the deprecated service file
4. ◻️ Update any remaining references to use proper LangGraph SDK patterns
5. ◻️ Test that agent execution still works through SDK

**Justification**: The LangGraph SDK handles server management internally. Custom orchestrator services create conflicts and maintenance overhead.

### Step 1.2: Clean Up Deprecated Agent Files ✅

**Issue**: Multiple `[dep]` prefixed files contain obsolete agent implementations.

**Files to Remove**:

- `apps/backend/agents/[dep]README.md`
- `apps/backend/agents/[dep]index.ts`
- Any other `[dep]` prefixed agent files

**Action Items**:

1. ◻️ Audit all `[dep]` files for active usage
2. ◻️ Verify no imports (from files that are in use) reference these files
3. ◻️ Remove deprecated agent files
4. ◻️ Update documentation to reflect current agent structure
5. ◻️ Ensure agent exports work correctly

**Justification**: Deprecated agent files create confusion and potential import conflicts.

### Step 1.3: Remove Obsolete LangGraph Server Code ✅

**Issue**: Custom LangGraph server implementations that are now handled by the SDK.

**Files to Investigate**:

- `apps/backend/api/langgraph/index.ts` (check for obsolete server code)
- Any custom server setup in agent directories

**Action Items**:

1. ◻️ Review `api/langgraph/index.ts` for obsolete server management
2. ◻️ Remove any custom LangGraph server initialization code
3. ◻️ Ensure only checkpointer configuration and agent definitions remain
4. ◻️ Verify SDK handles all server concerns
5. ◻️ Test agent execution through proper SDK channels

**Justification**: Custom server code conflicts with LangGraph SDK's internal server management.

---

## Phase 2: Consolidate Agent Implementations (High Priority)

### Step 2.1: Merge Duplicate Agent Implementations ◻️

**Issue**: Both `proposal-agent` and `proposal-generation` directories exist with overlapping functionality.

**Files Affected**:

- `apps/backend/agents/proposal-agent/` (evaluate for consolidation)
- `apps/backend/agents/proposal-generation/` (primary implementation)

**Action Items**:

1. ◻️ Compare implementations to identify unique functionality
2. ◻️ Determine which should be the canonical implementation
3. ◻️ Migrate any unique features to the canonical version
4. ◻️ Update imports to use consolidated agent
5. ◻️ Remove duplicate implementation
6. ◻️ Test consolidated agent functionality

**Justification**: Multiple agent implementations create maintenance overhead and potential conflicts.

### Step 2.2: Standardize Agent Structure ◻️

**Issue**: Inconsistent organization within agent directories.

**Target Structure**:

```
apps/backend/agents/proposal-generation/
├── graph.ts          # Main graph definition
├── nodes.ts          # Node implementations
├── conditionals.ts   # Routing logic
├── prompts/          # Agent-specific prompts
├── utils/            # Agent utilities
└── __tests__/        # Agent tests
```

**Action Items**:

1. ◻️ Audit current agent directory structures
2. ◻️ Reorganize files to match standard structure
3. ◻️ Update imports after reorganization
4. ◻️ Ensure consistent naming patterns
5. ◻️ Verify agent functionality after restructuring

**Justification**: Consistent structure improves maintainability and developer experience.

### Step 2.3: Consolidate Agent Utilities ◻️

**Issue**: Scattered utility functions across agent directories.

**Files Affected**:

- `apps/backend/agents/*/utils/` directories
- Utility functions in agent root directories

**Action Items**:

1. ◻️ Identify shared utility functions across agents
2. ◻️ Move shared utilities to `apps/backend/lib/utils/`
3. ◻️ Keep agent-specific utilities in agent directories
4. ◻️ Update imports to use consolidated utilities
5. ◻️ Remove duplicate utility implementations

**Justification**: Shared utilities should be centralized to avoid duplication and inconsistencies.

---

## Phase 3: Test Structure Reorganization (Medium Priority)

### Step 3.1: Consolidate Test Directories ◻️

**Issue**: Multiple test directory patterns create confusion.

**Current Issues**:

- Both `test/` and `tests/` directories exist
- `__tests__/` directories scattered throughout
- Inconsistent test organization

**Target Structure**:

```
apps/backend/
├── __tests__/           # Integration tests
│   ├── agents/         # Agent integration tests
│   ├── api/            # API endpoint tests
│   └── services/       # Service integration tests
└── [feature]/__tests__/ # Unit tests alongside code
```

**Action Items**:

1. ◻️ Audit all test files and their current locations
2. ◻️ Move integration tests to top-level `__tests__/`
3. ◻️ Keep unit tests in `__tests__/` directories alongside code
4. ◻️ Remove duplicate `test/` and `tests/` directories
5. ◻️ Update test scripts and configuration
6. ◻️ Verify all tests still run correctly

**Justification**: Consistent test organization improves developer experience and CI/CD reliability.

### Step 3.2: Clean Up Broken Test Files ◻️

**Issue**: Test files with import errors or missing dependencies.

**Files to Investigate**:

- `apps/backend/tests/imports.test.ts` (basic import test)
- Any tests importing deprecated services
- Tests with relative import issues

**Action Items**:

1. ◻️ Run test suite to identify broken tests
2. ◻️ Fix import paths using proper aliases
3. ◻️ Remove tests for deprecated functionality
4. ◻️ Update test dependencies and mocks
5. ◻️ Ensure all tests pass

**Justification**: Broken tests provide false confidence and slow down development.

### Step 3.3: Standardize Test Patterns ◻️

**Issue**: Inconsistent test patterns and mocking approaches.

**Action Items**:

1. ◻️ Establish standard test patterns for agents, services, and API routes
2. ◻️ Create shared test utilities and mocks
3. ◻️ Update existing tests to use standard patterns
4. ◻️ Document testing guidelines
5. ◻️ Ensure consistent mocking of external dependencies

**Justification**: Consistent test patterns improve maintainability and reduce cognitive load.

---

## Phase 4: API Layer Cleanup (Medium Priority)

### Step 4.1: Consolidate Express Route Handlers ◻️

**Issue**: Mixed organization of route handlers and business logic.

**Files Affected**:

- `apps/backend/api/rfp/express-handlers/` (consolidate)
- `apps/backend/api/rfp/` (main routes)

**Action Items**:

1. ◻️ Review route handler organization
2. ◻️ Move business logic to service layer
3. ◻️ Keep route handlers focused on HTTP concerns
4. ◻️ Consolidate related handlers
5. ◻️ Update route imports and exports

**Justification**: Clear separation between HTTP handling and business logic improves testability and maintainability.

### Step 4.2: Remove Obsolete API Routes ◻️

**Issue**: API routes that attempt to manage LangGraph server directly.

**Files to Investigate**:

- Routes that start/stop LangGraph servers
- Routes that duplicate SDK functionality
- Unused or deprecated endpoints

**Action Items**:

1. ◻️ Identify routes that conflict with LangGraph SDK
2. ◻️ Remove obsolete server management routes
3. ◻️ Keep only business logic and data management routes
4. ◻️ Update API documentation
5. ◻️ Test remaining endpoints

**Justification**: API should focus on business logic, not LangGraph server management.

### Step 4.3: Standardize Error Handling ◻️

**Issue**: Inconsistent error handling patterns across API routes.

**Action Items**:

1. ◻️ Audit error handling patterns in all routes
2. ◻️ Implement consistent error middleware
3. ◻️ Standardize error response formats
4. ◻️ Update routes to use standard error handling
5. ◻️ Test error scenarios

**Justification**: Consistent error handling improves API reliability and debugging.

---

## Phase 5: Configuration Consolidation (Low Priority)

### Step 5.1: Consolidate Configuration Files ◻️

**Issue**: Configuration scattered across multiple files and directories.

**Files Affected**:

- `apps/backend/config/` directory
- Environment variable handling
- Agent configuration files

**Action Items**:

1. ◻️ Audit all configuration files and patterns
2. ◻️ Consolidate related configuration
3. ◻️ Implement configuration validation
4. ◻️ Document configuration options
5. ◻️ Test configuration loading

**Justification**: Centralized configuration reduces complexity and improves maintainability.

### Step 5.2: Clean Up Environment Variables ◻️

**Issue**: Unused or deprecated environment variables.

**Action Items**:

1. ◻️ Audit all environment variable usage
2. ◻️ Remove references to unused variables
3. ◻️ Update `.env.example` files
4. ◻️ Document required environment variables
5. ◻️ Validate environment setup

**Justification**: Clean environment configuration reduces deployment complexity.

### Step 5.3: Organize Prompt Templates ◻️

**Issue**: Prompt templates scattered across agent directories.

**Files Affected**:

- `apps/backend/prompts/` (global prompts)
- `apps/backend/agents/*/prompts/` (agent-specific prompts)

**Action Items**:

1. ◻️ Audit all prompt template locations
2. ◻️ Organize prompts by agent and functionality
3. ◻️ Remove duplicate prompt templates
4. ◻️ Implement prompt template validation
5. ◻️ Document prompt template structure

**Justification**: Organized prompts improve agent maintainability and consistency.

---

## Validation Criteria

After each phase, verify:

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No broken imports or missing files
- [ ] Agent execution works through LangGraph SDK
- [ ] Express API routes function correctly
- [ ] No TypeScript errors
- [ ] No duplicate code remains
- [ ] Checkpointer configuration works
- [ ] Environment variables load correctly

---

## Current Context

**Last Updated**: 2025-01-25

**Current State**: ◻️ **REFACTORING NOT STARTED**

**Architecture Understanding**:

- Express server handles business/application logic only
- LangGraph server managed by SDK internally
- Checkpointer configuration is our responsibility
- Agent code (graphs/nodes) is our responsibility
- No custom server/route management for LangGraph

**Immediate Next Steps**:

1. Start with Phase 1: Remove deprecated services
2. Focus on `[dep]orchestrator.service.ts` removal first
3. Verify no active usage before deletion
4. Test agent execution after cleanup

**Risk Assessment**:

- **High Risk**: Removing services that might still be in use
- **Medium Risk**: Agent consolidation affecting functionality
- **Low Risk**: Test reorganization and configuration cleanup

**Dependencies**:

- Must maintain LangGraph SDK compatibility
- Must preserve checkpointer functionality
- Must keep Express business logic intact
- Must maintain agent execution capabilities

---

## Implementation Notes

### LangGraph SDK Integration Points

**What We Manage**:

- Checkpointer configuration (`@langgraph/checkpoint-postgres`)
- Agent graph definitions and node implementations
- Business logic in Express routes
- Data persistence and retrieval

**What SDK Manages**:

- LangGraph server lifecycle
- Agent execution runtime
- HTTP endpoints for agent interaction
- Internal routing and middleware

### File Organization Principles

**Keep**:

- Agent definitions (`graph.ts`, `nodes.ts`, `conditionals.ts`)
- Checkpointer setup and configuration
- Express business logic routes
- Utility functions and shared code
- Test files (after reorganization)

**Remove**:

- Custom LangGraph server implementations
- Deprecated service files with `[dep]` prefix
- Duplicate agent implementations
- Obsolete API routes for server management
- Broken or placeholder test files

### Testing Strategy

**Unit Tests**: Alongside code in `__tests__/` directories
**Integration Tests**: Top-level `__tests__/` directory
**Agent Tests**: Mock LangGraph SDK interactions
**API Tests**: Test Express routes independently

---

## Progress Tracking

### Phase 1 Progress: ✅ Complete

- [x] Step 1.1: Remove deprecated orchestrator service
- [x] Step 1.2: Clean up deprecated agent files
- [x] Step 1.3: Remove obsolete LangGraph server code

### Phase 2 Progress: ◻️ Not Started

- [ ] Step 2.1: Merge duplicate agent implementations
- [ ] Step 2.2: Standardize agent structure
- [ ] Step 2.3: Consolidate agent utilities

### Phase 3 Progress: ◻️ Not Started

- [ ] Step 3.1: Consolidate test directories
- [ ] Step 3.2: Clean up broken test files
- [ ] Step 3.3: Standardize test patterns

### Phase 4 Progress: ◻️ Not Started

- [ ] Step 4.1: Consolidate Express route handlers
- [ ] Step 4.2: Remove obsolete API routes
- [ ] Step 4.3: Standardize error handling

### Phase 5 Progress: ◻️ Not Started

- [ ] Step 5.1: Consolidate configuration files
- [ ] Step 5.2: Clean up environment variables
- [ ] Step 5.3: Organize prompt templates

---

## Final Backend Structure (Target)

```
apps/backend/
├── agents/                     # LangGraph agent implementations
│   └── proposal-generation/    # Consolidated agent (remove proposal-agent)
│       ├── graph.ts           # Main graph definition
│       ├── nodes.ts           # Node implementations
│       ├── conditionals.ts    # Routing logic
│       ├── prompts/           # Agent-specific prompts
│       ├── utils/             # Agent utilities
│       └── __tests__/         # Agent unit tests
├── api/                       # Express.js business logic routes
│   ├── rfp/                   # RFP management routes
│   └── langgraph/             # LangGraph SDK configuration only
├── lib/                       # Shared utilities and integrations
│   ├── supabase/              # Supabase client and checkpointer
│   ├── utils/                 # Shared utility functions
│   └── config/                # Configuration management
├── services/                  # Business logic services
├── prompts/                   # Global prompt templates
├── config/                    # Application configuration
├── __tests__/                 # Integration tests
│   ├── agents/                # Agent integration tests
│   ├── api/                   # API endpoint tests
│   └── services/              # Service integration tests
└── server.ts                  # Express server entry point
```

**Key Principles**:

- Express handles business logic only
- LangGraph SDK manages agent execution
- Clear separation of concerns
- Consistent file organization
- Comprehensive test coverage
- No duplicate implementations
  </rewritten_file>
