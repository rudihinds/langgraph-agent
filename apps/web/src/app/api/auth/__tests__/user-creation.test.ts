import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as signUpHandler } from '../sign-up/route';
import { POST as signInHandler } from '../sign-in/route';

// Mock Next.js cookies
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
  }),
}));

// Mock Supabase client
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { full_name: 'Test User' },
          },
        },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { full_name: 'Test User' },
          },
          session: { access_token: 'mock-token' },
        },
        error: null,
      }),
    },
    from: vi.fn().mockImplementation((table) => {
      if (table === 'users') {
        return {
          insert: mockInsert.mockReturnValue({ error: null }),
          select: mockSelect.mockImplementation(() => ({
            eq: mockEq.mockImplementation(() => ({
              single: mockSingle,
            })),
          })),
          update: mockUpdate.mockReturnValue({ error: null }),
        };
      }
      return {};
    }),
  }),
}));

describe('Auth User Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } }); // Default to user not found
  });

  it('should create a user record in the users table after successful sign-up', async () => {
    const request = new Request('http://localhost:3000/api/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    await signUpHandler(request);

    expect(mockInsert).toHaveBeenCalledWith({
      id: 'test-user-id',
      email: 'test@example.com',
      full_name: 'Test User',
      avatar_url: null,
      created_at: expect.any(String),
    });
  });

  it('should create a user record in the users table if it does not exist during sign-in', async () => {
    const request = new Request('http://localhost:3000/api/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    await signInHandler(request);

    expect(mockInsert).toHaveBeenCalledWith({
      id: 'test-user-id',
      email: 'test@example.com',
      full_name: 'Test User',
      avatar_url: null,
      created_at: expect.any(String),
      last_login: expect.any(String),
    });
  });

  it('should update the last_login field if user already exists during sign-in', async () => {
    // Mock that user exists
    mockSingle.mockResolvedValue({ data: { id: 'test-user-id' }, error: null });

    const request = new Request('http://localhost:3000/api/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
    });

    await signInHandler(request);

    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({ last_login: expect.any(String) });
    expect(mockEq).toHaveBeenCalledWith('id', 'test-user-id');
  });
});