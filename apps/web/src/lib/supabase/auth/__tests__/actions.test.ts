/**
 * Tests for Supabase auth actions
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signIn, signOut } from '../actions';
import * as utils from '../utils';

// Mock dependencies
vi.mock('../../client', () => ({
  createClient: vi.fn(),
}));

vi.mock('../utils', () => ({
  getRedirectURL: vi.fn(),
}));

// Mock fetch for signOut
vi.stubGlobal('fetch', vi.fn());

// Mock localStorage
vi.stubGlobal('localStorage', {
  setItem: vi.fn(),
});

describe('Auth Actions', () => {
  let mockSupabaseClient: any;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Set up mock window
    global.window = {
      location: {
        href: '',
        origin: 'https://example.com',
      },
    } as any;
    
    // Set up mock client
    mockSupabaseClient = {
      auth: {
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
      },
    };
    require('../../client').createClient.mockReturnValue(mockSupabaseClient);
    
    // Set up utils mock
    vi.mocked(utils.getRedirectURL).mockReturnValue('https://example.com');
    
    // Set up fetch mock
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
  });
  
  describe('signIn', () => {
    it('should call signInWithOAuth with Google provider', async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: {},
        error: null,
      });
      
      await signIn();
      
      expect(mockSupabaseClient.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'https://example.com/auth/callback',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
    });
    
    it('should store auth start time in localStorage', async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: {},
        error: null,
      });
      
      await signIn();
      
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'auth_start_time',
        expect.any(String)
      );
    });
    
    it('should redirect to auth URL if provided', async () => {
      mockSupabaseClient.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://accounts.google.com/auth' },
        error: null,
      });
      
      await signIn();
      
      expect(window.location.href).toBe('https://accounts.google.com/auth');
    });
    
    it('should handle and return errors', async () => {
      const mockError = new Error('Auth error');
      mockSupabaseClient.auth.signInWithOAuth.mockRejectedValue(mockError);
      
      const result = await signIn();
      
      expect(result.error).toBeInstanceOf(Error);
      expect(result.data).toBeNull();
    });
  });
  
  describe('signOut', () => {
    it('should call fetch to sign out server-side', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
      
      await signOut();
      
      expect(fetch).toHaveBeenCalledWith('/api/auth/sign-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
    
    it('should call supabase.auth.signOut', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
      
      await signOut();
      
      expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
    });
    
    it('should redirect to login by default', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
      
      await signOut();
      
      expect(window.location.href).toBe('/login');
    });
    
    it('should redirect to custom URL when provided', async () => {
      mockSupabaseClient.auth.signOut.mockResolvedValue({ error: null });
      
      await signOut('/dashboard');
      
      expect(window.location.href).toBe('/dashboard');
    });
    
    it('should handle server errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ message: 'Server error' }),
      });
      
      const result = await signOut();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
    });
    
    it('should handle client errors', async () => {
      mockSupabaseClient.auth.signOut.mockRejectedValue(new Error('Client error'));
      
      const result = await signOut();
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Client error');
    });
  });
});