/**
 * Tests for error handling utilities
 */
import { 
  createErrorResponse, 
  createSuccessResponse,
  handleFetchResponse,
  ErrorCodes
} from '../index';
import { 
  AppError, 
  AuthenticationError, 
  ValidationError, 
  DatabaseError,
  NotFoundError,
  ForbiddenError,
  handleAppError
} from '../custom-errors';
import { expectErrorResponse, expectSuccessResponse } from './test-helpers';

describe('Error Handling', () => {
  describe('createErrorResponse', () => {
    it('creates a properly formatted error response', async () => {
      const response = createErrorResponse('Test error', 400, 'TEST_ERROR');
      await expectErrorResponse(response, 400, 'TEST_ERROR');
    });
    
    it('includes details when provided', async () => {
      const details = { field: 'username', issue: 'too short' };
      const response = createErrorResponse('Validation error', 400, 'VALIDATION_ERROR', details);
      
      const data = await expectErrorResponse(response, 400, 'VALIDATION_ERROR');
      expect(data.error.details).toEqual(details);
    });
  });
  
  describe('createSuccessResponse', () => {
    it('creates a properly formatted success response', async () => {
      const testData = { id: 1, name: 'Test' };
      const response = createSuccessResponse(testData, 201);
      
      const data = await expectSuccessResponse<typeof testData>(response, 201);
      expect(data).toEqual(testData);
    });
  });
  
  describe('Error classes', () => {
    it('AppError preserves all properties', () => {
      const details = { info: 'additional context' };
      const error = new AppError('Test error', 'TEST_CODE', 400, details);
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.status).toBe(400);
      expect(error.details).toEqual(details);
    });
    
    it('AuthenticationError sets correct defaults', () => {
      const error = new AuthenticationError();
      
      expect(error.message).toBe('Authentication failed');
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.status).toBe(401);
    });
    
    it('ValidationError sets correct defaults', () => {
      const error = new ValidationError();
      
      expect(error.message).toBe('Validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.status).toBe(400);
    });
    
    it('DatabaseError sets correct defaults', () => {
      const error = new DatabaseError();
      
      expect(error.message).toBe('Database operation failed');
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.status).toBe(500);
    });
    
    it('NotFoundError sets correct defaults', () => {
      const error = new NotFoundError();
      
      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.status).toBe(404);
    });
    
    it('ForbiddenError sets correct defaults', () => {
      const error = new ForbiddenError();
      
      expect(error.message).toBe('Access forbidden');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.status).toBe(403);
    });
  });
  
  describe('handleAppError', () => {
    it('converts AppError to a proper response', async () => {
      const error = new ValidationError('Invalid input', { field: 'email' });
      const response = handleAppError(error);
      
      const data = await expectErrorResponse(response, 400, 'VALIDATION_ERROR');
      expect(data.error.details).toEqual({ field: 'email' });
    });
    
    it('handles unknown errors as server errors', async () => {
      const error = new Error('Something went wrong');
      const response = handleAppError(error);
      
      await expectErrorResponse(response, 500, 'SERVER_ERROR');
    });
  });
  
  describe('handleFetchResponse', () => {
    it('converts successful fetch to ApiSuccessResponse', async () => {
      const mockResponse = new Response(
        JSON.stringify({ id: 1, name: 'Test' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
      
      const result = await handleFetchResponse(mockResponse);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ id: 1, name: 'Test' });
      }
    });
    
    it('converts error fetch to ApiErrorResponse', async () => {
      const mockResponse = new Response(
        JSON.stringify({ message: 'Not found', code: 'NOT_FOUND' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
      
      const result = await handleFetchResponse(mockResponse);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Not found');
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });
    
    it('handles non-JSON error responses', async () => {
      const mockResponse = new Response(
        'Internal Server Error',
        { status: 500, headers: { 'Content-Type': 'text/plain' } }
      );
      
      const result = await handleFetchResponse(mockResponse);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('HTTP error 500');
      }
    });
  });
  
  describe('ErrorCodes', () => {
    it('contains all expected error codes', () => {
      expect(ErrorCodes.AUTHENTICATION).toBe('AUTH_ERROR');
      expect(ErrorCodes.VALIDATION).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.DATABASE).toBe('DATABASE_ERROR');
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ErrorCodes.FORBIDDEN).toBe('FORBIDDEN');
      expect(ErrorCodes.SERVER_ERROR).toBe('SERVER_ERROR');
    });
  });
});