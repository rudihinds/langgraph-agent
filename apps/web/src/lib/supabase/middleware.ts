import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ENV } from "@/env";

/**
 * Update the auth session for requests
 * This can be used in middleware to handle auth session refreshing
 * 
 * @param request - The incoming request object
 * @returns NextResponse with updated cookies
 */
export async function updateSession(request: NextRequest) {
  try {
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

    // Check if the request is for a protected route
    const path = request.nextUrl.pathname;
    
    // These paths are always allowed even without authentication
    const isPublicPath = 
      path.startsWith("/login") || 
      path.startsWith("/auth/") || 
      path.startsWith("/api/auth/") ||
      path === "/" ||  // Landing page
      path.startsWith("/_next/") || 
      path.startsWith("/public/") ||
      path.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/);

    // Protect routes that aren't public
    if (!session && !isPublicPath) {
      // Redirect to login if not authenticated
      const redirectUrl = new URL("/login", request.url);
      
      // Optionally store the original URL to redirect back after login
      if (path !== "/login") {
        redirectUrl.searchParams.set("redirect", encodeURIComponent(path));
      }

      // Perform the redirect
      return NextResponse.redirect(redirectUrl);
    }

    // Log auth status but not sensitive details (helpful for debugging)
    if (session) {
      // If user is already logged in and trying to access login page, redirect to dashboard
      if (path.startsWith("/login")) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      
      console.log("[Auth] Authenticated request:", path);
    } else if (!isPublicPath) {
      console.log("[Auth] Unauthenticated request to protected route:", path);
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