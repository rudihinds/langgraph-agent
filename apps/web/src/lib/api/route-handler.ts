/**
 * Utility for standardized API route handling
 */
import { NextRequest } from 'next/server';
import { AppError, handleAppError } from "@/features/shared/errors/custom-errors";
import { createErrorResponse, createSuccessResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

type RouteHandler = (
  req: NextRequest,
  params?: { [key: string]: string }
) => Promise<Response>;

/**
 * Creates a route handler with standardized error handling
 * 
 * @param handler Function that handles the route logic
 * @returns A wrapped function that handles errors and logs them
 */
export function createRouteHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest, params?: { [key: string]: string }) => {
    try {
      return await handler(req, params);
    } catch (error) {
      logger.error(`API error: ${req.method} ${req.url}`, { params }, error);
      
      return handleAppError(error);
    }
  };
}

/**
 * Validates request data against a schema
 * 
 * @param data Data to validate
 * @param schema Zod schema to validate against
 * @returns Validated data
 * @throws ValidationError if validation fails
 */
function validateRequest<T>(
  data: unknown,
  schema: { safeParse: (data: unknown) => { success: boolean; data: T; error: any } }
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      'Validation failed',
      'VALIDATION_ERROR',
      400,
      result.error.flatten()
    );
  }
  return result.data;
}