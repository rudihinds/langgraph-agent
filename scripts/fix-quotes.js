/**
 * Script to fix unterminated string literals in import statements
 * Run with: node scripts/fix-quotes.js
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

// Files with unterminated string literals from our previous analysis
const targetFiles = [
  "apps/web/src/features/thread/components/agent-inbox/components/inbox-item-input.tsx",
  "apps/web/src/features/thread/components/agent-inbox/components/state-view.tsx",
  "apps/web/src/features/thread/components/agent-inbox/components/thread-actions-view.tsx",
  "apps/web/src/features/thread/components/agent-inbox/components/thread-id.tsx",
  "apps/web/src/features/thread/components/agent-inbox/hooks/use-interrupted-actions.tsx",
  "apps/web/src/features/thread/components/agent-inbox/index.tsx",
  "apps/web/src/features/thread/components/messages/ai.tsx",
  "apps/web/src/features/thread/components/messages/shared.tsx",
];

// Fix quotes in import statements
async function fixQuotesInFile(filePath) {
  try {
    let content = await fs.readFile(filePath, "utf8");

    // Fix import statements with mixed quotes
    // Matches: import { X } from '@/path" or import { X } from "@/path'
    const mixedQuoteRegex = /from\s+(['"])([^'"]+)(["'])/g;
    let hasChanged = false;

    // Fix mixed quotes by ensuring the opening and closing quotes match
    content = content.replace(
      mixedQuoteRegex,
      (match, openQuote, path, closeQuote) => {
        if (openQuote !== closeQuote) {
          hasChanged = true;
          return `from ${openQuote}${path}${openQuote}`;
        }
        return match;
      }
    );

    if (hasChanged) {
      await fs.writeFile(filePath, content, "utf8");
      console.log(`Fixed quotes in: ${filePath}`);
      return { updated: true };
    }

    return { updated: false };
  } catch (error) {
    console.error(`Error fixing quotes in ${filePath}:`, error);
    return { updated: false, error: error.message };
  }
}

// Main function
async function main() {
  console.log("Fixing unterminated string literals in imports...");

  let updatedCount = 0;

  for (const file of targetFiles) {
    if (await fileExists(file)) {
      const result = await fixQuotesInFile(file);

      if (result.updated) {
        updatedCount++;
      }
    } else {
      console.log(`File not found: ${file}`);
    }
  }

  console.log(
    `\nFixing complete! Modified ${updatedCount} out of ${targetFiles.length} files.`
  );
}

// Helper function to check if file exists
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

main().catch(console.error);
