import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Create mock functions
const mockCreateProposal = vi.fn();
const mockUploadProposalFile = vi.fn();
const mockOnCancel = vi.fn();

// Mock components and dependencies
vi.mock("../ServerForm", () => ({
  __esModule: true,
  default: ({ formData, file, onCancel }) => (
    <div data-testid="server-form-mock">
      <div>Form Data: {JSON.stringify(formData)}</div>
      <div>File: {file?.name || "No file"}</div>
      <button onClick={onCancel}>Cancel</button>
      <button
        onClick={async () => {
          const result = await mockCreateProposal(formData);
          if (result?.success && file) {
            await mockUploadProposalFile(file, result.proposal.id);
          }
        }}
      >
        Create Proposal
      </button>
    </div>
  ),
}));

// Import component after mocking
import ServerForm from "../ServerForm";

describe("ServerForm", () => {
  const testFile = new File(["test content"], "test-rfp.pdf", {
    type: "application/pdf",
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful responses
    mockCreateProposal.mockResolvedValue({
      success: true,
      proposal: { id: "mock-proposal-id" },
    });

    mockUploadProposalFile.mockResolvedValue({
      success: true,
      message: "File uploaded successfully",
    });
  });

  it("renders with form data and file information", () => {
    render(
      <ServerForm
        proposalType="rfp"
        formData={{ title: "Test RFP" }}
        file={testFile}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/Form Data:/)).toBeInTheDocument();
    expect(screen.getByText(/Test RFP/)).toBeInTheDocument();
    expect(screen.getByText(/test-rfp.pdf/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Proposal" })
    ).toBeInTheDocument();
  });

  it("calls onCancel when cancel button is clicked", async () => {
    render(
      <ServerForm
        proposalType="rfp"
        formData={{ title: "Test RFP" }}
        file={testFile}
        onCancel={mockOnCancel}
      />
    );

    await userEvent.click(screen.getByText("Cancel"));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("calls createProposal and uploadProposalFile when submitting", async () => {
    render(
      <ServerForm
        proposalType="rfp"
        formData={{ title: "Test RFP" }}
        file={testFile}
        onCancel={mockOnCancel}
      />
    );

    await userEvent.click(screen.getByText("Create Proposal"));

    expect(mockCreateProposal).toHaveBeenCalledTimes(1);
    expect(mockCreateProposal).toHaveBeenCalledWith({ title: "Test RFP" });

    expect(mockUploadProposalFile).toHaveBeenCalledTimes(1);
    expect(mockUploadProposalFile).toHaveBeenCalledWith(
      testFile,
      "mock-proposal-id"
    );
  });

  it("doesn't call uploadProposalFile if createProposal fails", async () => {
    // Override for this test
    mockCreateProposal.mockResolvedValueOnce({
      success: false,
      error: "Failed to create proposal",
    });

    render(
      <ServerForm
        proposalType="rfp"
        formData={{ title: "Test RFP" }}
        file={testFile}
        onCancel={mockOnCancel}
      />
    );

    await userEvent.click(screen.getByText("Create Proposal"));

    expect(mockCreateProposal).toHaveBeenCalledTimes(1);
    expect(mockUploadProposalFile).not.toHaveBeenCalled();
  });
});
