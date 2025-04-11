/**
 * Tests for auth error handling
 */
import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import { AuthError } from '@supabase/supabase-js';
import { 
  handleAuthError, 
  createAuthErrorResponse, 
  withAuthErrorHandling 
} from '../auth-errors';
import { ErrorCodes } from '@/lib/errors/types';
import { logger } from '@/lib/logger';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}));

describe('Auth Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('createAuthErrorResponse', () => {
    it('should format Supabase auth errors correctly', () => {
      // Create a Supabase auth error
      const authError = new AuthError('Failed to authenticate', {
        status: 401,
        message: 'Invalid login credentials error_code=invalid_credentials'
      });

      // Test the error response
      const response = createAuthErrorResponse(authError, 'test-operation');

      // Check that the response is correctly formatted
      expect(response.success).toBe(false);
      expect(response.error.message).toContain('Invalid login credentials');
      expect(response.error.code).toBe(ErrorCodes.AUTHENTICATION);
      expect(response.error.details).toBeDefined();
      expect((response.error.details as any).supabaseErrorCode).toBe('invalid_credentials');
      
      // Check that the error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Auth operation failed: test-operation',
        expect.any(Object),
        authError
      );
    });

    it('should handle standard Error objects', () => {
      const error = new Error('Generic error');
      const response = createAuthErrorResponse(error, 'test-operation');

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Generic error');
      expect(response.error.code).toBe(ErrorCodes.AUTHENTICATION);
      expect(response.error.details).toBeDefined();
      expect((response.error.details as any).originalError).toContain('Generic error');
    });

    it('should handle unknown error types', () => {
      const error = 'String error message';
      const response = createAuthErrorResponse(error, 'test-operation');

      expect(response.success).toBe(false);
      expect(response.error.message).toBe('Authentication failed');
      expect(response.error.code).toBe(ErrorCodes.AUTHENTICATION);
      expect(response.error.details).toBe('String error message');
    });
  });

  describe('withAuthErrorHandling', () => {
    it('should wrap successful operations correctly', async () => {
      // Create a mock function that returns a successful result
      const successOperation = vi.fn().mockResolvedValue({ id: 1, name: 'Test User' });
      
      // Wrap it with error handling
      const wrappedOperation = withAuthErrorHandling(successOperation, 'test-success');
      
      // Call the wrapped function
      const result = await wrappedOperation('arg1', 'arg2');
      
      // Check the results
      expect(successOperation).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 1, name: 'Test User' });
    });

    it('should handle operation errors correctly', async () => {
      // Create a mock function that throws an error
      const errorOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Wrap it with error handling
      const wrappedOperation = withAuthErrorHandling(errorOperation, 'test-error');
      
      // Call the wrapped function
      const result = await wrappedOperation();
      
      // Check the results
      expect(errorOperation).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Operation failed');
      expect(result.error.code).toBe(ErrorCodes.AUTHENTICATION);
    });
  });

  describe('Error Code Mapping', () => {
    it('should map validation errors correctly', () => {
      const validationError = new AuthError('Validation failed', {
        status: 400,
        message: 'Email already registered error_code=email_taken'
      });
      
      const response = createAuthErrorResponse(validationError, 'validation-test');
      
      expect(response.error.code).toBe(ErrorCodes.VALIDATION);
      expect(response.error.message).toContain('Email already registered');
    });

    it('should map server errors correctly', () => {
      const serverError = new AuthError('Server error', {
        status: 500,
        message: 'Internal server error error_code=server_error'
      });
      
      const response = createAuthErrorResponse(serverError, 'server-error-test');
      
      expect(response.error.code).toBe(ErrorCodes.SERVER_ERROR);
      expect(response.error.message).toContain('Internal server error');
    });
  });
});