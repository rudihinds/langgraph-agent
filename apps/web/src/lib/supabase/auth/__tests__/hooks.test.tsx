/**
 * Tests for Supabase auth hooks
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCurrentUser, useRequireAuth } from '../hooks';

// Mock dependencies
vi.mock('../../client', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
  })),
}));

describe('Auth Hooks', () => {
  let mockSupabaseClient: any;
  let mockRouter: any;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock subscription for auth state changes
    const mockSubscription = {
      unsubscribe: vi.fn(),
    };
    
    // Set up mock Supabase client
    mockSupabaseClient = {
      auth: {
        getUser: vi.fn(),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: mockSubscription },
        }),
      },
    };
    require('../../client').createClient.mockReturnValue(mockSupabaseClient);
    
    // Set up mock router
    mockRouter = {
      push: vi.fn(),
      refresh: vi.fn(),
    };
    require('next/navigation').useRouter.mockReturnValue(mockRouter);
  });
  
  describe('useCurrentUser', () => {
    it('should return loading state initially', () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      
      const { result } = renderHook(() => useCurrentUser());
      
      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
    });
    
    it('should return user when authenticated', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      
      const { result } = renderHook(() => useCurrentUser());
      
      // Wait for the async getUser call to complete
      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.error).toBeNull();
    });
    
    it('should set up auth state change listener', () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      
      renderHook(() => useCurrentUser());
      
      expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalled();
    });
    
    it('should refresh router on auth state change', () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      
      renderHook(() => useCurrentUser());
      
      // Get the callback passed to onAuthStateChange
      const authChangeCallback = mockSupabaseClient.auth.onAuthStateChange.mock.calls[0][0];
      
      // Call the auth change callback
      act(() => {
        authChangeCallback('SIGNED_IN', { user: { id: '123' } });
      });
      
      expect(mockRouter.refresh).toHaveBeenCalled();
    });
    
    it('should handle errors during user fetch', async () => {
      const mockError = new Error('Failed to get user');
      mockSupabaseClient.auth.getUser.mockRejectedValue(mockError);
      
      const { result } = renderHook(() => useCurrentUser());
      
      // Wait for the async getUser call to complete
      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
      
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe(mockError);
    });
    
    it('should unsubscribe from auth state changes on unmount', () => {
      const mockSubscription = {
        unsubscribe: vi.fn(),
      };
      mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: mockSubscription },
      });
      
      const { unmount } = renderHook(() => useCurrentUser());
      
      unmount();
      
      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });
  });
  
  describe('useRequireAuth', () => {
    it('should redirect to login if not authenticated', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });
      
      renderHook(() => useRequireAuth());
      
      // Wait for the async getUser call to complete
      await vi.waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login');
      });
    });
    
    it('should not redirect if authenticated', async () => {
      const mockUser = { id: '123', email: 'test@example.com' };
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      
      renderHook(() => useRequireAuth());
      
      // Wait for the async getUser call to complete
      await vi.waitFor(() => {
        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
      });
      
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
    
    it('should not redirect if loading', () => {
      // Don't resolve getUser to keep loading state true
      mockSupabaseClient.auth.getUser.mockImplementation(() => new Promise(() => {}));
      
      renderHook(() => useRequireAuth());
      
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
    
    it('should not redirect if there is an error', async () => {
      const mockError = new Error('Failed to get user');
      mockSupabaseClient.auth.getUser.mockRejectedValue(mockError);
      
      renderHook(() => useRequireAuth());
      
      // Wait for the async getUser call to complete
      await vi.waitFor(() => {
        expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
      });
      
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });
});