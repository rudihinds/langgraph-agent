import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FunderDetailsView from "@/components/proposals/FunderDetailsView";
import { formatDateForAPI, parseAPIDate } from "@/lib/utils/date-utils";

// Mock the date-related components
vi.mock("@/components/ui/enhanced-appointment-picker", () => ({
  EnhancedAppointmentPicker: ({ date, onDateChange, error }: any) => (
    <div data-testid="enhanced-appointment-picker">
      <input
        type="text"
        data-testid="date-input"
        value={date ? date.toISOString().split("T")[0] : ""}
        onChange={(e) => {
          // Simulate date change on input
          const dateStr = e.target.value;
          if (dateStr) {
            onDateChange(new Date(dateStr));
          } else {
            onDateChange(undefined);
          }
        }}
      />
      {error && <span data-testid="date-error">{error}</span>}
    </div>
  ),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("FunderDetailsView", () => {
  const mockOnSubmit = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it("loads data from localStorage on mount if available", async () => {
    // Setup saved data in localStorage
    const testDate = new Date(2024, 0, 15);
    const savedData = {
      organizationName: "Test Org",
      fundingTitle: "Test Grant",
      deadline: formatDateForAPI(testDate),
      budgetRange: "50000",
      focusArea: "Education",
    };

    localStorageMock.setItem("funderDetailsData", JSON.stringify(savedData));

    // Render the component
    render(<FunderDetailsView onSubmit={mockOnSubmit} onBack={mockOnBack} />);

    // Check if the data was loaded from localStorage
    expect(screen.getByDisplayValue("Test Org")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Test Grant")).toBeInTheDocument();
    expect(screen.getByDisplayValue("50000")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Education")).toBeInTheDocument();
  });

  it("saves data to localStorage when form data changes", async () => {
    // Setup a spy on localStorage.setItem
    const setItemSpy = vi.spyOn(localStorageMock, "setItem");

    // Render the component
    render(<FunderDetailsView onSubmit={mockOnSubmit} onBack={mockOnBack} />);

    // Update a field
    const orgNameInput = screen.getByPlaceholderText(
      /Enter the name of the funding organization/i
    );

    fireEvent.change(orgNameInput, { target: { value: "New Test Org" } });

    // Wait for debounce using vi.advanceTimersByTime
    vi.advanceTimersByTime(1500);

    // Check if localStorage.setItem was called
    expect(setItemSpy).toHaveBeenCalled();

    // Check the saved data format
    const lastCall = setItemSpy.mock.calls[setItemSpy.mock.calls.length - 1];
    const savedData = JSON.parse(lastCall[1]);

    // Verify the organization name was saved
    expect(savedData.organizationName).toBe("New Test Org");

    // Verify the date format is correct for API (if date is set)
    if (savedData.deadline) {
      // Should match YYYY-MM-DD format (API format)
      expect(savedData.deadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("calls onSubmit with correct data format when form is submitted", async () => {
    // Render the component
    render(<FunderDetailsView onSubmit={mockOnSubmit} onBack={mockOnBack} />);

    // Fill out the form
    fireEvent.change(
      screen.getByPlaceholderText(
        /Enter the name of the funding organization/i
      ),
      {
        target: { value: "Test Organization" },
      }
    );

    fireEvent.change(
      screen.getByPlaceholderText(/Enter the title of the grant/i),
      {
        target: { value: "Test Grant Program" },
      }
    );

    // Set date via the mocked date picker
    const dateInput = screen.getByTestId("date-input");
    fireEvent.change(dateInput, { target: { value: "2024-02-15" } });

    fireEvent.change(screen.getByPlaceholderText(/Enter budget amount/i), {
      target: { value: "75000" },
    });

    fireEvent.change(
      screen.getByPlaceholderText(/e.g., Education, Healthcare/i),
      {
        target: { value: "Healthcare" },
      }
    );

    // Submit the form
    fireEvent.click(screen.getByText("Continue"));

    // Check if onSubmit was called with the right data
    expect(mockOnSubmit).toHaveBeenCalled();

    const submittedData = mockOnSubmit.mock.calls[0][0];
    expect(submittedData.organizationName).toBe("Test Organization");
    expect(submittedData.fundingTitle).toBe("Test Grant Program");
    expect(submittedData.deadline instanceof Date).toBe(true);
    expect(submittedData.budgetRange).toBe("75000");
    expect(submittedData.focusArea).toBe("Healthcare");
  });

  it("validates the form and shows error messages when invalid", async () => {
    // Render the component
    render(<FunderDetailsView onSubmit={mockOnSubmit} onBack={mockOnBack} />);

    // Submit the form without filling in required fields
    fireEvent.click(screen.getByText("Continue"));

    // Check if error messages are shown
    expect(
      screen.getByText(/Organization Name is required/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Grant\/Funding Title is required/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Budget Range is required/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus Area is required/i)).toBeInTheDocument();

    // Verify onSubmit was not called
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
