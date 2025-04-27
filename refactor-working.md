# Authentication Feature Refactoring Guide

This document provides a systematic approach to refactoring scattered code into a more organized feature-based architecture, using our authentication refactoring as an illustrative example.

## 1. Identifying Files for Refactoring and Planning the New Structure

### How to Approach This Step

- Use code search tools to identify all related code across the codebase
- Create a dependency map to understand relationships between components
- Design a cohesive folder structure that aligns with architectural principles
- Document the current state and planned final state before making changes

### Optimal Methods

- **Comprehensive grep searches**: Use regex patterns to find all related functionality (`grep -r "auth|login|session" --include="*.ts*" ./src/`)
- **Function call analysis**: Trace function calls to identify dependencies (`grep -r "functionName" --include="*.ts*" ./src/`)
- **Feature-first organization**: Group by feature rather than by technical type when possible
- **Visualization**: Create a simple diagram of the current and planned structure

### For Example

In our authentication refactoring, we identified several scattered files:

- `apps/web/src/lib/auth.ts` - Core authentication utilities
- `apps/web/src/lib/auth/with-auth.tsx` - HOC for protected routes
- `apps/web/src/lib/supabase/auth/` - Supabase-specific auth utilities
- `apps/web/src/hooks/useSession.tsx` - Auth context and hooks
- Various components like `LoginButton.tsx`

We planned a feature-based architecture:

```
apps/web/src/features/auth/
├── components/      # UI components related to auth
├── hooks/           # Custom React hooks for auth
├── utils/           # Auth utility functions
├── hoc/             # Higher-order components
├── api/             # API-related auth code
└── index.ts         # Public exports from the auth feature
```

## 2. Setting Up New Folders and Files

### How to Approach This Step

- Create the new directory structure before moving any code
- Set up a barrel file (index.ts) to define a clear public API
- Use placeholder files to establish the intended structure
- Consider creating a feature-specific README.md to document the organization

### Optimal Methods

- **Shell commands for quick setup**: Create multiple directories at once with nested mkdir
- **Barrel file pattern**: Use a single index.ts file to re-export only what should be public
- **Explicit exports**: Be deliberate about what gets exported to control your public API
- **Path aliases**: Configure path aliases in tsconfig.json to make imports cleaner

### For Example

In our project, we set up the new structure with:

```bash
mkdir -p apps/web/src/features/auth/{components,hooks,utils,hoc,api}
touch apps/web/src/features/auth/index.ts
```

Our index.ts file followed the re-export pattern:

```typescript
// apps/web/src/features/auth/index.ts
// Public API for the auth feature

// Re-export from components
export { LoginButton } from "./components/LoginButton";
export { StandardLoginForm } from "./components/StandardLoginForm";

// Re-export from hooks
export { useAuth, useRequireAuth } from "./hooks/authHooks";

// Re-export from utils
export {
  checkUserSession,
  requireAuth,
  redirectIfAuthenticated,
} from "./utils/server-auth";
export { signIn, signOut, getCurrentUser } from "./utils/actions";

// Re-export from HOCs
export { withAuth } from "./hoc/with-auth";
```

## 3. Moving Code to New Locations

### How to Approach This Step

- Copy (don't move) code initially to maintain a working application throughout the process
- Start with core utilities and move outward to dependent components
- Update import paths within each file as you move it
- Keep a log of what you've moved and what still needs updating

### Optimal Methods

- **One module at a time**: Move code in logical units, not individual functions when possible
- **Git branches**: Use feature branches for safe experimentation with larger moves
- **Pair programming**: Have one person move code while another tests or reviews
- **Version comparison tools**: Use tools like VSCode's built-in diff viewer to verify no logic was lost in the move

### For Example

When moving the `LoginButton` component:

1. We created `apps/web/src/features/auth/components/LoginButton.tsx`
2. Copied the code from its original location
3. Updated internal imports to point to the new locations of dependencies
4. Left the original file in place temporarily

## 4. Updating Code as Needed

### How to Approach This Step

- Make minimal necessary changes to ensure code works in its new location
- Update import paths both in moved files and files that import them
- Refactor to fit the new architecture where appropriate
- Maintain consistent naming conventions across the feature

### Optimal Methods

- **Gradual updates**: Make small, targeted changes rather than massive rewrites
- **IDE refactoring tools**: Use IDE features for rename/move operations
- **TypeScript path verification**: Leverage TypeScript to detect import errors early
- **Explicit relative paths**: Within a feature, use relative paths (e.g., `../utils/actions`) for clarity

### For Example

When moving the LoginButton component, we updated import paths:

```typescript
// Before
import { signIn } from "@/lib/supabase";

// After
import { signIn } from "../utils/actions";
```

## 5. Finding and Updating All Import References

### How to Approach This Step

- Systematically identify all files that import from the old locations
- Create a prioritized list of files to update
- Update imports to reference the new centralized exports
- Verify that TypeScript compiles without errors after each batch of changes

### Optimal Methods

- **Targeted grep searches**: Use specific patterns to find exact imports
- **IDE find/replace**: Use workspace-wide search and replace for common patterns
- **TypeScript error tracking**: Let the TypeScript compiler help identify missing imports
- **Batch similar files**: Group related files for efficient updates

### For Example

We used grep to find files importing from old paths:

```bash
grep -r "import .* from ['\"]@/lib/auth['\"]" --include="*.ts*" apps/
```

This identified imports like:

```typescript
import { checkUserSession } from "@/lib/auth";
```

Which we updated to:

```typescript
import { checkUserSession } from "@/features/auth";
```

## 6. Transitioning with Temporary Code Duplication

### How to Approach This Step

- Comment out original code only after verifying the moved code works
- Add deprecation notices to old files pointing to new locations
- Keep original files temporarily with re-exports to avoid breaking changes
- Plan a timeline for removing deprecated files

### Optimal Methods

- **Clear deprecation notices**: Use standardized format for deprecation comments
- **Re-export from old locations**: Temporarily re-export from old files to new locations
- **Code ownership comments**: Add comments indicating who moved the code and when
- **Staged deletion**: Plan specific milestones for removing deprecated files

### For Example

In our original auth file, we added:

```typescript
// apps/web/src/lib/auth.ts

/**
 * @deprecated This file is deprecated. Import from @/features/auth instead.
 */

// Commenting out moved code but keeping the file for now
// export async function checkUserSession(): Promise<User | null> {
//   // ...
// }

// Re-export from new location to avoid breaking imports during transition
export {
  checkUserSession,
  requireAuth,
  redirectIfAuthenticated,
} from "@/features/auth";
```

## 7. Testing Throughout the Refactoring Process

### How to Approach This Step

- Test frequently and thoroughly throughout the refactoring
- Focus on end-to-end user flows rather than just unit tests
- Create a testing checklist covering all affected functionality
- Reproduce edge cases and error states

### Optimal Methods

- **Staged testing**: Test each feature after moving related files
- **End-to-end workflows**: Test complete user journeys (login, access protected routes, logout)
- **Cross-browser verification**: Check functionality in multiple browsers
- **DevTools usage**: Use browser DevTools to inspect network requests, cookies, and errors
- **Error logging**: Add temporary enhanced error logging for better debugging

### For Example

For our authentication refactoring, we followed these testing steps:

1. Started the development server with `npm run dev`
2. Navigated to the login page
3. Attempted to log in with valid credentials
4. Verified redirect to the dashboard occurred properly
5. Tested access to various protected routes
6. Checked that authentication state persisted after page refresh
7. Tested the logout functionality
8. Verified that unauthorized access correctly redirected to login

## 8. Diagnosing and Fixing Errors

### How to Approach This Step

- Analyze errors methodically when they appear
- Fix immediate causes rather than adding workarounds
- Update all related import paths in consuming files
- Address type errors and runtime issues separately

### Optimal Methods

- **Console error analysis**: Check browser console for detailed error information
- **Network request inspection**: Use DevTools network tab to check API calls
- **Stack trace debugging**: Work backwards from error stack traces
- **Systematic imports updating**: Update all imports of a specific function at once
- **Component isolation**: Test components in isolation when possible

### For Example

When we encountered an error with the LoginButton not working:

1. We checked browser console errors and saw: "signIn is not a function"
2. Inspected the component's imports and found it was still importing from the old location
3. Fixed the import path:

```typescript
// Before (error)
import { signIn } from "@/lib/auth";

// After (fix)
import { signIn } from "@/features/auth";
```

4. Verified the function was now properly defined and callable

## 9. Iterative Approach to Complete Functionality

### How to Approach This Step

- Address issues systematically, prioritizing core functionality
- Re-test the entire flow after each set of fixes
- Keep a running list of remaining issues to fix
- Maintain a checklist of functionality to verify before completion

### Optimal Methods

- **Regression testing**: After each fix, verify no new issues were introduced
- **Incremental commits**: Make small, focused commits with clear messages
- **Error categorization**: Group similar errors to fix them efficiently
- **User path testing**: Test from the perspective of different user types
- **Error reproduction steps**: Document exact steps to reproduce an issue

### For Example

Our iterative process followed this pattern:

1. Fixed initial import errors in the main authentication hooks
2. Tested login flow -> found cookie handling issues
3. Fixed cookie handling code in the auth utils
4. Re-tested login -> working correctly
5. Tested protected routes -> discovered HOC import issues
6. Fixed withAuth HOC imports and dependencies
7. Re-tested protected routes -> working correctly
8. Continued this process until all authentication features passed testing

## 10. Final Cleanup and Documentation

### How to Approach This Step

- Remove all deprecated code once all functionality is working
- Update project documentation to reflect the new structure
- Ensure all imports use the new paths consistently
- Create or update architecture diagrams

### Optimal Methods

- **Deprecated code removal**: Delete old files that are no longer needed
- **Import standardization**: Verify all imports use the new structure
- **Documentation updates**: Update READMEs and architecture docs
- **Architecture visualization**: Create diagrams showing the new feature structure
- **Clear commit messages**: Use descriptive commit messages that explain the refactoring

### For Example

Once our authentication refactoring was complete and verified:

1. We deleted deprecated files like `apps/web/src/lib/auth.ts`
2. Ensured all imports used `@/features/auth` consistently
3. Added comments in key files explaining the auth architecture
4. Updated project documentation with the new authentication flow
5. Committed with message "refactor(auth): migrate auth utilities to features directory"

## Lessons From Feature-Based Refactoring

1. **Gradual approach wins**: Move one logical unit at a time and test frequently to identify issues early.
2. **Public API discipline**: A well-defined index.ts as the public API makes refactoring more manageable.
3. **Search tool proficiency**: Mastering grep and IDE search tools is essential for comprehensive refactoring.
4. **Transition strategy matters**: Temporary code duplication with deprecation notices enables smooth transitions.
5. **User-centric testing**: Testing actual user journeys catches issues that unit tests might miss.
6. **Clear documentation**: Documenting both the what and why of your new architecture helps team adoption.

By following this systematic approach, you can successfully refactor scattered code into a cohesive, feature-based architecture without disrupting application functionality.
