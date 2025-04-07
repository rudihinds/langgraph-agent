import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReviewProposalView from "@/components/proposals/ReviewProposalView";
import { formatDateForAPI, formatDateForUI } from "@/lib/utils/date-utils";

// Mock ServerForm component to avoid server-side issues
vi.mock("@/components/proposals/ServerForm", () => ({
  default: ({ formData }: any) => (
    <div data-testid="server-form">
      <pre data-testid="form-data">{JSON.stringify(formData, null, 2)}</pre>
    </div>
  ),
}));

describe("ReviewProposalView", () => {
  const mockOnSubmit = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnEdit = vi.fn();

  const testDate = new Date(2024, 0, 15);
  const apiFormattedDate = formatDateForAPI(testDate);

  const defaultProps = {
    onSubmit: mockOnSubmit,
    onBack: mockOnBack,
    onEdit: mockOnEdit,
    funderDetails: {
      organizationName: "Test Organization",
      fundingTitle: "Test Grant Program",
      deadline: testDate,
      budgetRange: "75000",
      focusArea: "Healthcare",
    },
    applicationQuestions: [
      { question: "What is the main goal of your project?", required: true },
      { question: "How will you measure success?", required: true },
    ],
    proposalType: "application" as const,
    isSubmitting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("displays the funder details with correctly formatted date", () => {
    render(<ReviewProposalView {...defaultProps} />);

    // Check organization name is displayed
    expect(screen.getByText("Test Organization")).toBeInTheDocument();

    // Check funding title is displayed
    expect(screen.getByText("Test Grant Program")).toBeInTheDocument();

    // Check date is displayed in human-readable format (not using the API format)
    expect(screen.getByText("January 15, 2024")).toBeInTheDocument();

    // Check budget is formatted with $ and commas
    expect(screen.getByText("$75,000")).toBeInTheDocument();

    // Check focus area is displayed
    expect(screen.getByText("Healthcare")).toBeInTheDocument();
  });

  it("prepares form data with dates in ISO format for API submission", () => {
    render(<ReviewProposalView {...defaultProps} />);

    // Get the form data that would be submitted to the API
    const formDataElement = screen.getByTestId("form-data");
    const formData = JSON.parse(formDataElement.textContent || "{}");

    // Verify the top-level deadline is in ISO format
    expect(formData.deadline).toEqual(expect.stringContaining("T"));

    // Verify the nested deadline in metadata is also in ISO format
    expect(formData.metadata.funder_details.deadline).toEqual(
      expect.stringContaining("T")
    );
  });

  it("handles RFP proposal type correctly", () => {
    const rfpProps = {
      ...defaultProps,
      proposalType: "rfp" as const,
      rfpDetails: {
        rfpUrl: "https://example.com/rfp",
        rfpText: "Example RFP text",
        companyName: "Example Company",
        document: {
          name: "rfp-document.pdf",
          type: "application/pdf",
          size: 1024,
          lastModified: Date.now(),
        },
      },
      applicationQuestions: [],
    };

    render(<ReviewProposalView {...rfpProps} />);

    // Verify RFP Details heading is shown instead of Application Questions
    expect(screen.getByText("RFP Details")).toBeInTheDocument();

    // Get the form data that would be submitted to the API
    const formDataElement = screen.getByTestId("form-data");
    const formData = JSON.parse(formDataElement.textContent || "{}");

    // Verify RFP-specific data is included
    expect(formData.metadata.rfp_details).toBeDefined();
    expect(formData.metadata.rfp_details.rfpUrl).toBe(
      "https://example.com/rfp"
    );
    expect(formData.metadata.proposal_type).toBe("rfp");
  });

  it("has edit buttons that call onEdit with the correct step", () => {
    render(<ReviewProposalView {...defaultProps} />);

    // Find all edit buttons
    const editButtons = screen.getAllByText("Edit");

    // Click the first edit button (for funder details)
    editButtons[0].click();
    expect(mockOnEdit).toHaveBeenCalledWith(1);

    // Click the second edit button (for application questions)
    editButtons[1].click();
    expect(mockOnEdit).toHaveBeenCalledWith(2);
  });
});
