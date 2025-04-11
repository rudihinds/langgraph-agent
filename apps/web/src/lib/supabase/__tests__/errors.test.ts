/**
 * Tests for Supabase error handling utilities
 */
import { PostgrestError } from '@supabase/supabase-js';
import { 
  handleSupabaseError,
  handleSupabaseAuthError 
} from '../errors';
import { 
  DatabaseError, 
  AuthenticationError,
  ForbiddenError,
  ValidationError
} from '@/lib/errors/custom-errors';

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Supabase Error Handling', () => {
  describe('handleSupabaseError', () => {
    it('should convert duplicate entry error to DatabaseError', () => {
      const postgrestError: PostgrestError = {
        code: '23505',
        details: 'Key (email)=(test@example.com) already exists',
        hint: '',
        message: 'duplicate key value violates unique constraint'
      };
      
      expect(() => handleSupabaseError(postgrestError, 'create user')).toThrow(DatabaseError);
      
      try {
        handleSupabaseError(postgrestError, 'create user');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.message).toContain('Duplicate entry already exists');
        expect(error.status).toBe(409);
        expect(error.details).toEqual({
          operation: 'create user',
          code: '23505',
          details: postgrestError.details
        });
      }
    });

    it('should convert permission denied error to ForbiddenError', () => {
      const postgrestError: PostgrestError = {
        code: '42501',
        details: 'permission denied for table users',
        hint: '',
        message: 'permission denied for table users'
      };
      
      expect(() => handleSupabaseError(postgrestError, 'read user')).toThrow(ForbiddenError);
    });

    it('should convert foreign key error to ValidationError', () => {
      const postgrestError: PostgrestError = {
        code: '23503',
        details: 'Key (user_id)=(123) is not present in table "users"',
        hint: '',
        message: 'foreign key constraint violation'
      };
      
      expect(() => handleSupabaseError(postgrestError, 'create post')).toThrow(ValidationError);
    });

    it('should convert not null constraint error to ValidationError', () => {
      const postgrestError: PostgrestError = {
        code: '23502',
        details: 'Failing row contains (null, null, 2021-01-01)',
        hint: '',
        message: 'null value in column "name" violates not-null constraint'
      };
      
      expect(() => handleSupabaseError(postgrestError, 'create profile')).toThrow(ValidationError);
    });

    it('should use a generic error for unrecognized error codes', () => {
      const postgrestError: PostgrestError = {
        code: 'unknown',
        details: '',
        hint: '',
        message: 'some database error'
      };
      
      expect(() => handleSupabaseError(postgrestError, 'query data')).toThrow(DatabaseError);
      
      try {
        handleSupabaseError(postgrestError, 'query data');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.status).toBe(500);
      }
    });
  });

  describe('handleSupabaseAuthError', () => {
    it('should handle invalid credentials as AuthenticationError', () => {
      const authError = {
        name: 'AuthApiError',
        message: 'Invalid login credentials',
        status: 400
      };
      
      expect(() => handleSupabaseAuthError(authError)).toThrow(AuthenticationError);
      
      try {
        handleSupabaseAuthError(authError);
      } catch (error) {
        expect(error).toBeInstanceOf(AuthenticationError);
        expect(error.message).toBe('Invalid login credentials');
        expect(error.status).toBe(401);
      }
    });

    it('should handle expired JWT as AuthenticationError', () => {
      const authError = {
        name: 'AuthApiError',
        message: 'JWT expired',
        status: 401
      };
      
      expect(() => handleSupabaseAuthError(authError)).toThrow(AuthenticationError);
    });

    it('should handle missing authorization as AuthenticationError', () => {
      const authError = {
        name: 'AuthApiError',
        message: 'Missing authorization',
        status: 401
      };
      
      expect(() => handleSupabaseAuthError(authError)).toThrow(AuthenticationError);
    });

    it('should handle other auth errors as generic AuthenticationError', () => {
      const authError = {
        name: 'AuthApiError',
        message: 'Some other auth error',
        status: 403
      };
      
      expect(() => handleSupabaseAuthError(authError)).toThrow(AuthenticationError);
    });
  });
});