import tsConfigPaths from "tsconfig-paths";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read tsconfig.json manually since we can't use require in ESM
const tsConfigPath = path.join(__dirname, "..", "tsconfig.json");
const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, "utf8"));

// Calculate the base URL relative to the current directory
const baseUrl = path.join(__dirname, "..");

// Register path aliases
tsConfigPaths.register({
  baseUrl: baseUrl,
  paths: tsConfig.compilerOptions.paths,
});

console.log("Path aliases registered successfully!");
