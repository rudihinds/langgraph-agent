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

describe('Sign-Up API Route', () => {
  let mockSupabaseClient: any;
  let mockRequest: Request;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabaseClient = {
      auth: {
        signUp: vi.fn(),
      },
    };
    (createClient as any).mockReturnValue(mockSupabaseClient);

    // Mock Request object
    mockRequest = {
      json: vi.fn(),
      url: 'http://localhost:3000/api/auth/sign-up',
    } as unknown as Request;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should sign up user and sync to database successfully', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    const mockUserData = { id: 'user-123', email };
    (mockRequest.json as any).mockResolvedValue({ email, password });
    mockSupabaseClient.auth.signUp.mockResolvedValue({ data: { user: mockUserData }, error: null });
    (syncUserToDatabase as any).mockResolvedValue({ success: true });

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody.message).toBe('Check your email for the confirmation link');
    expect(responseBody.user).toEqual(mockUserData);
    expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
      email,
      password,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback',
      },
    });
    expect(syncUserToDatabase).toHaveBeenCalledWith(mockSupabaseClient, mockUserData);
  });

  it('should return 400 if email or password is missing', async () => {
    (mockRequest.json as any).mockResolvedValue({ email: 'test@example.com' }); // Missing password

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody.message).toBe('Email and password are required');
    expect(mockSupabaseClient.auth.signUp).not.toHaveBeenCalled();
    expect(syncUserToDatabase).not.toHaveBeenCalled();
  });

  it('should return 400 if Supabase signUp fails', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    const mockError = { message: 'User already exists' };
    (mockRequest.json as any).mockResolvedValue({ email, password });
    mockSupabaseClient.auth.signUp.mockResolvedValue({ data: {}, error: mockError });

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
    const syncError = { message: 'DB sync failed' };
    (mockRequest.json as any).mockResolvedValue({ email, password });
    mockSupabaseClient.auth.signUp.mockResolvedValue({ data: { user: mockUserData }, error: null });
    (syncUserToDatabase as any).mockResolvedValue({ error: syncError }); // Simulate sync failure
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(200); // Still 200 because sign-up itself succeeded
    expect(responseBody.message).toBe('Check your email for the confirmation link');
    expect(responseBody.user).toEqual(mockUserData);
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
    expect(consoleSpy).toHaveBeenCalledWith('Error in sign-up:', mockError);
    consoleSpy.mockRestore();
  });

  it('should return 500 for unexpected errors during Supabase call', async () => {
    const email = 'test@example.com';
    const password = 'password123';
    const mockError = new Error('Network Error');
    (mockRequest.json as any).mockResolvedValue({ email, password });
    mockSupabaseClient.auth.signUp.mockRejectedValue(mockError);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody.message).toBe('An unexpected error occurred');
    expect(consoleSpy).toHaveBeenCalledWith('Error in sign-up:', mockError);
    consoleSpy.mockRestore();
  });
});
