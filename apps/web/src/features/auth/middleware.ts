import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ENV } from "@/env";

// Protected paths that require authentication
const PROTECTED_PATHS = ["/dashboard", "/proposals", "/account", "/settings"];

// Public paths that are always accessible
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/auth",
  "/api/auth",
  "/features",
  "/pricing",
  "/help",
  "/_next",
  "/public",
];

// Check if a path should be protected by authentication
function isProtectedPath(path: string): boolean {
  return PROTECTED_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

// Check if a path is public and doesn't need authentication
function isPublicPath(path: string): boolean {
  // Static assets are always public
  if (path.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)) {
    return true;
  }

  return PUBLIC_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

/**
 * Update the auth session for requests
 * This can be used in middleware to handle auth session refreshing
 *
 * @param request - The incoming request object
 * @returns NextResponse with updated cookies
 */
export async function updateSession(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname;

    // Create an unmodified response
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    // Create a Supabase client using the request and response
    const supabase = createServerClient(
      ENV.NEXT_PUBLIC_SUPABASE_URL,
      ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set({
                name,
                value,
                ...options,
              });
            });
          },
        },
      }
    );

    // Refresh the session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Check if the path requires authentication
    const needsAuth = isProtectedPath(path);
    const isPublic = isPublicPath(path);

    // Handle protected routes that require authentication
    if (needsAuth && !session) {
      console.log(
        `[Middleware] Redirecting unauthenticated user from protected path: ${path}`
      );

      // Redirect to login
      const redirectUrl = new URL("/login", request.url);

      // Store the original URL to redirect back after login
      redirectUrl.searchParams.set("redirect", encodeURIComponent(path));

      return NextResponse.redirect(redirectUrl);
    }

    // Redirect authenticated users from login page to dashboard
    if (session && path === "/login") {
      console.log(
        "[Middleware] Redirecting authenticated user from login to dashboard"
      );
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return response;
  } catch (e) {
    // If there's an error, log it but don't break the application
    console.error("[Middleware] Error in auth middleware:", e);

    // Return unmodified response to avoid breaking the app
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
}
