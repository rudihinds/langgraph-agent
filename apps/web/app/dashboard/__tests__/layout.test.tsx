import { render, screen } from "@testing-library/react";
import DashboardLayout from "../layout";
import { checkUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Create mock for useSession hook
vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn().mockReturnValue({
    user: null,
    isLoading: false,
    refreshSession: vi.fn(),
  }),
}));

// Mock the router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({
    replace: vi.fn(),
  }),
  redirect: vi.fn(),
}));

// Mock the Header component
vi.mock("@/components/layout/Header", () => ({
  __esModule: true,
  default: ({ user }: any) => (
    <header data-testid="header">
      Mocked Header for user: {user?.email || "No user"}
    </header>
  ),
}));

// Import the useSession to be able to mock it for different test cases
import { useSession } from "@/hooks/useSession";

describe("DashboardLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
      },
      writable: true,
    });

    // Mock document.cookie
    Object.defineProperty(document, "cookie", {
      value: "",
      writable: true,
    });
  });

  it("redirects to login page when no user is authenticated", () => {
    // Mock useSession to return null user
    (useSession as any).mockReturnValue({
      user: null,
      isLoading: false,
      refreshSession: vi.fn(),
    });

    render(<DashboardLayout>{<div>Test Content</div>}</DashboardLayout>);

    // The layout should render null, and the useEffect should trigger a redirect
    // We can check if localStorage.setItem was called
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "redirectAfterLogin",
      expect.any(String)
    );
  });

  it("renders the layout with children when user is authenticated", () => {
    // Mock authenticated user
    const mockUser = { id: "user-123", email: "test@example.com" };
    (useSession as any).mockReturnValue({
      user: mockUser,
      isLoading: false,
      refreshSession: vi.fn(),
    });

    render(<DashboardLayout>{<div>Test Content</div>}</DashboardLayout>);

    // Check children are rendered
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });
});
