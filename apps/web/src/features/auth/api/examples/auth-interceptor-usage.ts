/**
 * Examples for using the Auth Interceptor in different scenarios
 *
 * This file provides usage examples and patterns for integrating the
 * auth interceptor with different parts of your application.
 */
import { createAuthInterceptor } from "@/features/auth/api/auth-interceptor";

// Example 1: Basic usage with a simple API client
export function createBasicApiClient() {
  const authInterceptor = createAuthInterceptor();

  return {
    /**
     * Fetches user data from the API
     */
    async getUserData(userId: string) {
      const response = await authInterceptor.fetch(`/api/users/${userId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch user data: ${response.status}`);
      }
      return response.json();
    },

    /**
     * Posts new data to the API
     */
    async postData(endpoint: string, data: any) {
      const response = await authInterceptor.fetch(`/api/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return response.json();
    },
  };
}

// Example 2: Integrating with a custom hook
export function useApiWithAuth() {
  // Create the interceptor once
  const authInterceptor = createAuthInterceptor();

  // Return API methods that use the interceptor
  return {
    async fetchProtectedResource(url: string) {
      try {
        const response = await authInterceptor.fetch(url);
        return await response.json();
      } catch (error) {
        console.error("Error fetching protected resource:", error);
        // Handle authentication errors, possibly redirecting to login
        return null;
      }
    },
  };
}

// Example 3: Creating a service with the interceptor
export class AuthenticatedApiService {
  private interceptor = createAuthInterceptor();

  /**
   * Fetch data with authentication handling
   */
  async fetch<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await this.interceptor.fetch(url, options);

    if (!response.ok) {
      // Custom error handling
      if (response.status === 403) {
        throw new Error("You do not have permission to access this resource");
      }

      throw new Error(`API request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Upload a file with authentication
   */
  async uploadFile(url: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await this.interceptor.fetch(url, {
      method: "POST",
      body: formData,
      // Don't set Content-Type header - it will be set automatically with boundary
    });

    if (!response.ok) {
      throw new Error(`File upload failed: ${response.status}`);
    }

    return response.json();
  }
}

// Example 4: Global API configuration
export function setupGlobalApi() {
  const interceptor = createAuthInterceptor();

  // Replace global fetch to automatically handle auth for all requests
  // Note: This approach should be used carefully as it affects all fetch calls
  const originalFetch = window.fetch;
  window.fetch = async (input, init) => {
    // Only intercept calls to your API, not all fetch requests
    const url = typeof input === "string" ? input : input.url;
    if (
      url.startsWith("/api/") ||
      url.startsWith("https://api.yourdomain.com")
    ) {
      return interceptor.fetch(input, init);
    }

    // Use original fetch for other requests
    return originalFetch(input, init);
  };
}

// Example 5: Error handling patterns
export async function demonstrateErrorHandling() {
  const interceptor = createAuthInterceptor();

  try {
    const response = await interceptor.fetch("/api/protected-resource");

    if (response.ok) {
      return await response.json();
    }

    // Handle different error status codes
    switch (response.status) {
      case 400:
        throw new Error("Bad request: The request was malformed");
      case 403:
        throw new Error("Forbidden: You do not have access to this resource");
      case 404:
        throw new Error("Not found: The requested resource does not exist");
      case 500:
        throw new Error("Server error: Please try again later");
      default:
        throw new Error(`Request failed with status: ${response.status}`);
    }
  } catch (error) {
    // Check for specific auth-related errors
    if (error instanceof Error) {
      if (error.message.includes("Session refresh failed")) {
        // Handle authentication failure
        console.error("Authentication expired, redirecting to login...");
        // Redirect to login or show auth modal
        window.location.href = "/login";
        return null;
      }
    }

    // Re-throw other errors
    throw error;
  }
}
