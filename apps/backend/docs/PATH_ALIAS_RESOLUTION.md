# TypeScript Path Alias Resolution for LangGraph

This document explains the implementation of TypeScript path alias resolution for LangGraph in our project. It provides a detailed guide on how the solution works and how to restore it if issues occur in the future.

## Problem Overview

LangGraph CLI has difficulty with TypeScript path aliases (like `@/state/*`) when running our application, resulting in errors like:

```
Error: Cannot find package '@/state' imported from ...
```

This happens because:

1. TypeScript path aliases are a compile-time feature that requires runtime support
2. ES Modules (used with `"type": "module"` in package.json) require specific handling for path aliases
3. LangGraph CLI launches TypeScript files directly without proper path resolution

## Solution Architecture

We've implemented a custom ES Module loader that intercepts import statements at runtime and resolves path aliases to their actual file paths. The solution consists of three main components:

### 1. Custom ES Module Loader (`langgraph-loader.mjs`)

This is the core component that handles path alias resolution. It:

- Reads the TypeScript configuration to understand path mappings
- Intercepts import statements at runtime
- Translates path aliases to actual file paths
- Supports multiple file extensions (.ts, .tsx, .js) and index files

### 2. LangGraph Configuration (`langgraph.json`)

Updated to use our custom loader via `node_options`.

### 3. NPM Scripts in `package.json`

Modified to explicitly set the loader when starting LangGraph.

### 4. Starter Script (`langgraph-start.mjs`)

A custom script that initializes path aliases and starts the LangGraph server.

## Implementation Details

### Custom ES Module Loader (`apps/backend/langgraph-loader.mjs`)

The loader performs these tasks:

1. Loads the `tsconfig.json` to get path mappings
2. Creates absolute path mappings for each alias
3. Provides a `resolve` function that:
   - Has special handling for the most common problem path (`@/state/proposal.state.js`)
   - Checks various file extensions when resolving aliases
   - Falls back to the next resolver for non-alias paths
4. Logs initialization information for debugging

```javascript
// Core function that resolves import specifiers
export function resolve(specifier, context, nextResolve) {
  // Special case for common problem path
  if (specifier === "@/state/proposal.state.js") {
    const directPath = resolvePath(baseDir, "state/proposal.state.ts");
    return nextResolve(directPath);
  }

  // Handle path alias patterns
  if (specifier.startsWith("@/")) {
    // Implementation details...
  }

  // For non-alias paths, let the next resolver handle it
  return nextResolve(specifier);
}
```

### LangGraph Configuration (`langgraph.json`)

```json
{
  "graphs": {
    "proposal-generation": "apps/backend/agents/proposal-generation/graph.ts:createProposalGenerationGraph",
    "proposal-agent": "apps/backend/agents/proposal-generation/graph.ts:createProposalGenerationGraph"
  },
  "env": ".env",
  "static_dir": "apps/backend/public",
  "require": ["apps/backend/register-paths.ts"],
  "node_options": "--loader ./apps/backend/langgraph-loader.mjs"
}
```

The key addition is the `node_options` field, which tells LangGraph to use our custom loader.

### NPM Scripts (`package.json`)

```json
"scripts": {
  "dev:agents": "NODE_OPTIONS=\"--loader ./apps/backend/langgraph-loader.mjs\" npx @langchain/langgraph-cli dev --port 2024 --config langgraph.json",
  "dev:agents:custom": "node apps/backend/langgraph-start.mjs",
  "dev:legacy-agents": "node apps/backend/langgraph-start.mjs"
}
```

These scripts ensure that the proper loader is used when starting the LangGraph server.

### Starter Script (`apps/backend/langgraph-start.mjs`)

This script provides additional path alias support using `tsconfig-paths` and then launches the LangGraph CLI with our custom loader.

```javascript
// Start LangGraph server with the custom loader
const serverProcess = spawn(
  "npx",
  [
    "@langchain/langgraph-cli",
    "dev",
    "--port",
    "2024",
    "--config",
    "langgraph.json",
  ],
  {
    stdio: "inherit",
    cwd: resolve(__dirname, "../.."),
    env: {
      ...process.env,
      NODE_OPTIONS:
        "--loader ./apps/backend/langgraph-loader.mjs --experimental-specifier-resolution=node --experimental-modules",
    },
  }
);
```

## How to Verify It's Working

When running the LangGraph server, you should see log messages like:

```
✅ LangGraph custom loader initialized with path aliases
📂 Base directory: /path/to/your/project/apps/backend
```

If the server starts without path alias errors, the solution is working.

## Troubleshooting Guide

### Common Issues and Solutions

1. **Cannot find package '@/state'**

   - Verify the custom loader is being used (check for the initialization message)
   - Check if the path mapping in tsconfig.json matches the actual directory structure
   - Add the specific path as a special case in the loader

2. **Cannot find module './langgraph-loader.mjs'**

   - Ensure the file exists at the correct path
   - Check the path specified in NODE_OPTIONS and langgraph.json

3. **Unexpected token 'export'**

   - Ensure Node.js version supports ES modules
   - Verify package.json has `"type": "module"`

4. **Issues with specific path aliases**
   - Add them as special cases in the loader:
   ```javascript
   if (specifier === "@/problematic/path.js") {
     return nextResolve(resolvePath(baseDir, "actual/path/file.ts"));
   }
   ```

### How to Add Support for Additional File Types

To support more file extensions, add additional checks in the resolution logic:

```javascript
// Check for JSON files
const jsonPath = resolvePath(baseDir, `${normalizedPath}.json`);
if (fs.existsSync(jsonPath)) {
  return nextResolve(jsonPath);
}
```

## How to Restore/Recreate This Solution

If you need to restore or recreate this solution:

1. **Recreate the custom loader**:

   ```bash
   # Create the loader file
   touch apps/backend/langgraph-loader.mjs
   ```

   Then copy the loader implementation from this repository.

2. **Update langgraph.json**:
   Add the `node_options` field to use the loader.

3. **Update package.json scripts**:
   Modify the `dev:agents` scripts to use the custom loader.

4. **Create/update the starter script**:
   If needed, update `langgraph-start.mjs` to match the implementation described.

5. **Test the implementation**:
   Run `npm run dev:agents` or `npm run dev:agents:custom` and verify the loader initialization message appears without path alias errors.

## Maintenance Notes

- This solution uses Node.js's experimental loader API, which may change in future Node.js versions
- If you add new path aliases to tsconfig.json, the loader will automatically pick them up
- For optimal performance in production, consider building your TypeScript files to JavaScript with resolved aliases

## References

- [Node.js Custom Loaders Documentation](https://nodejs.org/api/esm.html#loaders)
- [TypeScript Path Aliases](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping)
- [LangGraph CLI Documentation](https://js.langchain.com/docs/langgraph/)
