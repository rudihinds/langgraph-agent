import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as callbackHandler } from "../callback/route";
import { NextResponse } from "next/server";

// Mock Next.js NextResponse.redirect
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/server", () => {
  const originalModule = vi.importActual("next/server");
  return {
    ...originalModule,
    NextResponse: {
      ...originalModule.NextResponse,
      redirect: vi.fn().mockImplementation((url) => ({
        url,
        cookies: {
          set: vi.fn(),
        },
      })),
    },
  };
});

// Mock Next.js cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockReturnValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

// Mock Supabase client
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockExchangeCodeForSession = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
    from: vi.fn().mockImplementation((table) => {
      if (table === "users") {
        return {
          insert: mockInsert.mockReturnValue({ error: null }),
          select: mockSelect.mockImplementation(() => ({
            eq: mockEq.mockImplementation(() => ({
              single: mockSingle,
            })),
          })),
          update: mockUpdate.mockReturnValue({ error: null }),
        };
      }
      return {};
    }),
  })),
}));

describe("Auth Callback Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: { code: "PGRST116" } }); // Default to user not found
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "test-user-id",
            email: "test@example.com",
            user_metadata: { full_name: "Test User" },
          },
          expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        },
      },
      error: null,
    });
  });

  it("should create a user record if it does not exist during callback", async () => {
    const request = new Request(
      "http://localhost:3000/auth/callback?code=testcode"
    );

    await callbackHandler(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("testcode");
    expect(mockSelect).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("id", "test-user-id");
    expect(mockInsert).toHaveBeenCalledWith({
      id: "test-user-id",
      email: "test@example.com",
      full_name: "Test User",
      avatar_url: null,
      created_at: expect.any(String),
    });
    expect(NextResponse.redirect).toHaveBeenCalled();
  });

  it("should update last_login if user already exists during callback", async () => {
    // Mock that user exists
    mockSingle.mockResolvedValue({ data: { id: "test-user-id" }, error: null });

    const request = new Request(
      "http://localhost:3000/auth/callback?code=testcode"
    );

    await callbackHandler(request);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({ last_login: expect.any(String) });
    expect(mockEq).toHaveBeenCalledWith("id", "test-user-id");
    expect(NextResponse.redirect).toHaveBeenCalled();
  });

  it("should redirect to login page with error if code exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {},
      error: { message: "Invalid code" },
    });

    const request = new Request(
      "http://localhost:3000/auth/callback?code=invalid-code"
    );

    await callbackHandler(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("invalid-code");
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(NextResponse.redirect).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining("/login?error=Invalid%20code"),
      })
    );
  });
});
