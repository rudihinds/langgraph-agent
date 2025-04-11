# Supabase Utilities Migration Plan

This document outlines the plan to consolidate all Supabase-related utilities into the new `/src/lib/supabase/` directory structure.

## Current State

We currently have Supabase utilities spread across multiple files:

### 1. `/src/lib/supabase/` (New Pattern - SSR)
- `client.ts` - Browser client using @supabase/ssr
- `server.ts` - Server client using @supabase/ssr
- `middleware.ts` - Auth session handling for Next.js middleware
- `README.md` - Documentation for Supabase implementation

### 2. `/src/lib/supabase.ts` (Old Pattern)
Functions:
- `createClient()` - Client-side Supabase client
- `getRedirectURL()` - Helper for OAuth redirects
- `signIn()` - Initiates Google OAuth
- `signOut()` - Signs out user on client and server 
- `getSession()` - Gets current session
- `getAccessToken()` - Extracts access token
- `validateSession()` - Validates and refreshes session
- `getCurrentUser()` - Gets current user

### 3. `/src/lib/supabase-server.ts` (Old Pattern)
Functions:
- `createServerSupabaseClient()` - Creates server client
- `createServerSupabaseClientWithCookies()` - Creates server client with provided cookies

### 4. `/src/lib/client-auth.ts` (Auth Hooks)
Functions:
- `useCurrentUser()` - React hook for current user
- `useRequireAuth()` - Hook to require authentication
- `checkAuthAndRedirect()` - Auth check with redirect
- `signOut()` - Sign out functionality (duplicates supabase.ts)

## Migration Goals

1. Consolidate all Supabase code into the `/src/lib/supabase/` directory
2. Maintain backward compatibility
3. Improve organization with clear separation of concerns
4. Add comprehensive documentation
5. Ensure all functions have proper error handling

## New Directory Structure

```
/src/lib/supabase/
├── client.ts            # Browser client creation
├── server.ts            # Server client creation
├── auth/
│   ├── index.ts         # Main auth exports
│   ├── hooks.ts         # React hooks for auth
│   ├── actions.ts       # Auth actions (signIn, signOut)
│   └── utils.ts         # Auth utilities
├── middleware.ts        # Middleware for Next.js
├── types/               # TypeScript types
│   └── index.ts         # Type definitions
├── compatibility.ts     # Legacy exports for backward compatibility
└── README.md            # Documentation
```

## Migration Steps

### Phase 1: Create New Files

1. Create `/src/lib/supabase/auth/hooks.ts`
   - Move `useCurrentUser` and `useRequireAuth` from `client-auth.ts`
   - Add proper JSDoc comments

2. Create `/src/lib/supabase/auth/actions.ts`
   - Move `signIn` and `signOut` from `supabase.ts`
   - Ensure consistent error handling

3. Create `/src/lib/supabase/auth/utils.ts`
   - Move `getRedirectURL`, `getSession`, `getAccessToken`, `validateSession`, and `getCurrentUser` from `supabase.ts`
   - Move `checkAuthAndRedirect` from `client-auth.ts`

4. Create `/src/lib/supabase/auth/index.ts`
   - Re-export all auth-related functions from the above files

5. Create `/src/lib/supabase/types/index.ts`
   - Define shared TypeScript types

### Phase 2: Create Compatibility Layer

Create `/src/lib/supabase/compatibility.ts` to re-export from new locations:

```typescript
/**
 * @deprecated This file provides backward compatibility with the old Supabase utility structure.
 * Please import from the new locations instead.
 */

// Re-export from auth
export {
  signIn,
  signOut,
  getSession,
  getAccessToken,
  validateSession,
  getCurrentUser,
} from './auth';

// Re-export client creation
export { createClient } from './client';
```

### Phase 3: Update Legacy Files

Update `/src/lib/supabase.ts` to re-export from the new modules:

```typescript
/**
 * @deprecated Please import from @/lib/supabase/auth or @/lib/supabase/client instead.
 * This file will be removed in a future release.
 */

export {
  signIn,
  signOut,
  getSession,
  getAccessToken,
  validateSession,
  getCurrentUser,
} from '@/lib/supabase/auth';

export { createClient } from '@/lib/supabase/client';
export { getRedirectURL } from '@/lib/supabase/auth/utils';
```

Update `/src/lib/client-auth.ts` similarly:

```typescript
/**
 * @deprecated Please import from @/lib/supabase/auth/hooks instead.
 * This file will be removed in a future release.
 */

export {
  useCurrentUser,
  useRequireAuth,
} from '@/lib/supabase/auth/hooks';

export {
  signOut,
  checkAuthAndRedirect,
} from '@/lib/supabase/auth';
```

Update `/src/lib/supabase-server.ts`:

```typescript
/**
 * @deprecated Please import createClient from @/lib/supabase/server instead.
 * This file will be removed in a future release.
 */

import { createClient } from '@/lib/supabase/server';

export const createServerSupabaseClient = createClient;
export const createServerSupabaseClientWithCookies = createClient;
```

### Phase 4: Tests

1. Ensure all new files have unit tests
2. Create integration tests to verify compatibility layer works

## API Reference

| Old Import | New Import |
|------------|------------|
| `import { createClient } from "@/lib/supabase"` | `import { createClient } from "@/lib/supabase/client"` |
| `import { signIn, signOut } from "@/lib/supabase"` | `import { signIn, signOut } from "@/lib/supabase/auth"` |
| `import { useCurrentUser } from "@/lib/client-auth"` | `import { useCurrentUser } from "@/lib/supabase/auth/hooks"` |
| `import { createServerSupabaseClient } from "@/lib/supabase-server"` | `import { createClient } from "@/lib/supabase/server"` |

## Timeline

1. **Phase 1**: Create new files - 2-3 hours
2. **Phase 2**: Create compatibility layer - 1 hour
3. **Phase 3**: Update legacy files - 1 hour
4. **Phase 4**: Write tests - 2-3 hours

Total estimated time: 6-8 hours

## Future Work

Once consumers have migrated to the new imports, we can:

1. Add deprecation warnings to the compatibility layer
2. Set a timeline for removing legacy files
3. Further refine the organization based on usage patterns