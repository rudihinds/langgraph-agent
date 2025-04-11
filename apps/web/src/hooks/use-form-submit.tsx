"use client";

/**
 * Hook for form submission with standardized error handling
 */
import { useState, useTransition } from "react";
import { ApiResponse } from "@/lib/errors/types";
import { extractFieldErrors } from "@/lib/errors/form-errors";

interface UseFormSubmitOptions<TData> {
  /**
   * Callback when the form is submitted successfully
   */
  onSuccess?: (data: TData) => void;

  /**
   * Initial form state
   */
  initialState?: Record<string, any>;

  /**
   * Whether to reset the form after a successful submission
   */
  resetOnSuccess?: boolean;
}

/**
 * Hook for form submission with standardized error handling
 * 
 * @param action The server action to call for form submission
 * @param options Configuration options
 * @returns Form submission utilities with error handling
 */
export function useFormSubmit<TData>(
  action: (...args: any[]) => Promise<ApiResponse<TData>>,
  options: UseFormSubmitOptions<TData> = {}
) {
  const [isPending, startTransition] = useTransition();
  const [formState, setFormState] = useState<{
    data: TData | null;
    fieldErrors: Record<string, string>;
    formError: string | null;
  }>({
    data: null,
    fieldErrors: {},
    formError: null,
  });

  /**
   * Submit handler for the form
   */
  const handleSubmit = async (formData: FormData | Record<string, any>, ...args: any[]) => {
    startTransition(async () => {
      try {
        // Clear previous errors
        setFormState((prev) => ({
          ...prev,
          fieldErrors: {},
          formError: null,
        }));

        // Call the server action
        const result = await action(formData, ...args);

        if (result.success) {
          // Handle success
          setFormState((prev) => ({
            ...prev,
            data: result.data,
          }));

          // Reset the form if configured to do so
          if (options.resetOnSuccess) {
            if (formData instanceof FormData) {
              const form = formData.get("form") as HTMLFormElement;
              if (form) form.reset();
            }
          }

          // Call success callback if provided
          if (options.onSuccess) {
            options.onSuccess(result.data);
          }
        } else {
          // Handle error
          const fieldErrors = extractFieldErrors(result as any);
          const formError = fieldErrors._form || result.error?.message || "Form submission failed";

          setFormState((prev) => ({
            ...prev,
            fieldErrors,
            formError,
          }));
        }
      } catch (error) {
        // Handle unexpected errors
        setFormState((prev) => ({
          ...prev,
          formError: error instanceof Error ? error.message : "An unexpected error occurred",
        }));
      }
    });
  };

  /**
   * Clear all form errors
   */
  const clearErrors = () => {
    setFormState((prev) => ({
      ...prev,
      fieldErrors: {},
      formError: null,
    }));
  };

  /**
   * Get the error message for a specific field
   */
  const getFieldError = (fieldName: string): string | undefined => {
    return formState.fieldErrors[fieldName];
  };

  /**
   * Check if a field has an error
   */
  const hasFieldError = (fieldName: string): boolean => {
    return !!formState.fieldErrors[fieldName];
  };

  return {
    isPending,
    data: formState.data,
    fieldErrors: formState.fieldErrors,
    formError: formState.formError,
    handleSubmit,
    clearErrors,
    getFieldError,
    hasFieldError,
  };
}