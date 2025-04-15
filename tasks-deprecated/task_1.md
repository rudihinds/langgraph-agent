# Task ID: 1
# Title: Set up LangGraph Project Structure
# Status: pending
# Dependencies: 
# Priority: high
# Description: Establish the foundational project structure for the LangGraph-based agent system

# Details:
[only do the parts that we don't have for smooth integration, a lot of this is already done in our app]
Create the monorepo structure with appropriate directories for agents, tools, and state. Set up TypeScript configuration, ESLint rules, and basic project scaffolding. Create initial package.json files and configure dependencies for LangGraph.js and related libraries.

The monorepo structure should follow:
- `apps/backend`: Contains the agent implementation
- `apps/web`: Contains the Next.js frontend
- `packages/shared`: Contains shared types and utilities

For the backend app:
1. Set up directory structure for agents with subfolders for each agent type
2. Configure TypeScript to work with ESM modules
3. Add proper dependencies for LangGraph.js in package.json
4. Set up ESLint with appropriate rules for TypeScript
5. Configure proper paths in tsconfig.json

For the frontend app:
1. Use Next.js with App Router
2. Set up TypeScript configuration
3. Configure API routes for agent interaction
4. Set up package.json with required dependencies
5. Configure environment variables for backend communication

For the shared package:
1. Set up project with TypeScript
2. Create structure for shared types
3. Set up utilities for common functionality
4. Configure package.json for proper inclusion in workspaces

Configure the root package.json with workspaces and development scripts.

# Test Strategy:
1. Verify directory structure follows the specified pattern
2. Ensure TypeScript compilation works with `tsc --noEmit`
3. Confirm ESLint runs successfully with `eslint .`
4. Verify that dependencies can be installed with the chosen package manager
5. Run a simple test to ensure imports work correctly between packages
6. Confirm the development server can be started for both frontend and backend