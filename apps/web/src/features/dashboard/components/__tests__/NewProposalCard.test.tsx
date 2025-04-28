import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NewProposalCard from "../NewProposalCard";

// Mock the NewProposalModal component
vi.mock("../NewProposalModal", () => ({
  default: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="proposal-modal" data-open={open}>
      Modal Content
      <button onClick={() => onOpenChange(false)}>Close</button>
    </div>
  ),
}));

describe("NewProposalCard", () => {
  it("renders correctly", () => {
    render(<NewProposalCard />);

    // Check if the card is rendered
    const card = screen.getByTestId("new-proposal-card");
    expect(card).toBeInTheDocument();

    // Check for the text content
    expect(screen.getByText("Create New Proposal")).toBeInTheDocument();
    expect(
      screen.getByText("Start your next winning proposal")
    ).toBeInTheDocument();

    // Check for the plus icon
    const plusIcon = card.querySelector("svg");
    expect(plusIcon).toBeInTheDocument();
  });

  it("opens the modal when clicked", () => {
    render(<NewProposalCard />);

    // Modal should initially be closed
    const modal = screen.getByTestId("proposal-modal");
    expect(modal.getAttribute("data-open")).toBe("false");

    // Click on the card
    const card = screen.getByTestId("new-proposal-card");
    fireEvent.click(card);

    // Modal should now be open
    expect(modal.getAttribute("data-open")).toBe("true");
  });

  it("closes the modal when requested", () => {
    render(<NewProposalCard />);

    // Open the modal
    const card = screen.getByTestId("new-proposal-card");
    fireEvent.click(card);

    // Modal should be open
    const modal = screen.getByTestId("proposal-modal");
    expect(modal.getAttribute("data-open")).toBe("true");

    // Close the modal
    const closeButton = screen.getByText("Close");
    fireEvent.click(closeButton);

    // Modal should now be closed
    expect(modal.getAttribute("data-open")).toBe("false");
  });
});
