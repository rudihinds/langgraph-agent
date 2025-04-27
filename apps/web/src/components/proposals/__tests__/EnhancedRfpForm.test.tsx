import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EnhancedRfpForm } from "../EnhancedRfpForm";
import { uploadProposalFileEnhanced } from "@/features/proposals/api/actions";

// Mock the useFileUploadToast hook
vi.mock("../UploadToast", () => ({
  useFileUploadToast: () => ({
    showFileUploadToast: vi.fn(),
  }),
}));

// Mock the server action
vi.mock("@/features/proposals/api/actions", () => ({
  uploadProposalFileEnhanced: vi.fn(),
}));

// Mock the AppointmentPicker component
vi.mock("@/components/ui/appointment-picker", () => ({
  AppointmentPicker: () => (
    <div data-testid="appointment-picker">Appointment Picker</div>
  ),
}));

describe("EnhancedRfpForm", () => {
  beforeEach(() => {
    vi.mocked(uploadProposalFileEnhanced).mockReset();
  });

  it("renders form elements correctly", () => {
    render(<EnhancedRfpForm userId="test-user" />);

    // Check if important elements are rendered
    expect(screen.getByLabelText(/proposal title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/funding amount/i)).toBeInTheDocument();
    expect(
      screen.getByText(/click to upload or drag and drop/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/create new proposal/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upload rfp/i })
    ).toBeInTheDocument();

    // Verify the upload button is disabled by default (no form data)
    expect(screen.getByRole("button", { name: /upload rfp/i })).toBeDisabled();
  });

  it("allows input in form fields", () => {
    render(<EnhancedRfpForm userId="test-user" />);

    // Find form inputs
    const titleInput = screen.getByLabelText(/proposal title/i);
    const descriptionInput = screen.getByLabelText(/description/i);
    const fundingInput = screen.getByLabelText(/funding amount/i);

    // Simulate user input
    fireEvent.change(titleInput, { target: { value: "Test Proposal" } });
    fireEvent.change(descriptionInput, {
      target: { value: "This is a test description" },
    });
    fireEvent.change(fundingInput, { target: { value: "10000.00" } });

    // Verify inputs have the expected values
    expect(titleInput).toHaveValue("Test Proposal");
    expect(descriptionInput).toHaveValue("This is a test description");
    expect(fundingInput).toHaveValue("10000.00");
  });

  it("handles file selection correctly", () => {
    render(<EnhancedRfpForm userId="test-user" />);

    // Get the file upload area and trigger it
    const fileUploader = screen.getByText(/click to upload or drag and drop/i);
    expect(fileUploader).toBeInTheDocument();

    // Verify that we can access the hidden file input
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
  });
});
