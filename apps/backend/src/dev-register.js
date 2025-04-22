// dev-register.js - For use with tsx/ts-node in development
import { register } from "tsconfig-paths";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read tsconfig.json
const tsconfigPath = resolve(__dirname, "..", "tsconfig.json");
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));

// Register path mappings for development
const { baseUrl, paths } = tsconfig.compilerOptions;

// Calculate the absolute base URL
const absoluteBaseUrl = resolve(__dirname, "..", baseUrl || ".");

register({
  baseUrl: absoluteBaseUrl,
  paths: paths || {},
});

console.log("Development path aliases registered successfully!");
