import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "../middleware";
import { vi, beforeEach, afterEach, describe, it, expect } from "vitest";

// Mock Supabase client
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

// Mock NextResponse
vi.mock("next/server", () => {
  const originalModule = vi.importActual("next/server");
  return {
    ...originalModule,
    NextResponse: {
      next: vi.fn().mockImplementation(() => ({
        cookies: {
          set: vi.fn(),
          getAll: vi.fn().mockReturnValue([]),
        },
      })),
      redirect: vi.fn().mockImplementation((url) => ({
        url,
        cookies: {
          set: vi.fn(),
          getAll: vi.fn().mockReturnValue([]),
        },
      })),
    },
  };
});

describe("Middleware", () => {
  let mockRequest: NextRequest;
  let mockSupabaseClient: any;
  let mockGetUser: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock getUser function with default unauthenticated response
    mockGetUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    });

    // Mock a Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: mockGetUser,
      },
    };

    (createServerClient as any).mockReturnValue(mockSupabaseClient);

    // Mock a Next.js request
    mockRequest = {
      nextUrl: {
        pathname: "/",
        clone: vi.fn().mockReturnThis(),
      },
      cookies: {
        getAll: vi.fn().mockReturnValue([]),
        set: vi.fn(),
      },
    } as unknown as NextRequest;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("should redirect unauthenticated users to login", async () => {
    // Mock an unauthenticated user
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await middleware(mockRequest);

    // Check if redirect was called with login path
    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectCall = (NextResponse.redirect as any).mock.calls[0][0];
    expect(redirectCall.pathname).toBe("/login");
  });

  it("should allow access for authenticated users", async () => {
    // Mock an authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "test-user" } },
      error: null,
    });

    await middleware(mockRequest);

    // Check if we continued without redirect
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("should allow access to login path even if unauthenticated", async () => {
    // Set path to login
    mockRequest.nextUrl.pathname = "/login";

    // Mock an unauthenticated user
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await middleware(mockRequest);

    // Check if no redirect happened
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("should allow access to auth callback path if unauthenticated", async () => {
    // Set path to auth callback
    mockRequest.nextUrl.pathname = "/auth/callback";

    // Mock an unauthenticated user
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await middleware(mockRequest);

    // Check if no redirect happened
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("should allow access to API routes if unauthenticated", async () => {
    // Set path to an API route
    mockRequest.nextUrl.pathname = "/api/auth/sign-in";

    // Mock an unauthenticated user
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await middleware(mockRequest);

    // Check if no redirect happened for API routes
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("should allow access to static assets if unauthenticated", async () => {
    // Set path to a static asset
    mockRequest.nextUrl.pathname = "/_next/static/chunks/main.js";

    // Mock an unauthenticated user
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await middleware(mockRequest);

    // Check if no redirect happened for static assets
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("should handle authentication errors gracefully", async () => {
    // Mock an authentication error
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Authentication error" },
    });

    await middleware(mockRequest);

    // Should redirect to login on auth error
    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectCall = (NextResponse.redirect as any).mock.calls[0][0];
    expect(redirectCall.pathname).toBe("/login");
  });

  it("should handle unexpected errors gracefully", async () => {
    // Mock an unexpected error
    mockGetUser.mockRejectedValue(new Error("Unexpected error"));

    await middleware(mockRequest);

    // Should redirect to login on unexpected error
    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectCall = (NextResponse.redirect as any).mock.calls[0][0];
    expect(redirectCall.pathname).toBe("/login");
  });

  it("should maintain cookie state from Supabase response", async () => {
    // Mock an authenticated user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "test-user" } },
      error: null,
    });

    // Create a mock response with cookies
    const mockResponse = {
      cookies: {
        getAll: vi
          .fn()
          .mockReturnValue([{ name: "test-cookie", value: "test-value" }]),
      },
    };

    (NextResponse.next as any).mockReturnValueOnce(mockResponse);

    await middleware(mockRequest);

    // Should return the Supabase response with cookies intact
    expect(NextResponse.next).toHaveBeenCalled();
  });

  it("should properly pass cookie information to the Supabase client", async () => {
    // Set up request cookies
    const requestCookies = [{ name: "auth-token", value: "test-token" }];
    mockRequest.cookies.getAll.mockReturnValue(requestCookies);

    await middleware(mockRequest);

    // Verify createServerClient was called with proper cookie configuration
    expect(createServerClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );

    // Verify cookie access
    const cookieConfig = (createServerClient as any).mock.calls[0][2];
    const getAllResult = cookieConfig.cookies.getAll();
    expect(getAllResult).toEqual(requestCookies);
  });
});
