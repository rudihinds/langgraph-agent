import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    console.log("[API Login] Starting OAuth flow");

    // Use server-side client instead of browser client
    const supabase = await createServerSupabaseClient();

    // Set better redirect URL with an absolute path
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectTo = `${baseUrl}/auth/callback`;

    console.log("[API Login] Using redirect URL:", redirectTo);

    // Generate a login URL with Google OAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        scopes: "email profile",
        queryParams: {
          access_type: "offline", // For refresh token
          prompt: "consent", // Force consent screen
        },
      },
    });

    if (error) {
      console.error("[API Login] OAuth URL creation error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.url) {
      console.error("[API Login] No URL returned from Supabase");
      return NextResponse.json(
        { error: "Failed to generate authentication URL" },
        { status: 500 }
      );
    }

    console.log("[API Login] Successfully generated OAuth URL");

    // Return the URL that will be used for the OAuth flow
    return NextResponse.json({ url: data.url });
  } catch (error) {
    console.error("[API Login] Unexpected error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
