# Import Pattern Specification

## Overview

This document outlines the standardized approach for handling imports in the LangGraph Agent project. Following these guidelines will ensure consistent, error-free code that works properly with Node.js ESM modules.

## Core Requirements

Our project uses:

- ES Modules (`"type": "module"` in package.json)
- TypeScript with `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`
- Node.js for backend execution

## Import Path Rules

1. **Relative Imports (from your own files)**

   ```typescript
   // ✅ CORRECT: Include file extension for relative imports
   import { ResearchState } from "./state.js";
   import { documentLoader } from "./nodes.js";
   import { SupabaseCheckpointer } from "../../lib/state/supabase.js";

   // ❌ INCORRECT: Missing file extension
   import { ResearchState } from "./state";
   import { documentLoader } from "./nodes";
   import { SupabaseCheckpointer } from "../../lib/state/supabase";
   ```

2. **Package Imports (from node_modules)**

   ```typescript
   // ✅ CORRECT: No file extension needed for package imports
   import { StateGraph } from "@langchain/langgraph";
   import { ChatAnthropic } from "@langchain/anthropic";
   import { z } from "zod";
   ```

3. **TypeScript Type Imports**

   ```typescript
   // ✅ CORRECT: Use explicit type imports when only importing types
   import type { ResearchState } from "./state.js";
   ```

4. **Index Files**

   ```typescript
   // ✅ CORRECT: Include index.js for explicit directory imports
   import { deepResearchPrompt } from "./prompts/index.js";

   // ✅ ALSO CORRECT: Directory imports are automatically resolved to index.js
   import { deepResearchPrompt } from "./prompts/index.js";
   ```

## Rationale

1. **ESM Compatibility**: Node.js ESM requires file extensions in relative imports
2. **Predictable Resolution**: Explicit extensions make resolution behavior predictable
3. **TypeScript Integration**: TypeScript with NodeNext module resolution enforces this pattern
4. **Error Prevention**: Following these rules prevents "Cannot find module" errors

## Implementation Guidelines

1. **Updating Existing Code**

   When updating imports in existing files:

   - Add `.js` extension to all relative imports
   - Keep package imports (from node_modules) as-is
   - Update any imports from index files to be explicit

2. **IDE Configuration**

   Configure your IDE to automatically add extensions:

   - VS Code: Add `"javascript.preferences.importModuleSpecifierEnding": "js"` and `"typescript.preferences.importModuleSpecifierEnding": "js"` to settings
   - Other IDEs: Look for similar settings related to import module specifiers

3. **Linting**

   Add ESLint rules to enforce these patterns:

   ```json
   "rules": {
     "import/extensions": [
       "error",
       "ignorePackages",
       {
         "js": "never",
         "ts": "never"
       }
     ]
   }
   ```

## Project-Specific Notes

For our LangGraph Agent project:

1. All `research` directory files consistently use `.js` extensions in imports
2. The agent files in other directories should follow the same pattern
3. Utilities and shared code in `lib` directories should be imported with `.js` extensions

## Examples from Project Code

**Example 1: nodes.ts (correct pattern)**

```typescript
import { HumanMessage } from "@langchain/core/messages";
import { ResearchState } from "./state.js";
import {
  createDeepResearchAgent,
  createSolutionSoughtAgent,
} from "./agents.js";
import { DocumentService } from "../../lib/db/documents.js";
import { parseRfpFromBuffer } from "../../lib/parsers/rfp.js";
import { Logger } from "../../logger.js";
```

**Example 2: index.ts (needs updating)**

```typescript
// Change this:
import { ResearchStateAnnotation, ResearchState } from "./state";
import { documentLoader, deepResearch, solutionSought } from "./nodes";
import { SupabaseCheckpointer } from "../../lib/state/supabase";
import { pruneMessageHistory } from "../../lib/state/messages";
import { logger } from "../logger";

// To this:
import { ResearchStateAnnotation, ResearchState } from "./state.js";
import { documentLoader, deepResearch, solutionSought } from "./nodes.js";
import { SupabaseCheckpointer } from "../../lib/state/supabase.js";
import { pruneMessageHistory } from "../../lib/state/messages.js";
import { logger } from "../logger.js";
```

## Conclusion

Following these import patterns will ensure consistent code that works with modern ES Module systems while preventing common import-related errors. This standard should be applied across all project files to maintain consistency and reliability.

## Implementation Guide

To update the codebase to follow these import patterns:

1. **Update all relative imports** to include `.js` extensions:

   ```typescript
   // From
   import { ResearchState } from "./state";
   // To
   import { ResearchState } from "./state.js";
   ```

2. **Check import statements** in each file:

   - Priority files are `index.ts` files in each agent directory as they define the main exports
   - Node function files (`nodes.ts`) that may import from other agent files
   - State files (`state.ts`) that define interfaces and annotations

3. **Verify agent graphs compile correctly** after import updates

   - Run tests to ensure the agent continues to function as expected
   - Check for runtime errors related to module resolution

4. **Add ESLint rule** to prevent future extension omissions:

   ```javascript
   // .eslintrc.js
   rules: {
     "import/extensions": ["error", "ignorePackages"]
   }
   ```

5. **Update documentation** to reflect the import pattern requirements, especially for onboarding new developers

6. **Run import validators** across the codebase to catch any missed imports

## Project-Specific Notes

In this project, we have observed mixed import patterns:

Example from `apps/backend/agents/research/nodes.ts` (correct):

```typescript
import { ResearchState } from "./state.js";
import { DocumentService } from "../../lib/db/documents.js";
```

Example from `apps/backend/agents/research/index.ts` (incorrect):

```typescript
import { ResearchStateAnnotation, ResearchState } from "./state";
import { documentLoader, deepResearch, solutionSought } from "./nodes";
```

The specification above aims to standardize all imports to the correct pattern.
