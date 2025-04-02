import { render, screen } from "@testing-library/react";
import { ProposalCard } from "../ProposalCard";
import { formatDistanceToNow } from "date-fns";

// Mock the next/link component
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

describe("ProposalCard", () => {
  const mockProposal = {
    id: "proposal-1",
    title: "Test Proposal",
    organization: "Test Organization",
    status: "in_progress",
    progress: 45,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    phase: "research",
  };

  it("renders the proposal card with correct data", () => {
    render(<ProposalCard proposal={mockProposal} />);

    // Check title and organization
    expect(screen.getByText("Test Proposal")).toBeInTheDocument();
    expect(screen.getByText("Test Organization")).toBeInTheDocument();

    // Check status badge
    expect(screen.getByText("In Progress")).toBeInTheDocument();

    // Check progress indicator
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("45%")).toBeInTheDocument();

    // Check phase
    expect(screen.getByText("Phase: Research")).toBeInTheDocument();

    // Check continue button exists
    expect(
      screen.getByRole("button", { name: /continue/i })
    ).toBeInTheDocument();
  });

  it("renders with default phase when not provided", () => {
    const proposalWithoutPhase = { ...mockProposal, phase: undefined };
    render(<ProposalCard proposal={proposalWithoutPhase} />);

    // Should default to "Research"
    expect(screen.getByText("Phase: Research")).toBeInTheDocument();
  });

  it("renders draft status correctly", () => {
    const draftProposal = { ...mockProposal, status: "draft" };
    render(<ProposalCard proposal={draftProposal} />);

    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders completed status correctly", () => {
    const completedProposal = { ...mockProposal, status: "completed" };
    render(<ProposalCard proposal={completedProposal} />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("excludes organization when not provided", () => {
    const proposalWithoutOrg = { ...mockProposal, organization: undefined };
    const { container } = render(
      <ProposalCard proposal={proposalWithoutOrg} />
    );

    // Organization should not be in the document
    expect(screen.queryByText("Test Organization")).not.toBeInTheDocument();
  });

  it("links to the correct proposal page", () => {
    render(<ProposalCard proposal={mockProposal} />);

    // Title link
    const titleLink = screen.getByText("Test Proposal").closest("a");
    expect(titleLink).toHaveAttribute("href", "/proposals/proposal-1");

    // Continue button link
    const continueButton = screen
      .getByRole("button", { name: /continue/i })
      .closest("a");
    expect(continueButton).toHaveAttribute("href", "/proposals/proposal-1");
  });

  it("shows the correct last updated time", () => {
    const updatedAt = new Date();
    updatedAt.setHours(updatedAt.getHours() - 2); // 2 hours ago

    const recentProposal = {
      ...mockProposal,
      updatedAt: updatedAt.toISOString(),
    };
    render(<ProposalCard proposal={recentProposal} />);

    const expectedText = `Updated ${formatDistanceToNow(updatedAt, { addSuffix: true })}`;
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });
});
