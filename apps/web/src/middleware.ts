import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function middleware(request: NextRequest) {
  // Define the protected routes that require authentication
  const protectedRoutes = ["/proposals", "/new"];
  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // Skip middleware for non-protected routes and API routes
  if (!isProtectedRoute || request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Get the supabase auth cookie from the request
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    return NextResponse.next();
  }

  // Create a Supabase client
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get the session from the cookie
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // If there's no active session and the route is protected, redirect to login
    if (!session && isProtectedRoute) {
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
