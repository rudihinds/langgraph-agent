/**
 * Tests for Supabase error handling utilities
 */
import { PostgrestError } from "@supabase/supabase-js";
import { 
  handleSupabaseError,
  handleDatabaseError,
  handleAuthError 
} from '../errors';
import { 
  DatabaseError, 
  AuthenticationError,
  ForbiddenError,
  ValidationError
} from "@/features/shared/errors/custom-errors";

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Supabase Error Handling', () => {
  describe('handleSupabaseError', () => {
    it('should convert duplicate entry error to ValidationError', () => {
      const postgrestError: PostgrestError = {
        code: '23505',
        details: 'Key (email)=(test@example.com) already exists',
        hint: '',
        message: 'duplicate key value violates unique constraint'
      };
      
      expect(() => handleDatabaseError(postgrestError, 'create user')).toThrow(ValidationError);
      
      try {
        handleDatabaseError(postgrestError, 'create user');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.message).toBe('Duplicate record already exists');
        expect(error.status).toBe(400);
        expect(error.details).toEqual(postgrestError);
      }
    });

    it('should convert permission denied error to ForbiddenError', () => {
      const postgrestError: PostgrestError = {
        code: '42501',
        details: 'permission denied for table users',
        hint: '',
        message: 'permission denied for table users'
      };
      
      expect(() => handleDatabaseError(postgrestError, 'read user')).toThrow(ForbiddenError);
    });

    it('should convert foreign key error to DatabaseError', () => {
      const postgrestError: PostgrestError = {
        code: '23503',
        details: 'Key (user_id)=(123) is not present in table "users"',
        hint: '',
        message: 'foreign key constraint violation'
      };
      
      expect(() => handleDatabaseError(postgrestError, 'create post')).toThrow(DatabaseError);
    });

    it('should convert not null constraint error to DatabaseError', () => {
      const postgrestError: PostgrestError = {
        code: '23502',
        details: 'Failing row contains (null, null, 2021-01-01)',
        hint: '',
        message: 'null value in column "name" violates not-null constraint'
      };
      
      expect(() => handleDatabaseError(postgrestError, 'create profile')).toThrow(DatabaseError);
    });

    it('should use a generic error for unrecognized error codes', () => {
      const postgrestError: PostgrestError = {
        code: 'unknown',
        details: '',
        hint: '',
        message: 'some database error'
      };
      
      expect(() => handleDatabaseError(postgrestError, 'query data')).toThrow(DatabaseError);
      
      try {
        handleDatabaseError(postgrestError, 'query data');
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect(error.status).toBe(500);
      }
    });
  });

  describe('handleAuthError', () => {
    it('should handle invalid credentials as AuthenticationError', () => {
      const authError = {
        name: 'AuthApiError',
        message: 'Invalid login credentials',
        status: 400
      };
      
      expect(() => handleAuthError(authError, 'login')).toThrow(AuthenticationError);
      
      try {
        handleAuthError(authError, 'login');
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
      
      expect(() => handleAuthError(authError, 'verify JWT')).toThrow(AuthenticationError);
    });

    it('should handle missing authorization as AuthenticationError', () => {
      const authError = {
        name: 'AuthApiError',
        message: 'Missing authorization',
        status: 401
      };
      
      expect(() => handleAuthError(authError, 'check authorization')).toThrow(AuthenticationError);
    });

    it('should handle other auth errors as generic AuthenticationError', () => {
      const authError = {
        name: 'AuthApiError',
        message: 'Some other auth error',
        status: 403
      };
      
      expect(() => handleAuthError(authError, 'auth operation')).toThrow(AuthenticationError);
    });
  });
});