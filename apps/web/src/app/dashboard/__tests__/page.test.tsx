import { render, screen } from "@testing-library/react";
import DashboardPage from "../page";

// Mock dependencies
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

jest.mock("@/components/dashboard/ProposalList", () => ({
  __esModule: true,
  default: () => <div data-testid="proposal-list">Mocked ProposalList</div>,
}));

jest.mock("@/components/dashboard/DashboardSkeleton", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="dashboard-skeleton">Mocked DashboardSkeleton</div>
  ),
}));

jest.mock("@/components/dashboard/DashboardFilters", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="dashboard-filters">Mocked DashboardFilters</div>
  ),
}));

// Mock Suspense to immediately render children
jest.mock("react", () => {
  const originalReact = jest.requireActual("react");
  return {
    ...originalReact,
    Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

describe("DashboardPage", () => {
  it("renders the dashboard with all components", () => {
    render(<DashboardPage />);

    // Check page title and description
    expect(screen.getByText("Your Proposals")).toBeInTheDocument();
    expect(screen.getByText(/Manage your proposal drafts/)).toBeInTheDocument();

    // Check for New Proposal button
    const newProposalButton = screen.getByRole("link", {
      name: /New Proposal/i,
    });
    expect(newProposalButton).toBeInTheDocument();
    expect(newProposalButton).toHaveAttribute("href", "/proposals/new");

    // Check main components are rendered
    expect(screen.getByTestId("dashboard-filters")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-list")).toBeInTheDocument();
  });
});
