import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Header from "../Header";
import { User } from "@supabase/supabase-js";

// Mock dependencies
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

jest.mock("@/components/ui/mode-toggle", () => ({
  ModeToggle: () => <div data-testid="mode-toggle">Mode Toggle</div>,
}));

// Mock fetch for sign out
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
  })
) as jest.Mock;

// Mock window.location
const originalLocation = window.location;
beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { href: "" },
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
    writable: true,
  });
});

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

  it("renders the header with navigation links", () => {
    render(<Header user={mockUser} />);

    // Check logo/title
    expect(screen.getByText("Proposal Agent")).toBeInTheDocument();

    // Check navigation links
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Templates")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();

    // Check mode toggle
    expect(screen.getByTestId("mode-toggle")).toBeInTheDocument();
  });

  it("renders user information in dropdown", async () => {
    render(<Header user={mockUser} />);

    // Open dropdown
    const avatarButton = screen.getByRole("button");
    fireEvent.click(avatarButton);

    // Check user information
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();

    // Check menu items
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Log out")).toBeInTheDocument();
  });

  it("shows avatar image when provided", () => {
    render(<Header user={mockUser} />);

    const avatarImg = screen.getByAltText("test@example.com");
    expect(avatarImg).toBeInTheDocument();
    expect(avatarImg).toHaveAttribute("src", "https://example.com/avatar.jpg");
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

    expect(screen.getByText("TE")).toBeInTheDocument(); // Initials from email
  });

  it("calls sign out endpoint and redirects when log out is clicked", async () => {
    render(<Header user={mockUser} />);

    // Open dropdown
    const avatarButton = screen.getByRole("button");
    fireEvent.click(avatarButton);

    // Click log out
    const logoutButton = screen.getByText("Log out");
    fireEvent.click(logoutButton);

    // Verify fetch was called
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/signout", {
        method: "POST",
      });
      expect(window.location.href).toBe("/");
    });
  });
});
