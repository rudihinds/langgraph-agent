# Web App Refactoring Plan

This document outlines a comprehensive plan to refactor the `/apps/web` directory structure to improve organization, reduce duplication, and simplify future development.

## Goals

- Organize code by feature to improve developer experience
- Consolidate duplicate implementations
- Create clearer separation of concerns
- Reduce unnecessary nesting and file duplication
- Maintain existing functionality throughout the refactoring

## Migration Steps

### 1. Create New Directory Structure

First, we'll create the new directory structure without moving any files yet:

```bash
# Create feature directories
mkdir -p apps/web/src/features/auth/components
mkdir -p apps/web/src/features/auth/hooks
mkdir -p apps/web/src/features/auth/utils

mkdir -p apps/web/src/features/proposals/components
mkdir -p apps/web/src/features/proposals/hooks
mkdir -p apps/web/src/features/proposals/utils

mkdir -p apps/web/src/features/thread/components
mkdir -p apps/web/src/features/thread/hooks
mkdir -p apps/web/src/features/thread/utils

# Create shared components directory
mkdir -p apps/web/src/components/shared

# Create consolidated Supabase DB directory
mkdir -p apps/web/src/lib/supabase/db
```

### 2. Move Files to New Locations

#### Auth Feature

| Source                                                | Destination                                           |
| ----------------------------------------------------- | ----------------------------------------------------- |
| `/apps/web/src/components/auth/*`                     | `/apps/web/src/features/auth/components/`             |
| `/apps/web/src/lib/auth/*.{ts,tsx}` (excluding tests) | `/apps/web/src/features/auth/utils/`                  |
| `/apps/web/src/hooks/useSession.ts`                   | `/apps/web/src/features/auth/hooks/useSession.ts`     |
| `/apps/web/src/hooks/useCurrentUser.ts`               | `/apps/web/src/features/auth/hooks/useCurrentUser.ts` |
| `/apps/web/src/hooks/useRequireAuth.ts`               | `/apps/web/src/features/auth/hooks/useRequireAuth.ts` |

#### Proposals Feature

| Source                                           | Destination                                             |
| ------------------------------------------------ | ------------------------------------------------------- |
| `/apps/web/src/components/proposals/*`           | `/apps/web/src/features/proposals/components/`          |
| `/apps/web/src/lib/proposal-actions/*`           | `/apps/web/src/features/proposals/utils/`               |
| `/apps/web/src/hooks/useProposal.ts` (if exists) | `/apps/web/src/features/proposals/hooks/useProposal.ts` |
| `/apps/web/src/hooks/useRfpForm.ts` (if exists)  | `/apps/web/src/features/proposals/hooks/useRfpForm.ts`  |

#### Thread Feature

| Source                                                | Destination                                 |
| ----------------------------------------------------- | ------------------------------------------- |
| `/apps/web/src/components/thread/*`                   | `/apps/web/src/features/thread/components/` |
| `/apps/web/src/components/chat-ui/thread/*`           | `/apps/web/src/features/thread/components/` |
| `/apps/web/src/components/chat-ui/lib/*`              | `/apps/web/src/features/thread/utils/`      |
| `/apps/web/src/components/thread/agent-inbox/hooks/*` | `/apps/web/src/features/thread/hooks/`      |

#### Dashboard Components

| Source                                 | Destination                                              |
| -------------------------------------- | -------------------------------------------------------- |
| `/apps/web/src/components/dashboard/*` | `/apps/web/src/components/dashboard/` (remains the same) |

#### Shared Components

| Source                              | Destination                               |
| ----------------------------------- | ----------------------------------------- |
| `/apps/web/src/components/icons/*`  | `/apps/web/src/components/shared/icons/`  |
| `/apps/web/src/components/layout/*` | `/apps/web/src/components/shared/layout/` |

#### Supabase Library

| Source                        | Destination                                            |
| ----------------------------- | ------------------------------------------------------ |
| `/apps/web/src/lib/schema/*`  | `/apps/web/src/lib/supabase/db/schema/`                |
| `/apps/web/src/lib/schemas/*` | `/apps/web/src/schemas/` (consolidate to one location) |

### 3. Update Imports

For each file moved, we need to update imports in all affected files. Here's a strategy for each category:

#### Auth Imports

```typescript
// Old imports
import { useSession } from "@/hooks/useSession";
import { signIn } from "@/lib/auth/actions";

// New imports
import { useSession } from "@/features/auth/hooks/useSession";
import { signIn } from "@/features/auth/utils/actions";
```

#### Proposal Imports

```typescript
// Old imports
import { RfpForm } from "@/components/proposals/RfpForm";
import { uploadProposalFile } from "@/lib/proposal-actions/actions";

// New imports
import { RfpForm } from "@/features/proposals/components/RfpForm";
import { uploadProposalFile } from "@/features/proposals/utils/actions";
```

#### Thread Imports

```typescript
// Old imports
import { Thread } from "@/components/thread/Thread";
import { AgentInbox } from "@/components/thread/agent-inbox/AgentInbox";

// New imports
import { Thread } from "@/features/thread/components/Thread";
import { AgentInbox } from "@/features/thread/components/agent-inbox/AgentInbox";
```

### 4. Update TypeScript Path Configuration

To support the new structure, update the `tsconfig.json` file with the new path mappings:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*", "./*"],
      "@shared/*": ["../../packages/shared/src/*"],
      "@/features/*": ["./src/features/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/types/*": ["./src/types/*"],
      "@/schemas/*": ["./src/schemas/*"],
      "@/providers/*": ["./src/providers/*"]
    }
  }
}
```

You can:

1. Edit `tsconfig.json` directly to include these paths
2. Or create a `tsconfig.paths.json` file and extend it from the main config
3. Be sure to restart the TypeScript server in your IDE after these changes

### 5. Implementation Plan by Phase

#### Phase 1: Create Directory Structure and Move Core Libraries

1. Create all the new directories
2. Move and update Supabase libraries
3. Consolidate schema directories
4. Update imports for moved libraries

#### Phase 2: Feature by Feature Migration

##### Auth Feature

1. Move auth components to features directory
2. Move auth hooks to features directory
3. Move auth utilities to features directory
4. Update imports in all files that reference auth
5. Test auth functionality

##### Proposals Feature

1. Move proposal components to features directory
2. Move proposal actions to utils directory
3. Move proposal hooks to features directory
4. Update imports in all files that reference proposals
5. Test proposal functionality

##### Thread Feature

1. Move thread components to features directory
2. Consolidate chat-ui thread components
3. Move agent-inbox components and hooks
4. Update imports in all files that reference threads
5. Test thread functionality

#### Phase 3: Shared Components

1. Move icons to shared directory
2. Move layout components to shared directory
3. Update imports for shared components
4. Test that all components render correctly

#### Phase 4: Clean Up

1. Remove empty directories
2. Fix any lingering import issues
3. Run thorough tests of the entire application
4. Update documentation with new structure

### 6. Testing Strategy

After each phase:

1. Run `npm run build` to ensure there are no build errors
2. Run existing tests to ensure functionality is maintained
3. Manually test affected features in the UI
4. Fix any issues before proceeding to the next phase

### 7. Rollback Plan

If issues arise that cannot be quickly resolved:

1. Keep backup of original files before starting
2. Document each move operation to allow for reversal
3. If necessary, revert to the original structure and address issues before attempting again

## Automation Script

To automate the refactoring process, a migration script has been created at `apps/web/scripts/refactor-migrate.js`. This script can perform each phase of the migration in isolation, allowing for careful testing between phases.

### Usage

```bash
# Dry run to see what would happen without making changes
node apps/web/scripts/refactor-migrate.js --phase=1 --dry-run

# Phase 1: Create the directory structure
node apps/web/scripts/refactor-migrate.js --phase=1

# Phase 2: Migrate auth feature
node apps/web/scripts/refactor-migrate.js --phase=2

# Continue with other phases...
```

Refer to the script comments for more details on each phase and what it does.

## Additional Notes

- Use path aliases like `@/features/*` in imports to avoid relative path complexity
- Update tsconfig.json to include new path aliases
- Consider using a migration script to automate the process for larger groups of files

## Completion Checklist

- [ ] Directory structure created
- [ ] Libraries moved and consolidated
- [ ] Auth feature migrated
- [ ] Proposals feature migrated
- [ ] Thread feature migrated
- [ ] Shared components migrated
- [ ] All imports updated
- [ ] Empty directories removed
- [ ] Build succeeds
- [ ] Tests pass
- [ ] Manual testing confirms functionality
- [ ] Documentation updated
