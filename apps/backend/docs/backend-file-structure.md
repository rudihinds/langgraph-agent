# Backend File Structure

## Overview

This document outlines the file structure of the backend application, focusing on the LangGraph agent implementation, API endpoints, and supporting services. The backend follows a modular architecture pattern organized around agents, shared libraries, and services, with clear boundaries between different components.

**Last Updated:** January 2025 - After completion of comprehensive backend refactoring (Phases 1-5)

## Core Principles

1. **Agent-Based Architecture**: Code is organized around LangGraph agents and their supporting components
2. **Separation of Concerns**: Clear separation between agent logic, API endpoints, and shared utilities
3. **Testability**: Comprehensive test coverage with consolidated test structure using Vitest
4. **Modular Design**: Components are modular with well-defined interfaces
5. **Configuration-Driven**: Centralized configuration management with external criteria and dependencies
6. **Clean Architecture**: Deprecated services removed, duplicate implementations consolidated

## Root Structure

```
apps/backend/
├── __tests__/              # Consolidated integration tests
├── agents/                 # LangGraph agent implementation
├── api/                    # API routes and handlers (streamlined)
├── config/                 # Configuration files
├── docs/                   # Documentation
├── evaluation/             # Evaluation framework
├── lib/                    # Shared libraries and utilities
├── prompts/                # Organized prompt templates
├── scripts/                # Utility scripts
├── services/               # Business logic services
├── src/                    # Source directory
├── state/                  # State definitions and reducers
├── test/                   # Legacy test directory (minimal)
├── tests/                  # Legacy test directory (minimal)
├── tools/                  # LangGraph tools
├── package.json            # Package dependencies
├── README.md
├── register-agent-graphs.ts # Script to register agent graphs
├── register-paths.ts       # Script for path alias registration
├── repomix-backend.xml     # RepoMix file for structure analysis
├── server.js               # Server entry point (JavaScript)
├── server.ts               # Server entry point (TypeScript source)
├── tsconfig.build.json     # TypeScript configuration for building
├── tsconfig.json           # Main TypeScript configuration
├── vitest.config.ts        # Vitest test runner configuration
└── vitest.setup.ts         # Vitest setup file
```

## Agents Structure

The `agents/` directory contains consolidated LangGraph agent implementations:

```
agents/
├── __tests__/                  # Consolidated agent tests
├── evaluation/                 # Evaluation agent components
│   ├── criteriaLoader.ts       # Loads evaluation criteria
│   ├── evaluationNodeFactory.ts # Factory for evaluation nodes
│   └── index.ts                # Main exports
│
├── orchestrator/               # Orchestrator agent (high-level flow control)
│   ├── __tests__/              # Orchestrator-specific tests
│   ├── prompts/                # Orchestrator prompts
│   ├── configuration.ts        # Configuration
│   ├── graph.ts                # Graph definition
│   ├── nodes.ts                # Node implementations
│   ├── prompt-templates.ts     # Prompt templates
│   └── state.ts                # State definition
│
├── proposal-generation/        # Primary proposal generation agent (consolidated)
│   ├── __tests__/              # Tests
│   ├── nodes/                  # Individual node implementations
│   │   ├── __tests__/          # Node-specific tests
│   │   ├── chatAgent.ts        # Chat handling
│   │   ├── connectionPairs.ts  # Connection analysis
│   │   ├── deepResearch.ts     # Deep research node
│   │   ├── document_loader.ts  # Document loading
│   │   ├── evaluateConnections.ts # Connection evaluation
│   │   ├── evaluateResearch.ts # Research evaluation
│   │   ├── evaluateSolution.ts # Solution evaluation
│   │   ├── problem_statement.ts # Problem statement generation
│   │   ├── processFeedback.ts  # Feedback processor
│   │   ├── section_manager.ts  # Section manager
│   │   ├── section_nodes.ts    # Section generation nodes
│   │   ├── solutionSought.ts   # Solution identification
│   │   └── toolProcessor.ts    # Tool processor
│   ├── prompts/                # Agent-specific prompt templates
│   ├── utils/                  # Agent-specific utilities
│   ├── conditionals.ts         # Edge conditionals
│   ├── evaluation_integration.ts # Evaluation integration
│   ├── graph.ts                # Graph definition
│   ├── index.ts                # Main exports
│   └── nodes.ts                # Main node definitions (barrel exports)
│
├── research/                   # Research agent
│   ├── __tests__/              # Tests
│   ├── prompts/                # Research prompts
│   ├── agents.ts               # Agent definitions
│   ├── index.ts                # Main exports
│   ├── nodes.ts                # Node implementations
│   ├── README.md               # Documentation
│   ├── state.ts                # State definition
│   └── tools.ts                # Research tools
│
├── README.md                   # Agent documentation
└── index.ts                    # Export agent interfaces
```

## Services Structure

The `services/` directory contains business logic services:

```
services/
├── __tests__/                  # Consolidated service tests
│   ├── DependencyService.test.ts
│   ├── orchestrator-dependencies.test.ts
│   └── orchestrator.service.test.ts
├── DependencyService.ts        # Manages dependencies between proposal sections
├── orchestrator-factory.ts     # Factory for creating orchestrators
├── orchestrator.service.ts     # Main orchestration service
├── proposalThreadAssociation.service.ts # Thread association management
└── thread.service.ts           # Thread-specific logic
```

## API Structure (Streamlined)

The `api/` directory contains streamlined API routes and handlers:

```
api/
├── express-server.ts           # Express server setup
├── README.md                   # API documentation
└── rfp/                        # RFP-related routes (consolidated)
    ├── __tests__/              # RFP route tests
    ├── index.ts                # Main RFP router
    ├── proposalThreads.ts      # Thread management endpoints
    └── README.md               # RFP API documentation
```

## State Management

The `state/` directory contains state definitions and reducers:

```
state/
├── __tests__/                  # Consolidated state tests
│   ├── modules/                # Module-specific tests
│   ├── proposal.state.test.ts  # Proposal state tests
│   └── reducers.test.ts        # Reducer tests
├── modules/                    # State modules
│   ├── annotations.ts          # State annotations
│   ├── constants.ts            # State constants
│   ├── reducers.ts             # Reducer functions
│   ├── schemas.ts              # State schemas
│   ├── types.ts                # State type definitions
│   └── utils.ts                # State utilities
├── proposal.state.js           # JavaScript state definition
├── proposal.state.ts           # TypeScript state definition
├── README.md                   # State documentation
└── reducers.ts                 # Main reducer functions
```

## Shared Libraries

The `lib/` directory contains shared code used across the application:

```
lib/
├── __tests__/                  # Consolidated library tests
├── config/                     # Centralized configuration
│   └── env.ts                  # Environment variable management
├── db/                         # Database interactions
│   ├── __tests__/              # Database tests
│   └── documents.ts            # Document operations
├── llm/                        # LLM integration
│   ├── __tests__/              # LLM tests
│   ├── streaming/              # Streaming support
│   ├── anthropic-client.ts     # Anthropic integration
│   ├── context-window-manager.ts # Context window management
│   ├── error-handlers.ts       # Error handling utilities
│   └── llm-factory.ts          # LLM factory
├── middleware/                 # Express middleware (TypeScript)
│   ├── __tests__/              # Consolidated middleware tests
│   ├── auth.ts                 # Authentication middleware (TypeScript)
│   ├── langraph-auth.ts        # LangGraph authentication
│   ├── rate-limit.js           # Rate limiting
│   └── README.md               # Middleware documentation
├── parsers/                    # Document parsers
│   ├── __tests__/              # Consolidated parser tests
│   ├── pdf-parser.ts           # PDF parser
│   ├── README.md               # Parser documentation
│   └── rfp.ts                  # RFP parser
├── persistence/                # State persistence (modernized)
│   ├── __tests__/              # Persistence tests
│   ├── functions/              # Database functions
│   ├── migrations/             # Database migrations
│   ├── apply-migrations.ts     # Migration application
│   ├── db-schema.sql           # Database schema
│   ├── ICheckpointer.ts        # Checkpointer interface
│   ├── index.ts                # Main exports
│   ├── MIGRATION_GUIDE.md      # Migration guide
│   ├── README.md               # Persistence documentation
│   ├── robust-checkpointer.ts  # Primary checkpointer (PostgresSaver)
│   ├── run-tests.sh            # Test runner
│   └── supabase-store.ts       # Supabase store
├── schema/                     # Schema definitions
│   └── proposal_states.sql     # Proposal state schema
├── state/                      # State utilities
│   └── messages.ts             # Message utilities
├── supabase/                   # Supabase integration
│   ├── migrations/             # Supabase migrations
│   ├── auth-utils.ts           # Auth utilities
│   ├── client.ts               # Supabase client
│   ├── index.ts                # Main exports
│   ├── langgraph-server.ts     # LangGraph server integration
│   ├── README.md               # Supabase documentation
│   ├── server.js               # Server utilities
│   ├── storage.js              # Storage utilities
│   └── supabase-runnable.ts    # Supabase runnable
├── types/                      # Type definitions
│   ├── auth.ts                 # Auth types
│   └── feedback.ts             # Feedback types
├── utils/                      # Utility functions
│   ├── backoff.ts              # Backoff utilities
│   ├── files.ts                # File utilities
│   └── paths.ts                # Path utilities
├── database.types.ts           # Database types
├── logger.d.ts                 # Logger types
├── logger.js                   # Logging utility
├── MANUAL_SETUP_STEPS.md       # Setup steps
├── schema.sql                  # Database schema
├── state-serializer.ts         # State serialization
├── storage-policies.sql        # Storage policies
├── SUPABASE_SETUP.md           # Supabase setup
└── types.ts                    # Common types
```

## Prompts Structure (Organized)

The `prompts/` directory contains organized prompt templates:

```
prompts/
├── evaluation/                 # Evaluation prompts
│   ├── connectionPairsEvaluation.ts # Connection evaluation
│   ├── funderSolutionAlignment.ts   # Solution alignment
│   ├── index.ts                     # Main exports
│   ├── researchEvaluation.ts        # Research evaluation
│   ├── sectionEvaluation.ts         # Section evaluation
│   └── solutionEvaluation.ts        # Solution evaluation
├── generation/                 # Generation prompts
│   ├── budget.ts               # Budget generation
│   ├── conclusion.ts           # Conclusion generation
│   ├── index.ts                # Main exports
│   ├── methodology.ts          # Methodology generation
│   ├── problemStatement.ts     # Problem statement
│   ├── solution.ts             # Solution generation
│   └── timeline.ts             # Timeline generation
└── section_generators/         # Section-specific prompts
    └── problem_statement.prompt.txt # Problem statement template
```

## Configuration

The `config/` directory contains centralized configuration files:

```
config/
├── dependencies.json           # Section dependency configuration
└── evaluation/                 # Evaluation criteria
    ├── connections.json        # Connection evaluation criteria
    ├── research.json           # Research evaluation criteria
    ├── sections.json           # Section evaluation criteria
    └── solution.json           # Solution evaluation criteria
```

## Testing Structure (Consolidated)

Tests are now consolidated in the top-level `__tests__/` directory with organized subdirectories:

```
__tests__/
├── agents/                     # Agent integration tests
├── api/                        # API endpoint tests
├── integration/                # System integration tests
├── lib/                        # Library tests
├── services/                   # Service tests
└── unit/                       # Unit tests
```

## Key Changes from Refactoring

### Phase 1: Deprecated Services Removal ✅

- **Removed**: `[dep]orchestrator.service.ts` (1,235 lines)
- **Removed**: `[dep]orchestrator-factory.ts`, `[dep]checkpointer.service.ts`
- **Removed**: `agents/[dep]README.md`, `agents/[dep]index.ts`
- **Removed**: `api/langgraph/index.ts` (249 lines of obsolete server code)
- **Impact**: ~1,700+ lines of deprecated code eliminated

### Phase 2: Agent Consolidation ✅

- **Consolidated**: Merged `proposal-agent/` into `proposal-generation/`
- **Standardized**: Individual node files for better organization
- **Refactored**: `nodes.ts` as barrel export file
- **Verified**: No duplicate utilities between agents and shared libraries

### Phase 3: Test Structure Reorganization ✅

- **Consolidated**: 68 test files from 18+ scattered directories
- **Organized**: Tests into logical subdirectories under `__tests__/`
- **Standardized**: All tests use Vitest (converted from Jest)
- **Removed**: Empty test directories and broken test files

### Phase 4: API Layer Cleanup ✅

- **Removed**: Obsolete routes (`feedback.ts`, `resume.ts`, `interrupt-status.ts`, `workflow.ts`, `chat.ts`)
- **Cleaned**: Duplicate files (`api/index.ts`, `api/rfp.js`)
- **Streamlined**: API structure focused on business logic
- **Verified**: Consistent error handling patterns

### Phase 5: Configuration Consolidation ✅

- **Centralized**: All environment variables in `lib/config/env.ts`
- **Converted**: Auth middleware from JavaScript to TypeScript
- **Organized**: Prompt templates with section-specific directory
- **Standardized**: Configuration patterns across backend

## Guidelines for Adding New Code

### Adding a New Agent

1. Create a new directory under `agents/<agent-name>`
2. Follow the standard structure:
   - `graph.ts` - Graph definition
   - `nodes.ts` - Barrel exports for node implementations
   - `nodes/` - Individual node implementation files
   - `conditionals.ts` - Routing logic
   - `prompts/` - Agent-specific prompts
   - `utils/` - Agent utilities
   - `__tests__/` - Agent tests
3. Export the agent through `index.ts`
4. Register the agent in the appropriate service

### Adding New API Endpoints

1. **Business Logic Endpoints**: Add to `api/rfp/` or create new subdirectory
2. **Route Organization**: Keep routes focused on HTTP concerns, business logic in services
3. **Add tests** in the corresponding `__tests__/` directory
4. **Follow patterns**: Use existing authentication and validation patterns

### Implementing State Management

1. Define interfaces in `state/modules/types.ts`
2. Create reducers in `state/modules/reducers.ts`
3. Define annotations in `state/modules/annotations.ts`
4. Add tests for each component in `__tests__/`

### Adding LLM Integration

1. Add client implementation in `lib/llm/`
2. Implement error handling and retry logic
3. Update the LLM factory to support the new integration
4. Add comprehensive tests in `__tests__/lib/`

## Best Practices

1. **Imports**:

   - Use relative imports within a module
   - Use path aliases (`@/`) for importing from other modules or shared code
   - All imports use `.js` extensions for ESM compatibility

2. **Configuration**:

   - **Always use the centralized `ENV` object** from `lib/config/env.ts`
   - Avoid direct `process.env` usage throughout the codebase
   - Environment variables are validated and typed

3. **Checkpointer Usage**:

   - **Use `robust-checkpointer.ts`** for creating PostgresSaver instances
   - Primary factory creates PostgresSaver (Supabase) with MemorySaver fallback
   - Handles database schema setup automatically

4. **Testing**:

   - Write tests for all components in consolidated `__tests__/` structure
   - Use Vitest for all new tests (Jest has been phased out)
   - Place tests in appropriate subdirectories (agents, api, lib, services, unit, integration)
   - Use descriptive test names that explain the behavior being tested

5. **Error Handling**:

   - Implement proper error handling and retries for LLM calls
   - Use the error handling utilities in `lib/llm/error-handlers.ts`
   - Log errors with appropriate context using centralized logger

6. **State Management**:

   - Follow immutable patterns for state updates
   - Use typed interfaces for all state objects
   - Implement and test custom reducers thoroughly

7. **Documentation**:
   - Document complex functions with JSDoc comments
   - Maintain README files for each major directory
   - Update this document when making significant structural changes

## Migration Notes

The backend has completed a comprehensive refactoring:

1. **Deprecated Code Removal**: All `[dep]` prefixed files and obsolete services removed
2. **Agent Consolidation**: Single `proposal-generation` implementation replaces duplicates
3. **Test Consolidation**: All tests organized in structured `__tests__/` directories
4. **API Streamlining**: Focused on business logic, removed server management routes
5. **Configuration Centralization**: Single source of truth for environment variables

## Architecture Principles

- **Express handles business logic only**: LangGraph SDK manages agent execution
- **Clear separation of concerns**: API, services, agents, and utilities are distinct
- **Centralized configuration**: All environment variables managed through `ENV` object
- **Consolidated testing**: Organized test structure with consistent patterns
- **Modern persistence**: Uses official LangGraph checkpointer with Supabase backend

## References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)
- [LangChain.js Documentation](https://js.langchain.com/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [Supabase Documentation](https://supabase.io/docs)
- [Vitest Documentation](https://vitest.dev/)
