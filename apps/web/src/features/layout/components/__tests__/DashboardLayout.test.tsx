import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardLayout from "../DashboardLayout";
import { useSession } from "@/features/auth/hooks/useSession";
import { usePathname, useRouter } from "next/navigation";

// Mock the hooks
vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
  })),
  usePathname: vi.fn(),
}));

describe("DashboardLayout", () => {
  const mockUser = {
    id: "123",
    email: "test@example.com",
    user_metadata: {
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    },
  };

  beforeEach(() => {
    // Mock useSession hook
    (useSession as any).mockReturnValue({
      user: mockUser,
      isLoading: false,
      refreshSession: vi.fn(),
    });

    // Mock usePathname hook
    (usePathname as any).mockReturnValue("/dashboard");
  });

  it("renders sidebar navigation items correctly", () => {
    render(<DashboardLayout>Content</DashboardLayout>);

    // Check for navigation items
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("My Proposals")).toBeInTheDocument();
    expect(screen.getByText("New Proposal")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("highlights the active route", () => {
    render(<DashboardLayout>Content</DashboardLayout>);

    // The Dashboard link should have the active class
    const dashboardLink = screen.getByText("Dashboard").closest("a");
    expect(dashboardLink).toHaveClass("bg-primary/10");
  });

  it("displays user profile information", () => {
    render(<DashboardLayout>Content</DashboardLayout>);

    // Check for user info in the sidebar
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("renders children content", () => {
    render(<DashboardLayout>Test Content</DashboardLayout>);

    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  it("shows collapsed sidebar on mobile by default", async () => {
    // Setup
    global.innerWidth = 500;
    global.dispatchEvent(new Event("resize"));

    render(<DashboardLayout>Content</DashboardLayout>);

    // Sidebar should have collapsed class
    const sidebar = screen.getByTestId("dashboard-sidebar");
    expect(sidebar).toHaveClass("w-16");
  });

  it("redirects to login page if user is not authenticated", () => {
    // Mock unauthenticated state
    (useSession as any).mockReturnValue({
      user: null,
      isLoading: false,
      refreshSession: vi.fn(),
    });

    const mockReplace = vi.fn();
    (useRouter as any).mockReturnValue({
      replace: mockReplace,
    });

    render(<DashboardLayout>Content</DashboardLayout>);

    // Should redirect to login
    expect(mockReplace).toHaveBeenCalledWith("/login?redirected=true");
  });

  it("toggles sidebar when toggle button is clicked", async () => {
    const user = userEvent.setup();
    render(<DashboardLayout>Content</DashboardLayout>);

    const toggleButton = screen.getByTestId("sidebar-toggle");

    // Initial state should be expanded on desktop
    const sidebar = screen.getByTestId("dashboard-sidebar");
    expect(sidebar).toHaveClass("w-64");

    // Click to collapse
    await user.click(toggleButton);
    expect(sidebar).toHaveClass("w-16");

    // Click again to expand
    await user.click(toggleButton);
    expect(sidebar).toHaveClass("w-64");
  });

  it("handles keyboard navigation with Tab key", async () => {
    const user = userEvent.setup();
    render(<DashboardLayout>Content</DashboardLayout>);

    // Tab through the navigation items
    await user.tab();

    // First navigation item should be focused
    expect(screen.getByText("Dashboard").closest("a")).toHaveFocus();

    // Tab to next item
    await user.tab();
    expect(screen.getByText("My Proposals").closest("a")).toHaveFocus();
  });

  it("displays user profile menu in the header", () => {
    render(<DashboardLayout>Content</DashboardLayout>);

    // Check for user avatar in the header
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();

    // Avatar should be visible in the header
    const avatarButtons = screen.getAllByRole("button", {
      name: /test@example.com/i,
    });

    // Should find at least one avatar button in header (there"s also one in sidebar)
    expect(avatarButtons.length).toBeGreaterThanOrEqual(1);

    // Mode toggle should be in the header
    const modeButton = screen.getByRole("button", { name: /toggle theme/i });
    expect(modeButton).toBeInTheDocument();
  });
});
