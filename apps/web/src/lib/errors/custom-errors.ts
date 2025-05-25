/**
 * Custom error classes for standardized error handling
 */
import { createErrorResponse } from "./index";
import {
  AuthError as IAuthError,
  ValidationError as IValidationError,
  DatabaseError as IDatabaseError,
  NotFoundError as INotFoundError,
  ForbiddenError as IForbiddenError,
  ServerError as IServerError,
  ErrorCodes,
} from "./types";

/**
 * Base class for all application errors
 */
export class AppError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(
    message: string,
    code: string,
    status: number = 400,
    details?: unknown
  ) {
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
export class AuthenticationError extends AppError implements IAuthError {
  declare code: "AUTH_ERROR";

  constructor(message: string = "Authentication failed", details?: unknown) {
    super(message, ErrorCodes.AUTHENTICATION, 401, details);
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends AppError implements IValidationError {
  declare code: "VALIDATION_ERROR";
  declare details?: Record<string, string>;

  constructor(
    message: string = "Validation failed",
    details?: Record<string, string>
  ) {
    super(message, ErrorCodes.VALIDATION, 400, details);
  }
}

/**
 * Error thrown when a database operation fails
 */
export class DatabaseError extends AppError implements IDatabaseError {
  declare code: "DATABASE_ERROR";

  constructor(
    message: string = "Database operation failed",
    details?: unknown
  ) {
    super(message, ErrorCodes.DATABASE, 500, details);
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends AppError implements INotFoundError {
  declare code: "NOT_FOUND";
  declare details?: { resourceType?: string; resourceId?: string | number };

  constructor(
    message: string = "Resource not found",
    resourceType?: string,
    resourceId?: string | number
  ) {
    const details = resourceType ? { resourceType, resourceId } : undefined;
    super(message, ErrorCodes.NOT_FOUND, 404, details);
  }
}

/**
 * Error thrown when a user doesn't have permission to access a resource
 */
export class ForbiddenError extends AppError implements IForbiddenError {
  declare code: "FORBIDDEN";

  constructor(message: string = "Access forbidden", details?: unknown) {
    super(message, ErrorCodes.FORBIDDEN, 403, details);
  }
}

/**
 * Error thrown when a server error occurs
 */
export class ServerError extends AppError implements IServerError {
  declare code: "SERVER_ERROR";

  constructor(message: string = "Server error occurred", details?: unknown) {
    super(message, ErrorCodes.SERVER_ERROR, 500, details);
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
  console.error("Unhandled error:", error);
  return createErrorResponse(
    "An unexpected error occurred",
    500,
    ErrorCodes.SERVER_ERROR
  );
}
