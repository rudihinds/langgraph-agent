# Proposal Agent System - Initial Tasks

## Phase 1: Project Setup (Week 1)

### Environment Setup

- [x] Initialize Next.js project using create-agent-chat-app
- [x] Set up TypeScript configuration
- [x] Configure ESLint and Prettier
- [x] Create GitHub repository with proper branching strategy
- [x] Restructure project into monorepo (apps/backend, apps/web, packages/shared)
- [x] Configure root package.json for workspaces
- [x] Configure root tsconfig.json for monorepo paths

### Supabase Configuration

- [x] Create Supabase project
- [x] Configure authentication with Google OAuth
- [x] Design and create database schema:
  - [x] Users table
  - [x] Proposals table
  - [x] Proposal states table
  - [x] Proposal documents table
- [x] Set up Row Level Security policies
- [x] Create Supabase Storage bucket for proposal documents
- [x] Configure Storage bucket permissions
- [x] Test authentication flow

### LangGraph Initial Setup

- [x] Install LangGraph.js and related dependencies
- [ ] Set up basic state annotation structure
- [x] Create test harness for LangGraph components (Vitest)
- [x] Configure API keys for LLM services
- [x] Test basic LLM connectivity
- [x] Fix ESM compatibility issues in agent files

### Frontend Integration with create-agent-chat-app

- [x] Integrate `apps/web` Next.js frontend into monorepo
- [x] Connect backend API to frontend (basic server setup)
- [x] Set up environment variables for frontend-backend communication
- [ ] Adapt the chat interface for proposal agent interactions
- [x] Integrate Supabase authentication with the frontend (basic setup)
- [x] Test end-to-end communication between frontend and backend (basic health check, agent endpoints)

## Phase 2: Core Infrastructure (Week 2)

### Authentication Implementation

- [x] Configure Supabase Auth helpers in Next.js frontend (basic getCurrentUser, signIn, signOut)
- [x] Create login page with Supabase UI (placeholder, needs Supabase UI components)
- [x] Implement protected routes using Next.js middleware
- [x] Set up user session management (basic session check in middleware)
- [x] Create user profile display component (`UserAvatar`)
- [x] Handle authentication state in the UI (`Header`, Homepage buttons)
- [x] Implement token refresh and session persistence
- [x] Test authentication flow end-to-end

### Persistence Layer

- [ ] Create custom Supabase checkpoint adapter for LangGraph
- [ ] Implement serialization/deserialization for complex state
- [ ] Create proposal state management functions
- [ ] Test persistence and state recovery
- [ ] Implement session management

### Basic UI Setup

- [x] Create basic application layout (`RootLayout`, `Header`)
- [x] Create basic Homepage (`page.tsx`)
- [ ] Create proposal dashboard layout
- [ ] Design and implement proposal listing view
- [ ] Create proposal creation flow
- [ ] Design chat interface for agent interaction
- [ ] Implement file upload for RFP documents

## Phase 3: Agent Foundation (Week 3)

### Tool Implementation

- [ ] Create Deep Research Tool using Claude 3 Opus
- [ ] Test research tool with sample RFPs
- [ ] Implement Vector Store integration with Pinecone
- [ ] Create embeddings generation pipeline
- [ ] Build tool access framework for agents

### Research Subgraph

- [ ] Implement RFP analysis node
- [ ] Create deep research generation node
- [ ] Build solution sought analysis node
- [ ] Add human-in-the-loop feedback mechanism
- [ ] Test research flow with sample inputs

### Connection Pairs Subgraph

- [ ] Implement connection pairs generation node
- [ ] Create evaluation mechanisms
- [ ] Build user feedback loop
- [ ] Test with sample data

## Phase 4: Proposal Generation (Week 4)

### Proposal Manager Framework

- [ ] Implement section dependency resolver
- [ ] Create scheduling logic for section generation
- [ ] Build progress tracking mechanisms
- [ ] Implement evaluator node framework
- [ ] Test sequence generation

### Section Generation Subgraphs

- [ ] Implement Problem Statement generator
- [ ] Create Solution generator
- [ ] Build Organizational Capacity generator
- [ ] Implement remaining section generators
- [ ] Test quality evaluation integration
- [ ] Create revision loops

## Phase 5: Integration & Testing (Week 5)

### Main Orchestrator Implementation

- [ ] Create main StateGraph structure
- [ ] Integrate all subgraphs
- [ ] Implement conditional routing
- [ ] Add error handling and recovery
- [ ] Test complete flow

### UI Integration

- [ ] Connect UI components to LangGraph states
- [ ] Implement streaming for real-time updates
- [ ] Create progress visualization
- [ ] Add structured feedback collection
- [ ] Test user flows end-to-end

### Final Proposal Output

- [ ] Create proposal compilation node
- [ ] Implement markdown generation
- [ ] Add file export functionality
- [ ] Test output quality and format

## Phase 6: Refinement & Launch (Week 6)

### Performance Optimization

- [ ] Analyze and optimize LLM prompts
- [ ] Implement caching where appropriate
- [ ] Optimize database queries
- [ ] Reduce latency in critical paths

### User Testing

- [ ] Conduct internal user testing
- [ ] Gather and address feedback
- [ ] Fix identified issues
- [ ] Improve usability

### Documentation & Deployment

- [ ] Create user documentation
- [ ] Document API and architecture
- [ ] Prepare production environment
- [ ] Configure monitoring and alerting
- [ ] Deploy MVP to production

# LangGraph Agent Tasks

## Environment Setup

- [x] Configure TypeScript
- [x] Set up ESLint
- [x] Set up testing framework (Vitest)
- [x] Create necessary project directories (monorepo structure)
- [x] Configure environment variables

## Basic Agent Implementation

- [x] Create test file for ESM module imports
- [x] Create basic test for LangGraph functionality
- [x] Create mock for OpenAI
- [x] Ensure tests run successfully

## Discovered During Work (April 2)

- [x] Switch from Jest to Vitest for better ESM support
- [x] Create mock for OpenAI API calls in tests
- [x] Remove Jest configuration files after successful switch to Vitest
- [x] Fix `require.main === module` checks for ESM compatibility in agent files
- [x] Fix `use client` directive issues in Next.js components
- [x] Restructure project into a monorepo with `apps` and `packages`
- [x] Create `packages/shared` for common types/utils
- [x] Resolve initial linting errors (unused variables)

## Discovered During Work (May 3)

- [x] Implement E2E authentication testing using Playwright
- [x] Create auth-helpers.ts utility for mocking Supabase authentication
- [x] Add data-testid attributes to UI components for better test reliability
- [x] Implement test debugging utilities for authentication flow
- [x] Create comprehensive E2E tests for redirects, protected routes, and authentication UI
- [x] Debug and refine authentication mocking strategy for reliable tests

## Next Steps

- [x] Implement a basic agent with LangGraph
- [x] Create a simple tool for the agent
- [x] Add state management
- [ ] Resolve remaining linting issues (missing types, `any` usage)
- [ ] Implement Supabase UI components for login
- [ ] Create a human-in-the-loop interface
- [ ] Implement persistence layer
