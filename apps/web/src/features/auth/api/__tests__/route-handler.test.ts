/**
 * Tests for route handler utilities
 */
import { NextRequest } from 'next/server';
import { createRouteHandler } from '../route-handler';
import { AppError, ValidationError, AuthenticationError } from '@/lib/errors/custom-errors';
import { logger } from '@/lib/logger';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Route Handler', () => {
  it('should handle successful requests', async () => {
    // Create a mock handler that returns a successful response
    const mockHandler = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    }));

    // Create a route handler with our mock
    const handler = createRouteHandler(mockHandler);

    // Create a mock request
    const req = new NextRequest(new Request('https://example.com/api/test'));

    // Call the handler
    const response = await handler(req);
    
    // Verify the response
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ success: true });

    // Verify the mock was called
    expect(mockHandler).toHaveBeenCalledWith(req, undefined);
  });

  it('should handle AppError exceptions', async () => {
    // Create a mock handler that throws an AppError
    const mockHandler = vi.fn().mockImplementation(() => {
      throw new ValidationError('Invalid input', { field: 'email' });
    });

    // Create a route handler with our mock
    const handler = createRouteHandler(mockHandler);

    // Create a mock request
    const req = new NextRequest(new Request('https://example.com/api/test'));

    // Call the handler
    const response = await handler(req);
    
    // Verify the response
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toBe('Invalid input');
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(data.error.details).toEqual({ field: 'email' });
  });

  it('should handle unexpected exceptions as server errors', async () => {
    // Create a mock handler that throws a generic error
    const mockHandler = vi.fn().mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    // Create a route handler with our mock
    const handler = createRouteHandler(mockHandler);

    // Create a mock request
    const req = new NextRequest(new Request('https://example.com/api/test'));

    // Call the handler
    const response = await handler(req);
    
    // Verify the response
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.message).toBe('An unexpected error occurred');
    expect(data.error.code).toBe('SERVER_ERROR');
  });

  it('should include request details in error logs', async () => {
    // The logger is already imported and mocked

    // Create a mock handler that throws an error
    const mockHandler = vi.fn().mockImplementation(() => {
      throw new Error('Test error');
    });

    // Create a route handler with our mock
    const handler = createRouteHandler(mockHandler);

    // Create a mock request with query parameters
    const url = new URL('https://example.com/api/test?param=value');
    const req = new NextRequest(new Request(url));
    const params = { id: '123' };

    // Call the handler
    await handler(req, params);
    
    // Verify the logger was called with request details
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('API error: GET https://example.com/api/test?param=value'),
      expect.objectContaining({ params: { id: '123' } }),
      expect.any(Error)
    );
  });
});