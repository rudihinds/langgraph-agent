import { createServerClient } from "@/lib/supabase";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// Helper to get cookie store safely
function getCookieStore() {
  try {
    return cookies();
  } catch (e) {
    console.error("[Auth] Error accessing cookies:", e);
    throw new Error("Could not access cookies");
  }
}

// This route handles the OAuth callback from Supabase authentication
export async function GET(request: NextRequest) {
  console.log("[Auth] Processing callback request");

  // Get the URL and any error parameters
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Log debugging information
  console.log("[Auth] Callback URL parameters:", {
    code: code ? "present" : "none",
    error: error || "none",
    errorDescription: errorDescription || "none",
  });
  console.log("[Auth] Request origin:", requestUrl.origin);
  console.log("[Auth] Request hostname:", requestUrl.hostname);

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

  try {
    console.log("[Auth] Creating server-side Supabase client");

    // Create the Supabase client first so we get automatic cookie handling
    const supabase = await createServerClient();

    console.log("[Auth] Exchanging auth code for session");

    // Exchange the code for a session - we don't need to manually pass code verifier
    // Supabase will handle retrieving it from cookies automatically
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

    // User authentication successful - Supabase handles user management automatically

    // Create a response with the right cookies
    const redirectUrl = new URL("/dashboard", targetOrigin);
    console.log("[Auth] Will redirect to:", redirectUrl.toString());

    const response = NextResponse.redirect(redirectUrl);

    // Parse the hostname to determine domain for cookies
    const hostname = requestUrl.hostname;
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const domain = isLocalhost ? undefined : hostname;

    console.log(
      "[Auth] Setting cookies with domain:",
      domain || "default (localhost)"
    );

    // Set an additional marker cookie for optimistic auth checks
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
    console.error(
      "[Auth] Unexpected error in callback:",
      error.message,
      error.stack
    );
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("server_error")}&details=${encodeURIComponent(error.message || "Unknown error")}`,
        targetOrigin
      )
    );
  }
}
