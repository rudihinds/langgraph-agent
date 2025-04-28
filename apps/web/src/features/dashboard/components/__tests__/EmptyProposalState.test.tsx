import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import { EmptyProposalState } from "@/features/dashboard/components/EmptyProposalState";

// Mock the NewProposalModal component
vi.mock("@/components/dashboard/NewProposalModal", () => ({
  __esModule: true,
  default: vi.fn(({ open, onOpenChange }) => {
    return open ? (
      <div data-testid="mock-modal">
        <button onClick={() => onOpenChange(false)}>Close Modal</button>
      </div>
    ) : null;
  }),
}));

describe("EmptyProposalState", () => {
  it("renders the illustration/icon", () => {
    render(<EmptyProposalState />);

    // Check for the document/clipboard icon
    const icon = screen.getByTestId("empty-state-icon");
    expect(icon).toBeInTheDocument();

    // Check that the icon is in a circular background
    const iconContainer = icon.parentElement;
    expect(iconContainer).toHaveClass("rounded-full");
    expect(iconContainer).toHaveClass("bg-primary/10");
  });

  it("renders the heading and description", () => {
    render(<EmptyProposalState />);

    // Check for the heading
    const heading = screen.getByRole("heading", { name: /No Proposals Yet/i });
    expect(heading).toBeInTheDocument();

    // Check for the description
    expect(
      screen.getByText(/Create your first proposal to get started/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/AI agent will guide you/i)).toBeInTheDocument();
  });

  it("renders the feature list with check marks", () => {
    render(<EmptyProposalState />);

    // Check for the feature list items
    const features = [
      "AI-assisted research and writing",
      "Generate persuasive content based on RFP requirements",
      "Export ready-to-submit proposals in multiple formats",
    ];

    features.forEach((feature) => {
      const featureElement = screen.getByText(feature);
      expect(featureElement).toBeInTheDocument();

      // Each feature should have a check mark icon
      const listItem = featureElement.closest("li");
      expect(listItem).toBeInTheDocument();

      // Check for the Check icon from lucide
      const svgIcon = listItem?.querySelector("svg");
      expect(svgIcon).toBeInTheDocument();
    });
  });

  it("opens the modal when button is clicked", async () => {
    const user = userEvent.setup();
    render(<EmptyProposalState />);

    // The modal should not be in the document initially
    expect(screen.queryByTestId("mock-modal")).not.toBeInTheDocument();

    // Click the button
    const button = screen.getByRole("button", {
      name: /Create Your First Proposal/i,
    });
    await user.click(button);

    // The modal should now be in the document
    expect(screen.getByTestId("mock-modal")).toBeInTheDocument();
  });

  it("has proper heading hierarchy for accessibility", () => {
    render(<EmptyProposalState />);

    const heading = screen.getByRole("heading", { name: /No Proposals Yet/i });
    expect(heading.tagName).toBe("H2");
  });

  it("has responsive styling", () => {
    render(<EmptyProposalState />);

    // Test responsive styling by checking for appropriate classes
    const container = screen.getByTestId("empty-proposal-state");
    expect(container).toHaveClass("w-full");
    expect(container).toHaveClass("max-w-3xl");
    expect(container).toHaveClass("mx-auto");

    // Content should be centered with appropriate spacing
    const cardContent = screen.getByTestId("card-content");
    expect(cardContent).toHaveClass("flex");
    expect(cardContent).toHaveClass("flex-col");
    expect(cardContent).toHaveClass("items-center");
  });

  it("has a prominent button with proper styling", () => {
    render(<EmptyProposalState />);

    const button = screen.getByRole("button", {
      name: /Create Your First Proposal/i,
    });

    // Button should have the proper size and styling
    expect(button).toHaveClass("gap-2");
    expect(button).toHaveClass("font-medium");

    // Check for the Plus icon
    const plusIcon = button.querySelector("svg");
    expect(plusIcon).toBeInTheDocument();
  });

  it("can close the modal", async () => {
    const user = userEvent.setup();
    render(<EmptyProposalState />);

    // Open the modal
    const button = screen.getByRole("button", {
      name: /Create Your First Proposal/i,
    });
    await user.click(button);

    // The modal should be in the document
    expect(screen.getByTestId("mock-modal")).toBeInTheDocument();

    // Close the modal
    const closeButton = screen.getByRole("button", { name: /Close Modal/i });
    await user.click(closeButton);

    // The modal should not be in the document anymore
    expect(screen.queryByTestId("mock-modal")).not.toBeInTheDocument();
  });
});
