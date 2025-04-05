import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
import { createClient } from '@/lib/supabase/server';
import { syncUserToDatabase } from '@/lib/user-management';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/user-management', () => ({
  syncUserToDatabase: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  })),
}));
vi.mock('next/server', async (importOriginal) => {
  const mod = await importOriginal() as any;
  return {
    ...mod,
    NextResponse: {
      redirect: vi.fn().mockImplementation((url) => ({
        url,
        status: 307, // Default redirect status
        cookies: {
          set: vi.fn(),
          getAll: vi.fn().mockReturnValue([]),
        },
      })),
      next: vi.fn().mockImplementation(() => ({
        status: 200,
        cookies: {
          set: vi.fn(),
          getAll: vi.fn().mockReturnValue([]),
        },
      })),
    }
  }
});

describe('Auth Callback Route', () => {
  let mockSupabaseClient: any;
  let mockCookieStore: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock CookieStore
    mockCookieStore = {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    };
    (cookies as any).mockReturnValue(mockCookieStore);

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        exchangeCodeForSession: vi.fn(),
      },
    };
    (createClient as any).mockReturnValue(mockSupabaseClient);

    // Reset NextResponse mocks
    (NextResponse.redirect as any).mockClear();
    (NextResponse.redirect as any).mockImplementation((url) => ({
        url,
        status: 307,
        cookies: { set: vi.fn(), getAll: vi.fn().mockReturnValue([]) },
    }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  const createMockRequest = (searchParams: Record<string, string>): NextRequest => {
    const url = new URL('http://localhost:3000/auth/callback');
    Object.entries(searchParams).forEach(([key, value]) => url.searchParams.set(key, value));
    return { url: url.toString(), nextUrl: url } as unknown as NextRequest;
  };

  it('should exchange code for session and sync user successfully', async () => {
    const code = 'valid-code';
    const mockUserData = { id: 'user-123', email: 'test@example.com' };
    const mockSessionData = { access_token: 'token', refresh_token: 'refresh', user: mockUserData, expires_at: Date.now() / 1000 + 3600 };
    const mockRequest = createMockRequest({ code });

    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({ 
      data: { session: mockSessionData, user: mockUserData }, 
      error: null 
    });
    (syncUserToDatabase as any).mockResolvedValue({ success: true });

    const response = await GET(mockRequest);
    
    expect(createClient).toHaveBeenCalledWith(mockCookieStore);
    expect(mockSupabaseClient.auth.exchangeCodeForSession).toHaveBeenCalledWith(code);
    expect(syncUserToDatabase).toHaveBeenCalledWith(mockSupabaseClient, mockUserData);
    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectCall = (NextResponse.redirect as any).mock.calls[0][0];
    expect(redirectCall.pathname).toBe('/dashboard');
    expect(response.cookies.set).toHaveBeenCalledWith('auth-session-established', 'true', expect.any(Object));
  });

  it('should redirect to login with error if OAuth provider returns error', async () => {
    const error = 'access_denied';
    const errorDescription = 'User denied access';
    const mockRequest = createMockRequest({ error, error_description: errorDescription });

    await GET(mockRequest);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectCall = (NextResponse.redirect as any).mock.calls[0][0];
    expect(redirectCall.pathname).toBe('/login');
    expect(redirectCall.search).toContain(`error=${encodeURIComponent(errorDescription)}`);
    expect(mockSupabaseClient.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(syncUserToDatabase).not.toHaveBeenCalled();
  });

  it('should redirect to login with error if code is missing', async () => {
    const mockRequest = createMockRequest({}); // No code

    await GET(mockRequest);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectCall = (NextResponse.redirect as any).mock.calls[0][0];
    expect(redirectCall.pathname).toBe('/login');
    expect(redirectCall.search).toContain('error=missing_code');
    expect(mockSupabaseClient.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('should redirect to login with error if exchangeCodeForSession fails', async () => {
    const code = 'invalid-code';
    const mockError = { message: 'Invalid code exchange' };
    const mockRequest = createMockRequest({ code });

    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({ data: {}, error: mockError });

    await GET(mockRequest);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectCall = (NextResponse.redirect as any).mock.calls[0][0];
    expect(redirectCall.pathname).toBe('/login');
    expect(redirectCall.search).toContain(`error=${encodeURIComponent(mockError.message)}`);
    expect(syncUserToDatabase).not.toHaveBeenCalled();
  });
  
   it('should redirect to login with error if no session is returned after exchange', async () => {
    const code = 'valid-code-no-session';
    const mockRequest = createMockRequest({ code });

    // Simulate Supabase returning success but no session object
    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({ 
      data: { session: null, user: null }, // No session
      error: null 
    });

    await GET(mockRequest);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectCall = (NextResponse.redirect as any).mock.calls[0][0];
    expect(redirectCall.pathname).toBe('/login');
    expect(redirectCall.search).toContain('error=no_session');
    expect(syncUserToDatabase).not.toHaveBeenCalled();
  });

  it('should still redirect to dashboard but log error if syncUserToDatabase fails', async () => {
    const code = 'valid-code-sync-fail';
    const mockUserData = { id: 'user-123', email: 'syncfail@example.com' };
    const mockSessionData = { access_token: 'token', refresh_token: 'refresh', user: mockUserData, expires_at: Date.now() / 1000 + 3600 };
    const syncError = { message: 'DB sync failed' };
    const mockRequest = createMockRequest({ code });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockSupabaseClient.auth.exchangeCodeForSession.mockResolvedValue({ 
      data: { session: mockSessionData, user: mockUserData }, 
      error: null 
    });
    (syncUserToDatabase as any).mockResolvedValue({ error: syncError }); // Simulate sync failure

    const response = await GET(mockRequest);

    expect(syncUserToDatabase).toHaveBeenCalledWith(mockSupabaseClient, mockUserData);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Error syncing user to database'), syncError);
    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectCall = (NextResponse.redirect as any).mock.calls[0][0];
    expect(redirectCall.pathname).toBe('/dashboard'); // Still redirects on successful auth
    expect(response.cookies.set).toHaveBeenCalledWith('auth-session-established', 'true', expect.any(Object));
    consoleSpy.mockRestore();
  });

  it('should redirect to login with server_error on unexpected exceptions', async () => {
    const code = 'valid-code-unexpected-fail';
    const mockError = new Error('Something broke unexpectedly');
    const mockRequest = createMockRequest({ code });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockSupabaseClient.auth.exchangeCodeForSession.mockRejectedValue(mockError);

    await GET(mockRequest);

    expect(NextResponse.redirect).toHaveBeenCalled();
    const redirectCall = (NextResponse.redirect as any).mock.calls[0][0];
    expect(redirectCall.pathname).toBe('/login');
    expect(redirectCall.search).toContain('error=server_error');
    expect(redirectCall.search).toContain(`details=${encodeURIComponent(mockError.message)}`);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Unexpected error in callback'), mockError.message, expect.any(String));
    consoleSpy.mockRestore();
  });
});
