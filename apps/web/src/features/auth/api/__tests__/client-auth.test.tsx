import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCurrentUser, useRequireAuth, signOut } from "@/lib/client-auth";

// Set up mock router before importing modules
const mockRouter = { push: vi.fn(), refresh: vi.fn() };

// Mock dependencies - these are hoisted
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn().mockImplementation(() => ({
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(),
    },
  })),
}));

// Import after mocks
import { createBrowserClient } from "@supabase/ssr";

// Mock supabase/auth module
vi.mock("@/lib/supabase/auth", () => ({
  signOut: vi.fn().mockImplementation(async (redirectTo = "/login") => {
    try {
      // Mock successful API call
      await Promise.resolve();
      // Simulate redirection
      window.location.href = redirectTo;
      return { success: true };
    } catch (error) {
      // Won't reach here in the happy path test
      return { success: false, error: (error as Error).message };
    }
  }),
  checkAuthAndRedirect: vi.fn().mockImplementation(async () => {
    return { authenticated: true };
  }),
}));

describe("Authentication Hooks", () => {
  let mockSupabaseClient: any;
  let mockOnAuthStateChange: any;
  let authChangeCallback: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Reset router mock methods
    mockRouter.push.mockReset();
    mockRouter.refresh.mockReset();

    // Mock auth state change listener
    mockOnAuthStateChange = vi.fn().mockImplementation((callback) => {
      authChangeCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
        signOut: vi.fn().mockResolvedValue({
          error: null,
        }),
        onAuthStateChange: mockOnAuthStateChange,
      },
    };

    (createBrowserClient as any).mockReturnValue(mockSupabaseClient);

    // Mock fetch for API calls
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)
    );

    // Reset window.location.href
    if (typeof window !== "undefined") {
      const originalLocation = window.location;
      delete window.location;
      window.location = { ...originalLocation, href: "" } as any;
    }
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("useCurrentUser", () => {
    it("should initialize with a loading state and no user", () => {
      const { result } = renderHook(() => useCurrentUser());

      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(true);
    });

    it("should update state when user is loaded initially", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
        error: null,
      });

      const { result } = renderHook(() => useCurrentUser());

      // Wait for the useEffect to resolve
      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual({
        id: "test-user-id",
        email: "test@example.com",
      });
    });

    it("should handle auth state changes", async () => {
      const { result } = renderHook(() => useCurrentUser());

      // Initial state
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(true);

      // Wait for initial loading to complete
      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate auth state change (sign in)
      act(() => {
        authChangeCallback("SIGNED_IN", {
          user: { id: "new-user-id", email: "new@example.com" },
        });
      });

      expect(result.current.user).toEqual({
        id: "new-user-id",
        email: "new@example.com",
      });

      // Simulate auth state change (sign out)
      act(() => {
        authChangeCallback("SIGNED_OUT", null);
      });

      expect(result.current.user).toBeNull();
    });

    it("should handle getUser errors", async () => {
      // Mock an error response
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error("Failed to get user"),
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useCurrentUser());

      // Wait for the useEffect to resolve
      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error getting user"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should clean up auth subscription on unmount", async () => {
      const mockUnsubscribe = vi.fn();
      mockOnAuthStateChange.mockImplementationOnce(() => ({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      }));

      const { unmount } = renderHook(() => useCurrentUser());

      // Unmount the component
      unmount();

      // Verify unsubscribe was called
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("useRequireAuth", () => {
    it("should redirect to login if not authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const { result } = renderHook(() => useRequireAuth());

      // Wait for the async getUser call to complete
      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have called router.push
      expect(mockRouter.push).toHaveBeenCalledWith("/login");
    });

    it("should not redirect if authenticated", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: {
          user: { id: "test-user-id", email: "test@example.com" },
        },
        error: null,
      });

      const { result } = renderHook(() => useRequireAuth());

      // Wait for the async getUser call to complete
      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not have called router.push
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe("signOut function", () => {
    it("should call the API and redirect to login", async () => {
      await signOut();

      // Check if fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/sign-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Should have redirected to login
      expect(window.location.href).toBe("/login");
    });

    it("should handle API errors gracefully", async () => {
      // Mock a failed response
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ message: "Server error" }),
        })
      );

      const result = await signOut();

      expect(result).toEqual({
        success: false,
        error: "Server error",
      });
    });
  });
});
