/**
 * Standard error handling utilities for API responses
 */

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * Standard API success response structure
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Creates a standardized error response for API routes
 */
export function createErrorResponse(
  message: string, 
  status: number = 400, 
  code?: string, 
  details?: unknown
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        message,
        ...(code && { code }),
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
export function createSuccessResponse<T>(data: T, status: number = 200): Response {
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
export async function handleFetchResponse<T>(response: Response): Promise<ApiResponse<T>> {
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
        message: errorData.message || errorData.error || `HTTP error ${response.status}`,
        ...(errorData.code && { code: errorData.code }),
        ...(errorData.details && { details: errorData.details }),
      },
    };
  }
  
  const data = await response.json();
  return { success: true, data };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  AUTHENTICATION: 'AUTH_ERROR',
  VALIDATION: 'VALIDATION_ERROR',
  DATABASE: 'DATABASE_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SERVER_ERROR: 'SERVER_ERROR',
};