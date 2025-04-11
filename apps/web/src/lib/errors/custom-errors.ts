/**
 * Custom error classes for standardized error handling
 */
import { createErrorResponse } from './index';

/**
 * Base class for all application errors
 */
export class AppError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number = 400, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed', details?: unknown) {
    super(message, 'AUTH_ERROR', 401, details);
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * Error thrown when a database operation fails
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database operation failed', details?: unknown) {
    super(message, 'DATABASE_ERROR', 500, details);
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: unknown) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

/**
 * Error thrown when a user doesn't have permission to access a resource
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden', details?: unknown) {
    super(message, 'FORBIDDEN', 403, details);
  }
}

/**
 * Converts an AppError to a standardized API response
 */
export function handleAppError(error: unknown): Response {
  if (error instanceof AppError) {
    return createErrorResponse(
      error.message,
      error.status,
      error.code,
      error.details
    );
  }
  
  // Default server error for unknown errors
  console.error('Unhandled error:', error);
  return createErrorResponse(
    'An unexpected error occurred',
    500,
    'SERVER_ERROR'
  );
}