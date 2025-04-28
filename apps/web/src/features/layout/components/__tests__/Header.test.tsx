import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Header from "../Header";
import { User } from "@supabase/supabase-js";
import * as useSessionModule from "@/features/auth/hooks/useSession";

// Mock dependencies
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => {
    return <a href={href}>{children}</a>;
  },
}));

vi.mock("@/components/ui/mode-toggle", () => ({
  ModeToggle: () => <div data-testid="mode-toggle">Mode Toggle</div>,
}));

// Mock DropdownMenu components
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-label">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="dropdown-item" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
}));

// Mock Avatar components
vi.mock("@/components/ui/avatar", () => ({
  Avatar: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div data-testid="avatar" className={className}>
      {children}
    </div>
  ),
  AvatarImage: ({ src, alt }: { src: string; alt: string }) => (
    <img data-testid="avatar-image" src={src} alt={alt} />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="avatar-fallback">{children}</div>
  ),
}));

// Mock useSession hook
vi.mock("@/hooks/useSession", () => ({
  useSession: vi.fn().mockReturnValue({
    signOut: vi.fn(() => Promise.resolve()),
  }),
}));

describe("Header", () => {
  const mockUser: User = {
    id: "user-123",
    email: "test@example.com",
    user_metadata: {
      name: "Test User",
      avatar_url: "https://example.com/avatar.jpg",
    },
    app_metadata: {},
    aud: "authenticated",
    created_at: "",
  };

  it("renders the authenticated header with navigation links", () => {
    render(<Header user={mockUser} />);

    // Check logo/title
    expect(screen.getByText("Proposal Agent")).toBeInTheDocument();

    // Check authenticated navigation links
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Templates")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();

    // Check mode toggle
    expect(screen.getByTestId("mode-toggle")).toBeInTheDocument();

    // Avatar trigger should be present
    expect(screen.getByTestId("avatar")).toBeInTheDocument();

    // Log in and Sign up buttons should not be present
    expect(screen.queryByText("Log in")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign up")).not.toBeInTheDocument();
  });

  it("renders the non-authenticated header with appropriate links", () => {
    render(<Header user={null} />);

    // Check logo/title
    expect(screen.getByText("Proposal Agent")).toBeInTheDocument();

    // Check non-authenticated navigation links
    expect(screen.getByText("Features")).toBeInTheDocument();
    expect(screen.getByText("Pricing")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();

    // Check for login/signup buttons
    expect(screen.getByText("Log in")).toBeInTheDocument();
    expect(screen.getByText("Sign up")).toBeInTheDocument();

    // Dashboard link should not be present
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Templates")).not.toBeInTheDocument();
  });

  it("shows avatar image when provided", () => {
    render(<Header user={mockUser} />);

    // Check for avatar image
    const avatarImage = screen.getByTestId("avatar-image");
    expect(avatarImage).toBeInTheDocument();
    expect(avatarImage).toHaveAttribute(
      "src",
      "https://example.com/avatar.jpg"
    );
  });

  it("shows initials when no avatar is provided", () => {
    const userWithoutAvatar = {
      ...mockUser,
      user_metadata: {
        ...mockUser.user_metadata,
        avatar_url: null,
      },
    };

    render(<Header user={userWithoutAvatar} />);

    expect(screen.getByTestId("avatar-fallback")).toHaveTextContent("TE");
  });

  it("calls sign out function when log out button is clicked", () => {
    const mockSignOut = vi.fn(() => Promise.resolve());
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({
      signOut: mockSignOut,
      user: mockUser,
      session: null,
      isLoading: false,
      error: null,
      refreshSession: vi.fn(),
    });

    render(<Header user={mockUser} />);

    // Find all dropdown menu items
    const menuItems = screen.getAllByTestId("dropdown-item");

    // Find the logout button by its text content
    const logoutButton = menuItems.find((item) =>
      item.textContent?.includes("Log out")
    );
    expect(logoutButton).toBeDefined();

    // Click the logout button
    if (logoutButton) {
      fireEvent.click(logoutButton);
      expect(mockSignOut).toHaveBeenCalled();
    }
  });
});
