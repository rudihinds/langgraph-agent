import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureUserExists } from '../user-management';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
} as unknown as SupabaseClient;

describe('User Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  describe('ensureUserExists', () => {
    it('should return success and user data when the user exists in the database', async () => {
      // Mock an existing user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });
      
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: { id: 'user123', email: 'test@example.com' },
        error: null,
      });
      
      const result = await ensureUserExists(mockSupabaseClient);
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual({ id: 'user123', email: 'test@example.com' });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.from().select).toHaveBeenCalled();
    });
    
    it('should create a new user record when the user does not exist in the database', async () => {
      // Mock authenticated user but not in database yet
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });
      
      // Mock user not found in database
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' }, // Typical Postgres error for no results
      });
      
      // Mock successful user creation
      mockSupabaseClient.from().insert().mockResolvedValueOnce({
        data: { id: 'user123', email: 'test@example.com' },
        error: null,
      });
      
      const result = await ensureUserExists(mockSupabaseClient);
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual({ id: 'user123', email: 'test@example.com' });
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
      expect(mockSupabaseClient.from().insert).toHaveBeenCalled();
    });
    
    it('should return error when the user is not authenticated', async () => {
      // Mock no authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      
      const result = await ensureUserExists(mockSupabaseClient);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('User not authenticated');
    });
    
    it('should return error when authentication fails', async () => {
      // Mock authentication error
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid session' },
      });
      
      const result = await ensureUserExists(mockSupabaseClient);
      
      expect(result.success).toBe(false);
      expect(result.error).toEqual({ message: 'Invalid session' });
    });
    
    it('should handle database insert errors', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });
      
      // Mock user not found
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      });
      
      // Mock insert error (e.g., RLS violation)
      mockSupabaseClient.from().insert.mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'permission denied for table users' },
      });
      
      const result = await ensureUserExists(mockSupabaseClient);
      
      expect(result.success).toBe(false);
      expect(result.error).toEqual({ code: '42501', message: 'permission denied for table users' });
    });
    
    it('should handle update errors for existing users', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user123', email: 'test@example.com' } },
        error: null,
      });
      
      // Mock user found
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: { id: 'user123', email: 'test@example.com' },
        error: null,
      });
      
      // Mock update error
      mockSupabaseClient.from().update().eq().mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed' },
      });
      
      const result = await ensureUserExists(mockSupabaseClient);
      
      expect(result.success).toBe(false);
      expect(result.error).toEqual({ message: 'Update failed' });
    });
    
    it('should handle unexpected errors', async () => {
      // Mock unexpected error
      mockSupabaseClient.auth.getUser.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });
      
      const result = await ensureUserExists(mockSupabaseClient);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toBe('Unexpected error');
    });
  });
});