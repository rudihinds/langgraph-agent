import {
  checkUserSession,
  requireAuth,
  redirectIfAuthenticated,
} from "../../../../lib/auth";
import { createServerClient } from "@supabase/ssr";
import { redirect } from "next/navigation";

// Mock dependencies
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn((name) => ({ value: "mocked-cookie-value" })),
  })),
}));

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

describe("Auth utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("checkUserSession", () => {
    it("returns null when no session is found", async () => {
      // Mock Supabase client with no session
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
          }),
        },
      });

      const result = await checkUserSession();

      expect(result).toBeNull();
    });

    it("returns user object when session is found", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };

      // Mock Supabase client with session
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: mockUser } },
          }),
        },
      });

      const result = await checkUserSession();

      expect(result).toEqual(mockUser);
    });
  });

  describe("requireAuth", () => {
    it("redirects to login when no session is found", async () => {
      // Mock checkUserSession to return null
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
          }),
        },
      });

      await requireAuth();

      expect(redirect).toHaveBeenCalledWith("/login");
    });

    it("returns user object when session is found", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };

      // Mock Supabase client with session
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: mockUser } },
          }),
        },
      });

      const result = await requireAuth();

      expect(redirect).not.toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe("redirectIfAuthenticated", () => {
    it("redirects to dashboard when session is found", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" };

      // Mock Supabase client with session
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: { user: mockUser } },
          }),
        },
      });

      await redirectIfAuthenticated();

      expect(redirect).toHaveBeenCalledWith("/dashboard");
    });

    it("returns null when no session is found", async () => {
      // Mock checkUserSession to return null
      (createServerClient as jest.Mock).mockReturnValue({
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
          }),
        },
      });

      const result = await redirectIfAuthenticated();

      expect(redirect).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });
});
