import { render, screen } from "@testing-library/react";
import ProposalList from "../ProposalList";
import { getProposals } from "@/features/api/utils/proposals";
import EmptyDashboard from "../EmptyDashboard";

// Mock dependencies
jest.mock("@/lib/api/proposals", () => ({
  getProposals: jest.fn(),
}));

jest.mock("../EmptyDashboard", () => ({
  __esModule: true,
  default: jest.fn(() => (
    <div data-testid="empty-dashboard">No proposals found</div>
  )),
}));

jest.mock("../ProposalCard", () => ({
  ProposalCard: ({ proposal }: any) => (
    <div data-testid={`proposal-card-${proposal.id}`}>
      {proposal.title} - {proposal.status}
    </div>
  ),
}));

describe("ProposalList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders EmptyDashboard when no proposals are found", async () => {
    (getProposals as jest.Mock).mockResolvedValue([]);

    render(await ProposalList());

    expect(screen.getByTestId("empty-dashboard")).toBeInTheDocument();
  });

  it("renders all proposals in the "all" tab', async () => {
    const mockProposals = [
      {
        id: "1",
        title: "Proposal 1",
        status: "in_progress",
        progress: 30,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        title: "Proposal 2",
        status: "completed",
        progress: 100,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "3",
        title: "Proposal 3",
        status: "draft",
        progress: 10,
        createdAt: "",
        updatedAt: "",
      },
    ];

    (getProposals as jest.Mock).mockResolvedValue(mockProposals);

    render(await ProposalList());

    // Check all proposal cards are rendered
    expect(screen.getByTestId("proposal-card-1")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-card-2")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-card-3")).toBeInTheDocument();

    // Check tab counts
    expect(screen.getByText("All (3)")).toBeInTheDocument();
    expect(screen.getByText("Active (1)")).toBeInTheDocument();
    expect(screen.getByText("Completed (1)")).toBeInTheDocument();
    expect(screen.getByText("Drafts (1)")).toBeInTheDocument();
  });

  it("groups proposals correctly by status", async () => {
    const mockProposals = [
      {
        id: "1",
        title: "Proposal 1",
        status: "in_progress",
        progress: 30,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "2",
        title: "Proposal 2",
        status: "completed",
        progress: 100,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "3",
        title: "Proposal 3",
        status: "draft",
        progress: 10,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "4",
        title: "Proposal 4",
        status: "in_progress",
        progress: 50,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "5",
        title: "Proposal 5",
        status: "abandoned",
        progress: 20,
        createdAt: "",
        updatedAt: "",
      },
    ];

    (getProposals as jest.Mock).mockResolvedValue(mockProposals);

    render(await ProposalList());

    // Check tab counts
    expect(screen.getByText("All (5)")).toBeInTheDocument();
    expect(screen.getByText("Active (2)")).toBeInTheDocument(); // Only in_progress items
    expect(screen.getByText("Completed (1)")).toBeInTheDocument();
    expect(screen.getByText("Drafts (1)")).toBeInTheDocument();
  });
});
