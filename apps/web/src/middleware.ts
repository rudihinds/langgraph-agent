import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(png|jpg|jpeg|svg|gif|webp)).*)",
  ],
};

/**
 * Middleware function that runs before each request
 * Handles authentication and session management
 */
export async function middleware(request: NextRequest) {
  // Update session and handle authentication
  return await updateSession(request);
}