/**
 * Custom ESM Loader for resolving TypeScript path aliases
 * This file must be in CommonJS (.cjs) format
 */

const { readFileSync, existsSync } = require("fs");
const { resolve, dirname, join } = require("path");
const { builtinModules } = require("module");
const tsConfigPaths = require("tsconfig-paths");

// Get the project root directory
const projectRoot = resolve(__dirname);

// Read the TypeScript configuration
const tsconfigPath = resolve(projectRoot, "tsconfig.json");
const tsConfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));

// Create a path matcher function using tsconfig-paths
const matchPath = tsConfigPaths.createMatchPath(
  resolve(projectRoot, tsConfig.compilerOptions.baseUrl),
  tsConfig.compilerOptions.paths
);

// Define specific path mappings for known problematic imports
const specificMappings = {
  "../../lib/utils/logger.js": "../lib/logger.js",
};

// Log registration for troubleshooting
console.log("✅ ESM path aliases registered for runtime");
console.log(
  `  - Base URL: ${resolve(projectRoot, tsConfig.compilerOptions.baseUrl)}`
);
console.log(
  `  - Registered paths: ${Object.keys(tsConfig.compilerOptions.paths).join(", ")}`
);
console.log(`  - Added specific mappings for common import paths`);

/**
 * Custom hook for Node.js ESM loader
 * This resolves imports that use TypeScript path aliases
 */
module.exports = function (url, context, defaultResolver) {
  // Skip node built-in modules
  if (builtinModules.includes(url)) {
    return defaultResolver(url, context);
  }

  // Check for specific mappings first
  if (specificMappings[url]) {
    const parentDir = dirname(context.parentURL.replace("file://", ""));
    const mappedPath = join(parentDir, specificMappings[url]);

    if (
      existsSync(mappedPath) ||
      existsSync(mappedPath + ".js") ||
      existsSync(mappedPath + ".ts")
    ) {
      return defaultResolver(mappedPath, context);
    }
  }

  // Check if the import uses a path alias
  if (url.startsWith("@/")) {
    const resolvedPath = matchPath(url);
    if (resolvedPath) {
      // Return resolved path (adding .js extension if needed for ESM)
      return defaultResolver(resolvedPath, context);
    }
  }

  // Use default resolution for all other imports
  return defaultResolver(url, context);
};
