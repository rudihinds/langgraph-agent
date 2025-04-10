import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { NewProposalModal } from "../NewProposalModal";

// Mock router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe("NewProposalModal", () => {
  const onOpenChange = vi.fn();
  const defaultProps = {
    open: true,
    onOpenChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly when open", () => {
    render(<NewProposalModal {...defaultProps} />);

    expect(screen.getByText("Create New Proposal")).toBeInTheDocument();
    expect(screen.getByLabelText("Proposal Name")).toBeInTheDocument();
    expect(screen.getByLabelText("RFP/Client Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<NewProposalModal open={false} onOpenChange={onOpenChange} />);
    
    expect(screen.queryByText("Create New Proposal")).not.toBeInTheDocument();
  });

  it("validates required fields", async () => {
    render(<NewProposalModal {...defaultProps} />);
    
    // Try to submit without filling required fields
    const createButton = screen.getByRole("button", { name: "Create" });
    fireEvent.click(createButton);

    // Validation messages should appear
    await waitFor(() => {
      expect(screen.getByText("Proposal name is required")).toBeInTheDocument();
      expect(screen.getByText("Client name is required")).toBeInTheDocument();
    });
  });

  it("calls onOpenChange when canceling", async () => {
    const user = userEvent.setup();
    render(<NewProposalModal {...defaultProps} />);
    
    // Click the cancel button
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("calls onOpenChange when clicking outside the modal", async () => {
    render(<NewProposalModal {...defaultProps} />);
    
    // Find and click the overlay
    const overlay = screen.getByTestId("dialog-overlay");
    fireEvent.click(overlay);
    
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("submits form with valid data", async () => {
    const user = userEvent.setup();
    const mockPush = vi.fn();
    
    vi.mock("next/navigation", () => ({
      useRouter: () => ({
        push: mockPush,
      }),
    }));
    
    render(<NewProposalModal {...defaultProps} />);
    
    // Fill out the form
    await user.type(screen.getByLabelText("Proposal Name"), "Test Proposal");
    await user.type(screen.getByLabelText("RFP/Client Name"), "Test Client");
    
    // Submit the form
    await user.click(screen.getByRole("button", { name: "Create" }));
    
    // Form should be submitted
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/proposals/new");
    });
  });

  it("is accessible", async () => {
    const { container } = render(<NewProposalModal {...defaultProps} />);
    
    // Test for proper heading and focus management
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    
    // Make sure the first focusable element receives focus
    expect(screen.getByLabelText("Proposal Name")).toHaveFocus();
  });
});