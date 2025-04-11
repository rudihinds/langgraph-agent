/**
 * Standard error type definitions for consistent error handling
 */

/**
 * Base error interface that all error types should extend
 */
export interface BaseError {
  /**
   * Human-readable error message
   */
  message: string;
  
  /**
   * Optional error code for programmatic handling
   */
  code?: string;
  
  /**
   * Optional additional context or information about the error
   */
  details?: unknown;
}

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  /**
   * Always false for error responses
   */
  success: false;
  
  /**
   * Error details
   */
  error: BaseError;
}

/**
 * Standard API success response structure
 */
export interface ApiSuccessResponse<T = any> {
  /**
   * Always true for success responses
   */
  success: true;
  
  /**
   * Response data
   */
  data: T;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Authentication error interface
 */
export interface AuthError extends BaseError {
  /**
   * Always 'AUTH_ERROR' for authentication errors
   */
  code: 'AUTH_ERROR';
}

/**
 * Validation error interface
 */
export interface ValidationError extends BaseError {
  /**
   * Always 'VALIDATION_ERROR' for validation errors
   */
  code: 'VALIDATION_ERROR';
  
  /**
   * Optional validation errors by field
   */
  details?: Record<string, string>;
}

/**
 * Database error interface
 */
export interface DatabaseError extends BaseError {
  /**
   * Always 'DATABASE_ERROR' for database errors
   */
  code: 'DATABASE_ERROR';
}

/**
 * Not found error interface
 */
export interface NotFoundError extends BaseError {
  /**
   * Always 'NOT_FOUND' for not found errors
   */
  code: 'NOT_FOUND';
  
  /**
   * Optional resource type that wasn't found
   */
  details?: {
    resourceType?: string;
    resourceId?: string | number;
  };
}

/**
 * Forbidden error interface
 */
export interface ForbiddenError extends BaseError {
  /**
   * Always 'FORBIDDEN' for forbidden errors
   */
  code: 'FORBIDDEN';
}

/**
 * Server error interface
 */
export interface ServerError extends BaseError {
  /**
   * Always 'SERVER_ERROR' for server errors
   */
  code: 'SERVER_ERROR';
}

/**
 * Form submission error interface
 */
export interface FormError extends BaseError {
  /**
   * Always 'FORM_ERROR' for form errors
   */
  code: 'FORM_ERROR';
  
  /**
   * Form field errors
   */
  details: {
    fields: Record<string, string>;
  };
}

/**
 * Common error codes used throughout the application
 */
export const ErrorCodes = {
  AUTHENTICATION: 'AUTH_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  DATABASE: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SERVER_ERROR: 'SERVER_ERROR',
  FORM_ERROR: 'FORM_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  SUPABASE_ERROR: 'SUPABASE_ERROR',
};

/**
 * Map of HTTP status codes to error types
 */
export const HttpStatusToErrorCode: Record<number, string> = {
  400: ErrorCodes.VALIDATION,
  401: ErrorCodes.AUTHENTICATION,
  403: ErrorCodes.FORBIDDEN,
  404: ErrorCodes.NOT_FOUND,
  500: ErrorCodes.SERVER_ERROR,
  503: ErrorCodes.SERVER_ERROR,
};