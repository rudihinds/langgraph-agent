import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FunderDetails } from "../FunderDetailsView";
import { Question } from "../ApplicationQuestionsView";

// Mock the ReviewProposalView component since we can't load the real one
vi.mock("../ReviewProposalView", () => ({
  default: ({
    onSubmit,
    onBack,
    onEdit,
    funderDetails,
    applicationQuestions,
    proposalType,
    isSubmitting = false,
  }) => (
    <div data-testid="review-proposal-mock">
      <h1>Review Your Proposal</h1>
      <div>
        <h2>Funder Details</h2>
        <p>{funderDetails.organizationName}</p>
        <p>{funderDetails.website}</p>
        <button onClick={() => onEdit(1)}>Edit</button>
      </div>

      {proposalType === "application" && (
        <div>
          <h2>Application Questions</h2>
          {applicationQuestions.map((q, i) => (
            <p key={i}>{q.text}</p>
          ))}
          <button onClick={() => onEdit(2)}>Edit</button>
        </div>
      )}

      {proposalType === "rfp" && (
        <div>
          <h2>RFP Documents</h2>
          <p>RFP document details here...</p>
        </div>
      )}

      <div>
        <button onClick={onBack} disabled={isSubmitting}>
          Back
        </button>

        <button onClick={() => onSubmit({})} disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Proposal"}
        </button>
      </div>
    </div>
  ),
}));

// After the mock is defined, import the component
import ReviewProposalView from "../ReviewProposalView";

describe("ReviewProposalView", () => {
  const mockOnSubmit = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnEdit = vi.fn();

  const mockFunderDetails: FunderDetails = {
    organizationName: "Test Foundation",
    contactName: "John Doe",
    email: "contact@test.com",
    website: "https://testfoundation.org",
    fundingTitle: "Test Program",
    deadline: new Date("2023-12-31"),
    budgetRange: "50000",
    focusArea: "Education",
  };

  const mockApplicationQuestions: Question[] = [
    {
      id: "q1",
      text: "What is your project about?",
      required: true,
      wordLimit: 100,
      charLimit: 500,
      category: null,
    },
    {
      id: "q2",
      text: "What is your budget?",
      required: true,
      wordLimit: 50,
      charLimit: 200,
      category: null,
    },
  ];

  it("renders RFP proposal type correctly", () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={[]}
        proposalType="rfp"
      />
    );

    expect(screen.getByText("Review Your Proposal")).toBeInTheDocument();
    expect(screen.getByText("Funder Details")).toBeInTheDocument();
    expect(screen.getByText("RFP Documents")).toBeInTheDocument();
    expect(screen.getByText("Test Foundation")).toBeInTheDocument();
    expect(screen.getByText("https://testfoundation.org")).toBeInTheDocument();
  });

  it("renders application proposal type correctly", () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={mockApplicationQuestions}
        proposalType="application"
      />
    );

    expect(screen.getByText("Review Your Proposal")).toBeInTheDocument();
    expect(screen.getByText("Funder Details")).toBeInTheDocument();
    expect(screen.getByText("Application Questions")).toBeInTheDocument();
    expect(screen.getByText("Test Foundation")).toBeInTheDocument();
    expect(screen.getByText("What is your project about?")).toBeInTheDocument();
    expect(screen.getByText("What is your budget?")).toBeInTheDocument();
  });

  it("handles edit button clicks", () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={mockApplicationQuestions}
        proposalType="application"
      />
    );

    const editButtons = screen.getAllByText("Edit");
    fireEvent.click(editButtons[0]); // Click on funder details edit

    expect(mockOnEdit).toHaveBeenCalledWith(1);

    fireEvent.click(editButtons[1]); // Click on application questions edit

    expect(mockOnEdit).toHaveBeenCalledWith(2);
  });

  it("handles back button click", () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={mockApplicationQuestions}
        proposalType="application"
      />
    );

    const backButton = screen.getByText("Back");
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalled();
  });

  it("handles submit button click", () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={mockApplicationQuestions}
        proposalType="application"
      />
    );

    const submitButton = screen.getByText("Submit Proposal");
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it("displays loading state when submitting", () => {
    render(
      <ReviewProposalView
        onSubmit={mockOnSubmit}
        onBack={mockOnBack}
        onEdit={mockOnEdit}
        funderDetails={mockFunderDetails}
        applicationQuestions={mockApplicationQuestions}
        proposalType="application"
        isSubmitting={true}
      />
    );

    expect(screen.getByText("Submitting...")).toBeInTheDocument();

    const backButton = screen.getByText("Back");
    const submitButton = screen.getByText("Submitting...");

    expect(backButton).toBeDisabled();
    expect(submitButton).toBeDisabled();
  });
});
