# Import Pattern Migration: Next Steps

## Completed Work

1. **Documentation**
   - Created `IMPORT_PATTERN_SPEC.md` with detailed rules for ES Module imports
   - Updated READMEs for the Research Agent with correct import examples
   - Updated READMEs for the Orchestrator Agent with correct import examples 
   - Updated the main Agents README with standardized import patterns

2. **Code**
   - Started updating import statements in Research Agent's `index.ts`
   - Identified key issues with the current import patterns

## Next Steps

1. **Fix Remaining Import Statements**
   - Update all relative imports in agent files to include `.js` extensions
   - Priority order:
     1. `index.ts` files in each agent directory
     2. `nodes.ts` files with cross-references
     3. `state.ts` files with type definitions
     4. Supporting files (tools, agents, etc.)

2. **Address LangGraph API Changes**
   - Some errors in the Research Agent suggest API changes in LangGraph
   - Review current LangGraph documentation to update graph construction
   - Update the `StateGraph` instantiation pattern
   - Fix edge definition syntax

3. **Test Suite Updates**
   - Run tests after import pattern changes to verify functionality
   - Update test imports to match the new pattern

4. **Linting Configuration**
   - Add ESLint rule for enforcing file extensions in imports
   - Consider adding a script to automatically fix import patterns

5. **Developer Documentation**
   - Create onboarding documentation for new developers
   - Add a section about import patterns to CONTRIBUTING.md

## Testing Strategy

1. Run unit tests for each agent after import updates
2. Manually test agent flows to ensure correct functionality
3. Verify that serialization/deserialization with Supabase works correctly

## Potential Issues

1. **Runtime vs. Compile-Time**: TypeScript may compile successfully but Node.js may still have runtime issues
2. **Circular Dependencies**: Import pattern changes might expose circular dependency issues
3. **Third-Party Libraries**: Some libraries might have incompatibilities with ES Module imports

## Timeline

- **Phase 1**: Fix Research Agent imports (highest priority)
- **Phase 2**: Fix Orchestrator Agent imports
- **Phase 3**: Fix Proposal Agent imports
- **Phase 4**: Update remaining agent imports
- **Phase 5**: Add linting rules and validation

## Resources

- [Node.js ESM Documentation](https://nodejs.org/api/esm.html)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [LangGraph.js Documentation](https://langchain-ai.github.io/langgraphjs/)