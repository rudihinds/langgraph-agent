/**
 * Script to fix mismatched quotes in import statements
 * Handles cases like: from '@/path" -> from "@/path"
 * Run with: node scripts/fix-mismatched-quotes.js
 */

import fs from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";

// Convert to ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Promisify exec
const execPromise = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
};

// Find files with mixed quotes using grep (very specific pattern)
async function findFilesWithPattern() {
  try {
    // This pattern looks specifically for imports with '@ and " combination
    const { stdout } = await execPromise(
      'grep -l "from \'[^\']*\\"" $(find apps/web/src -type f -name "*.ts*")'
    );
    return stdout.trim().split("\n").filter(Boolean);
  } catch (error) {
    // If the grep command fails or finds nothing, return empty array
    return [];
  }
}

// Fix mismatched quotes in import statement
async function fixFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");

    // Pattern 1: from '@/path" -> from "@/path"
    const pattern1 = /from\s+'([^']+)"/g;
    let fixed = content.replace(pattern1, 'from "$1"');

    // Pattern 2: from "@/path' -> from "@/path"
    const pattern2 = /from\s+"([^"]+)'/g;
    fixed = fixed.replace(pattern2, 'from "$1"');

    // Check if the content was modified
    const hasChanged = content !== fixed;

    if (hasChanged) {
      await fs.writeFile(filePath, fixed, "utf8");
      console.log(`✅ Fixed quotes in: ${filePath}`);
      return { file: filePath, updated: true };
    } else {
      return { file: filePath, updated: false };
    }
  } catch (error) {
    console.error(`❌ Error fixing file ${filePath}:`, error);
    return { file: filePath, error: error.message };
  }
}

// Process all files in the codebase
async function processFiles() {
  // Process the specific files we know have issues
  const specificFiles = [
    "apps/web/src/features/dashboard/components/DashboardSkeleton.tsx",
    "apps/web/src/features/dashboard/components/DashboardFilters.tsx",
  ];

  // Add any other files found with the pattern
  const filesWithPattern = await findFilesWithPattern();
  const allFiles = [...new Set([...specificFiles, ...filesWithPattern])];

  console.log(`Found ${allFiles.length} files to check for mismatched quotes.`);

  const results = [];
  for (const file of allFiles) {
    try {
      // Check if file exists
      await fs.access(file);
      const result = await fixFile(file);
      results.push(result);
    } catch (error) {
      console.log(`File not found: ${file}`);
    }
  }

  const updatedFiles = results.filter((r) => r.updated);
  console.log(`\nFixed mismatched quotes in ${updatedFiles.length} files.`);

  if (updatedFiles.length > 0) {
    console.log("Updated files:");
    updatedFiles.forEach((r) => console.log(`- ${r.file}`));
  }
}

// Main function
async function main() {
  console.log("Fixing mismatched quotes in import statements...");
  await processFiles();
  console.log("\nDone!");
}

main().catch(console.error);
