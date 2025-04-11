import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createErrorResponse, createSuccessResponse } from "@/lib/errors";
import { ErrorCodes } from "@/lib/errors/types";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
  try {
    logger.info("API: Sign-out request received");

    // Create Supabase client
    const cookieStore = cookies();
    const supabase = await createClient(cookieStore);

    // Sign out the user
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error("API: Sign-out error", {}, error);
      return createErrorResponse(
        error.message || "Failed to sign out",
        400,
        ErrorCodes.AUTHENTICATION,
        { supabaseError: error.message }
      );
    }

    // Return success response
    logger.info("API: Sign-out successful");
    return createSuccessResponse({ message: "Successfully signed out" });
  } catch (error) {
    logger.error("API: Unexpected error in sign-out", {}, error);
    return createErrorResponse(
      "An unexpected error occurred during sign-out",
      500,
      ErrorCodes.SERVER_ERROR,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}
