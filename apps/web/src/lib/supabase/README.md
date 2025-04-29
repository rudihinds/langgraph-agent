# Supabase Authentication

This module provides server-side and client-side Supabase clients and utilities for authentication within the Next.js application, leveraging `@supabase/ssr` for server-side rendering and cookie management.

## Directory Structure

The core Supabase integration logic resides in `/src/lib/supabase/`. Authentication-specific features (hooks, HOCs, UI components) are located within `/src/features/auth/`.

```
/src/
├── features/
│   └── auth/
│       ├── api/         # Server actions or related API logic (if any)
│       ├── components/  # Auth-related UI components (e.g., LoginForm, UserAvatar)
│       ├── hoc/         # Higher-Order Components (e.g., withAuth)
│       ├── hooks/       # React hooks for auth state and actions (e.g., useCurrentUser)
│       └── types/       # Auth-specific TypeScript types
│
└── lib/
    └── supabase/
        ├── client.ts          # Browser client creation (using @supabase/ssr)
        ├── server.ts          # Server client creation (using @supabase/ssr)
        ├── auth/
        │   ├── index.ts       # Main auth exports (signIn, signOut actions)
        │   ├── hooks.ts       # React hooks (useCurrentUser, useRequireAuth) - Re-exports from features/auth/hooks
        │   ├── actions.ts     # Core auth actions (signIn, signOut)
        │   └── utils.ts       # Auth utility functions (e.g., PKCE)
        ├── middleware.ts      # Middleware for session management (critical for SSR)
        ├── types/             # Core Supabase related types
        │   └── index.ts
        ├── errors.ts          # Supabase specific error handling utilities
        ├── compatibility.ts   # Legacy exports (deprecated)
        └── README.md          # This documentation
```

## Usage Examples

### 1. Server-side Client (API Routes, Server Components)

Use the server client for operations within API routes or React Server Components (RSCs). It correctly handles cookies based on the request context.

```typescript
// Example: In an API Route (app/api/...)
// or a Server Component (app/.../page.tsx)
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export async function GET() {
  // Must await cookies() before passing to createClient
  const cookieStore = cookies();
  const supabase = await createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Handle unauthenticated user
    return new Response("Unauthorized", { status: 401 });
  }

  // ... proceed with authenticated logic ...

  return new Response(JSON.stringify({ message: "Hello user!" }));
}
```

### 2. Client-side Hooks (Client Components)

Use these hooks within Client Components (`'use client';`) to interact with the user's authentication state.

**a) Checking the Current User:**

```typescript
// In a client component (e.g., Header)
'use client';
import { useCurrentUser } from '@/features/auth/hooks/authHooks'; // Import directly from features
import { signIn, signOut } from '@/lib/supabase/auth'; // Core actions from lib
import { Button } from '@/features/ui/components/button'; // Example UI component

export default function AuthStatus() {
  const { user, loading } = useCurrentUser();

  if (loading) return <div>Loading auth status...</div>;

  return user ? (
    <div>
      <span>Welcome, {user.email}</span>
      <Button variant="outline" onClick={() => signOut()}>Sign Out</Button>
    </div>
  ) : (
    <Button onClick={() => signIn('google')}>Sign In with Google</Button> // Or other providers
  );
}
```

**b) Requiring Authentication for a Page/Component:**

The `useRequireAuth` hook redirects unauthenticated users to the login page.

```typescript
// In a client component page (e.g., app/dashboard/page.tsx)
'use client';
import { useRequireAuth } from '@/features/auth/hooks/authHooks'; // Import directly from features

export default function DashboardPage() {
  // This hook handles loading state and redirection if not authenticated
  const { user, loading } = useRequireAuth();

  // Optional: Show a loading indicator
  if (loading) return <div>Loading dashboard...</div>;

  // If the hook finished loading and there's no user, it will have redirected.
  // This component won't render further for unauthenticated users.
  // It's safe to assume 'user' is available here if loading is false.
  if (!user) return null;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome, {user.email}. This is protected content.</p>
      {/* Add dashboard content here */}
    </div>
  );
}
```

### 3. `withAuth` Higher-Order Component (HOC)

The `withAuth` HOC provides an alternative way to protect pages or components, handling the loading state and redirection automatically. It's particularly useful for wrapping Page components.

```typescript
// Example: Protecting a page component (app/settings/page.tsx)
import { withAuth } from '@/features/auth/hoc/with-auth';

// Define your page component as usual
function SettingsPage({ user }) {
  // 'user' prop is guaranteed to be available here
  return (
    <div>
      <h1>Settings</h1>
      <p>Manage settings for {user.email}.</p>
      {/* Add settings content */}
    </div>
  );
}

// Wrap the component with the HOC before exporting
export default withAuth(SettingsPage);
```

**Note:** The `withAuth` HOC likely uses `useRequireAuth` internally. Choose the method (hook or HOC) that best fits your component structure and preference.

## Critical Implementation Details

### Server-side Client (`server.ts`)

The server-side client MUST be used for any server-context operations (API Routes, RSCs, Server Actions).

1.  **Cookie Handling:** It strictly uses the `getAll`/`setAll` pattern required by `@supabase/ssr` via the `cookies()` helper from `next/headers`. **Using the deprecated `get`/`set`/`remove` methods WILL BREAK authentication.**
2.  **Context:** Always obtain the `cookieStore` using `cookies()` from `next/headers` within the server context (RSC, Route Handler, Server Action) and pass it to `createClient`.

### Client-side Client (`client.ts`)

The client-side client is simpler and used automatically by the hooks. It doesn't require manual cookie handling in component code.

### Middleware (`middleware.ts`)

The middleware (`/src/lib/supabase/middleware.ts`, configured in `/src/middleware.ts`) is **CRUCIAL** for maintaining the user session.

1.  **Session Refresh:** It automatically refreshes the user's session token on navigation.
2.  **Cookie Synchronization:** It ensures cookies are correctly synchronized between the browser and server using the `getAll`/`setAll` pattern with the `request` and `response` objects.
3.  **Protection:** It redirects unauthenticated users trying to access protected routes (defined in `config.matcher`) to the login page.
4.  **`auth.getUser()`:** The middleware **MUST** call `supabase.auth.getUser()` to trigger the session refresh logic within `@supabase/ssr`. Removing this call will break session management.

### Important: Cookie Pattern for `@supabase/ssr`

The **ONLY** valid cookie pattern for `createServerClient` in `@supabase/ssr` (used in `server.ts` and `middleware.ts`) involves the `getAll` and `setAll` methods. Refer to `SUPABASE_SETUP_GUIDE.md` for the exact, required implementation details.

❌ **DO NOT USE** individual `get`/`set`/`remove` cookie methods.
❌ **DO NOT USE** `@supabase/auth-helpers-nextjs`.

## Legacy Code Compatibility

The following files provided compatibility during the refactor but are **deprecated** and should no longer be used directly. Update imports to use the new structure (`/src/lib/supabase/` or `/src/features/auth/`):

- `/src/lib/supabase.ts` → Use `/src/lib/supabase/auth`, `/src/lib/supabase/client`, or `/src/lib/supabase/server`.
- `/src/lib/client-auth.ts` → Use hooks from `/src/features/auth/hooks/authHooks`.
- `/src/lib/supabase-server.ts` → Use `/src/lib/supabase/server`.

These legacy files may be removed in the future.

## Testing

Comprehensive tests exist for the core Supabase integration and authentication logic. Run relevant tests using:

```bash
# Run all tests related to supabase library
npm test -- --filter=src/lib/supabase

# Run all tests related to the auth feature
npm test -- --filter=src/features/auth
```

## Common Issues and Solutions

1.  **"Cannot read properties of undefined (reading 'signInWithOAuth')" / Client errors:** Indicates the Supabase client wasn't correctly initialized or accessed. Ensure:
    - Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are correctly set in `.env.local` (and `.env.production` for builds).
    - Server-side: `cookies()` was called correctly and passed to `createClient`.
    - Middleware is correctly implemented and returning the `supabaseResponse` properly.
    - The correct `getAll`/`setAll` cookie pattern is used everywhere.
2.  **Authentication loops / Unexpected sign-outs:** Often caused by incorrect middleware implementation or cookie handling issues.
    - Verify `middleware.ts` matches the pattern in `SUPABASE_SETUP_GUIDE.md`.
    - Ensure `supabase.auth.getUser()` is called within the middleware.
    - Ensure custom `NextResponse` objects in middleware correctly copy Supabase cookies.
    - Check `config.matcher` in `middleware.ts` to ensure it correctly excludes public paths.
3.  **"Invalid Refresh Token" / Session issues:** Could be related to clock skew or middleware not refreshing tokens correctly. Verify middleware implementation.

## Package Versions

The authentication system relies on:

- `@supabase/supabase-js`: See `package.json`
- `@supabase/ssr`: See `package.json`

⚠️ Always test authentication thoroughly when upgrading these packages, paying close attention to any changes in the `@supabase/ssr` cookie handling or middleware requirements. Consult the official Supabase documentation.

## Communicating with the Backend API

Our application architecture consists of this Next.js frontend (`apps/web`), a separate backend API server (`apps/backend`), and potentially other services like the LangGraph agent server. This section focuses on how the frontend should make authenticated calls to the main backend API (`apps/backend`).

### Backend Authentication Expectation

The backend API server uses middleware (`apps/backend/lib/middleware/auth.js`) to protect its routes. This middleware expects a valid Supabase JSON Web Token (JWT) to be included in the `Authorization` header of incoming requests, formatted as `Bearer <your_jwt_token>`.

### Recommended Frontend Pattern: Explicit Header Injection

While the frontend manages the user's session and JWT via cookies using `@supabase/ssr`, the most reliable way to authenticate API calls _from the frontend client-side code to the separate backend server_ is to **explicitly include the JWT in the `Authorization` header**.

**Why this pattern?**

- **Reliability:** It works consistently regardless of whether the frontend and backend are on the same domain, different subdomains, or different domains entirely.
- **Explicitness:** The authentication mechanism is clear in the API calling code.
- **Control:** It doesn't rely on potentially complex browser cookie forwarding behaviors, especially for cross-origin requests.

**Implementation:**

When making calls to protected backend endpoints from client components or frontend utilities, you should:

1.  Get the current session from the Supabase client.
2.  Extract the `access_token` (JWT).
3.  Add the `Authorization` header to your `fetch` request (or Axios/other library request).

**Conceptual Example (using fetch):**

```typescript
import { createClient } from "@/lib/supabase"; // Import browser client

async function fetchProtectedBackendData(
  endpoint: string,
  options: RequestInit = {}
) {
  const supabase = createClient(); // Create browser client instance

  // Get the current session data
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    console.error("Error getting session or no active session", sessionError);
    // Handle appropriately - maybe redirect to login or throw error
    throw new Error("User not authenticated");
  }

  const token = session.access_token;

  // Prepare headers
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json"); // Example header

  // Make the fetch call to your backend API
  const backendApiUrl =
    process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:3001"; // Example URL

  try {
    const response = await fetch(`${backendApiUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // Handle backend API errors (e.g., 401, 403, 500)
      const errorData = await response
        .json()
        .catch(() => ({ message: "Failed to parse error response" }));
      console.error(`Backend API Error (${response.status}):`, errorData);
      throw new Error(`API request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Network or fetch error:", error);
    throw error; // Re-throw for higher-level handling
  }
}

// --- Usage Example in a Client Component ---
async function loadData() {
  try {
    const data = await fetchProtectedBackendData("/api/v1/my-data");
    // Process data
  } catch (error) {
    // Handle fetch or auth error
  }
}
```

**Note:** You might encapsulate this logic within a custom hook (e.g., `useAuthenticatedApi`) or a dedicated API client utility for cleaner usage throughout the application.

### Existing Authentication Flow

This guidance applies specifically to making authenticated API calls _from the frontend to the backend_ after a user is logged in. It does **not** require changes to the existing login, sign-up, or OAuth callback flows, which are correctly handled by the `@supabase/ssr` setup and the API routes in `/app/api/auth/`.

### Communicating with Other Services (e.g., LangGraph Agent)

If the LangGraph agent server (or other backend services) has its own separate authentication mechanism (e.g., dedicated API keys), communication with those services will require implementing their specific authentication patterns, which may differ from the JWT pattern used for the main backend API.

## Testing

// ... existing testing section ...
