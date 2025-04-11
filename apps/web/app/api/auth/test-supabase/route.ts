import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ENV } from "@/env";

export async function GET(req: Request): Promise<NextResponse> {
  try {
    console.log("[SupabaseTest] Starting test");
    console.log("[SupabaseTest] Environment variables:", {
      hasUrl: !!ENV.NEXT_PUBLIC_SUPABASE_URL,
      hasAnon: !!ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      url: ENV.NEXT_PUBLIC_SUPABASE_URL,
    });

    const cookieStore = cookies();
    console.log("[SupabaseTest] Got cookie store");

    try {
      const supabase = await createClient(cookieStore);
      console.log("[SupabaseTest] Client created:", {
        hasClient: !!supabase,
        hasAuth: !!(supabase && supabase.auth),
        authMethods: supabase?.auth ? Object.keys(supabase.auth) : 'undefined'
      });

      // Test a simple Supabase call
      if (supabase?.auth) {
        const { data, error } = await supabase.auth.getSession();
        console.log("[SupabaseTest] Session check:", {
          success: !error,
          hasSession: !!data.session,
          error: error?.message
        });
      }

      return NextResponse.json({
        success: true,
        details: {
          environment: {
            hasUrl: !!ENV.NEXT_PUBLIC_SUPABASE_URL,
            hasAnon: !!ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          },
          client: {
            created: !!supabase,
            hasAuth: !!(supabase && supabase.auth),
            authMethods: supabase?.auth ? Object.keys(supabase.auth) : [],
          }
        }
      });
    } catch (error) {
      console.error("[SupabaseTest] Error creating client:", error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        environment: {
          hasUrl: !!ENV.NEXT_PUBLIC_SUPABASE_URL,
          hasAnon: !!ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        }
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[SupabaseTest] Unexpected error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}