import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { updateSession } from '../lib/supabase/middleware';

// Mock the createServerClient function
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
    },
  })),
}));

// Mock environment variables
vi.mock('@/env', () => ({
  ENV: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

describe('Auth Middleware', () => {
  let mockRedirectFn: any;
  let mockNextFn: any;
  
  beforeEach(() => {
    vi.resetAllMocks();
    
    // Mock Next.js functions
    mockRedirectFn = vi.fn((url) => ({ url }));
    mockNextFn = vi.fn(() => ({
      cookies: {
        set: vi.fn(),
      },
    }));
    
    NextResponse.redirect = mockRedirectFn;
    NextResponse.next = mockNextFn;
    
    // Mock console methods to avoid cluttering test output
    console.log = vi.fn();
    console.error = vi.fn();
  });
  
  it('allows access to public paths without authentication', async () => {
    // Setup: User is not authenticated
    const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
    require('@supabase/ssr').createServerClient.mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    });
    
    // For each public path, verify it's allowed
    const publicPaths = [
      '/login',
      '/auth/callback',
      '/api/auth/sign-in',
      '/',
      '/_next/static/chunks/main.js',
      '/public/images/logo.png',
      '/favicon.ico',
    ];
    
    for (const path of publicPaths) {
      const request = new NextRequest(new URL(`https://example.com${path}`));
      request.cookies = {
        getAll: vi.fn().mockReturnValue([]),
      } as any;
      
      await updateSession(request);
      
      // Should not redirect to login
      expect(mockRedirectFn).not.toHaveBeenCalled();
      // Should call next() to continue to the route
      expect(mockNextFn).toHaveBeenCalled();
      
      vi.clearAllMocks();
    }
  });
  
  it('redirects to login for protected paths when not authenticated', async () => {
    // Setup: User is not authenticated
    const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
    require('@supabase/ssr').createServerClient.mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    });
    
    // Test protected paths
    const protectedPaths = [
      '/dashboard',
      '/profile',
      '/settings',
      '/api/protected-route',
    ];
    
    for (const path of protectedPaths) {
      const request = new NextRequest(new URL(`https://example.com${path}`));
      request.cookies = {
        getAll: vi.fn().mockReturnValue([]),
      } as any;
      
      await updateSession(request);
      
      // Should redirect to login
      expect(mockRedirectFn).toHaveBeenCalledWith(expect.objectContaining({
        pathname: '/login',
      }));
      
      vi.clearAllMocks();
    }
  });
  
  it('allows access to protected paths when authenticated', async () => {
    // Setup: User is authenticated
    const mockSession = {
      user: { id: 'test-user-id' },
      access_token: 'test-token',
    };
    const mockGetSession = vi.fn().mockResolvedValue({ data: { session: mockSession } });
    require('@supabase/ssr').createServerClient.mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    });
    
    // Test protected paths
    const protectedPaths = [
      '/dashboard',
      '/profile',
      '/settings',
      '/api/protected-route',
    ];
    
    for (const path of protectedPaths) {
      const request = new NextRequest(new URL(`https://example.com${path}`));
      request.cookies = {
        getAll: vi.fn().mockReturnValue([]),
      } as any;
      
      await updateSession(request);
      
      // Should not redirect
      expect(mockRedirectFn).not.toHaveBeenCalled();
      // Should call next() to continue to the route
      expect(mockNextFn).toHaveBeenCalled();
      
      vi.clearAllMocks();
    }
  });
  
  it('redirects from login to dashboard when already authenticated', async () => {
    // Setup: User is authenticated
    const mockSession = {
      user: { id: 'test-user-id' },
      access_token: 'test-token',
    };
    const mockGetSession = vi.fn().mockResolvedValue({ data: { session: mockSession } });
    require('@supabase/ssr').createServerClient.mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    });
    
    const request = new NextRequest(new URL('https://example.com/login'));
    request.cookies = {
      getAll: vi.fn().mockReturnValue([]),
    } as any;
    
    await updateSession(request);
    
    // Should redirect to dashboard
    expect(mockRedirectFn).toHaveBeenCalledWith(expect.objectContaining({
      pathname: '/dashboard',
    }));
  });
  
  it('handles errors gracefully', async () => {
    // Setup: getSession throws an error
    const mockError = new Error('Test error');
    const mockGetSession = vi.fn().mockRejectedValue(mockError);
    require('@supabase/ssr').createServerClient.mockReturnValue({
      auth: {
        getSession: mockGetSession,
      },
    });
    
    const request = new NextRequest(new URL('https://example.com/dashboard'));
    request.cookies = {
      getAll: vi.fn().mockReturnValue([]),
    } as any;
    
    await updateSession(request);
    
    // Should log the error
    expect(console.error).toHaveBeenCalled();
    // Should call next() to avoid breaking the app
    expect(mockNextFn).toHaveBeenCalled();
  });
});