"use client";

import { useState, useCallback } from "react";
import { ApiResponse, handleFetchResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Options for the useApi hook
 */
interface UseApiOptions {
  /**
   * Called when the API call succeeds
   */
  onSuccess?: (data: any) => void;

  /**
   * Called when the API call fails
   */
  onError?: (error: { message: string; details?: unknown }) => void;

  /**
   * Auth token to be sent in the Authorization header
   */
  token?: string;
}

/**
 * Hook for making API calls with consistent error handling
 *
 * @param url The URL to call
 * @param options Options for success/error handling
 * @returns Object with data, error, loading state, and execute function
 */
export function useApi<T = any, P = any>(url: string, options?: UseApiOptions) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{
    message: string;
    details?: unknown;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const execute = useCallback(
    async (
      payload?: P,
      customOptions?: RequestInit
    ): Promise<ApiResponse<T>> => {
      try {
        setIsLoading(true);
        setError(null);

        logger.info(`API call started: ${url}`, {
          method: payload ? "POST" : "GET",
          hasPayload: !!payload,
        });

        const response = await fetch(url, {
          method: payload ? "POST" : "GET",
          headers: {
            "Content-Type": "application/json",
            ...(options?.token && { Authorization: `Bearer ${options.token}` }),
          },
          ...(payload && { body: JSON.stringify(payload) }),
          ...customOptions,
        });

        const result = await handleFetchResponse<T>(response);

        if (result.success) {
          logger.info(`API call succeeded: ${url}`);
          setData(result.data);
          options?.onSuccess?.(result.data);
          return result;
        } else {
          logger.error(`API call failed: ${url}`, {
            statusCode: response.status,
            errorCode: result.error.code,
          });

          setError(result.error);
          options?.onError?.(result.error);
          return result;
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error occurred";

        logger.error(`API call exception: ${url}`, {}, err);

        const errorObj = {
          message: errorMessage,
        };

        setError(errorObj);
        options?.onError?.(errorObj);

        return {
          success: false,
          error: errorObj,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [url, options]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    data,
    error,
    isLoading,
    execute,
    reset,
  };
}
