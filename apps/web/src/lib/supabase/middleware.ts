import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ENV } from "@/env";

export async function updateSession(request: NextRequest) {
  // This `try/catch` block is only here for the interactive tutorial.
  // In most cases, you can remove it and just return the response.
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
          async getAll() {
            try {
              const allCookies = request.cookies.getAll();
              return allCookies;
            } catch (error) {
              console.error("[Middleware] Error getting cookies:", error);
              return [];
            }
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set({ name, value, ...options });
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              });
              response.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );

    // Refresh the session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    // Log auth status but not sensitive details
    if (session) {
      console.log("[Middleware] User authenticated:", session.user.id);
    } else {
      // Log non-auth paths that don't need protection
      const path = request.nextUrl.pathname;
      if (
        !path.startsWith("/_next") &&
        !path.startsWith("/api/") &&
        !path.includes(".") &&
        !path.startsWith("/auth")
      ) {
        console.log("[Middleware] Unauthenticated request:", path);
      }
    }

    return response;
  } catch (e) {
    // If you are here, a Supabase client could not be created!
    // This is likely because you have not set up environment variables.
    // TODO: Feel free to remove this `try/catch` block once you have
    // set up your environment variables.
    console.error("[Middleware] Error refreshing session:", e);
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
}
