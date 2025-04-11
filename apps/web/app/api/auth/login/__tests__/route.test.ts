/**
 * Tests for the login API route
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Mock dependencies
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('Login API Route', () => {
  const mockSupabaseAuth = {
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
  };

  const mockSupabaseClient = {
    auth: mockSupabaseAuth,
  };

  const mockCreateClient = vi.fn().mockResolvedValue(mockSupabaseClient);
  const mockCookies = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (cookies as any).mockReturnValue(mockCookies);
    vi.mocked(require('@/lib/supabase/server').createClient).mockImplementation(mockCreateClient);
  });

  describe('GET handler', () => {
    it('should generate an OAuth URL for Google login', async () => {
      // Mock successful OAuth URL generation
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://example.com/oauth' },
        error: null,
      });

      const req = new Request('http://localhost:3000/api/auth/login');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ url: 'https://example.com/oauth' });
      expect(mockCreateClient).toHaveBeenCalledWith(mockCookies);
      expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
        },
      });
    });

    it('should handle OAuth error', async () => {
      // Mock OAuth error
      mockSupabaseAuth.signInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: { message: 'OAuth error' },
      });

      const req = new Request('http://localhost:3000/api/auth/login');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'OAuth error' });
    });

    it('should handle Supabase client errors', async () => {
      // Mock client error
      mockCreateClient.mockRejectedValue(new Error('Supabase client error'));

      const req = new Request('http://localhost:3000/api/auth/login');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Supabase client error');
    });

    it('should handle auth being undefined', async () => {
      // Mock auth being undefined
      mockCreateClient.mockResolvedValue({ auth: undefined });
      
      const req = new Request('http://localhost:3000/api/auth/login');
      
      // This test verifies that our code properly handles the case that triggered the original bug
      await expect(GET(req)).resolves.toBeInstanceOf(NextResponse);
      
      const response = await GET(req);
      expect(response.status).toBe(500);
    });

    it('should handle unexpected errors', async () => {
      // Mock unexpected error
      mockSupabaseAuth.signInWithOAuth.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const req = new Request('http://localhost:3000/api/auth/login');
      const response = await GET(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Unexpected error');
    });
  });

  describe('POST handler', () => {
    it('should authenticate with email and password', async () => {
      // Mock successful login
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: {
          user: { id: '123', email: 'test@example.com' },
          session: { access_token: 'token' },
        },
        error: null,
      });

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        user: { id: '123', email: 'test@example.com' },
        session: { access_token: 'token' },
      });
      expect(mockCreateClient).toHaveBeenCalledWith(mockCookies);
      expect(mockSupabaseAuth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password',
      });
    });

    it('should handle authentication error', async () => {
      // Mock auth error
      mockSupabaseAuth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' },
      });

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toEqual({ error: 'Invalid credentials' });
    });

    it('should handle Supabase client errors', async () => {
      // Mock client error
      mockCreateClient.mockRejectedValue(new Error('Supabase client error'));

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'password' }),
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Supabase client error');
    });

    it('should handle JSON parsing errors', async () => {
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});