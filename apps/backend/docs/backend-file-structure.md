# Backend File Structure

## Overview

This document outlines the file structure of the backend application, focusing on the LangGraph agent implementation, API endpoints, and supporting services. The backend follows a modular architecture pattern organized around agents, shared libraries, and services, with clear boundaries between different components.

## Core Principles

1. **Agent-Based Architecture**: Code is organized around LangGraph agents and their supporting components
2. **Separation of Concerns**: Clear separation between agent logic, API endpoints, and shared utilities
3. **Testability**: Comprehensive test coverage with dedicated test files alongside components
4. **Modular Design**: Components are modular with well-defined interfaces
5. **Configuration-Driven**: External configuration for evaluation criteria and dependencies

## Root Structure

```
apps/backend/
├── agents/             # LangGraph agent implementation
├── api/                # API routes and handlers
├── config/             # Configuration files
├── docs/               # Documentation
├── evaluation/         # Evaluation framework
├── lib/                # Shared libraries and utilities
├── prompts/            # Prompt templates
├── services/           # Business logic services
├── state/              # State definitions and reducers
├── tools/              # LangGraph tools
├── __tests__/          # Top-level tests
├── tests/              # Test files (legacy structure)
├── scripts/            # Utility scripts
├── server.ts           # Server entry point
├── index.ts            # Main exports
└── package.json        # Package dependencies
```

## Agents Structure

The `agents/` directory contains all LangGraph agent implementations, organized by agent type:

```
agents/
├── evaluation/                 # Evaluation agent components
│   ├── __tests__/              # Evaluation-specific tests
│   ├── criteriaLoader.ts       # Loads evaluation criteria
│   ├── evaluationNodeFactory.ts # Factory for evaluation nodes
│   └── index.ts                # Main exports
│
├── orchestrator/               # Orchestrator agent (high-level flow control)
│   ├── __tests__/              # Orchestrator-specific tests
│   ├── configuration.ts        # Configuration
│   ├── graph.ts                # Graph definition
│   ├── nodes.ts                # Node implementations
│   ├── prompt-templates.ts     # Prompt templates
│   └── state.ts                # State definition
│
├── proposal-agent/             # Legacy proposal agent (being replaced)
│   ├── __tests__/              # Tests
│   ├── conditionals.ts         # Edge conditionals
│   ├── graph.ts                # Graph definition
│   ├── nodes.ts                # Node implementations
│   └── state.ts                # State definition
│
├── proposal-generation/        # New proposal generation agent
│   ├── __tests__/              # Tests
│   ├── nodes/                  # Node implementations
│   │   ├── __tests__/          # Node-specific tests
│   │   ├── chatAgent.ts        # Chat handling
│   │   ├── document_loader.ts  # Document loading
│   │   └── section_nodes.ts    # Section generation nodes
│   ├── prompts/                # Prompt templates
│   ├── utils/                  # Agent-specific utilities
│   ├── conditionals.ts         # Edge conditionals
│   ├── graph.ts                # Graph definition
│   └── nodes.ts                # Main node definitions
│
├── research/                   # Research agent
│   ├── __tests__/              # Tests
│   ├── nodes.ts                # Node implementations
│   ├── state.ts                # State definition
│   └── index.ts                # Main exports
│
└── index.ts                    # Export agent interfaces
```

## Services Structure

The `services/` directory contains business logic services and high-level orchestration:

```
services/
├── __tests__/                  # Service tests
├── DependencyService.ts        # Manages dependencies between proposal sections
├── checkpointer.service.ts     # Checkpointer service for state persistence
├── orchestrator-factory.ts     # Factory for creating orchestrators
└── orchestrator.service.ts     # Main orchestration service
```

## API Structure

The `api/` directory contains API routes and handlers:

```
api/
├── __tests__/                  # API tests
├── rfp/                        # RFP-related routes
│   ├── __tests__/              # RFP route tests
│   ├── express-handlers/       # Express-specific handlers
│   ├── chat.ts                 # Chat endpoints
│   ├── feedback.ts             # Feedback handling
│   ├── interrupt-status.ts     # Interrupt status endpoints
│   ├── parse.ts                # Document parsing endpoint
│   ├── resume.ts               # Resume flow endpoint
│   └── index.ts                # Main RFP exports
├── express-server.ts           # Express server setup
└── index.ts                    # Main API exports
```

## State Management

The `state/` directory contains state definitions and reducers:

```
state/
├── __tests__/                  # State tests
│   ├── modules/                # Module-specific tests
│   ├── proposal.state.test.ts  # Proposal state tests
│   └── reducers.test.ts        # Reducer tests
├── modules/                    # State modules
│   ├── annotations.ts          # State annotations
│   ├── reducers.ts             # Reducer functions
│   ├── schemas.ts              # State schemas
│   ├── types.ts                # State type definitions
│   └── utils.ts                # State utilities
├── proposal.state.ts           # Main proposal state definition
└── reducers.ts                 # Main reducer functions
```

## Shared Libraries

The `lib/` directory contains shared code used across the application:

```
lib/
├── config/                     # Configuration utilities
├── db/                         # Database interactions
├── llm/                        # LLM integration
│   ├── __tests__/              # LLM tests
│   ├── streaming/              # Streaming support
│   ├── anthropic-client.ts     # Anthropic integration
│   ├── context-window-manager.ts # Context window management
│   ├── error-handlers.ts       # Error handling utilities
│   └── llm-factory.ts          # LLM factory
├── middleware/                 # Express middleware
├── parsers/                    # Document parsers
├── persistence/                # State persistence
│   ├── __tests__/              # Persistence tests
│   ├── migrations/             # Database migrations
│   ├── supabase-checkpointer.ts # Supabase checkpointer
│   └── memory-checkpointer.ts  # In-memory checkpointer
├── supabase/                   # Supabase integration
├── types/                      # Shared type definitions
└── utils/                      # Utility functions
    ├── backoff.ts              # Backoff utilities
    ├── files.ts                # File utilities
    └── paths.ts                # Path resolution
```

## Prompts Structure

The `prompts/` directory contains prompt templates:

```
prompts/
├── evaluation/                 # Evaluation prompts
│   ├── connectionPairsEvaluation.ts
│   ├── researchEvaluation.ts
│   ├── sectionEvaluation.ts
│   └── index.ts
└── generation/                 # Generation prompts
    ├── budget.ts
    ├── conclusion.ts
    ├── methodology.ts
    ├── problemStatement.ts
    ├── solution.ts
    └── index.ts
```

## Configuration

The `config/` directory contains configuration files:

```
config/
├── dependencies.json           # Section dependency configuration
└── evaluation/                 # Evaluation criteria
    ├── connections.json        # Connection evaluation criteria
    ├── research.json           # Research evaluation criteria
    ├── sections.json           # Section evaluation criteria
    └── solution.json           # Solution evaluation criteria
```

## Testing Structure

Tests are organized alongside the components they test, following a pattern of `__tests__` directories containing test files:

```
component/
├── __tests__/                  # Tests for the component
│   ├── feature1.test.ts        # Tests for feature1
│   └── feature2.test.ts        # Tests for feature2
├── feature1.ts                 # Feature implementation
└── feature2.ts                 # Feature implementation
```

Top-level tests are in the `__tests__/` directory:

```
__tests__/
└── integration/                # Integration tests
    ├── auth-document-flow.test.js
    ├── hitl-workflow.test.ts
    └── token-refresh-headers.test.js
```

## Detailed Structure Diagram

```
apps/backend/
├── agents/                                 # LangGraph agent implementations
│   ├── __tests__/                          # Agent tests
│   ├── evaluation/                         # Evaluation agent
│   │   ├── __tests__/                      # Evaluation tests
│   │   ├── criteriaLoader.ts               # Criteria loading
│   │   ├── evaluationNodeFactory.ts        # Node factory
│   │   ├── evaluationResult.ts             # Result handling
│   │   ├── extractors.ts                   # Content extractors
│   │   ├── index.ts                        # Main exports
│   │   └── sectionEvaluators.ts            # Section evaluators
│   ├── orchestrator/                       # Orchestrator agent
│   │   ├── __tests__/                      # Orchestrator tests
│   │   ├── prompts/                        # Prompts
│   │   ├── configuration.ts                # Configuration
│   │   ├── graph.ts                        # Graph definition
│   │   ├── nodes.ts                        # Node implementations
│   │   ├── prompt-templates.ts             # Prompt templates
│   │   └── state.ts                        # State definition
│   ├── proposal-agent/                     # Legacy proposal agent
│   │   ├── __tests__/                      # Tests
│   │   ├── prompts/                        # Prompts
│   │   ├── conditionals.ts                 # Edge conditionals
│   │   ├── configuration.ts                # Configuration
│   │   ├── graph-streaming.ts              # Streaming graph
│   │   ├── graph.ts                        # Graph definition
│   │   ├── index.ts                        # Main exports
│   │   ├── nodes-streaming.ts              # Streaming nodes
│   │   ├── nodes.ts                        # Node implementations
│   │   ├── reducers.ts                     # Reducers
│   │   ├── state.ts                        # State definition
│   │   └── tools.ts                        # Tools
│   ├── proposal-generation/                # New proposal generation
│   │   ├── __tests__/                      # Tests
│   │   ├── nodes/                          # Node implementations
│   │   │   ├── __tests__/                  # Node tests
│   │   │   ├── chatAgent.ts                # Chat agent
│   │   │   ├── document_loader.ts          # Document loader
│   │   │   ├── problem_statement.ts        # Problem statement
│   │   │   ├── processFeedback.ts          # Feedback processor
│   │   │   ├── section_manager.ts          # Section manager
│   │   │   ├── section_nodes.ts            # Section nodes
│   │   │   └── toolProcessor.ts            # Tool processor
│   │   ├── prompts/                        # Prompt templates
│   │   ├── utils/                          # Utilities
│   │   ├── conditionals.ts                 # Edge conditionals
│   │   ├── evaluation_integration.ts       # Evaluation integration
│   │   ├── graph.ts                        # Graph definition
│   │   ├── index.ts                        # Main exports
│   │   └── nodes.ts                        # Node definitions
│   ├── research/                           # Research agent
│   │   ├── __tests__/                      # Tests
│   │   ├── prompts/                        # Prompts
│   │   ├── agents.ts                       # Agent definitions
│   │   ├── index.ts                        # Main exports
│   │   ├── nodes.ts                        # Node implementations
│   │   ├── state.ts                        # State definition
│   │   └── tools.ts                        # Tools
│   ├── README.md                           # Documentation
│   └── index.ts                            # Main exports
│
├── api/                                    # API routes and handlers
│   ├── __tests__/                          # API tests
│   ├── rfp/                                # RFP-related routes
│   │   ├── __tests__/                      # RFP route tests
│   │   ├── express-handlers/               # Express handlers
│   │   ├── chat.ts                         # Chat endpoints
│   │   ├── feedback.ts                     # Feedback handling
│   │   ├── index.ts                        # Main exports
│   │   ├── interrupt-status.ts             # Interrupt status
│   │   ├── parse.ts                        # Document parsing
│   │   └── resume.ts                       # Resume flow
│   ├── README.md                           # Documentation
│   ├── express-server.ts                   # Express server
│   ├── index.ts                            # Main exports
│   └── rfp.js                              # Legacy RFP handler
│
├── config/                                 # Configuration
│   ├── evaluation/                         # Evaluation criteria
│   │   ├── connections.json                # Connections criteria
│   │   ├── research.json                   # Research criteria
│   │   ├── sections.json                   # Sections criteria
│   │   └── solution.json                   # Solution criteria
│   └── dependencies.json                   # Section dependencies
│
├── docs/                                   # Documentation
│   ├── IMPORTS_GUIDE.md                    # Import guide
│   ├── PATH_ALIAS_RESOLUTION.md            # Path resolution
│   ├── REDUNDANT_FILES.md                  # Redundant files
│   └── backend-file-structure.md           # This document
│
├── evaluation/                             # Evaluation framework
│   ├── __tests__/                          # Evaluation tests
│   ├── examples/                           # Examples
│   ├── README.md                           # Documentation
│   ├── extractors.ts                       # Content extractors
│   ├── factory.ts                          # Evaluation factory
│   └── index.ts                            # Main exports
│
├── lib/                                    # Shared libraries
│   ├── __tests__/                          # Library tests
│   ├── config/                             # Configuration
│   │   └── env.ts                          # Environment variables
│   ├── db/                                 # Database interactions
│   │   ├── __tests__/                      # Database tests
│   │   └── documents.ts                    # Document operations
│   ├── llm/                                # LLM integration
│   │   ├── __tests__/                      # LLM tests
│   │   ├── streaming/                      # Streaming support
│   │   ├── README.md                       # Documentation
│   │   ├── anthropic-client.ts             # Anthropic client
│   │   ├── context-window-manager.ts       # Context management
│   │   ├── error-handlers.ts               # Error handling
│   │   ├── loop-prevention.ts              # Loop prevention
│   │   ├── message-truncation.ts           # Message truncation
│   │   └── timeout-manager.ts              # Timeout management
│   ├── middleware/                         # Express middleware
│   │   ├── __tests__/                      # Middleware tests
│   │   ├── README.md                       # Documentation
│   │   ├── auth.js                         # Authentication
│   │   └── rate-limit.js                   # Rate limiting
│   ├── parsers/                            # Document parsers
│   │   ├── __tests__/                      # Parser tests
│   │   ├── README.md                       # Documentation
│   │   ├── pdf-parser.ts                   # PDF parser
│   │   └── rfp.ts                          # RFP parser
│   ├── persistence/                        # State persistence
│   │   ├── __tests__/                      # Persistence tests
│   │   ├── functions/                      # Database functions
│   │   ├── migrations/                     # Database migrations
│   │   ├── README.md                       # Documentation
│   │   ├── ICheckpointer.ts                # Checkpointer interface
│   │   ├── checkpointer-factory.ts         # Checkpointer factory
│   │   ├── memory-checkpointer.ts          # In-memory checkpointer
│   │   └── supabase-checkpointer.ts        # Supabase checkpointer
│   ├── supabase/                           # Supabase integration
│   │   ├── README.md                       # Documentation
│   │   ├── client.ts                       # Supabase client
│   │   └── index.ts                        # Main exports
│   ├── types/                              # Type definitions
│   │   ├── auth.ts                         # Auth types
│   │   └── feedback.ts                     # Feedback types
│   ├── utils/                              # Utility functions
│   │   ├── backoff.ts                      # Backoff utilities
│   │   ├── files.ts                        # File utilities
│   │   └── paths.ts                        # Path utilities
│   ├── database.types.ts                   # Database types
│   ├── logger.js                           # Logging utility
│   ├── schema.sql                          # Database schema
│   ├── state-serializer.ts                 # State serialization
│   └── types.ts                            # Common types
│
├── prompts/                                # Prompt templates
│   ├── evaluation/                         # Evaluation prompts
│   │   ├── connectionPairsEvaluation.ts    # Connection evaluation
│   │   ├── funderSolutionAlignment.ts      # Solution alignment
│   │   ├── index.ts                        # Main exports
│   │   ├── researchEvaluation.ts           # Research evaluation
│   │   ├── sectionEvaluation.ts            # Section evaluation
│   │   └── solutionEvaluation.ts           # Solution evaluation
│   └── generation/                         # Generation prompts
│       ├── budget.ts                       # Budget generation
│       ├── conclusion.ts                   # Conclusion generation
│       ├── index.ts                        # Main exports
│       ├── methodology.ts                  # Methodology generation
│       ├── problemStatement.ts             # Problem statement
│       ├── solution.ts                     # Solution generation
│       └── timeline.ts                     # Timeline generation
│
├── scripts/                                # Utility scripts
│   ├── setup-checkpointer.ts               # Setup script
│   └── test-checkpointer.ts                # Test script
│
├── services/                               # Business logic services
│   ├── __tests__/                          # Service tests
│   ├── DependencyService.ts                # Dependency management
│   ├── checkpointer.service.ts             # Checkpointer service
│   ├── orchestrator-factory.ts             # Orchestrator factory
│   └── orchestrator.service.ts             # Orchestrator service
│
├── state/                                  # State management
│   ├── __tests__/                          # State tests
│   │   ├── modules/                        # Module tests
│   │   ├── proposal.state.test.ts          # Proposal state tests
│   │   └── reducers.test.ts                # Reducer tests
│   ├── modules/                            # State modules
│   │   ├── annotations.ts                  # State annotations
│   │   ├── constants.ts                    # Constants
│   │   ├── reducers.ts                     # Reducer functions
│   │   ├── schemas.ts                      # State schemas
│   │   ├── types.ts                        # Type definitions
│   │   └── utils.ts                        # Utilities
│   ├── README.md                           # Documentation
│   ├── proposal.state.ts                   # Proposal state
│   └── reducers.ts                         # Reducers
│
├── tools/                                  # LangGraph tools
│   └── interpretIntentTool.ts              # Intent interpretation
│
├── __tests__/                              # Top-level tests
│   └── integration/                        # Integration tests
│
├── tests/                                  # Test files (legacy)
│
├── .env.example                            # Example environment variables
├── index.ts                                # Main entry point
├── langgraph-loader.mjs                    # LangGraph loader
├── package.json                            # Package dependencies
├── register-paths.ts                       # Path registration
├── server.ts                               # Server entry point
├── tsconfig.json                           # TypeScript configuration
└── vitest.config.ts                        # Vitest configuration
```

## Guidelines for Adding New Code

### Adding a New Agent

1. Create a new directory under `agents/<agent-name>`
2. Follow the standard structure:
   - `graph.ts` - Graph definition
   - `nodes.ts` - Node implementations
   - `state.ts` - State definition
   - `__tests__/` - Tests
3. Export the agent through `index.ts`
4. Register the agent in the appropriate service

### Adding New API Endpoints

1. **Feature-Specific Endpoints**: Add to `api/rfp/` or create a new subdirectory
2. **Express Handlers**: Implement in `express-handlers/` directory
3. Add tests in the corresponding `__tests__/` directory

### Implementing State Management

1. Define interfaces in `state/modules/types.ts`
2. Create reducers in `state/modules/reducers.ts`
3. Define annotations in `state/modules/annotations.ts`
4. Add tests for each component

### Adding LLM Integration

1. Add client implementation in `lib/llm/`
2. Implement error handling and retry logic
3. Update the LLM factory to support the new integration
4. Add comprehensive tests

## Best Practices

1. **Imports**:

   - Use relative imports within a module
   - Use path aliases (`@/`) for importing from other modules or shared code

2. **Testing**:

   - Write tests for all components
   - Place tests in `__tests__/` directories next to the components they test
   - Use descriptive test names that explain the behavior being tested

3. **Error Handling**:

   - Implement proper error handling and retries for LLM calls
   - Use the error handling utilities in `lib/llm/error-handlers.ts`
   - Log errors with appropriate context

4. **State Management**:

   - Follow immutable patterns for state updates
   - Use typed interfaces for all state objects
   - Implement and test custom reducers thoroughly

5. **Documentation**:
   - Document complex functions with JSDoc comments
   - Maintain README files for each major directory
   - Update this document when making significant structural changes

## Migration Notes

The backend is undergoing a migration from the legacy proposal-agent to the new proposal-generation implementation:

1. The `agents/proposal-agent/` directory contains the legacy implementation
2. New development should use the `agents/proposal-generation/` architecture
3. The orchestrator service handles the transition between these implementations

## References

- [LangGraph Documentation](https://langchain-ai.github.io/langgraphjs/)
- [LangChain.js Documentation](https://js.langchain.com/docs/)
- [Express.js Documentation](https://expressjs.com/)
- [Supabase Documentation](https://supabase.io/docs)
