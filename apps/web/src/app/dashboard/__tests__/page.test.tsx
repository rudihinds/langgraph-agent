import {
  render,
  screen,
  act,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import DashboardPage from "../page";
import { vi } from "vitest";
import * as proposalsApi from "@/lib/api/proposals";

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

// Mock the components used in the dashboard
vi.mock("@/components/dashboard/EmptyProposalState", () => ({
  default: () => (
    <div data-testid="empty-proposal-state">Empty Proposal State</div>
  ),
}));

vi.mock("@/components/dashboard/ProposalCard", () => ({
  ProposalCard: ({ proposal }: any) => (
    <div data-testid={`proposal-card-${proposal.id}`}>
      Proposal Card: {proposal.title}
    </div>
  ),
}));

vi.mock("@/components/dashboard/NewProposalCard", () => ({
  default: () => <div data-testid="new-proposal-card">New Proposal Card</div>,
}));

vi.mock("@/components/dashboard/NewProposalModal", () => ({
  default: ({ open, onOpenChange }: any) => (
    <div data-testid="new-proposal-modal" data-open={open}>
      New Proposal Modal
      <button onClick={() => onOpenChange(false)}>Close</button>
    </div>
  ),
}));

// Mock the API functions
vi.mock("@/lib/api/proposals", async () => {
  const actual = await vi.importActual("@/lib/api/proposals");
  return {
    ...actual,
    getProposals: vi.fn(),
  };
});

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock setTimeout to execute immediately
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  it("renders loading skeleton initially", () => {
    render(<DashboardPage />);
    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
  });

  it("shows empty state when no proposals are returned", async () => {
    render(<DashboardPage />);

    // Initially in loading state
    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();

    // Fast-forward setTimeout
    act(() => {
      vi.runAllTimers();
    });

    // Wait for the component to update
    await waitFor(() => {
      expect(
        screen.queryByTestId("dashboard-skeleton")
      ).not.toBeInTheDocument();
    });

    // Toggle to empty state (default is populated)
    const toggleButton = screen.getByText("Show Empty State");
    fireEvent.click(toggleButton);

    // Fast-forward setTimeout again
    act(() => {
      vi.runAllTimers();
    });

    // Should show empty state
    expect(screen.getByTestId("empty-proposal-state")).toBeInTheDocument();
    expect(screen.queryByTestId("proposal-card-1")).not.toBeInTheDocument();
  });

  it("shows proposals when dummy data is available", async () => {
    render(<DashboardPage />);

    // Initially in loading state
    expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();

    // Fast-forward setTimeout
    act(() => {
      vi.runAllTimers();
    });

    // Wait for the component to update
    await waitFor(() => {
      expect(
        screen.queryByTestId("dashboard-skeleton")
      ).not.toBeInTheDocument();
    });

    // By default, should show dummy proposals
    expect(screen.getByTestId("new-proposal-card")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-card-2")).toBeInTheDocument();
    expect(
      screen.queryByTestId("empty-proposal-state")
    ).not.toBeInTheDocument();

    // Button should indicate we can toggle to empty state
    expect(screen.getByText("Show Empty State")).toBeInTheDocument();
  });

  it("toggles between empty and populated states", async () => {
    render(<DashboardPage />);

    // Fast-forward setTimeout
    act(() => {
      vi.runAllTimers();
    });

    // Wait for the component to update
    await waitFor(() => {
      expect(
        screen.queryByTestId("dashboard-skeleton")
      ).not.toBeInTheDocument();
    });

    // Initially shows proposals
    expect(screen.getByTestId("proposal-card-1")).toBeInTheDocument();

    // Toggle to empty state
    const toggleButton = screen.getByText("Show Empty State");
    fireEvent.click(toggleButton);

    // Fast-forward setTimeout again
    act(() => {
      vi.runAllTimers();
    });

    // Should now show empty state
    await waitFor(() => {
      expect(screen.getByTestId("empty-proposal-state")).toBeInTheDocument();
      expect(screen.queryByTestId("proposal-card-1")).not.toBeInTheDocument();
    });

    // Button text should change
    expect(screen.getByText("Show Proposals")).toBeInTheDocument();

    // Toggle back to proposals
    const showProposalsButton = screen.getByText("Show Proposals");
    fireEvent.click(showProposalsButton);

    // Fast-forward setTimeout again
    act(() => {
      vi.runAllTimers();
    });

    // Should show proposals again
    await waitFor(() => {
      expect(screen.getByTestId("proposal-card-1")).toBeInTheDocument();
      expect(
        screen.queryByTestId("empty-proposal-state")
      ).not.toBeInTheDocument();
    });
  });

  it("opens new proposal modal when button is clicked", async () => {
    render(<DashboardPage />);

    // Fast-forward setTimeout
    act(() => {
      vi.runAllTimers();
    });

    // Wait for the component to update
    await waitFor(() => {
      expect(
        screen.queryByTestId("dashboard-skeleton")
      ).not.toBeInTheDocument();
    });

    // Modal should start closed
    expect(
      screen.getByTestId("new-proposal-modal").getAttribute("data-open")
    ).toBe("false");

    // Click new proposal button
    const newProposalButton = screen.getByText("New Proposal");
    fireEvent.click(newProposalButton);

    // Modal should now be open
    expect(
      screen.getByTestId("new-proposal-modal").getAttribute("data-open")
    ).toBe("true");

    // Close the modal
    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);

    // Modal should be closed again
    expect(
      screen.getByTestId("new-proposal-modal").getAttribute("data-open")
    ).toBe("false");
  });
});
