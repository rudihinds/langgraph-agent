import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Create Supabase client
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    // Sign out the user
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Sign out error:", error);
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    // Return success response
    return NextResponse.json(
      { message: "Successfully signed out" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in sign-out:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}