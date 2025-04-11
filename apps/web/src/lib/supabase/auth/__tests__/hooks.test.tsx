/**
 * Tests for Auth hooks
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEffect } from 'react';

// Mock modules before importing hooks
const mockRouter = {
  push: vi.fn(),
  refresh: vi.fn(),
};

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

// Mock the Supabase client
const mockAuth = {
  getUser: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
};

const mockSupabaseClient = {
  auth: mockAuth,
};

// Mock the createClient function
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Now we can import the hooks
import { useCurrentUser, useRequireAuth } from '../hooks';

describe('Auth Hooks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Default mock implementation for getUser
    mockAuth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    // Default mock implementation for onAuthStateChange
    mockAuth.onAuthStateChange.mockImplementation((callback) => {
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('useCurrentUser', () => {
    it('should return loading state initially and then user data', async () => {
      // Setup mock user
      const mockUser = { id: '123', email: 'user@example.com' };
      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Render hook
      const { result } = renderHook(() => useCurrentUser());

      // Initially should be loading with no user
      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();

      // Wait for the effect to run
      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have user data now
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.error).toBeNull();
    });

    it('should handle auth state changes', async () => {
      let authCallback: any;
      
      // Setup mock for onAuthStateChange to capture callback
      mockAuth.onAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      // Render hook
      const { result } = renderHook(() => useCurrentUser());

      // Wait for initial load to complete
      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate auth state change - login
      const mockUser = { id: '123', email: 'user@example.com' };
      act(() => {
        authCallback('SIGNED_IN', { user: mockUser });
      });

      // User should be updated
      expect(result.current.user).toEqual(mockUser);

      // Simulate auth state change - logout
      act(() => {
        authCallback('SIGNED_OUT', null);
      });

      // User should be null
      expect(result.current.user).toBeNull();
    });

    it('should handle errors from getUser', async () => {
      // Setup error response
      const mockError = new Error('Authentication failed');
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: mockError,
      });

      // Spy on console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Render hook
      const { result } = renderHook(() => useCurrentUser());

      // Wait for the effect to complete
      await vi.waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should have error state
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe(mockError);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error getting user:'),
        mockError
      );

      consoleSpy.mockRestore();
    });

    it('should clean up subscription on unmount', async () => {
      // Mock unsubscribe function
      const unsubscribe = vi.fn();
      mockAuth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe } },
      });

      // Render and unmount
      const { unmount } = renderHook(() => useCurrentUser());
      unmount();

      // Should have called unsubscribe
      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('useRequireAuth', () => {
    it('should redirect to login if not authenticated', async () => {
      // Setup no user
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      // Render hook
      renderHook(() => useRequireAuth());

      // Wait for effect to complete
      await vi.waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/login');
      });
    });

    it('should not redirect if authenticated', async () => {
      // Setup authenticated user
      const mockUser = { id: '123', email: 'user@example.com' };
      mockAuth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Render hook
      renderHook(() => useRequireAuth());

      // Allow effects to run
      await vi.waitFor(() => {
        expect(mockAuth.getUser).toHaveBeenCalled();
      });

      // Should not redirect
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });
});