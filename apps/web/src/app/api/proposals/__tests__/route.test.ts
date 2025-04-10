import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '../route';
import { ProposalSchema } from '@/schemas/proposal';

// Mock NextResponse
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({ data, options })),
  },
}));

// Mock cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
  })),
}));

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({})),
          })),
          order: vi.fn(() => ({})),
        })),
      })),
    })),
  })),
}));

// Mock Zod schema
vi.mock('@/schemas/proposal', () => ({
  ProposalSchema: {
    safeParse: vi.fn(),
  },
}));

describe('POST /api/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a proposal successfully', async () => {
    // Mock successful validation
    (ProposalSchema.safeParse as any).mockReturnValue({
      success: true,
      data: {
        title: 'Test Proposal',
        description: 'Test Description',
        proposal_type: 'application',
      },
    });

    // Mock authenticated user
    const mockUser = { id: 'user123' };
    const mockSupabaseClient = require('@/lib/supabase/server').createClient();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock successful database insert
    const mockProposal = {
      id: 'proposal123',
      title: 'Test Proposal',
      created_at: '2023-01-01T00:00:00.000Z',
    };
    mockSupabaseClient.from().insert().select().single.mockResolvedValue({
      data: mockProposal,
      error: null,
    });

    // Create a mock request
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        title: 'Test Proposal',
        description: 'Test Description',
        proposal_type: 'application',
      }),
    };

    // Call the API route handler
    const response = await POST(mockRequest as any);

    // Verify the response
    expect(response.data).toEqual(mockProposal);
    expect(response.options.status).toBe(201);
  });

  it('should return 401 for unauthenticated users', async () => {
    // Mock successful validation
    (ProposalSchema.safeParse as any).mockReturnValue({
      success: true,
      data: {
        title: 'Test Proposal',
        description: 'Test Description',
        proposal_type: 'application',
      },
    });

    // Mock unauthenticated user
    const mockSupabaseClient = require('@/lib/supabase/server').createClient();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    // Create a mock request
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        title: 'Test Proposal',
        description: 'Test Description',
        proposal_type: 'application',
      }),
    };

    // Call the API route handler
    const response = await POST(mockRequest as any);

    // Verify the response
    expect(response.data.message).toBe('Unauthorized');
    expect(response.options.status).toBe(401);
  });

  it('should return 400 for invalid proposal data', async () => {
    // Mock failed validation
    (ProposalSchema.safeParse as any).mockReturnValue({
      success: false,
      error: {
        format: () => ({ title: { _errors: ['Title is required'] } }),
      },
    });

    // Create a mock request
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        description: 'Test Description',
        proposal_type: 'application',
      }),
    };

    // Call the API route handler
    const response = await POST(mockRequest as any);

    // Verify the response
    expect(response.data.message).toBe('Invalid proposal data');
    expect(response.options.status).toBe(400);
  });

  it('should return 500 if database insertion fails', async () => {
    // Mock successful validation
    (ProposalSchema.safeParse as any).mockReturnValue({
      success: true,
      data: {
        title: 'Test Proposal',
        description: 'Test Description',
        proposal_type: 'application',
      },
    });

    // Mock authenticated user
    const mockUser = { id: 'user123' };
    const mockSupabaseClient = require('@/lib/supabase/server').createClient();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock failed database insert
    mockSupabaseClient.from().insert().select().single.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    // Create a mock request
    const mockRequest = {
      json: vi.fn().mockResolvedValue({
        title: 'Test Proposal',
        description: 'Test Description',
        proposal_type: 'application',
      }),
    };

    // Call the API route handler
    const response = await POST(mockRequest as any);

    // Verify the response
    expect(response.data.message).toBe('Failed to create proposal');
    expect(response.options.status).toBe(500);
  });
});

describe('GET /api/proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return proposals for authenticated user', async () => {
    // Mock authenticated user
    const mockUser = { id: 'user123' };
    const mockSupabaseClient = require('@/lib/supabase/server').createClient();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock proposals data
    const mockProposals = [
      { id: 'proposal1', title: 'Proposal 1' },
      { id: 'proposal2', title: 'Proposal 2' },
    ];
    mockSupabaseClient.from().select().eq().order.mockResolvedValue({
      data: mockProposals,
      error: null,
    });

    // Create a mock request with URL
    const mockRequest = {
      url: 'https://example.com/api/proposals',
    };

    // Call the API route handler
    const response = await GET(mockRequest as any);

    // Verify the response
    expect(response.data).toEqual(mockProposals);
  });

  it('should apply filters from query parameters', async () => {
    // Mock authenticated user
    const mockUser = { id: 'user123' };
    const mockSupabaseClient = require('@/lib/supabase/server').createClient();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock filtered proposals data
    const mockProposals = [{ id: 'proposal1', title: 'Proposal 1', status: 'draft' }];
    
    // Set up the mock chain
    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockProposals,
              error: null,
            }),
          }),
        }),
      }),
    });
    
    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
    });

    // Create a mock request with query parameters
    const mockRequest = {
      url: 'https://example.com/api/proposals?status=draft&type=application',
    };

    // Call the API route handler
    const response = await GET(mockRequest as any);

    // Verify the response
    expect(response.data).toEqual(mockProposals);
  });

  it('should return 401 for unauthenticated users', async () => {
    // Mock unauthenticated user
    const mockSupabaseClient = require('@/lib/supabase/server').createClient();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    // Create a mock request
    const mockRequest = {
      url: 'https://example.com/api/proposals',
    };

    // Call the API route handler
    const response = await GET(mockRequest as any);

    // Verify the response
    expect(response.data.message).toBe('Unauthorized');
    expect(response.options.status).toBe(401);
  });

  it('should return 500 if database query fails', async () => {
    // Mock authenticated user
    const mockUser = { id: 'user123' };
    const mockSupabaseClient = require('@/lib/supabase/server').createClient();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    });

    // Mock database query error
    mockSupabaseClient.from().select().eq().order.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    // Create a mock request
    const mockRequest = {
      url: 'https://example.com/api/proposals',
    };

    // Call the API route handler
    const response = await GET(mockRequest as any);

    // Verify the response
    expect(response.data.message).toBe('Failed to retrieve proposals');
    expect(response.options.status).toBe(500);
  });
});