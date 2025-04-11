/**
 * Tests for useApi hook
 */
import { renderHook, act } from '@testing-library/react';
import { useApi } from '../use-api';

// Mock global fetch
global.fetch = jest.fn();

describe('useApi', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should start with initial state', () => {
    const { result } = renderHook(() => useApi('/api/test'));
    
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should handle successful API call', async () => {
    const mockData = { id: 1, name: 'Test' };
    const mockResponse = {
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ success: true, data: mockData }),
    };
    
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
    
    const onSuccess = jest.fn();
    
    const { result } = renderHook(() => 
      useApi('/api/test', { onSuccess })
    );
    
    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });
    
    // Check the fetch was called correctly
    expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
    
    // Check the state was updated correctly
    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
    
    // Check the success callback was called
    expect(onSuccess).toHaveBeenCalledWith(mockData);
  });

  it('should handle API error with JSON response', async () => {
    const errorResponse = { 
      success: false,
      error: { 
        message: 'Something went wrong',
        code: 'TEST_ERROR',
        details: { field: 'test' }
      }
    };
    
    const mockResponse = {
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue(errorResponse),
    };
    
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
    
    const onError = jest.fn();
    
    const { result } = renderHook(() => 
      useApi('/api/test', { onError })
    );
    
    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });
    
    // Check the fetch was called correctly
    expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.any(Object));
    
    // Check the state was updated correctly
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({
      message: 'Something went wrong',
      details: { field: 'test' },
      code: 'TEST_ERROR'
    });
    expect(result.current.loading).toBe(false);
    
    // Check the error callback was called
    expect(onError).toHaveBeenCalledWith({
      message: 'Something went wrong',
      details: { field: 'test' },
      code: 'TEST_ERROR'
    });
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Network error');
    (global.fetch as jest.Mock).mockRejectedValue(networkError);
    
    const onError = jest.fn();
    
    const { result } = renderHook(() => 
      useApi('/api/test', { onError })
    );
    
    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });
    
    // Check the state was updated correctly
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({
      message: 'Network error',
      details: undefined,
    });
    expect(result.current.loading).toBe(false);
    
    // Check the error callback was called
    expect(onError).toHaveBeenCalledWith({
      message: 'Network error',
      details: undefined,
    });
  });

  it('should handle non-JSON error responses', async () => {
    const mockResponse = {
      ok: false,
      status: 500,
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      statusText: 'Internal Server Error'
    };
    
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
    
    const { result } = renderHook(() => useApi('/api/test'));
    
    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });
    
    // Check the state was updated correctly
    expect(result.current.data).toBeNull();
    expect(result.current.error).toEqual({
      message: 'Internal Server Error (500)',
      details: undefined,
    });
    expect(result.current.loading).toBe(false);
  });

  it('should set loading state during API call', async () => {
    // Create a promise we can resolve manually
    let resolvePromise: (value: any) => void;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: {} }),
    };
    
    (global.fetch as jest.Mock).mockReturnValue(promise);
    
    const { result } = renderHook(() => useApi('/api/test'));
    
    // Start the API call
    let executePromise: Promise<any>;
    act(() => {
      executePromise = result.current.execute();
    });
    
    // Check loading state
    expect(result.current.loading).toBe(true);
    
    // Resolve the fetch promise
    act(() => {
      resolvePromise!(mockResponse);
    });
    
    // Wait for the execute promise to resolve
    await act(async () => {
      await executePromise;
    });
    
    // Check loading state is reset
    expect(result.current.loading).toBe(false);
  });

  it('should send request with provided body and headers', async () => {
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: {} }),
    };
    
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
    
    const { result } = renderHook(() => useApi('/api/test'));
    
    const requestBody = { name: 'Test' };
    const requestHeaders = { 'X-Custom-Header': 'value' };
    
    // Execute the API call
    await act(async () => {
      await result.current.execute({
        method: 'POST',
        body: requestBody,
        headers: requestHeaders,
      });
    });
    
    // Check the fetch was called with the right parameters
    expect(global.fetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value',
      }),
      body: JSON.stringify(requestBody),
    });
  });

  it('should reset state when reset is called', async () => {
    const mockData = { id: 1, name: 'Test' };
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true, data: mockData }),
    };
    
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
    
    const { result } = renderHook(() => useApi('/api/test'));
    
    // Execute the API call
    await act(async () => {
      await result.current.execute();
    });
    
    // Verify data is loaded
    expect(result.current.data).toEqual(mockData);
    
    // Reset the state
    act(() => {
      result.current.reset();
    });
    
    // Check the state was reset
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});