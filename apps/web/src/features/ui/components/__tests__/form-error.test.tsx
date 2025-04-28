/**
 * Tests for form error components
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormError, FieldError, FormErrorBoundary, useFormErrors } from "../form-error";

describe("Form Error Components", () => {
  describe("FormError", () => {
    it("should render nothing when no message is provided", () => {
      const { container } = render(<FormError message={null} />);
      expect(container.firstChild).toBeNull();
    });
    
    it("should render the error message", () => {
      render(<FormError message="Test error message" />);
      expect(screen.getByText("Test error message")).toBeInTheDocument();
    });
    
    it("should call onDismiss when dismiss button is clicked", () => {
      const onDismiss = vi.fn();
      render(<FormError message="Test error" dismissible onDismiss={onDismiss} />);
      
      const dismissButton = screen.getByLabelText("Dismiss error");
      fireEvent.click(dismissButton);
      
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
    
    it("should not show dismiss button when dismissible is false", () => {
      render(<FormError message="Test error" dismissible={false} />);
      
      expect(screen.queryByLabelText("Dismiss error")).not.toBeInTheDocument();
    });
  });
  
  describe("FieldError", () => {
    it("should render nothing when no error is provided", () => {
      const { container } = render(<FieldError />);
      expect(container.firstChild).toBeNull();
    });
    
    it("should render the field error message", () => {
      render(<FieldError error="Field is required" />);
      expect(screen.getByText("Field is required")).toBeInTheDocument();
    });
  });
  
  describe("FormErrorBoundary", () => {
    const TestComponent = () => {
      const { errors, setErrors } = useFormErrors();
      
      return (
        <div>
          <button
            onClick={() => setErrors({ field1: "Field 1 error", _form: "Form error" })}
            data-testid="set-errors"
          >
            Set Errors
          </button>
          <button
            onClick={() => setErrors({})}
            data-testid="clear-errors"
          >
            Clear Errors
          </button>
          <div data-testid="field1-error">{errors.field1 || "no error"}</div>
          <div data-testid="form-error">{errors._form || "no error"}</div>
        </div>
      );
    };
    
    it("should provide error context", () => {
      render(
        <FormErrorBoundary>
          <TestComponent />
        </FormErrorBoundary>
      );
      
      // Initially no errors
      expect(screen.getByTestId("field1-error")).toHaveTextContent("no error");
      expect(screen.getByTestId("form-error")).toHaveTextContent("no error");
      
      // Set errors
      fireEvent.click(screen.getByTestId("set-errors"));
      
      // Now should have errors
      expect(screen.getByTestId("field1-error")).toHaveTextContent("Field 1 error");
      expect(screen.getByTestId("form-error")).toHaveTextContent("Form error");
      
      // Form error should be displayed in FormError component
      expect(screen.getByText("Form error")).toBeInTheDocument();
      
      // Clear errors
      fireEvent.click(screen.getByTestId("clear-errors"));
      
      // Now should have no errors again
      expect(screen.getByTestId("field1-error")).toHaveTextContent("no error");
      expect(screen.getByTestId("form-error")).toHaveTextContent("no error");
    });
    
    it("should dismiss form error when dismiss button is clicked", () => {
      render(
        <FormErrorBoundary initialErrors={{ _form: "Initial form error" }}>
          <TestComponent />
        </FormErrorBoundary>
      );
      
      // Should show initial form error
      expect(screen.getByText("Initial form error")).toBeInTheDocument();
      
      // Click dismiss button
      fireEvent.click(screen.getByLabelText("Dismiss error"));
      
      // Form error should be gone
      expect(screen.queryByText("Initial form error")).not.toBeInTheDocument();
    });
  });
});