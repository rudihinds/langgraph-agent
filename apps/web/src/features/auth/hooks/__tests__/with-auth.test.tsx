/**
 * Tests for NextJS Authentication Higher-Order Function
 *
 * These tests verify that the withAuth HOC correctly:
 * 1. Protects routes requiring authentication
 * 2. Redirects unauthenticated users
 * 3. Works with the existing token refresh mechanism
 * 4. Handles authentication errors
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { withAuth } from "../with-auth";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import { createAuthInterceptor } from "@/lib/api/auth-interceptor";

// Mock Next.js router
const mockRouterReplace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: mockRouterReplace,
    refresh: vi.fn(),
    pathname: "/protected-route",
  })),
}));

// Mock createAuthInterceptor
const mockAuthInterceptor = vi.hoisted(() => ({
  fetch: vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ success: true }))),
}));

vi.mock("@/lib/api/auth-interceptor", () => ({
  createAuthInterceptor: vi.fn(() => mockAuthInterceptor),
}));

// Mock Supabase client and auth methods
const mockGetSession = vi.hoisted(() => vi.fn());
const mockOnAuthStateChange = vi.hoisted(() =>
  vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
);

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getSession: mockGetSession,
    onAuthStateChange: mockOnAuthStateChange,
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(() => mockSupabase),
}));

// Mock global console.error
const originalConsoleError = console.error;
let mockConsoleError: (message?: any, ...optionalParams: any[]) => void;

// Test component to wrap with withAuth
const TestComponent = () => (
  <div data-testid="protected-content">Protected Content</div>
);
const ProtectedComponent = withAuth(TestComponent);

describe("withAuth Higher-Order Function", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouterReplace.mockClear();
    mockConsoleError = vi.fn();
    console.error = mockConsoleError;
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("redirects to login page when user is not authenticated", async () => {
    // Arrange
    mockGetSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    // Act
    render(<ProtectedComponent />);

    // Assert
    await waitFor(() => {
      // Check that router.replace was called with a URL that starts with /auth/login
      expect(mockRouterReplace).toHaveBeenCalled();
      const redirectArg = mockRouterReplace.mock.calls[0][0];
      expect(redirectArg).toMatch(/^\/auth\/login\?from=/);
    });
  });

  it("displays the protected component when user is authenticated", async () => {
    // Arrange
    mockGetSession.mockResolvedValue({
      data: {
        session: { expires_at: Math.floor(Date.now() / 1000) + 3600 },
        user: { id: "test-user-id", email: "test@example.com" },
      },
      error: null,
    });

    // Act
    render(<ProtectedComponent />);

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    });
  });

  it("refreshes and remains on page when token is about to expire", async () => {
    // Arrange
    mockGetSession.mockResolvedValue({
      data: {
        session: { expires_at: Math.floor(Date.now() / 1000) + 300 }, // 5 minutes remaining
        user: { id: "test-user-id", email: "test@example.com" },
      },
      error: null,
    });

    // Act
    render(<ProtectedComponent />);

    // Assert
    await waitFor(() => {
      // Should not redirect
      expect(mockRouterReplace).not.toHaveBeenCalled();
      // Component should be rendered
      expect(screen.getByTestId("protected-content")).toBeInTheDocument();
      // Interceptor should be used for refresh
      expect(createAuthInterceptor).toHaveBeenCalled();
      expect(mockAuthInterceptor.fetch).toHaveBeenCalledWith(
        "/api/auth/refresh"
      );
    });
  });

  it("redirects to login when authentication errors occur", async () => {
    // Arrange - Simulate Supabase API error
    mockGetSession.mockRejectedValue(new Error("API Connection Error"));

    // Act
    render(<ProtectedComponent />);

    // Assert
    await waitFor(() => {
      // Should redirect to login
      expect(mockRouterReplace).toHaveBeenCalled();
      const redirectArg = mockRouterReplace.mock.calls[0][0];
      expect(redirectArg).toMatch(/^\/auth\/login\?from=/);

      // Should log error
      expect(mockConsoleError).toHaveBeenCalledWith(
        "Authentication verification failed:",
        expect.stringContaining("API Connection Error")
      );
    });
  });
});
