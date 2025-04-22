// register-paths.js - TSConfig paths registration for development
import { register } from "tsconfig-paths";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read tsconfig.json
const tsconfigPath = resolve(__dirname, "tsconfig.json");
const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));

// Register path aliases
register({
  baseUrl: resolve(__dirname, tsconfig.compilerOptions.baseUrl || "."),
  paths: tsconfig.compilerOptions.paths || {},
});

console.log("✅ TSConfig path aliases registered for development");
