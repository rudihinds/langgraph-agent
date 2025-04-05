import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProposal, uploadProposalFile } from '../actions';
import { ProposalSchema } from '@/schemas/proposal';

// Mock dependencies
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      }))
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { id: 'test-proposal-id', title: 'Test Proposal' },
            error: null
          }))
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: { user_id: 'test-user-id' },
            error: null
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null
        }))
      }))
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => ({
          data: { path: 'test-user-id/test-proposal-id/document.pdf' },
          error: null
        }))
      }))
    }
  }))
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({}))
}));

vi.mock('@/lib/user-management', () => ({
  ensureUserExists: vi.fn(async () => ({ 
    success: true, 
    user: { id: 'test-user-id', email: 'test@example.com' } 
  }))
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// Mock the Zod schema
vi.mock('@/schemas/proposal', () => ({
  ProposalSchema: {
    parse: vi.fn((data) => ({ 
      ...data,
      title: data.title || 'Test Proposal',
      proposal_type: data.proposal_type || 'application',
      user_id: data.user_id || 'test-user-id'
    }))
  }
}));

describe('Proposal Actions', () => {
  let formData: FormData;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create FormData with test proposal
    formData = new FormData();
    formData.append('title', 'Test Proposal');
    formData.append('proposal_type', 'application');
    formData.append('description', 'This is a test proposal');
  });

  describe('createProposal', () => {
    it('should create a proposal successfully when authenticated', async () => {
      const result = await createProposal(formData);
      
      expect(result.success).toBe(true);
      expect(result.proposal).toHaveProperty('id', 'test-proposal-id');
      expect(result.proposal).toHaveProperty('title', 'Test Proposal');
    });

    it('should handle authentication failure', async () => {
      // Mock authentication failure
      const ensureUserExists = require('@/lib/user-management').ensureUserExists;
      ensureUserExists.mockImplementationOnce(async () => ({ 
        success: false, 
        error: new Error('User not authenticated') 
      }));

      const result = await createProposal(formData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('User not authenticated');
    });

    it('should handle validation errors', async () => {
      // Mock validation error
      const ProposalSchema = require('@/schemas/proposal').ProposalSchema;
      ProposalSchema.parse.mockImplementationOnce(() => {
        throw new Error('Validation failed');
      });

      const result = await createProposal(formData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Validation failed');
    });

    it('should handle database errors', async () => {
      // Mock database error
      const supabase = require('@/lib/supabase/server').createClient();
      supabase.from().insert().select().single.mockImplementationOnce(() => ({
        data: null,
        error: { message: 'Database error' }
      }));

      const result = await createProposal(formData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Database error');
    });
  });

  describe('uploadProposalFile', () => {
    let fileFormData: FormData;
    
    beforeEach(() => {
      // Create FormData with file
      fileFormData = new FormData();
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      fileFormData.append('file', file);
      fileFormData.append('proposalId', 'test-proposal-id');
    });

    it('should upload a file successfully when authenticated', async () => {
      const result = await uploadProposalFile(fileFormData);
      
      expect(result.success).toBe(true);
      expect(result.filePath).toBe('test-user-id/test-proposal-id/document.pdf');
    });

    it('should handle missing file or proposalId', async () => {
      const emptyFormData = new FormData();
      const result = await uploadProposalFile(emptyFormData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing file or proposal ID');
    });

    it('should verify proposal ownership', async () => {
      // Mock ownership verification failure
      const supabase = require('@/lib/supabase/server').createClient();
      supabase.from().select().eq().single.mockImplementationOnce(() => ({
        data: { user_id: 'different-user-id' },
        error: null
      }));

      const result = await uploadProposalFile(fileFormData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Proposal not found or access denied');
    });

    it('should handle storage upload errors', async () => {
      // Mock storage upload error
      const supabase = require('@/lib/supabase/server').createClient();
      supabase.storage.from().upload.mockImplementationOnce(() => ({
        data: null,
        error: { message: 'Storage error' }
      }));

      const result = await uploadProposalFile(fileFormData);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Storage error');
    });
  });
});