import { createClient } from '../server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { ENV } from '@/env';

// Mock dependencies
jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}));

jest.mock('@/env', () => ({
  ENV: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
  },
}));

describe('Supabase Server Client', () => {
  const mockCookies = {
    get: jest.fn(),
    set: jest.fn(),
  };
  
  const mockSupabaseClient = {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (cookies as jest.Mock).mockReturnValue(mockCookies);
    (createServerClient as jest.Mock).mockReturnValue(mockSupabaseClient);
  });

  it('should create a Supabase client with correct parameters', () => {
    createClient();

    expect(createServerClient).toHaveBeenCalledWith(
      ENV.NEXT_PUBLIC_SUPABASE_URL,
      ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({
        cookies: expect.objectContaining({
          get: expect.any(Function),
          set: expect.any(Function),
          remove: expect.any(Function),
        }),
      })
    );
  });

  it('should use provided cookieStore if available', () => {
    const customCookieStore = {
      get: jest.fn(),
      set: jest.fn(),
    };
    
    (cookies as jest.Mock).mockReturnValue(mockCookies);
    
    createClient(customCookieStore as any);
    
    // Get the cookie handlers passed to createServerClient
    const cookieHandlers = (createServerClient as jest.Mock).mock.calls[0][2].cookies;
    
    // Call the get method to test if it uses customCookieStore
    cookieHandlers.get('test-cookie');
    
    expect(customCookieStore.get).toHaveBeenCalledWith('test-cookie');
    expect(mockCookies.get).not.toHaveBeenCalled();
  });

  it('should use default cookies() if no cookieStore provided', () => {
    createClient();
    
    // Get the cookie handlers passed to createServerClient
    const cookieHandlers = (createServerClient as jest.Mock).mock.calls[0][2].cookies;
    
    // Call the get method to test if it uses the default cookieStore
    cookieHandlers.get('test-cookie');
    
    expect(mockCookies.get).toHaveBeenCalledWith('test-cookie');
  });

  it('should handle errors gracefully when getting cookies', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    mockCookies.get.mockImplementation(() => {
      throw new Error('Cookie error');
    });
    
    createClient();
    
    // Get the cookie handlers passed to createServerClient
    const cookieHandlers = (createServerClient as jest.Mock).mock.calls[0][2].cookies;
    
    // Call the get method which should throw but be caught
    const result = cookieHandlers.get('test-cookie');
    
    expect(result).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[Supabase Client] Error getting cookie 'test-cookie':", 
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });

  it('should throw an error if SUPABASE_URL is missing', () => {
    // Temporarily override ENV mock
    jest.resetModules();
    jest.mock('@/env', () => ({
      ENV: {
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
      },
    }));
    
    // Re-import to get the new mocked version
    const { createClient: createClientWithMissingURL } = require('../server');
    
    expect(() => createClientWithMissingURL()).toThrow('Missing NEXT_PUBLIC_SUPABASE_URL');
    
    // Restore the original ENV mock
    jest.resetModules();
    jest.mock('@/env', () => ({
      ENV: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
      },
    }));
  });

  it('should throw an error if SUPABASE_ANON_KEY is missing', () => {
    // Temporarily override ENV mock
    jest.resetModules();
    jest.mock('@/env', () => ({
      ENV: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      },
    }));
    
    // Re-import to get the new mocked version
    const { createClient: createClientWithMissingKey } = require('../server');
    
    expect(() => createClientWithMissingKey()).toThrow('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    // Restore the original ENV mock
    jest.resetModules();
    jest.mock('@/env', () => ({
      ENV: {
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
      },
    }));
  });
});