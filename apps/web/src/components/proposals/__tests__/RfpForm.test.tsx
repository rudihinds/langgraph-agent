import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RfpForm } from "../RfpForm";
import { uploadProposalFile } from "@/lib/proposal-actions/actions";

// Mock the useFileUploadToast hook
vi.mock("../UploadToast", () => ({
  useFileUploadToast: () => ({
    showFileUploadToast: vi.fn(),
    updateFileUploadToast: vi.fn(),
  }),
}));

// Mock the server action
vi.mock("@/lib/proposal-actions/actions", () => ({
  uploadProposalFile: vi.fn(),
  createProposal: vi.fn().mockResolvedValue({ id: "mock-proposal-id" }),
}));

// Mock the AppointmentPicker component
vi.mock("@/components/ui/appointment-picker", () => ({
  AppointmentPicker: ({ label, error, onDateChange }) => (
    <div data-testid="appointment-picker">
      <label>{label}</label>
      <button
        data-testid="date-picker-button"
        onClick={() => onDateChange(new Date("2023-12-31"))}
      >
        Select Date
      </button>
      {error && (
        <div data-testid="date-error" className="text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  ),
}));

// Mock file
const createMockFile = (
  name = "test.pdf",
  type = "application/pdf",
  size = 1024
) => {
  const file = new File(["mock content"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("RfpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock scrollIntoView since it's not implemented in JSDOM
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it("renders form elements correctly", () => {
    render(<RfpForm userId="test-user" />);

    // Check if important elements are rendered
    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByText(/Funding Amount/)).toBeInTheDocument();
    expect(screen.getByText(/Submission Deadline/)).toBeInTheDocument();
    expect(screen.getByText(/RFP Document/)).toBeInTheDocument();
    expect(screen.getByText(/Create/)).toBeInTheDocument();
  });

  it("allows input in form fields", async () => {
    const user = userEvent.setup();
    render(<RfpForm userId="test-user" />);

    // Find form inputs
    const titleInput = screen.getByLabelText(/Title/);
    const descriptionInput = screen.getByLabelText(/Description/);
    const fundingInput = screen.getByLabelText(/Funding Amount/);

    // Simulate user input
    await user.type(titleInput, "Test Proposal");
    await user.type(descriptionInput, "This is a test description");
    await user.type(fundingInput, "10000.00");

    // Verify inputs have the expected values
    expect(titleInput).toHaveValue("Test Proposal");
    expect(descriptionInput).toHaveValue("This is a test description");
    expect(fundingInput).toHaveValue("10000.00");
  });

  // ----- VALIDATION TESTS -----

  it("validates required fields on submit", async () => {
    const user = userEvent.setup();
    render(<RfpForm userId="test-user" />);

    // Submit form without filling any fields
    const submitButton = screen.getByText(/Create/);
    await user.click(submitButton);

    // Check for validation error messages
    await waitFor(() => {
      expect(screen.getByText(/Title is required/)).toBeInTheDocument();
      expect(screen.getByText(/Description is required/)).toBeInTheDocument();
      expect(screen.getByText(/Deadline is required/)).toBeInTheDocument();
      expect(
        screen.getByText(/Funding Amount is required/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Please select a valid file/)
      ).toBeInTheDocument();
    });
  });

  it("validates minimum length requirements", async () => {
    const user = userEvent.setup();
    render(<RfpForm userId="test-user" />);

    // Fill fields with values that are too short
    await user.type(screen.getByLabelText(/Title/), "Test");
    await user.type(screen.getByLabelText(/Description/), "Short");
    await user.type(screen.getByLabelText(/Funding Amount/), "0");

    // Submit form
    const submitButton = screen.getByText(/Create/);
    await user.click(submitButton);

    // Check for validation error messages
    await waitFor(() => {
      expect(
        screen.getByText(/Title must be at least 5 characters/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Description must be at least 10 characters/)
      ).toBeInTheDocument();
    });
  });

  it("validates funding amount format", async () => {
    const user = userEvent.setup();
    render(<RfpForm userId="test-user" />);

    // Fill title and description with valid values to isolate funding amount validation
    await user.type(screen.getByLabelText(/Title/), "Valid Test Title");
    await user.type(
      screen.getByLabelText(/Description/),
      "This is a valid description for testing"
    );

    // Fill funding amount with invalid format
    await user.type(screen.getByLabelText(/Funding Amount/), "invalid-amount");

    // Submit form
    const submitButton = screen.getByText(/Create/);
    await user.click(submitButton);

    // Check for validation error message
    await waitFor(() => {
      expect(
        screen.getByText(/Please enter a valid funding amount/)
      ).toBeInTheDocument();
    });
  });

  it("validates file upload type and size", async () => {
    const user = userEvent.setup();
    render(<RfpForm userId="test-user" />);

    // Create invalid file (wrong type)
    const invalidTypeFile = createMockFile(
      "test.exe",
      "application/x-msdownload",
      1024
    );

    // Mock file input change
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();

    // Trigger file selection with invalid file
    if (fileInput) {
      await fireEvent.change(fileInput, {
        target: { files: [invalidTypeFile] },
      });
    }

    // Submit form
    const submitButton = screen.getByText(/Create/);
    await user.click(submitButton);

    // Check for file type validation error
    await waitFor(() => {
      expect(screen.getByText(/File type not supported/)).toBeInTheDocument();
    });

    // Create file that's too large
    const oversizedFile = createMockFile(
      "large.pdf",
      "application/pdf",
      60 * 1024 * 1024
    ); // 60MB

    // Trigger file selection with oversized file
    if (fileInput) {
      await fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    }

    // Check for file size validation error
    await waitFor(() => {
      expect(
        screen.getByText(/File size exceeds 50MB limit/)
      ).toBeInTheDocument();
    });
  });

  it("clears field errors when valid input is provided", async () => {
    const user = userEvent.setup();
    render(<RfpForm userId="test-user" />);

    // Submit empty form to trigger validation errors
    const submitButton = screen.getByText(/Create/);
    await user.click(submitButton);

    // Verify errors are shown
    await waitFor(() => {
      expect(screen.getByText(/Title is required/)).toBeInTheDocument();
    });

    // Now enter valid input
    await user.type(screen.getByLabelText(/Title/), "Valid Title Input");

    // Error for title should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/Title is required/)).not.toBeInTheDocument();
    });
  });

  it("submits form when all validation passes", async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<RfpForm userId="test-user" onSuccess={onSuccess} />);

    // Fill all required fields with valid values
    await user.type(screen.getByLabelText(/Title/), "Valid Test Title");
    await user.type(
      screen.getByLabelText(/Description/),
      "This is a valid description for testing purposes"
    );
    await user.type(screen.getByLabelText(/Funding Amount/), "10000.00");

    // Select date
    await user.click(screen.getByTestId("date-picker-button"));

    // Upload valid file
    const validFile = createMockFile("test.pdf", "application/pdf", 1024);
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      await fireEvent.change(fileInput, { target: { files: [validFile] } });
    }

    // Submit form
    const submitButton = screen.getByText(/Create/);
    await user.click(submitButton);

    // Should not show validation errors
    await waitFor(() => {
      expect(screen.queryByText(/is required/)).not.toBeInTheDocument();
    });

    // Mock should have been called
    expect(uploadProposalFile).toHaveBeenCalled();
  });

  it("focuses on first invalid field when validation fails", async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    window.HTMLElement.prototype.focus = vi.fn();

    const user = userEvent.setup();
    render(<RfpForm userId="test-user" />);

    // Skip title but fill other fields to ensure title is the first error
    await user.type(
      screen.getByLabelText(/Description/),
      "This is a valid description for testing"
    );
    await user.type(screen.getByLabelText(/Funding Amount/), "10000.00");
    await user.click(screen.getByTestId("date-picker-button"));

    // Submit form
    const submitButton = screen.getByText(/Create/);
    await user.click(submitButton);

    // Verify focus was attempted on the title field
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });
});
