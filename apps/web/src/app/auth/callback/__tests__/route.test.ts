import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GET } from "../route";
import { cookies } from "next/headers";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock dependencies
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

// Mock console.log to reduce test output noise
vi.spyOn(console, "log").mockImplementation(() => {});

describe("Auth Callback Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to login with error if no code parameter", async () => {
    // Mock NextRequest with no code parameter
    const mockRequest = {
      url: "https://example.com/auth/callback",
      nextUrl: new URL("https://example.com/auth/callback"),
      cookies: {
        get: vi.fn().mockReturnValue(null),
      },
      headers: {
        get: vi.fn().mockImplementation((name) => null),
      },
    } as unknown as NextRequest;

    // Mock cookies
    const mockCookieStore = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
    };
    (cookies as any).mockReturnValue(mockCookieStore);

    // Mock NextResponse.redirect
    const mockRedirect = vi.fn().mockReturnValue({
      headers: new Headers(),
      cookies: {
        set: vi.fn(),
      },
    });
    vi.spyOn(NextResponse, "redirect").mockImplementation(mockRedirect);

    // Call the route handler
    await GET(mockRequest);

    // Verify redirect was called with login and error parameter
    expect(mockRedirect).toHaveBeenCalled();
    expect(mockRedirect.mock.calls[0][0].toString()).toBe(
      "https://example.com/login?error=missing_code"
    );
  });

  it("exchanges code for session and redirects to dashboard on success", async () => {
    // Mock NextRequest with code parameter
    const mockRequest = {
      url: "https://example.com/auth/callback?code=test-code",
      nextUrl: new URL("https://example.com/auth/callback?code=test-code"),
      cookies: {
        get: vi.fn().mockReturnValue(null),
      },
      headers: {
        get: vi.fn().mockImplementation((name) => null),
      },
    } as unknown as NextRequest;

    // Mock supabase client with successful exchange
    const mockExchangeCodeForSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          user: { id: "test-user", email: "test@example.com" },
          expires_at: null,
        },
      },
      error: null,
    });

    const mockSupabaseClient = {
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      },
    };
    (createServerSupabaseClient as any).mockResolvedValue(mockSupabaseClient);

    // Mock cookies
    const mockCookieStore = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
    };
    (cookies as any).mockReturnValue(mockCookieStore);

    // Mock NextResponse.redirect
    const mockRedirect = vi.fn().mockReturnValue({
      headers: new Headers(),
      cookies: {
        set: vi.fn(),
      },
    });
    vi.spyOn(NextResponse, "redirect").mockImplementation(mockRedirect);

    // Call the route handler
    await GET(mockRequest);

    // Verify exchangeCodeForSession was called with the code
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("test-code");

    // Verify redirect was called to dashboard
    expect(mockRedirect).toHaveBeenCalled();
    expect(mockRedirect.mock.calls[0][0].toString()).toBe(
      "https://example.com/dashboard"
    );
  });

  it("handles exchangeCodeForSession error and redirects to login", async () => {
    // Mock NextRequest with code parameter
    const mockRequest = {
      url: "https://example.com/auth/callback?code=test-code",
      nextUrl: new URL("https://example.com/auth/callback?code=test-code"),
      cookies: {
        get: vi.fn().mockReturnValue(null),
      },
      headers: {
        get: vi.fn().mockImplementation((name) => null),
      },
    } as unknown as NextRequest;

    // Mock supabase client with error
    const mockExchangeCodeForSession = vi.fn().mockResolvedValue({
      data: { session: null },
      error: { message: "Auth error" },
    });

    const mockSupabaseClient = {
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      },
    };
    (createServerSupabaseClient as any).mockResolvedValue(mockSupabaseClient);

    // Mock cookies
    const mockCookieStore = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
    };
    (cookies as any).mockReturnValue(mockCookieStore);

    // Mock NextResponse.redirect
    const mockRedirect = vi.fn().mockReturnValue({
      headers: new Headers(),
      cookies: {
        set: vi.fn(),
      },
    });
    vi.spyOn(NextResponse, "redirect").mockImplementation(mockRedirect);

    // Call the route handler
    await GET(mockRequest);

    // Verify exchangeCodeForSession was called with the code
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("test-code");

    // Verify redirect was called to login with error
    expect(mockRedirect).toHaveBeenCalledTimes(2); // Initial redirect + error redirect
    expect(mockRedirect.mock.calls[1][0].toString()).toBe(
      "https://example.com/login?error=Auth%20error"
    );
  });

  it("handles unexpected errors during code exchange", async () => {
    // Mock NextRequest with code parameter
    const mockRequest = {
      url: "https://example.com/auth/callback?code=test-code",
      nextUrl: new URL("https://example.com/auth/callback?code=test-code"),
      cookies: {
        get: vi.fn().mockReturnValue(null),
      },
      headers: {
        get: vi.fn().mockImplementation((name) => null),
      },
    } as unknown as NextRequest;

    // Mock supabase client with exception
    const mockExchangeCodeForSession = vi
      .fn()
      .mockRejectedValue(new Error("Network error"));

    const mockSupabaseClient = {
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      },
    };
    (createServerSupabaseClient as any).mockResolvedValue(mockSupabaseClient);

    // Mock cookies
    const mockCookieStore = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
    };
    (cookies as any).mockReturnValue(mockCookieStore);

    // Mock console.error to prevent test output pollution
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock NextResponse.redirect
    const mockRedirect = vi.fn().mockReturnValue({
      headers: new Headers(),
      cookies: {
        set: vi.fn(),
      },
    });
    vi.spyOn(NextResponse, "redirect").mockImplementation(mockRedirect);

    // Call the route handler
    await GET(mockRequest);

    // Verify redirect was called to login with server_error
    expect(mockRedirect).toHaveBeenCalledTimes(2); // Initial redirect + error redirect
    expect(mockRedirect.mock.calls[1][0].toString()).toBe(
      "https://example.com/login?error=server_error"
    );
  });
});
