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
     * - images (app local images)
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|public/).*)",
  ],
};

export async function middleware(request: NextRequest) {
  // Update the session before each request
  return await updateSession(request);
}
