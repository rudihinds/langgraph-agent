/**
 * This script registers TypeScript path aliases for runtime
 * so that imports like @/lib/x work with tsx and direct execution.
 * Enhanced for compatibility with LangGraph and ESM modules.
 */
import { register } from "tsconfig-paths";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as fs from "fs";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tsconfigPath = resolve(__dirname, "tsconfig.json");

// Initialize the exports with default values
let registeredPaths: Record<string, string[]> = {};
let baseUrl: string = __dirname;

try {
  // Load tsconfig.json
  const tsconfigRaw = fs.readFileSync(tsconfigPath, "utf8");
  const tsconfig = JSON.parse(tsconfigRaw);

  // Create a more robust path mapping that explicitly handles .js extensions
  const paths = { ...tsconfig.compilerOptions.paths };
  const enhancedPaths: Record<string, string[]> = {};

  // Process each path to ensure .js extensions are properly handled
  Object.entries(paths).forEach(([key, value]) => {
    // Store the original path mapping
    enhancedPaths[key] = value as string[];

    // If the key doesn't end with .js, add an additional mapping for .js extension
    if (!key.endsWith(".js*")) {
      const jsKey = key.endsWith("*") ? key.replace("*", ".js*") : `${key}.js`;

      enhancedPaths[jsKey] = (value as string[]).map((path) =>
        path.endsWith("*") ? path : `${path}.js`
      );
    }
  });

  // Register the paths with explicit configuration
  register({
    baseUrl: resolve(__dirname, tsconfig.compilerOptions.baseUrl),
    paths: enhancedPaths,
    // Add explicit extension handling for ESM
    addMatchAll: true,
  });

  // Log success with more details to help troubleshooting
  console.log("✅ TypeScript path aliases registered for runtime");
  console.log(
    `  - Base URL: ${resolve(__dirname, tsconfig.compilerOptions.baseUrl)}`
  );
  console.log(`  - Registered paths:`);
  Object.keys(enhancedPaths).forEach((key) => {
    console.log(`    - ${key} => ${enhancedPaths[key]}`);
  });

  // Update the exports
  registeredPaths = enhancedPaths;
  baseUrl = resolve(__dirname, tsconfig.compilerOptions.baseUrl);
} catch (error) {
  console.error("❌ Failed to register TypeScript path aliases:", error);
  console.error("This might cause import errors with @/ path aliases.");
}

// Export the values
export { registeredPaths, baseUrl };
