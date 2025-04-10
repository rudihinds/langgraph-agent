import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as signOutHandler } from '../route';
import { NextResponse } from 'next/server';

// Mock NextResponse.json
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({
      data,
      status: options?.status || 200,
    })),
  },
}));

// Mock Next.js cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockReturnValue({
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

// Mock Supabase client
const mockSignOut = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    auth: {
      signOut: mockSignOut,
    }
  })),
}));

describe('Sign Out Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sign out the user successfully', async () => {
    // Mock successful sign out
    mockSignOut.mockResolvedValue({ error: null });

    const request = new Request('http://localhost:3000/api/auth/sign-out', {
      method: 'POST',
    });

    const response = await signOutHandler(request);

    expect(mockSignOut).toHaveBeenCalled();
    expect(NextResponse.json).toHaveBeenCalledWith(
      { message: 'Successfully signed out' },
      { status: 200 }
    );
  });

  it('should handle sign out errors', async () => {
    // Mock sign out error
    mockSignOut.mockResolvedValue({ error: { message: 'Sign out failed' } });

    const request = new Request('http://localhost:3000/api/auth/sign-out', {
      method: 'POST',
    });

    const response = await signOutHandler(request);

    expect(mockSignOut).toHaveBeenCalled();
    expect(NextResponse.json).toHaveBeenCalledWith(
      { message: 'Sign out failed' },
      { status: 400 }
    );
  });

  it('should handle unexpected errors', async () => {
    // Mock unexpected error
    mockSignOut.mockRejectedValue(new Error('Unexpected error'));

    const request = new Request('http://localhost:3000/api/auth/sign-out', {
      method: 'POST',
    });

    const response = await signOutHandler(request);

    expect(mockSignOut).toHaveBeenCalled();
    expect(NextResponse.json).toHaveBeenCalledWith(
      { message: 'An unexpected error occurred' },
      { status: 500 }
    );
  });
});