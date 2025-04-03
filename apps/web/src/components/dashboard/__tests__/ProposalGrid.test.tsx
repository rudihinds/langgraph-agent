import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";
import { ProposalGrid } from "../ProposalGrid";

// Mock the ProposalCard component
vi.mock("../ProposalCard", () => ({
  ProposalCard: ({ proposal }: any) => (
    <div data-testid={`proposal-card-${proposal.id}`}>
      {proposal.title} - {proposal.status}
    </div>
  ),
}));

// Mock EmptyProposalState component
vi.mock("../EmptyProposalState", () => ({
  EmptyProposalState: () => (
    <div data-testid="empty-proposal-state">No proposals yet</div>
  ),
}));

// Mock DashboardSkeleton component
vi.mock("../DashboardSkeleton", () => ({
  default: () => <div data-testid="proposal-grid-skeleton">Loading...</div>,
}));

describe("ProposalGrid", () => {
  const mockProposals = [
    {
      id: "1",
      title: "Proposal 1",
      organization: "Org 1",
      status: "draft",
      progress: 25,
      createdAt: "2023-04-01T12:00:00Z",
      updatedAt: "2023-04-02T12:00:00Z",
      dueDate: "2023-05-15T12:00:00Z",
    },
    {
      id: "2",
      title: "Proposal 2",
      organization: "Org 2",
      status: "in_progress",
      progress: 60,
      createdAt: "2023-03-15T12:00:00Z",
      updatedAt: "2023-04-01T12:00:00Z",
      dueDate: "2023-04-30T12:00:00Z",
    },
    {
      id: "3",
      title: "Proposal 3",
      organization: "Org 3",
      status: "submitted",
      progress: 100,
      createdAt: "2023-02-10T12:00:00Z",
      updatedAt: "2023-03-01T12:00:00Z",
      dueDate: "2023-03-15T12:00:00Z",
    },
  ];

  it("renders a grid of proposal cards", () => {
    render(<ProposalGrid proposals={mockProposals} isLoading={false} />);

    // Check that each proposal card is rendered
    mockProposals.forEach((proposal) => {
      expect(
        screen.getByTestId(`proposal-card-${proposal.id}`)
      ).toBeInTheDocument();
    });

    // Check that the grid container has the correct responsive classes
    const gridContainer = screen.getByTestId("proposal-grid");
    expect(gridContainer).toHaveClass("grid");
    expect(gridContainer).toHaveClass("grid-cols-1");
    expect(gridContainer).toHaveClass("md:grid-cols-2");
    expect(gridContainer).toHaveClass("xl:grid-cols-3");
  });

  it("renders EmptyProposalState when there are no proposals", () => {
    render(<ProposalGrid proposals={[]} isLoading={false} />);
    expect(screen.getByTestId("empty-proposal-state")).toBeInTheDocument();
  });

  it("renders the loading skeleton when isLoading is true", () => {
    render(<ProposalGrid proposals={[]} isLoading={true} />);

    // Check that skeletons are rendered
    expect(screen.getByTestId("proposal-grid-skeleton")).toBeInTheDocument();
  });

  it("applies correct spacing between grid items", () => {
    render(<ProposalGrid proposals={mockProposals} isLoading={false} />);

    const gridContainer = screen.getByTestId("proposal-grid");
    expect(gridContainer).toHaveClass("gap-4");
  });

  it("passes the correct proposal data to each ProposalCard", () => {
    render(<ProposalGrid proposals={mockProposals} isLoading={false} />);

    // Check that each card displays the correct title and status
    mockProposals.forEach((proposal) => {
      const card = screen.getByTestId(`proposal-card-${proposal.id}`);
      expect(card).toHaveTextContent(`${proposal.title} - ${proposal.status}`);
    });
  });

  it("renders nothing when loading is true and there are proposals", () => {
    // Even with proposals, we should show the loading state
    render(<ProposalGrid proposals={mockProposals} isLoading={true} />);

    // Should show loading skeleton
    expect(screen.getByTestId("proposal-grid-skeleton")).toBeInTheDocument();

    // Should not render any proposal cards
    mockProposals.forEach((proposal) => {
      expect(
        screen.queryByTestId(`proposal-card-${proposal.id}`)
      ).not.toBeInTheDocument();
    });
  });
});
