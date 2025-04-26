#!/usr/bin/env node

/**
 * Web App Refactoring Migration Script
 *
 * This script helps automate the process of moving files and updating imports
 * according to the refactoring plan defined in refactor-web.md.
 *
 * Usage:
 * node scripts/refactor-migrate.js --phase=1
 *
 * Phases:
 * 1: Create directory structure
 * 2: Move auth feature files
 * 3: Move proposals feature files
 * 4: Move thread feature files
 * 5: Move shared components
 * 6: Consolidate schema files
 * 7: Clean up
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const ROOT_DIR = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const phaseArg = args.find((arg) => arg.startsWith("--phase="));
const phase = phaseArg ? parseInt(phaseArg.split("=")[1], 10) : 0;
const dryRun = args.includes("--dry-run");

// Helpers
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function moveFile(source, destination) {
  const sourcePath = path.resolve(ROOT_DIR, source);
  const destPath = path.resolve(ROOT_DIR, destination);

  if (!fs.existsSync(sourcePath)) {
    console.log(`⚠️  Source file not found: ${sourcePath}`);
    return;
  }

  ensureDirectoryExistence(destPath);

  if (dryRun) {
    console.log(`Would move: ${sourcePath} → ${destPath}`);
  } else {
    fs.copyFileSync(sourcePath, destPath);
    console.log(`✅ Moved: ${sourcePath} → ${destPath}`);
  }
}

function findFiles(dir, pattern) {
  try {
    const result = execSync(`find ${dir} -type f -name "${pattern}"`, {
      encoding: "utf8",
    });
    return result.trim().split("\n").filter(Boolean);
  } catch (error) {
    console.error("Error finding files:", error);
    return [];
  }
}

function updateImports(filePath, importMap) {
  if (dryRun) {
    console.log(`Would update imports in: ${filePath}`);
    return;
  }

  try {
    let content = fs.readFileSync(filePath, "utf8");
    let updated = false;

    for (const [oldImport, newImport] of Object.entries(importMap)) {
      const regex = new RegExp(`from ['"]${oldImport}['"]`, "g");
      if (regex.test(content)) {
        content = content.replace(regex, `from '${newImport}'`);
        updated = true;
      }
    }

    if (updated) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Updated imports in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error updating imports in ${filePath}:`, error);
  }
}

// Phase implementation
function createDirectoryStructure() {
  console.log("📁 Creating directory structure...");

  const directories = [
    "src/features/auth/components",
    "src/features/auth/hooks",
    "src/features/auth/utils",
    "src/features/proposals/components",
    "src/features/proposals/hooks",
    "src/features/proposals/utils",
    "src/features/thread/components",
    "src/features/thread/hooks",
    "src/features/thread/utils",
    "src/components/shared",
    "src/components/shared/icons",
    "src/components/shared/layout",
    "src/lib/supabase/db",
    "src/lib/supabase/db/schema",
  ];

  for (const dir of directories) {
    const fullPath = path.resolve(ROOT_DIR, dir);

    if (dryRun) {
      console.log(`Would create directory: ${fullPath}`);
    } else {
      ensureDirectoryExistence(fullPath + "/placeholder");
      console.log(`✅ Created directory: ${fullPath}`);
    }
  }
}

function migrateAuthFeature() {
  console.log("🔄 Migrating Auth Feature...");

  // Move component files
  const authComponents = findFiles(
    path.resolve(ROOT_DIR, "src/components/auth"),
    "*.{ts,tsx}"
  );
  for (const file of authComponents) {
    const fileName = path.basename(file);
    moveFile(file, `src/features/auth/components/${fileName}`);
  }

  // Move auth utility files
  const authUtils = findFiles(
    path.resolve(ROOT_DIR, "src/lib/auth"),
    "*.{ts,tsx}"
  );
  for (const file of authUtils) {
    if (!file.includes("__tests__")) {
      const fileName = path.basename(file);
      moveFile(file, `src/features/auth/utils/${fileName}`);
    }
  }

  // Move hooks
  const authHooks = [
    "src/hooks/useSession.ts",
    "src/hooks/useCurrentUser.ts",
    "src/hooks/useRequireAuth.ts",
  ];

  for (const hook of authHooks) {
    if (fs.existsSync(path.resolve(ROOT_DIR, hook))) {
      const fileName = path.basename(hook);
      moveFile(hook, `src/features/auth/hooks/${fileName}`);
    }
  }

  // Update imports
  const importMap = {
    "@/components/auth": "@/features/auth/components",
    "@/lib/auth": "@/features/auth/utils",
    "@/hooks/useSession": "@/features/auth/hooks/useSession",
    "@/hooks/useCurrentUser": "@/features/auth/hooks/useCurrentUser",
    "@/hooks/useRequireAuth": "@/features/auth/hooks/useRequireAuth",
  };

  const allTsFiles = findFiles(ROOT_DIR, "*.{ts,tsx}");
  for (const file of allTsFiles) {
    if (!file.includes("node_modules")) {
      updateImports(file, importMap);
    }
  }
}

function migrateProposalsFeature() {
  console.log("🔄 Migrating Proposals Feature...");

  // Move component files
  const proposalComponents = findFiles(
    path.resolve(ROOT_DIR, "src/components/proposals"),
    "*.{ts,tsx}"
  );
  for (const file of proposalComponents) {
    if (!file.includes("__tests__")) {
      const fileName = path.basename(file);
      moveFile(file, `src/features/proposals/components/${fileName}`);
    }
  }

  // Move proposal actions
  const proposalActions = findFiles(
    path.resolve(ROOT_DIR, "src/lib/proposal-actions"),
    "*.{ts,tsx}"
  );
  for (const file of proposalActions) {
    const fileName = path.basename(file);
    moveFile(file, `src/features/proposals/utils/${fileName}`);
  }

  // Move hooks if they exist
  const proposalHooks = ["src/hooks/useProposal.ts", "src/hooks/useRfpForm.ts"];

  for (const hook of proposalHooks) {
    if (fs.existsSync(path.resolve(ROOT_DIR, hook))) {
      const fileName = path.basename(hook);
      moveFile(hook, `src/features/proposals/hooks/${fileName}`);
    }
  }

  // Update imports
  const importMap = {
    "@/components/proposals": "@/features/proposals/components",
    "@/lib/proposal-actions": "@/features/proposals/utils",
    "@/hooks/useProposal": "@/features/proposals/hooks/useProposal",
    "@/hooks/useRfpForm": "@/features/proposals/hooks/useRfpForm",
  };

  const allTsFiles = findFiles(ROOT_DIR, "*.{ts,tsx}");
  for (const file of allTsFiles) {
    if (!file.includes("node_modules")) {
      updateImports(file, importMap);
    }
  }
}

function migrateThreadFeature() {
  console.log("🔄 Migrating Thread Feature...");

  // Move thread components
  const threadComponents = findFiles(
    path.resolve(ROOT_DIR, "src/components/thread"),
    "*.{ts,tsx}"
  );
  for (const file of threadComponents) {
    if (!file.includes("__tests__") && !file.includes("/hooks/")) {
      const relativePath = file.replace(
        path.resolve(ROOT_DIR, "src/components/thread/"),
        ""
      );
      moveFile(file, `src/features/thread/components/${relativePath}`);
    }
  }

  // Move chat-ui thread components
  const chatUiThreadComponents = findFiles(
    path.resolve(ROOT_DIR, "src/components/chat-ui/thread"),
    "*.{ts,tsx}"
  );
  for (const file of chatUiThreadComponents) {
    if (!file.includes("__tests__")) {
      const relativePath = file.replace(
        path.resolve(ROOT_DIR, "src/components/chat-ui/thread/"),
        ""
      );
      moveFile(file, `src/features/thread/components/${relativePath}`);
    }
  }

  // Move chat-ui lib files to thread utils
  const chatUiLib = findFiles(
    path.resolve(ROOT_DIR, "src/components/chat-ui/lib"),
    "*.{ts,tsx}"
  );
  for (const file of chatUiLib) {
    const fileName = path.basename(file);
    moveFile(file, `src/features/thread/utils/${fileName}`);
  }

  // Move agent-inbox hooks
  const agentInboxHooks = findFiles(
    path.resolve(ROOT_DIR, "src/components/thread/agent-inbox/hooks"),
    "*.{ts,tsx}"
  );
  for (const file of agentInboxHooks) {
    const fileName = path.basename(file);
    moveFile(file, `src/features/thread/hooks/${fileName}`);
  }

  // Update imports
  const importMap = {
    "@/components/thread": "@/features/thread/components",
    "@/components/chat-ui/thread": "@/features/thread/components",
    "@/components/chat-ui/lib": "@/features/thread/utils",
    "@/components/thread/agent-inbox/hooks": "@/features/thread/hooks",
  };

  const allTsFiles = findFiles(ROOT_DIR, "*.{ts,tsx}");
  for (const file of allTsFiles) {
    if (!file.includes("node_modules")) {
      updateImports(file, importMap);
    }
  }
}

function migrateSharedComponents() {
  console.log("🔄 Migrating Shared Components...");

  // Move icon components
  const iconComponents = findFiles(
    path.resolve(ROOT_DIR, "src/components/icons"),
    "*.{ts,tsx}"
  );
  for (const file of iconComponents) {
    const fileName = path.basename(file);
    moveFile(file, `src/components/shared/icons/${fileName}`);
  }

  // Move layout components
  const layoutComponents = findFiles(
    path.resolve(ROOT_DIR, "src/components/layout"),
    "*.{ts,tsx}"
  );
  for (const file of layoutComponents) {
    if (!file.includes("__tests__")) {
      const fileName = path.basename(file);
      moveFile(file, `src/components/shared/layout/${fileName}`);
    }
  }

  // Update imports
  const importMap = {
    "@/components/icons": "@/components/shared/icons",
    "@/components/layout": "@/components/shared/layout",
  };

  const allTsFiles = findFiles(ROOT_DIR, "*.{ts,tsx}");
  for (const file of allTsFiles) {
    if (!file.includes("node_modules")) {
      updateImports(file, importMap);
    }
  }
}

function consolidateSchemas() {
  console.log("🔄 Consolidating Schema Files...");

  // Move schema files to supabase/db
  const schemaFiles = findFiles(
    path.resolve(ROOT_DIR, "src/lib/schema"),
    "*.{ts,tsx}"
  );
  for (const file of schemaFiles) {
    const fileName = path.basename(file);
    moveFile(file, `src/lib/supabase/db/schema/${fileName}`);
  }

  // Create a unified schemas directory
  const schemasFiles = findFiles(
    path.resolve(ROOT_DIR, "src/lib/schemas"),
    "*.{ts,tsx}"
  );
  for (const file of schemasFiles) {
    const fileName = path.basename(file);
    moveFile(file, `src/schemas/${fileName}`);
  }

  // Update imports
  const importMap = {
    "@/lib/schema": "@/lib/supabase/db/schema",
    "@/lib/schemas": "@/schemas",
  };

  const allTsFiles = findFiles(ROOT_DIR, "*.{ts,tsx}");
  for (const file of allTsFiles) {
    if (!file.includes("node_modules")) {
      updateImports(file, importMap);
    }
  }
}

function cleanup() {
  console.log("🧹 Cleaning up...");

  // For dry run, just list what would be checked
  if (dryRun) {
    console.log("Would check for empty directories to remove");
    console.log("Would check for any broken imports");
    return;
  }

  // In a real implementation, you might:
  // 1. Remove empty directories
  // 2. Run a build to check for errors
  // 3. Fix any broken imports that are found

  console.log(
    "✅ Cleanup tasks would be performed here (this is a placeholder)"
  );
  console.log("ℹ️  You should run `npm run build` to check for any issues");
}

// Execute based on the phase
function executePhase() {
  console.log(`🚀 Executing Phase ${phase}${dryRun ? " (DRY RUN)" : ""}`);

  switch (phase) {
    case 1:
      createDirectoryStructure();
      break;
    case 2:
      migrateAuthFeature();
      break;
    case 3:
      migrateProposalsFeature();
      break;
    case 4:
      migrateThreadFeature();
      break;
    case 5:
      migrateSharedComponents();
      break;
    case 6:
      consolidateSchemas();
      break;
    case 7:
      cleanup();
      break;
    default:
      console.log(
        "⚠️  Please specify a valid phase (1-7) using --phase=<number>"
      );
      console.log("📋 Available phases:");
      console.log("  1: Create directory structure");
      console.log("  2: Migrate auth feature");
      console.log("  3: Migrate proposals feature");
      console.log("  4: Migrate thread feature");
      console.log("  5: Migrate shared components");
      console.log("  6: Consolidate schemas");
      console.log("  7: Cleanup");
      console.log(
        "\nAdd --dry-run to see what would be done without making changes"
      );
  }
}

// Run the migration script
executePhase();
