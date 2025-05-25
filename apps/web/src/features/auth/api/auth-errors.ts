/**
 * Authentication error handling for Supabase
 */
import { AuthError as SupabaseAuthError } from "@supabase/supabase-js";
import { ErrorCodes } from "@/lib/errors/types";
import { AuthenticationError, ValidationError, ServerError } from "@/lib/errors/custom-errors";
import { logger } from "@/lib/logger";
import { ApiErrorResponse, ApiResponse } from "@/lib/errors/types";

/**
 * Mapping of Supabase auth error codes to standardized error codes
 */
const AUTH_ERROR_CODE_MAP: Record<string, string> = {
  'invalid_grant': ErrorCodes.AUTHENTICATION,
  'invalid_credentials': ErrorCodes.AUTHENTICATION,
  'user_not_found': ErrorCodes.AUTHENTICATION,
  'expired_token': ErrorCodes.AUTHENTICATION,
  'invalid_token': ErrorCodes.AUTHENTICATION,
  'email_taken': ErrorCodes.VALIDATION,
  'phone_taken': ErrorCodes.VALIDATION,
  'invalid_email': ErrorCodes.VALIDATION,
  'invalid_phone': ErrorCodes.VALIDATION,
  'oauth_error': ErrorCodes.AUTHENTICATION,
  'server_error': ErrorCodes.SERVER_ERROR,
  'rate_limit_error': ErrorCodes.SERVER_ERROR,
  // Add more error codes as they are encountered
};

/**
 * Convert Supabase auth error status code to appropriate HTTP status code
 */
const AUTH_STATUS_CODE_MAP: Record<number, number> = {
  400: 400, // Bad Request
  401: 401, // Unauthorized
  403: 403, // Forbidden
  404: 404, // Not Found
  422: 400, // Unprocessable Entity -> Bad Request
  429: 429, // Too Many Requests
  500: 500, // Internal Server Error
  503: 503, // Service Unavailable
};

/**
 * Standardized handling of Supabase auth errors
 * 
 * @param error The auth error from Supabase
 * @param operation Description of the operation that failed
 * @returns Never returns, always throws an appropriate error
 */
export function handleAuthError(error: SupabaseAuthError, operation: string): never {
  // Extract useful information for logging
  const context = {
    operation,
    status: error.status,
    name: error.name,
    supabaseErrorCode: error?.message?.match(/error_code=([^&\\s]+)/)?.[1],
    message: error.message
  };
  
  logger.error(`Auth error: ${operation}`, context, error);
  
  // Determine error code from message or status
  const errorCodeMatch = error.message?.match(/error_code=([^&\\s]+)/)?.[1];
  const errorCode = errorCodeMatch ? AUTH_ERROR_CODE_MAP[errorCodeMatch] : undefined;
  const statusCode = error.status ? AUTH_STATUS_CODE_MAP[error.status] || 500 : 500;
  
  // Map to appropriate error type
  if (errorCode === ErrorCodes.VALIDATION) {
    throw new ValidationError(error.message, { 
      originalError: error.message,
      supabaseErrorCode: errorCodeMatch || ''
    });
  } else if (errorCode === ErrorCodes.SERVER_ERROR) {
    throw new ServerError(error.message, {
      originalError: error.message,
      supabaseErrorCode: errorCodeMatch
    });
  } else {
    // Default to authentication error
    throw new AuthenticationError(error.message, {
      originalError: error.message,
      supabaseErrorCode: errorCodeMatch
    });
  }
}

/**
 * Creates a standardized error response for auth operations
 * 
 * @param error The error that occurred
 * @param operation Description of the operation
 * @returns A standardized error response object
 */
export function createAuthErrorResponse(error: unknown, operation: string): ApiErrorResponse {
  logger.error(`Auth operation failed: ${operation}`, {}, error);
  
  if (error instanceof SupabaseAuthError) {
    const errorCodeMatch = error.message?.match(/error_code=([^&\\s]+)/)?.[1];
    const errorCode = errorCodeMatch 
      ? AUTH_ERROR_CODE_MAP[errorCodeMatch] || ErrorCodes.AUTHENTICATION 
      : ErrorCodes.AUTHENTICATION;
    
    return {
      success: false,
      error: {
        message: error.message || 'Authentication failed',
        code: errorCode,
        details: {
          status: error.status,
          supabaseErrorCode: errorCodeMatch
        }
      }
    };
  }
  
  if (error instanceof Error) {
    return {
      success: false,
      error: {
        message: error.message || 'Authentication failed',
        code: ErrorCodes.AUTHENTICATION,
        details: { originalError: error.toString() }
      }
    };
  }
  
  return {
    success: false,
    error: {
      message: 'Authentication failed',
      code: ErrorCodes.AUTHENTICATION,
      details: error
    }
  };
}

/**
 * Wraps an auth operation with standardized error handling
 * 
 * @param operation Function that performs the auth operation
 * @param operationName Name of the operation for logging
 * @returns A function with standardized error handling
 */
export function withAuthErrorHandling<T, P extends any[]>(
  operation: (...args: P) => Promise<T>,
  operationName: string
): (...args: P) => Promise<ApiResponse<T>> {
  return async (...args: P): Promise<ApiResponse<T>> => {
    try {
      const result = await operation(...args);
      return { success: true, data: result };
    } catch (error) {
      return createAuthErrorResponse(error, operationName);
    }
  };
}