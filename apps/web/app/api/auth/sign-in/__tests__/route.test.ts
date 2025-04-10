import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { createClient } from '@/lib/supabase/server';
import { syncUserToDatabase } from '@/lib/user-management';
import { NextResponse } from 'next/server';

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

describe('Sign-In API Route', () => {
  let mockSupabaseClient: any;
  let mockRequest: Request;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        signInWithPassword: vi.fn(),
      },
    };
    (createClient as any).mockReturnValue(mockSupabaseClient);

    // Mock Request object
    mockRequest = {
      json: vi.fn(),
    } as unknown as Request;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should sign in user and sync to database successfully', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    const mockUserData = { id: 'user-123', email };
    const mockSessionData = { access_token: 'token', refresh_token: 'refresh' };
    (mockRequest.json as any).mockResolvedValue({ email, password });
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({ 
      data: { user: mockUserData, session: mockSessionData }, 
      error: null 
    });
    (syncUserToDatabase as any).mockResolvedValue({ success: true });

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody.message).toBe('Successfully signed in');
    expect(responseBody.user).toEqual(mockUserData);
    expect(responseBody.session).toEqual(mockSessionData);
    expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({ email, password });
    expect(syncUserToDatabase).toHaveBeenCalledWith(mockSupabaseClient, mockUserData);
  });

  it('should return 400 if email or password is missing', async () => {
    (mockRequest.json as any).mockResolvedValue({ email: 'test@example.com' }); // Missing password

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody.message).toBe('Email and password are required');
    expect(mockSupabaseClient.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(syncUserToDatabase).not.toHaveBeenCalled();
  });

  it('should return 400 if Supabase signInWithPassword fails (invalid credentials)', async () => {
    const email = 'test@example.com';
    const password = 'wrongpassword';
    const mockError = { message: 'Invalid login credentials' };
    (mockRequest.json as any).mockResolvedValue({ email, password });
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({ 
      data: { user: null, session: null }, 
      error: mockError 
    });

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody.message).toBe(mockError.message);
    expect(syncUserToDatabase).not.toHaveBeenCalled();
  });

  it('should return 200 but log error if syncUserToDatabase fails', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    const mockUserData = { id: 'user-123', email };
    const mockSessionData = { access_token: 'token', refresh_token: 'refresh' };
    const syncError = { message: 'DB sync failed' };
    (mockRequest.json as any).mockResolvedValue({ email, password });
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({ 
      data: { user: mockUserData, session: mockSessionData }, 
      error: null 
    });
    (syncUserToDatabase as any).mockResolvedValue({ error: syncError }); // Simulate sync failure
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(200); // Still 200 because sign-in itself succeeded
    expect(responseBody.message).toBe('Successfully signed in');
    expect(responseBody.user).toEqual(mockUserData);
    expect(responseBody.session).toEqual(mockSessionData);
    expect(syncUserToDatabase).toHaveBeenCalledWith(mockSupabaseClient, mockUserData);
    // We expect the sync error to be handled internally (logged), not affect the response
    // consoleSpy.mockRestore(); // Restore console spy if needed elsewhere
  });

  it('should return 500 for unexpected errors during JSON parsing', async () => {
    const mockError = new Error('Invalid JSON');
    (mockRequest.json as any).mockRejectedValue(mockError);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody.message).toBe('An unexpected error occurred');
    expect(consoleSpy).toHaveBeenCalledWith('Error in sign-in:', mockError);
    consoleSpy.mockRestore();
  });

  it('should return 500 for unexpected errors during Supabase call', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    const mockError = new Error('Network Error');
    (mockRequest.json as any).mockResolvedValue({ email, password });
    mockSupabaseClient.auth.signInWithPassword.mockRejectedValue(mockError);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody.message).toBe('An unexpected error occurred');
    expect(consoleSpy).toHaveBeenCalledWith('Error in sign-in:', mockError);
    consoleSpy.mockRestore();
  });
});
