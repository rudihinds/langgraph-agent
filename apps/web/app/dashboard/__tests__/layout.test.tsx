import { render, screen } from "@testing-library/react";
import DashboardLayout from "../layout";
import { checkUserSession } from "@/lib/auth";
import { redirect } from "next/navigation";

// Mock dependencies
jest.mock("@/lib/auth", () => ({
  checkUserSession: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("@/components/layout/Header", () => ({
  __esModule: true,
  default: ({ user }: any) => (
    <header data-testid="header">
      Mocked Header for user: {user?.email || "No user"}
    </header>
  ),
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects to login page when no user is authenticated", async () => {
    // Mock checkUserSession to return null (no authenticated user)
    (checkUserSession as jest.Mock).mockResolvedValue(null);

    await DashboardLayout({ children: <div>Test Content</div> });

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("renders the layout with header and children when user is authenticated", async () => {
    // Mock authenticated user
    const mockUser = { id: "user-123", email: "test@example.com" };
    (checkUserSession as jest.Mock).mockResolvedValue(mockUser);

    const { container } = render(
      await DashboardLayout({ children: <div>Test Content</div> })
    );

    // Check for header
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(
      screen.getByText(/Mocked Header for user: test@example.com/)
    ).toBeInTheDocument();

    // Check children are rendered
    expect(screen.getByText("Test Content")).toBeInTheDocument();

    // No redirect should have been called
    expect(redirect).not.toHaveBeenCalled();
  });
});
