# Dependency Upgrade Plan

## Overview

This document outlines a step-by-step approach to addressing TypeScript errors found after upgrading to LangGraph 0.2.65 (current version in package.json) and related dependencies. To be clear, **we are NOT downgrading back to 0.0.63** - that version had severe checkpointer issues which is why we upgraded in the first place. Instead, this plan focuses on fixing the TypeScript errors while maintaining the upgraded versions.

## Current Status

- **Already Upgraded**: LangGraph has already been upgraded from 0.0.63 to 0.2.65
- **Build Errors**: Running `npm run build` with the upgraded packages produced 406 TypeScript errors across 48 files
- **Runtime Success**: Despite build errors, the application still runs, especially with our new robust fallback checkpointer

## Current Issues

Most errors are related to:

1. Changes in type definitions between versions
2. Import path requirements (explicit `.js` extensions needed)
3. Renamed or restructured APIs within updated packages
4. Deprecated methods and functions

## Incremental Approach

### Phase 1: Address Import Path Issues

**Goal:** Fix the import path issues (e.g., explicit `.js` extensions)

1. Install [typescript-plugin-css-modules](https://github.com/mrmckeb/typescript-plugin-css-modules) to help catch these issues at development time
2. Update tsconfig.json to require explicit file extensions: `"moduleResolution": "node16"` or `"nodenext"`
3. Search for import statements that need explicit extensions:
   ```
   grep -r "import.*from.*[^\.js]';" --include="*.ts" apps/backend/
   ```
4. Fix imports systematically, file by file

### Phase 2: Core Package Type Fixes

**Goal:** Address TypeScript issues with LangGraph and core packages one at a time

1. **LangGraph Type Fixes**

   - Identify and fix StateGraph instantiation patterns
   - Fix checkpointer-related type errors
   - Update imports to match new module paths

2. **LangChain Core Type Fixes**

   - Fix message type imports and usages
   - Update tool definitions to match new API
   - Address any core utility type errors

3. **OpenAI Package Type Fixes**

   - Fix model instantiation and call patterns
   - Update message formatting for the API
   - Fix any streaming implementation errors

4. **Community Package Type Fixes**
   - Address any type errors for community components
   - Fix deprecated method usages

### Phase 3: Address API Changes

**Goal:** Fix implementation changes and renamed/moved APIs

1. **State Graph API Changes:**

   - Update all StateGraph instantiations to match the new patterns
   - Fix node definitions to match new type requirements
   - Implement proper generics for typings

2. **Checkpointer Changes:**

   - Update our checkpointer implementations to match the new BaseCheckpointSaver interface
   - Implement missing methods: serde, getTuple, putWrites, getNextVersion

3. **Prompt Interface Updates:**
   - Update any prompt formatting that has changed between versions
   - Fix message content format changes

### Phase 4: Compilation and Testing

**Goal:** Ensure the system compiles and functions correctly

1. **Fix Remaining Type Errors:**

   - Address any lingering TypeScript errors
   - Refactor code where necessary to match new API patterns

2. **Test with Memory Checkpointer:**

   - Verify system works with in-memory checkpointing
   - Test all LangGraph integrations

3. **Test with PostgreSQL Checkpointer:**
   - Test with our robust fallback checkpointer
   - Verify database connection and error handling works correctly

## Troubleshooting Common Errors

### Import Path Issues

- Error: `Relative import paths need explicit file extensions in ECMAScript imports`
- Solution: Add `.js` extension to all imports (even for TypeScript files): `import { foo } from './bar.js'`

### Type Definition Changes

- Error: `Type 'X' is not assignable to type 'Y'`
- Solution: Check documentation for the new type definitions and update implementations accordingly

### Missing Properties

- Error: `Property 'X' does not exist on type 'Y'`
- Solution: Consult package documentation for renamed methods or restructured classes

### Method Signature Changes

- Error: `Argument of type 'X' is not assignable to parameter of type 'Y'`
- Solution: Update method calls to match new parameter requirements

## References

- [LangGraph v0.2 Documentation](https://langchain-ai.github.io/langgraphjs)
- [LangChain.js v0.3 Documentation](https://js.langchain.com/docs/versions/v0_3)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
