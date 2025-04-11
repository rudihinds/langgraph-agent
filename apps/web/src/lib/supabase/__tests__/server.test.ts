/**
 * Tests for the server-side Supabase client
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '../server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

// Mock dependencies
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/env', () => ({
  ENV: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
  },
}));

describe('Server-side Supabase client', () => {
  const mockCookieStore = {
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  };

  const mockSupabaseClient = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ 
        data: { url: 'https://oauth-url.example.com' }, 
        error: null 
      }),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (cookies as any).mockReturnValue(mockCookieStore);
    (createServerClient as any).mockReturnValue(mockSupabaseClient);
  });

  it('should create a valid Supabase client with auth object', async () => {
    const client = await createClient();
    
    expect(createServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    );
    
    expect(client).toBeDefined();
    expect(client!.auth).toBeDefined();
    expect(typeof client!.auth.signInWithOAuth).toBe('function');
  });

  it('should use provided cookie store if available', async () => {
    const customCookieStore = {
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn(),
    };
    
    await createClient(customCookieStore as any);
    
    expect(createServerClient).toHaveBeenCalled();
    expect(customCookieStore.getAll).not.toHaveBeenCalled(); // Not called during initialization
  });

  it('should throw an error if auth is undefined', async () => {
    (createServerClient as any).mockReturnValue({ auth: undefined });
    
    await expect(createClient()).rejects.toThrow('Supabase client auth is undefined');
  });

  it('should throw an error if client creation fails', async () => {
    (createServerClient as any).mockImplementation(() => {
      throw new Error('Failed to create client');
    });
    
    await expect(createClient()).rejects.toThrow('Failed to create client');
  });

  it('should throw an error if environment variables are missing', async () => {
    vi.mock('@/env', () => ({
      ENV: {
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-key',
      },
    }), { virtual: true });
    
    await expect(createClient()).rejects.toThrow();
  });

  it('should handle cookie errors gracefully', async () => {
    (cookies as any).mockImplementation(() => {
      throw new Error('Cookie error');
    });
    
    await expect(createClient()).rejects.toThrow('Cookie access error');
  });

  // Test actual cookie handling logic
  it('should properly handle cookies in getAll and setAll', async () => {
    const client = await createClient();
    
    // Extract the cookies object that was passed to createServerClient
    const cookiesObj = (createServerClient as any).mock.calls[0][2].cookies;
    
    // Test getAll
    cookiesObj.getAll();
    expect(mockCookieStore.getAll).toHaveBeenCalled();
    
    // Test setAll
    const mockCookies = [
      { name: 'test', value: 'value', options: {} }
    ];
    cookiesObj.setAll(mockCookies);
    expect(mockCookieStore.set).toHaveBeenCalledWith('test', 'value', {});
  });
});