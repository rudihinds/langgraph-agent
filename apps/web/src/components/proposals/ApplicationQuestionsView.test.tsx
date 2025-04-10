import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import ApplicationQuestionsView from "./ApplicationQuestionsView";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

describe("ApplicationQuestionsView", () => {
  const mockOnSubmit = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it("renders the component with initial empty question", () => {
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Check for main elements
    expect(screen.getByText("Application Questions")).toBeInTheDocument();
    expect(
      screen.getByText(/Enter the questions from your application/i)
    ).toBeInTheDocument();

    // Should have one question field initially
    expect(screen.getByLabelText(/Question 1/i)).toBeInTheDocument();

    // Should have Add Question button
    expect(screen.getByText("Add Question")).toBeInTheDocument();

    // Should have navigation buttons
    expect(screen.getByText("Continue")).toBeInTheDocument();
    expect(screen.getByText("Back")).toBeInTheDocument();
  });

  it("allows adding new questions", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Initially has one question
    expect(screen.getByLabelText(/Question 1/i)).toBeInTheDocument();

    // Add a new question
    await user.click(screen.getByText("Add Question"));

    // Should now have two questions
    expect(screen.getByLabelText(/Question 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Question 2/i)).toBeInTheDocument();

    // Add another question
    await user.click(screen.getByText("Add Question"));

    // Should now have three questions
    expect(screen.getByLabelText(/Question 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Question 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Question 3/i)).toBeInTheDocument();
  });

  it("allows removing questions", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Add a second question
    await user.click(screen.getByText("Add Question"));

    // Should have two questions
    expect(screen.getByLabelText(/Question 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Question 2/i)).toBeInTheDocument();

    // Remove the second question
    const removeButtons = screen.getAllByLabelText(/Remove question/i);
    await user.click(removeButtons[1]); // Second remove button

    // Should now have only one question
    expect(screen.getByLabelText(/Question 1/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Question 2/i)).not.toBeInTheDocument();
  });

  it("prevents removing the last question", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Try to remove the only question
    const removeButton = screen.getByLabelText(/Remove question/i);
    await user.click(removeButton);

    // The question should still be there
    expect(screen.getByLabelText(/Question 1/i)).toBeInTheDocument();
  });

  it("allows editing question text", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Get the first question input
    const questionInput = screen.getByLabelText(/Question 1/i);

    // Type in the question
    await user.clear(questionInput);
    await user.type(questionInput, "What is your organization's mission?");

    // Check that the value was updated
    expect(questionInput).toHaveValue("What is your organization's mission?");
  });

  it("allows setting word/character limits", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Open the first question's options
    const expandButton = screen.getByLabelText(/Options for question 1/i);
    await user.click(expandButton);

    // Set word limit
    const wordLimitInput = screen.getByLabelText(/Word limit/i);
    await user.clear(wordLimitInput);
    await user.type(wordLimitInput, "500");

    // Check that the value was updated
    expect(wordLimitInput).toHaveValue(500);
  });

  it("allows setting a category for questions", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Open the first question's options
    const expandButton = screen.getByLabelText(/Options for question 1/i);
    await user.click(expandButton);

    // Open category dropdown
    const categorySelect = screen.getByLabelText(/Category/i);
    await user.click(categorySelect);

    // Select Organizational Background
    const option = screen.getByText("Organizational Background");
    await user.click(option);

    // Check that the selection was made
    expect(categorySelect).toHaveTextContent("Organizational Background");
  });

  it("validates empty questions on submit", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Click submit without entering question text
    await user.click(screen.getByText("Continue"));

    // Should show validation error
    expect(screen.getByText(/Question text is required/i)).toBeInTheDocument();

    // onSubmit should not be called
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("submits the form when valid", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Enter question text
    const questionInput = screen.getByLabelText(/Question 1/i);
    await user.clear(questionInput);
    await user.type(questionInput, "What is your organization's mission?");

    // Add and fill second question
    await user.click(screen.getByText("Add Question"));
    const questionInput2 = screen.getByLabelText(/Question 2/i);
    await user.clear(questionInput2);
    await user.type(questionInput2, "Describe your project goals.");

    // Submit the form
    await user.click(screen.getByText("Continue"));

    // onSubmit should be called with the questions
    expect(mockOnSubmit).toHaveBeenCalledWith({
      questions: [
        {
          text: "What is your organization's mission?",
          wordLimit: null,
          charLimit: null,
          category: null,
        },
        {
          text: "Describe your project goals.",
          wordLimit: null,
          charLimit: null,
          category: null,
        },
      ],
    });
  });

  it("calls onBack when back button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Click back button
    await user.click(screen.getByText("Back"));

    // onBack should be called
    expect(mockOnBack).toHaveBeenCalled();
  });

  it("allows bulk importing questions", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Click bulk import button
    await user.click(screen.getByText(/Bulk Import/i));

    // Should open a modal
    expect(screen.getByText(/Paste your questions/i)).toBeInTheDocument();

    // Type multiple questions
    const textArea = screen.getByLabelText(/Questions/i);
    await user.clear(textArea);
    await user.type(
      textArea,
      "What is your mission?\nDescribe your project.\nWhat is your budget?"
    );

    // Submit the bulk import
    await user.click(screen.getByText(/Import/i));

    // Should have three questions now
    expect(screen.getByText("What is your mission?")).toBeInTheDocument();
    expect(screen.getByText("Describe your project.")).toBeInTheDocument();
    expect(screen.getByText("What is your budget?")).toBeInTheDocument();
  });

  it("allows reordering questions", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Add a few questions
    await user.clear(screen.getByLabelText(/Question 1/i));
    await user.type(screen.getByLabelText(/Question 1/i), "Question One");

    await user.click(screen.getByText("Add Question"));
    await user.clear(screen.getByLabelText(/Question 2/i));
    await user.type(screen.getByLabelText(/Question 2/i), "Question Two");

    await user.click(screen.getByText("Add Question"));
    await user.clear(screen.getByLabelText(/Question 3/i));
    await user.type(screen.getByLabelText(/Question 3/i), "Question Three");

    // Move question 3 up
    const moveUpButtons = screen.getAllByLabelText(/Move question up/i);
    await user.click(moveUpButtons[2]); // Third question's up button

    // Check order by getting all inputs and checking their values
    const questionInputs = screen.getAllByLabelText(/Question \d/i);
    expect(questionInputs[0]).toHaveValue("Question One");
    expect(questionInputs[1]).toHaveValue("Question Three"); // This should now be question 2
    expect(questionInputs[2]).toHaveValue("Question Two"); // This should now be question 3
  });

  it("auto-saves questions to localStorage", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Enter a question
    const questionInput = screen.getByLabelText(/Question 1/i);
    await user.clear(questionInput);
    await user.type(questionInput, "Auto-saved question");

    // Wait for auto-save
    await waitFor(() => {
      expect(localStorageMock.getItem("applicationQuestions")).toBeTruthy();
    });

    // Parse the saved data
    const savedData = JSON.parse(
      localStorageMock.getItem("applicationQuestions") || ""
    );
    expect(savedData.questions[0].text).toBe("Auto-saved question");
  });

  it("restores questions from localStorage on mount", async () => {
    // Set up localStorage with saved questions
    const savedQuestions = {
      questions: [
        {
          text: "Saved question 1",
          wordLimit: 100,
          charLimit: null,
          category: "Organizational Background",
        },
        {
          text: "Saved question 2",
          wordLimit: null,
          charLimit: 500,
          category: "Project Goals",
        },
      ],
    };
    localStorageMock.setItem(
      "applicationQuestions",
      JSON.stringify(savedQuestions)
    );

    // Render component
    render(
      <ApplicationQuestionsView onSubmit={mockOnSubmit} onBack={mockOnBack} />
    );

    // Should restore two questions with their values
    expect(screen.getByLabelText(/Question 1/i)).toHaveValue(
      "Saved question 1"
    );
    expect(screen.getByLabelText(/Question 2/i)).toHaveValue(
      "Saved question 2"
    );
  });
});
