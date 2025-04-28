/**
 * Tests for useFormSubmit hook
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useFormSubmit } from "../use-form-submit";
import { ErrorCodes } from "@/features/shared/errors/types";

describe("useFormSubmit Hook", () => {
  // Test component using the hook
  function TestComponent({ 
    action, 
    onSuccess = vi.fn(),
    resetOnSuccess = false
  }: { 
    action: any;
    onSuccess?: vi.Mock;
    resetOnSuccess?: boolean;
  }) {
    const {
      isPending,
      formError,
      fieldErrors,
      handleSubmit,
      clearErrors,
      getFieldError,
      hasFieldError,
    } = useFormSubmit(action, { onSuccess, resetOnSuccess });

    return (
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleSubmit(formData);
          }}
          data-testid="test-form"
        >
          <input name="name" defaultValue="Test Name" />
          <input name="email" defaultValue="test@example.com" />
          <button type="submit" disabled={isPending}>
            {isPending ? "Submitting..." : "Submit"}
          </button>
        </form>
        
        {formError && (
          <div data-testid="form-error">{formError}</div>
        )}
        
        {Object.keys(fieldErrors).length > 0 && (
          <ul data-testid="field-errors">
            {Object.entries(fieldErrors).map(([field, error]) => (
              <li key={field} data-testid={`error-${field}`}>{field}: {error}</li>
            ))}
          </ul>
        )}
        
        <div data-testid="has-name-error">
          {hasFieldError("name") ? "Yes" : "No"}
        </div>
        
        <div data-testid="name-error">
          {getFieldError("name") || "No error"}
        </div>
        
        <button onClick={clearErrors} data-testid="clear-errors">
          Clear Errors
        </button>
      </div>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle successful form submission", async () => {
    const mockAction = vi.fn().mockResolvedValue({
      success: true,
      data: { id: 1, name: "Test Name" }
    });
    
    const onSuccess = vi.fn();
    
    render(<TestComponent action={mockAction} onSuccess={onSuccess} />);
    
    // Submit the form
    fireEvent.submit(screen.getByTestId("test-form"));
    
    // Check if the submit button is disabled during submission
    expect(screen.getByRole("button", { name: "Submitting..." })).toBeDisabled();
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    });
    
    // Check if action and onSuccess were called
    expect(mockAction).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledWith({ id: 1, name: "Test Name" });
    
    // No errors should be displayed
    expect(screen.queryByTestId("form-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("field-errors")).not.toBeInTheDocument();
  });
  
  it("should handle form validation errors", async () => {
    const mockAction = vi.fn().mockResolvedValue({
      success: false,
      error: {
        message: "Validation failed",
        code: ErrorCodes.FORM_ERROR,
        details: {
          fields: {
            name: "Name is required",
            email: "Invalid email format"
          }
        }
      }
    });
    
    render(<TestComponent action={mockAction} />);
    
    // Submit the form
    fireEvent.submit(screen.getByTestId("test-form"));
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    });
    
    // Field errors should be displayed
    expect(screen.getByTestId("field-errors")).toBeInTheDocument();
    expect(screen.getByTestId("error-name")).toHaveTextContent("name: Name is required");
    expect(screen.getByTestId("error-email")).toHaveTextContent("email: Invalid email format");
    
    // Form error should be displayed
    expect(screen.getByTestId("form-error")).toHaveTextContent("Validation failed");
    
    // hasFieldError and getFieldError should work
    expect(screen.getByTestId("has-name-error")).toHaveTextContent("Yes");
    expect(screen.getByTestId("name-error")).toHaveTextContent("Name is required");
    
    // Clear errors
    fireEvent.click(screen.getByTestId("clear-errors"));
    
    // Errors should be cleared
    expect(screen.queryByTestId("form-error")).not.toBeInTheDocument();
    expect(screen.queryByTestId("field-errors")).not.toBeInTheDocument();
    expect(screen.getByTestId("has-name-error")).toHaveTextContent("No");
    expect(screen.getByTestId("name-error")).toHaveTextContent("No error");
  });
  
  it("should handle general form errors", async () => {
    const mockAction = vi.fn().mockResolvedValue({
      success: false,
      error: {
        message: "Server error occurred",
        code: ErrorCodes.SERVER_ERROR
      }
    });
    
    render(<TestComponent action={mockAction} />);
    
    // Submit the form
    fireEvent.submit(screen.getByTestId("test-form"));
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    });
    
    // Form error should be displayed
    expect(screen.getByTestId("form-error")).toHaveTextContent("Server error occurred");
  });
  
  it("should handle unexpected errors", async () => {
    const mockAction = vi.fn().mockImplementation(() => {
      throw new Error("Unexpected error");
    });
    
    render(<TestComponent action={mockAction} />);
    
    // Submit the form
    fireEvent.submit(screen.getByTestId("test-form"));
    
    // Wait for completion
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
    });
    
    // Form error should be displayed
    expect(screen.getByTestId("form-error")).toHaveTextContent("Unexpected error");
  });
});