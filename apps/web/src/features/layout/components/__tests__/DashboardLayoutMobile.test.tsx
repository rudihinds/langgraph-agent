import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardLayout from "../DashboardLayout";
import { useSession } from "@/hooks/useSession";
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

describe("DashboardLayout - Mobile View", () => {
  const mockUser = {
    id: "123",
    email: "test@example.com",
    user_metadata: {
      name: "Test User",
      avatar_url: "https://example.com/avatar.png",
    },
  };

  // Setup for mobile screen size
  beforeEach(() => {
    // Mock useSession hook
    (useSession as any).mockReturnValue({
      user: mockUser,
      isLoading: false,
      refreshSession: vi.fn(),
    });

    // Mock usePathname hook
    (usePathname as any).mockReturnValue("/dashboard");

    // Set viewport to mobile size
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500, // Mobile width
    });

    // Trigger resize event
    global.dispatchEvent(new Event("resize"));
  });

  it("renders in collapsed state on mobile", () => {
    render(<DashboardLayout>Mobile Content</DashboardLayout>);

    // Sidebar should be collapsed
    const sidebar = screen.getByTestId("dashboard-sidebar");
    expect(sidebar).toHaveClass("w-16");
    expect(sidebar).not.toHaveClass("w-64");

    // App title should not be visible
    expect(screen.queryByText("Proposal Agent")).not.toBeInTheDocument();

    // Icon should be visible instead
    expect(screen.getByLabelText("Proposal Agent")).toBeInTheDocument();
  });

  it("expands sidebar when toggle button is clicked", async () => {
    const user = userEvent.setup();
    render(<DashboardLayout>Mobile Content</DashboardLayout>);

    // Initially collapsed
    const sidebar = screen.getByTestId("dashboard-sidebar");
    expect(sidebar).toHaveClass("w-16");

    // Click toggle button to expand
    const toggleButton = screen.getByTestId("sidebar-toggle");
    await user.click(toggleButton);

    // Should now be expanded
    expect(sidebar).toHaveClass("w-64");

    // App title should now be visible
    expect(screen.getByText("Proposal Agent")).toBeInTheDocument();
  });

  it("displays icons only in navigation when collapsed", () => {
    render(<DashboardLayout>Mobile Content</DashboardLayout>);

    // Sidebar is collapsed by default on mobile
    const sidebar = screen.getByTestId("dashboard-sidebar");
    expect(sidebar).toHaveClass("w-16");

    // Navigation text should not be visible when collapsed
    // But we can still find the elements by role
    const links = screen.getAllByRole("link");

    // We should still have all navigation links
    expect(links.length).toBeGreaterThanOrEqual(4); // At least 4 nav items

    // Navigation labels should not be visible
    expect(screen.queryByText("Dashboard")).not.toBeVisible();
    expect(screen.queryByText("My Proposals")).not.toBeVisible();
    expect(screen.queryByText("New Proposal")).not.toBeVisible();
    expect(screen.queryByText("Settings")).not.toBeVisible();
  });

  it("switches between desktop and mobile views when window is resized", async () => {
    render(<DashboardLayout>Responsive Content</DashboardLayout>);

    // Initially in mobile view (collapsed)
    let sidebar = screen.getByTestId("dashboard-sidebar");
    expect(sidebar).toHaveClass("w-16");

    // Change to desktop size
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024, // Desktop width
      });
      window.dispatchEvent(new Event("resize"));
    });

    // Should now be in desktop view (expanded)
    sidebar = screen.getByTestId("dashboard-sidebar");
    expect(sidebar).toHaveClass("w-64");

    // Change back to mobile size
    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500, // Mobile width
      });
      window.dispatchEvent(new Event("resize"));
    });

    // Should now be back in mobile view (collapsed)
    sidebar = screen.getByTestId("dashboard-sidebar");
    expect(sidebar).toHaveClass("w-16");
  });

  it("displays user profile menu in the header", () => {
    render(<DashboardLayout>Mobile Content</DashboardLayout>);

    // Check for user avatar in the header
    const header = screen.getByRole("banner");
    expect(header).toBeInTheDocument();

    // Avatar should be visible in the header
    const avatarButtons = screen.getAllByRole("button", {
      name: /test@example.com/i,
    });

    // Should find at least one avatar button (might be in sidebar and header)
    expect(avatarButtons.length).toBeGreaterThanOrEqual(1);

    // Mode toggle should be in the header
    const modeButton = screen.getByRole("button", { name: /toggle theme/i });
    expect(modeButton).toBeInTheDocument();
  });
});
