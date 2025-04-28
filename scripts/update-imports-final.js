/**
 * Script to fix specific import issues after refactoring
 * Run with: node scripts/update-imports-final.js
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

// This script specifically focuses on fixing:
// 1. UI component relative imports (../ui/button -> @/features/ui/components/button)
// 2. Icons imports (../icons/X -> @/components/shared/icons/X)
// 3. Ensure-tool-responses import (@/lib/ensure-tool-responses -> @/features/shared/utils/ensure-tool-responses)
// 4. Utils import paths (@/lib/utils/utils -> @/features/shared/utils/utils)

const relativeMappings = [
  // UI Components
  {
    pattern: /from ["']\.\.\/ui\/([^"']+)["']/g,
    replacement: 'from "@/features/ui/components/$1"',
  },
  {
    pattern: /from ["']\.\.\/\.\.\/ui\/([^"']+)["']/g,
    replacement: 'from "@/features/ui/components/$1"',
  },
  {
    pattern: /from ["']\.\.\/\.\.\/\.\.\/ui\/([^"']+)["']/g,
    replacement: 'from "@/features/ui/components/$1"',
  },

  // Icons
  {
    pattern: /from ["']\.\.\/icons\/([^"']+)["']/g,
    replacement: 'from "@/components/shared/icons/$1"',
  },
  {
    pattern: /from ["']\.\.\/\.\.\/icons\/([^"']+)["']/g,
    replacement: 'from "@/components/shared/icons/$1"',
  },
  {
    pattern: /from ["']\.\.\/\.\.\/\.\.\/icons\/([^"']+)["']/g,
    replacement: 'from "@/components/shared/icons/$1"',
  },

  // Utils
  {
    pattern: /from ["']@\/lib\/utils\/utils["']/g,
    replacement: 'from "@/features/shared/utils/utils"',
  },

  // Ensure tool responses
  {
    pattern: /from ["']@\/lib\/ensure-tool-responses["']/g,
    replacement: 'from "@/features/shared/utils/ensure-tool-responses"',
  },

  // Media query hook
  {
    pattern: /from ["']@\/hooks\/useMediaQuery["']/g,
    replacement: 'from "@/features/shared/hooks/useMediaQuery"',
  },

  // Fix quotes for imports
  { pattern: /from [']([@\/][^']+)[']/g, replacement: 'from "$1"' },
];

// Specific problematic files from our previous analysis
const targetFiles = [
  "apps/web/src/features/thread/components/index.tsx",
  "apps/web/src/features/thread/components/tooltip-icon-button.tsx",
  "apps/web/src/features/thread/components/agent-inbox/components/state-view.tsx",
  "apps/web/src/features/thread/components/agent-inbox/components/thread-actions-view.tsx",
  "apps/web/src/features/thread/components/messages/human.tsx",
  "apps/web/src/features/thread/components/messages/ai.tsx",
];

// Fix imports in a file
async function fixImportsInFile(filePath) {
  try {
    let content = await fs.readFile(filePath, "utf8");
    let hasChanged = false;
    let originalContent = content;

    for (const mapping of relativeMappings) {
      if (mapping.pattern.test(content)) {
        // Reset the lastIndex property since we're reusing the regex
        mapping.pattern.lastIndex = 0;

        content = content.replace(mapping.pattern, mapping.replacement);
        hasChanged = true;
      }
    }

    if (hasChanged) {
      await fs.writeFile(filePath, content, "utf8");
      console.log(`Fixed imports in: ${filePath}`);
      return { updated: true, from: originalContent, to: content };
    }

    return { updated: false };
  } catch (error) {
    console.error(`Error fixing imports in ${filePath}:`, error);
    return { updated: false, error: error.message };
  }
}

// Main function
async function main() {
  console.log("Fixing specific import issues...");

  let updatedCount = 0;
  let results = [];

  for (const file of targetFiles) {
    if (await fileExists(file)) {
      const result = await fixImportsInFile(file);
      results.push({ file, result });

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

  // Try to run a simple check on a file to see if the imports are fixed
  console.log("\nChecking if imports are fixed...");
  try {
    await execPromise("cd apps/web && npm run build");
    console.log("Build successful! All imports are fixed.");
  } catch (error) {
    console.error("Build failed. Some imports might still be incorrect.");
    console.log(error.stdout || error.message);
  }
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
