import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Middleware completely disabled for debugging
export function middleware(request: NextRequest) {
  // Just log the request path for debugging
  console.log(`[DEBUG] Request path: ${request.nextUrl.pathname}`);
  console.log(
    `[DEBUG] Request cookies: ${request.cookies.getAll().length} cookies present`
  );

  // Allow all access, no protection
  return NextResponse.next();
}

// Minimal matcher to avoid breaking static files
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
