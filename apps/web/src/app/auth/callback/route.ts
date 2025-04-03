import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextRequest, NextResponse } from "next/server";

// This route handles the OAuth callback from Supabase authentication
export async function GET(request: NextRequest) {
  console.log("[Auth] Processing callback request");

  // Get the URL and any error parameters
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const recovery = requestUrl.searchParams.get("recovery");

  console.log("[Auth] Callback URL:", request.url);
  console.log("[Auth] Request origin:", requestUrl.origin);
  console.log("[Auth] Request hostname:", requestUrl.hostname);
  console.log("[Auth] Request port:", requestUrl.port);
  console.log("[Auth] Headers origin:", request.headers.get("origin"));
  console.log("[Auth] Headers referer:", request.headers.get("referer"));
  console.log("[Auth] Recovery mode:", recovery ? "true" : "false");

  // Use the origin from the request for redirects
  const targetOrigin = requestUrl.origin;
  console.log("[Auth] Target origin for redirects:", targetOrigin);

  // Check for errors from the OAuth provider
  if (error) {
    console.error(`[Auth] OAuth error: ${error}`, {
      description: errorDescription,
    });
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(errorDescription || error)}`,
        targetOrigin
      )
    );
  }

  // Verify we have the auth code
  if (!code) {
    console.error("[Auth] No code found in callback URL");
    return NextResponse.redirect(
      new URL("/login?error=missing_code", targetOrigin)
    );
  }

  // Create a response for setting cookies and redirecting
  const redirectUrl = new URL("/dashboard", targetOrigin);
  console.log("[Auth] Will redirect to:", redirectUrl.toString());

  const response = NextResponse.redirect(redirectUrl);

  try {
    console.log("[Auth] Creating server-side Supabase client");

    // Create a server client using the request cookies - now properly awaited
    const supabase = await createServerSupabaseClient();

    console.log("[Auth] Exchanging auth code for session");

    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[Auth] Error exchanging code for session:", error.message);
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent(error.message)}`,
          targetOrigin
        )
      );
    }

    if (!data.session) {
      console.error("[Auth] No session returned after code exchange");
      return NextResponse.redirect(
        new URL("/login?error=no_session", targetOrigin)
      );
    }

    // Session established successfully
    console.log("[Auth] Authentication successful", {
      user: data.session.user.email,
      expiresAt: data.session.expires_at
        ? new Date(data.session.expires_at * 1000).toISOString()
        : "unknown",
    });

    // Parse the hostname to determine domain for cookies
    const hostname = requestUrl.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const domain = isLocalhost ? undefined : hostname;

    console.log(
      "[Auth] Setting cookies with domain:",
      domain || "default (localhost)"
    );

    // Set an additional marker cookie for optimistic auth checks in middleware
    // Use precise cookie options to ensure they work across environments
    response.cookies.set("auth-session-established", "true", {
      httpOnly: false, // Allow JavaScript access
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      domain: domain, // Use parsed domain or undefined for localhost
    });

    // Add timestamp for debug purposes
    response.cookies.set("auth-session-time", new Date().toISOString(), {
      httpOnly: false,
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      domain: domain,
    });

    return response;
  } catch (error: any) {
    console.error("[Auth] Unexpected error in callback:", error.message);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("server_error")}`,
        targetOrigin
      )
    );
  }
}
