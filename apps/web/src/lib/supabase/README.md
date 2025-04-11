# Supabase Authentication

This module provides server-side and client-side Supabase clients for authentication.

## Critical Implementation Details

### Server-side Client

The server-side client is implemented in `server.ts` and follows these key patterns:

1. **Error Handling**: The client explicitly throws errors instead of returning `null` when initialization fails.
2. **Auth Verification**: We verify that the client has a valid `auth` property after initialization.
3. **Cookie Handling**: Uses the correct cookie pattern from Supabase's SSR documentation.

### Important: Cookie Pattern

The only valid cookie pattern for `@supabase/ssr` is:

```typescript
{
  cookies: {
    getAll() {
      return cookieStore.getAll();
    },
    setAll(cookiesToSet) {
      cookiesToSet.forEach(({ name, value, options }) =>
        cookieStore.set(name, value, options)
      );
    },
  },
}
```

❌ **DO NOT USE** the individual `get`/`set`/`remove` cookie methods as they are deprecated and will cause authentication failures.

## Testing

We have comprehensive tests to ensure the Supabase client behaves correctly:

1. Tests for server.ts to verify proper client initialization and error handling
2. Tests for the authentication API routes to verify they handle edge cases properly

Run the tests with:

```bash
npm test -- --filter=supabase
```

## Common Issues and Solutions

1. **"Cannot read properties of undefined (reading 'signInWithOAuth')"**: This indicates the Supabase client was not correctly initialized or the auth property is missing. Make sure:
   - Environment variables are properly set
   - The cookie handling uses the correct pattern
   - Errors are handled properly

2. **"Missing NEXT_PUBLIC_SUPABASE_URL environment variable"**: Ensure your `.env.local` file has the correct Supabase project URL.

3. **Authentication loops**: Ensure the middleware is correctly implemented and doesn't redirect authenticated users to login pages.

## Package Versions

The authentication system is built with the following package versions:

- `@supabase/supabase-js`: "^2.39.8"
- `@supabase/ssr`: "^0.6.1"

⚠️ Always test thoroughly when upgrading these packages as their APIs may change.