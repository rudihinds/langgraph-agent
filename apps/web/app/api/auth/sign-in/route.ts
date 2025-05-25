import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Parse request body
    const { email, password } = await req.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    // Create Supabase client
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    // Sign in the user
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Sign in error:", error);
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    // User authentication successful - Supabase handles user management automatically

    return NextResponse.json(
      {
        message: "Successfully signed in",
        user: data.user,
        session: data.session,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in sign-in:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
