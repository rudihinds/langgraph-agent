import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth, useSignIn, useSignOut } from "../client-auth";
import { createBrowserClient } from "@supabase/ssr";

// Mock Supabase client
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(),
}));

describe("Authentication Hooks", () => {
  let mockSupabaseClient: any;
  let mockOnAuthStateChange: any;
  let authChangeCallback: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Mock auth state change listener
    mockOnAuthStateChange = vi.fn().mockImplementation((callback) => {
      authChangeCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: null,
        }),
        signInWithOAuth: vi.fn().mockResolvedValue({
          data: {},
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
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("useAuth", () => {
    it("should initialize with a loading state and no user", async () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(true);
    });

    it("should update state when session is loaded initially", async () => {
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: {
          session: {
            user: { id: "test-user-id", email: "test@example.com" },
          },
        },
        error: null,
      });

      const { result } = renderHook(() => useAuth());

      // Wait for the useEffect to resolve
      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual({
        id: "test-user-id",
        email: "test@example.com",
      });
    });

    it("should handle auth state changes", async () => {
      const { result } = renderHook(() => useAuth());

      // Initial state
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(true);

      // Wait for initial loading to complete
      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
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

    it("should handle getSession errors", async () => {
      // Mock an error response
      mockSupabaseClient.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: new Error("Failed to get session"),
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useAuth());

      // Wait for the useEffect to resolve
      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error getting session"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it("should clean up auth subscription on unmount", async () => {
      const mockUnsubscribe = vi.fn();
      mockOnAuthStateChange.mockImplementationOnce(() => ({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      }));

      const { unmount } = renderHook(() => useAuth());

      // Unmount the component
      unmount();

      // Verify unsubscribe was called
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe("useSignIn", () => {
    it("should provide a signIn function that uses Supabase OAuth", async () => {
      const { result } = renderHook(() => useSignIn());

      await act(async () => {
        await result.current.signIn("google");
      });

      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: expect.stringContaining("/auth/callback"),
        },
      });
    });

    it("should handle sign in errors", async () => {
      // Mock an error response
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValueOnce({
        data: null,
        error: new Error("Failed to sign in"),
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const { result } = renderHook(() => useSignIn());

      let error: Error | null = null;
      await act(async () => {
        try {
          await result.current.signIn("google");
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("Failed to sign in");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error signing in with OAuth"),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe("useSignOut", () => {
    it("should provide a signOut function that signs out and calls the API", async () => {
      const { result } = renderHook(() => useSignOut());

      await act(async () => {
        await result.current.signOut();
      });

      // Should call Supabase signOut
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();

      // Should call the sign-out API endpoint
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/sign-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should handle Supabase signOut errors", async () => {
      // Mock an error response from Supabase
      mockSupabaseClient.auth.signOut.mockResolvedValueOnce({
        error: new Error("Failed to sign out"),
      });

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const { result } = renderHook(() => useSignOut());

      let error: Error | null = null;
      await act(async () => {
        try {
          await result.current.signOut();
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("Failed to sign out");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Error signing out"),
        expect.any(Error)
      );

      // API endpoint should not be called when Supabase signOut fails
      expect(global.fetch).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle API endpoint errors", async () => {
      // Mock a successful Supabase signOut but failed API call
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: "Internal server error" }),
        })
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const { result } = renderHook(() => useSignOut());

      let error: Error | null = null;
      await act(async () => {
        try {
          await result.current.signOut();
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("Failed to sign out");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("should handle network errors during sign out", async () => {
      // Mock a network error
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.reject(new Error("Network error"))
      );

      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const { result } = renderHook(() => useSignOut());

      let error: Error | null = null;
      await act(async () => {
        try {
          await result.current.signOut();
        } catch (e) {
          error = e as Error;
        }
      });

      expect(error).not.toBeNull();
      expect(error?.message).toContain("Network error");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
