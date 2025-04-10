# Supabase Authentication Implementation

This document outlines how we've implemented Supabase authentication in our application following the recommended patterns from the Supabase team.

## Key Components

### 1. Supabase Client Files

We've created separate client files for browser and server contexts:

- `/lib/supabase/client.ts` - Client-side Supabase client
- `/lib/supabase/server.ts` - Server-side Supabase client

### 2. Authentication Middleware

The middleware at `/middleware.ts` handles authentication checks and redirects unauthenticated users to the login page.

### 3. User Management

We've implemented a system to synchronize users between Supabase Auth and our application's `users` table:

- `syncUserToDatabase` function ensures that when a user authenticates, they have a corresponding record in our `users` table
- `ensureUserExists` function can be called from server actions and components to verify user existence
- Auth routes (sign-up, sign-in, callback, sign-out, verify-user) maintain user data consistency

### 4. Client-Side Hooks & Utilities

We've created React hooks to handle authentication in the client:

- `useCurrentUser` - Returns the current authenticated user
- `useRequireAuth` - Redirects to login if not authenticated
- `signOut` - Handles proper sign-out on both client and server
- `checkAuthAndRedirect` - Redirects if not authenticated

### 5. Authentication Endpoints

- `/api/auth/sign-up` - Creates a new user in Supabase Auth and syncs to database
- `/api/auth/sign-in` - Authenticates an existing user and syncs to database
- `/api/auth/sign-out` - Properly signs out on both client and server
- `/api/auth/verify-user` - Verifies a user exists in our database and creates if not
- `/auth/callback` - Handles OAuth callback and syncs user to database

## Implementation Details

### Supabase Client Pattern

We follow the recommended pattern from Supabase for cookie handling:

```typescript
// Browser client
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server client
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient(cookieStore: ReturnType<typeof cookies>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return await cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
```

### Middleware Implementation

The middleware checks if the user is authenticated and redirects to the login page if not:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(/* configuration */);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

### User Synchronization

We ensure that whenever a user authenticates, they have a corresponding record in our `users` table:

```typescript
export async function syncUserToDatabase(
  supabase: SupabaseClient,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any> | null;
  }
) {
  // Check if user exists in the users table
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .single();

  const now = new Date().toISOString();

  if (!existingUser) {
    // Create new user record
    await supabase.from("users").insert({
      id: user.id,
      email: user.email,
      // Make sure to set timestamps explicitly to avoid RLS issues
      created_at: now,
      last_login: now,
      // ... other fields
    });
  } else {
    // Update existing user
    await supabase.from("users").update({ last_login: now }).eq("id", user.id);
  }
}
```

### Proactive User Verification

We added a user verification endpoint and client-side integration:

```typescript
// Server-side endpoint
export async function POST(req: Request) {
  // Get authenticated user
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (!authData?.user) return error response;

  // Ensure user record exists
  const result = await ensureUserExists();

  return success response;
}

// Client-side verification in forms
useEffect(() => {
  if (user) {
    const verifyUserInDatabase = async () => {
      const result = await fetch('/api/auth/verify-user', {
        method: 'POST',
      });

      // Handle result...
    };

    verifyUserInDatabase();
  }
}, [user]);
```

### Proper Sign-Out

We implemented a comprehensive sign-out solution that works on both client and server:

```typescript
// Server-side endpoint
export async function POST(req: Request) {
  const { error } = await supabase.auth.signOut();
  // Return response...
}

// Client-side utility
export async function signOut(redirectTo: string = "/login") {
  // Call server endpoint first
  await fetch("/api/auth/sign-out", { method: "POST" });

  // Also sign out on client side
  const supabase = createClient();
  await supabase.auth.signOut();

  // Redirect to login page
  window.location.href = redirectTo;
}
```

### Error Handling in Form Components

We've enhanced error handling in form components that interact with authentication:

```typescript
// Client-side verification in form components
const verifyUserInDatabase = async () => {
  try {
    const result = await fetch("/api/auth/verify-user", {
      method: "POST",
    });

    if (!result.ok) {
      let errorData = {};
      try {
        errorData = await result.json();
      } catch (parseError) {
        console.error("Failed to parse error response:", parseError);
        errorData = { message: "Unknown error occurred" };
      }

      console.error(
        "User verification failed:",
        errorData || { status: result.status }
      );

      // Handle different error cases
      if (result.status === 401) {
        // Session expired, redirect to login
      } else if (result.status === 500 && errorData?.message?.includes("RLS")) {
        // Handle Row Level Security policy violations
      } else {
        // Other errors
      }
    }
  } catch (error) {
    // Handle network errors
  }
};
```

## Troubleshooting Common Issues

### 1. The `cookies().getAll()` error

**Problem**: The error "Route used `cookies().getAll()`. `cookies()` should be awaited before using its value."

**Solution**: Next.js expects cookie operations to be awaited. Update your Supabase server client:

```typescript
// In server.ts
{
  cookies: {
    async getAll() {
      return await cookieStore.getAll();
    },
  }
}
```

### 2. Database Record Field Errors

**Problem**: Errors like "record 'new' has no field 'updated_at'" when syncing users.

**Solution**:

- Explicitly set all timestamp fields when creating or updating records
- Make sure that the SQL schema matches what your code expects
- Use a timestamp variable to ensure consistency:

```typescript
const now = new Date().toISOString();
// Use 'now' in both insert and update operations
```

### 3. Row Level Security (RLS) Violations

**Problem**: Database permission denied errors with code '42501'

**Solution**:

- Check that your RLS policies are correctly set up for the users table
- Ensure that authenticated users can read/write their own records
- Add explicit error handling for RLS errors in client components:

```typescript
if (result.status === 500 && errorData?.message?.includes("RLS")) {
  // Handle Row Level Security policy violations
  toast({
    title: "Database Access Denied",
    description: "You don't have permission to access this resource.",
    variant: "destructive",
  });
}
```

## Changes Made

1. Created new Supabase client files (`client.ts` and `server.ts`)
2. Updated middleware to use the new client pattern
3. Updated auth routes (sign-up, sign-in, callback) to use the new client pattern
4. Added user synchronization to ensure users exist in our database
5. Created client-side auth hooks
6. Updated tests to work with the new implementation
7. Added sign-out functionality with proper server and client handling
8. Added user verification endpoint to proactively check user existence
9. Enhanced error handling for auth-related issues
10. Fixed async cookie handling in the server client
11. Improved error handling for empty responses in form components
12. Fixed timestamp handling in user table operations

## Compatibility

The changes maintain backward compatibility through:

1. A compatibility layer in `supabase-server.ts` that maps legacy calls to the new pattern
2. Preserving existing route handlers for now

## Next Steps

1. Remove deprecated client patterns completely
2. Update remaining server actions to use the new client pattern
3. Add more comprehensive error handling
4. Implement authenticated API routes using the new pattern

## Testing Strategy

We've implemented comprehensive tests for the Supabase authentication implementation to ensure reliability and proper error handling. The testing approach includes:

### Test Categories

1. **Middleware Tests**: Verify that authentication middleware protects routes correctly and handles various authentication scenarios.

2. **User Management Tests**: Ensure that user synchronization between Supabase Auth and our database works properly, including error handling.

3. **Client Authentication Tests**: Test client-side hooks for managing authentication state and user sessions.

4. **Authentication Endpoints Tests**: Verify that sign-in, sign-up, sign-out, and user verification endpoints function correctly.

### Testing Methodology

Our tests follow these principles:

1. **Isolation**: Each test focuses on a specific functionality with appropriate mocking of dependencies.

2. **Edge Cases**: Tests include handling of error conditions, unexpected inputs, and authentication failures.

3. **Mock Integration**: Supabase clients are mocked to allow testing without actual database connections.

4. **Full Coverage**: All authentication paths are tested, including success and failure scenarios.

### Key Test Files

- `apps/web/__tests__/middleware.test.ts`: Tests for authentication middleware
- `apps/web/src/lib/__tests__/user-management.test.ts`: Tests for user database synchronization
- `apps/web/src/lib/__tests__/client-auth.test.tsx`: Tests for client-side authentication hooks
- `apps/web/src/app/api/auth/*/__tests__/`: Tests for authentication endpoints

For more detailed information about the testing implementation, see [AUTHENTICATION_TESTING.md](./AUTHENTICATION_TESTING.md).
