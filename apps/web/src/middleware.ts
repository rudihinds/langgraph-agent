import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(png|jpg|jpeg|svg|gif|webp)).*)",
  ],
};

// Protected paths that require authentication
const PROTECTED_PATHS = ["/dashboard", "/proposals", "/account", "/settings"];

// Check if a path should be protected
function isProtectedPath(path: string): boolean {
  return PROTECTED_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

/**
 * Middleware function that runs before each request
 * Handles authentication and session management
 */
export async function middleware(request: NextRequest) {
  console.log(`[Middleware] Processing ${request.nextUrl.pathname}`);

  // Check if we should skip middleware processing
  if (request.headers.get("x-no-redirect") === "true") {
    console.log("[Middleware] Skipping redirect due to x-no-redirect header");
    return NextResponse.next();
  }

  // Check if we're in a redirect loop
  const redirectCount = parseInt(
    request.headers.get("x-redirect-count") || "0"
  );

  if (redirectCount > 2) {
    console.error(
      `[Middleware] Detected redirect loop for path: ${request.nextUrl.pathname}`
    );

    // Break the loop by redirecting to an explicit page with no more redirects
    if (isProtectedPath(request.nextUrl.pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "auth_required");
      loginUrl.searchParams.set("from", request.nextUrl.pathname);

      // Create a response with explicit NO_REDIRECT flag
      const response = NextResponse.redirect(loginUrl);
      response.headers.set("x-no-redirect", "true");
      return response;
    }

    // If we're already on the login page, just let it through
    return NextResponse.next();
  }

  try {
    // Update session and handle authentication
    const response = await updateSession(request);

    // Add a header to track redirect attempts
    if (response.headers.get("location")) {
      response.headers.set("x-redirect-count", (redirectCount + 1).toString());
    }

    return response;
  } catch (error) {
    console.error("[Middleware] Error processing request:", error);

    // In case of error, allow the request to proceed to avoid breaking the app
    // But redirect to login if this was a protected route
    if (isProtectedPath(request.nextUrl.pathname)) {
      console.log(
        "[Middleware] Redirecting to login due to auth error on protected route"
      );
      const loginUrl = new URL("/login", request.url);
      const response = NextResponse.redirect(loginUrl);
      // Set the no-redirect flag to prevent loops
      response.headers.set("x-no-redirect", "true");
      return response;
    }

    return NextResponse.next();
  }
}
