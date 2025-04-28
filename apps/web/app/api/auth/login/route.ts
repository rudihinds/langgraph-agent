import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generatePKCEVerifier } from "@/lib/supabase/auth/pkce";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    console.log("[Auth] Processing login GET request");

    // Generate PKCE code verifier and code challenge
    const { codeVerifier, codeChallenge } = await generatePKCEVerifier();

    try {
      const supabase = await createClient();

      console.log(
        "[SupabaseClient] Creating server client with URL:",
        process.env.NEXT_PUBLIC_SUPABASE_URL
      );
      console.log("[Auth] Generating OAuth URL for Google login");

      // Generate the OAuth URL for Google login
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${new URL(req.url).origin}/auth/callback`,
          // Add PKCE parameters
          codeChallenge,
          codeChallengeMethod: "S256",
        },
      });

      if (error) {
        console.error("[Auth] OAuth URL generation failed:", error);
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      // Store the code verifier in a cookie to retrieve it during the callback
      const response = NextResponse.json({ url: data.url }, { status: 200 });

      // Set the code verifier as a cookie that will be available for the callback
      response.cookies.set("supabase-auth-code-verifier", codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 10, // 10 minutes
        sameSite: "lax",
      });

      console.log("[Auth] OAuth URL generated successfully");
      return response;
    } catch (error) {
      console.error("[Auth] Error in Supabase client operation:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Authentication service error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Auth] Unexpected error in login GET route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    console.log("[Auth] Processing login POST request");
    const authRequest = await req.json();

    try {
      const supabase = await createClient();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: authRequest.email,
        password: authRequest.password,
      });

      if (error) {
        console.error("[Auth] Password login failed:", error);
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      console.log("[Auth] Password login successful");
      return NextResponse.json(
        {
          user: data.user,
          session: data.session,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error("[Auth] Error in Supabase client operation:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Authentication service error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Auth] Error in login POST route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
