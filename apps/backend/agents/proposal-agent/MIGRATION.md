# Migration Guide: Original to Refactored Proposal Agent

This guide helps you migrate from the original proposal agent implementation to the refactored version.

## File Mapping

| Original File | Refactored File | Description |
|---------------|-----------------|-------------|
| `nodes.ts` | `nodes-refactored.js` | Node function implementations |
| `graph.ts` | `graph-refactored.js` | Graph structure and execution |
| `index.ts` | `index-refactored.js` | Main exports |
| N/A | `prompts/index.js` | Prompt templates |
| N/A | `prompts/extractors.js` | Helper functions |

## API Changes

### Import Statements

**Original:**
```javascript
import { runProposalAgent } from "./apps/backend/agents/proposal-agent";
```

**Refactored:**
```javascript
import { runProposalAgent } from "./apps/backend/agents/proposal-agent/index-refactored.js";
```

### HTTP Endpoints

**Original:**
- POST `/api/proposal-agent`

**Refactored:**
- POST `/api/proposal-agent-refactored`

### LangGraph Studio

**Original:**
- Graph name: `proposal-agent`

**Refactored:**
- Graph name: `proposal-agent-refactored`

## Migration Steps

1. **Test both implementations side-by-side:**
   ```javascript
   import { runProposalAgent as originalAgent } from "./apps/backend/agents/proposal-agent";
   import { runProposalAgent as refactoredAgent } from "./apps/backend/agents/proposal-agent/index-refactored.js";
   
   // Compare outputs for the same input
   const originalResult = await originalAgent("Write a grant proposal for...");
   const refactoredResult = await refactoredAgent("Write a grant proposal for...");
   ```

2. **Update imports in your application:**
   Replace instances of the original import with the refactored one.

3. **Update API calls:**
   Change client applications to use the new endpoint.

4. **Update LangGraph configurations:**
   Use the refactored graph name in any LangGraph Studio configurations.

## Benefits of Migration

- **Better organization**: Prompt templates are separated from node logic
- **Improved maintainability**: Modular code is easier to update and extend
- **Enhanced type safety**: More explicit types and better documentation
- **Consistent standards**: Follows project conventions more closely

## Verification Checklist

Before completing migration, verify:

- [ ] All tests pass with the refactored implementation
- [ ] All API endpoints return expected responses
- [ ] LangGraph Studio visualizes the graph correctly
- [ ] Error handling works as expected
- [ ] Prompt templates render correctly

## Rollback Plan

If issues arise, you can easily roll back by:

1. Reverting to the original imports
2. Using the original API endpoints
3. Removing references to refactored components

## Support

If you encounter any issues during migration, please consult the README.md and REFACTOR-NOTES.md for additional information.