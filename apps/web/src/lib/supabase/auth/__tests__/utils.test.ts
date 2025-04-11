/**
 * Tests for Supabase auth utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  getRedirectURL,
  getSession,
  getAccessToken
} from '../utils';

// Mock createClient before importing
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockRefreshSession = vi.fn();

const mockSupabaseClient = {
  auth: {
    getSession: mockGetSession,
    getUser: mockGetUser,
    refreshSession: mockRefreshSession,
  },
};

// Mock the client module
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

// Mock window object
const originalWindow = { ...window };

describe('Auth Utils', () => {
  beforeEach(() => {
    // Reset mocks and window
    vi.resetAllMocks();
    global.window = originalWindow as any;
  });

  describe('getRedirectURL', () => {
    it('should return window.location.origin when in browser', () => {
      // Set up window for test
      global.window = { 
        ...global.window,
        location: { 
          ...global.window.location, 
          origin: 'https://example.com' 
        } 
      } as any;
      
      const result = getRedirectURL();
      expect(result).toBe('https://example.com');
    });

    it('should return fallback URL when not in browser', () => {
      // Simulate server environment
      global.window = undefined as any;
      
      // Mock environment variable
      process.env.NEXT_PUBLIC_SITE_URL = 'https://staging.example.com';
      
      const result = getRedirectURL();
      expect(result).toBe('https://staging.example.com');
      
      // Clean up
      delete process.env.NEXT_PUBLIC_SITE_URL;
    });

    it('should return default localhost URL when no window and no env var', () => {
      // Simulate server environment with no env var
      global.window = undefined as any;
      delete process.env.NEXT_PUBLIC_SITE_URL;
      
      const result = getRedirectURL();
      expect(result).toBe('http://localhost:3000');
    });
  });
  
  describe('getSession', () => {
    it('should call supabase.auth.getSession', async () => {
      mockGetSession.mockResolvedValue({ data: { session: { user: {} } } });
      
      await getSession();
      
      expect(mockGetSession).toHaveBeenCalled();
    });
  });
  
  describe('getAccessToken', () => {
    it('should return the access token when session exists', async () => {
      mockGetSession.mockResolvedValue({ 
        data: { session: { access_token: 'test-token' } } 
      });
      
      const token = await getAccessToken();
      
      expect(token).toBe('test-token');
    });
    
    it('should return null when no session exists', async () => {
      mockGetSession.mockResolvedValue({ 
        data: { session: null } 
      });
      
      const token = await getAccessToken();
      
      expect(token).toBeNull();
    });
  });
});