import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { ensureUserExists } from "@/lib/user-management";

/**
 * API endpoint to verify that a user exists in the database.
 * This is used by client components to check and ensure the user record
 * exists in our database (not just in Supabase Auth).
 */
export async function POST() {
  console.log("[VerifyUser API] Received verification request");

  try {
    // Create a supabase client that handles cookies
    // Make sure to await cookies() before passing it
    const cookieStore = await cookies();
    const supabase = await createClient(cookieStore);

    // Get authenticated user
    console.log("[VerifyUser API] Checking for authenticated user");
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("[VerifyUser API] Auth error:", authError);
      return NextResponse.json(
        { success: false, error: "Authentication error" },
        { status: 401 }
      );
    }

    if (!authData?.user) {
      console.warn("[VerifyUser API] No authenticated user found");
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    console.log(
      `[VerifyUser API] User authenticated: ${authData.user.id}, ensuring database record exists`
    );

    // Ensure user record exists
    const result = await ensureUserExists(supabase);

    if (!result.success) {
      console.error("[VerifyUser API] User verification failed:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: "User verification failed",
          details: result.error.message || result.error,
        },
        { status: 500 }
      );
    }

    console.log(
      `[VerifyUser API] User verified successfully: ${authData.user.id}`
    );

    // Return success with user details
    return NextResponse.json({
      success: true,
      message: "User verified",
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });
  } catch (error) {
    console.error("[VerifyUser API] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Unexpected error during verification",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
