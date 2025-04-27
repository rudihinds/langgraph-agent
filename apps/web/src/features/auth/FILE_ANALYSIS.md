# Supabase Files Analysis

This document provides a detailed analysis of the current Supabase-related files, their functions, and dependencies.

## `/src/lib/supabase.ts`

**Purpose**: Client-side Supabase utilities

**Functions**:

1. `createClient()`
   - Creates browser client using `createBrowserClient` from `@supabase/ssr`
   - Dependencies: None
   - Used by: All other functions in this file

2. `getRedirectURL()`
   - Gets the current origin or fallback URL for OAuth redirects
   - Dependencies: None
   - Used by: `signIn()`

3. `signIn()`
   - Initiates Google OAuth sign-in flow
   - Dependencies: `createClient()`, `getRedirectURL()`
   - Side effects: Redirects to Google auth page

4. `signOut()`
   - Signs out user on both client and server
   - Dependencies: `createClient()`
   - API calls: POST to `/api/auth/sign-out`
   - Side effects: Redirects to `/login`

5. `getSession()`
   - Gets current Supabase session
   - Dependencies: `createClient()`

6. `getAccessToken()`
   - Extracts access token from session
   - Dependencies: `createClient()`

7. `validateSession()`
   - Validates and refreshes session if needed
   - Dependencies: `createClient()`

8. `getCurrentUser()`
   - Gets current authenticated user
   - Dependencies: `createClient()`

**Notes**:
- Has client-side specific code (window, localStorage)
- All functions use the same client creation pattern
- Extensive error handling and logging

## `/src/lib/supabase-server.ts`

**Purpose**: Server-side client creation

**Functions**:

1. `createServerSupabaseClient()`
   - Creates server-side Supabase client
   - Dependencies: `cookies()` from `next/headers`
   - Already marked as deprecated

2. `createServerSupabaseClientWithCookies()`
   - Creates server-side client with provided cookie store
   - Dependencies: None (cookie store passed as parameter)
   - Already marked as deprecated

**Notes**:
- Using the correct `getAll`/`setAll` cookie pattern
- Both functions are already marked as deprecated with pointers to the new implementation

## `/src/lib/client-auth.ts`

**Purpose**: React hooks for auth state

**Functions**:

1. `useCurrentUser()`
   - React hook that provides current user, loading state, and errors
   - Dependencies: `createClient()` from `@/lib/supabase/client`
   - Sets up auth state change listener
   - Refreshes router on auth changes

2. `useRequireAuth()`
   - Hook that redirects to login if not authenticated
   - Dependencies: `useCurrentUser()`, `useRouter()`
   - Side effects: Redirects to `/login` if not authenticated

3. `checkAuthAndRedirect()`
   - Checks auth and redirects if not authenticated
   - Dependencies: `createClient()` from `@/lib/supabase/client`
   - Side effects: Redirects to `/login` if not authenticated

4. `signOut()`
   - Signs out user with server-side support
   - Dependencies: `createClient()` from `@/lib/supabase/client`
   - API calls: POST to `/api/auth/sign-out`
   - Side effects: Redirects to provided URL (defaults to `/login`)

**Notes**:
- Client-only functionality (marked with "use client")
- Duplicate `signOut()` implementation with `supabase.ts`
- Uses Next.js router for navigation

## `/src/lib/supabase/client.ts`

**Purpose**: New pattern browser client

**Functions**:

1. `createClient()`
   - Creates browser-side Supabase client
   - Dependencies: `createBrowserClient` from `@supabase/ssr`

**Notes**:
- Very simple implementation
- Follows current Supabase best practices

## `/src/lib/supabase/server.ts`

**Purpose**: New pattern server client

**Functions**:

1. `createClient()`
   - Creates server-side Supabase client
   - Dependencies: `createServerClient` from `@supabase/ssr`, `cookies` from `next/headers`
   - Properly validates environment variables
   - Throws errors instead of returning null
   - Uses cache from React

**Notes**:
- Robust implementation with proper error handling
- Uses the correct cookie pattern
- Cached using React's cache function

## `/src/lib/supabase/middleware.ts`

**Purpose**: Auth handling for Next.js middleware

**Functions**:

1. `updateSession()`
   - Updates the auth session in Next.js middleware
   - Dependencies: `createServerClient` from `@supabase/ssr`
   - Used by middleware to refresh tokens

**Notes**:
- Properly handles cookies in middleware context
- Logs authentication state but not sensitive details

## Dependencies Analysis

1. **Internal Dependencies**:
   - `client-auth.ts` depends on `supabase/client.ts`
   - `supabase.ts` has no external dependencies within the project
   - `supabase-server.ts` has no external dependencies within the project

2. **External Dependencies**:
   - `@supabase/ssr`: Used by all files
   - `next/headers`: Used by server-side files
   - `next/navigation`: Used by `client-auth.ts`
   - `react`: Used by `client-auth.ts`

## Migration Considerations

1. **Duplicated Functionality**:
   - `signOut()` exists in both `supabase.ts` and `client-auth.ts`
   - Both implementations make a POST request to `/api/auth/sign-out`

2. **Cross-Cutting Concerns**:
   - Error handling patterns differ slightly between files
   - Logging is inconsistent between files

3. **Breaking Changes Risk**:
   - `useCurrentUser()` hook has consumers that expect specific interface
   - Auth state change listeners may be coupled to specific implementations

4. **Type Safety**:
   - Many functions use `any` types or inferred types
   - Session and user types could benefit from explicit interfaces

## Recommendations

1. Start by consolidating the type definitions
2. Migrate hooks with careful attention to maintaining the exact same interface
3. Use a single implementation for `signOut()` in `auth/actions.ts`
4. Standardize error handling and logging across all functions