/**
 * Tests for useApi hook
 */
import { renderHook, act } from "@testing-library/react";
import { useApi } from "../use-api";

// Mock global fetch
global.fetch = vi.fn();

describe("useApi", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should start with initial state", () => {
    const { result } = renderHook(() => useApi("/api/test"));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("should handle successful API call", async () => {
    const mockData = { id: 1, name: "Test" };
    const apiResponse = { success: true, data: mockData };
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(apiResponse),
    };

    (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

    const onSuccess = vi.fn();

    const { result } = renderHook(() => useApi("/api/test", { onSuccess }));

    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });

    // Check the fetch was called correctly
    expect(global.fetch).toHaveBeenCalledWith("/api/test", expect.any(Object));

    // Check the state was updated correctly
    expect(result.current.data).toEqual(apiResponse);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);

    // Check the success callback was called
    expect(onSuccess).toHaveBeenCalledWith(apiResponse);
  });

  it("should handle API error", async () => {
    const errorMessage = {
      message: "Something went wrong",
      details: { field: "test" },
      code: "TEST_ERROR",
    };

    const errorResponse = {
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        success: false,
        error: errorMessage,
      }),
    };

    (global.fetch as unknown as vi.Mock).mockResolvedValue(errorResponse);

    const onError = vi.fn();
    const { result } = renderHook(() => useApi("/api/test", { onError }));

    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });

    // Check the state was updated correctly
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({
      message: errorMessage,
    });
    expect(result.current.isLoading).toBe(false);

    // Check the error callback was called
    expect(onError).toHaveBeenCalledWith(result.current.error);
  });

  it("should handle network errors", async () => {
    const networkError = new Error("Network error");
    (global.fetch as unknown as vi.Mock).mockRejectedValue(networkError);

    const onError = vi.fn();

    const { result } = renderHook(() => useApi("/api/test", { onError }));

    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });

    // Check the state was updated correctly
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({
      message: "Network error",
      details: undefined,
    });
    expect(result.current.isLoading).toBe(false);

    // Check the error callback was called
    expect(onError).toHaveBeenCalledWith({
      message: "Network error",
      details: undefined,
    });
  });

  it("should handle non-JSON error responses", async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error("Invalid JSON")),
      statusText: "Internal Server Error",
    };

    (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useApi("/api/test"));

    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });

    // Check the state was updated correctly
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({
      message: "HTTP error 500",
      details: undefined,
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("should set loading state during API call", async () => {
    // Create a promise we can resolve manually
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    (global.fetch as unknown as vi.Mock).mockReturnValue(promise);

    const { result } = renderHook(() => useApi("/api/test"));

    // Start the API call
    let executePromise: Promise<any>;
    act(() => {
      executePromise = result.current.execute();
    });

    // Check loading state
    expect(result.current.isLoading).toBe(true);

    // Resolve the fetch promise
    act(() => {
      resolvePromise!(mockResponse);
    });

    // Wait for the execute promise to resolve
    await act(async () => {
      await executePromise;
    });

    // Check loading state is reset
    expect(result.current.isLoading).toBe(false);
  });

  it("should send request with provided body and headers", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };

    (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useApi("/api/test"));

    const requestBody = { name: "Test" };
    const requestHeaders = { "X-Custom-Header": "value" };

    // Execute the API call
    await act(async () => {
      await result.current.execute(requestBody, {
        method: "POST",
        headers: requestHeaders,
      });
    });

    // Check the fetch was called with the right parameters
    const fetchCall = (global.fetch as unknown as vi.Mock).mock.calls[0];
    expect(fetchCall[0]).toBe("/api/test");
    expect(fetchCall[1].method).toBe("POST");
    expect(fetchCall[1].body).toBe(JSON.stringify(requestBody));
    expect(fetchCall[1].headers).toHaveProperty("X-Custom-Header", "value");
  });

  it("should reset state when reset is called", async () => {
    const mockData = { id: 1, name: "Test" };
    const apiResponse = { success: true, data: mockData };
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(apiResponse),
    };

    (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useApi("/api/test"));

    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });

    // Verify data is loaded
    expect(result.current.data).toEqual(apiResponse);

    // Reset the state
    act(() => {
      result.current.reset();
    });

    // Check the state was reset
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("should send authorization header when token is provided", async () => {
    const token = "test-token";
    const mockData = { id: 1, name: "Test" };
    const apiResponse = { success: true, data: mockData };
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(apiResponse),
    };

    (global.fetch as unknown as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useApi("/api/test", { token }));

    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });

    // Check the fetch was called with the right parameters
    const fetchCall = (global.fetch as unknown as vi.Mock).mock.calls[0];
    expect(fetchCall[0]).toBe("/api/test");
    expect(fetchCall[1].method).toBe("GET");
    expect(fetchCall[1].headers).toHaveProperty(
      "Authorization",
      `Bearer ${token}`
    );
  });
});
