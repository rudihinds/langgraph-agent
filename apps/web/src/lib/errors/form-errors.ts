/**
 * Form error handling utilities for standardized form error handling
 */
import { ZodError } from "zod";
import {
  ApiErrorResponse,
  FormError,
  ValidationError,
  ErrorCodes,
} from "./types";
import { logger } from "@/lib/logger";

/**
 * Formats a ZodError into a standardized validation error object
 *
 * @param error The ZodError to format
 * @returns A formatted error object with field-specific errors
 */
export function formatZodError(error: ZodError): FormError {
  const fieldErrors = error.flatten().fieldErrors;
  const formattedError: FormError = {
    message: "Validation failed",
    code: ErrorCodes.FORM_ERROR as "FORM_ERROR",
    details: {
      fields: {},
    },
  };

  // Convert the Zod error format to our standardized format
  Object.entries(fieldErrors).forEach(([field, errors]) => {
    if (errors && errors.length > 0) {
      formattedError.details.fields[field] = errors[0];
    }
  });

  return formattedError;
}

/**
 * Creates a standardized form error response from any error type
 *
 * @param error The error that occurred
 * @param formContext Additional context about the form
 * @returns A standardized error response
 */
export function createFormErrorResponse(
  error: unknown,
  formContext: string = "form submission"
): ApiErrorResponse {
  logger.error(`Form error in ${formContext}`, {}, error);

  // Handle ZodError specially
  if (error instanceof ZodError) {
    return {
      success: false,
      error: formatZodError(error),
    };
  }

  // Handle server-returned ApiErrorResponse
  if (
    typeof error === "object" &&
    error !== null &&
    "success" in error &&
    error.success === false &&
    "error" in error
  ) {
    return error as ApiErrorResponse;
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        message: error.message || "Form submission failed",
        code: ErrorCodes.FORM_ERROR as "FORM_ERROR",
        details: {
          fields: {
            _form: error.message,
          },
        },
      },
    };
  }

  // Handle unknown error types
  return {
    success: false,
    error: {
      message: error ? String(error) : "An unknown error occurred",
      code: ErrorCodes.FORM_ERROR as "FORM_ERROR",
      details: {
        fields: {
          _form: error ? String(error) : "An unknown error occurred",
        },
      },
    },
  };
}

/**
 * Extracts field errors from an error response
 *
 * @param errorResponse The error response object
 * @returns A record of field names to error messages
 */
export function extractFieldErrors(
  errorResponse?: ApiErrorResponse
): Record<string, string> {
  if (!errorResponse || !errorResponse.error) {
    return {};
  }

  // Handle form errors with field details
  if (
    errorResponse.error.code === ErrorCodes.FORM_ERROR &&
    errorResponse.error.details &&
    typeof errorResponse.error.details === "object" &&
    "fields" in errorResponse.error.details &&
    errorResponse.error.details.fields
  ) {
    return errorResponse.error.details.fields as Record<string, string>;
  }

  // Handle validation errors
  if (errorResponse.error.code === ErrorCodes.VALIDATION) {
    if (
      errorResponse.error.details &&
      typeof errorResponse.error.details === "object"
    ) {
      return errorResponse.error.details as Record<string, string>;
    }

    // Default validation error with no field details
    return { _form: errorResponse.error.message };
  }

  // Handle general errors
  return { _form: errorResponse.error.message };
}

/**
 * Determines if a specific field has an error
 *
 * @param fieldName The name of the field to check
 * @param errors The errors object from extractFieldErrors
 * @returns True if the field has an error, false otherwise
 */
export function hasFieldError(
  fieldName: string,
  errors: Record<string, string>
): boolean {
  return !!errors[fieldName];
}

/**
 * Gets the error message for a specific field
 *
 * @param fieldName The name of the field
 * @param errors The errors object from extractFieldErrors
 * @returns The error message or undefined if no error
 */
export function getFieldError(
  fieldName: string,
  errors: Record<string, string>
): string | undefined {
  return errors[fieldName];
}
