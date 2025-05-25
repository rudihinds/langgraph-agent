/**
 * Supabase-specific error handling utilities
 */
import { PostgrestError, AuthError } from "@supabase/supabase-js";
import {
  AuthenticationError,
  DatabaseError,
  ValidationError,
  ForbiddenError,
} from "@/lib/errors/custom-errors";
import { logger } from "@/lib/logger";

// Map Postgres error codes to meaningful error messages
const DB_ERROR_CODES: Record<string, string> = {
  "23505": "Duplicate entry already exists",
  "42501": "Permission denied (check Row Level Security)",
  "23503": "Referenced record does not exist",
  "23502": "Required value is missing",
  "22P02": "Invalid data format",
  // Add more specific error codes as needed
};

/**
 * Handles Supabase database errors and converts them to standard AppErrors
 *
 * @param error The PostgrestError from Supabase
 * @param operation Description of the operation that failed
 * @throws An appropriate AppError subclass
 */
export function handleDatabaseError(
  error: PostgrestError,
  operation: string
): never {
  const errorMessage =
    DB_ERROR_CODES[error.code] || error.message || "Database operation failed";
  const logContext = {
    operation,
    code: error.code,
    details: error.details,
    hint: error.hint,
  };

  logger.error(`Database error: ${operation}`, logContext, error);

  // Handle specific error types
  if (error.code === "42501") {
    throw new ForbiddenError(`Permission denied: ${operation}`, error);
  } else if (error.code === "23505") {
    throw new ValidationError("Duplicate record already exists", {
      code: error.code,
      details: error.details || "",
      hint: error.hint || "",
    });
  } else {
    throw new DatabaseError(errorMessage, error);
  }
}

/**
 * Handles Supabase authentication errors
 *
 * @param error The AuthError from Supabase
 * @param operation Description of the operation that failed
 * @throws An AuthenticationError
 */
export function handleAuthError(error: AuthError, operation: string): never {
  logger.error(
    `Auth error: ${operation}`,
    {
      operation,
      code: error.status,
      name: error.name,
    },
    error
  );

  throw new AuthenticationError(error.message, error);
}

/**
 * General Supabase error handler for use with API requests
 *
 * @param result The result from a Supabase operation
 * @param operation Description of the operation
 * @returns The data from the result if successful
 * @throws An appropriate AppError subclass if there was an error
 */
export function handleSupabaseError<T>(
  result: { data: T | null; error: PostgrestError | AuthError | null },
  operation: string
): T {
  if (result.error) {
    if ("code" in result.error && "details" in result.error) {
      handleDatabaseError(result.error as PostgrestError, operation);
    } else {
      handleAuthError(result.error as AuthError, operation);
    }
  }

  if (!result.data) {
    logger.error(`Empty result for operation: ${operation}`);
    throw new DatabaseError("No data returned from database");
  }

  return result.data;
}
