import { NextRequest, NextResponse } from "next/server";

// Define protected and public routes
const protectedRoutes = ["/dashboard", "/proposals", "/new"];
const publicRoutes = ["/login", "/auth", "/"];
const debugRoutes = ["/debug", "/dashboard/test-page", "/dashboard/simple"];

// Middleware for authentication and logging
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  console.log(`[Middleware] Processing path: ${path}`);

  // Log all cookies for debugging
  const allCookies = request.cookies.getAll();
  console.log(
    `[Middleware] Cookies:`,
    allCookies.map(
      (c) =>
        `${c.name}: ${c.value?.substring(0, 20)}${
          c.value?.length > 20 ? "..." : ""
        }`
    )
  );

  // Static path detection - skip middleware processing
  const isStaticResource =
    path.startsWith("/_next") ||
    path.startsWith("/static") ||
    path.startsWith("/api") ||
    path.includes(".") ||
    path.includes("favicon");

  if (isStaticResource) {
    console.log("[Middleware] Skipping middleware for static resource path");
    return NextResponse.next();
  }

  // Check if the route is protected, public, or a debug route
  const isProtectedRoute = protectedRoutes.some((route) =>
    path.startsWith(route)
  );
  const isPublicRoute = publicRoutes.some((route) =>
    route === "/" ? path === "/" : path.startsWith(route)
  );
  const isDebugRoute = debugRoutes.some((route) => path.startsWith(route));

  console.log(
    `[Middleware] Route type: ${
      isProtectedRoute
        ? "protected"
        : isPublicRoute
          ? "public"
          : isDebugRoute
            ? "debug"
            : "other"
    }`
  );

  // Special case for debug routes - always allow them during development
  if (isDebugRoute) {
    console.log("[Middleware] Allowing access to debug route");
    return NextResponse.next();
  }

  // Check for authentication by examining all cookies
  // Look for Supabase auth tokens or our custom auth marker
  let isAuthenticated = false;
  for (const cookie of allCookies) {
    if (
      cookie.name.includes("auth-token") ||
      cookie.name === "auth-session-established" ||
      (cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))
    ) {
      isAuthenticated = true;
      break;
    }
  }

  console.log(
    `[Middleware] Auth state: ${isAuthenticated ? "authenticated" : "not authenticated"}`
  );

  // Protect secured routes
  if (isProtectedRoute && !isAuthenticated) {
    console.log(
      "[Middleware] Unauthenticated user accessing protected route, redirecting to login"
    );

    // Create the full login URL with redirect parameter
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", path);

    return NextResponse.redirect(loginUrl);
  }

  // Redirect already authenticated users from login page to dashboard
  // Only do this for login page, not auth callback
  if (path === "/login" && isAuthenticated) {
    // Don't redirect if there are query parameters like error or recovery
    const hasParams =
      request.nextUrl.searchParams.has("error") ||
      request.nextUrl.searchParams.has("recovery");

    if (!hasParams) {
      console.log(
        "[Middleware] Authenticated user accessing login page, redirecting to dashboard"
      );
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // Allow access to root path for everyone
  if (path === "/") {
    console.log("[Middleware] Allowing access to home page");
    return NextResponse.next();
  }

  // Allow all other routes
  return NextResponse.next();
}

// Configure middleware to run on specific paths but exclude static files
export const config = {
  matcher: [
    // Match all paths except static files and resources
    "/((?!_next/static|_next/image|_next/script|_next/font|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.webp$|.*\\.css$|.*\\.js$|assets).*)",
  ],
};
