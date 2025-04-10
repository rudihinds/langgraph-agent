"use client";

import { useState } from "react";

type SuccessCallback = (proposalId: string) => void;
type ErrorCallback = (error: Error) => void;

interface ProposalSubmissionOptions {
  onSuccess?: SuccessCallback;
  onError?: ErrorCallback;
}

export function useProposalSubmission(options: ProposalSubmissionOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Submit a proposal to the API
   */
  const submitProposal = async (proposalData: any) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proposalData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create proposal");
      }

      const data = await response.json();
      options.onSuccess?.(data.id);
      setLoading(false);
      return data;
    } catch (err: any) {
      const errorObject = err instanceof Error ? err : new Error(err?.message || "Unknown error");
      setError(errorObject);
      options.onError?.(errorObject);
      setLoading(false);
      throw errorObject;
    }
  };

  /**
   * Upload a file for a proposal
   */
  const uploadFile = async (file: File, proposalId: string) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/proposals/${proposalId}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to upload file");
      }

      const data = await response.json();
      setLoading(false);
      return data;
    } catch (err: any) {
      const errorObject = err instanceof Error ? err : new Error(err?.message || "Unknown error");
      setError(errorObject);
      options.onError?.(errorObject);
      setLoading(false);
      throw errorObject;
    }
  };

  /**
   * Update an existing proposal
   */
  const updateProposal = async (proposalId: string, proposalData: any) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(proposalData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update proposal");
      }

      const data = await response.json();
      setLoading(false);
      return data;
    } catch (err: any) {
      const errorObject = err instanceof Error ? err : new Error(err?.message || "Unknown error");
      setError(errorObject);
      options.onError?.(errorObject);
      setLoading(false);
      throw errorObject;
    }
  };

  /**
   * Delete a proposal
   */
  const deleteProposal = async (proposalId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/proposals/${proposalId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete proposal");
      }

      const data = await response.json();
      setLoading(false);
      return data;
    } catch (err: any) {
      const errorObject = err instanceof Error ? err : new Error(err?.message || "Unknown error");
      setError(errorObject);
      options.onError?.(errorObject);
      setLoading(false);
      throw errorObject;
    }
  };

  return {
    submitProposal,
    uploadFile,
    updateProposal,
    deleteProposal,
    loading,
    error,
  };
}