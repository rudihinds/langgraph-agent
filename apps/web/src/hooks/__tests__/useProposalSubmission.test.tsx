import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProposalSubmission } from '../useProposalSubmission';

// Mock fetch API
global.fetch = vi.fn();

describe('useProposalSubmission', () => {
  const mockSuccessCallback = vi.fn();
  const mockErrorCallback = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });
  
  it('should submit a proposal successfully', async () => {
    // Mock successful response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'test-proposal-id', title: 'Test Proposal' }),
    });
    
    const { result } = renderHook(() => 
      useProposalSubmission({
        onSuccess: mockSuccessCallback,
        onError: mockErrorCallback,
      })
    );
    
    const proposalData = {
      title: 'Test Proposal',
      description: 'Test Description',
      proposal_type: 'application',
    };
    
    await act(async () => {
      await result.current.submitProposal(proposalData);
    });
    
    // Verify loading state is managed properly
    expect(result.current.loading).toBe(false);
    
    // Verify fetch was called correctly
    expect(global.fetch).toHaveBeenCalledWith('/api/proposals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(proposalData),
    });
    
    // Verify success callback was called
    expect(mockSuccessCallback).toHaveBeenCalledWith('test-proposal-id');
    
    // Verify error callback was not called
    expect(mockErrorCallback).not.toHaveBeenCalled();
  });
  
  it('should handle API errors during proposal submission', async () => {
    // Mock error response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Invalid data' }),
    });
    
    const { result } = renderHook(() => 
      useProposalSubmission({
        onSuccess: mockSuccessCallback,
        onError: mockErrorCallback,
      })
    );
    
    const proposalData = {
      title: 'Test Proposal',
      description: 'Test Description',
      proposal_type: 'application',
    };
    
    try {
      await act(async () => {
        await result.current.submitProposal(proposalData);
      });
    } catch (error) {
      // Error is expected
    }
    
    // Verify loading state is managed properly
    expect(result.current.loading).toBe(false);
    
    // Verify error state is set
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Invalid data');
    
    // Verify error callback was called
    expect(mockErrorCallback).toHaveBeenCalled();
    
    // Verify success callback was not called
    expect(mockSuccessCallback).not.toHaveBeenCalled();
  });
  
  it('should upload a file successfully', async () => {
    // Mock successful response
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        url: 'https://test.com/file.pdf', 
        name: 'test.pdf', 
        size: 1024, 
        type: 'application/pdf'
      }),
    });
    
    const { result } = renderHook(() => useProposalSubmission());
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const proposalId = 'test-proposal-id';
    
    let response;
    await act(async () => {
      response = await result.current.uploadFile(file, proposalId);
    });
    
    // Verify loading state is managed properly
    expect(result.current.loading).toBe(false);
    
    // Verify fetch was called correctly with FormData
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(`/api/proposals/${proposalId}/upload`, {
      method: 'POST',
      body: expect.any(FormData),
    });
    
    // Verify response data
    expect(response).toEqual({
      url: 'https://test.com/file.pdf',
      name: 'test.pdf',
      size: 1024,
      type: 'application/pdf'
    });
  });
  
  it('should handle API errors during file upload', async () => {
    // Mock error response
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'File too large' }),
    });
    
    const { result } = renderHook(() => 
      useProposalSubmission({
        onError: mockErrorCallback,
      })
    );
    
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const proposalId = 'test-proposal-id';
    
    try {
      await act(async () => {
        await result.current.uploadFile(file, proposalId);
      });
    } catch (error) {
      // Error is expected
    }
    
    // Verify loading state is managed properly
    expect(result.current.loading).toBe(false);
    
    // Verify error state is set
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('File too large');
    
    // Verify error callback was called
    expect(mockErrorCallback).toHaveBeenCalled();
  });
  
  it('should handle network errors during proposal submission', async () => {
    // Mock network error
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
    
    const { result } = renderHook(() => 
      useProposalSubmission({
        onError: mockErrorCallback,
      })
    );
    
    const proposalData = {
      title: 'Test Proposal',
      description: 'Test Description',
      proposal_type: 'application',
    };
    
    try {
      await act(async () => {
        await result.current.submitProposal(proposalData);
      });
    } catch (error) {
      // Error is expected
    }
    
    // Verify loading state is managed properly
    expect(result.current.loading).toBe(false);
    
    // Verify error state is set correctly
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Network error');
    
    // Verify error callback was called with the error
    expect(mockErrorCallback).toHaveBeenCalledWith(expect.any(Error));
  });
});