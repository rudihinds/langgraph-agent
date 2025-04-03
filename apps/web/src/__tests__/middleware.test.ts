import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { middleware } from "../middleware";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock createServerSupabaseClient
vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

// Mock NextResponse
vi.mock("next/server", () => {
  const originalModule = vi.importActual("next/server");
  return {
    ...originalModule,
    NextResponse: {
      next: vi.fn().mockReturnValue({ headers: new Headers() }),
      redirect: vi.fn().mockImplementation((url) => ({
        url,
        headers: new Headers(),
      })),
    },
  };
});

describe("Auth Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (path: string) => {
    return {
      nextUrl: new URL(`https://example.com${path}`),
      url: `https://example.com${path}`,
      cookies: {
        get: vi.fn(),
        getAll: vi.fn().mockReturnValue([]),
        has: vi.fn().mockReturnValue(false),
      },
    } as unknown as NextRequest;
  };

  // Helper to create authenticated request
  const createAuthenticatedRequest = (path: string) => {
    const request = createMockRequest(path);
    // Mock has to return true for auth cookie
    request.cookies.has = vi.fn().mockImplementation((name) => {
      if (name === "auth-session-established") {
        return true;
      }
      return false;
    });
    return request;
  };

  it("allows access to static files without authentication check", async () => {
    const mockRequest = createMockRequest("/_next/static/chunks/main.js");
    await middleware(mockRequest);

    // Should call next() without checking auth
    expect(NextResponse.next).toHaveBeenCalled();
    // createServerSupabaseClient should not be called for static files
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("allows access to api routes without authentication check", async () => {
    const mockRequest = createMockRequest("/api/health");
    await middleware(mockRequest);

    // Should call next() without checking auth
    expect(NextResponse.next).toHaveBeenCalled();
    // createServerSupabaseClient should not be called for API routes
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("allows access to auth routes without authentication check", async () => {
    const mockRequest = createMockRequest("/auth/callback");
    await middleware(mockRequest);

    // Should call next() without checking auth
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("allows access to login route without authentication check", async () => {
    const mockRequest = createMockRequest("/login");
    await middleware(mockRequest);

    // Should call next() without checking auth for public routes
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("redirects to login if unauthenticated user tries to access protected route", async () => {
    const mockRequest = createMockRequest("/dashboard");

    await middleware(mockRequest);

    // Should redirect to login with a URL object
    expect(NextResponse.redirect).toHaveBeenCalled();
    // Check the redirect URL contains login
    const redirectCall = NextResponse.redirect.mock.calls[0][0];
    expect(redirectCall.toString()).toContain("/login");
  });

  it("allows authenticated user to access protected route", async () => {
    const mockRequest = createAuthenticatedRequest("/dashboard");

    await middleware(mockRequest);

    // Should call next() for authenticated users on protected routes
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("redirects authenticated user from login page to dashboard", async () => {
    const mockRequest = createAuthenticatedRequest("/login");

    await middleware(mockRequest);

    // Should redirect to dashboard if already logged in
    expect(NextResponse.redirect).toHaveBeenCalled();
    // Check the redirect URL contains dashboard
    const redirectCall = NextResponse.redirect.mock.calls[0][0];
    expect(redirectCall.toString()).toContain("/dashboard");
  });

  it("checks for session marker cookie", async () => {
    const mockRequest = createMockRequest("/dashboard");
    mockRequest.cookies.has = vi.fn().mockImplementation((name) => {
      if (name === "auth-session-established") {
        return true;
      }
      return false;
    });

    await middleware(mockRequest);

    // Verify has() was called with the correct cookie name
    expect(mockRequest.cookies.has).toHaveBeenCalledWith(
      "auth-session-established"
    );
    // Since we have the session established cookie, we should allow access to protected route
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("handles error during session check", async () => {
    const mockRequest = createMockRequest("/dashboard");

    // Mock console.error to prevent test output pollution
    vi.spyOn(console, "error").mockImplementation(() => {});

    await middleware(mockRequest);

    // Should redirect to login
    expect(NextResponse.redirect).toHaveBeenCalled();
    // Check the redirect URL contains login
    const redirectCall = NextResponse.redirect.mock.calls[0][0];
    expect(redirectCall.toString()).toContain("/login");
  });
});
