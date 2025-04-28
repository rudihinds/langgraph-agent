/**
 * Script to fix mismatched quotes in specific files that we know have issues
 * Run with: node scripts/fix-specific-files.js
 */

import fs from "fs/promises";

// List of files with known quote mismatch issues
const FILES_TO_FIX = [
  "apps/web/src/features/dashboard/components/DashboardSkeleton.tsx",
  "apps/web/src/features/dashboard/components/DashboardFilters.tsx",
  // Add any other files with known issues here
];

// Fix a specific file
async function fixFile(filePath) {
  try {
    console.log(`Checking ${filePath}...`);
    const content = await fs.readFile(filePath, "utf8");

    // Fix import statements with mixed quotes
    // Example: from '@/path" -> from "@/path"
    const fixedContent = content.replace(
      /from\s+(['"])(.+?)(["'])/g,
      (match, startQuote, path, endQuote) => {
        if (startQuote !== endQuote) {
          console.log(`  Found mismatched quotes: ${match}`);
          // Standardize to double quotes
          return `from "${path}"`;
        }
        return match;
      }
    );

    if (content !== fixedContent) {
      await fs.writeFile(filePath, fixedContent, "utf8");
      console.log(`✅ Fixed quotes in ${filePath}`);
      return true;
    } else {
      console.log(`  No mismatched quotes found in ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Main function
async function main() {
  console.log("Fixing mismatched quotes in specific files...\n");

  let fixedCount = 0;

  for (const file of FILES_TO_FIX) {
    const wasFixed = await fixFile(file);
    if (wasFixed) {
      fixedCount++;
    }
  }

  console.log(
    `\nFixed quotes in ${fixedCount} out of ${FILES_TO_FIX.length} files.`
  );
}

main().catch(console.error);
