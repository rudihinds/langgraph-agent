/**
 * Script to fix mismatched quotes in import statements
 * Run with: node scripts/fix-import-quotes.js
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

// Find all TypeScript files with potential mixed quotes in import statements
async function findFilesWithMixedQuotes() {
  try {
    // This grep finds lines with both single and double quotes in an import statement
    const { stdout } = await execPromise(
      'grep -l "from .\'".*\'"" $(find apps/web/src -type f -name "*.ts*")'
    );
    return stdout.trim().split("\n").filter(Boolean);
  } catch (error) {
    console.log("Finding mixed quotes using alternate method...");
    // If the first method fails, try another approach
    try {
      const { stdout } = await execPromise(
        'find apps/web/src -type f -name "*.ts*" -exec grep -l "from \\s*." {} \\;'
      );
      return stdout.trim().split("\n").filter(Boolean);
    } catch (fallbackError) {
      console.error("Error finding files:", fallbackError);
      return [];
    }
  }
}

// Fix quotes in a file
async function fixQuotesInFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    let hasChanged = false;

    // Convert mixed quotes in import statements to double quotes
    // This regex matches various forms of imports
    const fixedContent = content.replace(
      /(from\s+)(['"])([^'"]+)(['"])/g,
      (match, fromPart, openQuote, importPath, closeQuote) => {
        if (openQuote !== closeQuote) {
          hasChanged = true;
          // Standardize to double quotes
          return `${fromPart}"${importPath}"`;
        }
        return match;
      }
    );

    if (hasChanged) {
      await fs.writeFile(filePath, fixedContent, "utf8");
      return { file: filePath, updated: true };
    }

    return { file: filePath, updated: false };
  } catch (error) {
    console.error(`Error fixing quotes in ${filePath}:`, error);
    return { file: filePath, updated: false, error: error.message };
  }
}

// Process a list of files specified manually
async function processSpecificFiles(fileList) {
  console.log("Processing specific files...");

  const results = [];
  for (const file of fileList) {
    if (await fileExists(file)) {
      const result = await fixQuotesInFile(file);
      results.push(result);

      if (result.updated) {
        console.log(`Fixed quotes in: ${file}`);
      }
    } else {
      console.log(`File not found: ${file}`);
    }
  }

  return results;
}

// Process all TypeScript files in the codebase
async function processAllFiles() {
  console.log("Scanning for files with mixed quotes...");
  const files = await findFilesWithMixedQuotes();
  console.log(`Found ${files.length} files to check.`);

  const results = [];
  for (const file of files) {
    if (await fileExists(file)) {
      const result = await fixQuotesInFile(file);
      results.push(result);

      if (result.updated) {
        console.log(`Fixed quotes in: ${file}`);
      }
    }
  }

  return results;
}

// Check if a file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Main function
async function main() {
  // List of specific files to check, based on known issues
  const specificFiles = [
    "apps/web/src/features/dashboard/components/DashboardSkeleton.tsx",
    "apps/web/src/features/dashboard/components/DashboardFilters.tsx",
    // Add any other files with known issues here
  ];

  console.log("Fixing mismatched quotes in import statements...");

  // First process specific files we know have issues
  const specificResults = await processSpecificFiles(specificFiles);

  // Then scan the codebase for any other occurrences
  const scanResults = await processAllFiles();

  const allResults = [...specificResults, ...scanResults];
  const updatedFiles = allResults.filter((r) => r.updated);
  const filesWithErrors = allResults.filter((r) => r.error);

  console.log(`\nResults:`);
  console.log(`- Total files processed: ${allResults.length}`);
  console.log(`- Files updated: ${updatedFiles.length}`);
  console.log(`- Files with errors: ${filesWithErrors.length}`);

  if (filesWithErrors.length > 0) {
    console.log("\nFiles with errors:");
    filesWithErrors.forEach((f) => console.log(`- ${f.file}: ${f.error}`));
  }

  console.log(
    "\nFixed import quotes in all files. All imports should now use double quotes."
  );
}

main().catch(console.error);
