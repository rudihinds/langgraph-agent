import { createClient } from "@/lib/supabase/server";
import { syncUserToDatabase } from "@/lib/user-management";
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

    // Sign up the user
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${new URL(req.url).origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Sign up error:", error);
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    // After successful sign-up, create a record in the users table
    if (data.user) {
      await syncUserToDatabase(supabase, data.user);
    }

    return NextResponse.json(
      {
        message: "Check your email for the confirmation link",
        user: data.user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in sign-up:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
