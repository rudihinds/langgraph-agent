import { render, screen, waitFor } from "@testing-library/react";
import Home from "../page";
import { getCurrentUser } from "@/lib/supabase";

// Mock dependencies
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

jest.mock("@/lib/supabase", () => ({
  getCurrentUser: jest.fn(),
}));

describe("Homepage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders sign in button when user is not logged in", async () => {
    // Mock user as not logged in
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    render(<Home />);

    // Wait for the useEffect to complete
    await waitFor(() => {
      expect(getCurrentUser).toHaveBeenCalled();
    });

    // Check for sign in button with correct link
    const signInButton = screen.getByRole("link", {
      name: /Sign in to Get Started/i,
    });
    expect(signInButton).toBeInTheDocument();
    expect(signInButton).toHaveAttribute("href", "/login");

    // Should not show dashboard or new proposal buttons
    expect(screen.queryByText("Start New Proposal")).not.toBeInTheDocument();
    expect(screen.queryByText("View My Proposals")).not.toBeInTheDocument();
  });

  it("renders dashboard and new proposal links when user is logged in", async () => {
    // Mock user as logged in
    const mockUser = { id: "user-123", email: "test@example.com" };
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    render(<Home />);

    // Wait for the useEffect to complete
    await waitFor(() => {
      expect(getCurrentUser).toHaveBeenCalled();
    });

    // Check for buttons with correct links
    const newProposalButton = screen.getByRole("link", {
      name: /Start New Proposal/i,
    });
    expect(newProposalButton).toBeInTheDocument();
    expect(newProposalButton).toHaveAttribute("href", "/proposals/new");

    const dashboardButton = screen.getByRole("link", {
      name: /View My Proposals/i,
    });
    expect(dashboardButton).toBeInTheDocument();
    expect(dashboardButton).toHaveAttribute("href", "/dashboard");

    // Should not show sign in button
    expect(
      screen.queryByText("Sign in to Get Started")
    ).not.toBeInTheDocument();
  });

  it("renders feature cards with descriptive content", () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    render(<Home />);

    // Check for feature cards
    expect(screen.getByText("RFP Analysis")).toBeInTheDocument();
    expect(screen.getByText("Structured Sections")).toBeInTheDocument();
    expect(screen.getByText("Feedback & Revisions")).toBeInTheDocument();

    // Check for descriptions
    expect(screen.getByText(/Upload your RFP documents/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Generate well-written proposal sections/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Provide feedback on generated content/i)
    ).toBeInTheDocument();
  });
});
