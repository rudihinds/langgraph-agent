/**
 * Custom ES Module Loader for LangGraph
 *
 * This loader resolves TypeScript path aliases (@/...) to their actual paths.
 * It's specifically designed to work with LangGraph CLI to ensure consistent imports.
 */

import { resolve as resolvePath, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load tsconfig.json for path mappings
const tsconfigPath = resolvePath(__dirname, "tsconfig.json");
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
const { paths, baseUrl } = tsconfig.compilerOptions;

// Base directory for resolving paths
const baseDir = resolvePath(__dirname, baseUrl || ".");

// Convert tsconfig paths to absolute path mappings
const pathMappings = {};
Object.entries(paths).forEach(([alias, targets]) => {
  // Remove trailing /* from both alias and targets
  const cleanAlias = alias.endsWith("/*") ? alias.slice(0, -2) : alias;

  // Get the first target path and remove trailing /*
  const target = targets[0];
  const cleanTarget = target.endsWith("/*") ? target.slice(0, -2) : target;

  // Store the mapping
  pathMappings[cleanAlias] = resolvePath(baseDir, cleanTarget);
});

/**
 * Custom resolver for ESM imports
 */
export function resolve(specifier, context, nextResolve) {
  // Special case for the most common problem path
  if (specifier === "@/state/proposal.state.js") {
    const directPath = resolvePath(baseDir, "state/proposal.state.ts");
    return nextResolve(directPath);
  }

  // Handle path alias patterns
  if (specifier.startsWith("@/")) {
    // Remove the @/ prefix
    const pathWithoutPrefix = specifier.slice(2);

    // Handle path with .js extension (common in ESM imports)
    const normalizedPath = pathWithoutPrefix.endsWith(".js")
      ? pathWithoutPrefix.slice(0, -3)
      : pathWithoutPrefix;

    // Check for TypeScript file
    const tsPath = resolvePath(baseDir, `${normalizedPath}.ts`);
    if (fs.existsSync(tsPath)) {
      return nextResolve(tsPath);
    }

    // Check for TypeScript JSX file
    const tsxPath = resolvePath(baseDir, `${normalizedPath}.tsx`);
    if (fs.existsSync(tsxPath)) {
      return nextResolve(tsxPath);
    }

    // Check for JavaScript file
    const jsPath = resolvePath(baseDir, `${normalizedPath}.js`);
    if (fs.existsSync(jsPath)) {
      return nextResolve(jsPath);
    }

    // Check for directory with index file
    const indexTsPath = resolvePath(baseDir, `${normalizedPath}/index.ts`);
    if (fs.existsSync(indexTsPath)) {
      return nextResolve(indexTsPath);
    }

    // Try direct path as fallback
    const directPath = resolvePath(baseDir, normalizedPath);
    if (fs.existsSync(directPath)) {
      return nextResolve(directPath);
    }

    // Log error for debugging
    console.error(`[Error] Could not resolve path alias: ${specifier}`);
    console.error(`Tried looking for:
      - ${tsPath}
      - ${tsxPath}
      - ${jsPath}
      - ${indexTsPath}
      - ${directPath}`);
  }

  // For non-alias paths, let the next resolver handle it
  return nextResolve(specifier);
}

// Log that the loader has been initialized
console.log("✅ LangGraph custom loader initialized with path aliases");
console.log("📂 Base directory:", baseDir);
