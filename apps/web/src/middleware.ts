import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Define the protected routes that require authentication
const protectedRoutes = ["/proposals", "/new"];

export async function middleware(request: NextRequest) {
  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Skip middleware for non-protected routes and API routes
  if (!isProtectedRoute || request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Get Supabase cookies from the request for server-side auth check
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    return NextResponse.next();
  }

  // Create a Supabase client with the cookies from the request
  const supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false, // Don't persist in middleware context
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // Get the auth cookies from the request
  const authCookie =
    request.cookies.get("sb-auth-token") ||
    request.cookies.get("supabase-auth-token");

  // If no auth cookie is present, redirect to login
  if (!authCookie) {
    console.log("No auth cookie found, redirecting to login");
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    // Try to get the session using the cookie
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    // If there's no active session and the route is protected, redirect to login
    if (!session && isProtectedRoute) {
      console.log("No active session found, redirecting to login");
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    console.error("Error in auth middleware:", error);
  }

  return NextResponse.next();
}

// Run middleware on all routes except static files and api routes
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
