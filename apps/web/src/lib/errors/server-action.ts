"use server";

/**
 * Error handling utilities for server actions
 */
import { ZodSchema } from "zod";
import { formatZodError, createFormErrorResponse } from "./form-errors";
import { ApiResponse, ApiErrorResponse, ErrorCodes } from "./types";
import { logger } from "@/lib/logger";

/**
 * Type for server action handler function
 */
type ServerActionHandler<TInput, TOutput> = (
  input: TInput,
  ...args: any[]
) => Promise<TOutput>;

/**
 * Options for the withErrorHandling wrapper
 */
interface ErrorHandlingOptions<TInput> {
  /**
   * Optional validation schema for the input
   */
  schema?: ZodSchema<TInput>;

  /**
   * Name of the action for logging
   */
  actionName: string;

  /**
   * Optional transform function to prepare the input
   */
  transformInput?: (formData: FormData) => TInput;
}

/**
 * Wraps a server action with standardized error handling
 * 
 * @param handler The server action handler function
 * @param options Configuration options
 * @returns A wrapped server action with error handling
 */
export function withErrorHandling<TInput, TOutput>(
  handler: ServerActionHandler<TInput, TOutput>,
  options: ErrorHandlingOptions<TInput>
): (...args: any[]) => Promise<ApiResponse<TOutput>> {
  return async (...args: any[]): Promise<ApiResponse<TOutput>> => {
    try {
      logger.info(`Starting server action: ${options.actionName}`);
      
      // Get the input from args
      let input: TInput;
      
      // Handle FormData transformation
      if (args[0] instanceof FormData && options.transformInput) {
        input = options.transformInput(args[0]);
      } else {
        input = args[0] as TInput;
      }
      
      // Validate input if schema is provided
      if (options.schema) {
        try {
          input = options.schema.parse(input);
        } catch (error) {
          logger.error(`Validation error in ${options.actionName}:`, {}, error);
          return createFormErrorResponse(error, options.actionName);
        }
      }
      
      // Execute the handler
      const result = await handler(input, ...args.slice(1));
      
      // Return successful response
      logger.info(`Server action ${options.actionName} completed successfully`);
      return {
        success: true,
        data: result
      };
    } catch (error) {
      // If the error is already an ApiErrorResponse, return it directly
      if (
        typeof error === "object" && 
        error !== null && 
        "success" in error && 
        error.success === false && 
        "error" in error
      ) {
        return error as ApiErrorResponse;
      }
      
      // Log and format other errors
      logger.error(`Error in server action ${options.actionName}:`, {}, error);
      
      return {
        success: false,
        error: {
          message: error instanceof Error 
            ? error.message 
            : "An unexpected error occurred",
          code: ErrorCodes.SERVER_ERROR,
          details: {
            action: options.actionName,
            ...(error instanceof Error && {
              name: error.name,
              stack: process.env.NODE_ENV === "development" ? error.stack : undefined
            })
          }
        }
      };
    }
  };
}

/**
 * Helper function to create a typed server action with error handling
 * 
 * @param handler The server action handler function
 * @param options Configuration options
 * @returns A type-safe server action with error handling
 */
export function createServerAction<TInput, TOutput>(
  handler: ServerActionHandler<TInput, TOutput>,
  options: ErrorHandlingOptions<TInput>
): (...args: any[]) => Promise<ApiResponse<TOutput>> {
  return withErrorHandling(handler, options);
}