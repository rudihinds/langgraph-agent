/**
 * Script to update imports after refactoring
 * Run with: node scripts/update-imports.js
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

// Import mapping based on the refactoring plan
const importMappings = [
  // Auth Feature
  { from: "@/components/auth/", to: "@/features/auth/components/" },
  { from: "@/lib/auth/", to: "@/features/auth/utils/" },
  { from: "@/hooks/useSession", to: "@/features/auth/hooks/useSession" },
  {
    from: "@/hooks/useCurrentUser",
    to: "@/features/auth/hooks/useCurrentUser",
  },
  {
    from: "@/hooks/useRequireAuth",
    to: "@/features/auth/hooks/useRequireAuth",
  },

  // Proposals Feature
  { from: "@/components/proposals/", to: "@/features/proposals/components/" },
  { from: "@/lib/proposal-actions/", to: "@/features/proposals/utils/" },
  { from: "@/hooks/useProposal", to: "@/features/proposals/hooks/useProposal" },
  { from: "@/hooks/useRfpForm", to: "@/features/proposals/hooks/useRfpForm" },

  // Thread Feature
  { from: "@/components/thread/", to: "@/features/thread/components/" },
  { from: "@/components/chat-ui/thread/", to: "@/features/thread/components/" },
  { from: "@/components/chat-ui/lib/", to: "@/features/thread/utils/" },
  {
    from: "@/components/thread/agent-inbox/hooks/",
    to: "@/features/thread/hooks/",
  },

  // Dashboard Components
  { from: "@/components/dashboard/", to: "@/features/dashboard/components/" },

  // UI Components - Move all UI components to features/ui
  { from: "@/components/ui/", to: "@/features/ui/components/" },

  // Shared Components
  { from: "@/components/icons/", to: "@/components/shared/icons/" },
  { from: "@/components/layout/", to: "@/features/layout/components/" },
  { from: "@/components/shared/", to: "@/features/shared/components/" },

  // Supabase Library
  { from: "@/lib/schema/", to: "@/lib/supabase/db/schema/" },
  { from: "@/lib/schemas/", to: "@/schemas/" },

  // Error handling
  { from: "@/lib/errors/", to: "@/features/shared/errors/" },

  // API
  { from: "@/lib/api/", to: "@/features/api/utils/" },

  // Providers
  { from: "@/providers/", to: "@/features/providers/" },
];

// Find files with potentially broken imports
async function findFilesWithBrokenImports() {
  try {
    const { stdout } = await execPromise(
      'find apps/web/src -type f -name "*.ts*" -exec grep -l "@/components\\|@/lib\\|@/hooks\\|@/providers" {} \\;'
    );
    return stdout.trim().split("\n").filter(Boolean);
  } catch (error) {
    console.error("Error finding files:", error);
    return [];
  }
}

// Update imports in a file
async function updateImportsInFile(filePath) {
  try {
    let content = await fs.readFile(filePath, "utf8");
    let hasChanged = false;
    let originalContent = content;

    for (const mapping of importMappings) {
      // Handle simple path mapping
      const regex = new RegExp(`from ['"]${escapeRegExp(mapping.from)}`, "g");
      if (regex.test(content)) {
        content = content.replace(regex, `from '${mapping.to}`);
        hasChanged = true;
      }

      // Handle full import statements with specific files
      const specificFileRegex = new RegExp(
        `from ['"]${escapeRegExp(mapping.from)}([^'"]*)['"]`,
        "g"
      );
      if (specificFileRegex.test(content)) {
        content = content.replace(specificFileRegex, `from '${mapping.to}$1'`);
        hasChanged = true;
      }
    }

    // Handle any special case where we're importing from a file directly
    for (const mapping of importMappings) {
      if (!mapping.from.endsWith("/")) {
        const exactFileRegex = new RegExp(
          `from ['"]${escapeRegExp(mapping.from)}['"]`,
          "g"
        );
        if (exactFileRegex.test(content)) {
          content = content.replace(exactFileRegex, `from '${mapping.to}'`);
          hasChanged = true;
        }
      }
    }

    // Fix common issues with import string quotes
    if (content.includes("from '@")) {
      content = content.replace(/from '(@[^']+)'/g, 'from "$1"');
      hasChanged = true;
    }

    if (hasChanged) {
      // Sanity check - ensure we didn't create any malformed imports
      if (content.includes("from ''") || content.includes('from ""')) {
        console.error(`Warning: Potentially malformed imports in ${filePath}`);
        // Just log the warning but still write the file
      }

      await fs.writeFile(filePath, content, "utf8");
      return { updated: true, from: originalContent, to: content };
    }

    return { updated: false };
  } catch (error) {
    console.error(`Error updating imports in ${filePath}:`, error);
    return { updated: false, error: error.message };
  }
}

// Check for TypeScript errors
async function checkTypeScriptErrors() {
  console.log("Checking for TypeScript errors...");
  try {
    // First check if there are errors without showing them (faster)
    const { stdout, stderr } = await execPromise(
      "cd apps/web && npx tsc --noEmit --pretty false"
    );
    console.log("TypeScript check completed successfully.");
    return { success: true };
  } catch (error) {
    console.error("TypeScript check failed with errors:");

    // Run again with a more verbose output to get detailed errors
    try {
      const { stdout: verboseOutput } = await execPromise(
        "cd apps/web && npx tsc --noEmit --pretty"
      );
      return {
        success: false,
        errors: verboseOutput || error.stdout || error.message,
      };
    } catch (verboseError) {
      return {
        success: false,
        errors: verboseError.stdout || error.stdout || error.message,
      };
    }
  }
}

// Helper function to escape special regex characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Generate a summary report
function generateReport(results, typeCheckResult) {
  let report = "# Import Update Summary\n\n";

  const updatedFiles = results.filter((r) => r.result.updated);
  const failedFiles = results.filter((r) => r.result.error);

  report += `## Overview\n`;
  report += `- Total files checked: ${results.length}\n`;
  report += `- Files updated: ${updatedFiles.length}\n`;
  report += `- Files with errors: ${failedFiles.length}\n\n`;

  if (typeCheckResult) {
    report += `## TypeScript Check\n`;
    if (typeCheckResult.success) {
      report += `✅ TypeScript check completed successfully.\n\n`;
    } else {
      report += `❌ TypeScript check failed with errors.\n\n`;
      report += "```\n";
      report += typeCheckResult.errors || "Unknown error";
      report += "\n```\n\n";
    }
  }

  if (failedFiles.length > 0) {
    report += `## Files with Errors\n`;
    failedFiles.forEach((f) => {
      report += `- ${f.file}: ${f.result.error}\n`;
    });
    report += "\n";
  }

  report += `## Updated Files\n`;
  updatedFiles.forEach((f) => {
    report += `- ${f.file}\n`;
  });

  return report;
}

// Main function
async function main() {
  console.log("Finding files with potentially broken imports...");
  const files = await findFilesWithBrokenImports();
  console.log(`Found ${files.length} files to check.`);

  let updatedCount = 0;
  let results = [];

  for (const file of files) {
    const result = await updateImportsInFile(file);
    results.push({ file, result });

    if (result.updated) {
      updatedCount++;
      console.log(`Updated imports in: ${file}`);
    }
  }

  console.log(
    `\nUpdate complete! Modified ${updatedCount} out of ${files.length} files.`
  );

  // Run TypeScript check
  const typeCheckResult = await checkTypeScriptErrors();

  // Generate summary report
  const report = generateReport(results, typeCheckResult);
  await fs.writeFile("scripts/import-update-report.md", report, "utf8");
  console.log("Generated report at: scripts/import-update-report.md");

  if (!typeCheckResult.success) {
    console.log(
      "\nSome TypeScript errors were found. Please check the report for details."
    );
    process.exit(1);
  }
}

main().catch(console.error);
