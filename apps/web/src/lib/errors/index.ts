/**
 * Standard error handling utilities for API responses
 */
import {
  ApiErrorResponse,
  ApiSuccessResponse,
  ApiResponse,
  ErrorCodes,
  HttpStatusToErrorCode,
} from "./types";

/**
 * Creates a standardized error response for API routes
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  code?: string,
  details?: unknown
): Response {
  // If no code was provided, try to determine from status code
  const errorCode =
    code || HttpStatusToErrorCode[status] || ErrorCodes.SERVER_ERROR;

  return new Response(
    JSON.stringify({
      success: false,
      error: {
        message,
        ...(errorCode && { code: errorCode }),
        ...(details && { details }),
      },
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Creates a standardized success response for API routes
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}

/**
 * Error handling for client-side fetch requests
 */
export async function handleFetchResponse<T>(
  response: Response
): Promise<ApiResponse<T>> {
  if (!response.ok) {
    let errorData: any = { message: `HTTP error ${response.status}` };
    try {
      errorData = await response.json();
    } catch (e) {
      // If JSON parsing fails, use default error
    }

    return {
      success: false,
      error: {
        message:
          errorData.message ||
          errorData.error ||
          `HTTP error ${response.status}`,
        ...(errorData.code && { code: errorData.code }),
        ...(errorData.details && { details: errorData.details }),
      },
    };
  }

  const data = await response.json();
  return { success: true, data };
}

// Re-export the types and constants
export {
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ErrorCodes,
  HttpStatusToErrorCode,
} from "./types";
