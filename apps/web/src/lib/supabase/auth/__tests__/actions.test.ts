/**
 * Basic tests for Auth actions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the signOut Supabase function
const mockSignOut = vi.fn().mockResolvedValue({ error: null });

// Mock modules before importing the function
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      signOut: mockSignOut
    }
  }))
}));

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true })
});

// Mock window.location
const originalLocation = window.location;
delete window.location;
window.location = { href: '' } as any;

// Now import the function
import { signOut } from '../actions';

describe('Auth Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.location = originalLocation;
  });

  // Test API call
  it('should call the server API endpoint', async () => {
    await signOut();
    
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/sign-out', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
  });
  
  // Test client library call
  it('should call supabase.auth.signOut', async () => {
    await signOut();
    
    expect(mockSignOut).toHaveBeenCalled();
  });
});