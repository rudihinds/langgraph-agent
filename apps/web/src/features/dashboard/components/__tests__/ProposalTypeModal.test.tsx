import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import ProposalTypeModal from "../ProposalTypeModal";

describe("ProposalTypeModal", () => {
  const onSelectMock = vi.fn();
  const onOpenChangeMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly when open", () => {
    render(
      <ProposalTypeModal
        open={true}
        onOpenChange={onOpenChangeMock}
        onSelect={onSelectMock}
      />
    );

    // Check modal title and description
    expect(screen.getByText("Create New Proposal")).toBeInTheDocument();
    expect(
      screen.getByText(/Select the type of proposal you want to create/)
    ).toBeInTheDocument();

    // Check both option cards are present
    expect(screen.getByText("RFP Response")).toBeInTheDocument();
    expect(screen.getByText("Application Questions")).toBeInTheDocument();

    // Check buttons
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    const continueButton = screen.getByRole("button", { name: /Continue/i });
    expect(continueButton).toBeInTheDocument();
    expect(continueButton).toBeDisabled();
  });

  it("does not render when closed", () => {
    render(
      <ProposalTypeModal
        open={false}
        onOpenChange={onOpenChangeMock}
        onSelect={onSelectMock}
      />
    );

    expect(screen.queryByText("Create New Proposal")).not.toBeInTheDocument();
  });

  it("enables continue button after selecting an option", async () => {
    render(
      <ProposalTypeModal
        open={true}
        onOpenChange={onOpenChangeMock}
        onSelect={onSelectMock}
      />
    );

    // Initially disabled
    const continueButton = screen.getByRole("button", { name: /Continue/i });
    expect(continueButton).toBeDisabled();

    // Select RFP option
    const rfpOption = screen.getByTestId("option-rfp");
    fireEvent.click(rfpOption);

    // Button should now be enabled
    expect(continueButton).not.toBeDisabled();
  });

  it("calls onSelect with 'rfp' when RFP option is selected and continue is clicked", async () => {
    render(
      <ProposalTypeModal
        open={true}
        onOpenChange={onOpenChangeMock}
        onSelect={onSelectMock}
      />
    );

    // Select RFP option
    const rfpOption = screen.getByTestId("option-rfp");
    fireEvent.click(rfpOption);

    // Click continue
    const continueButton = screen.getByRole("button", { name: /Continue/i });
    fireEvent.click(continueButton);

    // Check onSelect was called with 'rfp'
    expect(onSelectMock).toHaveBeenCalledWith("rfp");
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("calls onSelect with 'application' when Application option is selected and continue is clicked", async () => {
    render(
      <ProposalTypeModal
        open={true}
        onOpenChange={onOpenChangeMock}
        onSelect={onSelectMock}
      />
    );

    // Select Application option
    const applicationOption = screen.getByTestId("option-application");
    fireEvent.click(applicationOption);

    // Click continue
    const continueButton = screen.getByRole("button", { name: /Continue/i });
    fireEvent.click(continueButton);

    // Check onSelect was called with 'application'
    expect(onSelectMock).toHaveBeenCalledWith("application");
    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange when Cancel button is clicked", async () => {
    render(
      <ProposalTypeModal
        open={true}
        onOpenChange={onOpenChangeMock}
        onSelect={onSelectMock}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
    expect(onSelectMock).not.toHaveBeenCalled();
  });

  it("supports keyboard navigation between options", async () => {
    const user = userEvent.setup();
    render(
      <ProposalTypeModal
        open={true}
        onOpenChange={onOpenChangeMock}
        onSelect={onSelectMock}
      />
    );

    // Focus the first option
    const rfpOption = screen.getByTestId("option-rfp");
    rfpOption.focus();
    expect(document.activeElement).toBe(rfpOption);

    // Tab to the next option
    await user.tab();
    const applicationOption = screen.getByTestId("option-application");
    expect(document.activeElement).toBe(applicationOption);

    // Select with space key
    await user.keyboard(" ");

    // Continue button should be enabled
    const continueButton = screen.getByRole("button", { name: /Continue/i });
    expect(continueButton).not.toBeDisabled();
  });

  it("closes when escape key is pressed", async () => {
    const user = userEvent.setup();
    render(
      <ProposalTypeModal
        open={true}
        onOpenChange={onOpenChangeMock}
        onSelect={onSelectMock}
      />
    );

    // Press escape key
    await user.keyboard("{Escape}");

    expect(onOpenChangeMock).toHaveBeenCalledWith(false);
  });

  it("traps focus within the modal", async () => {
    const user = userEvent.setup();
    render(
      <ProposalTypeModal
        open={true}
        onOpenChange={onOpenChangeMock}
        onSelect={onSelectMock}
      />
    );

    // Tab through all focusable elements and verify focus wraps around
    // First focusable element should be the RFP option
    await user.tab();
    expect(document.activeElement).toHaveAttribute("data-testid", "option-rfp");

    // Tab a few more times
    await user.tab();
    await user.tab();
    await user.tab();
    await user.tab();

    // Focus should wrap back to an element within the modal, not escape it
    expect(
      document.activeElement?.closest('[role="dialog"]')
    ).toBeInTheDocument();
  });

  it("applies visual styling to selected option", async () => {
    render(
      <ProposalTypeModal
        open={true}
        onOpenChange={onOpenChangeMock}
        onSelect={onSelectMock}
      />
    );

    // Select RFP option
    const rfpOption = screen.getByTestId("option-rfp");
    fireEvent.click(rfpOption);

    // Check it has the selected class/attribute
    expect(rfpOption).toHaveAttribute("aria-selected", "true");

    // Select Application option
    const applicationOption = screen.getByTestId("option-application");
    fireEvent.click(applicationOption);

    // Check RFP is no longer selected and Application is
    expect(rfpOption).toHaveAttribute("aria-selected", "false");
    expect(applicationOption).toHaveAttribute("aria-selected", "true");
  });
});
