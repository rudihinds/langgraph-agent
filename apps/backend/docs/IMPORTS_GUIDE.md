# Import Path Guide for the LangGraph Agent Project

This guide explains how to properly handle imports in this project to avoid the common path resolution issues.

## Key Rules

### 1. Always use `.js` extensions in imports, even for TypeScript files

```typescript
// ✅ CORRECT
import { foo } from "./bar.js";
import { baz } from "@/state/modules/types.js";

// ❌ INCORRECT
import { foo } from "./bar";
import { foo } from "./bar.ts";
```

This is required because:

- We use `"module": "NodeNext"` and `"type": "module"` (ESM)
- ESM requires explicit file extensions
- TypeScript preserves these import paths during compilation

### 2. Use path aliases instead of complex relative paths

```typescript
// ✅ PREFERRED
import { createProposalGenerationGraph } from "@/proposal-generation/graph.js";

// ⚠️ AVOID (error-prone)
import { createProposalGenerationGraph } from "../../../agents/proposal-generation/graph.js";
```

Available path aliases:

- `@/lib/*` - Utilities and shared code
- `@/state/*` - State definitions and reducers
- `@/agents/*` - Agent implementations
- `@/tools/*` - Tool implementations
- `@/services/*` - Service implementations
- `@/api/*` - API routes and handlers
- `@/prompts/*` - Prompt templates
- `@/tests/*` - Test utilities
- `@/config/*` - Configuration files
- `@/utils/*` - Utility functions (shortcut to lib/utils)
- `@/types/*` - Type definitions
- `@/proposal-generation/*` - Proposal generation agent
- `@/evaluation/*` - Evaluation agent
- `@/orchestrator/*` - Orchestrator agent

### 3. Use the paths utility for consistent imports

We've created a paths utility to standardize import paths:

```typescript
import { STATE, AGENTS, LANGGRAPH } from '@/utils/paths.js';

// Then use the constants
import { OverallProposalState } from STATE.TYPES;
import { createProposalGenerationGraph } from AGENTS.PROPOSAL_GENERATION.GRAPH;
```

This approach:

- Centralizes path definitions
- Makes it easier to update paths if needed
- Provides autocomplete for available modules

### 4. Testing Considerations

In test files:

- Use the same import conventions as in production code
- Mock modules using the exact same path as the import
- For vitest mocks, use the same path structure:

```typescript
// If importing from '../graph.js'
vi.mock("../graph.js", () => ({
  createProposalGenerationGraph: vi.fn(),
}));
```

### 5. Module Resolution Debugging

If you're experiencing import issues:

1. Check that you're using `.js` extensions in imports
2. Verify that the path alias is configured in both:
   - `tsconfig.json` under `paths`
   - `vitest.config.ts` under `resolve.alias`
3. Try using an absolute path with `@/` prefix
4. Make sure the target file exists at the path you're importing from
5. Restart TypeScript server if using VS Code

### 6. Common Errors and Solutions

| Error                                 | Likely Cause                     | Solution                              |
| ------------------------------------- | -------------------------------- | ------------------------------------- |
| `Cannot find module './foo'`          | Missing `.js` extension          | Add `.js` extension                   |
| `Cannot find module '@/foo'`          | Path alias not configured        | Check path alias configuration        |
| `Duplicate identifier 'foo'`          | Multiple imports of same name    | Rename import or use namespace import |
| `Cannot read properties of undefined` | Import isn't working as expected | Check mock implementation             |
