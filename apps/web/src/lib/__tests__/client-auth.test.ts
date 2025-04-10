import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signOut } from '../client-auth';

// Mock fetch
global.fetch = vi.fn();
global.window = {
  ...global.window,
  location: {
    ...global.window?.location,
    href: '',
  },
} as any;

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({ error: null }),
    }
  })),
}));

describe('signOut function', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.href = '';
  });

  it('should sign out successfully and redirect to login by default', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ message: 'Successfully signed out' }),
    });

    const result = await signOut();

    expect(fetch).toHaveBeenCalledWith('/api/auth/sign-out', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(window.location.href).toBe('/login');
    expect(result).toEqual({ success: true });
  });

  it('should redirect to a custom URL when provided', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValueOnce({ message: 'Successfully signed out' }),
    });

    const result = await signOut('/custom-redirect');

    expect(window.location.href).toBe('/custom-redirect');
    expect(result).toEqual({ success: true });
  });

  it('should handle server sign-out errors', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      json: vi.fn().mockResolvedValueOnce({ message: 'Server error' }),
    });

    const result = await signOut();

    expect(window.location.href).toBe('');
    expect(result).toEqual({
      success: false,
      error: 'Server error',
    });
  });

  it('should handle network errors', async () => {
    (fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const result = await signOut();

    expect(window.location.href).toBe('');
    expect(result).toEqual({
      success: false,
      error: 'Network error',
    });
  });
});